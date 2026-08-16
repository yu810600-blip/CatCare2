"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Data = Record<string, string | number>;
type Entry = { id: number; category: string; recordedAt: string; data: Data };
type Save = (category: string, form: HTMLFormElement) => void;

const NAV = [
  ["home", "快速瀏覽", "⌂"], ["body", "身體數值", "◌"], ["symptoms", "生理狀況", "♡"],
  ["food", "飲食熱量", "◇"], ["injection", "施打紀錄", "+"], ["exercise", "運動消耗", "△"],
] as const;
const FOODS = [["舒肥雞胸",165],["茶葉蛋",141],["白飯",130],["地瓜",115],["鮭魚",208],["高麗菜",23],["無糖豆漿",33],["香蕉",89],["燕麥",379],["牛肉",250]] as const;
const CATS = [
  ["/cat-white.jpg", "白貓"], ["/cat-tabby.jpg", "虎斑貓"], ["/cat-orange.jpg", "橘貓"],
  ["/cat-calico.jpg", "橘白貓"], ["/cat-box.jpg", "紙箱白貓"],
] as const;
const SYMPTOMS = ["頭暈","噁心","嘔吐","腹瀉","便秘","腹痛","疲倦","食慾低下"] as const;
const DEMO: Entry[] = [
  {id:1,category:"body",recordedAt:"2026-08-02",data:{weight:78.2,fat:36.1,waist:92,chest:101,muscle:27.5,machine:"InBody 270"}},
  {id:2,category:"body",recordedAt:"2026-08-09",data:{weight:77.4,fat:35.6,waist:91,chest:100,muscle:27.7,machine:"InBody 270"}},
  {id:3,category:"body",recordedAt:"2026-08-16",data:{weight:76.8,fat:35.1,waist:89.5,chest:99,muscle:27.9,machine:"InBody 270"}},
  {id:4,category:"injection",recordedAt:"2026-08-15",data:{medicine:"週纖達 Wegovy",dose:"0.25 mg",site:"右下腹",next:"2026-08-22T20:00"}},
  {id:5,category:"food",recordedAt:"2026-08-16",data:{food:"舒肥雞胸",amount:120,calories:198}},
  {id:6,category:"exercise",recordedAt:"2026-08-16",data:{activity:"快走",minutes:35,calories:180}},
];
const today = () => new Date().toISOString().slice(0,10);

export default function CatCareApp({section}:{section:string}) {
  const active = NAV.some(x=>x[0]===section) ? section : "home";
  const [entries,setEntries] = useState<Entry[]>(DEMO);
  const [notice,setNotice] = useState("");
  const [cat,setCat] = useState<string>(CATS[0][0]);
  useEffect(()=>{ fetch("/api/entries").then(r=>r.ok?r.json():null).then(v=>v?.entries?.length&&setEntries(v.entries)).catch(()=>{}); },[]);
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
  const latest=body.at(-1)?.data||DEMO[2].data;
  const intake=entries.filter(e=>e.category==="food"&&e.recordedAt===today()).reduce((n,e)=>n+Number(e.data.calories||0),0);
  const burn=entries.filter(e=>e.category==="exercise"&&e.recordedAt===today()).reduce((n,e)=>n+Number(e.data.calories||0),0);
  return <div className="shell"><aside>
    <a className="brand" href="/"><b>♥</b><span>貓貓輕生活<small>CAT CARE TRACKER</small></span></a>
    <nav>{NAV.map(([key,label,icon])=><a key={key} href={key==="home"?"/":`/${key}`} className={active===key?"active":""}><b>{icon}</b>{label}</a>)}</nav>
    <div className="aside-cat"><img src={cat} alt="已選擇的貓咪水彩畫"/><p>今天也有好好照顧自己嗎？</p></div>
    <p className="medical-note">僅供個人紀錄，不取代醫療建議。持續或嚴重不適請立即就醫。</p>
  </aside><main>
    <header><div><p className="eyebrow">SUNDAY · 16 AUG</p><h1>{NAV.find(x=>x[0]===active)?.[1]}</h1></div><div className="avatar"><label className="cat-picker"><span>我的貓咪</span><select value={cat} onChange={e=>chooseCat(e.target.value)} aria-label="選擇網站貓咪圖片">{CATS.map(([src,name])=><option value={src} key={src}>{name}</option>)}</select></label><img src={cat} alt="目前選擇的貓咪"/></div></header>
    {notice&&<div className="toast">{notice}</div>}
    <datalist id="brands">{[...new Set(entries.filter(e=>e.category==="food").map(e=>String(e.data.brand||"")).filter(Boolean))].map(x=><option key={x}>{x}</option>)}</datalist>
    {active==="home"&&<Dashboard latest={latest} body={body} intake={intake} burn={burn} entries={entries} cat={cat}/>} 
    {active==="body"&&<Body entries={body} save={save}/>} {active==="symptoms"&&<Symptoms entries={entries} save={save}/>} 
    {active==="food"&&<Food entries={entries} save={save}/>} {active==="injection"&&<Injection entries={entries} save={save}/>} 
    {active==="exercise"&&<Exercise entries={entries} save={save}/>} 
  </main></div>;
}

