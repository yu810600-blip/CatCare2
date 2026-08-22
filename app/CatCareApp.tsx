"use client";

import Link from "next/link";
import { createContext, FormEvent, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  bmi, bmiLabel, calorieTotals, dayTotals, EMPTY_PROFILE, formatDate, goalProgress, milestones,
  monthMatrix, nextInjection, programProgress, symptomStats, taskSummary, todayKey,
  todayTasks, trend, waterTotal, weekStats, weightSeries,
  nutritionTotals, describeEntry, dosePresets, siteRotation, injectionStats, INJECTION_SITES,
  parseDateKey, toDateKey, shiftDays, formatDose, expenseStats, mergeDayData,
  type Data, type Entry, type GoalProgress, type ProfileData, type ProgramProgress, type TodayTask, type WeightPoint,
} from "./health";
import { NUTRIENT_KEYS, NUTRIENT_LABELS, scaleFood, searchFoods, type FoodDb, type FoodRow } from "./food-db";
import { asset } from "./asset";
import { syncInjectionReminders } from "./notifications";
import { connectAppleHealth, fetchHealthEntries, isHealthSyncAvailable, type HealthImport } from "./health-sync";
import { CompanionCat, COMPANIONS, companionByPhoto, milestonesDoneCount, poseSrc, useCompanion, type Companion, type CompanionState } from "./companion";

// 登出路徑由平台攔截處理，不是 app 內的頁面，所以維持原生 <a>。
// eslint-disable-next-line @next/next/no-html-link-for-pages
const SignOut = ({label}:{label:string}) => <a href="/signout-with-chatgpt?return_to=%2F">{label}</a>;

const RemoveEntry = createContext<(id: number) => void>(() => {});

// 樂觀更新的暫時 id 用負數遞減，永遠不會撞到資料庫的自增正數 id。
let draftId = -1;

type Save = (category: string, form: HTMLFormElement) => void;
type SaveData = (category: string, recordedAt: string, data: Data) => void;
type User = { userId: string; displayName: string; email: string; fullName: string | null };

// 每個 section 仍保有自己的路由（舊連結與 PWA 捷徑不會失效），但導覽收斂成五個分頁。
const LABELS: Record<string, string> = {
  home: "健康總覽", body: "身體數值", food: "飲食熱量", water: "飲水紀錄",
  supplement: "營養補充", exercise: "運動消耗", injection: "施打紀錄",
  symptoms: "生理狀況", expense: "開銷紀錄", calendar: "月曆紀錄", insights: "統計與目標", profile: "個人資料",
};
const NAV = [
  ["home", "健康總覽", "/"], ["daily", "每日紀錄", "/body"], ["care", "療程紀錄", "/injection"],
  ["review", "歷史統計", "/calendar"], ["profile", "個人資料", "/profile"],
] as const;
// section → 所屬分頁（決定導覽的 active 樣式與顯示哪組子頁籤）
const PAGE_OF: Record<string, string> = {
  home: "home", body: "daily", food: "daily", water: "daily", supplement: "daily", exercise: "daily",
  injection: "care", symptoms: "care", expense: "care", calendar: "review", insights: "review", profile: "profile",
};
const SUBTABS: Record<string, readonly (readonly [string, string])[]> = {
  daily: [["body", "身體數值"], ["food", "飲食"], ["water", "飲水"], ["supplement", "營養品"], ["exercise", "運動"]],
  care: [["injection", "施打"], ["symptoms", "生理狀況"], ["expense", "開銷"]],
  review: [["calendar", "月曆"], ["insights", "統計與目標"]],
};
const NAV_ICONS: Record<string, React.ReactNode> = {
  home: <svg viewBox="0 0 24 24"><path d="M3.5 10.8 12 3.6l8.5 7.2"/><path d="M5.5 9.5V20a1 1 0 0 0 1 1H9.8v-5.6a2.2 2.2 0 0 1 4.4 0V21h3.3a1 1 0 0 0 1-1V9.5"/></svg>,
  daily: <svg viewBox="0 0 24 24"><path d="M16.8 3.7 20.3 7.2 8.5 19 4.4 19.9 5.3 15.8Z"/><path d="M14.3 6.2l3.5 3.5"/><path d="M12 21h8.5"/></svg>,
  care: <svg viewBox="0 0 24 24"><path d="M12 20.4C7.7 16.6 4 13.7 4 10.2 4 7.8 5.8 6 8.1 6c1.5 0 2.9.8 3.9 2.2C13 6.8 14.4 6 15.9 6 18.2 6 20 7.8 20 10.2c0 3.5-3.7 6.4-8 10.2Z"/><path d="M7.6 11.6h2.5l1.2-2.3 1.6 4 1.2-2.3h2.3"/></svg>,
  review: <svg viewBox="0 0 24 24"><path d="M4.5 20.5h15"/><path d="M6.5 20V11.5"/><path d="M12 20V4.5"/><path d="M17.5 20v-6"/></svg>,
  profile: <svg viewBox="0 0 24 24"><circle cx="12" cy="8.2" r="3.9"/><path d="M4.6 20.6c.8-3.6 3.8-5.6 7.4-5.6s6.6 2 7.4 5.6"/></svg>,
};
const RECORDS = ["body", "symptoms", "food", "water", "supplement", "exercise", "injection", "expense"] as const;
type Record0 = typeof RECORDS[number];
const RECORD_GLYPHS: Record<Record0, string> = { body: "◌", symptoms: "♡", food: "◇", water: "◒", supplement: "✽", exercise: "△", injection: "+", expense: "¤" };
const DRINKS = ["白開水", "無糖茶", "黑咖啡", "氣泡水", "湯品"] as const;
const CATS = [
  ["/cat-white.jpg", "白貓"], ["/cat-tabby.jpg", "虎斑貓"], ["/cat-orange.jpg", "橘貓"],
  ["/cat-calico.jpg", "橘白貓"], ["/cat-box.jpg", "紙箱白貓"],
] as const;
const SYMPTOMS = ["頭暈","噁心","嘔吐","腹瀉","便秘","腹痛","疲倦","食慾低下"] as const;
const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"] as const;
const QUICK_WATER = [250, 500, 750] as const;

