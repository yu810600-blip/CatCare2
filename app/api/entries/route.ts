import { desc } from "drizzle-orm";
import { getDb } from "../../../db";
import { entries } from "../../../db/schema";

const allowed = new Set(["body", "symptoms", "food", "injection", "exercise"]);

export async function GET() {
  try {
    const rows = await getDb().select().from(entries).orderBy(desc(entries.recordedAt), desc(entries.id)).limit(500);
    return Response.json({ entries: rows });
  } catch {
    return Response.json({ entries: [] });
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { category?: string; recordedAt?: string; data?: Record<string, string | number> };
    if (!payload.category || !allowed.has(payload.category) || !payload.recordedAt || !payload.data) {
      return Response.json({ error: "資料不完整" }, { status: 400 });
    }
    const [entry] = await getDb().insert(entries).values({ category: payload.category, recordedAt: payload.recordedAt, data: payload.data }).returning();
    return Response.json({ entry }, { status: 201 });
  } catch {
    return Response.json({ error: "暫時無法儲存" }, { status: 500 });
  }
}
