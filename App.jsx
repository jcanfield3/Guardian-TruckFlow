import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient";

async function sharedGet(key) {
  try {
    const { data, error } = await supabase
      .from("shared_storage")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    if (error) throw error;
    return data ? data.value : null;
  } catch {
    return null;
  }
}

async function sharedSet(key, val) {
  try {
    const { error } = await supabase
      .from("shared_storage")
      .upsert({ key, value: val, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) throw error;
  } catch (e) {
    console.error("sharedSet failed:", e);
  }
}

// ── Personal storage — private to this operator/browser, never shared ────────
async function personalGet(key) {
  try {
    if (window.storage && typeof window.storage.get === "function") {
      const r = await window.storage.get(key, false);
      return r ? JSON.parse(r.value) : null;
    }
  } catch {}
  try {
    const v = localStorage.getItem(STORAGE_PREFIX + "personal_" + key);
    return v ? JSON.parse(v) : null;
  } catch { return null; }
}

async function personalSet(key, val) {
  try {
    if (window.storage && typeof window.storage.set === "function") {
      await window.storage.set(key, JSON.stringify(val), false);
      return;
    }
  } catch {}
  try {
    localStorage.setItem(STORAGE_PREFIX + "personal_" + key, JSON.stringify(val));
  } catch {}
}
function getDeviceId() {
  try {
    let id = localStorage.getItem("tfbeta_device_id");
    if (!id) {
      id = "dev_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
      localStorage.setItem("tfbeta_device_id", id);
    }
    return id;
  } catch {
    return "dev_unknown";
  }
}
// ── Theme ────────────────────────────────────────────────────────────────────
const C = {
  bg:"#080F0C", surface:"#0F1A14", card:"#131E17", border:"#1E3028",
  green:"#00C853", greenDim:"#00843A",
  text:"#E8F5EE", muted:"#5A7A68", accent:"#C8A84B",
  red:"#EF4444", yellow:"#F59E0B", blue:"#3B82F6", cyan:"#06B6D4",
  orange:"#F97316",
};

const DUMP_TYPES    = ["Standard Dump","End Dump","Side Dump","Belly Dump"];
const FLATBED_TYPES = ["Flatbed","Step Deck","Lowboy","RGN","Double Drop","Conestoga","Hotshot"];
const CONTAINER_TYPES = ["20ft Container","40ft Container","40ft HC Container","45ft Container","Triaxle Container"];
const DUMP_PRICING  = ["Per Ton","Per Hour","Per Load (Flat Rate)"];
const BROKER_TIERS  = {
  PREFERRED:{color:"#00C853",label:"Preferred"},
  STANDARD: {color:"#3B82F6",label:"Standard"},
  CAUTION:  {color:"#F59E0B",label:"Caution"},
  AVOID:    {color:"#EF4444",label:"Avoid"},
};
const DEFAULT_ZONES = [
  {zone:"Zone 1",miles:"0-25",   baseRate:175},
  {zone:"Zone 2",miles:"26-50",  baseRate:225},
  {zone:"Zone 3",miles:"51-75",  baseRate:275},
  {zone:"Zone 4",miles:"76-100", baseRate:325},
  {zone:"Zone 5",miles:"101-125",baseRate:375},
  {zone:"Zone 6",miles:"126-150",baseRate:425},
  {zone:"Zone 7",miles:"151-175",baseRate:475},
  {zone:"Zone 8",miles:"176-200",baseRate:525},
];

const isDump      = eq => DUMP_TYPES.includes(eq);
const isContainer = eq => CONTAINER_TYPES.includes(eq);
const fmt$ = n => isNaN(n) ? "$0.00" : "$"+Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,",");
const fmtN = (n,d=2) => isNaN(n) ? "0" : Number(n).toFixed(d);
const uid  = () => Date.now().toString(36)+Math.random().toString(36).slice(2,6);

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@400;500&family=Inter:wght@300;400;500;600;700&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  body{background:#080F0C;color:#E8F5EE;font-family:'Inter',sans-serif;min-height:100vh;overflow-x:hidden;}
  ::-webkit-scrollbar{width:3px;} ::-webkit-scrollbar-track{background:#0F1A14;}
  ::-webkit-scrollbar-thumb{background:#00843A;}
  input,select,textarea{background:#0F1A14;border:1px solid #1E3028;color:#E8F5EE;
    padding:10px 14px;border-radius:8px;font-family:'Inter',sans-serif;font-size:13px;width:100%;outline:none;transition:border-color .15s;}
  input:focus,select:focus,textarea:focus{border-color:#00C853;}
  select option{background:#0F1A14;}
  button{cursor:pointer;font-family:'Inter',sans-serif;}
  .mono{font-family:'DM Mono',monospace;}
  .bebas{font-family:'Bebas Neue',sans-serif;letter-spacing:1px;}
  .fade{animation:fadeIn .25s ease;}
  @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
`;

// ── UI primitives ─────────────────────────────────────────────────────────────
const Btn = ({children,onClick,variant="primary",small,full,disabled,style={}}) => {
  const base={border:"none",borderRadius:8,fontWeight:600,cursor:disabled?"not-allowed":"pointer",
    padding:small?"7px 16px":"12px 24px",fontSize:small?12:13,width:full?"100%":"auto",
    transition:"all .15s",opacity:disabled?.5:1,...style};
  const vars={
    primary:{background:C.green,color:"#000"},
    secondary:{background:"transparent",border:`1px solid ${C.border}`,color:C.text},
    danger:{background:"transparent",border:`1px solid ${C.red}`,color:C.red},
    blue:{background:C.blue,color:"#fff"},
    orange:{background:C.orange,color:"#000"},
  };
  return <button style={{...base,...vars[variant]}} onClick={disabled?null:onClick}>{children}</button>;
};

const Card=({children,style={}})=>(
  <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:20,...style}}>{children}</div>
);

const Field=({label,children,style={}})=>(
  <div style={{marginBottom:16,...style}}>
    <div style={{fontSize:11,color:C.muted,textTransform:"uppercase",letterSpacing:1,marginBottom:6,fontWeight:600}}>{label}</div>
    {children}
  </div>
);

const Badge=({text,color})=>(
  <span style={{background:`${color}22`,border:`1px solid ${color}44`,color,
    padding:"2px 10px",borderRadius:20,fontSize:11,fontWeight:600}}>{text}</span>
);

const Pill=({label,active,color,onClick})=>(
  <button onClick={onClick} style={{padding:"6px 16px",borderRadius:20,
    border:`1px solid ${active?color:C.border}`,background:active?`${color}22`:"transparent",
    color:active?color:C.muted,fontSize:12,fontWeight:600,cursor:"pointer",transition:"all .15s"}}>
    {label}
  </button>
);

const Spinner=()=>(
  <div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:40}}>
    <div style={{width:32,height:32,border:`3px solid ${C.border}`,borderTopColor:C.green,
      borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>
);

// ── ONBOARDING ────────────────────────────────────────────────────────────────
function Onboarding({onComplete}) {
  const [name,setName] = useState("");
  const [equipment,setEquipment] = useState("Flatbed");
  const [homeBase,setHomeBase] = useState("");
  const [years,setYears] = useState("");

  function submit() {
  if(!name.trim()) return;
  onComplete({name:name.trim(), equipment, homeBase, years, id:uid(), deviceId:getDeviceId(), joined:new Date().toLocaleDateString()});
}

  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",
      background:C.bg,padding:24}}>
      <style>{css}</style>
      <Card style={{maxWidth:480,width:"100%",border:`1px solid ${C.green}`}} className="fade">
        <div style={{textAlign:"center",marginBottom:28}}>
          <div className="bebas" style={{fontSize:44,color:C.green,lineHeight:1}}>TruckFlow</div>
          <div style={{fontSize:11,color:C.muted,letterSpacing:2,marginBottom:4}}>BY GUARDIAN HOLDINGS LLC</div>
          <div style={{display:"inline-block",padding:"3px 12px",background:`${C.accent}22`,
            border:`1px solid ${C.accent}44`,borderRadius:20,fontSize:11,color:C.accent,fontWeight:700,marginBottom:16}}>
            BETA — Owner Operator Preview
          </div>
          <p style={{fontSize:13,color:C.muted,lineHeight:1.7}}>
            Welcome. No account required. Tell us a little about your operation so TruckFlow can tailor its profitability scoring to your equipment and lanes.
          </p>
        </div>

        <Field label="Your Name or Nickname">
          <input placeholder="e.g. JD, Mike S., Iron Mike..." value={name} onChange={e=>setName(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&submit()}/>
        </Field>

        <Field label="Primary Equipment">
          <select value={equipment} onChange={e=>setEquipment(e.target.value)}>
            <optgroup label="Flatbed / Step Deck">
              {FLATBED_TYPES.map(t=><option key={t}>{t}</option>)}
            </optgroup>
            <optgroup label="Dump Truck">
              {DUMP_TYPES.map(t=><option key={t}>{t}</option>)}
            </optgroup>
            <optgroup label="Container / Drayage">
              {CONTAINER_TYPES.map(t=><option key={t}>{t}</option>)}
            </optgroup>
          </select>
        </Field>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Field label="Home Base (City, State)">
            <input placeholder="Minneapolis, MN" value={homeBase} onChange={e=>setHomeBase(e.target.value)}/>
          </Field>
          <Field label="Years Driving">
            <input type="number" placeholder="10" value={years} onChange={e=>setYears(e.target.value)}/>
          </Field>
        </div>

        <div style={{marginBottom:20,padding:12,background:C.surface,borderRadius:8,fontSize:12,color:C.muted,lineHeight:1.7}}>
          📊 Your load data and broker ratings contribute to the shared TruckFlow intelligence database, making the platform smarter for every operator who uses it. No personal information is sold or shared.
        </div>

        <Btn full onClick={submit} disabled={!name.trim()}>Enter TruckFlow →</Btn>

        <div style={{textAlign:"center",marginTop:16,fontSize:11,color:C.muted}}>
          Built by a CDL-A veteran with 30 years in trucking.<br/>
          Guardian Holdings LLC · St. Paul, MN
        </div>
      </Card>
    </div>
  );
}

// ── QUICK CHECK ───────────────────────────────────────────────────────────────
function QuickCheck({operator, brokers, onSaveLoad}) {
  const [mode,setMode]           = useState(isDump(operator.equipment)?"dump":isContainer(operator.equipment)?"container":"flatbed");
  const [scoreMode,setScoreMode] = useState("standard");
  const [eq,setEq]               = useState(operator.equipment||"Flatbed");
  const [dumpType,setDumpType]   = useState(DUMP_TYPES.includes(operator.equipment)?operator.equipment:"Standard Dump");
  const [containerType,setContainerType] = useState(CONTAINER_TYPES.includes(operator.equipment)?operator.equipment:"40ft Container");
  const [broker,setBroker]       = useState("");
  const [result,setResult]       = useState(null);
  const [saved,setSaved]         = useState(false);

  const [fb,setFb] = useState({rate:"",loaded:"",deadhead:"",fuel:"",tolls:"",lumper:"",detention:"",hours:""});
  const setF=(k,v)=>setFb(p=>({...p,[k]:v}));

  const [db,setDb] = useState({tons:"",ratePerTon:"",hours:"",ratePerHour:"",flatRate:"",trips:"1",
    fuelPerTrip:"",distanceMiles:"",fuelCost:"",tolls:"",waitTime:"",waitRate:"75",materialType:"",jobSite:""});
  const setD=(k,v)=>setDb(p=>({...p,[k]:v}));

  const [cb,setCb] = useState({railyard:"",destination:"",zone:"Zone 1",zoneRate:"175",overrideRate:"",
    miles:"",fuel:"",tolls:"",chassis:"",detentionHrs:"",detentionRate:"65",
    prePull:"",storage:"",hazmat:"",overweight:"",hours:""});
  const setCf=(k,v)=>setCb(p=>({...p,[k]:v}));

  const brokerInfo = brokers.find(b=>b.name===broker);

  function onZoneChange(z) {
    const zd=DEFAULT_ZONES.find(x=>x.zone===z);
    setCf("zone",z);
    if(zd) setCf("zoneRate",String(zd.baseRate));
  }

  function calcFlatbed() {
    const rate=parseFloat(fb.rate)||0,loaded=parseFloat(fb.loaded)||0,dead=parseFloat(fb.deadhead)||0;
    const fuel=parseFloat(fb.fuel)||0,tolls=parseFloat(fb.tolls)||0,lumper=parseFloat(fb.lumper)||0;
    const hours=parseFloat(fb.hours)||0;
    const totalCost=fuel+tolls+lumper,profit=rate-totalCost;
    const rpm=loaded>0?rate/loaded:0,ppm=loaded>0?profit/loaded:0,pph=hours>0?profit/hours:0;
    const deadPct=(loaded+dead)>0?(dead/(loaded+dead))*100:0;
    let score,color;
    if(rpm>=2.00&&profit>0){score="TAKE";color=C.green;}
    else if(rpm>=1.40&&profit>0){score="REVIEW";color=C.yellow;}
    else{score="PASS";color=C.red;}
    return {rate,loaded,dead,fuel,tolls,lumper,profit,rpm,ppm,pph,deadPct,totalCost,score,color,type:"flatbed",equipment:eq};
  }

  function calcDump() {
    let grossRevenue=0,fuelTotal=0;
    const trips=parseFloat(db.trips)||1;
    const fuelPerTrip=parseFloat(db.fuelPerTrip)||parseFloat(db.fuelCost)||0;
    const tolls=parseFloat(db.tolls)||0;
    const waitPay=(parseFloat(db.waitTime)||0)*(parseFloat(db.waitRate)||0);
    if(dumpPricing==="Per Ton"){
      grossRevenue=(parseFloat(db.tons)||0)*(parseFloat(db.ratePerTon)||0)*trips;
      fuelTotal=fuelPerTrip*trips;
    } else if(dumpPricing==="Per Hour"){
      grossRevenue=(parseFloat(db.hours)||0)*(parseFloat(db.ratePerHour)||0);
      fuelTotal=fuelPerTrip;
    } else {
      grossRevenue=(parseFloat(db.flatRate)||0)*trips;
      fuelTotal=fuelPerTrip*trips;
    }
    grossRevenue+=waitPay;
    const totalCost=fuelTotal+tolls,profit=grossRevenue-totalCost;
    let score,color;
    if(scoreMode==="dump"){
      const margin=grossRevenue>0?(profit/grossRevenue)*100:0;
      if(margin>=30&&profit>0){score="TAKE";color=C.green;}
      else if(margin>=15&&profit>0){score="REVIEW";color=C.yellow;}
      else{score="PASS";color=C.red;}
      return {grossRevenue,fuelTotal,tolls,waitPay,profit,totalCost,score,color,type:"dump",equipment:dumpType,pricing:dumpPricing,margin,trips};
    } else {
      const distMi=parseFloat(db.distanceMiles)||1;
      const rpm=grossRevenue/(distMi*trips);
      if(rpm>=2.00&&profit>0){score="TAKE";color=C.green;}
      else if(rpm>=1.40&&profit>0){score="REVIEW";color=C.yellow;}
      else{score="PASS";color=C.red;}
      return {grossRevenue,fuelTotal,tolls,waitPay,profit,totalCost,rpm,score,color,type:"dump",equipment:dumpType,pricing:dumpPricing,trips};
    }
  }

  function calcContainer() {
  const zoneData=DEFAULT_ZONES.find(z=>z.zone===cb.zone)||DEFAULT_ZONES[0];
  const baseRate=parseFloat(cb.overrideRate)||parseFloat(cb.zoneRate)||zoneData.baseRate;
  const chassis=parseFloat(cb.chassis)||0;
  const detention=(parseFloat(cb.detentionHrs)||0)*(parseFloat(cb.detentionRate)||65);
  const prePull=parseFloat(cb.prePull)||0,storage=parseFloat(cb.storage)||0;
  const hazmat=parseFloat(cb.hazmat)||0,overweight=parseFloat(cb.overweight)||0;
  const grossRevenue=baseRate+chassis+detention+prePull+storage+hazmat+overweight;
  const fuel=parseFloat(cb.fuel)||0,tolls=parseFloat(cb.tolls)||0;
  const miles=parseFloat(cb.miles)||0;
  const totalCost=fuel+tolls,profit=grossRevenue-totalCost;
  const rpm=miles>0?grossRevenue/miles:0;
  const hours=parseFloat(cb.hours)||0;
  const pph=hours>0?profit/hours:0;

  const th=getDrayageThresholds(cb.region);
  let score,color;
  if(hours<=0){
    score="REVIEW";color=C.yellow; // can't score confidently without hours
  } else if(pph>=th.takePerHour && profit>th.takeProfit){
    score="TAKE";color=C.green;
  } else if(pph>=th.reviewPerHour && profit>th.reviewProfit){
    score="REVIEW";color=C.yellow;
  } else {
    score="PASS";color=C.red;
  }
  return {grossRevenue,baseRate,chassis,detention,prePull,storage,hazmat,overweight,
    fuel,tolls,totalCost,profit,rpm,pph,miles,score,color,type:"container",
    equipment:containerType,zone:cb.zone,region:cb.region};
}

  const [dumpPricing,setDumpPricing] = useState("Per Ton");

  async function calculate() {
    const r=mode==="flatbed"?calcFlatbed():mode==="dump"?calcDump():calcContainer();
    setResult(r); setSaved(false);
    // Always record this analysis to the operator's private history,
    // whether or not they choose to contribute it to the community database.
    try {
      const existing = await personalGet("qc_history") || [];
      const entry = {
        id: uid(), operator: operator.name,
        equipment: r.equipment || eq, type: r.type,
        score: r.score, profit: r.profit,
        grossRevenue: r.grossRevenue ?? r.rate,
        rpm: r.rpm ?? null, broker: broker || null,
        inputs: mode==="flatbed"?fb:mode==="dump"?{...db,dumpPricing}:cb,
        timestamp: new Date().toISOString(),
      };
      await personalSet("qc_history", [entry, ...existing].slice(0,500));
    } catch {}
  }

  const [showHistory,setShowHistory] = useState(false);
  const [history,setHistory]         = useState([]);
  const [historyLoaded,setHistoryLoaded] = useState(false);

  async function openHistory() {
    const h = await personalGet("qc_history") || [];
    setHistory(h); setHistoryLoaded(true); setShowHistory(true);
  }

  async function clearHistory() {
    if(!window.confirm("Clear your entire Quick Check history? This can't be undone.")) return;
    await personalSet("qc_history", []);
    setHistory([]);
  }

  async function shareToCommunity(entry) {
    const existingShared = await sharedGet("beta_loads")||[];
    const sharedEntry = {
      id: uid(), operator: entry.operator, equipment: entry.equipment,
      type: entry.type, score: entry.score, profit: entry.profit,
      grossRevenue: entry.grossRevenue,
      broker: entry.broker||null, zone: entry.inputs?.zone||null,
      timestamp: entry.timestamp,
    };
    await sharedSet("beta_loads",[sharedEntry,...existingShared].slice(0,500));
    // Mark this entry as shared in personal history so the button reflects it
    const updated = history.map(h=>h.id===entry.id?{...h,sharedAt:new Date().toISOString()}:h);
    setHistory(updated);
    await personalSet("qc_history", updated);
  }

  async function saveLoad() {
    if(!result) return;
    const existing=await sharedGet("beta_loads")||[];
    const entry={
      id:uid(), operator:operator.name, equipment:result.equipment||eq,
      type:result.type, score:result.score, profit:result.profit,
      grossRevenue:result.grossRevenue||result.rate,
      broker:broker||null, zone:result.zone||null,
      timestamp:new Date().toISOString(),
    };
    await sharedSet("beta_loads",[entry,...existing].slice(0,500));
    if(onSaveLoad) onSaveLoad(entry);
    setSaved(true);
  }

  return (
    <div className="fade">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:8}}>
        <div className="bebas" style={{fontSize:30,color:C.green}}>Quick Check</div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          <Pill label="🚛 Flatbed" active={mode==="flatbed"} color={C.green} onClick={()=>{setMode("flatbed");setResult(null);setSaved(false);}}/>
          <Pill label="🏗️ Dump" active={mode==="dump"} color={C.orange} onClick={()=>{setMode("dump");setResult(null);setSaved(false);}}/>
          <Pill label="📦 Container" active={mode==="container"} color={C.blue} onClick={()=>{setMode("container");setResult(null);setSaved(false);}}/>
          <Pill label="🕘 My History" active={showHistory} color={C.cyan} onClick={()=>showHistory?setShowHistory(false):openHistory()}/>
        </div>
      </div>

      {showHistory&&(
        <Card style={{marginBottom:20}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div style={{fontSize:14,fontWeight:700,color:C.text}}>Your Quick Check History</div>
            <div style={{display:"flex",gap:8}}>
              <span style={{fontSize:11,color:C.muted}}>{history.length} analyzed</span>
              {history.length>0&&<span onClick={clearHistory} style={{fontSize:11,color:C.red,cursor:"pointer"}}>Clear</span>}
            </div>
          </div>
          {!historyLoaded&&<div style={{fontSize:12,color:C.muted}}>Loading…</div>}
          {historyLoaded&&history.length===0&&(
            <div style={{fontSize:12,color:C.muted}}>
              No loads analyzed yet. Every load you run through Quick Check will show up here automatically —
              whether or not you save it to the community database.
            </div>
          )}
          {history.length>0&&(
            <div style={{display:"flex",flexDirection:"column",gap:8,maxHeight:360,overflowY:"auto"}}>
              {history.map(h=>(
                <div key={h.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                  padding:"8px 10px",background:C.surface,borderRadius:8,border:`1px solid ${C.border}`}}>
                  <div>
                    <div style={{fontSize:12,color:C.text,fontWeight:600}}>
                      {h.equipment} {h.broker?`· ${h.broker}`:""}
                    </div>
                    <div style={{fontSize:10,color:C.muted}}>
                      {new Date(h.timestamp).toLocaleString()}
                    </div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div className="mono" style={{fontSize:12,color:h.profit>0?C.green:C.red,fontWeight:700}}>
                      {fmt$(h.profit)}
                    </div>
                    <Badge text={h.score} color={h.score==="TAKE"?C.green:h.score==="REVIEW"?C.yellow:C.red}/>
                    <div style={{marginTop:6}}>
                      {h.sharedAt?(
                        <span style={{fontSize:10,color:C.green}}>✓ Shared</span>
                      ):(
                        <span onClick={()=>shareToCommunity(h)}
                          style={{fontSize:10,color:C.blue,cursor:"pointer",textDecoration:"underline"}}>
                          Share to Community
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
        <Card>
          <Field label="Equipment">
            {mode==="flatbed"&&<select value={eq} onChange={e=>setEq(e.target.value)}>{FLATBED_TYPES.map(t=><option key={t}>{t}</option>)}</select>}
            {mode==="dump"&&<select value={dumpType} onChange={e=>setDumpType(e.target.value)}>{DUMP_TYPES.map(t=><option key={t}>{t}</option>)}</select>}
            {mode==="container"&&<select value={containerType} onChange={e=>setContainerType(e.target.value)}>{CONTAINER_TYPES.map(t=><option key={t}>{t}</option>)}</select>}
          </Field>

          {mode==="dump"&&(
            <Field label="Pricing Mode">
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {DUMP_PRICING.map(p=><Pill key={p} label={p} active={dumpPricing===p} color={C.orange} onClick={()=>setDumpPricing(p)}/>)}
              </div>
            </Field>
          )}

          <Field label="Broker / Carrier (optional)">
            <select value={broker} onChange={e=>setBroker(e.target.value)}>
              <option value="">-- Select if known --</option>
              {brokers.map(b=><option key={b.id}>{b.name}</option>)}
            </select>
            {brokerInfo&&(
              <div style={{marginTop:8,display:"flex",gap:8,alignItems:"center"}}>
                <Badge text={BROKER_TIERS[brokerInfo.tier]?.label} color={BROKER_TIERS[brokerInfo.tier]?.color||C.muted}/>
                <span style={{fontSize:11,color:C.muted}}>Community rating · Avg {brokerInfo.avgDays||"?"} days to pay</span>
              </div>
            )}
          </Field>

          {/* FLATBED */}
          {mode==="flatbed"&&(
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <Field label="Gross Rate ($)"><input type="number" placeholder="2500" value={fb.rate} onChange={e=>setF("rate",e.target.value)}/></Field>
              <Field label="Loaded Miles"><input type="number" placeholder="645" value={fb.loaded} onChange={e=>setF("loaded",e.target.value)}/></Field>
              <Field label="Deadhead Miles"><input type="number" placeholder="74" value={fb.deadhead} onChange={e=>setF("deadhead",e.target.value)}/></Field>
              <Field label="Fuel Cost ($)"><input type="number" placeholder="312" value={fb.fuel} onChange={e=>setF("fuel",e.target.value)}/></Field>
              <Field label="Tolls ($)"><input type="number" placeholder="0" value={fb.tolls} onChange={e=>setF("tolls",e.target.value)}/></Field>
              <Field label="Lumper ($)"><input type="number" placeholder="0" value={fb.lumper} onChange={e=>setF("lumper",e.target.value)}/></Field>
              <Field label="Detention ($)"><input type="number" placeholder="0" value={fb.detention} onChange={e=>setF("detention",e.target.value)}/></Field>
              <Field label="Drive Hours"><input type="number" placeholder="10" value={fb.hours} onChange={e=>setF("hours",e.target.value)}/></Field>
            </div>
          )}

          {/* DUMP — Per Ton */}
          {mode==="dump"&&dumpPricing==="Per Ton"&&(
            <>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <Field label="Tons Per Trip"><input type="number" placeholder="20" value={db.tons} onChange={e=>setD("tons",e.target.value)}/></Field>
                <Field label="Rate Per Ton ($)"><input type="number" placeholder="18" value={db.ratePerTon} onChange={e=>setD("ratePerTon",e.target.value)}/></Field>
                <Field label="Number of Trips"><input type="number" placeholder="1" value={db.trips} onChange={e=>setD("trips",e.target.value)}/></Field>
                <Field label="Fuel Per Trip ($)"><input type="number" placeholder="45" value={db.fuelPerTrip} onChange={e=>setD("fuelPerTrip",e.target.value)}/></Field>
                <Field label="Tolls ($)"><input type="number" placeholder="0" value={db.tolls} onChange={e=>setD("tolls",e.target.value)}/></Field>
                <Field label="Distance (miles)"><input type="number" placeholder="12" value={db.distanceMiles} onChange={e=>setD("distanceMiles",e.target.value)}/></Field>
                <Field label="Wait Time (hrs)"><input type="number" placeholder="0" value={db.waitTime} onChange={e=>setD("waitTime",e.target.value)}/></Field>
                <Field label="Wait Rate ($/hr)"><input type="number" placeholder="75" value={db.waitRate} onChange={e=>setD("waitRate",e.target.value)}/></Field>
              </div>
              <Field label="Material Type"><input placeholder="Gravel, Dirt, Asphalt..." value={db.materialType} onChange={e=>setD("materialType",e.target.value)}/></Field>
            </>
          )}

          {/* DUMP — Per Hour */}
          {mode==="dump"&&dumpPricing==="Per Hour"&&(
            <>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <Field label="Total Hours"><input type="number" placeholder="8" value={db.hours} onChange={e=>setD("hours",e.target.value)}/></Field>
                <Field label="Rate Per Hour ($)"><input type="number" placeholder="95" value={db.ratePerHour} onChange={e=>setD("ratePerHour",e.target.value)}/></Field>
                <Field label="Fuel Cost ($)"><input type="number" placeholder="120" value={db.fuelCost} onChange={e=>setD("fuelCost",e.target.value)}/></Field>
                <Field label="Tolls ($)"><input type="number" placeholder="0" value={db.tolls} onChange={e=>setD("tolls",e.target.value)}/></Field>
                <Field label="Wait Time (hrs)"><input type="number" placeholder="0" value={db.waitTime} onChange={e=>setD("waitTime",e.target.value)}/></Field>
                <Field label="Wait Rate ($/hr)"><input type="number" placeholder="75" value={db.waitRate} onChange={e=>setD("waitRate",e.target.value)}/></Field>
              </div>
              <Field label="Job Site"><input placeholder="Project or site name" value={db.jobSite} onChange={e=>setD("jobSite",e.target.value)}/></Field>
            </>
          )}

          {/* DUMP — Flat Rate */}
          {mode==="dump"&&dumpPricing==="Per Load (Flat Rate)"&&(
            <>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <Field label="Flat Rate Per Load ($)"><input type="number" placeholder="350" value={db.flatRate} onChange={e=>setD("flatRate",e.target.value)}/></Field>
                <Field label="Number of Loads"><input type="number" placeholder="1" value={db.trips} onChange={e=>setD("trips",e.target.value)}/></Field>
                <Field label="Fuel Per Load ($)"><input type="number" placeholder="45" value={db.fuelPerTrip} onChange={e=>setD("fuelPerTrip",e.target.value)}/></Field>
                <Field label="Tolls ($)"><input type="number" placeholder="0" value={db.tolls} onChange={e=>setD("tolls",e.target.value)}/></Field>
                <Field label="Distance (miles)"><input type="number" placeholder="15" value={db.distanceMiles} onChange={e=>setD("distanceMiles",e.target.value)}/></Field>
                <Field label="Wait Time (hrs)"><input type="number" placeholder="0" value={db.waitTime} onChange={e=>setD("waitTime",e.target.value)}/></Field>
              </div>
              <Field label="Material Type"><input placeholder="Gravel, Dirt, Asphalt..." value={db.materialType} onChange={e=>setD("materialType",e.target.value)}/></Field>
            </>
          )}

          {mode==="dump"&&(
            <Field label="Scoring Mode">
              <div style={{display:"flex",gap:8}}>
                <Pill label="Standard RPM" active={scoreMode==="standard"} color={C.green} onClick={()=>setScoreMode("standard")}/>
                <Pill label="Margin %" active={scoreMode==="dump"} color={C.orange} onClick={()=>setScoreMode("dump")}/>
              </div>
              <div style={{fontSize:11,color:C.muted,marginTop:6}}>
                {scoreMode==="standard"?"TAKE ≥$2.00/mi · REVIEW ≥$1.40/mi":"TAKE ≥30% margin · REVIEW ≥15% margin"}
              </div>
            </Field>
          )}

          {/* CONTAINER */}
          {mode==="container"&&(
            <>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <Field label="Railyard / Port"><input placeholder="BNSF St. Paul..." value={cb.railyard} onChange={e=>setCf("railyard",e.target.value)}/></Field>
                <Field label="Delivery Location"><input placeholder="City, State" value={cb.destination} onChange={e=>setCf("destination",e.target.value)}/></Field>
              </div>
              <Field label="Delivery Zone">
                <select value={cb.zone} onChange={e=>onZoneChange(e.target.value)}>
                  {DEFAULT_ZONES.map(z=><option key={z.zone} value={z.zone}>{z.zone} ({z.miles} mi) — ${z.baseRate}</option>)}
                </select>
              </Field>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <Field label="Zone Base Rate ($)"><input type="number" value={cb.zoneRate} onChange={e=>setCf("zoneRate",e.target.value)}/></Field>
                <Field label="Override Rate ($)"><input type="number" placeholder="Leave blank to use zone" value={cb.overrideRate} onChange={e=>setCf("overrideRate",e.target.value)}/></Field>
                <Field label="Actual Miles"><input type="number" placeholder="45" value={cb.miles} onChange={e=>setCf("miles",e.target.value)}/></Field>
                <Field label="Fuel Cost ($)"><input type="number" placeholder="85" value={cb.fuel} onChange={e=>setCf("fuel",e.target.value)}/></Field>
                <Field label="Tolls ($)"><input type="number" placeholder="0" value={cb.tolls} onChange={e=>setCf("tolls",e.target.value)}/></Field>
                <Field label="Chassis Fee ($)"><input type="number" placeholder="25" value={cb.chassis} onChange={e=>setCf("chassis",e.target.value)}/></Field>
              </div>
              <div style={{padding:12,background:C.surface,borderRadius:8,marginBottom:16}}>
                <div style={{fontSize:11,color:C.blue,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>Accessorials</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                  <Field label="Detention Hours"><input type="number" placeholder="0" value={cb.detentionHrs} onChange={e=>setCf("detentionHrs",e.target.value)}/></Field>
                  <Field label="Detention Rate ($/hr)"><input type="number" placeholder="65" value={cb.detentionRate} onChange={e=>setCf("detentionRate",e.target.value)}/></Field>
                  <Field label="Pre-Pull ($)"><input type="number" placeholder="0" value={cb.prePull} onChange={e=>setCf("prePull",e.target.value)}/></Field>
                  <Field label="Storage ($)"><input type="number" placeholder="0" value={cb.storage} onChange={e=>setCf("storage",e.target.value)}/></Field>
                  <Field label="Hazmat ($)"><input type="number" placeholder="0" value={cb.hazmat} onChange={e=>setCf("hazmat",e.target.value)}/></Field>
                  <Field label="Overweight ($)"><input type="number" placeholder="0" value={cb.overweight} onChange={e=>setCf("overweight",e.target.value)}/></Field>
                </div>
              </div>
              {/* Zone quick-tap table */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:4,marginBottom:4}}>
                {DEFAULT_ZONES.map(z=>(
                  <div key={z.zone} onClick={()=>onZoneChange(z.zone)} style={{
                    padding:"6px 4px",borderRadius:6,cursor:"pointer",textAlign:"center",
                    background:cb.zone===z.zone?`${C.blue}22`:C.surface,
                    border:`1px solid ${cb.zone===z.zone?C.blue:C.border}`,transition:"all .15s"}}>
                    <div style={{fontSize:9,color:cb.zone===z.zone?C.blue:C.muted,fontWeight:700}}>{z.zone}</div>
                    <div style={{fontSize:9,color:C.muted}}>{z.miles}mi</div>
                    <div style={{fontSize:11,color:cb.zone===z.zone?C.blue:C.text,fontWeight:600}}>${z.baseRate}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          <Btn full onClick={calculate} style={{marginTop:12}}>CALCULATE</Btn>
        </Card>

        {/* RESULTS */}
        <div>
          {!result&&(
            <Card style={{display:"flex",alignItems:"center",justifyContent:"center",
              minHeight:320,flexDirection:"column",gap:16,textAlign:"center"}}>
              <div style={{fontSize:52}}>{mode==="dump"?"🏗️":mode==="container"?"📦":"🚛"}</div>
              <div style={{fontSize:14,color:C.muted,maxWidth:260}}>
                Fill in your load details and tap Calculate to see your profitability score.
              </div>
            </Card>
          )}
          {result&&(
            <div className="fade">
              <div style={{background:`${result.color}15`,border:`2px solid ${result.color}`,
                borderRadius:12,padding:28,textAlign:"center",marginBottom:16}}>
                <div style={{fontSize:11,color:C.muted,letterSpacing:2,textTransform:"uppercase",marginBottom:6}}>Load Score</div>
                <div className="bebas" style={{fontSize:80,color:result.color,lineHeight:1}}>{result.score}</div>
                <div style={{fontSize:13,color:C.muted,marginTop:8}}>
                  {result.score==="TAKE"?"Profitable — this load makes money.":
                   result.score==="REVIEW"?"Marginal — evaluate carefully before accepting.":
                   "Not profitable — keep looking."}
                </div>
              </div>

              <Card style={{marginBottom:12}}>
                {result.type==="flatbed"&&(
                  <div style={{display:"flex",flexDirection:"column",gap:10}}>
                    {[["Gross Rate",fmt$(result.rate),C.text],
                      ["Total Costs",fmt$(result.totalCost),C.red],
                      ["Net Profit",fmt$(result.profit),result.profit>0?C.green:C.red],
                      ["Rate Per Mile",fmt$(result.rpm)+"/mi",result.rpm>=2?C.green:result.rpm>=1.4?C.yellow:C.red],
                      ["Profit Per Mile",fmt$(result.ppm)+"/mi",result.ppm>0?C.green:C.red],
                      ["Profit Per Hour",result.pph>0?fmt$(result.pph)+"/hr":"—",C.cyan],
                      ["Deadhead %",fmtN(result.deadPct)+"%",result.deadPct>20?C.red:C.green],
                    ].map(([k,v,c])=>(
                      <div key={k} style={{display:"flex",justifyContent:"space-between",borderBottom:`1px solid ${C.border}`,paddingBottom:8}}>
                        <span style={{fontSize:13,color:C.muted}}>{k}</span>
                        <span className="mono" style={{fontSize:13,color:c,fontWeight:600}}>{v}</span>
                      </div>
                    ))}
                  </div>
                )}
                {result.type==="dump"&&(
                  <div style={{display:"flex",flexDirection:"column",gap:10}}>
                    {[["Gross Revenue",fmt$(result.grossRevenue),C.text],
                      ["Fuel",fmt$(result.fuelTotal||0),C.red],
                      ["Tolls",fmt$(result.tolls||0),C.muted],
                      result.waitPay>0?["Wait Pay",fmt$(result.waitPay),C.cyan]:null,
                      ["Total Costs",fmt$(result.totalCost),C.red],
                      ["Net Profit",fmt$(result.profit),result.profit>0?C.green:C.red],
                      result.margin!=null?["Profit Margin",fmtN(result.margin)+"%",result.margin>=30?C.green:result.margin>=15?C.yellow:C.red]:null,
                      result.rpm!=null?["Revenue/Mile",fmt$(result.rpm)+"/mi",result.rpm>=2?C.green:result.rpm>=1.4?C.yellow:C.red]:null,
                    ].filter(Boolean).map(([k,v,c])=>(
                      <div key={k} style={{display:"flex",justifyContent:"space-between",borderBottom:`1px solid ${C.border}`,paddingBottom:8}}>
                        <span style={{fontSize:13,color:C.muted}}>{k}</span>
                        <span className="mono" style={{fontSize:13,color:c,fontWeight:600}}>{v}</span>
                      </div>
                    ))}
                  </div>
                )}
                {result.type==="container"&&(
                  <div>
                    <div style={{marginBottom:10}}>
                      <Badge text={result.equipment} color={C.blue}/>
                      <Badge text={result.zone} color={C.cyan} style={{marginLeft:6}}/>
                    </div>
                    <div style={{marginBottom:12,padding:10,background:C.surface,borderRadius:8}}>
                      <div style={{fontSize:11,color:C.blue,fontWeight:700,marginBottom:8}}>Revenue</div>
                      {[["Zone Base Rate",fmt$(result.baseRate),C.text],
                        result.chassis>0?["Chassis",fmt$(result.chassis),C.muted]:null,
                        result.detention>0?["Detention",fmt$(result.detention),C.cyan]:null,
                        result.prePull>0?["Pre-Pull",fmt$(result.prePull),C.muted]:null,
                        result.storage>0?["Storage",fmt$(result.storage),C.muted]:null,
                        result.hazmat>0?["Hazmat",fmt$(result.hazmat),C.yellow]:null,
                        result.overweight>0?["Overweight",fmt$(result.overweight),C.yellow]:null,
                        ["TOTAL",fmt$(result.grossRevenue),C.green],
                      ].filter(Boolean).map(([k,v,c])=>(
                        <div key={k} style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4,
                          fontWeight:k==="TOTAL"?700:400,borderTop:k==="TOTAL"?`1px solid ${C.border}`:"none",paddingTop:k==="TOTAL"?6:0}}>
                          <span style={{color:k==="TOTAL"?C.text:C.muted}}>{k}</span>
                          <span className="mono" style={{color:c}}>{v}</span>
                        </div>
                      ))}
                    </div>
                    {[["Fuel + Tolls",fmt$(result.totalCost),C.red],
                      ["Net Profit",fmt$(result.profit),result.profit>0?C.green:C.red],
                      result.rpm>0?["Revenue/Mile",fmt$(result.rpm)+"/mi",result.rpm>=2?C.green:result.rpm>=1.4?C.yellow:C.red]:null,
                    ].filter(Boolean).map(([k,v,c])=>(
                      <div key={k} style={{display:"flex",justifyContent:"space-between",borderBottom:`1px solid ${C.border}`,paddingBottom:8,marginBottom:8}}>
                        <span style={{fontSize:13,color:C.muted}}>{k}</span>
                        <span className="mono" style={{fontSize:13,color:c,fontWeight:600}}>{v}</span>
                      </div>
                    ))}
                  </div>
                )}
                {brokerInfo&&(
                  <div style={{marginTop:10,padding:10,background:C.surface,borderRadius:8,display:"flex",gap:8,alignItems:"center"}}>
                    <Badge text={BROKER_TIERS[brokerInfo.tier]?.label} color={BROKER_TIERS[brokerInfo.tier]?.color||C.muted}/>
                    <span style={{fontSize:11,color:C.muted}}>{brokerInfo.name} · Avg {brokerInfo.avgDays||"?"} days to pay</span>
                  </div>
                )}
              </Card>

              <Btn full onClick={saveLoad} variant={saved?"secondary":"primary"}>
                {saved?"✓ Load Saved to Community Database":"Save This Load — Help Build the Database"}
              </Btn>
              {saved&&<div style={{fontSize:11,color:C.green,textAlign:"center",marginTop:8}}>
                This load data is now contributing to TruckFlow's intelligence for all operators.
              </div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── BROKER MEMORY (shared) ────────────────────────────────────────────────────
function BrokerMemory({brokers,setBrokers,operator}) {
  const [showAdd,setShowAdd] = useState(false);
  const [loading,setLoading] = useState(false);
  const blank={id:"",name:"",contact:"",phone:"",email:"",tier:"STANDARD",avgDays:30,rating:3,notes:"",addedBy:""};
  const [form,setForm] = useState({...blank});
  const setF=(k,v)=>setForm(p=>({...p,[k]:v}));

 async function addBroker() {
  if(!form.name) return;
  setLoading(true);
  const entry={...form,id:uid(),addedBy:operator.name,addedByDevice:operator.deviceId,addedOn:new Date().toLocaleDateString()};
  const updated=[entry,...brokers];
  setBrokers(updated);
  await sharedSet("beta_brokers",updated);
  setShowAdd(false); setForm({...blank}); setLoading(false);
}

async function rateBroker(id, field, val) {
  const broker = brokers.find(b => b.id === id);
  const myRating = broker?.deviceRatings?.[operator.deviceId];
  const timesRated = myRating?.count || 0;

  if (timesRated >= 2) return; // used initial rating + 1 correction, now locked

  const updated = brokers.map(b => b.id === id
    ? {
        ...b,
        [field]: val,
        lastUpdatedBy: operator.name,
        lastUpdatedByDevice: operator.deviceId,
        deviceRatings: {
          ...(b.deviceRatings || {}),
          [operator.deviceId]: { value: val, count: timesRated + 1 }
        }
      }
    : b
  );
  setBrokers(updated);
  await sharedSet("beta_brokers", updated);
}
  return (
    <div className="fade">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <div className="bebas" style={{fontSize:30,color:C.green}}>Broker Memory</div>
        <Btn small onClick={()=>setShowAdd(true)}>+ Add Broker</Btn>
      </div>
      <div style={{marginBottom:20,padding:12,background:`${C.blue}12`,border:`1px solid ${C.blue}33`,
        borderRadius:8,fontSize:12,color:C.muted}}>
        🤝 This is a <strong style={{color:C.blue}}>shared community database</strong>. Every broker rating and review you add helps every other operator using TruckFlow. Rate brokers honestly.
      </div>

      {showAdd&&(
        <Card style={{marginBottom:20,border:`1px solid ${C.green}`}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:16}}>
            <div className="bebas" style={{fontSize:22,color:C.green}}>Add Broker</div>
            <Btn variant="secondary" small onClick={()=>setShowAdd(false)}>✕</Btn>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Field label="Company Name"><input placeholder="ABC Freight Brokers" value={form.name} onChange={e=>setF("name",e.target.value)}/></Field>
            <Field label="Contact Name"><input placeholder="Jane Smith" value={form.contact} onChange={e=>setF("contact",e.target.value)}/></Field>
            <Field label="Phone"><input value={form.phone} onChange={e=>setF("phone",e.target.value)}/></Field>
            <Field label="Email"><input value={form.email} onChange={e=>setF("email",e.target.value)}/></Field>
            <Field label="Rating">
              <select value={form.tier} onChange={e=>setF("tier",e.target.value)}>
                {Object.entries(BROKER_TIERS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
              </select>
            </Field>
            <Field label="Avg Days to Pay"><input type="number" value={form.avgDays} onChange={e=>setF("avgDays",e.target.value)}/></Field>
            <Field label="Your Rating (1-5)"><input type="number" min={1} max={5} value={form.rating} onChange={e=>setF("rating",e.target.value)}/></Field>
          </div>
          <Field label="Notes — be specific and honest">
            <textarea rows={3} placeholder="Payment speed, communication, do they negotiate fairly, any issues..." value={form.notes} onChange={e=>setF("notes",e.target.value)}/>
          </Field>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <Btn variant="secondary" onClick={()=>setShowAdd(false)}>Cancel</Btn>
            <Btn onClick={addBroker} disabled={loading}>{loading?"Saving...":"Add to Community Database"}</Btn>
          </div>
        </Card>
      )}

      {loading&&brokers.length===0&&<Spinner/>}
      {brokers.length===0&&!loading&&(
        <Card style={{textAlign:"center",padding:48,color:C.muted}}>
          <div style={{fontSize:32,marginBottom:12}}>🤝</div>
          <div style={{fontSize:14,marginBottom:8}}>No brokers in the community database yet.</div>
          <div style={{fontSize:12}}>Be the first to add a broker and help build the shared intelligence.</div>
        </Card>
      )}

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:16}}>
        {brokers.map(b=>{
          const tier=BROKER_TIERS[b.tier]||{color:C.muted,label:b.tier};
          return (
            <Card key={b.id}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                <div>
                  <div style={{fontWeight:700,fontSize:15,marginBottom:4}}>{b.name}</div>
                  <Badge text={tier.label} color={tier.color}/>
                </div>
                <div className="bebas" style={{fontSize:30,color:tier.color}}>{b.rating}/5</div>
              </div>
              <div style={{fontSize:12,color:C.muted,display:"flex",flexDirection:"column",gap:4,marginBottom:10}}>
                {b.contact&&<div>👤 {b.contact}</div>}
                {b.phone&&<div>📱 {b.phone}</div>}
                <div>💳 Avg pay: <span style={{color:b.avgDays<=30?C.green:b.avgDays<=45?C.yellow:C.red,fontWeight:600}}>{b.avgDays} days</span></div>
                <div style={{fontSize:11}}>Added by: {b.addedBy||"Community"} · {b.addedOn||""}</div>
              </div>
              {b.notes&&<div style={{padding:10,background:C.surface,borderRadius:8,fontSize:12,color:C.muted,marginBottom:12,lineHeight:1.6}}>{b.notes}</div>}

              {(() => {
  const myRating = b.deviceRatings?.[operator.deviceId];
  const timesRated = myRating?.count || 0;
  const locked = timesRated >= 2;
  return (
    <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
      {Object.entries(BROKER_TIERS).map(([k,v])=>(
        <button key={k} onClick={()=>!locked && rateBroker(b.id,"tier",k)}
          disabled={locked}
          style={{
            padding:"4px 10px",borderRadius:16,border:`1px solid ${b.tier===k?v.color:C.border}`,
            background:b.tier===k?`${v.color}22`:"transparent",
            color:b.tier===k?v.color:C.muted,fontSize:10,fontWeight:600,
            cursor:locked?"not-allowed":"pointer",
            opacity:locked?0.5:1}}>
          {v.label}
        </button>
      ))}
      {timesRated === 1 && (
        <span style={{fontSize:10,color:C.muted,alignSelf:"center"}}>You can change this rating once more</span>
      )}
      {locked && (
        <span style={{fontSize:10,color:C.muted,alignSelf:"center"}}>Your rating is locked in</span>
      )}
    </div>
  );
})()}
              {b.lastUpdatedBy&&b.lastUpdatedBy!==b.addedBy&&(
                <div style={{fontSize:10,color:C.muted,marginTop:6}}>Last updated by: {b.lastUpdatedBy}</div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ── FEEDBACK ──────────────────────────────────────────────────────────────────
function Feedback({operator}) {
  const [category,setCategory] = useState("Feature Request");
  const [message,setMessage]   = useState("");
  const [submitted,setSubmitted] = useState(false);
  const [loading,setLoading]   = useState(false);
  const [previous,setPrevious] = useState([]);

  useEffect(()=>{
    sharedGet("beta_feedback").then(d=>{ if(d) setPrevious(d.slice(0,10)); });
  },[]);

  const CATS = ["Feature Request","Something Doesn't Work","Missing Equipment Type",
    "Rate Thresholds Feel Wrong","Missing Cost Category","General Suggestion","Something I Love"];

  async function submit() {
    if(!message.trim()) return;
    setLoading(true);
    const entry={id:uid(),operator:operator.name,equipment:operator.equipment,
      category,message:message.trim(),timestamp:new Date().toISOString(),
      date:new Date().toLocaleDateString()};
    const existing=await sharedGet("beta_feedback")||[];
    await sharedSet("beta_feedback",[entry,...existing].slice(0,200));
    setSubmitted(true); setLoading(false);
  }

  if(submitted) return (
    <div className="fade" style={{textAlign:"center",padding:60}}>
      <div style={{fontSize:52,marginBottom:20}}>✓</div>
      <div className="bebas" style={{fontSize:32,color:C.green,marginBottom:8}}>Feedback Received</div>
      <p style={{fontSize:14,color:C.muted,maxWidth:400,margin:"0 auto 28px"}}>
        Thank you {operator.name}. Your feedback goes directly to the Guardian Holdings development team and shapes the next version of TruckFlow.
      </p>
      <Btn onClick={()=>{setSubmitted(false);setMessage("");}}>Submit Another</Btn>
    </div>
  );

  return (
    <div className="fade">
      <div className="bebas" style={{fontSize:30,color:C.green,marginBottom:8}}>Feedback</div>
      <p style={{fontSize:13,color:C.muted,marginBottom:24,lineHeight:1.7}}>
        You are using an early beta version of TruckFlow. Your feedback directly shapes what gets built next.
        Tell us what is missing, what feels wrong, or what you wish it did differently.
        Every submission is read by the founder personally.
      </p>

      <Card style={{marginBottom:24}}>
        <Field label="What kind of feedback is this?">
          <select value={category} onChange={e=>setCategory(e.target.value)}>
            {CATS.map(c=><option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Your feedback — be as specific as possible">
          <textarea rows={6} placeholder={
            category==="Feature Request"?"I wish TruckFlow could...":
            category==="Something Doesn't Work"?"When I try to..., what happens is...":
            category==="Rate Thresholds Feel Wrong"?"For my equipment and lanes, the TAKE/REVIEW/PASS thresholds should be...":
            "Tell us what you think..."
          } value={message} onChange={e=>setMessage(e.target.value)}/>
        </Field>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontSize:12,color:C.muted}}>Submitting as: <strong style={{color:C.text}}>{operator.name}</strong> · {operator.equipment}</div>
          <Btn onClick={submit} disabled={loading||!message.trim()}>{loading?"Sending...":"Send Feedback"}</Btn>
        </div>
      </Card>

      {previous.length>0&&(
        <div>
          <div style={{fontSize:12,color:C.muted,marginBottom:12,textTransform:"uppercase",letterSpacing:1,fontWeight:600}}>
            Recent Community Feedback ({previous.length} shown)
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {previous.map(f=>(
              <Card key={f.id} style={{padding:"12px 16px"}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <Badge text={f.category} color={C.accent}/>
                    <span style={{fontSize:11,color:C.muted}}>{f.operator} · {f.equipment}</span>
                  </div>
                  <span style={{fontSize:11,color:C.muted}}>{f.date}</span>
                </div>
                <div style={{fontSize:13,color:C.text,lineHeight:1.6}}>{f.message}</div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── ROOT ──────────────────────────────────────────────────────────────────────
const NAV=[
  {id:"quickcheck",icon:"⚡",label:"Quick Check"},
  {id:"brokers",icon:"🤝",label:"Broker Memory"},
  {id:"feedback",icon:"💬",label:"Feedback"},
];

export default function TruckFlowBeta() {
  const [operator,setOperator] = useState(null);
  const [page,setPage]         = useState("quickcheck");
  const [brokers,setBrokers]   = useState([]);
  const [loadCount,setLoadCount] = useState(0);
  const [loading,setLoading]   = useState(true);

  // Load shared broker data on mount
  useEffect(()=>{
    async function init() {
      const b = await sharedGet("beta_brokers")||[];
      setBrokers(b);
      const l = await sharedGet("beta_loads")||[];
      setLoadCount(l.length);
      setLoading(false);
    }
    init();
  },[]);

  function handleSaveLoad() {
    setLoadCount(c=>c+1);
  }

  if(!operator) return (
    loading
      ? <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center"}}><style>{css}</style><Spinner/></div>
      : <Onboarding onComplete={setOperator}/>
  );

  const pages={
    quickcheck: <QuickCheck operator={operator} brokers={brokers} onSaveLoad={handleSaveLoad}/>,
    brokers: <BrokerMemory brokers={brokers} setBrokers={setBrokers} operator={operator}/>,
    feedback: <Feedback operator={operator}/>,
  };

  return (
    <>
      <style>{css}</style>
      <div style={{display:"flex",minHeight:"100vh"}}>

        {/* Sidebar */}
        <div style={{width:190,background:C.surface,borderRight:`1px solid ${C.border}`,
          position:"fixed",top:0,left:0,bottom:0,display:"flex",flexDirection:"column",zIndex:100}}>

          <div style={{padding:"18px 16px 12px",borderBottom:`1px solid ${C.border}`}}>
            <div className="bebas" style={{fontSize:24,color:C.green,lineHeight:1}}>TruckFlow</div>
            <div style={{fontSize:9,color:C.muted,letterSpacing:1.5,marginTop:2}}>GUARDIAN HOLDINGS LLC</div>
            <div style={{marginTop:8,display:"inline-block",padding:"2px 8px",
              background:`${C.accent}22`,border:`1px solid ${C.accent}44`,
              borderRadius:10,fontSize:9,color:C.accent,fontWeight:700}}>BETA</div>
          </div>

          {/* Operator card */}
          <div style={{padding:"12px 16px",borderBottom:`1px solid ${C.border}`,background:`${C.green}08`}}>
            <div style={{fontSize:11,color:C.muted,marginBottom:2}}>Operator</div>
            <div style={{fontWeight:700,fontSize:13,color:C.text,marginBottom:2}}>{operator.name}</div>
            <div style={{fontSize:11,color:C.muted}}>{operator.equipment}</div>
            {operator.homeBase&&<div style={{fontSize:10,color:C.muted}}>📍 {operator.homeBase}</div>}
          </div>

          {/* Community stats */}
          <div style={{padding:"10px 16px",borderBottom:`1px solid ${C.border}`}}>
            <div style={{fontSize:10,color:C.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Community</div>
            <div style={{display:"flex",gap:12}}>
              <div style={{textAlign:"center"}}>
                <div className="bebas" style={{fontSize:20,color:C.green}}>{loadCount}</div>
                <div style={{fontSize:9,color:C.muted}}>Loads</div>
              </div>
              <div style={{textAlign:"center"}}>
                <div className="bebas" style={{fontSize:20,color:C.blue}}>{brokers.length}</div>
                <div style={{fontSize:9,color:C.muted}}>Brokers</div>
              </div>
            </div>
          </div>

          <nav style={{flex:1,padding:"8px 0"}}>
            {NAV.map(n=>{
              const isActive=page===n.id;
              return (
                <button key={n.id} onClick={()=>setPage(n.id)} style={{
                  width:"100%",display:"flex",alignItems:"center",gap:12,
                  padding:"12px 16px",background:isActive?`${C.green}18`:"transparent",
                  border:"none",borderLeft:`3px solid ${isActive?C.green:"transparent"}`,
                  color:isActive?C.green:C.muted,cursor:"pointer",fontSize:13,
                  fontWeight:isActive?600:400,transition:"all .15s",textAlign:"left",
                }}>
                  <span>{n.icon}</span>
                  <span>{n.label}</span>
                </button>
              );
            })}
          </nav>

          <div style={{padding:"12px 16px",borderTop:`1px solid ${C.border}`}}>
            <div style={{fontSize:10,color:C.muted,lineHeight:1.6}}>
              Built by a 30-year CDL-A veteran.<br/>
              Your feedback shapes what gets built next.
            </div>
            <button onClick={()=>setOperator(null)} style={{marginTop:8,fontSize:10,color:C.muted,
              background:"none",border:"none",cursor:"pointer",textDecoration:"underline"}}>
              Switch operator
            </button>
          </div>
        </div>

        {/* Main */}
        <div style={{marginLeft:190,flex:1,padding:28,minHeight:"100vh"}}>
          {pages[page]}
        </div>
      </div>
    </>
  );
}
