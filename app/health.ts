/**
 * 所有 Dashboard 數值的計算來源。
 * 這裡只放純函式：輸入實際的 entries 與 profile，輸出畫面要顯示的數字，
 * 不保留任何示範用的固定值，療程長度或目標改動後所有衍生數值會自動跟著變。
 */

export type Data = Record<string, string | number>;
export type Entry = { id: number; category: string; recordedAt: string; data: Data };
export type ProfileData = {
  email: string; displayName: string; birthday: string; sex: string;
  height: number; targetWeight: number; calorieGoal: number;
  startWeight: number; programStart: string; programWeeks: number;
};

export const EMPTY_PROFILE: ProfileData = {
  email: "", displayName: "", birthday: "", sex: "",
  height: 0, targetWeight: 0, calorieGoal: 0,
  startWeight: 0, programStart: "", programWeeks: 0,
};

/* ---------- 日期 ---------- */
// 一律用本機日期，避免 toISOString() 在台灣時區把凌晨的紀錄算成前一天。

export function toDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
export function todayKey(): string { return toDateKey(new Date()); }
export function parseDateKey(key: string): Date | null {
  const parts = /^(\d{4})-(\d{2})-(\d{2})/.exec(key || "");
  if (!parts) return null;
  const date = new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}
export function diffDays(from: string, to: string): number | null {
  const a = parseDateKey(from), b = parseDateKey(to);
  if (!a || !b) return null;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}
