"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Data = Record<string, string | number>;
type Entry = { id: number; category: string; recordedAt: string; data: Data };
type Save = (category: string, form: HTMLFormElement) => void;
type User = { userId: string; displayName: string; email: string; fullName: string | null };
type ProfileData = { email: string; displayName: string; birthday: string; sex: string; height: number; targetWeight: number; calorieGoal: number };

const NAV = [
  ["home", "快速瀏覽", "⌂"], ["body", "身體數值", "◌"], ["symptoms", "生理狀況", "♡"],
  ["food", "飲食熱量", "◇"], ["injection", "施打紀錄", "+"], ["exercise", "運動消耗", "△"],
  ["profile", "個人資料", "♙"],
] as const;
const FOODS = [["舒肥雞胸",165],["茶葉蛋",141],["白飯",130],["地瓜",115],["鮭魚",208],["高麗菜",23],["無糖豆漿",33],["香蕉",89],["燕麥",379],["牛肉",250]] as const;
const CATS = [
  ["/cat-white.jpg", "白貓"], ["/cat-tabby.jpg", "虎斑貓"], ["/cat-orange.jpg", "橘貓"],
  ["/cat-calico.jpg", "橘白貓"], ["/cat-box.jpg", "紙箱白貓"],
] as const;
const SYMPTOMS = ["頭暈","噁心","嘔吐","腹瀉","便秘","腹痛","疲倦","食慾低下"] as const;
const ZERO_BODY: Entry = {id:0,category:"body",recordedAt:"",data:{weight:0,fat:0,waist:0,chest:0,muscle:0,machine:""}};
const today = () => new Date().toISOString().slice(0,10);

export default function CatCareApp({section,user}:{section:string;user:User}) {
  const active = NAV.some(x=>x[0]===section) ? section : "home";
  const [entries,setEntries] = useState<Entry[]>([]);
  const [notice,setNotice] = useState("");
  const [cat,setCat] = useState<string>(CATS[0][0]);
  useEffect(()=>{ fetch("/api/entries").then(r=>r.ok?r.json():null).then(v=>v?.entries&&setEntries(v.entries)).catch(()=>{}); },[]);
  useEffect(()=>{ const saved=localStorage.getItem("catcare-cat"); if(saved&&CATS.some(x=>x[0]===saved)) setCat(saved); },[]);
  function chooseCat(value:string){ setCat(value); localStorage.setItem("catcare-cat",value); }
  async function save(category:string,form:HTMLFormElement){
    const raw=Object.fromEntries(new FormData(form)); const recordedAt=String(raw.recordedAt||today()); delete raw.recordedAt;
    const data=Object.fromEntries(Object.entries(raw).map(([k,v])=>[k,v!==""&&!Number.isNaN(Number(v))?Number(v):String(v)]));
    const draft={id:Date.now(),category,recordedAt,data}; setEntries(a=>[draft,...a]); form.reset(); setNotice("已收進今日的貓咪日記 ✓");
    try{const r=await fetch("/api/entries",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({category,recordedAt,data})});if(r.ok){const v=await r.json();setEntries(a=>a.map(x=>x.id===draft.id?v.entry:x));}}catch{}
    setTimeout(()=>setNotice(""),2500);
  }
  const body=entries.filter(e=>e.category==="body").sort((a,b)=>a.recordedAt.localeCompare(b.recordedAt));
  const latest=body.at(-1)?.data||ZERO_BODY.data;
  const intake=entries.filter(e=>e.category==="food"&&e.recordedAt===today()).reduce((n,e)=>n+Number(e.data.calories||0),0);
  const burn=entries.filter(e=>e.category==="exercise"&&e.recordedAt===today()).reduce((n,e)=>n+Number(e.data.calories||0),0);
  return <div className="shell"><aside>
    <a className="brand" href="/"><b>♥</b><span>貓貓輕生活<small>CAT CARE TRACKER</small></span></a>
    <nav>{NAV.map(([key,label,icon])=><a key={key} href={key==="home"?"/":`/${key}`} className={active===key?"active":""}><b>{icon}</b>{label}</a>)}</nav>
    <div className="aside-cat"><img src={cat} alt="已選擇的貓咪水彩畫"/><p>今天也有好好照顧自己嗎？</p></div>
    <p className="medical-note">僅供個人紀錄，不取代醫療建議。持續或嚴重不適請立即就醫。</p>
  </aside><main>
    <header><div><p className="eyebrow">MY PRIVATE HEALTH LOG</p><h1>{NAV.find(x=>x[0]===active)?.[1]}</h1></div><div className="avatar"><label className="cat-picker"><span>我的貓咪</span><select value={cat} onChange={e=>chooseCat(e.target.value)} aria-label="選擇網站貓咪圖片">{CATS.map(([src,name])=><option value={src} key={src}>{name}</option>)}</select></label><div className="account"><a href="/profile">{user.displayName}</a><a href="/signout-with-chatgpt?return_to=%2F">登出</a></div><img src={cat} alt="目前選擇的貓咪"/></div></header>
    {notice&&<div className="toast">{notice}</div>}
    <datalist id="brands">{[...new Set(entries.filter(e=>e.category==="food").map(e=>String(e.data.brand||"")).filter(Boolean))].map(x=><option key={x}>{x}</option>)}</datalist>
    {active==="home"&&<Dashboard latest={latest} body={body} intake={intake} burn={burn} entries={entries} cat={cat}/>} 
    {active==="body"&&<Body entries={body} save={save}/>} {active==="symptoms"&&<Symptoms entries={entries} save={save}/>} 
    {active==="food"&&<Food entries={entries} save={save}/>} {active==="injection"&&<Injection entries={entries} save={save}/>} 
    {active==="exercise"&&<Exercise entries={entries} save={save}/>} 
    {active==="profile"&&<Profile user={user}/>}
  </main></div>;
}

