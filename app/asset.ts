/**
 * 靜態版部署在 GitHub Pages 的 /CatCare2/ 底下，主站部署在網域根目錄，
 * 兩邊的 /cat-white.jpg 不會指到同一個地方。
 *
 * 靜態版的 index.html 會先設定 window.__CATCARE_BASE__，主站不設定就是空字串，
 * 路徑維持原樣，伺服器端算出來也一樣，不會有 hydration 落差。
 */
declare global {
  interface Window { __CATCARE_BASE__?: string }
}

export function asset(path: string): string {
  if (typeof window === "undefined") return path;
  return `${window.__CATCARE_BASE__ ?? ""}${path}`;
}
