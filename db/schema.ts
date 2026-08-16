import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const entries = sqliteTable("entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull(),
  category: text("category").notNull(),
  recordedAt: text("recorded_at").notNull(),
  data: text("data", { mode: "json" }).$type<Record<string, string | number>>().notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("idx_entries_user_date").on(table.userId, table.recordedAt)]);

export const profiles = sqliteTable("profiles", {
  userId: text("user_id").primaryKey(),
  email: text("email").notNull(),
  displayName: text("display_name").notNull().default(""),
  birthday: text("birthday").notNull().default(""),
  sex: text("sex").notNull().default(""),
  height: real("height").notNull().default(0),
  targetWeight: real("target_weight").notNull().default(0),
  calorieGoal: integer("calorie_goal").notNull().default(0),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
