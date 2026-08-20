/**
 * 靜態版沒有後端，用 localStorage 冒充 /api/entries 與 /api/profile。
 *
 * CatCareApp 只透過 fetch 跟資料層溝通，所以攔截 fetch 就能整份共用，
 * 不需要為了靜態版改動任何畫面程式碼。
 *
 * 儲存 key 沿用先前 GitHub Pages 版本的名稱，舊版留在瀏覽器裡的紀錄不會不見。
 */
const ENTRY_KEY = "catcare2-pages-entries";
const PROFILE_KEY = "catcare2-pages-profile";

type Entry = { id: number; category: string; recordedAt: string; data: Record<string, string | number> };

const DEFAULT_PROFILE = {
  userId: "local", email: "", displayName: "", birthday: "", sex: "",
  height: 0, targetWeight: 0, calorieGoal: 0, startWeight: 0, programStart: "", programWeeks: 0,
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

const write = (key: string, value: unknown) => localStorage.setItem(key, JSON.stringify(value));
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export function installLocalApi() {
  const original = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const { pathname, searchParams } = new URL(url, location.href);
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    const body = init?.body ? JSON.parse(String(init.body)) : null;

    if (pathname === "/api/entries") {
      const entries = read<Entry[]>(ENTRY_KEY, []);
      if (method === "GET") {
        const sorted = [...entries].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt) || b.id - a.id);
        return json({ entries: sorted });
      }
      if (method === "POST") {
        const entry: Entry = {
          id: entries.reduce((top, row) => Math.max(top, row.id), 0) + 1,
          category: String(body.category), recordedAt: String(body.recordedAt), data: body.data ?? {},
        };
        write(ENTRY_KEY, [...entries, entry]);
        return json({ entry }, 201);
      }
      if (method === "PATCH") {
        const id = Number(searchParams.get("id"));
        const row = entries.find(entry => entry.id === id);
        if (!row) return json({ error: "找不到這筆紀錄" }, 404);
        row.data = body?.data ?? row.data;
        write(ENTRY_KEY, entries);
        return json({ entry: row });
      }
      if (method === "DELETE") {
        const id = Number(searchParams.get("id"));
        const kept = entries.filter(row => row.id !== id);
        if (kept.length === entries.length) return json({ error: "找不到這筆紀錄" }, 404);
        write(ENTRY_KEY, kept);
        return json({ id });
      }
    }

    if (pathname === "/api/profile") {
      const profile = { ...DEFAULT_PROFILE, ...read(PROFILE_KEY, {}) };
      if (method === "GET") return json({ profile });
      if (method === "POST") {
        const next = { ...profile, ...body, userId: "local" };
        write(PROFILE_KEY, next);
        return json({ profile: next });
      }
    }

    return original(input, init);
  };
}
