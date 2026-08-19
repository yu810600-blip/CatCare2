# Companion Cat 素材包

沿用 CatCare2 的五隻既有貓咪，製作成透明背景的 Dashboard 小型陪伴角色。

## 內容

- `poses/`：每隻貓各 7 張獨立透明 PNG，共 35 張。
- `sheets/`：每隻貓一張完整 4×2 動作圖集，共 5 張；右下格留空。
- `manifest.json`：角色與狀態的可擴充對應資料。

狀態順序：`idle`、`walking`、`exercise`、`cheer`、`success`、`rest`、`sleep`。

## 建議使用

依 `selectedCompanionCat` 找到 `manifest.json` 中相同的 `id`，再依目前動畫狀態載入 `poses/<cat-id>/<state>.png`。單張 PNG 可用 CSS 做輕微上下浮動、呼吸、位移或縮放，避免干擾 Dashboard 閱讀。

這批素材是由既有角色圖片透過內建圖像生成與背景後處理製作；沒有重新命名角色，也保留各角色的主要外觀、配色與辨識配件。