function Dashboard({latest,body,intake,burn,entries,cat}:{latest:Data;body:Entry[];intake:number;burn:number;entries:Entry[];cat:string}){
  const inj=entries.find(e=>e.category==="injection")?.data||DEMO[3].data;
  return <><section className="hero"><div><span className="sticker">今日狀態 ♡</span><h2>一點點前進，<br/><em>身體會記得。</em></h2><p>今天的你已經很棒了，完成一筆紀錄，讓改變有跡可循。</p><a className="primary" href="/body">+　記錄今日數值</a></div><img src={cat} alt="已選擇的貓咪水彩插畫"/></section>
  <section className="metrics"><Metric c="pink" l="目前體重" v={`${latest.weight} kg`} s="↓ 1.4 kg 本月"/><Metric c="lilac" l="體脂率" v={`${latest.fat}%`} s="↓ 1.0% 本月"/><Metric c="mint" l="今日攝取" v={`${intake||1280} kcal`} s="目標 1,650 kcal"/><Metric c="yellow" l="今日消耗" v={`${burn||380} kcal`} s="包含活動紀錄"/></section>
  <section className="grid-two"><div className="card chart-card"><Title title="體重變化"/><Chart entries={body}/></div><div className="card injection-card"><img src={cat} alt="已選擇的貓咪"/><div><p>NEXT INJECTION</p><h3>下次施打提醒</h3><strong>{inj.medicine} · {inj.dose}</strong><span>{String(inj.next).replace("T"," ")}</span><a href="/injection">管理施打紀錄 →</a></div></div></section>
  <section className="quick"><h3>快速補記</h3><div>{NAV.slice(1).map(([k,l,i])=><a href={`/${k}`} key={k}><b>{i}</b>{l}<span>→</span></a>)}</div></section></>;
}
function Metric({c,l,v,s}:{c:string;l:string;v:string;s:string}){return <div className={`metric ${c}`}><span>{l}</span><strong>{v}</strong><small>{s}</small></div>}
function Title({title}:{title:string}){return <div className="card-title"><div><span>PROGRESS</span><h3>{title}</h3></div><a href="/body">查看全部 →</a></div>}
function Chart({entries}:{entries:Entry[]}){const pts=(entries.length?entries:DEMO.slice(0,3)).slice(-8),vals=pts.map(e=>Number(e.data.weight)),min=Math.min(...vals)-.8,max=Math.max(...vals)+.8,xy=vals.map((v,i)=>`${18+i*264/Math.max(vals.length-1,1)},${118-(v-min)/(max-min)*86}`);return <div className="chart"><svg viewBox="0 0 300 145" role="img" aria-label="體重變化折線圖"><path d="M18 32H282M18 75H282M18 118H282"/><polyline points={xy.join(" ")}/>{xy.map((p,i)=>{const [x,y]=p.split(",");return <circle key={i} cx={x} cy={y} r="4"/>})}</svg><div>{pts.map(e=><span key={e.id}>{e.recordedAt.slice(5)}</span>)}</div></div>}

