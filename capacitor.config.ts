import type { CapacitorConfig } from "@capacitor/cli";

/**
 * iOS app 直接包 docs/ 的靜態建置產物——和 GitHub Pages 版是同一份輸出，
 * 資料層一樣走 localStorage（存在 app 自己的容器裡，不受 Safari 清除影響）。
 * 改動網頁後先跑 `npm run build:pages`，再 `npx cap sync ios`。
 */
const config: CapacitorConfig = {
  appId: "com.friday.catcare2",
  appName: "貓貓輕生活",
  webDir: "docs",
  ios: {
    contentInset: "never",
  },
};

export default config;