function Dashboard({latest,body,intake,burn,entries,cat}:{latest:Data;body:Entry[];intake:number;burn:number;entries:Entry[];cat:string}){
  const inj=entries.find(e=>e.category==="injection")?.data||{medicine:"尚無紀錄",dose:"0 mg",next:"尚未設定"};
  return <><section className="hero"><div><span className="sticker">今日狀態 ♡</span><h2>一點點前進，<br/><em>身體會記得。</em></h2><p>今天的你已經很棒了，完成一筆紀錄，讓改變有跡可循。</p><a className="primary" href="/body">+　記錄今日數值</a></div><img src={cat} alt="已選擇的貓咪水彩插畫"/></section>
  <section className="metrics"><Metric c="pink" l="目前體重" v={`${latest.weight} kg`} s="尚無紀錄"/><Metric c="lilac" l="體脂率" v={`${latest.fat}%`} s="尚無紀錄"/><Metric c="mint" l="今日攝取" v={`${intake} kcal`} s="今日累計"/><Metric c="yellow" l="今日消耗" v={`${burn} kcal`} s="今日累計"/></section>
  <section className="grid-two"><div className="card chart-card"><Title title="體重變化"/><Chart entries={body}/></div><div className="card injection-card"><img src={cat} alt="已選擇的貓咪"/><div><p>NEXT INJECTION</p><h3>下次施打提醒</h3><strong>{inj.medicine} · {inj.dose}</strong><span>{String(inj.next).replace("T"," ")}</span><a href="/injection">管理施打紀錄 →</a></div></div></section>
  <section className="quick"><h3>快速補記</h3><div>{NAV.filter(([k])=>k!=="home"&&k!=="profile").map(([k,l,i])=><a href={`/${k}`} key={k}><b>{i}</b>{l}<span>→</span></a>)}</div></section></>;
}
function Metric({c,l,v,s}:{c:string;l:string;v:string;s:string}){return <div className={`metric ${c}`}><span>{l}</span><strong>{v}</strong><small>{s}</small></div>}
function Title({title}:{title:string}){return <div className="card-title"><div><span>PROGRESS</span><h3>{title}</h3></div><a href="/body">查看全部 →</a></div>}
function Chart({entries}:{entries:Entry[]}){const pts=(entries.length?entries:[ZERO_BODY]).slice(-8),vals=pts.map(e=>Number(e.data.weight)),min=Math.min(...vals)-.8,max=Math.max(...vals)+.8,xy=vals.map((v,i)=>`${18+i*264/Math.max(vals.length-1,1)},${118-(v-min)/(max-min)*86}`);return <div className="chart"><svg viewBox="0 0 300 145" role="img" aria-label="體重變化折線圖"><path d="M18 32H282M18 75H282M18 118H282"/><polyline points={xy.join(" ")}/>{xy.map((p,i)=>{const [x,y]=p.split(",");return <circle key={i} cx={x} cy={y} r="4"/>})}</svg><div>{pts.map(e=><span key={e.id}>{e.recordedAt?e.recordedAt.slice(5):"尚無紀錄"}</span>)}</div></div>}