export default function CatCareApp({section,user,local=false}:{section:string;user:User;local?:boolean}) {
  const active = section in PAGE_OF ? section : "home";
  const page = PAGE_OF[active];
  const [entries,setEntries] = useState<Entry[]>([]);
  const entriesRef=useRef<Entry[]>([]);
  entriesRef.current=entries;
  const [profile,setProfile] = useState<ProfileData>({...EMPTY_PROFILE,email:user.email,displayName:user.displayName});
  const [notice,setNotice] = useState("");
  const [cat,setCat] = useState<string>(CATS[0][0]);
  useEffect(()=>{ fetch("/api/entries").then(r=>r.ok?r.json():null).then(v=>v?.entries&&setEntries(v.entries)).catch(()=>{}); },[]);
  // 個人資料放在最外層，Dashboard 才拿得到目標體重、身高與療程設定。
  useEffect(()=>{ fetch("/api/profile").then(r=>r.ok?r.json():null).then(v=>v?.profile&&setProfile(p=>({...p,...v.profile}))).catch(()=>{}); },[]);
  useEffect(()=>{ const saved=localStorage.getItem("catcare-cat"); if(saved&&CATS.some(x=>x[0]===saved)) setCat(saved); },[]);
  // 註冊 service worker，手機才能「加到主畫面」並在離線時看到說明頁。
  useEffect(()=>{ if("serviceWorker" in navigator) navigator.serviceWorker.register(asset("/sw.js")).catch(()=>{}); },[]);
  // iOS App：依下次施打日排本機通知（前一天 20:00 與當天 09:00）；網頁版不生效。
  useEffect(()=>{ syncInjectionReminders(entries); },[entries]);
  // iOS App：啟動時自動把 Apple 健康（含 Garmin 同步進來的）最近 7 天資料帶入。
  const [healthReady,setHealthReady]=useState(false);
  const [healthLast,setHealthLast]=useState<HealthSyncRecord|null>(()=>typeof window==="undefined"?null:readHealthLast());
  const healthSyncedOnce=useRef(false);
  useEffect(()=>{ isHealthSyncAvailable().then(setHealthReady); },[]);
  const importHealth=useCallback(async(silent:boolean)=>{
    try{
      const additions=await fetchHealthEntries(entriesRef.current);
      let working=[...entriesRef.current];
      for(const item of additions){
        const existing=working.find(e=>e.category===item.category&&e.recordedAt===item.recordedAt&&e.id>0);
        if(existing){
          const merged=mergeDayData(item.category,existing.data,item.data);
          await fetch(`/api/entries?id=${existing.id}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({data:merged})});
          working=working.map(x=>x.id===existing.id?{...x,data:merged}:x);
        }else{
          const r=await fetch("/api/entries",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(item)});
          if(r.ok){const v=await r.json();if(v.entry)working=[v.entry,...working];}
        }
      }
      if(additions.length){
        const r=await fetch("/api/entries"); if(r.ok){const v=await r.json(); if(v?.entries) setEntries(v.entries);}
      }
      if(!silent) flash(additions.length?`已從 Apple 健康帶入 ${additions.length} 筆資料 ✓`:"沒有新的健康資料");
      // 同步結果存下來，個人資料頁可以列出這次到底帶入了哪些數字
      const record:HealthSyncRecord={at:new Date().toISOString(),items:additions};
      if(additions.length||!localStorage.getItem("catcare-health-last")) localStorage.setItem("catcare-health-last",JSON.stringify(record));
      else localStorage.setItem("catcare-health-last",JSON.stringify({...JSON.parse(localStorage.getItem("catcare-health-last")!),checkedAt:record.at}));
      setHealthLast(readHealthLast());
      return additions;
    }catch{ if(!silent) flash("同步失敗，請稍後再試"); return []; }
  },[]);
  useEffect(()=>{ if(healthReady&&!healthSyncedOnce.current){ healthSyncedOnce.current=true; importHealth(true); } },[healthReady,importHealth]);
  function chooseCat(value:string){ setCat(value); localStorage.setItem("catcare-cat",value); }
  function flash(message:string){ setNotice(message); setTimeout(()=>setNotice(""),2500); }
  async function saveData(category:string,recordedAt:string,data:Data){
    // 同一天、同一類別的所有既有紀錄＋這筆新資料，統整成一筆（負數 id 是未回寫完成的草稿，不動）。
    const sameDay=entries.filter(e=>e.category===category&&e.recordedAt===recordedAt&&e.id>0)
      .sort((a,b)=>a.id-b.id);
    const existing=sameDay[0];
    const extras=sameDay.slice(1);
    const mergedData=existing
      ?[...sameDay.slice(1).map(e=>e.data),data].reduce((acc,d)=>mergeDayData(category,acc,d),existing.data)
      :data;
    const updated=existing
      ?entries.filter(x=>!extras.some(e=>e.id===x.id)).map(x=>x.id===existing.id?{...x,data:mergedData}:x)
      :[{id:draftId--,category,recordedAt,data},...entries];
    // 小貓的短反應：體重紀錄若讓里程碑往前一格就開心跳，否則揮手鼓勵一下。
    const reached=category==="body"&&milestonesDoneCount(weightSeries(updated),profile)>milestonesDoneCount(weightSeries(entries),profile);
    companionReact(reached?"success":"cheer");
    const snapshot=entries;
    setEntries(updated);
    flash(reached?"達成新的里程碑！小貓為你慶祝 ✓":existing?"已併入同一天的紀錄 ✓":"已收進今日的貓咪日記 ✓");
    try{
      const r=existing
        ?await fetch(`/api/entries?id=${existing.id}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({data:mergedData})})
        :await fetch("/api/entries",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({category,recordedAt,data})});
      // 被併掉的多餘同日紀錄從資料庫移除
      if(r.ok) for(const extra of extras) await fetch(`/api/entries?id=${extra.id}`,{method:"DELETE"}).catch(()=>{});
      if(r.ok){const v=await r.json();if(v.entry)setEntries(a=>a.map(x=>(existing?x.id===existing.id:x.id===updated[0].id)?v.entry:x));}
      else{ setEntries(snapshot); flash("尚未存進資料庫，請稍後再試一次"); }
    }catch{ setEntries(snapshot); flash("目前連不上資料庫，這筆變更已取消"); }
  }
  async function removeEntry(id:number){
    const snapshot=entries; setEntries(a=>a.filter(x=>x.id!==id)); flash("已刪除這筆紀錄");
    try{
      const r=await fetch(`/api/entries?id=${id}`,{method:"DELETE"});
      if(!r.ok){setEntries(snapshot);flash("刪除失敗，紀錄已還原");}
    }catch{ setEntries(snapshot); flash("目前連不上資料庫，刪除已取消"); }
  }
  function save(category:string,form:HTMLFormElement){
    const raw=Object.fromEntries(new FormData(form)); const recordedAt=String(raw.recordedAt||todayKey()); delete raw.recordedAt;
    const data=Object.fromEntries(Object.entries(raw).map(([k,v])=>[k,v!==""&&!Number.isNaN(Number(v))?Number(v):String(v)]));
    form.reset(); saveData(category,recordedAt,data);
  }
  const series=weightSeries(entries);
  // 陪伴小貓：沿用「我的貓咪」的選擇（selectedCompanionCat），依今日狀態決定動作。
  const companion=companionByPhoto(cat);
  const todaySummary=taskSummary(todayTasks(entries,todayKey(),nextInjection(entries,todayKey())));
  const {state:companionState,react:companionReact}=useCompanion(active,todaySummary.allDone);
  return <RemoveEntry.Provider value={removeEntry}><div className="shell"><aside>
    <Link className="brand" href="/"><b>♥</b><span>貓貓輕生活<small>CAT CARE TRACKER</small></span></Link>
    <nav>{NAV.map(([key,label,href])=><Link key={key} href={href} className={page===key?"active":""}><b>{NAV_ICONS[key]}</b>{label}</Link>)}</nav>
    <div className="aside-cat"><CompanionCat companion={companion} state={companionState} size={84}/><p>今天也有好好照顧自己嗎？</p></div>
    <p className="medical-note">僅供個人紀錄，不取代醫療建議。持續或嚴重不適請立即就醫。</p>
  </aside><main>
    <header><div><p className="eyebrow">MY PRIVATE HEALTH LOG</p><h1>{LABELS[active]}</h1></div><div className="avatar"><label className="cat-picker"><span>我的貓咪</span><select value={cat} onChange={e=>chooseCat(e.target.value)} aria-label="選擇網站貓咪圖片">{CATS.map(([src,name])=><option value={src} key={src}>{name}</option>)}</select></label><div className="account"><Link href="/profile">{profile.displayName||user.displayName}</Link>{local?<span>資料存在此裝置</span>:<SignOut label="登出"/>}</div><img src={asset(cat)} alt="目前選擇的貓咪"/></div></header>
    {SUBTABS[page]&&<div className="subtabs" role="navigation" aria-label="分頁內切換">{SUBTABS[page].map(([key,label])=><Link key={key} href={`/${key}`} className={active===key?"on":""}>{label}</Link>)}</div>}
    {notice&&<div className="toast">{notice}</div>}
    {active!=="home"&&<div className="floating-companion"><CompanionCat companion={companion} state={companionState} size={62}/></div>}
    <datalist id="brands">{[...new Set(entries.filter(e=>e.category==="food").map(e=>String(e.data.brand||"")).filter(Boolean))].map(x=><option key={x}>{x}</option>)}</datalist>
    {active==="home"&&<Dashboard entries={entries} profile={profile} series={series} companion={companion} companionState={companionState}/>}
    {active==="body"&&<Body entries={entries} profile={profile} save={save}/>} {active==="symptoms"&&<Symptoms entries={entries} save={save}/>}
    {active==="food"&&<Food entries={entries} profile={profile} save={save}/>} {active==="water"&&<Water entries={entries} save={save} saveData={saveData}/>}
    {active==="supplement"&&<Supplement entries={entries} save={save}/>} {active==="expense"&&<Expense entries={entries} save={save}/>}
    {active==="exercise"&&<Exercise entries={entries} save={save} companion={companion}/>} {active==="injection"&&<Injection entries={entries} save={save}/>}
    {active==="calendar"&&<CalendarPage entries={entries}/>} {active==="insights"&&<Insights entries={entries} profile={profile} series={series} companion={companion}/>}
    {active==="profile"&&<Profile user={user} profile={profile} setProfile={setProfile} local={local} cat={cat} chooseCat={chooseCat}
      healthSync={healthReady?<HealthSyncSection importHealth={importHealth} last={healthLast}/>:undefined}/>}
  </main></div></RemoveEntry.Provider>;
}

/* ---------- 首頁 Dashboard ---------- */
// 區塊順序＝手機版的資訊優先順序：小貓 → 目前體重 → 距離目標 → 療程進度 → 今日任務 → 趨勢。

function Dashboard({entries,profile,series,companion,companionState}:{entries:Entry[];profile:ProfileData;series:WeightPoint[];companion:Companion;companionState:CompanionState}){
  const today=todayKey();
  const goal=goalProgress(series,profile);
  const program=programProgress(profile,today);
  const injection=nextInjection(entries,today);
  const tasks=todayTasks(entries,today,injection);
  const summary=taskSummary(tasks);
  const week=trend(series,7,today);
  const month=trend(series,30,today);
  const energy=calorieTotals(entries,today);
  const water=waterTotal(entries,today);
  const bodyMass=bmi(goal.current,profile.height);
  const missing=[!goal.hasTarget&&"目標體重",!program.hasStart&&"療程開始日",!program.hasLength&&"預計療程長度"].filter(Boolean) as string[];
  return <>
    <section className="today-hero">
      <CompanionCat companion={companion} state={companionState} size={148} className="hero-cat"/>
      <div>
        <span className="sticker">{formatDate(today)} · 今天也在前進 ♡</span>
        <h2>{goal.hasWeight?<>目前 <em>{goal.current} kg</em></>:<>還沒有體重紀錄</>}</h2>
        <p>{goal.hasTarget&&goal.hasWeight?(goal.reached?"已經抵達目標體重，接下來是維持。":`距離目標還有 ${goal.remaining} kg，已完成 ${goal.percent}%。`):"到個人資料設定目標體重與療程，這頁就會開始幫你算進度。"}</p>
        <p className="today-progress">今日任務 {summary.done}／{summary.total} 完成{summary.allDone&&<b className="cheer">今天全部完成了 ✓</b>}</p>
      </div>
    </section>

    {missing.length>0&&<Link className="setup-hint" href="/profile">尚未設定：{missing.join("、")} → 前往個人資料補上，總覽的進度才算得出來</Link>}

    <section className="metrics">
      <Metric c="pink" l="目前體重" v={goal.hasWeight?`${goal.current} kg`:"—"} s={series.at(-1)?formatDate(series.at(-1)!.date)+" 紀錄":"尚無紀錄"} extra={<Arrow change={week.change} unit="kg"/>}/>
      <Metric c="lilac" l="已減少" v={goal.hasWeight&&goal.start>0?`${goal.lost} kg`:"—"} s={goal.start>0?`起始 ${goal.start} kg`:"尚未設定起始體重"}/>
      <Metric c="mint" l="距離目標" v={goal.hasTarget&&goal.hasWeight?`${Math.max(goal.remaining,0)} kg`:"—"} s={goal.hasTarget?`目標 ${goal.target} kg`:"尚未設定目標"}/>
      <Metric c="yellow" l="BMI" v={bodyMass!==null?String(bodyMass):"—"} s={bodyMass!==null?bmiLabel(bodyMass):"需要身高與體重"}/>
    </section>

    <section className="dash-two">
      <div className="card goal-card">
        <div className="card-title"><div><span>DISTANCE TO GOAL</span><h3>距離目標</h3></div><Link href="/insights">看里程碑 →</Link></div>
        {goal.hasWeight&&goal.hasTarget?<>
          <div className="goal-body">
            <Ring percent={goal.percent} note="完成度"/>
            <div className="goal-track">
              <div className="goal-rail"><i style={{width:`${goal.percent}%`}}/><b style={{left:`${goal.percent}%`}}>{goal.current}</b></div>
              <div className="goal-ends"><span>起始 {goal.start} kg</span><span>目標 {goal.target} kg</span></div>
              <div className="goal-chips"><span>已減少 {goal.lost} kg</span><span>還剩 {Math.max(goal.remaining,0)} kg</span><span>共需 {goal.totalToLose} kg</span></div>
            </div>
          </div>
        </>:<p className="empty">先記一筆體重、並在個人資料填上目標體重，這裡就會顯示起始→目前→目標的進度。</p>}
      </div>

      <div className="card program-card">
        <div className="card-title"><div><span>PROGRAM</span><h3>療程進度</h3></div><Link href="/injection">施打紀錄 →</Link></div>
        {program.hasStart?<>
          <p className="program-now">第 <em>{program.dayCount}</em> 天 · 第 <em>{program.weekCount}</em> 週</p>
          {program.hasLength&&<><div className="rail"><i style={{width:`${program.percent}%`}}/></div><p className="rail-note">{program.percent}% · 預計 {program.totalWeeks} 週（{program.totalDays} 天）</p></>}
          <dl className="program-facts">
            <div><dt>開始日</dt><dd>{formatDate(program.start)}</dd></div>
            <div><dt>預計結束</dt><dd>{program.end?formatDate(program.end):"未設定長度"}</dd></div>
            <div><dt>預估剩餘</dt><dd>{program.hasLength?`${program.daysRemaining} 天（約 ${program.weeksRemaining} 週）`:"未設定長度"}</dd></div>
            <div><dt>下次施打</dt><dd>{injection?<>{formatDate(injection.dateKey)}{injection.inferred&&<i className="inferred">依上次施打推算</i>}{injection.daysAway!==null&&<small>{injection.overdue?`已過 ${Math.abs(injection.daysAway)} 天`:injection.daysAway===0?"就是今天":`還有 ${injection.daysAway} 天`}</small>}</>:"尚未設定"}</dd></div>
          </dl>
        </>:<p className="empty">在個人資料填入療程開始日與預計長度，這裡會自動算出第幾天、第幾週與剩餘時間。</p>}
      </div>
    </section>

    <section className="dash-two">
      <div className="card task-card">
        <div className="card-title"><div><span>TODAY</span><h3>今日任務</h3></div><span className="task-count">{summary.done}／{summary.total}</span></div>
        <ul className="task-list">{tasks.map(task=><TaskRow key={task.key} task={task}/>)}</ul>
        <div className="energy-strip">
          <div><span>攝取</span><strong>{energy.intake}</strong><small>kcal</small></div>
          <div><span>消耗</span><strong>{energy.burn}</strong><small>kcal</small></div>
          <div><span>淨熱量</span><strong>{energy.net}</strong><small>kcal</small></div>
          <div><span>飲水</span><strong>{water}</strong><small>ml</small></div>
        </div>
      </div>

      <div className="card trend-card">
        <div className="card-title"><div><span>TREND</span><h3>體重趨勢</h3></div><Link href="/body">查看全部 →</Link></div>
        <div className="trend-row">
          <TrendBox title="本週變化" trend={week}/>
          <TrendBox title="最近 30 天" trend={month}/>
        </div>
        <TrendChart entries={entries} profile={profile}/>
      </div>
    </section>

    <section className="quick"><h3>快速補記</h3><div>{RECORDS.map(k=><Link href={`/${k}`} key={k}><b>{RECORD_GLYPHS[k]}</b>{LABELS[k]}<span>→</span></Link>)}</div></section>
  </>;
}

function Metric({c,l,v,s,extra}:{c:string;l:string;v:string;s:string;extra?:React.ReactNode}){return <div className={`metric ${c}`}><span>{l}</span><strong>{v}</strong><small>{s}</small>{extra}</div>}
function Ring({percent,note}:{percent:number;note:string}){
  const radius=52,circumference=2*Math.PI*radius;
  return <div className="goal-ring"><svg viewBox="0 0 120 120" role="img" aria-label={`${note} ${percent}%`}>
    <circle className="goal-ring-track" cx="60" cy="60" r={radius}/>
    <circle className="goal-ring-fill" cx="60" cy="60" r={radius} strokeDasharray={`${circumference*percent/100} ${circumference}`} transform="rotate(-90 60 60)"/>
  </svg><div><strong>{percent}%</strong><span>{note}</span></div></div>;
}
function Arrow({change,unit}:{change:number|null;unit:string}){
  if(change===null) return <em className="arrow flat">— 尚無比較</em>;
  if(change===0) return <em className="arrow flat">— 持平</em>;
  return <em className={`arrow ${change<0?"down":"up"}`}>{change<0?"▼":"▲"} {Math.abs(change)} {unit}</em>;
}
function TrendBox({title,trend:value}:{title:string;trend:ReturnType<typeof trend>}){
  return <div className="trend-box"><span>{title}</span><Arrow change={value.change} unit="kg"/><Spark points={value.points}/><small>{value.from&&value.to&&value.change!==null?`${formatDate(value.from.date)} → ${formatDate(value.to.date)}`:"需要兩筆以上的體重紀錄"}</small></div>;
}
function Spark({points}:{points:WeightPoint[]}){
  if(points.length<2) return <div className="spark-empty"/>;
  const values=points.map(p=>p.weight),min=Math.min(...values),span=Math.max(Math.max(...values)-min,0.4);
  const xy=values.map((v,i)=>`${i*100/(values.length-1)},${28-(v-min)/span*24}`);
  return <svg className="spark" viewBox="0 0 100 32" preserveAspectRatio="none" role="img" aria-label="體重走勢縮圖"><polyline points={xy.join(" ")} vectorEffect="non-scaling-stroke"/></svg>;
}
function TaskRow({task}:{task:TodayTask}){
  const mark=task.state==="done"?"✓":task.state==="todo"?"○":"–";
  return <li className={`task ${task.state}`}><Link href={task.href}><b>{mark}</b><span>{task.label}</span><small>{task.hint}</small></Link></li>;
}
const CHART_METRICS = [["weight","體重","kg"],["fat","體脂","%"],["waist","腰圍","cm"],["muscle","肌肉量","kg"]] as const;
const CHART_PERIODS = [[30,"30 天"],[90,"90 天"],[0,"全部"]] as const;

/**
 * 趨勢圖：時間等距 X 軸、期間與指標切換、目標體重虛線、施打日標記。
 * 維持手刻 SVG，不引入圖表函式庫。
 */
function TrendChart({entries,profile}:{entries:Entry[];profile:ProfileData}){
  const [metric,setMetric]=useState<typeof CHART_METRICS[number][0]>("weight");
  const [period,setPeriod]=useState<number>(30);
  const [pickedShot,setPickedShot]=useState<string|null>(null);
  const today=todayKey();
  const since=period>0?shiftDays(today,-(period-1)):"";
  const meta=CHART_METRICS.find(m=>m[0]===metric)!;
  const points=entries
    .filter(e=>e.category==="body"&&(!since||e.recordedAt>=since))
    .map(e=>({date:e.recordedAt,value:Number(e.data[metric])}))
    .filter(pt=>parseDateKey(pt.date)!==null&&pt.value>0)
    .sort((a,b)=>a.date.localeCompare(b.date));
  const shots=[...new Set(entries.filter(e=>e.category==="injection"&&(!since||e.recordedAt>=since)&&parseDateKey(e.recordedAt)!==null).map(e=>e.recordedAt))].sort();
  const controls=<div className="chart-controls">
    <div role="group" aria-label="指標">{CHART_METRICS.map(([key,label])=><button type="button" key={key} className={metric===key?"on":""} onClick={()=>setMetric(key)}>{label}</button>)}</div>
    <div role="group" aria-label="期間">{CHART_PERIODS.map(([days,label])=><button type="button" key={days} className={period===days?"on":""} onClick={()=>setPeriod(days)}>{label}</button>)}</div>
  </div>;
  if(!points.length) return <>{controls}<div className="chart empty-chart"><b>尚無{meta[1]}紀錄</b><span>{period>0?`最近 ${period} 天沒有${meta[1]}數值，換個期間或先記一筆。`:`新增身體數值後，這裡會畫出走勢。`}</span></div></>;

  const time=(key:string)=>parseDateKey(key)!.getTime();
  const t0=time(points[0].date),t1=Math.max(time(points.at(-1)!.date),shots.length?time(shots.at(-1)!):t0);
  const spanT=Math.max(t1-t0,1);
  // 左側留 44px 給 Y 軸刻度與單位
  const LEFT=44,RIGHT=282;
  const x=(key:string)=>LEFT+(time(key)-t0)/spanT*(RIGHT-LEFT);
  const values=points.map(pt=>pt.value);
  const target=metric==="weight"&&profile.targetWeight>0?profile.targetWeight:null;
  const lo=Math.min(...values,...(target!==null?[target]:[]));
  const hi=Math.max(...values,...(target!==null?[target]:[]));
  const pad=Math.max((hi-lo)*0.12,0.6);
  const min=lo-pad,spanV=Math.max(hi+pad-min,0.1);
  const y=(value:number)=>118-(value-min)/spanV*86;
  const xy=points.map(pt=>`${x(pt.date)},${y(pt.value)}`);
  // X 軸標籤：依時間等距取 4 個刻度；Y 軸三條格線各標一個帶單位的值
  const ticks=Array.from({length:4},(_,i)=>toDateKey(new Date(t0+spanT*i/3)));
  const yTicks=[118,75,32].map(gy=>({gy,value:Math.round((min+(118-gy)/86*spanV)*10)/10}));
  // 每個紀錄點標數字；相鄰太近（<22px）的略過，最後一點一定保留
  const labelled:boolean[]=[];let lastLabelX=-Infinity;
  points.forEach(pt=>{const cx=x(pt.date);const ok=cx-lastLabelX>=22;labelled.push(ok);if(ok)lastLabelX=cx;});
  if(points.length>1&&!labelled[points.length-1]){labelled[points.length-1]=true;for(let i=points.length-2;i>=0;i-=1){if(labelled[i]&&x(points.at(-1)!.date)-x(points[i].date)<22){labelled[i]=false;break;}}}
  const showLabel=(i:number)=>labelled[i];
  // 最左／最右的數字改成靠邊對齊，才不會撞到 Y 軸刻度或超出右緣
  const anchorOf=(cx:number)=>cx-LEFT<12?"start":RIGHT-cx<12?"end":"middle";
  const shotDose=(date:string)=>{const row=entries.find(e=>e.category==="injection"&&e.recordedAt===date&&e.data.dose!==undefined&&e.data.dose!=="");return row?formatDose(row.data.dose):"未填劑量"};
  return <>{controls}<div className="chart trend-chart">
    <svg viewBox="0 0 300 145" role="img" aria-label={`${meta[1]}變化折線圖`}>
      <path d={`M${LEFT} 32H${RIGHT}M${LEFT} 75H${RIGHT}M${LEFT} 118H${RIGHT}`}/>
      {yTicks.map(tick=><text key={tick.gy} className="axis-label" x={LEFT-5} y={tick.gy+3} textAnchor="end">{tick.value} {meta[2]}</text>)}
      {target!==null&&<g className="target-line"><line x1={LEFT} x2={RIGHT} y1={y(target)} y2={y(target)}/><text x={RIGHT-1} y={y(target)-4} textAnchor="end">目標 {target} {meta[2]}</text></g>}
      <polyline points={xy.join(" ")}/>
      {points.map((pt,i)=>{const [cx,cy]=xy[i].split(",");return <g key={pt.date+i}><circle cx={cx} cy={cy} r={points.length>20?2.6:4}/>{showLabel(i)&&<text className="point-label" x={cx} y={Number(cy)-8} textAnchor={anchorOf(Number(cx))}>{pt.value}</text>}</g>})}
      {shots.map(date=><circle key={date} className={`shot-dot${pickedShot===date?" on":""}`} cx={x(date)} cy="136" r="4" role="button" aria-label={`${formatDate(date)} 施打`} onClick={()=>setPickedShot(pickedShot===date?null:date)}/>)}
    </svg>
    <div className="chart-ticks" style={{paddingLeft:"13%"}}>{ticks.map((tick,i)=><span key={i}>{tick.slice(5)}</span>)}</div>
    {shots.length>0&&<p className="shot-note">{pickedShot?<>💉 {formatDate(pickedShot)} 施打 {shotDose(pickedShot)}</>:"下緣圓點是施打日，點一下看當天劑量"}</p>}
  </div></>;
}

/* ---------- 月曆與歷史紀錄 ---------- */

function CalendarPage({entries}:{entries:Entry[]}){
  const today=todayKey();
  const [cursor,setCursor]=useState(()=>{const now=new Date();return {year:now.getFullYear(),month:now.getMonth()}});
  const [picked,setPicked]=useState(today);
  const weeks=useMemo(()=>monthMatrix(cursor.year,cursor.month),[cursor]);
  const summaries=useMemo(()=>new Map(weeks.flat().filter(Boolean).map(key=>[key,dayTotals(entries,key)])),[weeks,entries]);
  const detail=entries.filter(e=>e.recordedAt===picked);
  function move(delta:number){ setCursor(c=>{const shifted=new Date(c.year,c.month+delta,1);return {year:shifted.getFullYear(),month:shifted.getMonth()}}); }
  return <>
    <section className="page-panel calendar-panel"><div className="panel-copy"><p className="eyebrow">HISTORY</p><h2>月曆紀錄</h2><p>每一天記了什麼，一眼就看得到。點選日期看當天的完整紀錄。</p></div>
      <div className="calendar">
        <div className="calendar-head"><button type="button" onClick={()=>move(-1)} aria-label="上一個月">‹</button><b>{cursor.year} 年 {cursor.month+1} 月</b><button type="button" onClick={()=>move(1)} aria-label="下一個月">›</button></div>
        <div className="calendar-grid">
          {WEEKDAYS.map(day=><span className="calendar-weekday" key={day}>{day}</span>)}
          {weeks.flat().map((key,index)=>{
            if(!key) return <span className="calendar-cell blank" key={`blank-${index}`}/>;
            const totals=summaries.get(key)!;
            const logged=Object.keys(totals.counts);
            return <button type="button" key={key} onClick={()=>setPicked(key)} className={`calendar-cell${key===today?" today":""}${key===picked?" picked":""}${logged.length?" logged":""}`}>
              <b>{Number(key.slice(8))}</b>
              {totals.weight!==null&&<small>{totals.weight}</small>}
              <i>{RECORDS.filter(category=>logged.includes(category)).map(category=><u key={category} className={`dot ${category}`}/>)}</i>
            </button>;
          })}
        </div>
      </div>
    </section>
    <section className="history day-detail"><h3>{formatDate(picked)} 的紀錄</h3>
      {detail.length?[...detail].sort((a,b)=>RECORDS.indexOf(a.category as Record0)-RECORDS.indexOf(b.category as Record0)).map(entry=><div key={entry.id}>
        <time>{LABELS[entry.category]}</time>
        <p>{summarize(entry).map((text,i)=><span key={i}>{text}</span>)}{entry.data.source==="healthkit"&&<em className="source-tag">Apple 健康</em>}</p>
        <DeleteEntry entry={entry}/>
      </div>):<p className="empty">這天還沒有紀錄。</p>}
    </section>
  </>;
}

/* ---------- 週統計單項長條圖 ---------- */

const WEEKLY_METRICS = [
  ["avgWeight","平均體重","kg"],["change","體重變化","kg"],["intake","攝取熱量","kcal"],["burn","消耗熱量","kcal"],
  ["minutes","運動時間","分"],["water","飲水量","ml"],["spend","花費","NT$"],["days","有紀錄天數","天"],
] as const;
type WeeklyKey = typeof WEEKLY_METRICS[number][0];

/** 一次只看一項數值：八週長條圖，每根標數值，負值（體重下降）以綠色往下長。 */
function WeeklyBars({weeks,metric}:{weeks:ReturnType<typeof weekStats>;metric:WeeklyKey}){
  const meta=WEEKLY_METRICS.find(m=>m[0]===metric)!;
  const values=weeks.map(week=>week[metric] as number|null);
  const present=values.filter((v):v is number=>v!==null);
  if(!present.length) return <div className="chart empty-chart"><b>尚無{meta[1]}資料</b><span>這八週還沒有可以畫的紀錄。</span></div>;
  // 平均體重從 0 起算會讓八根長條幾乎一樣高，改用略低於最小值的基準線放大差異；
  // 體重變化有正負以 0 為基準；其餘合計型數值從 0 起算。
  const base=metric==="avgWeight"?Math.floor(Math.min(...present))-1:Math.min(0,...present);
  const hi=metric==="avgWeight"?Math.max(...present):Math.max(0,...present),lo=base;
  const span=Math.max(hi-lo,metric==="change"?0.5:1);
  const top=Math.round((lo+span)*10)/10;
  const TOP=26,BOTTOM=124,LEFT=44,RIGHT=308;
  const y=(v:number)=>BOTTOM-(v-lo)/span*(BOTTOM-TOP);
  const zero=y(Math.max(0,base));
  const slot=(RIGHT-LEFT)/weeks.length,barW=Math.min(slot*0.56,26);
  const fmt=(v:number)=>metric==="spend"?v.toLocaleString():metric==="change"&&v>0?`+${v}`:String(v);
  return <div className="chart weekly-bars"><svg viewBox="0 0 320 150" role="img" aria-label={`${meta[1]}八週長條圖`}>
    <path d={`M${LEFT} ${TOP}H${RIGHT}M${LEFT} ${zero}H${RIGHT}`}/>
    <text className="axis-label" x={LEFT-5} y={TOP+3} textAnchor="end">{top} {meta[2]}</text>
    <text className="axis-label" x={LEFT-5} y={zero+3} textAnchor="end">{Math.max(0,base)} {meta[2]}</text>
    {lo<0&&<text className="axis-label" x={LEFT-5} y={BOTTOM+3} textAnchor="end">{Math.round(lo*10)/10} {meta[2]}</text>}
    {weeks.map((week,i)=>{
      const v=values[i];const cx=LEFT+slot*i+slot/2;
      if(v===null) return <text key={week.start} className="bar-label muted" x={cx} y={zero-6} textAnchor="middle">—</text>;
      const top=Math.min(y(v),zero),h=Math.max(Math.abs(y(v)-zero),1.5);
      const good=metric==="change"?v<0:true;
      return <g key={week.start}>
        <rect className={`bar${metric==="change"?(good?" down":" up"):""}`} x={cx-barW/2} y={top} width={barW} height={h} rx="4"/>
        <text className="bar-label" x={cx} y={v>=0?top-5:top+h+10} textAnchor="middle">{fmt(v)}</text>
      </g>;
    })}
    {weeks.map((week,i)=><text key={week.start} className="axis-label" x={LEFT+slot*i+slot/2} y="143" textAnchor="middle">{week.start.slice(5)}</text>)}
  </svg><p className="rail-note">每根長條是一週（標示該週起始日），數字為該週{metric==="avgWeight"?"平均":metric==="change"?"首尾差":"合計"}。</p></div>;
}

/* ---------- 統計與里程碑 ---------- */

function Insights({entries,profile,series,companion}:{entries:Entry[];profile:ProfileData;series:WeightPoint[];companion:Companion}){
  const today=todayKey();
  const goal=goalProgress(series,profile);
  const weeks=weekStats(entries,today,8);
  const symptoms=symptomStats(entries);
  const marks=milestones(goal);
  const spend=expenseStats(entries,today,goal.lost);
  const [weeklyView,setWeeklyView]=useState("table");
  return <>
    <section className="page-panel insight-panel"><div className="panel-copy"><p className="eyebrow">INSIGHTS</p><h2>統計與目標</h2><p>把每天的紀錄整理成週趨勢與里程碑，看見自己走過的距離。</p></div>
      <div className="insight-summary">
        <div><span>起始體重</span><strong>{goal.start>0?`${goal.start} kg`:"—"}</strong></div>
        <div><span>目前體重</span><strong>{goal.hasWeight?`${goal.current} kg`:"—"}</strong></div>
        <div><span>目標體重</span><strong>{goal.hasTarget?`${goal.target} kg`:"—"}</strong></div>
        <div><span>完成度</span><strong>{goal.hasTarget&&goal.hasWeight?`${goal.percent}%`:"—"}</strong></div>
      </div>
    </section>

    <div className="card"><div className="card-title"><div><span>WEEKLY</span><h3>最近 8 週統計</h3></div>
        <label className="weekly-select"><span>檢視</span><select value={weeklyView} onChange={e=>setWeeklyView(e.target.value)} aria-label="選擇統計檢視">
          <option value="table">統整表</option>
          {WEEKLY_METRICS.map(([key,label])=><option key={key} value={key}>{label}</option>)}
        </select></label></div>
      {weeklyView!=="table"?<WeeklyBars weeks={weeks} metric={weeklyView as WeeklyKey}/>
      :<div className="table-scroll"><table className="stat-table">
        <thead><tr><th>週別</th><th>平均體重</th><th>體重變化</th><th>攝取</th><th>消耗</th><th>運動</th><th>飲水</th><th>花費</th><th>有紀錄</th></tr></thead>
        <tbody>{weeks.map(week=><tr key={week.start}>
          <td>{week.label}</td>
          <td>{week.avgWeight!==null?`${week.avgWeight} kg`:"—"}</td>
          <td className={week.change===null?"":week.change<0?"down":week.change>0?"up":""}>{week.change!==null?`${week.change>0?"+":""}${week.change} kg`:"—"}</td>
          <td>{week.intake} kcal</td><td>{week.burn} kcal</td><td>{week.minutes} 分</td><td>{week.water} ml</td><td>{week.spend?`NT$ ${week.spend.toLocaleString()}`:"—"}</td><td>{week.days} 天</td>
        </tr>)}</tbody>
      </table></div>}
    </div>

    <div className="card"><div className="card-title"><div><span>EXPENSES</span><h3>開銷摘要</h3></div><Link href="/expense">前往紀錄 →</Link></div>
      {spend.total>0?<div className="energy-strip expense-strip">
        <div><span>累計總花費</span><strong>{spend.total.toLocaleString()}</strong><small>NT$</small></div>
        <div><span>本月花費</span><strong>{spend.thisMonth.toLocaleString()}</strong><small>NT$</small></div>
        <div><span>平均每週</span><strong>{spend.weeklyAverage.toLocaleString()}</strong><small>NT$</small></div>
        {spend.perKgLost!==null&&<div><span>平均每減 1 kg</span><strong>{spend.perKgLost.toLocaleString()}</strong><small>NT$</small></div>}
      </div>:<p className="empty">還沒有開銷紀錄。到療程紀錄的「開銷」子頁把藥費、掛號費記下來，這裡會幫你算總帳。</p>}
    </div>

    <ShareCard goal={goal} program={programProgress(profile,today)} marksDone={marks.filter(m=>m.done).length} companion={companion}/>

    <section className="dash-two">
      <div className="card"><div className="card-title"><div><span>MILESTONES</span><h3>目標與里程碑</h3></div></div>
        {marks.length?<ul className="milestones">{marks.map(mark=><li key={mark.key} className={mark.done?"done":""}><b>{mark.done?"✓":"○"}</b><span>{mark.label}</span><small>{mark.detail}</small></li>)}</ul>
          :<p className="empty">記錄第一筆體重、並設定目標體重之後，這裡會列出可以慶祝的里程碑。</p>}
      </div>
      <div className="card"><div className="card-title"><div><span>SYMPTOMS</span><h3>生理狀況統計</h3></div><Link href="/symptoms">前往紀錄 →</Link></div>
        {symptoms.length?<ul className="symptom-stats">{symptoms.slice(0,8).map(item=><li key={item.name}><span>{item.name}</span><i style={{width:`${Math.min(item.count/symptoms[0].count*100,100)}%`}}/><small>{item.count} 次 · 平均 {item.average}/10</small></li>)}</ul>
          :<p className="empty">還沒有生理狀況紀錄。</p>}
      </div>
    </section>
    <div className="alert soft">統計只是個人紀錄的整理，不能用來判讀病情或調整劑量，有疑問請與醫療人員討論。</div>
  </>;
}

/* ---------- Apple 健康同步（iOS App 限定） ---------- */

type HealthSyncRecord={at:string;checkedAt?:string;items:HealthImport[]};
function readHealthLast():HealthSyncRecord|null{
  try{ const raw=localStorage.getItem("catcare-health-last"); return raw?JSON.parse(raw) as HealthSyncRecord:null; }catch{ return null; }
}
const healthItemText=(item:HealthImport)=>{
  const d=item.data;
  if(item.category==="body"){
    const parts=[d.weight!==undefined&&`體重 ${d.weight} kg`,d.fat!==undefined&&`體脂 ${d.fat} %`,d.muscle!==undefined&&`瘦體重 ${d.muscle} kg`].filter(Boolean);
    return `${parts.join("、")}（${d.machine||"Apple 健康"}）`;
  }
  return `${d.activity} ${d.minutes} 分鐘、${d.calories} kcal`;
};
const timeText=(iso:string)=>{const t=new Date(iso);return Number.isNaN(t.getTime())?"":`${formatDate(toDateKey(t))} ${String(t.getHours()).padStart(2,"0")}:${String(t.getMinutes()).padStart(2,"0")}`};

function HealthSyncSection({importHealth,last}:{importHealth:(silent:boolean)=>Promise<HealthImport[]>;last:HealthSyncRecord|null}){
  const [busy,setBusy]=useState(false),[message,setMessage]=useState("");
  const [justNow,setJustNow]=useState<HealthImport[]|null>(null);
  async function run(afterConnect:boolean){
    setBusy(true);setMessage("");
    if(afterConnect){ const ok=await connectAppleHealth(); if(!ok){ setMessage("無法連結 Apple 健康"); setBusy(false); return; } }
    const added=await importHealth(false);
    setJustNow(added);
    setMessage(added.length?`這次帶入 ${added.length} 筆，已寫進對應的紀錄`:"最近 7 天沒有新的資料可帶入");
    setBusy(false);
  }
  async function openSettings(){ try{ const {Health}=await import("capacitor-health"); await Health.openAppleHealthSettings(); }catch{/* 非原生環境 */} }
  const shown=justNow??last?.items??[];
  const when=justNow?"本次":last?`上次（${timeText(last.at)}）`:"";
  return <>
    <h3>健康資料同步</h3>
    <p className="profile-note">從 Apple「健康」帶入體重、體脂、瘦體重與運動（Garmin Connect 同步進健康的資料也包含在內）。帶入的數字會直接寫進當天的「身體數值」和「運動」紀錄，並標記來源；不會蓋掉你手動輸入的資料。</p>
    <div className="health-sync-actions">
      <button type="button" className="primary" onClick={()=>run(true)} disabled={busy}>{busy?"處理中…":"連結 Apple 健康"}</button>
      <button type="button" onClick={()=>run(false)} disabled={busy}>立即同步</button>
      {message&&<span>{message}</span>}
    </div>
    <div className="health-sync-result">
      {shown.length?<>
        <p className="field-heading">{when}帶入的數字</p>
        <ul>{shown.map((item,i)=><li key={`${item.category}-${item.recordedAt}-${i}`}><time>{formatDate(item.recordedAt)}</time><b>{item.category==="body"?"身體數值":"運動"}</b><span>{healthItemText(item)}</span></li>)}</ul>
        <p className="profile-note">到 <Link href="/body">身體數值</Link>、<Link href="/exercise">運動</Link> 頁可看到這些紀錄，列上會標示「Apple 健康」。</p>
      </>:<p className="profile-note">{last?`上次檢查：${timeText(last.checkedAt??last.at)}，`:""}還沒有從 Apple 健康帶入任何數字。若已連結卻沒有資料，請確認「健康」App 裡最近 7 天有體重或運動紀錄，並在權限設定裡允許讀取。<button type="button" className="link-button" onClick={openSettings}>打開權限設定</button></p>}
    </div>
  </>;
}

/* ---------- 成果分享卡 ---------- */

function ShareCard({goal,program,marksDone,companion}:{goal:GoalProgress;program:ProgramProgress;marksDone:number;companion:Companion}){
  const [busy,setBusy]=useState(false),[message,setMessage]=useState("");
  const ready=goal.hasWeight&&goal.start>0;
  async function draw():Promise<Blob>{
    const canvas=document.createElement("canvas");canvas.width=1080;canvas.height=1350;
    const ctx=canvas.getContext("2d")!;
    const grad=ctx.createLinearGradient(0,0,1080,1350);
    grad.addColorStop(0,"#f7e8ee");grad.addColorStop(1,"#f0eafd");
    ctx.fillStyle=grad;ctx.fillRect(0,0,1080,1350);
    ctx.fillStyle="#ffffff";
    ctx.beginPath();ctx.roundRect(70,90,940,1170,48);ctx.fill();
    const font=(size:number,weight=800)=>`${weight} ${size}px "Noto Sans TC","PingFang TC",sans-serif`;
    ctx.fillStyle="#b28593";ctx.font=font(30,900);ctx.textAlign="left";
    ctx.fillText("CAT CARE TRACKER",130,190);
    ctx.fillStyle="#3d3a46";ctx.font=font(64,900);
    ctx.fillText("貓貓輕生活・減重紀錄",130,270);
    ctx.fillStyle="#b85f79";ctx.font=font(170,900);
    ctx.fillText(`-${goal.lost} kg`,130,480);
    ctx.fillStyle="#6e6873";ctx.font=font(46,700);
    ctx.fillText(`${goal.start} kg  →  ${goal.current} kg`,130,570);
    const facts:[string,string][]=[];
    if(goal.hasTarget) facts.push(["目標完成度",`${goal.percent}%`]);
    if(program.hasStart) facts.push(["療程進度",`第 ${program.weekCount} 週`]);
    if(marksDone>0) facts.push(["達成里程碑",`${marksDone} 個`]);
    facts.forEach(([label,value],index)=>{
      const y=690+index*120;
      ctx.fillStyle="#faf7f9";
      ctx.beginPath();ctx.roundRect(130,y-70,500,100,24);ctx.fill();
      ctx.fillStyle="#928b96";ctx.font=font(32,700);ctx.fillText(label,160,y-18);
      ctx.fillStyle="#3d3a46";ctx.font=font(46,900);ctx.textAlign="right";ctx.fillText(value,600,y-14);ctx.textAlign="left";
    });
    try{
      const img=new Image();img.src=poseSrc(companion,"cheer");
      await img.decode();
      const height=560,width=img.naturalWidth*height/img.naturalHeight;
      ctx.drawImage(img,1010-width,1180-height,width,height);
    }catch{/* 貓圖載不到就出純文字卡 */}
    ctx.fillStyle="#a49daa";ctx.font=font(30,700);
    ctx.fillText(`貓貓輕生活 · ${formatDate(todayKey())}`,130,1200);
    return await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error("blob")),"image/png"));
  }
  async function share(){
    if(busy) return;
    setBusy(true);setMessage("");
    try{
      const blob=await draw();
      const file=new File([blob],"catcare-progress.png",{type:"image/png"});
      // iOS 等支援 Web Share 的環境走系統分享面板，桌面瀏覽器直接下載
      if(typeof navigator.canShare==="function"&&navigator.canShare({files:[file]})){
        await navigator.share({files:[file]});
      }else{
        const url=URL.createObjectURL(blob);
        const a=document.createElement("a");a.href=url;a.download="catcare-progress.png";a.click();
        setTimeout(()=>URL.revokeObjectURL(url),3000);
      }
      setMessage("成果卡已產生 ✓");
    }catch(error){ if((error as Error).name!=="AbortError") setMessage("產生失敗，請再試一次"); }
    setBusy(false);setTimeout(()=>setMessage(""),3000);
  }
  return <div className="card share-card"><div className="card-title"><div><span>SHARE</span><h3>成果卡片</h3></div></div>
    {ready?<><p className="rail-note">把目前的成果做成一張 1080×1350 的分享圖，附上你的陪伴小貓。</p>
      <div className="share-actions"><button type="button" className="primary" onClick={share} disabled={busy}>{busy?"產生中…":"產生成果卡"}</button>{message&&<span>{message}</span>}</div></>
      :<p className="empty">先記一筆體重，成果卡才有數據可以畫。</p>}
  </div>;
}

