const NAV = [
  ["home", "快速瀏覽", "⌂"], ["body", "身體數值", "◌"], ["symptoms", "生理狀況", "♡"],
  ["food", "飲食熱量", "◇"], ["injection", "施打紀錄", "+"], ["exercise", "運動消耗", "△"],
  ["profile", "個人資料", "♙"],
];
const CATS = [
  ["assets/cat-white.jpg", "白貓"], ["assets/cat-tabby.jpg", "虎斑貓"], ["assets/cat-orange.jpg", "橘貓"],
  ["assets/cat-calico.jpg", "橘白貓"], ["assets/cat-box.jpg", "紙箱白貓"],
];
const SYMPTOMS = ["頭暈", "噁心", "嘔吐", "腹瀉", "便秘", "腹痛", "疲倦", "食慾低下"];
const STORE = "catcare2-pages-entries";
const PROFILE_STORE = "catcare2-pages-profile";
let entries = read(STORE, []);
let profile = read(PROFILE_STORE, { displayName: "", birthday: "", sex: "", height: 0, targetWeight: 0, calorieGoal: 0 });
let cat = localStorage.getItem("catcare2-pages-cat") || CATS[0][0];

function read(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function esc(value = "") {
  return String(value).replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
}
function today() { return new Date().toISOString().slice(0, 10); }
function route() { const key = location.hash.slice(1); return NAV.some(x => x[0] === key) ? key : "home"; }
function categoryRows(category) { return entries.filter(x => x.category === category).sort((a, b) => b.recordedAt.localeCompare(a.recordedAt) || b.id - a.id); }
function saveEntries() { localStorage.setItem(STORE, JSON.stringify(entries)); }
function field(label, name, type = "number", extra = "") { return `<label><span>${label}</span><input name="${name}" type="${type}" ${extra}></label>`; }

function shell(active, content) {
  const nav = NAV.map(([key, label, icon]) => `<a href="#${key}" class="${active === key ? "active" : ""}"><b>${icon}</b>${label}</a>`).join("");
  const options = CATS.map(([src, name]) => `<option value="${src}" ${src === cat ? "selected" : ""}>${name}</option>`).join("");
  const date = new Intl.DateTimeFormat("zh-TW", { month: "long", day: "numeric", weekday: "long" }).format(new Date());
  return `<div class="shell"><aside><a class="brand" href="#home"><b>♥</b><span>貓貓輕生活<small>CAT CARE TRACKER</small></span></a><nav>${nav}</nav><div class="aside-cat"><img src="${cat}" alt="選擇的貓咪"><p>今天也有好好照顧自己嗎？</p></div><p class="medical-note">資料只保存在這個瀏覽器。本站僅供個人紀錄，不取代醫療建議。</p></aside><main><header><div><p class="eyebrow">${date}</p><h1>${NAV.find(x => x[0] === active)[1]}</h1></div><div class="avatar"><label class="cat-picker"><span>我的貓咪</span><select id="cat-picker">${options}</select></label><div class="account"><a href="#profile">${esc(profile.displayName || "本機使用者")}</a><small>此裝置保存</small></div><img src="${cat}" alt="目前選擇的貓咪"></div></header><div id="notice" class="toast" hidden></div>${content}</main></div>`;
}

function render() {
  const active = route();
  const views = { home: dashboard, body: bodyPage, symptoms: symptomsPage, food: foodPage, injection: injectionPage, exercise: exercisePage, profile: profilePage };
  document.querySelector("#app").innerHTML = shell(active, views[active]());
  document.querySelector("#cat-picker").addEventListener("change", event => { cat = event.target.value; localStorage.setItem("catcare2-pages-cat", cat); render(); });
  bindForm(active);
}

function metric(color, label, value, sub) { return `<div class="metric ${color}"><span>${label}</span><strong>${value}</strong><small>${sub}</small></div>`; }
function dashboard() {
  const body = categoryRows("body").sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  const latest = body.at(-1)?.data || { weight: 0, fat: 0 };
  const intake = categoryRows("food").filter(x => x.recordedAt === today()).reduce((n, x) => n + Number(x.data.calories || 0), 0);
  const burn = categoryRows("exercise").filter(x => x.recordedAt === today()).reduce((n, x) => n + Number(x.data.calories || 0), 0);
  const injection = categoryRows("injection")[0]?.data || { medicine: "尚無紀錄", dose: "0 mg", next: "尚未設定" };
  const quick = NAV.filter(x => !["home", "profile"].includes(x[0])).map(([key, label, icon]) => `<a href="#${key}"><b>${icon}</b>${label}<span>→</span></a>`).join("");
  return `<section class="hero"><div><span class="sticker">今日狀態 ♡</span><h2>一點點前進，<br><em>身體會記得。</em></h2><p>完成一筆紀錄，讓每次改變都有跡可循。</p><a class="primary" href="#body">＋ 記錄今日數值</a></div><img src="${cat}" alt="貓咪水彩插畫"></section><section class="metrics">${metric("pink", "目前體重", `${latest.weight || 0} kg`, body.length ? "最近一次紀錄" : "尚無紀錄")}${metric("lilac", "體脂率", `${latest.fat || 0}%`, body.length ? "最近一次紀錄" : "尚無紀錄")}${metric("mint", "今日攝取", `${intake} kcal`, "今日累計")}${metric("yellow", "今日消耗", `${burn} kcal`, "今日累計")}</section><section class="grid-two"><div class="card"><div class="card-title"><div><span>PROGRESS</span><h3>體重變化</h3></div><a href="#body">查看全部 →</a></div>${chart(body)}</div><div class="card injection-card"><img src="${cat}" alt="貓咪"><div><p>NEXT INJECTION</p><h3>下次施打提醒</h3><strong>${esc(injection.medicine)} · ${esc(injection.dose)}</strong><span>${esc(String(injection.next).replace("T", " "))}</span><a href="#injection">管理施打紀錄 →</a></div></div></section><section class="quick"><h3>快速補記</h3><div>${quick}</div></section>`;
}
function chart(rows) {
  if (!rows.length) return `<div class="chart empty-chart"><b>0 kg</b><span>建立第一筆身體數值後，這裡會顯示趨勢。</span></div>`;
  const points = rows.slice(-8), values = points.map(x => Number(x.data.weight || 0));
  const min = Math.min(...values) - 1, max = Math.max(...values) + 1;
  const xy = values.map((value, i) => `${18 + i * 264 / Math.max(values.length - 1, 1)},${118 - (value - min) / Math.max(max - min, 1) * 86}`);
  return `<div class="chart"><svg viewBox="0 0 300 145" aria-label="體重變化折線圖"><path d="M18 32H282M18 75H282M18 118H282"></path><polyline points="${xy.join(" ")}"></polyline>${xy.map(p => { const [x, y] = p.split(","); return `<circle cx="${x}" cy="${y}" r="4"></circle>`; }).join("")}</svg><div>${points.map(x => `<span>${x.recordedAt.slice(5)}</span>`).join("")}</div></div>`;
}
function panel(title, subtitle, image, form) { return `<section class="page-panel"><div class="panel-copy"><p class="eyebrow">DAILY LOG</p><h2>${title}</h2><p>${subtitle}</p></div><img src="${image}" alt="貓咪水彩插畫">${form}</section>`; }
function form(category, fields) { return `<form data-category="${category}">${fields}<button class="primary" type="submit">收進貓咪日記</button></form>`; }
function history(category) {
  const rows = categoryRows(category).slice(0, 6);
  if (!rows.length) return `<section class="history"><h3>最近紀錄</h3><p class="empty">還沒有紀錄，從今天開始吧。</p></section>`;
  return `<section class="history"><h3>最近紀錄</h3>${rows.map(row => `<div><time>${row.recordedAt}</time><p>${Object.entries(row.data).filter(([, value]) => value !== "" && value !== false).map(([key, value]) => `<span>${esc(key.startsWith("symptom_") ? `${key.slice(8)} ${value}/10` : value)}</span>`).join("")}</p></div>`).join("")}</section>`;
}
function bodyPage() { const rows = categoryRows("body"); return panel("身體數值", "每一個小數字，都是你認真生活的證據。", "assets/cat-tabby.jpg", form("body", `${field("日期", "recordedAt", "date", `value="${today()}" required`)}${field("體重 (kg)", "weight", "number", "step=0.1")}${field("體脂 (%)", "fat", "number", "step=0.1")}${field("腰圍 (cm)", "waist", "number", "step=0.1")}${field("胸圍 (cm)", "chest", "number", "step=0.1")}${field("肌肉量 (kg)", "muscle", "number", "step=0.1")}<label><span>測量機器</span><input name="machine" placeholder="例：InBody 270"></label>`)) + `<div class="card wide-chart"><div class="card-title"><h3>體重趨勢</h3></div>${chart([...rows].reverse())}</div>` + history("body"); }
function symptomsPage() { const symptomFields = SYMPTOMS.map(name => `<div class="symptom-row"><b>${name}</b><div class="severity"><label><input type="radio" name="symptom_${name}" value="1"><span>1</span></label><label><input type="radio" name="symptom_${name}" value="2"><span>2</span></label><label><input type="radio" name="symptom_${name}" value="3"><span>3</span></label><label><input type="radio" name="symptom_${name}" value="4"><span>4</span></label><label><input type="radio" name="symptom_${name}" value="5"><span>5</span></label></div></div>`).join(""); return panel("每日生理狀況", "可同時記錄多項狀況與各自的嚴重程度。", "assets/cat-white.jpg", form("symptoms", `${field("日期", "recordedAt", "date", `value="${today()}" required`)}<div class="symptom-editor"><span class="field-heading">今日狀況（可多選）</span>${symptomFields}<label><span>自訂狀況</span><input name="customSymptom" placeholder="輸入其他狀況"></label></div>${field("飲水量 (ml)", "water")}${field("備註", "notes", "text", 'placeholder="何時發生、持續多久…"')}`)) + `<div class="alert">持續劇烈腹痛、無法進食飲水或意識改變時，請立即聯繫醫療人員。</div>` + history("symptoms"); }
function foodPage() { return panel("飲食與攝取熱量", "依食品包裝或公開資料記下每餐熱量。", "assets/cat-calico.jpg", form("food", `${field("日期", "recordedAt", "date", `value="${today()}" required`)}${field("食物", "food", "text", "required placeholder=食物名稱")}${field("品牌", "brand", "text", "placeholder=例：義美、桂格")}${field("份量 (g)", "amount")}${field("熱量 (kcal)", "calories", "number", "required")}`)) + history("food"); }
function injectionPage() { return panel("施打紀錄與提醒", "記下醫療人員指示的用藥資訊，並輪替施打位置。", "assets/cat-orange.jpg", form("injection", `${field("施打日期", "recordedAt", "date", `value="${today()}" required`)}${field("藥品", "medicine", "text", "required placeholder=例：週纖達或猛健樂")}${field("施打劑量", "dose", "text", "required placeholder=依醫囑輸入")}<label><span>施打部位</span><select name="site"><option>右下腹</option><option>左下腹</option><option>右大腿前側</option><option>左大腿前側</option><option>右上臂</option><option>左上臂</option></select></label>${field("下次提醒", "next", "datetime-local")}`)) + `<div class="alert soft">劑量調整只能依處方醫療人員指示。</div>` + history("injection"); }
function exercisePage() { return panel("運動與每日消耗", "穩穩地把活動放進生活。", "assets/cat-box.jpg", form("exercise", `${field("日期", "recordedAt", "date", `value="${today()}" required`)}${field("運動項目", "activity", "text", "required placeholder=例：快走、重訓")}${field("時間 (分鐘)", "minutes")}${field("消耗熱量 (kcal)", "calories")}${field("基礎代謝 BMR (kcal)", "bmr")}${field("當日總消耗 TDEE (kcal)", "tdee")}`)) + history("exercise"); }
function profilePage() { return `<section class="profile-page"><div class="profile-intro"><span>LOCAL PROFILE</span><h2>只屬於這個瀏覽器的健康資料</h2><p>GitHub Pages 版本不會把個人資料傳到伺服器，也不會跨裝置同步。清除瀏覽器資料時，紀錄也會一併移除。</p><div class="identity"><b>${esc(profile.displayName || "尚未設定名稱")}</b><small>本機儲存模式</small></div></div><form id="profile-form" class="profile-form"><h3>基本資料</h3>${field("顯示名稱", "displayName", "text", `value="${esc(profile.displayName)}"`)}${field("生日", "birthday", "date", `value="${esc(profile.birthday)}"`)}<label><span>生理性別</span><select name="sex"><option value="">未設定</option><option value="female" ${profile.sex === "female" ? "selected" : ""}>女性</option><option value="male" ${profile.sex === "male" ? "selected" : ""}>男性</option><option value="other" ${profile.sex === "other" ? "selected" : ""}>其他／不透露</option></select></label>${field("身高 (cm)", "height", "number", `step="0.1" value="${profile.height || 0}"`)}${field("目標體重 (kg)", "targetWeight", "number", `step="0.1" value="${profile.targetWeight || 0}"`)}${field("每日熱量目標", "calorieGoal", "number", `value="${profile.calorieGoal || 0}"`)}<div class="profile-actions"><button class="primary" type="submit">儲存個人資料</button><button class="danger" id="clear-data" type="button">清除本機健康紀錄</button></div></form></section>`; }

function bindForm(active) {
  const logForm = document.querySelector("form[data-category]");
  if (logForm) logForm.addEventListener("submit", event => {
    event.preventDefault();
    const raw = Object.fromEntries(new FormData(logForm));
    const recordedAt = String(raw.recordedAt || today()); delete raw.recordedAt;
    const custom = String(raw.customSymptom || "").trim(); delete raw.customSymptom;
    if (custom) raw[`symptom_${custom}`] = 1;
    const data = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, value !== "" && !Number.isNaN(Number(value)) ? Number(value) : String(value)]));
    entries.unshift({ id: Date.now(), category: logForm.dataset.category, recordedAt, data }); saveEntries(); render(); showNotice("已收進今日的貓咪日記 ✓");
  });
  if (active === "profile") {
    document.querySelector("#profile-form").addEventListener("submit", event => { event.preventDefault(); const raw = Object.fromEntries(new FormData(event.currentTarget)); profile = { displayName: String(raw.displayName || ""), birthday: String(raw.birthday || ""), sex: String(raw.sex || ""), height: Number(raw.height || 0), targetWeight: Number(raw.targetWeight || 0), calorieGoal: Number(raw.calorieGoal || 0) }; localStorage.setItem(PROFILE_STORE, JSON.stringify(profile)); render(); showNotice("個人資料已儲存 ✓"); });
    document.querySelector("#clear-data").addEventListener("click", () => { if (confirm("確定清除這個瀏覽器內的所有健康紀錄嗎？此動作無法復原。")) { entries = []; saveEntries(); render(); showNotice("健康紀錄已清空"); } });
  }
}
function showNotice(message) { const notice = document.querySelector("#notice"); notice.textContent = message; notice.hidden = false; setTimeout(() => { notice.hidden = true; }, 2200); }
window.addEventListener("hashchange", render);
render();
