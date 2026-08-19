"use client";

/**
 * Companion Cat Animation System
 *
 * 陪伴小貓的角色名冊、狀態機與顯示元件。
 * 素材是 public/companion-cats/poses/<id>/<state>.png 的去背靜態圖，
 * 動畫用 CSS 做輕微浮動與換姿勢的過場，不干擾數據閱讀。
 *
 * 擴充方式：
 * - 加第六隻貓：素材放進 poses/<新id>/，在 COMPANIONS 加一筆即可。
 * - 加新動畫狀態：STATES 加名字、放對應圖片，決策邏輯想用再用。
 */
import { useEffect, useRef, useState } from "react";
import { asset } from "./asset";
import { goalProgress, milestones, type ProfileData, type WeightPoint } from "./health";

/** 目前已達成的里程碑數，用來偵測「這筆新紀錄讓里程碑往前了一格」。 */
export function milestonesDoneCount(series: WeightPoint[], profile: ProfileData): number {
  return milestones(goalProgress(series, profile)).filter(m => m.done).length;
}

export const STATES = ["idle", "walking", "exercise", "cheer", "success", "rest", "sleep"] as const;
export type CompanionState = typeof STATES[number];

export type Companion = { id: string; name: string; photo: string };

// photo 是原本站上就有的水彩照片，頭像與紀錄頁沿用；poses 由 id 對應。
export const COMPANIONS: Companion[] = [
  { id: "white", name: "白貓", photo: "/cat-white.jpg" },
  { id: "tabby", name: "虎斑貓", photo: "/cat-tabby.jpg" },
  { id: "orange", name: "橘貓", photo: "/cat-orange.jpg" },
  { id: "calico", name: "橘白貓", photo: "/cat-calico.jpg" },
  { id: "box-white", name: "紙箱白貓", photo: "/cat-box.jpg" },
];

export const DEFAULT_COMPANION = COMPANIONS[0];
export const companionById = (id: string): Companion =>
  COMPANIONS.find(c => c.id === id) ?? DEFAULT_COMPANION;
// 舊版把選擇存成照片路徑，沿用同一份 localStorage 資料轉回 id。
export const companionByPhoto = (photo: string): Companion =>
  COMPANIONS.find(c => c.photo === photo) ?? DEFAULT_COMPANION;

export function poseSrc(companion: Companion, state: CompanionState): string {
  return asset(`/companion-cats/poses/${companion.id}/${state}.png`);
}

/**
 * 依使用者目前的情況決定小貓的基礎狀態。
 * 優先序：短暫反應（外部觸發）＞ 頁面情境 ＞ 閒置 ＞ 今日完成度。
 */
export function baseState(options: { section: string; allDone: boolean; idleSeconds: number }): CompanionState {
  const { section, allDone, idleSeconds } = options;
  if (section === "exercise") return "exercise";
  if (idleSeconds >= 180) return "sleep";
  if (idleSeconds >= 90) return "rest";
  if (allDone) return "success";
  return "idle";
}

const REACTION_MS = 2600;
const STROLL_EVERY_MS = 26000;
const STROLL_MS = 4200;

/**
 * 陪伴狀態機：
 * - reaction：完成紀錄、達成里程碑時的短暫反應，蓋過基礎狀態幾秒後自動消退。
 * - 閒置偵測：一段時間沒有互動就休息／睡著，任何操作立刻醒來。
 * - 散步：idle 太久偶爾起來走幾步，讓角色有活著的感覺。
 */
export function useCompanion(section: string, allDone: boolean) {
  const [reaction, setReaction] = useState<CompanionState | null>(null);
  const [idleSeconds, setIdleSeconds] = useState(0);
  const [strolling, setStrolling] = useState(false);
  const reactionTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const wake = () => setIdleSeconds(0);
    const tick = setInterval(() => setIdleSeconds(s => s + 5), 5000);
    const events = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
    events.forEach(name => window.addEventListener(name, wake, { passive: true }));
    return () => { clearInterval(tick); events.forEach(name => window.removeEventListener(name, wake)); };
  }, []);

  const base = baseState({ section, allDone, idleSeconds });

  useEffect(() => {
    if (base !== "idle") return;
    let stop: ReturnType<typeof setTimeout> | undefined;
    const start = setInterval(() => {
      setStrolling(true);
      stop = setTimeout(() => setStrolling(false), STROLL_MS);
    }, STROLL_EVERY_MS);
    // 離開 idle 時散步一併結束，cleanup 收在計時器回呼而不是 effect 本體。
    return () => { clearInterval(start); if (stop) clearTimeout(stop); queueMicrotask(() => setStrolling(false)); };
  }, [base]);

  function react(state: CompanionState) {
    setReaction(state);
    setIdleSeconds(0);
    if (reactionTimer.current) clearTimeout(reactionTimer.current);
    reactionTimer.current = setTimeout(() => setReaction(null), REACTION_MS);
  }

  const state: CompanionState = reaction ?? (strolling ? "walking" : base);
  return { state, react };
}

/**
 * 顯示一隻陪伴小貓。透明背景、不被卡片框住。
 * 換姿勢時做一個很短的替換過場；平時只有極輕的呼吸浮動。
 */
export function CompanionCat({ companion, state, size = 128, className = "" }:
  { companion: Companion; state: CompanionState; size?: number; className?: string }) {
  return (
    <span className={`companion companion-${state} ${className}`} style={{ height: size }} aria-hidden="true">
      {/* 七張姿勢全部掛在 DOM 上以 opacity 切換（不能 lazy：隱藏的姿勢永遠不會進 viewport） */}
      {STATES.map(pose => (
        <img key={pose} src={poseSrc(companion, pose)} alt="" draggable={false}
          className={pose === state ? "pose on" : "pose"} style={{ height: size }} />
      ))}
    </span>
  );
}