function Profile({user}:{user:User}){
  const [profile,setProfile]=useState<ProfileData>({email:user.email,displayName:user.displayName,birthday:"",sex:"",height:0,targetWeight:0,calorieGoal:0});
  const [message,setMessage]=useState("");
  useEffect(()=>{fetch("/api/profile").then(r=>r.ok?r.json():null).then(v=>v?.profile&&setProfile(v.profile)).catch(()=>{});},[]);
  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    const raw=Object.fromEntries(new FormData(e.currentTarget));
    const next:ProfileData={email:user.email,displayName:String(raw.displayName||""),birthday:String(raw.birthday||""),sex:String(raw.sex||""),height:Number(raw.height||0),targetWeight:Number(raw.targetWeight||0),calorieGoal:Number(raw.calorieGoal||0)};
    const response=await fetch("/api/profile",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(next)});
    if(response.ok){const value=await response.json();setProfile(value.profile);setMessage("個人資料已儲存 ✓");}else setMessage("儲存失敗，請稍後再試");
    setTimeout(()=>setMessage(""),2500);
  }
  return <section className="profile-page"><div className="profile-intro"><span>PRIVATE PROFILE</span><h2>只屬於你的健康後台</h2><p>登入後只會看到自己建立的紀錄。這些資料可協助設定個人追蹤目標，但不會取代專業醫療判斷。</p><div className="identity"><b>{profile.displayName||user.displayName}</b><small>{user.email}</small></div></div><form className="profile-form" onSubmit={submit}><h3>基本資料</h3><label><span>登入信箱</span><input value={user.email} readOnly/></label><label><span>顯示名稱</span><input name="displayName" value={profile.displayName} onChange={e=>setProfile({...profile,displayName:e.target.value})}/></label><label><span>生日</span><input name="birthday" type="date" value={profile.birthday} onChange={e=>setProfile({...profile,birthday:e.target.value})}/></label><label><span>生理性別</span><select name="sex" value={profile.sex} onChange={e=>setProfile({...profile,sex:e.target.value})}><option value="">未設定</option><option value="female">女性</option><option value="male">男性</option><option value="other">其他／不透露</option></select></label><label><span>身高 (cm)</span><input name="height" type="number" min="0" value={profile.height} onChange={e=>setProfile({...profile,height:Number(e.target.value)})}/></label><label><span>目標體重 (kg)</span><input name="targetWeight" type="number" min="0" step="0.1" value={profile.targetWeight} onChange={e=>setProfile({...profile,targetWeight:Number(e.target.value)})}/></label><label><span>每日熱量目標 (kcal)</span><input name="calorieGoal" type="number" min="0" value={profile.calorieGoal} onChange={e=>setProfile({...profile,calorieGoal:Number(e.target.value)})}/></label><div className="profile-actions"><button className="primary" type="submit">儲存個人資料</button><a href="/signout-with-chatgpt?return_to=%2F">登出帳號</a>{message&&<span>{message}</span>}</div></form></section>;
}

