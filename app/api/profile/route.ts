import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { profiles } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "請先登入" }, { status: 401 });
  const [profile] = await getDb().select().from(profiles).where(eq(profiles.userId, user.userId)).limit(1);
  return Response.json({ profile: profile ?? { userId: user.userId, email: user.email, displayName: user.fullName ?? "", birthday: "", sex: "", height: 0, targetWeight: 0, calorieGoal: 0, startWeight: 0, programStart: "", programWeeks: 0 } });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "請先登入" }, { status: 401 });
  const payload = await request.json() as Record<string, string | number>;
  const values = {
    userId: user.userId, email: user.email,
    displayName: String(payload.displayName ?? "").slice(0, 60),
    birthday: String(payload.birthday ?? "").slice(0, 10),
    sex: String(payload.sex ?? "").slice(0, 20),
    height: Math.max(0, Number(payload.height) || 0),
    targetWeight: Math.max(0, Number(payload.targetWeight) || 0),
    calorieGoal: Math.max(0, Number(payload.calorieGoal) || 0),
    startWeight: Math.max(0, Number(payload.startWeight) || 0),
    programStart: String(payload.programStart ?? "").slice(0, 10),
    programWeeks: Math.max(0, Number(payload.programWeeks) || 0),
    updatedAt: new Date().toISOString(),
  };
  const [profile] = await getDb().insert(profiles).values(values).onConflictDoUpdate({ target: profiles.userId, set: values }).returning();
  return Response.json({ profile });
}