export function shiftDays(key: string, delta: number): string {
  const date = parseDateKey(key);
  if (!date) return "";
  date.setDate(date.getDate() + delta);
  return toDateKey(date);
}
export function formatDate(key: string): string {
  const date = parseDateKey(key);
  return date ? `${date.getMonth() + 1}月${date.getDate()}日` : "尚未設定";
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const round1 = (value: number) => Math.round(value * 10) / 10;
const num = (value: string | number | undefined) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/* ---------- 體重序列 ---------- */

export type WeightPoint = { date: string; weight: number };

export function weightSeries(entries: Entry[]): WeightPoint[] {
  return entries
    .filter(e => e.category === "body")
    .map(e => ({ date: e.recordedAt, weight: num(e.data.weight) }))
    .filter(p => parseDateKey(p.date) !== null && p.weight > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/* ---------- 距離目標 ---------- */

export type GoalProgress = {
  start: number; current: number; target: number;
  lost: number; remaining: number; totalToLose: number;
  percent: number; hasWeight: boolean; hasTarget: boolean; reached: boolean;
};

export function goalProgress(series: WeightPoint[], profile: ProfileData): GoalProgress {
  // 初始體重優先用個人資料填的值，沒填就退回第一筆身體數值。
  const start = profile.startWeight > 0 ? profile.startWeight : (series[0]?.weight ?? 0);
  const current = series.at(-1)?.weight ?? 0;
  const target = profile.targetWeight;
  const totalToLose = start > 0 && target > 0 ? start - target : 0;
  const lost = start > 0 && current > 0 ? start - current : 0;
  const remaining = current > 0 && target > 0 ? current - target : 0;
  const percent = totalToLose > 0 ? clamp((lost / totalToLose) * 100, 0, 100) : 0;
  return {
    start: round1(start), current: round1(current), target: round1(target),
    lost: round1(lost), remaining: round1(remaining), totalToLose: round1(totalToLose),
    percent: Math.round(percent),
    hasWeight: current > 0, hasTarget: target > 0,
    reached: current > 0 && target > 0 && current <= target,
  };
}

export function bmi(weight: number, height: number): number | null {
  if (weight <= 0 || height <= 0) return null;
  const meters = height / 100;
  return round1(weight / (meters * meters));
}

// 依衛福部國民健康署成人 BMI 分級。
export function bmiLabel(value: number): string {
  if (value < 18.5) return "體重過輕";
  if (value < 24) return "健康範圍";
  if (value < 27) return "體重過重";
  if (value < 30) return "輕度肥胖";
  if (value < 35) return "中度肥胖";
  return "重度肥胖";
}

/* ---------- 療程進度 ---------- */

export type ProgramProgress = {
  hasStart: boolean; hasLength: boolean;
  start: string; end: string;
  dayCount: number; weekCount: number;
  totalDays: number; totalWeeks: number;
  daysRemaining: number; weeksRemaining: number;
  percent: number;
};

export function programProgress(profile: ProfileData, today: string): ProgramProgress {
  const hasStart = parseDateKey(profile.programStart) !== null;
  const totalWeeks = Math.max(0, Math.round(profile.programWeeks));
  const totalDays = totalWeeks * 7;
  const elapsed = hasStart ? (diffDays(profile.programStart, today) ?? 0) + 1 : 0;
  const dayCount = Math.max(elapsed, 0);
  const daysRemaining = totalDays > 0 ? Math.max(totalDays - dayCount, 0) : 0;
  return {
    hasStart, hasLength: totalDays > 0,
    start: profile.programStart,
    end: hasStart && totalDays > 0 ? shiftDays(profile.programStart, totalDays - 1) : "",
    dayCount, weekCount: dayCount > 0 ? Math.ceil(dayCount / 7) : 0,
    totalDays, totalWeeks,
    daysRemaining, weeksRemaining: Math.ceil(daysRemaining / 7),
    percent: totalDays > 0 ? Math.round(clamp((dayCount / totalDays) * 100, 0, 100)) : 0,
  };
}

/* ---------- 下次施打 ---------- */

export type NextInjection = {
  at: string; dateKey: string; medicine: string; dose: string;
  daysAway: number | null; overdue: boolean; inferred: boolean;
};

export const INJECTION_INTERVAL_DAYS = 7;

export function nextInjection(entries: Entry[], today: string): NextInjection | null {
  const shots = entries.filter(e => e.category === "injection");
  if (!shots.length) return null;
  const planned = shots
    .filter(e => String(e.data.next || "").trim())
    .map(e => {
      const at = String(e.data.next);
      return {
        at, dateKey: at.slice(0, 10),
        medicine: String(e.data.medicine || "尚未填寫"),
        dose: formatDose(e.data.dose),
      };
    })
    .filter(x => parseDateKey(x.dateKey) !== null)
    .sort((a, b) => a.at.localeCompare(b.at));
  // 明確填的提醒優先（取還沒到的最近一次）。
  const upcoming = planned.find(x => x.dateKey >= today);
  if (upcoming) return { ...upcoming, daysAway: diffDays(today, upcoming.dateKey), overdue: false, inferred: false };
  // 沒填或都過期時，依「每 7 日施打一次」從最後一次施打推算。
  const last = [...shots].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt)).at(-1)!;
  const dateKey = shiftDays(last.recordedAt, INJECTION_INTERVAL_DAYS);
  if (!dateKey) return null;
  return {
    at: dateKey, dateKey,
    medicine: String(last.data.medicine || "尚未填寫"),
    dose: formatDose(last.data.dose),
    daysAway: diffDays(today, dateKey), overdue: dateKey < today, inferred: true,
  };
}

/* ---------- 劑量與部位 ---------- */

/** 舊資料的劑量是自由文字（例：「0.5 mg」），新資料是數字；統一抽出 mg 數值。 */
export function parseDoseMg(value: string | number | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const match = /([0-9]+(?:\.[0-9]+)?)/.exec(String(value ?? ""));
  return match ? Number(match[1]) : null;
}

/** 顯示用：抽得出數字就標 mg，抽不出就原樣顯示，不破壞舊紀錄。 */
export function formatDose(value: string | number | undefined): string {
  const mg = parseDoseMg(value);
  if (mg !== null) return `${mg} mg`;
  const raw = String(value ?? "").trim();
  return raw || "—";
}

/** 常見劑量快選，依表單填的藥品名稱切換。 */
export function dosePresets(medicine: string): number[] {
  const name = medicine.toLowerCase();
  if (name.includes("wegovy") || medicine.includes("週纖達")) return [0.25, 0.5, 1, 1.7, 2.4];
  if (name.includes("mounjaro") || medicine.includes("猛健樂")) return [2.5, 5, 7.5, 10, 12.5, 15];
  return [];
}

export const INJECTION_SITES = ["右下腹", "左下腹", "右大腿前側", "左大腿前側", "右上臂", "左上臂"] as const;

export type SiteRotation = { last: { site: string; date: string } | null; suggested: string };

/** 依固定順序輪替：讀最近一筆的部位，建議下一個；沒打過就從頭開始。 */
export function siteRotation(entries: Entry[]): SiteRotation {
  const last = entries
    .filter(e => e.category === "injection" && String(e.data.site || "").trim())
    .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt) || a.id - b.id)
    .at(-1);
  if (!last) return { last: null, suggested: INJECTION_SITES[0] };
  const site = String(last.data.site);
  const index = INJECTION_SITES.indexOf(site as typeof INJECTION_SITES[number]);
  return {
    last: { site, date: last.recordedAt },
    suggested: INJECTION_SITES[(index + 1) % INJECTION_SITES.length],
  };
}

