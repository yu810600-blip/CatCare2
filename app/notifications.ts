"use client";

/**
 * 注射提醒本機通知（僅 iOS App 生效）。
 *
 * 依 health.ts 算出的下次施打日（明確填的提醒優先，否則上次施打＋7 天推算），
 * 排兩則本地通知：前一天晚上 8 點、當天早上 9 點。
 * 網頁版偵測到非 Capacitor 原生環境就整段跳過，不報錯也不要求權限。
 */
import { nextInjection, parseDateKey, todayKey, type Entry } from "./health";

// 固定 id：每次重排先取消同 id 的舊通知，不會越排越多。
const REMINDER_IDS = [710001, 710002];

export async function syncInjectionReminders(entries: Entry[]): Promise<void> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) return;
    const { LocalNotifications } = await import("@capacitor/local-notifications");

    const next = nextInjection(entries, todayKey());
    const date = next && !next.overdue ? parseDateKey(next.dateKey) : null;

    // 授權狀態還沒問過（prompt）時，除非真的有提醒要排，否則完全不接觸
    // 通知中心——這個 iOS 版本上連 getPending 都會讓系統補跳授權彈窗。
    const status = (await LocalNotifications.checkPermissions()).display;
    if (status === "prompt" && (!next || !date)) return;
    if (status === "denied") return;

    let granted = status === "granted";
    if (!granted && next && date) granted = (await LocalNotifications.requestPermissions()).display === "granted";
    if (!granted) return;

    // 重排前一律清掉舊的排程，避免日期改動後留下重複提醒。
    const pending = await LocalNotifications.getPending();
    const stale = pending.notifications.filter(item => REMINDER_IDS.includes(item.id));
    if (stale.length) await LocalNotifications.cancel({ notifications: stale.map(item => ({ id: item.id })) });

    if (!next || !date) return;

    const evening = new Date(date);
    evening.setDate(evening.getDate() - 1);
    evening.setHours(20, 0, 0, 0);
    const morning = new Date(date);
    morning.setHours(9, 0, 0, 0);

    const doseText = next.dose && next.dose !== "—" ? `（${next.medicine} ${next.dose}）` : "";
    const now = Date.now();
    const slots = [
      { id: REMINDER_IDS[0], at: evening, title: "明天是施打日", body: `記得準備好藥品${doseText}，明天照計畫施打。` },
      { id: REMINDER_IDS[1], at: morning, title: "今天是施打日", body: `打完記得回貓貓輕生活記一筆${doseText}。` },
    ].filter(slot => slot.at.getTime() > now);
    if (!slots.length) return;

    await LocalNotifications.schedule({
      notifications: slots.map(slot => ({
        id: slot.id, title: slot.title, body: slot.body,
        schedule: { at: slot.at },
      })),
    });
  } catch {
    // 通知排程失敗不影響任何紀錄功能。
  }
}
