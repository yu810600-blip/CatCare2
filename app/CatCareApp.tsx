"use client";

import Link from "next/link";
import { createContext, FormEvent, useContext, useEffect, useMemo, useState } from "react";
import {
  bmi, bmiLabel, calorieTotals, dayTotals, EMPTY_PROFILE, formatDate, goalProgress, milestones,
  monthMatrix, nextInjection, programProgress, symptomStats, taskSummary, todayKey,
  todayTasks, trend, waterTotal, weekStats, weightSeries,
  nutritionTotals, describeEntry,
  type Data, type Entry, type ProfileData, type TodayTask, type WeightPoint,
} from "./health";
import { NUTRIENT_KEYS, NUTRIENT_LABELS, scaleFood, searchFoods, type FoodDb, type FoodRow } from "./food-db";
import { asset } from "./asset";
import { CompanionCat, COMPANIONS, companionByPhoto, milestonesDoneCount, useCompanion, type Companion, type CompanionState } from "./companion";

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
  symptoms: "生理狀況", calendar: "月曆紀錄", insights: "統計與目標", profile: "個人資料",
};
const NAV = [
  ["home", "健康總覽", "/"], ["daily", "每日紀錄", "/body"], ["care", "療程紀錄", "/injection"],
  ["review", "歷史統計", "/calendar"], ["profile", "個人資料", "/profile"],
] as const;
// section → 所屬分頁（決定導覽的 active 樣式與顯示哪組子頁籤）
const PAGE_OF: Record<string, string> = {
  home: "home", body: "daily", food: "daily", water: "daily", supplement: "daily", exercise: "daily",
  injection: "care", symptoms: "care", calendar: "review", insights: "review", profile: "profile",
};
const SUBTABS: Record<string, readonly (readonly [string, string])[]> = {
  daily: [["body", "身體數值"], ["food", "飲食"], ["water", "飲水"], ["supplement", "營養品"], ["exercise", "運動"]],
  care: [["injection", "施打"], ["symptoms", "生理狀況"]],
  review: [["calendar", "月曆"], ["insights", "統計與目標"]],
};
const NAV_ICONS: Record<string, React.ReactNode> = {
  home: <svg viewBox="0 0 24 24"><path d="M3.5 10.8 12 3.6l8.5 7.2"/><path d="M5.5 9.5V20a1 1 0 0 0 1 1H9.8v-5.6a2.2 2.2 0 0 1 4.4 0V21h3.3a1 1 0 0 0 1-1V9.5"/></svg>,
  daily: <svg viewBox="0 0 24 24"><path d="M16.8 3.7 20.3 7.2 8.5 19 4.4 19.9 5.3 15.8Z"/><path d="M14.3 6.2l3.5 3.5"/><path d="M12 21h8.5"/></svg>,
  care: <svg viewBox="0 0 24 24"><path d="M12 20.4C7.7 16.6 4 13.7 4 10.2 4 7.8 5.8 6 8.1 6c1.5 0 2.9.8 3.9 2.2C13 6.8 14.4 6 15.9 6 18.2 6 20 7.8 20 10.2c0 3.5-3.7 6.4-8 10.2Z"/><path d="M7.6 11.6h2.5l1.2-2.3 1.6 4 1.2-2.3h2.3"/></svg>,
  review: <svg viewBox="0 0 24 24"><path d="M4.5 20.5h15"/><path d="M6.5 20V11.5"/><path d="M12 20V4.5"/><path d="M17.5 20v-6"/></svg>,
  profile: <svg viewBox="0 0 24 24"><circle cx="12" cy="8.2" r="3.9"/><path d="M4.6 20.6c.8-3.6 3.8-5.6 7.4-5.6s6.6 2 7.4 5.6"/></svg>,
};
const RECORDS = ["body", "symptoms", "food", "water", "supplement", "exercise", "injection"] as const;
type Record0 = typeof RECORDS[number];
const RECORD_GLYPHS: Record<Record0, string> = { body: "◌", symptoms: "♡", food: "◇", water: "◒", supplement: "✽", exercise: "△", injection: "+" };
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
  const [profile,setProfile] = useState<ProfileData>({...EMPTY_PROFILE,email:user.email,displayName:user.displayName});
  const [notice,setNotice] = useState("");
  const [cat,setCat] = useState<string>(CATS[0][0]);
  useEffect(()=>{ fetch("/api/entries").then(r=>r.ok?r.json():null).then(v=>v?.entries&&setEntries(v.entries)).catch(()=>{}); },[]);
  // 個人資料放在最外層，Dashboard 才拿得到目標體重、身高與療程設定。
  useEffect(()=>{ fetch("/api/profile").then(r=>r.ok?r.json():null).then(v=>v?.profile&&setProfile(p=>({...p,...v.profile}))).catch(()=>{}); },[]);
  useEffect(()=>{ const saved=localStorage.getItem("catcare-cat"); if(saved&&CATS.some(x=>x[0]===saved)) setCat(saved); },[]);
  // 註冊 service worker，手機才能「加到主畫面」並在離線時看到說明頁。
  useEffect(()=>{ if("serviceWorker" in navigator) navigator.serviceWorker.register(asset("/sw.js")).catch(()=>{}); },[]);
  function chooseCat(value:string){ setCat(value); localStorage.setItem("catcare-cat",value); }
  function flash(message:string){ setNotice(message); setTimeout(()=>setNotice(""),2500); }
  async function saveData(category:string,recordedAt:string,data:Data){
    const draft={id:draftId--,category,recordedAt,data};
    // 小貓的短反應：體重紀錄若讓里程碑往前一格就開心跳，否則揮手鼓勵一下。
    const reached=category==="body"&&milestonesDoneCount(weightSeries([draft,...entries]),profile)>milestonesDoneCount(weightSeries(entries),profile);
    companionReact(reached?"success":"cheer");
    setEntries(a=>[draft,...a]); flash(reached?"達成新的里程碑！小貓為你慶祝 ✓":"已收進今日的貓咪日記 ✓");
    try{
      const r=await fetch("/api/entries",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({category,recordedAt,data})});
      if(r.ok){const v=await r.json();setEntries(a=>a.map(x=>x.id===draft.id?v.entry:x));}
      else flash("尚未存進資料庫，請稍後再試一次");
    }catch{ flash("目前連不上資料庫，紀錄只留在這個畫面"); }
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
    {active==="body"&&<Body entries={entries} series={series} save={save}/>} {active==="symptoms"&&<Symptoms entries={entries} save={save}/>}
    {active==="food"&&<Food entries={entries} profile={profile} save={save}/>} {active==="water"&&<Water entries={entries} save={save} saveData={saveData}/>}
    {active==="supplement"&&<Supplement entries={entries} save={save}/>}
    {active==="exercise"&&<Exercise entries={entries} save={save} companion={companion}/>} {active==="injection"&&<Injection entries={entries} save={save}/>}
    {active==="calendar"&&<CalendarPage entries={entries}/>} {active==="insights"&&<Insights entries={entries} profile={profile} series={series}/>}
    {active==="profile"&&<Profile user={user} profile={profile} setProfile={setProfile} local={local} cat={cat} chooseCat={chooseCat}/>}
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
        <Chart points={series}/>
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
function Chart({points}:{points:WeightPoint[]}){
  if(!points.length) return <div className="chart empty-chart"><b>尚無體重紀錄</b><span>新增第一筆身體數值後，這裡會畫出走勢。</span></div>;
  const shown=points.slice(-10),values=shown.map(p=>p.weight);
  const min=Math.min(...values)-.8,span=Math.max(Math.max(...values)+.8-min,.1);
  const xy=values.map((v,i)=>`${18+i*264/Math.max(shown.length-1,1)},${118-(v-min)/span*86}`);
  return <div className="chart"><svg viewBox="0 0 300 145" role="img" aria-label="體重變化折線圖"><path d="M18 32H282M18 75H282M18 118H282"/><polyline points={xy.join(" ")}/>{xy.map((point,i)=>{const [x,y]=point.split(",");return <circle key={i} cx={x} cy={y} r="4"/>})}</svg><div>{shown.map((point,i)=><span key={`${point.date}-${i}`}>{point.date.slice(5)}</span>)}</div></div>;
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
        <p>{summarize(entry).map((text,i)=><span key={i}>{text}</span>)}</p>
        <DeleteEntry entry={entry}/>
      </div>):<p className="empty">這天還沒有紀錄。</p>}
    </section>
  </>;
}