function Panel({title,sub,img,children}:{title:string;sub:string;img:string;children:React.ReactNode}){return <section className="page-panel"><div className="panel-copy"><p className="eyebrow">DAILY LOG</p><h2>{title}</h2><p>{sub}</p></div><img src={img} alt="貓咪水彩插畫"/>{children}</section>}
function Field({label,name,type="number",step,children}:{label:string;name:string;type?:string;step?:string;children?:React.ReactNode}){return <label><span>{label}</span>{children||<input name={name} type={type} step={step}/>}</label>}
const Submit=()=> <button className="primary" type="submit">收進貓咪日記</button>;
function History({entries,cat}:{entries:Entry[];cat:string}){const filtered=entries.filter(e=>e.category===cat),rows=cat==="symptoms"?[...new Map(filtered.map(e=>[e.recordedAt,{...e,data:Object.assign({},...filtered.filter(x=>x.recordedAt===e.recordedAt).map(x=>x.data))}])).values()].slice(0,6):filtered.slice(0,6);return <section className="history"><h3>最近紀錄</h3>{rows.length?rows.map(e=><div key={`${cat}-${e.recordedAt}-${e.id}`}><time>{e.recordedAt}</time><p>{[...new Set(Object.values(e.data).map(String))].map((v,i)=><span key={i}>{v}</span>)}</p></div>):<p className="empty">還沒有紀錄，從今天開始吧。</p>}</section>}
function Form({cat,save,children}:{cat:string;save:Save;children:React.ReactNode}){return <form onSubmit={(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();save(cat,e.currentTarget)}}>{children}{cat==="food"&&<Field label="品牌" name="brand"><input name="brand" list="brands" placeholder="例：桂格、義美、品牌自填"/></Field>}<Submit/></form>}

