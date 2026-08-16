import CatCareApp from "../CatCareApp";
import { requireChatGPTUser } from "../chatgpt-auth";

export const dynamic = "force-dynamic";

export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const user = await requireChatGPTUser(`/${section}`);
  return <CatCareApp section={section} user={user} />;
}