function Panel({title,sub,img,children}:{title:string;sub:string;img:string;children:React.ReactNode}){return <section className="page-panel"><div className="panel-copy"><p className="eyebrow">DAILY LOG</p><h2>{title}</h2><p>{sub}</p></div><img src={img} alt="貓咪水彩插畫"/>{children}</section>}
function Field({label,name,type="number",step,children}:{label:string;name:string;type?:string;step?:string;children?:React.ReactNode}){return <label><span>{label}</span>{children||<input name={name} type={type} step={step}/>}</label>}
const Submit=()=> <button className="primary" type="submit">收進貓咪日記</button>;
function symptomSummary(rows:Entry[]){
  const values:string[]=[];
  for(const row of rows){
    for(const [key,value] of Object.entries(row.data)){
      if(key.startsWith("symptom_")){const name=key.slice(8);if(!values.some(x=>x.startsWith(`${name} `))) values.push(`${name} ${row.data[`severity_${name}`]??"–"}/10`)}
      if(key==="symptoms"&&value&&value!=="無明顯不適"&&!values.some(x=>x.startsWith(`${value} `))) values.push(`${value} ${row.data.severity??"–"}/10`);
    }
  }
  const water=rows.find(e=>e.data.water!==""&&e.data.water!=null)?.data.water;
  const notes=rows.find(e=>String(e.data.notes||"").trim())?.data.notes;
  if(water!==undefined) values.push(`飲水 ${water} ml`); if(notes) values.push(`備註 ${notes}`);
  return values.length?values:["無明顯不適"];
}
function History({entries,cat}:{entries:Entry[];cat:string}){
  const filtered=entries.filter(e=>e.category===cat),groups=[...new Map(filtered.map(e=>[e.recordedAt,filtered.filter(x=>x.recordedAt===e.recordedAt)])).entries()].slice(0,6);
  if(cat==="symptoms") return <section className="history"><h3>最近紀錄</h3>{groups.length?groups.map(([date,rows])=><div key={date}><time>{date}</time><p>{symptomSummary(rows).map(v=><span key={v}>{v}</span>)}</p></div>):<p className="empty">還沒有紀錄，從今天開始吧。</p>}</section>;
  const rows=filtered.slice(0,6);return <section className="history"><h3>最近紀錄</h3>{rows.length?rows.map(e=><div key={`${cat}-${e.recordedAt}-${e.id}`}><time>{e.recordedAt}</time><p>{Object.values(e.data).map((v,i)=><span key={i}>{String(v)}</span>)}</p></div>):<p className="empty">還沒有紀錄，從今天開始吧。</p>}</section>
}
function Form({cat,save,children}:{cat:string;save:Save;children:React.ReactNode}){return <form onSubmit={(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();save(cat,e.currentTarget)}}>{children}{cat==="food"&&<Field label="品牌" name="brand"><input name="brand" list="brands" placeholder="例：桂格、義美、品牌自填"/></Field>}<Submit/></form>}

