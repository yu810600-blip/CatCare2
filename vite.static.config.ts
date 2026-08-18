/**
 * GitHub Pages 版的建置設定：把主站的 React 程式碼打包成純靜態 SPA，輸出到 docs/。
 *
 *   npm run build:pages
 *
 * 和主站的差別只有三處，其餘畫面與計算完全共用：
 *   next/link → static/link.tsx（hash 路由）
 *   /api/*    → static/local-api.ts（localStorage）
 *   登入      → 固定的本機使用者
 */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/postcss";
import { defineConfig } from "vite";

const from = (path: string) => fileURLToPath(new URL(path, import.meta.url));

/**
 * 主站的捷徑指向 /body 這種真實路徑，靜態版走 hash 路由，
 * 建置時改寫成 ./#/body，兩邊各自都是對的。
 */
function hashShortcuts() {
  return {
    name: "catcare-hash-shortcuts",
    async writeBundle() {
      const file = from("./docs/manifest.webmanifest");
      const manifest = JSON.parse(await readFile(file, "utf8"));
      for (const shortcut of manifest.shortcuts ?? []) shortcut.url = `./#${shortcut.url}`;
      await writeFile(file, `${JSON.stringify(manifest, null, 2)}\n`);
    },
  };
}

export default defineConfig({
  root: from("./static"),
  // 用相對路徑，換到別的 repo 名稱或自訂網域都不用重新設定。
  base: "./",
  publicDir: from("./public"),
  plugins: [react(), hashShortcuts()],
  css: { postcss: { plugins: [tailwind()] } },
  resolve: {
    alias: { "next/link": from("./static/link.tsx") },
  },
  build: {
    outDir: from("./docs"),
    emptyOutDir: true,
    assetsDir: "assets",
  },
});
