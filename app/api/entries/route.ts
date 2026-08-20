import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { entries } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

const allowed = new Set(["body", "symptoms", "food", "injection", "exercise", "water", "supplement", "expense"]);

export async function GET() {
  try {
    const user = await getChatGPTUser();
    if (!user) return Response.json({ error: "請先登入" }, { status: 401 });
    const rows = await getDb().select().from(entries).where(eq(entries.userId, user.userId)).orderBy(desc(entries.recordedAt), desc(entries.id)).limit(500);
    return Response.json({ entries: rows });
  } catch {
    return Response.json({ entries: [] });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getChatGPTUser();
    if (!user) return Response.json({ error: "請先登入" }, { status: 401 });
    const payload = await request.json() as { category?: string; recordedAt?: string; data?: Record<string, string | number> };
    if (!payload.category || !allowed.has(payload.category) || !payload.recordedAt || !payload.data) {
      return Response.json({ error: "資料不完整" }, { status: 400 });
    }
    const [entry] = await getDb().insert(entries).values({ userId: user.userId, category: payload.category, recordedAt: payload.recordedAt, data: payload.data }).returning();
    return Response.json({ entry }, { status: 201 });
  } catch {
    return Response.json({ error: "暫時無法儲存" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getChatGPTUser();
    if (!user) return Response.json({ error: "請先登入" }, { status: 401 });
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!Number.isInteger(id) || id <= 0) return Response.json({ error: "缺少紀錄編號" }, { status: 400 });
    const payload = await request.json() as { data?: Record<string, string | number> };
    if (!payload.data || typeof payload.data !== "object") return Response.json({ error: "資料不完整" }, { status: 400 });
    // 同樣要比對 userId，避免更新到別人的紀錄
    const [entry] = await getDb().update(entries).set({ data: payload.data }).where(and(eq(entries.id, id), eq(entries.userId, user.userId))).returning();
    if (!entry) return Response.json({ error: "找不到這筆紀錄" }, { status: 404 });
    return Response.json({ entry });
  } catch {
    return Response.json({ error: "暫時無法更新" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getChatGPTUser();
    if (!user) return Response.json({ error: "請先登入" }, { status: 401 });
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!Number.isInteger(id) || id <= 0) return Response.json({ error: "缺少紀錄編號" }, { status: 400 });
    // 一定要同時比對 userId，否則帶別人的 id 就能刪到別人的紀錄。
    const [removed] = await getDb().delete(entries).where(and(eq(entries.id, id), eq(entries.userId, user.userId))).returning();
    if (!removed) return Response.json({ error: "找不到這筆紀錄" }, { status: 404 });
    return Response.json({ id: removed.id });
  } catch {
    return Response.json({ error: "暫時無法刪除" }, { status: 500 });
  }
}
