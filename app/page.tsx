import CatCareApp from "./CatCareApp";
import { requireChatGPTUser } from "./chatgpt-auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireChatGPTUser("/");
  return <CatCareApp section="home" user={user} />;
}