function Body({entries,save}:{entries:Entry[];save:Save}){const machines=[...new Set(entries.map(e=>String(e.data.machine)).filter(Boolean))];return <><Panel title="身體數值" sub="每一個小數字，都是你認真生活的證據。" img="/cat-tabby.jpg"><Form cat="body" save={save}><Field label="日期" name="recordedAt" type="date"/><Field label="體重 (kg)" name="weight" step="0.1"/><Field label="體脂 (%)" name="fat" step="0.1"/><Field label="腰圍 (cm)" name="waist" step="0.1"/><Field label="胸圍 (cm)" name="chest" step="0.1"/><Field label="肌肉量 (kg)" name="muscle" step="0.1"/><Field label="測量機器" name="machine"><><input name="machine" list="machines" placeholder="例：InBody 270"/><datalist id="machines">{machines.map(x=><option key={x}>{x}</option>)}</datalist></></Field></Form></Panel><div className="card wide-chart"><Title title="體重趨勢"/><Chart entries={entries}/></div><History entries={entries} cat="body"/></>}
function SymptomFields(){
  const [selected,setSelected]=useState<string[]>([]);
  function toggle(name:string){setSelected(all=>all.includes(name)?all.filter(x=>x!==name):[...all,name])}
  return <div className="symptom-editor"><span className="field-heading">今日狀況（可複選）</span>{SYMPTOMS.map(name=><div className={`symptom-row ${selected.includes(name)?"chosen":""}`} key={name}><label className="symptom-check"><input type="checkbox" name={`symptom_${name}`} value={name} checked={selected.includes(name)} onChange={()=>toggle(name)}/><b>{name}</b></label>{selected.includes(name)&&<fieldset><legend>{name}嚴重程度</legend>{Array.from({length:11},(_,n)=><label key={n}><input type="radio" name={`severity_${name}`} value={n} defaultChecked={n===1}/><span>{n}</span></label>)}</fieldset>}</div>)}</div>
}
function Symptoms({entries,save}:{entries:Entry[];save:Save}){return <><Panel title="每日生理狀況" sub="溫柔觀察身體的訊號，需要時就向醫療人員求助。" img="/cat-white.jpg"><Form cat="symptoms" save={save}><Field label="日期" name="recordedAt" type="date"/><SymptomFields/><Field label="飲水量 (ml)" name="water"/><Field label="備註" name="notes"><input name="notes" placeholder="何時發生、持續多久…"/></Field></Form></Panel><div className="alert">若有持續劇烈腹痛、無法進食飲水、意識改變等情形，請立即聯繫醫療人員或急診。</div><History entries={entries} cat="symptoms"/></>}
function Food({entries,save}:{entries:Entry[];save:Save}){const [food,setFood]=useState(FOODS[0][0]),[amount,setAmount]=useState(100),kcal=useMemo(()=>Math.round(amount*Number(FOODS.find(x=>x[0]===food)?.[1]||0)/100),[food,amount]);const known=[...new Set(entries.filter(e=>e.category==="food").map(e=>String(e.data.food)))];return <><Panel title="飲食與攝取熱量" sub="以公開食品熱量資料估算，實際數值會因品牌與烹調而異。" img="/cat-calico.jpg"><Form cat="food" save={save}><Field label="日期" name="recordedAt" type="date"/><Field label="食物" name="food"><><input name="food" list="foods" value={food} onChange={e=>setFood(e.target.value)}/><datalist id="foods">{[...FOODS.map(x=>x[0]),...known].map(x=><option key={x}>{x}</option>)}</datalist></></Field><Field label="份量 (g)" name="amount"><input name="amount" type="number" value={amount} onChange={e=>setAmount(Number(e.target.value))}/></Field><Field label="估算熱量 (kcal)" name="calories"><input name="calories" type="number" value={kcal} readOnly/></Field></Form></Panel><p className="source-note">常見食材每 100g 可食部估算，建議以衛福部食品營養成分資料庫及包裝標示為準。</p><History entries={entries} cat="food"/></>}
function Injection({entries,save}:{entries:Entry[];save:Save}){const old=entries.filter(e=>e.category==="injection"),meds=[...new Set(old.map(e=>String(e.data.medicine)))],doses=[...new Set(old.map(e=>String(e.data.dose)))];return <><Panel title="施打紀錄與提醒" sub="記下醫療人員已指示的用藥資訊，並輪替施打位置。" img="/cat-orange.jpg"><Form cat="injection" save={save}><Field label="施打日期" name="recordedAt" type="date"/><Field label="藥品" name="medicine"><><input name="medicine" list="meds" placeholder="例：週纖達 Wegovy"/><datalist id="meds">{["週纖達 Wegovy","猛健樂 Mounjaro",...meds].map(x=><option key={x}>{x}</option>)}</datalist></></Field><Field label="施打劑量" name="dose"><><input name="dose" list="doses" placeholder="依醫囑輸入"/><datalist id="doses">{doses.map(x=><option key={x}>{x}</option>)}</datalist></></Field><Field label="施打部位" name="site"><select name="site"><option>右下腹</option><option>左下腹</option><option>右大腿前側</option><option>左大腿前側</option><option>右上臂</option><option>左上臂</option></select></Field><Field label="下次提醒" name="next" type="datetime-local"/></Form></Panel><div className="alert soft">劑量調整只能依處方醫療人員指示，本站不會建議或自動變更劑量。</div><History entries={entries} cat="injection"/></>}
function Exercise({entries,save}:{entries:Entry[];save:Save}){return <><Panel title="運動與每日消耗" sub="不求快，只求穩穩地把活動放進生活。" img="/cat-box.jpg"><Form cat="exercise" save={save}><Field label="日期" name="recordedAt" type="date"/><Field label="運動項目" name="activity"><input name="activity" placeholder="例：快走、重訓"/></Field><Field label="時間 (分鐘)" name="minutes"/><Field label="消耗熱量 (kcal)" name="calories"/><Field label="基礎代謝 BMR (kcal)" name="bmr"/><Field label="當日總消耗 TDEE (kcal)" name="tdee"/></Form></Panel><History entries={entries} cat="exercise"/></>}