/* ---------- 注射歷史 ---------- */

export type InjectionRow = {
  id: number; date: string; medicine: string; dose: string; site: string;
  /** 與上一針間隔天數；第一針為 null。 */
  gapDays: number | null;
};

export type InjectionStats = {
  total: number;
  /** 從最新一針往回數，間隔在 5–9 天內視為連續施打的週數。 */
  streakWeeks: number;
  topSite: string | null;
  rows: InjectionRow[];
};

export function injectionStats(entries: Entry[]): InjectionStats {
  const shots = entries
    .filter(e => e.category === "injection")
    .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt) || a.id - b.id);
  const rows: InjectionRow[] = shots.map((shot, index) => ({
    id: shot.id, date: shot.recordedAt,
    medicine: String(shot.data.medicine || "—"),
    dose: formatDose(shot.data.dose),
    site: String(shot.data.site || "—"),
    gapDays: index === 0 ? null : diffDays(shots[index - 1].recordedAt, shot.recordedAt),
  }));
  let streakWeeks = shots.length ? 1 : 0;
  for (let i = rows.length - 1; i > 0; i -= 1) {
    const gap = rows[i].gapDays;
    if (gap !== null && gap >= 5 && gap <= 9) streakWeeks += 1;
    else break;
  }
  const counts = new Map<string, number>();
  for (const row of rows) if (row.site !== "—") counts.set(row.site, (counts.get(row.site) ?? 0) + 1);
  const topSite = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  return { total: rows.length, streakWeeks, topSite, rows: [...rows].reverse() };
}

/* ---------- 趨勢 ---------- */

export type Trend = {
  days: number; change: number | null;
  points: WeightPoint[]; from: WeightPoint | null; to: WeightPoint | null;
};

export function trend(series: WeightPoint[], days: number, today: string): Trend {
  const since = shiftDays(today, -(days - 1));
  const inWindow = series.filter(p => p.date >= since);
  const to = series.at(-1) ?? null;
  // 期間內只有一筆時，用期間前最後一筆當基準，才看得出這幾天的變化。
  const before = series.filter(p => p.date < since).at(-1) ?? null;
  const from = inWindow.length > 1 ? inWindow[0] : (before ?? inWindow[0] ?? null);
  const changed = from && to && from !== to;
  const change = changed ? round1(to.weight - from.weight) : null;
  return { days, change, points: inWindow, from, to };
}

/* ---------- 同日合併 ---------- */

// 數值欄位相加；清單類欄位用「、」串接去重；其餘欄位新值覆蓋舊值。
const SUM_FIELDS: Record<string, readonly string[]> = {
  water: ["amount"],
  food: ["amount", "calories", "protein", "totalFat", "saturated", "carb", "sugar", "fiber", "sodium"],
  exercise: ["minutes", "calories"],
  expense: ["amount"],
};
const JOIN_FIELDS: Record<string, readonly string[]> = {
  food: ["food", "brand"],
  water: ["kind"],
  supplement: ["name", "dose", "notes"],
  exercise: ["activity"],
  expense: ["item", "qty", "notes"],
  symptoms: ["notes"],
};

/**
 * 同一天、同一類別的新紀錄併進既有紀錄，讓每個項目一天只有一筆。
 * externalId 一律串接保留：健康匯入靠它防重複，覆蓋掉會導致重複匯入。
 */
export function mergeDayData(category: string, oldData: Data, newData: Data): Data {
  const merged: Data = { ...oldData };
  const sums = new Set(SUM_FIELDS[category] ?? []);
  const joins = new Set(JOIN_FIELDS[category] ?? []);
  for (const [key, value] of Object.entries(newData)) {
    if (String(value).trim() === "") continue;
    if (sums.has(key)) {
      merged[key] = Math.round((num(merged[key]) + num(value)) * 10) / 10;
    } else if (joins.has(key) || key === "externalId") {
      // 兩邊都可能已是「、」串接過的清單，拆開逐一去重再併
      const parts = String(merged[key] ?? "").split("、").filter(Boolean);
      for (const incoming of String(value).split("、").filter(Boolean)) {
        if (!parts.includes(incoming)) parts.push(incoming);
      }
      merged[key] = parts.join("、");
    } else {
      merged[key] = value;
    }
  }
  // 運動的當日總消耗＝基礎代謝＋合計消耗，合併後重新算，不吃輸入的舊值。
  if (category === "exercise") {
    const bmr = num(merged.bmr), calories = num(merged.calories);
    if (bmr > 0 || calories > 0) merged.tdee = Math.round(bmr + calories);
  }
  return merged;
}