function Body({entries,save}:{entries:Entry[];save:Save}){const machines=[...new Set(entries.map(e=>String(e.data.machine)).filter(Boolean))];return <><Panel title="身體數值" sub="每一個小數字，都是你認真生活的證據。" img="/cat-tabby.jpg"><Form cat="body" save={save}><Field label="日期" name="recordedAt" type="date"/><Field label="體重 (kg)" name="weight" step="0.1"/><Field label="體脂 (%)" name="fat" step="0.1"/><Field label="腰圍 (cm)" name="waist" step="0.1"/><Field label="胸圍 (cm)" name="chest" step="0.1"/><Field label="肌肉量 (kg)" name="muscle" step="0.1"/><Field label="測量機器" name="machine"><><input name="machine" list="machines" placeholder="例：InBody 270"/><datalist id="machines">{machines.map(x=><option key={x}>{x}</option>)}</datalist></></Field></Form></Panel><div className="card wide-chart"><Title title="體重趨勢"/><Chart entries={entries}/></div><History entries={entries} cat="body"/></>}
function SymptomFields({entries}:{entries:Entry[]}){
  const [selected,setSelected]=useState<string[]>([]),[items,setItems]=useState<string[]>([...SYMPTOMS]),[custom,setCustom]=useState("");
  useEffect(()=>{
    const recorded=entries.filter(e=>e.category==="symptoms").flatMap(e=>Object.keys(e.data).filter(k=>k.startsWith("symptom_")).map(k=>k.slice(8)));
    const saved=JSON.parse(localStorage.getItem("catcare-symptoms")||"[]") as string[];
    setItems([...new Set([...SYMPTOMS,...recorded,...saved])]);
  },[entries]);
  function toggle(name:string){setSelected(all=>all.includes(name)?all.filter(x=>x!==name):[...all,name])}
  function add(){const name=custom.trim();if(!name||items.includes(name))return;const next=[...items,name];setItems(next);setSelected(all=>[...all,name]);setCustom("");localStorage.setItem("catcare-symptoms",JSON.stringify(next.filter(x=>!SYMPTOMS.includes(x as typeof SYMPTOMS[number]))))}
  return <div className="symptom-editor"><span className="field-heading">今日狀況（可複選）</span><div className="custom-symptom"><input value={custom} onChange={e=>setCustom(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();add()}}} placeholder="輸入其他狀況" aria-label="新增自訂生理狀況"/><button type="button" onClick={add}>+新增</button></div>{items.map(name=><div className={`symptom-row ${selected.includes(name)?"chosen":""}`} key={name}><label className="symptom-check"><input type="checkbox" name={`symptom_${name}`} value={name} checked={selected.includes(name)} onChange={()=>toggle(name)}/><b>{name}</b></label>{selected.includes(name)&&<fieldset><legend>{name}嚴重程度</legend>{Array.from({length:11},(_,n)=><label key={n}><input type="radio" name={`severity_${name}`} value={n} defaultChecked={n===1}/><span>{n}</span></label>)}</fieldset>}</div>)}</div>
}
function Symptoms({entries,save}:{entries:Entry[];save:Save}){return <><Panel title="每日生理狀況" sub="溫柔觀察身體的訊號，需要時就向醫療人員求助。" img="/cat-white.jpg"><Form cat="symptoms" save={save}><Field label="日期" name="recordedAt" type="date"/><SymptomFields entries={entries}/><Field label="飲水量 (ml)" name="water"/><Field label="備註" name="notes"><input name="notes" placeholder="何時發生、持續多久…"/></Field></Form></Panel><div className="alert">若有持續劇烈腹痛、無法進食飲水、意識改變等情形，請立即聯繫醫療人員或急診。</div><History entries={entries} cat="symptoms"/></>}
function Food({entries,save}:{entries:Entry[];save:Save}){const [food,setFood]=useState(FOODS[0][0]),[amount,setAmount]=useState(100),kcal=useMemo(()=>Math.round(amount*Number(FOODS.find(x=>x[0]===food)?.[1]||0)/100),[food,amount]);const known=[...new Set(entries.filter(e=>e.category==="food").map(e=>String(e.data.food)))];return <><Panel title="飲食與攝取熱量" sub="以公開食品熱量資料估算，實際數值會因品牌與烹調而異。" img="/cat-calico.jpg"><Form cat="food" save={save}><Field label="日期" name="recordedAt" type="date"/><Field label="食物" name="food"><><input name="food" list="foods" value={food} onChange={e=>setFood(e.target.value)}/><datalist id="foods">{[...FOODS.map(x=>x[0]),...known].map(x=><option key={x}>{x}</option>)}</datalist></></Field><Field label="份量 (g)" name="amount"><input name="amount" type="number" value={amount} onChange={e=>setAmount(Number(e.target.value))}/></Field><Field label="估算熱量 (kcal)" name="calories"><input name="calories" type="number" value={kcal} readOnly/></Field></Form></Panel><p className="source-note">常見食材每 100g 可食部估算，建議以衛福部食品營養成分資料庫及包裝標示為準。</p><History entries={entries} cat="food"/></>}
function Injection({entries,save}:{entries:Entry[];save:Save}){const old=entries.filter(e=>e.category==="injection"),meds=[...new Set(old.map(e=>String(e.data.medicine)))],doses=[...new Set(old.map(e=>String(e.data.dose)))];return <><Panel title="施打紀錄與提醒" sub="記下醫療人員已指示的用藥資訊，並輪替施打位置。" img="/cat-orange.jpg"><Form cat="injection" save={save}><Field label="施打日期" name="recordedAt" type="date"/><Field label="藥品" name="medicine"><><input name="medicine" list="meds" placeholder="例：週纖達 Wegovy"/><datalist id="meds">{["週纖達 Wegovy","猛健樂 Mounjaro",...meds].map(x=><option key={x}>{x}</option>)}</datalist></></Field><Field label="施打劑量" name="dose"><><input name="dose" list="doses" placeholder="依醫囑輸入"/><datalist id="doses">{doses.map(x=><option key={x}>{x}</option>)}</datalist></></Field><Field label="施打部位" name="site"><select name="site"><option>右下腹</option><option>左下腹</option><option>右大腿前側</option><option>左大腿前側</option><option>右上臂</option><option>左上臂</option></select></Field><Field label="下次提醒" name="next" type="datetime-local"/></Form></Panel><div className="alert soft">劑量調整只能依處方醫療人員指示，本站不會建議或自動變更劑量。</div><History entries={entries} cat="injection"/></>}
function Exercise({entries,save}:{entries:Entry[];save:Save}){return <><Panel title="運動與每日消耗" sub="不求快，只求穩穩地把活動放進生活。" img="/cat-box.jpg"><Form cat="exercise" save={save}><Field label="日期" name="recordedAt" type="date"/><Field label="運動項目" name="activity"><input name="activity" placeholder="例：快走、重訓"/></Field><Field label="時間 (分鐘)" name="minutes"/><Field label="消耗熱量 (kcal)" name="calories"/><Field label="基礎代謝 BMR (kcal)" name="bmr"/><Field label="當日總消耗 TDEE (kcal)" name="tdee"/></Form></Panel><History entries={entries} cat="exercise"/></>}