/* ---------- 個人資料 ---------- */

function Profile({user,profile,setProfile,local,cat,chooseCat,healthSync}:{user:User;profile:ProfileData;setProfile:(value:ProfileData)=>void;local:boolean;cat:string;chooseCat:(value:string)=>void;healthSync?:React.ReactNode}){
  const [message,setMessage]=useState("");
  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();
    const response=await fetch("/api/profile",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(profile)});
    if(response.ok){const value=await response.json();setProfile({...profile,...value.profile});setMessage("個人資料已儲存 ✓");}else setMessage("儲存失敗，請稍後再試");
    setTimeout(()=>setMessage(""),2500);
  }
  const set=(patch:Partial<ProfileData>)=>setProfile({...profile,...patch});
  return <section className="profile-page"><div className="profile-intro"><span>PRIVATE PROFILE</span><h2>只屬於你的健康後台</h2><p>{local?"這個版本把紀錄存在你目前這台裝置的瀏覽器裡，不會上傳。清除瀏覽器資料或換一台裝置就看不到了。":"登入後只會看到自己建立的紀錄。"}這裡設定的目標與療程資訊，會直接決定總覽頁的進度計算。</p><div className="identity"><b>{profile.displayName||user.displayName}</b><small>{local?"本機儲存":user.email}</small></div></div>
    <form className="profile-form" onSubmit={submit}>
      <h3>基本資料</h3>
      {!local&&<label><span>登入信箱</span><input value={user.email} readOnly/></label>}
      <label><span>顯示名稱</span><input value={profile.displayName} onChange={e=>set({displayName:e.target.value})}/></label>
      <label><span>生日</span><input type="date" value={profile.birthday} onChange={e=>set({birthday:e.target.value})}/></label>
      <label><span>生理性別</span><select value={profile.sex} onChange={e=>set({sex:e.target.value})}><option value="">未設定</option><option value="female">女性</option><option value="male">男性</option><option value="other">其他／不透露</option></select></label>
      <label><span>身高 (cm)</span><input type="number" min="0" step="0.1" value={profile.height||""} onChange={e=>set({height:Number(e.target.value)})}/></label>
      <h3>目標設定</h3>
      <label><span>初始體重 (kg)</span><input type="number" min="0" step="0.1" value={profile.startWeight||""} placeholder="留空則用第一筆身體數值" onChange={e=>set({startWeight:Number(e.target.value)})}/></label>
      <label><span>目標體重 (kg)</span><input type="number" min="0" step="0.1" value={profile.targetWeight||""} onChange={e=>set({targetWeight:Number(e.target.value)})}/></label>
      <label><span>每日熱量目標 (kcal)</span><input type="number" min="0" value={profile.calorieGoal||""} onChange={e=>set({calorieGoal:Number(e.target.value)})}/></label>
      <h3>陪伴小貓</h3>
      <div className="companion-picker">
        {COMPANIONS.map(option=><button type="button" key={option.id} className={companionByPhoto(cat).id===option.id?"picked":""} onClick={()=>chooseCat(option.photo)} aria-label={`選擇 ${option.name} 當陪伴小貓`} aria-pressed={companionByPhoto(cat).id===option.id}>
          <CompanionCat companion={option} state="idle" size={72}/><span>{option.name}</span>
        </button>)}
      </div>
      <p className="profile-note">選擇的小貓會出現在總覽頁陪你，完成紀錄時也會有小小的反應。</p>
      {healthSync}
      <h3>療程設定</h3>
      <label><span>療程開始日</span><input type="date" value={profile.programStart} onChange={e=>set({programStart:e.target.value})}/></label>
      <label><span>預計療程長度 (週)</span><input type="number" min="0" value={profile.programWeeks||""} onChange={e=>set({programWeeks:Number(e.target.value)})}/></label>
      <p className="profile-note">療程長度或目標改動後，總覽頁的天數、週數、剩餘時間與完成百分比都會重新計算。</p>
      <div className="profile-actions"><button className="primary" type="submit">儲存個人資料</button>{!local&&<SignOut label="登出帳號"/>}{message&&<span>{message}</span>}</div>
    </form>
  </section>;
}

