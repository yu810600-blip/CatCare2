/**
 * health.ts 純函式的單元測試。
 * 跑法：npm run test:unit（node --experimental-strip-types，不需要建置）
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  dosePresets, injectionStats, INJECTION_SITES, nextInjection,
  parseDoseMg, siteRotation, type Entry,
} from "../app/health.ts";

let id = 0;
const shot = (recordedAt: string, data: Record<string, string | number>): Entry =>
  ({ id: ++id, category: "injection", recordedAt, data });

test("parseDoseMg 抽得出新舊兩種劑量格式", () => {
  assert.equal(parseDoseMg(0.5), 0.5);
  assert.equal(parseDoseMg("0.5 mg"), 0.5);
  assert.equal(parseDoseMg("依醫囑"), null);
  assert.equal(parseDoseMg(undefined), null);
});

test("dosePresets 依藥品切換快選", () => {
  assert.deepEqual(dosePresets("週纖達 Wegovy"), [0.25, 0.5, 1, 1.7, 2.4]);
  assert.deepEqual(dosePresets("猛健樂 Mounjaro"), [2.5, 5, 7.5, 10, 12.5, 15]);
  assert.deepEqual(dosePresets("其他藥品"), []);
});

test("siteRotation 沒打過從頭開始", () => {
  assert.deepEqual(siteRotation([]), { last: null, suggested: "右下腹" });
});

test("siteRotation 依序輪替並在最後一個之後回到開頭", () => {
  const r1 = siteRotation([shot("2026-08-01", { site: "右下腹" })]);
  assert.equal(r1.suggested, "左下腹");
  assert.deepEqual(r1.last, { site: "右下腹", date: "2026-08-01" });
  const r2 = siteRotation([shot("2026-08-01", { site: INJECTION_SITES[INJECTION_SITES.length - 1] })]);
  assert.equal(r2.suggested, "右下腹");
});

test("siteRotation 只看最近一筆", () => {
  const r = siteRotation([
    shot("2026-08-01", { site: "右上臂" }),
    shot("2026-08-08", { site: "左大腿前側" }),
  ]);
  assert.equal(r.last?.site, "左大腿前側");
  assert.equal(r.suggested, "右上臂");
});

test("siteRotation 遇到清單外的部位仍給建議", () => {
  const r = siteRotation([shot("2026-08-01", { site: "手背" })]);
  assert.equal(r.suggested, INJECTION_SITES[0]);
});

test("injectionStats 計算間隔、連續週數與最常用部位", () => {
  const stats = injectionStats([
    shot("2026-07-01", { site: "右下腹", medicine: "Wegovy", dose: "0.25 mg" }),
    shot("2026-07-20", { site: "左下腹", medicine: "Wegovy", dose: 0.25 }),   // 斷週（19 天）
    shot("2026-07-27", { site: "右下腹", medicine: "Wegovy", dose: 0.5 }),
    shot("2026-08-03", { site: "左下腹", medicine: "Wegovy", dose: 0.5 }),
  ]);
  assert.equal(stats.total, 4);
  assert.equal(stats.streakWeeks, 3);            // 8/3←7天←7/27←7天←7/20，再往前 19 天斷掉
  assert.equal(stats.rows[0].date, "2026-08-03"); // 最新在上
  assert.equal(stats.rows[0].gapDays, 7);
  assert.equal(stats.rows.at(-1)!.gapDays, null); // 第一針
  assert.equal(stats.rows[1].dose, "0.5 mg");
  assert.ok(["右下腹", "左下腹"].includes(stats.topSite!));
});

test("nextInjection 沒填提醒時依上次施打推算 7 天", () => {
  const next = nextInjection([shot("2026-08-10", { medicine: "Wegovy", dose: 0.5 })], "2026-08-12");
  assert.equal(next?.dateKey, "2026-08-17");
  assert.equal(next?.inferred, true);
  assert.equal(next?.overdue, false);
});

test("nextInjection 明確填的提醒優先於推算", () => {
  const next = nextInjection([shot("2026-08-10", { dose: 0.5, next: "2026-08-18T21:00" })], "2026-08-12");
  assert.equal(next?.dateKey, "2026-08-18");
  assert.equal(next?.inferred, false);
});
