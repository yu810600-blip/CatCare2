/**
 * 食藥署食品營養成分資料的讀取、搜尋與份量換算。
 * 資料由 scripts/build-food-db.mjs 產生，放在 public/food-nutrition.json，
 * 只有進到飲食頁時才會載入，不會拖累其他頁面。
 */

export type FoodDb = {
  source: string; sourceUrl: string; licence: string; updated: string; note: string;
  fields: string[]; foods: (string | number | null)[][];
};

export type FoodRow = {
  name: string; alias: string; category: string;
  kcal: number | null; protein: number | null; fat: number | null;
  saturated: number | null; trans: number | null; carb: number | null;
  sugar: number | null; fiber: number | null; sodium: number | null;
};

// 存進紀錄時的欄位名。體脂率也叫 fat，所以食物的脂肪改用 totalFat 避免混在一起。
export const NUTRIENT_KEYS = ["protein", "totalFat", "saturated", "carb", "sugar", "fiber", "sodium"] as const;
export type NutrientKey = typeof NUTRIENT_KEYS[number];

export const NUTRIENT_LABELS: Record<NutrientKey, { label: string; unit: string }> = {
  protein: { label: "蛋白質", unit: "g" },
  totalFat: { label: "脂肪", unit: "g" },
  saturated: { label: "飽和脂肪", unit: "g" },
  carb: { label: "碳水化合物", unit: "g" },
  sugar: { label: "糖", unit: "g" },
  fiber: { label: "膳食纖維", unit: "g" },
  sodium: { label: "鈉", unit: "mg" },
};

export function toRow(row: (string | number | null)[]): FoodRow {
  const [name, alias, category, kcal, protein, fat, saturated, trans, carb, sugar, fiber, sodium] = row;
  return {
    name: String(name ?? ""), alias: String(alias ?? ""), category: String(category ?? ""),
    kcal: kcal as number | null, protein: protein as number | null, fat: fat as number | null,
    saturated: saturated as number | null, trans: trans as number | null, carb: carb as number | null,
    sugar: sugar as number | null, fiber: fiber as number | null, sodium: sodium as number | null,
  };
}

/** 官方名稱常和口語差很多（香蕉→北蕉、地瓜→甘藷），所以俗名也要一起搜。 */
export function searchFoods(db: FoodDb | null, query: string, limit = 12): FoodRow[] {
  const keyword = query.trim();
  if (!db || !keyword) return [];
  const exact: FoodRow[] = [], partial: FoodRow[] = [];
  for (const raw of db.foods) {
    const name = String(raw[0] ?? ""), alias = String(raw[1] ?? "");
    if (name.startsWith(keyword)) exact.push(toRow(raw));
    else if (name.includes(keyword) || alias.includes(keyword)) partial.push(toRow(raw));
    if (exact.length >= limit) break;
  }
  return [...exact, ...partial].slice(0, limit);
}

const round = (value: number) => Math.round(value * 10) / 10;

/** 資料庫是每 100 克的含量，依實際份量換算；原始資料沒分析的項目維持 null。 */
export function scaleFood(row: FoodRow, grams: number): { kcal: number | null } & Record<NutrientKey, number | null> {
  const factor = grams > 0 ? grams / 100 : 0;
  const at = (value: number | null) => (value == null ? null : round(value * factor));
  return {
    kcal: row.kcal == null ? null : Math.round(row.kcal * factor),
    protein: at(row.protein), totalFat: at(row.fat), saturated: at(row.saturated),
    carb: at(row.carb), sugar: at(row.sugar), fiber: at(row.fiber), sodium: at(row.sodium),
  };
}