/* ---------- 各項紀錄頁 ---------- */

function Panel({title,sub,img,figure,children}:{title:string;sub:string;img?:string;figure?:React.ReactNode;children:React.ReactNode}){return <section className="page-panel"><div className="panel-copy"><p className="eyebrow">DAILY LOG</p><h2>{title}</h2><p>{sub}</p></div>{figure??(img&&<img src={asset(img)} alt="貓咪水彩插畫"/>)}{children}</section>}
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
const summarize=(entry:Entry)=>entry.category==="symptoms"?symptomSummary([entry]):describeEntry(entry);
function DeleteEntry({entry}:{entry:Entry}){
  const remove=useContext(RemoveEntry);
  const label=`${LABELS[entry.category]??"這"} ${entry.recordedAt}`;
  return <button type="button" className="row-delete" aria-label={`刪除 ${label} 的紀錄`}
    onClick={()=>{if(window.confirm(`確定要刪除 ${label} 這筆紀錄嗎？刪除後無法復原。`)) remove(entry.id)}}>刪除</button>;
}
function History({entries,cat}:{entries:Entry[];cat:string}){
  const rows=entries.filter(e=>e.category===cat).slice(0,8);
  return <section className="history"><h3>最近紀錄</h3>
    {rows.length?rows.map(e=><div key={e.id}><time>{e.recordedAt}</time><p>{summarize(e).map((v,i)=><span key={i}>{v}</span>)}{e.data.source==="healthkit"&&<em className="source-tag">Apple 健康</em>}</p><DeleteEntry entry={e}/></div>)
      :<p className="empty">還沒有紀錄，從今天開始吧。</p>}
  </section>;
}
function Form({cat,save,children}:{cat:string;save:Save;children:React.ReactNode}){return <form onSubmit={(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();save(cat,e.currentTarget)}}>{children}{cat==="food"&&<Field label="品牌" name="brand"><input name="brand" list="brands" placeholder="例：桂格、義美、品牌自填"/></Field>}<Submit/></form>}

