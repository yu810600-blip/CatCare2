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
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/postcss";
import { defineConfig } from "vite";

const from = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  root: from("./static"),
  // 用相對路徑，換到別的 repo 名稱或自訂網域都不用重新設定。
  base: "./",
  publicDir: from("./public"),
  plugins: [react()],
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
