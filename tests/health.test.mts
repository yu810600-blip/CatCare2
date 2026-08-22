/**
 * health.ts 純函式的單元測試。
 * 跑法：npm run test:unit（node --experimental-strip-types，不需要建置）
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  dosePresets, EMPTY_PROFILE, injectionStats, INJECTION_SITES, isFieldVisible, isRecordVisible,
  mergeDayData, nextInjection, normalizeHidden, parseDoseMg, siteRotation, todayTasks, toggleField,
  toggleRecord, visibleRecords, withHiddenDefaults, type Entry,
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

test("mergeDayData 飲水量相加、種類串接去重", () => {
  const merged = mergeDayData("water", { amount: 500, kind: "白開水" }, { amount: 250, kind: "無糖茶" });
  assert.deepEqual(merged, { amount: 750, kind: "白開水、無糖茶" });
  const again = mergeDayData("water", merged, { amount: 250, kind: "白開水" });
  assert.equal(again.amount, 1000);
  assert.equal(again.kind, "白開水、無糖茶");
});

test("mergeDayData 飲食熱量與營養素相加、品名串接", () => {
  const merged = mergeDayData("food",
    { food: "地瓜", amount: 200, calories: 230, carb: 55 },
    { food: "舒肥雞胸", amount: 150, calories: 248, protein: 34 });
  assert.equal(merged.food, "地瓜、舒肥雞胸");
  assert.equal(merged.calories, 478);
  assert.equal(merged.carb, 55);
  assert.equal(merged.protein, 34);
});

test("mergeDayData 身體數值後值覆蓋、空值不覆蓋", () => {
  const merged = mergeDayData("body", { weight: 62.9, fat: 32.4 }, { weight: 62.8, fat: "" });
  assert.deepEqual(merged, { weight: 62.8, fat: 32.4 });
});

test("mergeDayData 運動合併後 TDEE 重新加總", () => {
  const merged = mergeDayData("exercise",
    { activity: "快走", minutes: 40, calories: 180, bmr: 1320, tdee: 1500 },
    { activity: "重訓", minutes: 30, calories: 120 });
  assert.equal(merged.activity, "快走、重訓");
  assert.equal(merged.minutes, 70);
  assert.equal(merged.calories, 300);
  assert.equal(merged.tdee, 1620); // 1320 + 300
});

test("mergeDayData 併入已串接過的清單時逐一去重", () => {
  const merged = mergeDayData("water", { amount: 500, kind: "白開水" }, { amount: 750, kind: "無糖茶、白開水" });
  assert.equal(merged.kind, "白開水、無糖茶");
  assert.equal(merged.amount, 1250);
});

test("mergeDayData externalId 串接保留，避免健康匯入重複", () => {
  const merged = mergeDayData("exercise",
    { activity: "跑步", calories: 200, externalId: "hk-workout-1" },
    { activity: "游泳", calories: 150, externalId: "hk-workout-2" });
  assert.equal(merged.externalId, "hk-workout-1、hk-workout-2");
});

/* ---------- 自訂紀錄項目 ---------- */

test("normalizeHidden 舊資料沒有欄位時視為空", () => {
  assert.deepEqual(normalizeHidden(undefined), { hiddenRecords: [], hiddenFields: {} });
  assert.deepEqual(normalizeHidden({}), { hiddenRecords: [], hiddenFields: {} });
  assert.deepEqual(normalizeHidden({ hiddenRecords: null, hiddenFields: "x" }), { hiddenRecords: [], hiddenFields: {} });
});

test("normalizeHidden 丟掉未知類別、未知欄位與鎖定欄位，並去重", () => {
  const out = normalizeHidden({
    hiddenRecords: ["water", "nope", "water", 3],
    hiddenFields: { body: ["weight", "fat", "fat", "ghost"], bogus: ["x"], water: [] },
  });
  assert.deepEqual(out, { hiddenRecords: ["water"], hiddenFields: { body: ["fat"] } });
});

test("withHiddenDefaults 合併舊資料時其餘欄位原樣保留", () => {
  const legacy = { displayName: "貓貓", targetWeight: 55 } as Partial<typeof EMPTY_PROFILE>;
  const merged = withHiddenDefaults({ ...EMPTY_PROFILE, ...legacy });
  assert.equal(merged.displayName, "貓貓");
  assert.equal(merged.targetWeight, 55);
  assert.deepEqual(merged.hiddenRecords, []);
  assert.deepEqual(merged.hiddenFields, {});
});

test("isFieldVisible：recordedAt 與 body.weight 鎖定，永遠可見", () => {
  const profile = { ...EMPTY_PROFILE, hiddenFields: { body: ["fat"] } };
  assert.equal(isFieldVisible(profile, "body", "weight"), true);
  assert.equal(isFieldVisible(profile, "body", "recordedAt"), true);
  assert.equal(isFieldVisible(profile, "body", "fat"), false);
  assert.equal(isFieldVisible(profile, "body", "waist"), true);
});

test("toggleRecord 關閉與重新開啟，不會重複累積", () => {
  let profile = toggleRecord(EMPTY_PROFILE, "water", false);
  profile = toggleRecord(profile, "water", false);
  assert.deepEqual(profile.hiddenRecords, ["water"]);
  assert.equal(isRecordVisible(profile, "water"), false);
  assert.deepEqual(visibleRecords(profile).includes("water"), false);
  profile = toggleRecord(profile, "water", true);
  assert.deepEqual(profile.hiddenRecords, []);
  assert.deepEqual(toggleRecord(EMPTY_PROFILE, "unknown", false).hiddenRecords, []);
});

test("toggleField 鎖定欄位無法隱藏；全部勾回來時清掉該類別", () => {
  const locked = toggleField(EMPTY_PROFILE, "body", "weight", false);
  assert.deepEqual(locked.hiddenFields, {});
  let profile = toggleField(EMPTY_PROFILE, "exercise", "bmr", false);
  profile = toggleField(profile, "exercise", "tdee", false);
  assert.deepEqual(profile.hiddenFields, { exercise: ["bmr", "tdee"] });
  profile = toggleField(profile, "exercise", "bmr", true);
  profile = toggleField(profile, "exercise", "tdee", true);
  assert.deepEqual(profile.hiddenFields, {});
});

test("todayTasks 隱藏的類別不列入今日任務", () => {
  const tasks = todayTasks([], "2026-08-22", null, ["water", "exercise"]);
  assert.deepEqual(tasks.map(t => t.key), ["body", "food", "injection"]);
  assert.equal(todayTasks([], "2026-08-22", null).length, 5);
});