function Body({entries,profile,save}:{entries:Entry[];profile:ProfileData;save:Save}){const machines=[...new Set(entries.filter(e=>e.category==="body").map(e=>String(e.data.machine)).filter(Boolean))];return <><Panel title="身體數值" sub="每一個小數字，都是你認真生活的證據。" img="/cat-tabby.jpg"><Form cat="body" save={save}><Field label="日期" name="recordedAt" type="date"/><Field label="體重 (kg)" name="weight" step="0.1"/><Field label="體脂 (%)" name="fat" step="0.1"/><Field label="腰圍 (cm)" name="waist" step="0.1"/><Field label="胸圍 (cm)" name="chest" step="0.1"/><Field label="肌肉量 (kg)" name="muscle" step="0.1"/><Field label="測量機器" name="machine"><><input name="machine" list="machines" placeholder="例：InBody 270"/><datalist id="machines">{machines.map(x=><option key={x}>{x}</option>)}</datalist></></Field></Form></Panel><div className="card wide-chart"><div className="card-title"><div><span>PROGRESS</span><h3>身體趨勢</h3></div><Link href="/insights">統計分析 →</Link></div><TrendChart entries={entries} profile={profile}/></div><History entries={entries} cat="body"/></>}

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
function Symptoms({entries,save}:{entries:Entry[];save:Save}){return <><Panel title="每日生理狀況" sub="溫柔觀察身體的訊號，需要時就向醫療人員求助。" img="/cat-white.jpg"><Form cat="symptoms" save={save}><Field label="日期" name="recordedAt" type="date"/><SymptomFields entries={entries}/><Field label="備註" name="notes"><input name="notes" placeholder="何時發生、持續多久…"/></Field></Form></Panel><div className="alert">若有持續劇烈腹痛、無法進食飲水、意識改變等情形，請立即聯繫醫療人員或急診。</div><History entries={entries} cat="symptoms"/></>}

