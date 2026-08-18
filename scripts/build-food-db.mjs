/**
 * 把衛生福利部食品藥物管理署的「食品營養成分資料集」轉成網站用的精簡 JSON。
 *
 * 原始資料一筆食品會拆成上百列（每列一個分析項），整包 XML 超過 200MB，
 * 這裡只留營養標示會用到的欄位，並轉成陣列格式壓縮體積。
 *
 * 取得原始資料：
 *   curl -L "https://data.fda.gov.tw/opendata/exportDataList.do?method=ExportData&InfoId=20&logType=1" -o tfnd.zip
 *   unzip tfnd.zip        # 會得到 20_1.xml
 *
 * 執行：
 *   node scripts/build-food-db.mjs 20_1.xml
 *
 * 輸出：public/food-nutrition.json
 */
import { createReadStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = resolve(ROOT, "public/food-nutrition.json");
const SOURCE_URL = "https://data.gov.tw/dataset/8543";

// 分析項名稱 → 輸出欄位。只取營養標示與 GLP-1 療程期間會關心的項目。
const NUTRIENTS = new Map([
  ["熱量", "kcal"],
  ["粗蛋白", "protein"],
  ["粗脂肪", "fat"],
  ["飽和脂肪", "saturated"],
  ["反式脂肪", "trans"],
  ["總碳水化合物", "carb"],
  ["糖質總量", "sugar"],
  ["膳食纖維", "fiber"],
  ["鈉", "sodium"],
]);
const FIELDS = ["name", "alias", "category", ...NUTRIENTS.values()];

function cdata(row, tag) {
  const match = row.match(new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`));
  return match ? match[1].trim() : "";
}

function amount(text) {
  if (!text) return null;
  const value = Number(text.replace(/,/g, ""));
  // 原始資料沒分析的項目是空字串，要保留 null，不能當成 0。
  return Number.isFinite(value) ? value : null;
}

async function main() {
  const input = process.argv[2];
  if (!input) {
    console.error("用法：node scripts/build-food-db.mjs <20_1.xml 的路徑>");
    process.exit(1);
  }

  const foods = new Map();
  let updated = "";
  let carry = "";
  let rowCount = 0;

  const stream = createReadStream(resolve(input), { encoding: "utf8", highWaterMark: 1 << 20 });
  for await (const chunk of stream) {
    carry += chunk;
    if (!updated) {
      const stamp = carry.match(/最後更新日期="([^"]+)"/);
      if (stamp) updated = stamp[1];
    }
    let cut;
    while ((cut = carry.indexOf("</rows>")) !== -1) {
      const start = carry.indexOf("<rows>");
      if (start === -1 || start > cut) { carry = carry.slice(cut + 7); continue; }
      const row = carry.slice(start + 6, cut);
      carry = carry.slice(cut + 7);
      rowCount += 1;

      const field = NUTRIENTS.get(cdata(row, "分析項"));
      if (!field) continue;
      const id = cdata(row, "整合編號");
      if (!id) continue;

      let food = foods.get(id);
      if (!food) {
        food = { name: cdata(row, "樣品名稱"), alias: cdata(row, "俗名"), category: cdata(row, "食品分類") };
        foods.set(id, food);
      }
      if (food[field] == null) food[field] = amount(cdata(row, "每100克含量"));
    }
    // 保留可能被切斷的半筆資料，等下一個 chunk 接上。
    if (carry.length > 1 << 22) carry = carry.slice(-(1 << 20));
  }

  const rows = [...foods.values()]
    .filter(food => food.name && food.kcal != null)
    .sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"))
    .map(food => FIELDS.map(field => food[field] ?? null));

  const payload = {
    source: "衛生福利部食品藥物管理署 食品營養成分資料集",
    sourceUrl: SOURCE_URL,
    licence: "政府資料開放授權條款－第1版",
    updated,
    note: "數值為每 100 克可食部含量，熱量單位 kcal、鈉單位 mg、其餘單位公克。null 代表原始資料未提供該項分析。",
    fields: FIELDS,
    foods: rows,
  };

  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, JSON.stringify(payload));
  console.log(`讀取 ${rowCount} 列，輸出 ${rows.length} 筆食品（原始資料更新日 ${updated || "未標示"}）`);
  console.log(`已寫入 ${OUTPUT}`);
}

main();