/* ---------- 今日任務 ---------- */

export type TaskState = "done" | "todo" | "off";
export type TodayTask = { key: string; label: string; href: string; state: TaskState; hint: string };

export function waterTotal(entries: Entry[], dateKey: string): number {
  return entries
    .filter(e => e.recordedAt === dateKey)
    .reduce((total, e) => {
      if (e.category === "water") return total + num(e.data.amount);
      // 舊資料的飲水量記在生理狀況表單裡，一併累加才不會漏掉。
      if (e.category === "symptoms") return total + num(e.data.water);
      return total;
    }, 0);
}

export function calorieTotals(entries: Entry[], dateKey: string) {
  const sum = (category: string) => entries
    .filter(e => e.category === category && e.recordedAt === dateKey)
    .reduce((total, e) => total + num(e.data.calories), 0);
  const intake = sum("food"), burn = sum("exercise");
  return { intake, burn, net: intake - burn };
}

export function todayTasks(entries: Entry[], today: string, injection: NextInjection | null): TodayTask[] {
  const has = (category: string) => entries.some(e => e.category === category && e.recordedAt === today);
  const water = waterTotal(entries, today);
  const injectedToday = has("injection");
  // 施打是每 7 天一次：只有到期（今天或已逾期）才算待辦，平常日子不出現提醒。
  const injectionDue = injection !== null && injection.dateKey <= today;
  const injectionHint = injectedToday ? "已記錄"
    : !injection ? "還沒有施打紀錄"
    : injection.dateKey === today ? "今天是施打日"
    : injection.dateKey < today ? `預定 ${formatDate(injection.dateKey)} 已過`
    : `下次 ${formatDate(injection.dateKey)}${injection.inferred ? "（推算）" : ""}`;
  return [
    { key: "body", label: "今日體重", href: "/body", state: has("body") ? "done" : "todo", hint: has("body") ? "已記錄" : "還沒量" },
    { key: "food", label: "今日飲食", href: "/food", state: has("food") ? "done" : "todo", hint: has("food") ? "已記錄" : "還沒記" },
    { key: "water", label: "今日飲水", href: "/water", state: water > 0 ? "done" : "todo", hint: water > 0 ? `${water} ml` : "還沒喝水紀錄" },
    { key: "exercise", label: "今日運動", href: "/exercise", state: has("exercise") ? "done" : "todo", hint: has("exercise") ? "已記錄" : "還沒記" },
    {
      key: "injection", label: "今日療程紀錄", href: "/injection",
      state: injectedToday ? "done" : injectionDue ? "todo" : "off",
      hint: injectionHint,
    },
  ];
}

export function taskSummary(tasks: TodayTask[]) {
  const active = tasks.filter(t => t.state !== "off");
  const done = active.filter(t => t.state === "done").length;
  return { done, total: active.length, allDone: active.length > 0 && done === active.length };
}

/* ---------- 營養素 ---------- */

export type NutritionTotals = {
  foods: number; withMacros: number;
  protein: number; totalFat: number; saturated: number;
  carb: number; sugar: number; fiber: number; sodium: number;
};

export function nutritionTotals(entries: Entry[], dateKey: string): NutritionTotals {
  const rows = entries.filter(e => e.category === "food" && e.recordedAt === dateKey);
  const sum = (key: string) => rows.reduce((total, e) => total + num(e.data[key]), 0);
  return {
    foods: rows.length,
    // 有些食品原始資料沒分析營養素，合計會偏低，畫面要能講清楚有幾筆有資料。
    withMacros: rows.filter(e => e.data.protein !== undefined && e.data.protein !== "").length,
    protein: round1(sum("protein")), totalFat: round1(sum("totalFat")), saturated: round1(sum("saturated")),
    carb: round1(sum("carb")), sugar: round1(sum("sugar")), fiber: round1(sum("fiber")),
    sodium: Math.round(sum("sodium")),
  };
}

/* ---------- 紀錄摘要 ---------- */