function Food({entries,profile,save}:{entries:Entry[];profile:ProfileData;save:Save}){
  const [db,setDb]=useState<FoodDb|null>(null),[dbFailed,setDbFailed]=useState(false);
  const [name,setName]=useState(""),[picked,setPicked]=useState<FoodRow|null>(null),[amount,setAmount]=useState(100),[manualKcal,setManualKcal]=useState("");
  // 資料庫有 200KB，只有進到飲食頁才載入，其他頁面不受影響。
  useEffect(()=>{fetch(asset("/food-nutrition.json")).then(r=>r.ok?r.json():Promise.reject(new Error("no data"))).then((value:FoodDb)=>setDb(value)).catch(()=>setDbFailed(true));},[]);
  const matches=useMemo(()=>picked?[]:searchFoods(db,name),[db,name,picked]);
  const scaled=picked?scaleFood(picked,amount):null;
  const today=todayKey(),energy=calorieTotals(entries,today),nutrition=nutritionTotals(entries,today);
  const goalKcal=profile.calorieGoal,used=goalKcal>0?Math.min(energy.intake/goalKcal*100,100):0;
  function submit(category:string,form:HTMLFormElement){save(category,form);setName("");setPicked(null);setAmount(100);setManualKcal("");}
  return <>
    <Panel title="飲食與攝取熱量" sub="輸入食物名稱會搜尋食藥署的營養成分資料，選定後依份量自動換算。" img="/cat-calico.jpg">
      <Form cat="food" save={submit}>
        <Field label="日期" name="recordedAt" type="date"/>
        <Field label="食物" name="food"><input name="food" value={name} onChange={e=>{setName(e.target.value);setPicked(null)}} placeholder="例：白飯、甘藷、鯖魚" autoComplete="off"/></Field>
        <Field label="份量 (g)" name="amount"><input name="amount" type="number" min="0" value={amount} onChange={e=>setAmount(Number(e.target.value))}/></Field>
        <Field label="熱量 (kcal)" name="calories">{scaled
          ?<input name="calories" type="number" value={scaled.kcal??0} readOnly/>
          :<input name="calories" type="number" value={manualKcal} onChange={e=>setManualKcal(e.target.value)} placeholder="找不到資料時自行填寫"/>}</Field>
        {matches.length>0&&<div className="food-results">
          <p>食藥署食品營養成分資料庫</p>
          {matches.map(row=><button type="button" key={`${row.name}-${row.category}`} onClick={()=>{setPicked(row);setName(row.name)}}>
            <b>{row.name}</b><small>{row.category}</small><span>{row.kcal??"—"} kcal/100g</span>
          </button>)}
        </div>}
        {picked&&scaled&&<div className="picked-food">
          <p><b>{picked.name}</b><small>{picked.category}</small>{picked.alias&&<em>{picked.alias}</em>}</p>
          <div className="nutrient-grid">
            <div><span>熱量</span><strong>{scaled.kcal??"—"}</strong><small>kcal</small></div>
            {NUTRIENT_KEYS.map(key=><div key={key}><span>{NUTRIENT_LABELS[key].label}</span><strong>{scaled[key]??"—"}</strong><small>{scaled[key]==null?"未提供":NUTRIENT_LABELS[key].unit}</small></div>)}
          </div>
          {NUTRIENT_KEYS.map(key=>scaled[key]==null?null:<input key={key} type="hidden" name={key} value={scaled[key] as number}/>)}
        </div>}
        {!db&&!dbFailed&&<p className="food-note">正在載入食藥署食品營養資料…</p>}
        {dbFailed&&<p className="food-note">食品營養資料載入失敗，仍然可以自己填寫熱量。</p>}
      </Form>
    </Panel>
    <div className="card"><div className="card-title"><div><span>TODAY</span><h3>今日營養分析</h3></div><Link href="/exercise">運動消耗 →</Link></div>
      <div className="energy-strip">
        <div><span>攝取</span><strong>{energy.intake}</strong><small>kcal</small></div>
        <div><span>消耗</span><strong>{energy.burn}</strong><small>kcal</small></div>
        <div><span>淨熱量</span><strong>{energy.net}</strong><small>kcal</small></div>
        <div><span>每日目標</span><strong>{goalKcal||"—"}</strong><small>{goalKcal?"kcal":"未設定"}</small></div>
      </div>
      {goalKcal>0
        ?<><div className="rail"><i style={{width:`${used}%`}}/></div><p className="rail-note">{energy.intake} / {goalKcal} kcal · {energy.intake<=goalKcal?`還有 ${goalKcal-energy.intake} kcal 額度`:`超出 ${energy.intake-goalKcal} kcal`}</p></>
        :<p className="rail-note">到個人資料設定每日熱量目標，這裡會顯示剩餘額度。</p>}
      <div className="nutrient-grid wide">{NUTRIENT_KEYS.map(key=><div key={key}><span>{NUTRIENT_LABELS[key].label}</span><strong>{nutrition[key]}</strong><small>{NUTRIENT_LABELS[key].unit}</small></div>)}</div>
      <p className="rail-note">{nutrition.foods
        ?`今日 ${nutrition.foods} 筆飲食紀錄，其中 ${nutrition.withMacros} 筆帶有營養素資料。${nutrition.foods>nutrition.withMacros?"手動填寫或原始資料未分析的項目不會計入營養素合計。":""}`
        :"今天還沒有飲食紀錄。"}</p>
    </div>
    <p className="source-note">營養數值來自衛生福利部食品藥物管理署「食品營養成分資料集」{db?.updated?`（資料更新日 ${db.updated}）`:""}，採政府資料開放授權條款第 1 版。數值為每 100 克可食部的分析結果，實際品項會因品牌、產地與烹調方式而有差異。</p>
    <History entries={entries} cat="food"/></>;
}