/* ---------- 統計與里程碑 ---------- */

function Insights({entries,profile,series}:{entries:Entry[];profile:ProfileData;series:WeightPoint[]}){
  const today=todayKey();
  const goal=goalProgress(series,profile);
  const weeks=weekStats(entries,today,8);
  const symptoms=symptomStats(entries);
  const marks=milestones(goal);
  return <>
    <section className="page-panel insight-panel"><div className="panel-copy"><p className="eyebrow">INSIGHTS</p><h2>統計與目標</h2><p>把每天的紀錄整理成週趨勢與里程碑，看見自己走過的距離。</p></div>
      <div className="insight-summary">
        <div><span>起始體重</span><strong>{goal.start>0?`${goal.start} kg`:"—"}</strong></div>
        <div><span>目前體重</span><strong>{goal.hasWeight?`${goal.current} kg`:"—"}</strong></div>
        <div><span>目標體重</span><strong>{goal.hasTarget?`${goal.target} kg`:"—"}</strong></div>
        <div><span>完成度</span><strong>{goal.hasTarget&&goal.hasWeight?`${goal.percent}%`:"—"}</strong></div>
      </div>
    </section>

    <div className="card"><div className="card-title"><div><span>WEEKLY</span><h3>最近 8 週統計</h3></div></div>
      <div className="table-scroll"><table className="stat-table">
        <thead><tr><th>週別</th><th>平均體重</th><th>體重變化</th><th>攝取</th><th>消耗</th><th>運動</th><th>飲水</th><th>有紀錄</th></tr></thead>
        <tbody>{weeks.map(week=><tr key={week.start}>
          <td>{week.label}</td>
          <td>{week.avgWeight!==null?`${week.avgWeight} kg`:"—"}</td>
          <td className={week.change===null?"":week.change<0?"down":week.change>0?"up":""}>{week.change!==null?`${week.change>0?"+":""}${week.change} kg`:"—"}</td>
          <td>{week.intake} kcal</td><td>{week.burn} kcal</td><td>{week.minutes} 分</td><td>{week.water} ml</td><td>{week.days} 天</td>
        </tr>)}</tbody>
      </table></div>
    </div>

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

/* ---------- 個人資料 ---------- */

function Profile({user,profile,setProfile,local,cat,chooseCat}:{user:User;profile:ProfileData;setProfile:(value:ProfileData)=>void;local:boolean;cat:string;chooseCat:(value:string)=>void}){
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
    {rows.length?rows.map(e=><div key={e.id}><time>{e.recordedAt}</time><p>{summarize(e).map((v,i)=><span key={i}>{v}</span>)}</p><DeleteEntry entry={e}/></div>)
      :<p className="empty">還沒有紀錄，從今天開始吧。</p>}
  </section>;
}
function Form({cat,save,children}:{cat:string;save:Save;children:React.ReactNode}){return <form onSubmit={(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();save(cat,e.currentTarget)}}>{children}{cat==="food"&&<Field label="品牌" name="brand"><input name="brand" list="brands" placeholder="例：桂格、義美、品牌自填"/></Field>}<Submit/></form>}

function Body({entries,series,save}:{entries:Entry[];series:WeightPoint[];save:Save}){const machines=[...new Set(entries.filter(e=>e.category==="body").map(e=>String(e.data.machine)).filter(Boolean))];return <><Panel title="身體數值" sub="每一個小數字，都是你認真生活的證據。" img="/cat-tabby.jpg"><Form cat="body" save={save}><Field label="日期" name="recordedAt" type="date"/><Field label="體重 (kg)" name="weight" step="0.1"/><Field label="體脂 (%)" name="fat" step="0.1"/><Field label="腰圍 (cm)" name="waist" step="0.1"/><Field label="胸圍 (cm)" name="chest" step="0.1"/><Field label="肌肉量 (kg)" name="muscle" step="0.1"/><Field label="測量機器" name="machine"><><input name="machine" list="machines" placeholder="例：InBody 270"/><datalist id="machines">{machines.map(x=><option key={x}>{x}</option>)}</datalist></></Field></Form></Panel><div className="card wide-chart"><div className="card-title"><div><span>PROGRESS</span><h3>體重趨勢</h3></div><Link href="/insights">統計分析 →</Link></div><Chart points={series}/></div><History entries={entries} cat="body"/></>}

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

function Supplement({entries,save}:{entries:Entry[];save:Save}){
  const old=entries.filter(e=>e.category==="supplement");
  const names=[...new Set(old.map(e=>String(e.data.name)).filter(Boolean))];
  const doses=[...new Set(old.map(e=>String(e.data.dose)).filter(Boolean))];
  return <><Panel title="營養補充" sub="維他命、蛋白粉或醫師建議的補充品，吃了就順手記一筆。" img="/cat-orange.jpg"><Form cat="supplement" save={save}><Field label="日期" name="recordedAt" type="date"/><Field label="品名" name="name"><><input name="name" list="supplement-names" placeholder="例：綜合維他命、乳清蛋白"/><datalist id="supplement-names">{names.map(x=><option key={x}>{x}</option>)}</datalist></></Field><Field label="劑量／數量" name="dose"><><input name="dose" list="supplement-doses" placeholder="例：1 顆、20 g"/><datalist id="supplement-doses">{doses.map(x=><option key={x}>{x}</option>)}</datalist></></Field><Field label="備註" name="notes"><input name="notes" placeholder="飯後、睡前…"/></Field></Form></Panel><div className="alert soft">補充品與處方藥的交互作用請先與醫療人員或藥師確認，本站僅做個人紀錄。</div><History entries={entries} cat="supplement"/></>}

function Injection({entries,save}:{entries:Entry[];save:Save}){const old=entries.filter(e=>e.category==="injection"),meds=[...new Set(old.map(e=>String(e.data.medicine)))],doses=[...new Set(old.map(e=>String(e.data.dose)))];return <><Panel title="施打紀錄與提醒" sub="記下醫療人員已指示的用藥資訊，並輪替施打位置。" img="/cat-orange.jpg"><Form cat="injection" save={save}><Field label="施打日期" name="recordedAt" type="date"/><Field label="藥品" name="medicine"><><input name="medicine" list="meds" placeholder="例：週纖達 Wegovy"/><datalist id="meds">{[...new Set(["週纖達 Wegovy","猛健樂 Mounjaro",...meds])].map(x=><option key={x}>{x}</option>)}</datalist></></Field><Field label="施打劑量" name="dose"><><input name="dose" list="doses" placeholder="依醫囑輸入"/><datalist id="doses">{doses.map(x=><option key={x}>{x}</option>)}</datalist></></Field><Field label="施打部位" name="site"><select name="site"><option>右下腹</option><option>左下腹</option><option>右大腿前側</option><option>左大腿前側</option><option>右上臂</option><option>左上臂</option></select></Field><Field label="下次提醒" name="next" type="datetime-local"/></Form></Panel><div className="alert soft">劑量調整只能依處方醫療人員指示，本站不會建議或自動變更劑量。</div><History entries={entries} cat="injection"/></>}
function Exercise({entries,save,companion}:{entries:Entry[];save:Save;companion:Companion}){return <><Panel title="運動與每日消耗" sub="不求快，只求穩穩地把活動放進生活。小貓也一起原地踏步。" figure={<CompanionCat companion={companion} state="exercise" size={230} className="panel-cat"/>}><Form cat="exercise" save={save}><Field label="日期" name="recordedAt" type="date"/><Field label="運動項目" name="activity"><input name="activity" placeholder="例：快走、重訓"/></Field><Field label="時間 (分鐘)" name="minutes"/><Field label="消耗熱量 (kcal)" name="calories"/><Field label="基礎代謝 BMR (kcal)" name="bmr"/><Field label="當日總消耗 TDEE (kcal)" name="tdee"/></Form></Panel><History entries={entries} cat="exercise"/></>}