type FieldMeta = { label: string; unit?: string };

const FIELD_LABELS: Record<string, FieldMeta> = {
  weight: { label: "體重", unit: "kg" }, fat: { label: "體脂", unit: "%" },
  waist: { label: "腰圍", unit: "cm" }, chest: { label: "胸圍", unit: "cm" },
  muscle: { label: "肌肉量", unit: "kg" }, machine: { label: "機器" },
  food: { label: "食物" }, amount: { label: "份量", unit: "g" },
  name: { label: "品名" }, item: { label: "品項" }, qty: { label: "數量" },
  calories: { label: "熱量", unit: "kcal" }, brand: { label: "品牌" },
  protein: { label: "蛋白質", unit: "g" }, totalFat: { label: "脂肪", unit: "g" },
  saturated: { label: "飽和脂肪", unit: "g" }, carb: { label: "碳水", unit: "g" },
  sugar: { label: "糖", unit: "g" }, fiber: { label: "纖維", unit: "g" },
  sodium: { label: "鈉", unit: "mg" }, kind: { label: "種類" }, water: { label: "飲水", unit: "ml" },
  activity: { label: "項目" }, minutes: { label: "時間", unit: "分" },
  bmr: { label: "BMR", unit: "kcal" }, tdee: { label: "TDEE", unit: "kcal" },
  medicine: { label: "藥品" }, dose: { label: "劑量" }, site: { label: "部位" },
  next: { label: "下次" }, notes: { label: "備註" },
};

// amount 在飲食是公克、在飲水是毫升，同名不同意義的欄位在這裡分開。
const CATEGORY_LABELS: Record<string, Record<string, FieldMeta>> = {
  water: { amount: { label: "飲水量", unit: "ml" } },
  expense: { amount: { label: "金額", unit: "元" } },
};

/** 把一筆紀錄轉成「標籤 值 單位」的字串，取代原本只列出裸數字的做法。 */
const HIDDEN_FIELDS = new Set(["source", "externalId"]);

export function describeEntry(entry: Entry): string[] {
  return Object.entries(entry.data)
    .filter(([key, value]) => !HIDDEN_FIELDS.has(key) && String(value).trim() !== "")
    .map(([key, value]) => {
      const meta = CATEGORY_LABELS[entry.category]?.[key] ?? FIELD_LABELS[key];
      const text = key === "next" ? String(value).replace("T", " ")
        : key === "dose" && typeof value === "number" ? `${value} mg`
        : String(value);
      if (!meta) return text;
      return `${meta.label} ${text}${meta.unit ? ` ${meta.unit}` : ""}`;
    });
}

/* ---------- 里程碑 ---------- */

export type Milestone = { key: string; label: string; detail: string; done: boolean };

export function milestones(goal: GoalProgress): Milestone[] {
  if (!goal.hasWeight || goal.start <= 0) return [];
  const byRatio = [5, 10, 15].map(ratio => {
    const drop = round1(goal.start * ratio / 100);
    return {
      key: `ratio-${ratio}`,
      label: `減去起始體重 ${ratio}%`,
      detail: `${drop} kg（${round1(goal.start - drop)} kg）`,
      done: goal.lost >= drop,
    };
  });
  const byGoal = goal.totalToLose > 0
    ? [25, 50, 75, 100].map(step => ({
        key: `goal-${step}`,
        label: `目標完成 ${step}%`,
        detail: `${round1(goal.start - goal.totalToLose * step / 100)} kg`,
        done: goal.percent >= step,
      }))
    : [];
  return [...byGoal, ...byRatio];
}

/* ---------- 統計 ---------- */

export type DayTotals = {
  date: string; intake: number; burn: number; net: number;
  water: number; minutes: number; spend: number; weight: number | null; counts: Record<string, number>;
};

export function dayTotals(entries: Entry[], dateKey: string): DayTotals {
  const rows = entries.filter(e => e.recordedAt === dateKey);
  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.category] = (counts[row.category] ?? 0) + 1;
  const weights = rows.filter(e => e.category === "body").map(e => num(e.data.weight)).filter(w => w > 0);
  const { intake, burn, net } = calorieTotals(entries, dateKey);
  return {
    date: dateKey, intake, burn, net,
    water: waterTotal(entries, dateKey),
    minutes: rows.filter(e => e.category === "exercise").reduce((t, e) => t + num(e.data.minutes), 0),
    spend: rows.filter(e => e.category === "expense").reduce((t, e) => t + num(e.data.amount), 0),
    weight: weights.length ? round1(weights[weights.length - 1]) : null,
    counts,
  };
}