function Water({entries,save,saveData}:{entries:Entry[];save:Save;saveData:SaveData}){
  const today=todayKey(),total=waterTotal(entries,today);
  return <><Panel title="飲水紀錄" sub="小口小口地喝，身體會比你先察覺變化。" img="/cat-box.jpg"><Form cat="water" save={save}><Field label="日期" name="recordedAt" type="date"/><Field label="飲水量 (ml)" name="amount"/><Field label="種類" name="kind"><select name="kind">{DRINKS.map(x=><option key={x}>{x}</option>)}</select></Field></Form></Panel>
    <div className="card water-card"><div className="card-title"><div><span>TODAY</span><h3>今日飲水 {total} ml</h3></div></div>
      <div className="quick-water">{QUICK_WATER.map(ml=><button type="button" key={ml} onClick={()=>saveData("water",today,{amount:ml,kind:DRINKS[0]})}>＋{ml} ml</button>)}</div>
      <p className="rail-note">快速按鈕會直接記成今天的白開水，需要記其他種類請用上方表單。</p>
    </div>
    <History entries={entries} cat="water"/></>;
}

function Expense({entries,save}:{entries:Entry[];save:Save}){
  const old=entries.filter(e=>e.category==="expense");
  const items=[...new Set([...["週纖達 Wegovy","猛健樂 Mounjaro","回診掛號費","營養品"],...old.map(e=>String(e.data.item)).filter(Boolean)])];
  return <><Panel title="開銷紀錄" sub="療程的每一筆花費都記下來，統計頁會幫你算總帳。" img="/cat-tabby.jpg"><Form cat="expense" save={save}><Field label="日期" name="recordedAt" type="date"/><Field label="品項" name="item"><><input name="item" list="expense-items" placeholder="例：週纖達 Wegovy"/><datalist id="expense-items">{items.map(x=><option key={x}>{x}</option>)}</datalist></></Field><Field label="金額 (NT$)" name="amount"><input name="amount" type="number" min="0" step="1" placeholder="整數金額"/></Field><Field label="數量" name="qty"><input name="qty" placeholder="例：1 支、2 盒"/></Field><Field label="備註" name="notes"><input name="notes" placeholder="藥局、醫院…"/></Field></Form></Panel><History entries={entries} cat="expense"/></>}

