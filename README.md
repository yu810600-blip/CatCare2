# CatCare2 貓貓輕生活

以貓咪與馬卡龍視覺設計的瘦瘦針健康追蹤網站，用於紀錄身體數值、每日生理狀況、飲食熱量、運動消耗與施打提醒。

## 主要功能

- 體重、體脂、腰圍、胸圍、肌肉量與測量機器紀錄
- 體重變化趨勢圖
- 多選與自訂每日生理狀況，各自記錄 0–10 嚴重程度
- 首頁健康總覽：距離目標進度環、療程天數與週數、今日任務、7／30 天體重趨勢
- 飲食紀錄接衛福部食藥署食品營養成分資料庫，依份量換算熱量與蛋白質、脂肪、碳水、糖、纖維、鈉
- 獨立的飲水紀錄與一鍵補記
- 月曆檢視與當日完整紀錄，任一筆都可刪除
- 統計與里程碑：每週平均體重與熱量、生理狀況次數、減重里程碑
- 施打藥品、劑量、部位與下次提醒
- 運動、消耗熱量、BMR 與 TDEE
- Cloudflare D1 持久化資料庫
- 可安裝為 PWA，響應式桌面與行動裝置介面

## 本機開發

需要 Node.js 22.13 或以上版本。

```bash
npm install
npm run dev
```

建置生產版本：

```bash
npm run build
```

## 更新食品營養資料

`public/food-nutrition.json` 由衛生福利部食品藥物管理署的「食品營養成分資料集」轉換而來，
採政府資料開放授權條款第 1 版。原始資料不定期更新，要換新版時：

```bash
curl -L "https://data.fda.gov.tw/opendata/exportDataList.do?method=ExportData&InfoId=20&logType=1" -o tfnd.zip
unzip tfnd.zip
node scripts/build-food-db.mjs 20_1.xml
```

## 資料庫遷移

改動 `db/schema.ts` 後用 `npm run db:generate` 產生 migration，部署時再套用到 D1。

## 醫療聲明

本專案僅供個人健康資料紀錄，不提供診斷、處方或劑量調整建議，也不取代專業醫療照護。