export type WeekStats = {
  start: string; end: string; label: string;
  avgWeight: number | null; change: number | null;
  intake: number; burn: number; water: number; minutes: number; spend: number; days: number;
};

export function weekStats(entries: Entry[], today: string, weeks: number): WeekStats[] {
  const out: WeekStats[] = [];
  for (let index = weeks - 1; index >= 0; index -= 1) {
    const end = shiftDays(today, -index * 7);
    const start = shiftDays(end, -6);
    const days: DayTotals[] = [];
    for (let step = 0; step < 7; step += 1) days.push(dayTotals(entries, shiftDays(start, step)));
    const logged = days.filter(d => d.weight !== null);
    const avgWeight = logged.length ? round1(logged.reduce((t, d) => t + (d.weight ?? 0), 0) / logged.length) : null;
    const change = logged.length > 1 ? round1((logged[logged.length - 1].weight ?? 0) - (logged[0].weight ?? 0)) : null;
    out.push({
      start, end, label: `${formatDate(start)}–${formatDate(end)}`,
      avgWeight, change,
      intake: days.reduce((t, d) => t + d.intake, 0),
      burn: days.reduce((t, d) => t + d.burn, 0),
      water: days.reduce((t, d) => t + d.water, 0),
      minutes: days.reduce((t, d) => t + d.minutes, 0),
      spend: days.reduce((t, d) => t + d.spend, 0),
      days: days.filter(d => Object.keys(d.counts).length > 0).length,
    });
  }
  return out;
}

export type SymptomStat = { name: string; count: number; average: number };

export function symptomStats(entries: Entry[]): SymptomStat[] {
  const bucket = new Map<string, number[]>();
  const push = (name: string, severity: number) => {
    if (!name || name === "無明顯不適") return;
    bucket.set(name, [...(bucket.get(name) ?? []), severity]);
  };
  for (const row of entries.filter(e => e.category === "symptoms")) {
    for (const [key, value] of Object.entries(row.data)) {
      // 目前的多選格式是 symptom_<名稱> / severity_<名稱>。
      if (key.startsWith("symptom_")) push(key.slice(8), num(row.data[`severity_${key.slice(8)}`]));
      // 舊的單選格式只有 symptoms / severity 兩個欄位。
      else if (key === "symptoms") push(String(value), num(row.data.severity));
    }
  }
  return [...bucket.entries()]
    .map(([name, values]) => ({
      name, count: values.length,
      average: round1(values.reduce((t, v) => t + v, 0) / values.length),
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/* ---------- 開銷 ---------- */

export type ExpenseStats = {
  total: number; thisMonth: number; weeklyAverage: number;
  /** 平均每減 1 公斤的花費；沒有減重數據時為 null。 */
  perKgLost: number | null;
};

export function expenseStats(entries: Entry[], today: string, kgLost: number): ExpenseStats {
  const rows = entries
    .filter(e => e.category === "expense" && parseDateKey(e.recordedAt) !== null)
    .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  const total = rows.reduce((t, e) => t + num(e.data.amount), 0);
  const thisMonth = rows
    .filter(e => e.recordedAt.slice(0, 7) === today.slice(0, 7))
    .reduce((t, e) => t + num(e.data.amount), 0);
  const spanDays = rows.length ? Math.max((diffDays(rows[0].recordedAt, today) ?? 0) + 1, 1) : 0;
  const weeklyAverage = spanDays ? Math.round(total / (spanDays / 7)) : 0;
  return {
    total, thisMonth, weeklyAverage,
    perKgLost: total > 0 && kgLost > 0 ? Math.round(total / kgLost) : null,
  };
}

/* ---------- 月曆 ---------- */

export function monthMatrix(year: number, month: number): string[][] {
  const first = new Date(year, month, 1);
  const lead = first.getDay();
  const total = new Date(year, month + 1, 0).getDate();
  const cells: string[][] = [];
  let week: string[] = Array.from({ length: lead }, () => "");
  for (let day = 1; day <= total; day += 1) {
    week.push(toDateKey(new Date(year, month, day)));
    if (week.length === 7) { cells.push(week); week = []; }
  }
  if (week.length) cells.push([...week, ...Array.from({ length: 7 - week.length }, () => "")]);
  return cells;
}
