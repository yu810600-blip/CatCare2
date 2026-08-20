"use client";

/**
 * Apple 健康（HealthKit）匯入——iOS App 限定。
 *
 * Garmin Connect 會把資料同步進「健康」，這裡讀「健康」就能帶入 Garmin 數據，
 * 不碰 Garmin 帳密。plugin 選 capacitor-health（8.2.0）：兩個候選中唯一
 * 支援 Capacitor 8 + SPM 的（@perfood/capacitor-healthkit 停在 Capacitor 4、
 * 無 Package.swift）。代價是它沒有飲水與基礎能量的讀取介面，所以只匯入：
 *   體重 kg／體脂 %／瘦體重 kg → body（測量機器欄填資料來源名稱）
 *   workout 名稱/分鐘/活動卡路里 → exercise
 *
 * 防重複：每筆匯入 entry 的 data 帶 source 與 externalId，同步時先比對已存在
 * 的 externalId 跳過；使用者手動輸入的紀錄沒有 externalId，完全不受影響。
 * 網頁版偵測非 Capacitor 原生環境即不啟用、不載入、不報錯。
 */
import { toDateKey, type Data, type Entry } from "./health";

const PERMISSIONS = ["READ_WEIGHT", "READ_BODY_FAT", "READ_LEAN_BODY_MASS", "READ_WORKOUTS", "READ_ACTIVE_CALORIES"] as const;
const round1 = (value: number) => Math.round(value * 10) / 10;

async function plugin() {
  const { Capacitor } = await import("@capacitor/core");
  if (!Capacitor.isNativePlatform()) return null;
  const { Health } = await import("capacitor-health");
  const { available } = await Health.isHealthAvailable();
  return available ? Health : null;
}

/** 網頁版回 false，個人資料頁靠這個決定要不要顯示同步區塊。 */
export async function isHealthSyncAvailable(): Promise<boolean> {
  try { return (await plugin()) !== null; } catch { return false; }
}

/** 「連結 Apple 健康」：請求讀取權限（iOS 只在第一次真正跳窗）。 */
export async function connectAppleHealth(): Promise<boolean> {
  try {
    const health = await plugin();
    if (!health) return false;
    await health.requestHealthPermissions({ permissions: [...PERMISSIONS] });
    return true;
  } catch { return false; }
}

export type HealthImport = { category: string; recordedAt: string; data: Data };

/** 讀最近 days 天的健康資料，回傳「還不存在」的新紀錄（比對 externalId）。 */
export async function fetchHealthEntries(existing: Entry[], days = 7): Promise<HealthImport[]> {
  const health = await plugin();
  if (!health) return [];
  const known = new Set(existing.map(e => String(e.data.externalId ?? "")).filter(Boolean));
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400000);
  const range = { startDate: start.toISOString(), endDate: end.toISOString() };
  const out: HealthImport[] = [];

  // 身體組成：weight / body-fat / lean-body-mass，各取每天最後一筆再合併成一筆 body
  const byDay = new Map<string, { weight?: number; fat?: number; muscle?: number; sourceName?: string }>();
  const kinds = [
    ["weight", "weight", (v: number) => round1(v)],
    ["body-fat", "fat", (v: number) => round1(v)],
    ["lean-body-mass", "muscle", (v: number) => round1(v)],
  ] as const;
  for (const [dataType, field, normalize] of kinds) {
    try {
      const { records } = await health.queryRecords({ ...range, dataType });
      for (const record of records) {
        const day = toDateKey(new Date(record.startDate));
        const slot = byDay.get(day) ?? {};
        // records 依時間排序，後蓋前＝取每天最後一筆
        slot[field] = normalize(record.value);
        slot.sourceName = record.sourceName || slot.sourceName;
        byDay.set(day, slot);
      }
    } catch { /* 個別型別沒權限就略過 */ }
  }
  for (const [day, slot] of byDay) {
    if (slot.weight === undefined && slot.fat === undefined && slot.muscle === undefined) continue;
    const externalId = `hk-body-${day}-${slot.weight ?? ""}-${slot.fat ?? ""}-${slot.muscle ?? ""}`;
    if (known.has(externalId)) continue;
    const data: Data = { machine: slot.sourceName ?? "Apple 健康", source: "healthkit", externalId };
    if (slot.weight !== undefined) data.weight = slot.weight;
    if (slot.fat !== undefined) data.fat = slot.fat;
    if (slot.muscle !== undefined) data.muscle = slot.muscle;
    out.push({ category: "body", recordedAt: day, data });
  }

  // 運動：每個 workout 一筆 exercise
  try {
    const { workouts } = await health.queryWorkouts({ ...range, includeHeartRate: false, includeRoute: false, includeSteps: false });
    for (const workout of workouts) {
      const day = toDateKey(new Date(workout.startDate));
      const externalId = workout.id ? `hk-workout-${workout.id}` : `hk-workout-${workout.startDate}-${workout.workoutType}`;
      if (known.has(externalId)) continue;
      out.push({
        category: "exercise", recordedAt: day,
        data: {
          activity: workout.workoutType || "運動",
          minutes: Math.round(workout.duration / 60),
          calories: Math.round(workout.calories),
          source: "healthkit", externalId,
        },
      });
    }
  } catch { /* 沒權限就略過 */ }

  return out;
}