function Supplement({entries,save}:{entries:Entry[];save:Save}){
  const old=entries.filter(e=>e.category==="supplement");
  const names=[...new Set(old.map(e=>String(e.data.name)).filter(Boolean))];
  const doses=[...new Set(old.map(e=>String(e.data.dose)).filter(Boolean))];
  return <><Panel title="營養補充" sub="維他命、蛋白粉或醫師建議的補充品，吃了就順手記一筆。" img="/cat-orange.jpg"><Form cat="supplement" save={save}><Field label="日期" name="recordedAt" type="date"/><Field label="品名" name="name"><><input name="name" list="supplement-names" placeholder="例：綜合維他命、乳清蛋白"/><datalist id="supplement-names">{names.map(x=><option key={x}>{x}</option>)}</datalist></></Field><Field label="劑量／數量" name="dose"><><input name="dose" list="supplement-doses" placeholder="例：1 顆、20 g"/><datalist id="supplement-doses">{doses.map(x=><option key={x}>{x}</option>)}</datalist></></Field><Field label="備註" name="notes"><input name="notes" placeholder="飯後、睡前…"/></Field></Form></Panel><div className="alert soft">補充品與處方藥的交互作用請先與醫療人員或藥師確認，本站僅做個人紀錄。</div><History entries={entries} cat="supplement"/></>}

function Injection({entries,save}:{entries:Entry[];save:Save}){
  const old=entries.filter(e=>e.category==="injection"),meds=[...new Set(old.map(e=>String(e.data.medicine)).filter(Boolean))];
  const rotation=siteRotation(entries),stats=injectionStats(entries);
  const [medicine,setMedicine]=useState(""),[doseMg,setDoseMg]=useState(""),[pickedSite,setPickedSite]=useState<string|null>(null);
  // 沒手動選過就跟著建議走；新增紀錄後建議部位重算，預選自動跟上。
  const site=pickedSite??rotation.suggested;
  const presets=dosePresets(medicine||meds[0]||"");
  const sameAsLast=rotation.last!==null&&site===rotation.last.site;
  function submit(category:string,form:HTMLFormElement){save(category,form);setDoseMg("");setPickedSite(null);}
  return <><Panel title="施打紀錄與提醒" sub="記下醫療人員已指示的用藥資訊，並輪替施打位置。" img="/cat-orange.jpg"><Form cat="injection" save={submit}>
    {rotation.last&&<p className="rotation-hint">上次打在 <b>{rotation.last.site}</b>（{formatDate(rotation.last.date)}），這次建議打 <b>{rotation.suggested}</b></p>}
    <Field label="施打日期" name="recordedAt" type="date"/>
    <Field label="藥品" name="medicine"><><input name="medicine" list="meds" value={medicine} onChange={e=>setMedicine(e.target.value)} placeholder="例：週纖達 Wegovy"/><datalist id="meds">{[...new Set(["週纖達 Wegovy","猛健樂 Mounjaro",...meds])].map(x=><option key={x}>{x}</option>)}</datalist></></Field>
    <Field label="施打劑量 (mg)" name="dose"><><input name="dose" type="number" min="0" step="0.05" value={doseMg} onChange={e=>setDoseMg(e.target.value)} placeholder="依醫囑輸入"/>
      {presets.length>0&&<div className="dose-quick">{presets.map(mg=><button type="button" key={mg} className={Number(doseMg)===mg?"picked":""} onClick={()=>setDoseMg(String(mg))}>{mg}</button>)}</div>}</></Field>
    <Field label="施打部位" name="site"><><select name="site" value={site} onChange={e=>setPickedSite(e.target.value)}>{INJECTION_SITES.map(x=><option key={x}>{x}</option>)}</select>
      {sameAsLast&&<p className="site-warning">與上次相同部位，可能造成皮下硬塊</p>}</></Field>
    <Field label="下次提醒" name="next" type="datetime-local"/>
  </Form></Panel>
  <div className="alert soft">劑量調整只能依處方醫療人員指示，本站不會建議或自動變更劑量。</div>
  <div className="card injection-history"><div className="card-title"><div><span>HISTORY</span><h3>注射歷史</h3></div></div>
    {stats.total?<>
      <div className="energy-strip">
        <div><span>總施打次數</span><strong>{stats.total}</strong><small>次</small></div>
        <div><span>目前連續</span><strong>{stats.streakWeeks}</strong><small>週</small></div>
        <div><span>最常用部位</span><strong className="site-name">{stats.topSite??"—"}</strong><small>&nbsp;</small></div>
      </div>
      <div className="table-scroll"><table className="stat-table">
        <thead><tr><th>日期</th><th>藥品</th><th>劑量</th><th>部位</th><th>與上一針間隔</th><th></th></tr></thead>
        <tbody>{stats.rows.map(row=>{const entry=entries.find(e=>e.id===row.id);return <tr key={row.id}>
          <td>{row.date}</td><td>{row.medicine}</td><td>{row.dose}</td><td>{row.site}</td>
          <td className={row.gapDays===null?"":row.gapDays===7?"gap-ok":"gap-off"}>{row.gapDays===null?"第一針":`${row.gapDays} 天`}</td>
          <td>{entry&&<DeleteEntry entry={entry}/>}</td>
        </tr>})}</tbody>
      </table></div>
    </>:<p className="empty">還沒有施打紀錄，從第一針開始記吧。</p>}
  </div></>}
function Exercise({entries,save,companion}:{entries:Entry[];save:Save;companion:Companion}){
  const [calories,setCalories]=useState(""),[bmr,setBmr]=useState("");
  // 當日總消耗＝基礎代謝＋消耗熱量，自動加總不用另外輸入
  const tdee=(Number(calories)||0)+(Number(bmr)||0);
  function submit(category:string,form:HTMLFormElement){save(category,form);setCalories("");setBmr("");}
  return <><Panel title="運動與每日消耗" sub="不求快，只求穩穩地把活動放進生活。小貓也一起原地踏步。" figure={<CompanionCat companion={companion} state="exercise" size={230} className="panel-cat"/>}><Form cat="exercise" save={submit}><Field label="日期" name="recordedAt" type="date"/><Field label="運動項目" name="activity"><input name="activity" placeholder="例：快走、重訓"/></Field><Field label="時間 (分鐘)" name="minutes"/><Field label="消耗熱量 (kcal)" name="calories"><input name="calories" type="number" min="0" value={calories} onChange={e=>setCalories(e.target.value)}/></Field><Field label="基礎代謝 BMR (kcal)" name="bmr"><input name="bmr" type="number" min="0" value={bmr} onChange={e=>setBmr(e.target.value)}/></Field><Field label="當日總消耗 TDEE (kcal)" name="tdee"><input name="tdee" type="number" value={tdee||""} readOnly placeholder="自動加總"/></Field></Form></Panel><History entries={entries} cat="exercise"/></>}
