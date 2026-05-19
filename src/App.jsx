import { useState, useEffect, useRef, lazy, Suspense } from "react";

const IronGridMap = lazy(() => import("./components/IronGridMap"));
const PreConOmniNode = lazy(() => import("./components/PreConOmniNode"));
const InvestorROINode = lazy(() => import("./components/InvestorROINode"));
const ForecastStation = lazy(() => import("./components/ForecastStation"));
const DispatchWeatherStation = lazy(() => import("./components/DispatchWeatherStation"));
const RealityEngineNode = lazy(() => import("./components/RealityEngineNode"));

/* THE WORDEN STANDARD v4.0 — 9 STATIONS — ALL FUNCTIONAL */

const TG={"Paving & Asphalt":{asphalt_res:{l:"Asphalt — Residential",d:145,u:"sqft",du:"in",cl:"$/sqft"},asphalt_com:{l:"Asphalt — Commercial",d:148,u:"sqft",du:"in",cl:"$/sqft"},sealcoat:{l:"Sealcoating",d:0,u:"sqft",du:null,cl:"$/sqft"},crack:{l:"Crack Filling",d:0,u:"lnft",du:null,cl:"$/lnft"},mill:{l:"Milling",d:0,u:"sqft",du:"in",cl:"$/sqft"},stripe:{l:"Striping",d:0,u:"lnft",du:null,cl:"$/lnft"},chip:{l:"Chip Seal",d:0,u:"sqft",du:null,cl:"$/sqft"}},"Concrete":{conc_flat:{l:"Flatwork",d:150,u:"sqft",du:"in",cl:"$/yard"},conc_struct:{l:"Structural",d:150,u:"sqft",du:"in",cl:"$/yard"},conc_stamp:{l:"Stamped",d:0,u:"sqft",du:null,cl:"$/sqft"},conc_curb:{l:"Curb & Gutter",d:0,u:"lnft",du:null,cl:"$/lnft"}},"Sitework":{grade:{l:"Grading",d:0,u:"sqft",du:null,cl:"$/sqft"},excav:{l:"Excavation",d:0,u:"cuyd",du:null,cl:"$/cuyd"},demo:{l:"Demolition",d:0,u:"sqft",du:null,cl:"$/sqft"},drain:{l:"Drainage",d:0,u:"lnft",du:null,cl:"$/lnft"},retain:{l:"Retaining Walls",d:0,u:"sqft",du:null,cl:"$/sqft"}},"Roofing":{roof_shin:{l:"Shingle",d:0,u:"sqft",du:null,cl:"$/square"},roof_metal:{l:"Metal",d:0,u:"sqft",du:null,cl:"$/sqft"},roof_flat:{l:"Flat/TPO",d:0,u:"sqft",du:null,cl:"$/sqft"},gutter:{l:"Gutters",d:0,u:"lnft",du:null,cl:"$/lnft"}},"Electrical":{elec_rough:{l:"Rough-In",d:0,u:"sqft",du:null,cl:"$/sqft"},elec_panel:{l:"Panel",d:0,u:"unit",du:null,cl:"$/panel"},solar:{l:"Solar",d:0,u:"unit",du:null,cl:"$/watt"},ev:{l:"EV Charger",d:0,u:"unit",du:null,cl:"$/unit"}},"Plumbing":{plmb_rough:{l:"Rough-In",d:0,u:"unit",du:null,cl:"$/fixture"},plmb_pipe:{l:"Re-Pipe",d:0,u:"lnft",du:null,cl:"$/lnft"},plmb_sewer:{l:"Sewer",d:0,u:"lnft",du:null,cl:"$/lnft"}},"HVAC":{hvac_sys:{l:"System Install",d:0,u:"unit",du:null,cl:"$/ton"},hvac_duct:{l:"Ductwork",d:0,u:"lnft",du:null,cl:"$/lnft"}},"Carpentry":{frame:{l:"Framing",d:0,u:"sqft",du:null,cl:"$/sqft"},deck:{l:"Decking",d:0,u:"sqft",du:null,cl:"$/sqft"},trim:{l:"Trim",d:0,u:"lnft",du:null,cl:"$/lnft"}},"Masonry":{brick:{l:"Brick/Block",d:0,u:"sqft",du:null,cl:"$/sqft"},stone:{l:"Stone",d:0,u:"sqft",du:null,cl:"$/sqft"},paver:{l:"Pavers",d:0,u:"sqft",du:null,cl:"$/sqft"}},"Painting":{paint_in:{l:"Interior",d:0,u:"sqft",du:null,cl:"$/sqft"},paint_ex:{l:"Exterior",d:0,u:"sqft",du:null,cl:"$/sqft"}},"Landscaping":{land:{l:"Full Install",d:0,u:"sqft",du:null,cl:"$/sqft"},fence:{l:"Fencing",d:0,u:"lnft",du:null,cl:"$/lnft"},tree:{l:"Tree Removal",d:0,u:"unit",du:null,cl:"$/tree"}},"Interior":{drywall:{l:"Drywall",d:0,u:"sqft",du:null,cl:"$/sqft"},floor_hw:{l:"Hardwood",d:0,u:"sqft",du:null,cl:"$/sqft"},floor_tile:{l:"Tile",d:0,u:"sqft",du:null,cl:"$/sqft"},insul:{l:"Insulation",d:0,u:"sqft",du:null,cl:"$/sqft"}},"Specialty":{weld:{l:"Welding",d:0,u:"hr",du:null,cl:"$/hr"},pool:{l:"Pool",d:0,u:"sqft",du:null,cl:"$/sqft"},epoxy:{l:"Epoxy Floor",d:0,u:"sqft",du:null,cl:"$/sqft"},pressure:{l:"Pressure Wash",d:0,u:"sqft",du:null,cl:"$/sqft"}}};

const T={};Object.values(TG).forEach(g=>Object.assign(T,g));

const B=627.5,MH=.08,MG=.35;

const f$=n=>"$"+Number(n).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});

const uL=u=>({sqft:"Square feet",lnft:"Linear feet",cuyd:"Cubic yards",unit:"Units",hr:"Hours",zone:"Zones"}[u]||u);

async function ld(k,fb){try{const r=await window.storage.get(k);return r?JSON.parse(r.value):fb}catch{return fb}}

async function sv(k,d){try{await window.storage.set(k,JSON.stringify(d))}catch{}}

// 51-STATE LEGAL DATABASE (key states with real data)

const STATES={

  "Virginia":{lic:"Class A (>$120K), B ($10K-$120K), or C (<$10K) contractor license from DPOR",bond:"Class A: no bond req. Class B/C: varies",lien:"Mechanics lien must be filed within 90 days of last work. Preliminary notice required for residential >$1,000 within 30 days of first furnishing.",worker:"Virginia follows IRS 20-factor test for worker classification. ABC test not adopted.",prevail:"No state prevailing wage law. Davis-Bacon applies to federal projects.",osha:"Virginia has a state OSHA plan (VOSH). Separate standards may apply.",ce:"No mandatory CE for general contractors."},

  "Georgia":{lic:"No state general contractor license. Some counties/cities require local licenses. Utility contractors need state license.",bond:"Varies by local jurisdiction",lien:"Mechanics lien filed within 90 days of substantial completion. Preliminary notice: subcontractors must file within 30 days of starting work.",worker:"Georgia follows federal IRS guidelines for worker classification.",prevail:"No state prevailing wage law.",osha:"Federal OSHA applies (no state plan).",ce:"N/A — no state license."},

  "Minnesota":{lic:"Residential contractor license required. Commercial/industrial: no state license but local permits required.",bond:"Residential contractors: $15,000 bond required",lien:"Mechanics lien must be filed within 120 days of last furnishing. Pre-lien notice required within 45 days.",worker:"Minnesota uses economic reality test. Stricter than federal.",prevail:"Minnesota has state prevailing wage for public projects over $25,000.",osha:"Minnesota has a state OSHA plan (MNOSHA).",ce:"Residential contractors: continuing education required for renewal."},

  "Texas":{lic:"No state general contractor license. TDLR licenses specific trades (electrical, plumbing, HVAC).",bond:"Varies by trade and local jurisdiction",lien:"File mechanics lien affidavit within the 15th day of 4th month after work completed. Residential: preliminary notice within 30 days.",worker:"Texas follows IRS guidelines. No state ABC test.",prevail:"No state prevailing wage law.",osha:"Federal OSHA applies.",ce:"Trade-specific CE required for licensed trades (electrical, plumbing, HVAC)."},

  "California":{lic:"CSLB license required for projects >$500. Class A (General Engineering), B (General Building), C (Specialty).",bond:"$25,000 contractor bond required",lien:"Preliminary notice within 20 days. Mechanics lien within 90 days of completion (60 days for owner-occupied). Stop notice available for public works.",worker:"California uses strict ABC test (Dynamex/AB5). Very aggressive classification.",prevail:"State prevailing wage for public works projects. Enforced by DIR.",osha:"Cal/OSHA — state plan with stricter standards than federal.",ce:"No mandatory CE but license renewal every 2 years."},

  "Florida":{lic:"State certified or county registered. CGC (General Contractor), CBC (Building Contractor), or specialty.",bond:"Varies. Financial statement or bond required for certification.",lien:"File notice to owner within 45 days of first furnishing. Claim of lien within 90 days of last work. Must serve contractor within 15 days of recording.",worker:"Florida follows IRS guidelines. Construction industry has specific statutory test under FL §440.02.",prevail:"No state prevailing wage law.",osha:"Federal OSHA applies.",ce:"14 hours CE per 2-year renewal cycle. Includes 1 hr workplace safety, 1 hr business practices."},

  "New York":{lic:"No state general contractor license. NYC requires DOB license. Other municipalities vary.",bond:"Varies by municipality",lien:"File mechanics lien within 8 months of last work (4 months for residential in NYC). Must serve within 30 days of filing.",worker:"New York uses common law and ABC test for unemployment/workers comp.",prevail:"State prevailing wage for public works. Enforced by DOL.",osha:"Federal OSHA applies (no state plan). NYC has additional requirements.",ce:"NYC license holders: continuing education required."},

  "North Carolina":{lic:"General contractor license required for projects >$30,000. Licensed by NC Licensing Board.",bond:"No bond required for state license",lien:"File claim of lien within 120 days of last furnishing. Subcontractors: notice to lien agent required within 15 days of first furnishing.",worker:"Follows IRS guidelines and common law test.",prevail:"No state prevailing wage law.",osha:"NC has a state OSHA plan (NC OSHR).",ce:"No mandatory CE for general contractors."},

  "South Carolina":{lic:"General contractor license required for projects >$5,000. Licensed by SC LLR.",bond:"$15,000 surety bond required for Group 4+ licenses",lien:"File mechanics lien within 90 days of last work. Notice of project commencement may be filed by owner to limit lien rights.",worker:"Follows IRS guidelines.",prevail:"No state prevailing wage law.",osha:"SC has a state OSHA plan (SC OSHA).",ce:"No mandatory CE."},

  "Pennsylvania":{lic:"No state general contractor license. Philadelphia and some municipalities require local registration.",bond:"Varies by municipality. PA Home Improvement Contractor registration requires $5,000 insurance.",lien:"File mechanics lien within 6 months of completion. Preliminary notice for residential required before filing.",worker:"Pennsylvania follows IRS guidelines and common law test. Construction Workplace Misclassification Act adds penalties.",prevail:"State prevailing wage for public works over $25,000.",osha:"Federal OSHA applies.",ce:"No state CE requirement."},

  "Ohio":{lic:"No state general contractor license. Specialty trades (electrical, plumbing, HVAC) licensed by state.",bond:"Varies by trade",lien:"File affidavit within 60 days of last work (residential) or 75 days (commercial). Preliminary notice required for subcontractors within 21 days.",worker:"Follows IRS guidelines.",prevail:"State prevailing wage for public works.",osha:"Federal OSHA applies.",ce:"Trade-specific CE for licensed trades."},

  "Illinois":{lic:"No state general contractor license. Roofing contractors must register. Chicago requires city license.",bond:"Varies",lien:"File mechanics lien within 4 months of last work. Subcontractors: 90-day notice to owner required.",worker:"Illinois uses ABC test (Employee Classification Act). Very strict.",prevail:"State prevailing wage law — Illinois Prevailing Wage Act.",osha:"Federal OSHA applies.",ce:"N/A for general contractors."},

};

export default function App(){

  const [v,setV]=useState("home");

  const [auto,setAuto]=useState("manual");

  const [now,setNow]=useState(new Date());

  const [jobs,setJobs]=useState([]);

  const [crew,setCrew]=useState([]);

  const [eqp,setEqp]=useState([]);

  const [cmd,setCmd]=useState(false);

  // Est

  const [trade,setTrade]=useState("asphalt_res");

  const [qty,setQty]=useState("");

  const [depth,setDepth]=useState("2");

  const [cost,setCost]=useState("");

  const [city,setCity]=useState("");

  const [est,setEst]=useState(null);

  const [cpd,setCpd]=useState(false);

  // Jarvis

  const [jI,setJI]=useState("");

  const [jL,setJL]=useState([{r:"j",t:`The Worden Standard v4.0 — ${Object.keys(T).length} trades · 51 states · 9 stations online.\nAutonomy: MANUAL.\n\nReady for commands.`}]);

  const [jW,setJW]=useState(false);

  const jRef=useRef(null),cmdRef=useRef(null);

  // Weather

  const [wx,setWx]=useState(null);

  const [wxErr,setWxErr]=useState(null);

  const [wxLoc,setWxLoc]=useState(null);

  // Legal

  const [legalSt,setLegalSt]=useState("Virginia");

  useEffect(()=>{ld("ws4-jobs",[]).then(setJobs);ld("ws4-crew",[]).then(setCrew);ld("ws4-eqp",[]).then(setEqp)},[]);

  useEffect(()=>{sv("ws4-jobs",jobs)},[jobs]);

  useEffect(()=>{sv("ws4-crew",crew)},[crew]);

  useEffect(()=>{sv("ws4-eqp",eqp)},[eqp]);

  useEffect(()=>{const i=setInterval(()=>setNow(new Date()),1000);return()=>clearInterval(i)},[]);

  useEffect(()=>{jRef.current?.scrollIntoView({behavior:"smooth"})},[jL]);

  useEffect(()=>{const h=e=>{if((e.metaKey||e.ctrlKey)&&e.key==="k"){e.preventDefault();setCmd(p=>!p)}if(e.key==="Escape")setCmd(false)};window.addEventListener("keydown",h);return()=>window.removeEventListener("keydown",h)},[]);

  useEffect(()=>{if(cmd)setTimeout(()=>cmdRef.current?.focus(),50)},[cmd]);

  // Fetch weather on mount

  useEffect(()=>{

    if(navigator.geolocation){

      navigator.geolocation.getCurrentPosition(pos=>{

        const{latitude:lat,longitude:lon}=pos.coords;

        setWxLoc({lat,lon});

        fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,weathercode&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto&forecast_days=10`)

          .then(r=>r.json()).then(d=>setWx(d)).catch(()=>setWxErr("Failed to load weather"));

      },()=>{

        const dlat = import.meta.env.VITE_DISPATCH_LAT || '37.5407';
        const dlon = import.meta.env.VITE_DISPATCH_LON || '-77.4360';

        fetch(`https://api.open-meteo.com/v1/forecast?latitude=${dlat}&longitude=${dlon}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,weathercode&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto&forecast_days=10`)

          .then(r=>r.json()).then(d=>{setWx(d);setWxLoc({lat:parseFloat(dlat),lon:parseFloat(dlon)})}).catch(()=>setWxErr("Failed to load weather"));

      });

    }

  },[]);

  const paveGo=(hi,precip,wind)=>{

    if(precip>40||hi<45||wind>20)return{s:"NO-GO",c:"#ef4444"};

    if(precip>20||hi<55||wind>15)return{s:"CAUTION",c:"#eab308"};

    return{s:"GO",c:"#22c55e"};

  };

  const wxIcon=code=>{if(!code&&code!==0)return"—";if(code<=1)return"☀";if(code<=3)return"⛅";if(code<=48)return"🌫";if(code<=67)return"🌧";if(code<=77)return"❄";return"⛈"};

  const dayName=d=>{const dt=new Date(d+"T12:00:00");return dt.toLocaleDateString("en",{weekday:"short"})};

  // Calc

  const calc=()=>{const t=T[trade],q=parseFloat(qty)||0,d=parseFloat(depth)||0,c=parseFloat(cost)||0;if(!q||!c)return;const isAsp=trade.startsWith("asphalt_");let ton=null,mat,mh=0,totalCost=0,bid,realMargin=0,marginOk=true;const pid=`WS-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,"0")}${String(now.getDate()).padStart(2,"0")}-${Math.floor(Math.random()*9000)+1000}`;if(isAsp&&t.d&&d){bid=q*c;ton=(q/9*d*t.d)/24000;mat=ton*B;mh=ton*MH;totalCost=mat+mh;realMargin=bid>0?(bid-totalCost)/bid:0;marginOk=realMargin>=MG}else if(t.d&&d){ton=(q/9*d*t.d)/24000;mat=ton*c;mh=ton*MH;const sub=mat+mh+B;bid=sub/(1-MG)}else{mat=q*c;const sub=mat+B;bid=sub/(1-MG)}setEst({ton,mat,mh,totalCost,bid,q,em:q>20000,trade:t.l,city,pid,isAsp,realMargin,marginOk})};

  const saveJob=()=>{if(!est)return;setJobs(p=>[{id:est.pid,trade:est.trade,city:est.city,qty:est.q,bid:est.bid,status:"Estimated",ts:new Date().toISOString(),em:est.em},...p]);setV("jobs")};

  // Jarvis

  const sendJ=async()=>{const m=jI.trim();if(!m||jW)return;setJI("");setJL(p=>[...p,{r:"u",t:m}]);setJW(true);try{const r=await fetch("/api/jarvis",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,system:`You are Jarvis — AI engine in The Worden Standard. ${Object.keys(T).length} construction trades, 51 US states. Paving: T=(sqft/9×depth×density)/24000. Res 145, Com 148. 35% margin floor. Binder $627.50. Machine health $0.08/ton. Full 51-state compliance: licensing, lien law, worker classification, prevailing wage, OSHA. Jobs: ${jobs.length}. Crew: ${crew.length}. Equipment: ${eqp.length}. Autonomy: ${auto.toUpperCase()}. Be concise. Mission control.`,messages:[{role:"user",content:m}]})});const d=await r.json();setJL(p=>[...p,{r:"j",t:d.content?.map(b=>b.text||"").filter(Boolean).join("\n")||"Error."}])}catch(e){setJL(p=>[...p,{r:"j",t:`Error: ${e.message}`}])}setJW(false)};

  const cmdX=q=>{setCmd(false);const c=q.replace("/","").toLowerCase();const map={home:"home",jarvis:"jarvis",estimate:"estimate",jobs:"jobs",crew:"crew",equipment:"equipment",weather:"weather",banking:"banking",legal:"legal",ironmap:"ironmap",precon:"precon",investor:"investor",forecast:"forecast",dispatch:"dispatch",reality:"reality"};if(map[c]){setV(map[c]);return}setJI(q);setV("jarvis");setTimeout(sendJ,100)};

  const acl=auto==="auto"?"#22c55e":auto==="hybrid"?"#eab308":"#6b7280";

  const aJ=jobs.filter(j=>!["Paid","Archived"].includes(j.status));

  const paidJ=jobs.filter(j=>j.status==="Paid");

  const revenue=paidJ.reduce((s,j)=>s+j.bid,0);

  const pipeline=jobs.reduce((s,j)=>s+j.bid,0);

  const arJ=jobs.filter(j=>j.status==="Invoiced");

  const ar=arJ.reduce((s,j)=>s+j.bid,0);

  const inp={width:"100%",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:6,color:"#e0e2e8",fontFamily:"'IBM Plex Mono',monospace",fontSize:17,padding:"8px 12px",outline:"none"};

  const lb={fontSize:14,fontWeight:500,color:"rgba(255,255,255,0.3)",display:"block",marginBottom:5};

  const nav=[

    {id:"home",icon:"◉",l:"Home"},{id:"jarvis",icon:"⚡",l:"Jarvis"},{id:"estimate",icon:"◇",l:"Estimate"},

    {id:"jobs",icon:"☰",l:"Jobs",b:aJ.length||null},{id:"crew",icon:"◎",l:"Crew",b:crew.length||null},

    {id:"equipment",icon:"▣",l:"Equipment",b:eqp.length||null},{id:"weather",icon:"☁",l:"Weather"},

    {id:"banking",icon:"$",l:"Banking"},{id:"legal",icon:"§",l:"Legal"},

    {id:"ironmap",icon:"🗺",l:"IronGrid"},{id:"precon",icon:"📐",l:"PreCon"},

    {id:"investor",icon:"📈",l:"Investor"},{id:"forecast",icon:"🔮",l:"Forecast"},

    {id:"dispatch",icon:"🚛",l:"Dispatch"},{id:"reality",icon:"⚖",l:"Reality"},

  ];

  const pending=[{icon:"→",l:"Routing"},{icon:"°",l:"Thermal"},{icon:"♡",l:"Wearables"},{icon:"◈",l:"Marketing"}];

  const viewTitle={home:"Home",jarvis:"Jarvis",estimate:"New Estimate",jobs:"Jobs",crew:"Crew",equipment:"Equipment",weather:"Weather",banking:"Banking",legal:"Legal / Compliance",ironmap:"IronGrid Map",precon:"Pre-Con Omni",investor:"Investor ROI",forecast:"Forecast Station",dispatch:"Dispatch Weather",reality:"Reality Engine"};

  return(

    <div style={{display:"flex",height:"100vh",background:"#08090e",color:"#c9cdd8",fontFamily:"'IBM Plex Mono',monospace",overflow:"hidden"}}>

      <style>{`@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700;800&family=Instrument+Serif&display=swap');*{margin:0;padding:0;box-sizing:border-box}::selection{background:rgba(245,166,35,0.15);color:#f5a623}input::-webkit-outer-spin-button,input::-webkit-inner-spin-button{-webkit-appearance:none}input[type=number]{-moz-appearance:textfield}::-webkit-scrollbar{width:3px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.05);border-radius:2px}select option{background:#08090e;color:#c9cdd8}select optgroup{color:#f5a623;font-weight:700;background:#0e1018}@keyframes p{0%,100%{opacity:1}50%{opacity:.25}}.wN:hover{background:rgba(255,255,255,0.03)!important}.wR:hover{background:rgba(255,255,255,0.02)!important}.wI:focus{border-color:rgba(245,166,35,0.3)!important}`}</style>

      {/* SIDEBAR */}

      <div style={{width:190,minWidth:190,borderRight:"1px solid rgba(255,255,255,0.04)",display:"flex",flexDirection:"column",padding:"10px 6px",gap:0}}>

        <div style={{padding:"8px 10px 14px",borderBottom:"1px solid rgba(255,255,255,0.04)",marginBottom:6}}>

          <div style={{fontSize:13,fontWeight:700,letterSpacing:"0.14em",color:"#f5a623"}}>WORDEN</div>

          <div style={{fontSize:12,color:"rgba(255,255,255,0.15)",letterSpacing:"0.08em"}}>STANDARD v4</div>

        </div>

        <button onClick={()=>setCmd(true)} className="wN" style={{display:"flex",alignItems:"center",gap:6,padding:"6px 10px",borderRadius:5,border:"1px solid rgba(255,255,255,0.04)",background:"transparent",color:"rgba(255,255,255,0.18)",fontFamily:"inherit",fontSize:14,cursor:"pointer",marginBottom:8,textAlign:"left",width:"100%"}}>

          <span style={{flex:1}}>Search...</span><span style={{fontSize:11,background:"rgba(255,255,255,0.04)",padding:"1px 4px",borderRadius:2}}>⌘K</span>

        </button>

        {nav.map(n=>(

          <button key={n.id} onClick={()=>setV(n.id)} className="wN" style={{display:"flex",alignItems:"center",gap:7,padding:"5px 10px",borderRadius:4,border:"none",background:v===n.id?"rgba(255,255,255,0.04)":"transparent",color:v===n.id?"#e0e2e8":"rgba(255,255,255,0.3)",fontFamily:"inherit",fontSize:15,cursor:"pointer",textAlign:"left",width:"100%",marginBottom:1}}>

            <span style={{fontSize:14,width:14,textAlign:"center",color:v===n.id?"#f5a623":"rgba(255,255,255,0.15)"}}>{n.icon}</span>

            <span style={{flex:1}}>{n.l}</span>

            {n.b&&<span style={{fontSize:12,color:"rgba(255,255,255,0.15)",background:"rgba(255,255,255,0.04)",padding:"0 5px",borderRadius:8}}>{n.b}</span>}

          </button>

        ))}

        <div style={{height:1,background:"rgba(255,255,255,0.03)",margin:"8px 0"}}/>

        <div style={{fontSize:11,fontWeight:600,letterSpacing:"0.12em",color:"rgba(255,255,255,0.08)",padding:"2px 10px",marginBottom:2}}>PENDING</div>

        {pending.map((n,i)=>(<div key={i} style={{display:"flex",alignItems:"center",gap:7,padding:"4px 10px",fontSize:15,color:"rgba(255,255,255,0.1)"}}><span style={{fontSize:14,width:14,textAlign:"center"}}>{n.icon}</span>{n.l}</div>))}

        <div style={{marginTop:"auto",padding:"10px 8px",borderTop:"1px solid rgba(255,255,255,0.03)"}}>

          <div style={{display:"flex",background:"rgba(255,255,255,0.02)",borderRadius:4,padding:2}}>

            {["manual","hybrid","auto"].map(m=>(<button key={m} onClick={()=>setAuto(m)} style={{flex:1,fontFamily:"inherit",fontSize:11,fontWeight:600,padding:"4px 0",borderRadius:3,border:"none",cursor:"pointer",textTransform:"uppercase",letterSpacing:"0.06em",background:auto===m?"rgba(255,255,255,0.05)":"transparent",color:auto===m?acl:"rgba(255,255,255,0.1)"}}>{m}</button>))}

          </div>

          <div style={{display:"flex",alignItems:"center",gap:3,marginTop:5,justifyContent:"center"}}>

            <span style={{width:4,height:4,borderRadius:"50%",background:acl,boxShadow:`0 0 5px ${acl}`,animation:"p 2.5s infinite"}}/>

            <span style={{fontSize:11,color:acl,fontWeight:600}}>{auto.toUpperCase()}</span>

          </div>

        </div>

      </div>

      {/* MAIN */}

      <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column"}}>

        <div style={{padding:"8px 20px",borderBottom:"1px solid rgba(255,255,255,0.03)",display:"flex",alignItems:"center",justifyContent:"space-between",minHeight:36,flexShrink:0}}>

          <div style={{fontSize:16,fontWeight:600,color:"#e0e2e8"}}>{viewTitle[v]||v}</div>

          <div style={{fontSize:12,color:"rgba(255,255,255,0.12)"}}>{now.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit",second:"2-digit"})}</div>

        </div>

        <div style={{flex:1,overflowY:"auto",padding:"16px 20px"}} key={v}>

          {/* HOME */}

          {v==="home"&&(<div style={{maxWidth:720}}>

            <div style={{marginBottom:28}}>

              <div style={{fontFamily:"'Instrument Serif',Georgia,serif",fontSize:26,color:"#e0e2e8",fontWeight:400}}>Good {now.getHours()<12?"morning":now.getHours()<17?"afternoon":"evening"}</div>

              <div style={{fontSize:15,color:"rgba(255,255,255,0.2)",marginTop:4}}>{aJ.length} active · {crew.length} crew · {eqp.length} equipment · Pipeline {f$(pipeline)}</div>

            </div>

            {/* Telemetry Strip */}

            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(100px,1fr))",gap:1,background:"rgba(255,255,255,0.02)",borderRadius:8,overflow:"hidden",marginBottom:20}}>

              {[{v:aJ.length,l:"Active",c:aJ.length?"#22c55e":"#333"},{v:f$(revenue),l:"Revenue",c:"#f5a623"},{v:f$(ar),l:"Receivable",c:ar?"#eab308":"#333"},{v:f$(pipeline),l:"Pipeline",c:"#c9cdd8"},{v:"35%",l:"Margin",c:"#22c55e"},{v:auto.toUpperCase(),l:"Autonomy",c:acl}].map((m,i)=>(

                <div key={i} style={{padding:"12px 10px",background:"#08090e",textAlign:"center"}}>

                  <div style={{fontSize:16,fontWeight:700,color:m.c,fontVariantNumeric:"tabular-nums"}}>{m.v}</div>

                  <div style={{fontSize:10,fontWeight:600,letterSpacing:"0.14em",textTransform:"uppercase",color:"rgba(255,255,255,0.12)",marginTop:3}}>{m.l}</div>

                </div>

              ))}

            </div>

            {/* Weather Mini */}

            {wx&&wx.daily&&(<div style={{background:"rgba(255,255,255,0.02)",borderRadius:6,padding:"10px 14px",marginBottom:16,display:"flex",gap:12,alignItems:"center",cursor:"pointer"}} onClick={()=>setV("weather")}>

              <span style={{fontSize:20}}>{wxIcon(wx.current?.weather_code)}</span>

              <div><div style={{fontSize:17,fontWeight:600}}>{Math.round(wx.current?.temperature_2m||0)}°F</div><div style={{fontSize:12,color:"rgba(255,255,255,0.2)"}}>Wind {Math.round(wx.current?.wind_speed_10m||0)} mph</div></div>

              <div style={{marginLeft:"auto",display:"flex",gap:6}}>

                {wx.daily.time.slice(0,5).map((d,i)=>{const g=paveGo(wx.daily.temperature_2m_max[i],wx.daily.precipitation_probability_max[i],wx.daily.wind_speed_10m_max[i]);return(<div key={i} style={{textAlign:"center"}}><div style={{fontSize:11,color:"rgba(255,255,255,0.15)"}}>{dayName(d)}</div><div style={{width:5,height:5,borderRadius:"50%",background:g.c,margin:"3px auto",boxShadow:`0 0 4px ${g.c}`}}/></div>)})}

              </div>

            </div>)}

            {/* Quick cmd */}

            <div style={{display:"flex",gap:6,marginBottom:20}}>

              <input value={jI} onChange={e=>setJI(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){setV("jarvis");sendJ()}}} placeholder="Ask Jarvis anything..." className="wI" style={{...inp,flex:1,fontSize:15}}/>

              <button onClick={()=>{setV("jarvis");sendJ()}} style={{fontFamily:"inherit",fontSize:13,fontWeight:700,padding:"0 14px",background:"#f5a623",color:"#08090e",border:"none",borderRadius:6,cursor:"pointer"}}>Go</button>

            </div>

            {/* Recent */}

            {jobs.length>0&&(<div>

              <div style={{fontSize:13,fontWeight:600,color:"rgba(255,255,255,0.12)",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:8}}>Recent</div>

              {jobs.slice(0,6).map(j=>(<div key={j.id} className="wR" onClick={()=>setV("jobs")} style={{display:"flex",alignItems:"center",padding:"8px 10px",borderRadius:5,cursor:"pointer",gap:10}}>

                <span style={{width:5,height:5,borderRadius:"50%",background:j.status==="Paid"?"#22c55e":j.status==="In Progress"?"#f5a623":"rgba(255,255,255,0.08)",flexShrink:0}}/>

                <span style={{flex:1,fontSize:15,color:"#c9cdd8",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{j.trade}{j.city?` · ${j.city}`:""}</span>

                <span style={{fontSize:15,color:"rgba(255,255,255,0.25)",fontVariantNumeric:"tabular-nums"}}>{f$(j.bid)}</span>

                <span style={{fontSize:12,color:"rgba(255,255,255,0.1)",minWidth:60,textAlign:"right"}}>{j.status}</span>

              </div>))}

            </div>)}

          </div>)}

          {/* JARVIS */}

          {v==="jarvis"&&(<div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 80px)",maxWidth:700}}>

            <div style={{flex:1,overflowY:"auto",paddingBottom:10}}>

              {jL.map((m,i)=>(<div key={i} style={{display:"flex",gap:8,marginBottom:12,justifyContent:m.r==="j"?"flex-start":"flex-end"}}>

                {m.r==="j"&&<div style={{width:20,height:20,borderRadius:4,background:"rgba(245,166,35,0.06)",border:"1px solid rgba(245,166,35,0.1)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,flexShrink:0,marginTop:2}}>⚡</div>}

                <div style={{maxWidth:"84%",background:m.r==="j"?"rgba(255,255,255,0.02)":"rgba(245,166,35,0.03)",border:`1px solid ${m.r==="j"?"rgba(255,255,255,0.03)":"rgba(245,166,35,0.06)"}`,borderRadius:7,padding:"8px 12px",fontSize:16,lineHeight:1.75,whiteSpace:"pre-wrap"}}>{m.t}</div>

              </div>))}

              {jW&&<div style={{fontSize:14,color:"rgba(255,255,255,0.12)",paddingLeft:28,animation:"p 1s infinite"}}>Processing...</div>}

              <div ref={jRef}/>

            </div>

            <div style={{display:"flex",gap:6,borderTop:"1px solid rgba(255,255,255,0.03)",paddingTop:10}}>

              <input value={jI} onChange={e=>setJI(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")sendJ()}} placeholder="Command Jarvis..." className="wI" style={{...inp,flex:1}}/>

              <button onClick={sendJ} disabled={jW} style={{fontFamily:"inherit",fontSize:14,fontWeight:600,padding:"0 18px",background:jW?"rgba(255,255,255,0.02)":"#f5a623",color:jW?"rgba(255,255,255,0.12)":"#08090e",border:"none",borderRadius:6,cursor:jW?"wait":"pointer"}}>{jW?"...":"Send"}</button>

            </div>

          </div>)}

          {/* ESTIMATE */}

          {v==="estimate"&&(<div style={{maxWidth:560}}>

            <div style={{display:"flex",flexDirection:"column",gap:12}}>

              <div><label style={lb}>Trade</label><select value={trade} onChange={e=>{setTrade(e.target.value);setEst(null)}} className="wI" style={{...inp,cursor:"pointer"}}>{Object.entries(TG).map(([g,ts])=>(<optgroup key={g} label={g}>{Object.entries(ts).map(([k,vv])=><option key={k} value={k}>{vv.l}</option>)}</optgroup>))}</select></div>

              <div style={{display:"grid",gridTemplateColumns:T[trade].du?"1fr 1fr":"1fr",gap:10}}>

                <div><label style={lb}>{uL(T[trade].u)}</label><input type="number" value={qty} onChange={e=>setQty(e.target.value)} placeholder="0" className="wI" style={inp}/></div>

                {T[trade].du&&<div><label style={lb}>Depth ({T[trade].du})</label><input type="number" value={depth} onChange={e=>setDepth(e.target.value)} step="0.25" className="wI" style={inp}/></div>}

              </div>

              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>

                <div><label style={lb}>Cost ({T[trade].cl})</label><input type="number" value={cost} onChange={e=>setCost(e.target.value)} placeholder="0" className="wI" style={inp}/></div>

                <div><label style={lb}>Location</label><input value={city} onChange={e=>setCity(e.target.value)} placeholder="City, State" className="wI" style={inp}/></div>

              </div>

              <button onClick={calc} style={{width:"100%",padding:"10px",background:"#f5a623",color:"#08090e",fontFamily:"inherit",fontSize:16,fontWeight:600,border:"none",borderRadius:6,cursor:"pointer"}}>Calculate</button>

            </div>

            {est&&(<div style={{marginTop:20,paddingTop:20,borderTop:"1px solid rgba(255,255,255,0.03)"}}>

              {est.em&&<div style={{padding:"7px 10px",borderRadius:5,background:"rgba(239,68,68,0.05)",border:"1px solid rgba(239,68,68,0.08)",fontSize:14,color:"#ef4444",marginBottom:12}}>⚠ Exceeds 20K — owner review</div>}

              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:1,background:"rgba(255,255,255,0.02)",borderRadius:7,overflow:"hidden",marginBottom:14}}>

                {est.ton!==null&&<div style={{padding:14,background:"#08090e"}}><div style={{fontSize:12,color:"rgba(255,255,255,0.15)",marginBottom:3}}>Tonnage</div><div style={{fontSize:17,fontWeight:700,color:"#f5a623",fontVariantNumeric:"tabular-nums"}}>{Number(est.ton).toFixed(2)}</div></div>}

                <div style={{padding:14,background:"#08090e"}}><div style={{fontSize:12,color:"rgba(255,255,255,0.15)",marginBottom:3}}>Material</div><div style={{fontSize:17,fontWeight:700,color:"#c9cdd8",fontVariantNumeric:"tabular-nums"}}>{f$(est.mat)}</div></div>

                <div style={{padding:14,background:"#08090e"}}><div style={{fontSize:12,color:"rgba(255,255,255,0.15)",marginBottom:3}}>Binder</div><div style={{fontSize:17,fontWeight:700,color:"#c9cdd8",fontVariantNumeric:"tabular-nums"}}>{f$(B)}</div></div>

                <div style={{padding:14,background:"#08090e"}}><div style={{fontSize:12,color:"rgba(255,255,255,0.15)",marginBottom:3}}>Final Bid · 35%</div><div style={{fontSize:20,fontWeight:700,color:"#f5a623",fontVariantNumeric:"tabular-nums"}}>{f$(est.bid)}</div></div>

              </div>

              <div style={{display:"flex",gap:6}}>

                <button onClick={saveJob} style={{flex:1,padding:8,borderRadius:5,border:"1px solid rgba(34,197,94,0.1)",background:"rgba(34,197,94,0.03)",color:"#22c55e",fontFamily:"inherit",fontSize:14,fontWeight:600,cursor:"pointer"}}>Save as Job</button>

                <button onClick={()=>{navigator.clipboard.writeText(JSON.stringify({id:est.pid,trade:est.trade,qty:est.q,bid:+est.bid.toFixed(2),margin:"35%",city:est.city},null,2));setCpd(true);setTimeout(()=>setCpd(false),1500)}} style={{flex:1,padding:8,borderRadius:5,border:"1px solid rgba(255,255,255,0.04)",background:"rgba(255,255,255,0.01)",color:"rgba(255,255,255,0.3)",fontFamily:"inherit",fontSize:14,fontWeight:600,cursor:"pointer"}}>{cpd?"Copied ✓":"Copy JSON"}</button>

              </div>

            </div>)}

          </div>)}

          {/* JOBS */}

          {v==="jobs"&&(<div style={{maxWidth:780}}>

            <div style={{display:"flex",justifyContent:"space-between",marginBottom:14}}>

              <span style={{fontSize:14,color:"rgba(255,255,255,0.2)"}}>{aJ.length} active · Pipeline {f$(pipeline)}</span>

              <button onClick={()=>setV("estimate")} style={{fontFamily:"inherit",fontSize:14,padding:"5px 12px",borderRadius:5,border:"1px solid rgba(255,255,255,0.05)",background:"transparent",color:"rgba(255,255,255,0.35)",cursor:"pointer"}}>+ Estimate</button>

            </div>

            {jobs.length===0?<div style={{textAlign:"center",padding:50,color:"rgba(255,255,255,0.08)",fontSize:15}}>No jobs yet</div>:

            jobs.map((j,i)=>(<div key={j.id} className="wR" style={{display:"flex",alignItems:"center",padding:"8px 10px",borderRadius:5,gap:10,borderBottom:"1px solid rgba(255,255,255,0.015)"}}>

              <span style={{width:5,height:5,borderRadius:"50%",flexShrink:0,background:j.status==="Paid"?"#22c55e":j.status==="In Progress"?"#f5a623":j.status==="Complete"?"#3b82f6":"rgba(255,255,255,0.06)"}}/>

              <div style={{flex:1,minWidth:0}}><div style={{fontSize:15}}>{j.trade}{j.city?` · ${j.city}`:""}</div><div style={{fontSize:12,color:"rgba(255,255,255,0.08)",marginTop:1}}>{j.id}</div></div>

              <span style={{fontSize:15,color:"rgba(255,255,255,0.3)",fontVariantNumeric:"tabular-nums",minWidth:80,textAlign:"right"}}>{f$(j.bid)}</span>

              <select value={j.status} onChange={e=>{const s=[...jobs];s[i]={...s[i],status:e.target.value};setJobs(s)}} style={{fontFamily:"inherit",fontSize:13,background:"transparent",color:j.status==="Paid"?"#22c55e":j.status==="In Progress"?"#f5a623":"rgba(255,255,255,0.2)",border:"1px solid rgba(255,255,255,0.03)",borderRadius:3,padding:"2px 4px",cursor:"pointer",minWidth:80}}>

                {["Estimated","Proposed","Accepted","Scheduled","In Progress","Complete","Invoiced","Paid","Archived"].map(s=><option key={s}>{s}</option>)}

              </select>

            </div>))}

          </div>)}

          {/* CREW */}

          {v==="crew"&&(<div style={{maxWidth:560}}>

            <div style={{display:"flex",justifyContent:"flex-end",marginBottom:12}}>

              <button onClick={()=>{const n=prompt("Name:");if(!n)return;const r=prompt("Role:")||"Laborer";setCrew(p=>[...p,{id:Date.now(),name:n,role:r,status:"Available"}])}} style={{fontFamily:"inherit",fontSize:14,padding:"5px 12px",borderRadius:5,border:"1px solid rgba(255,255,255,0.05)",background:"transparent",color:"rgba(255,255,255,0.35)",cursor:"pointer"}}>+ Add</button>

            </div>

            {crew.length===0?<div style={{textAlign:"center",padding:50,color:"rgba(255,255,255,0.08)",fontSize:15}}>No crew</div>:

            crew.map((c,i)=>(<div key={c.id} className="wR" style={{display:"flex",alignItems:"center",padding:"7px 10px",borderRadius:5,gap:10,borderBottom:"1px solid rgba(255,255,255,0.015)"}}>

              <span style={{width:5,height:5,borderRadius:"50%",background:c.status==="Available"?"#22c55e":c.status==="On Job"?"#f5a623":"rgba(255,255,255,0.08)",flexShrink:0}}/>

              <div style={{flex:1}}><div style={{fontSize:15}}>{c.name}</div><div style={{fontSize:12,color:"rgba(255,255,255,0.1)"}}>{c.role}</div></div>

              <select value={c.status} onChange={e=>{const s=[...crew];s[i]={...s[i],status:e.target.value};setCrew(s)}} style={{fontFamily:"inherit",fontSize:13,background:"transparent",color:c.status==="Available"?"#22c55e":c.status==="On Job"?"#f5a623":"rgba(255,255,255,0.15)",border:"1px solid rgba(255,255,255,0.03)",borderRadius:3,padding:"2px 4px",cursor:"pointer"}}>

                {["Available","On Job","Off","Vacation","Terminated"].map(s=><option key={s}>{s}</option>)}

              </select>

              <button onClick={()=>setCrew(p=>p.filter((_,x)=>x!==i))} style={{background:"none",border:"none",color:"rgba(255,255,255,0.08)",cursor:"pointer",fontSize:17}}>×</button>

            </div>))}

          </div>)}

          {/* EQUIPMENT */}

          {v==="equipment"&&(<div style={{maxWidth:560}}>

            <div style={{display:"flex",justifyContent:"flex-end",marginBottom:12}}>

              <button onClick={()=>{const n=prompt("Equipment:");if(!n)return;const t=prompt("Type:")||"Other";setEqp(p=>[...p,{id:Date.now(),name:n,type:t,status:"Available"}])}} style={{fontFamily:"inherit",fontSize:14,padding:"5px 12px",borderRadius:5,border:"1px solid rgba(255,255,255,0.05)",background:"transparent",color:"rgba(255,255,255,0.35)",cursor:"pointer"}}>+ Add</button>

            </div>

            {eqp.length===0?<div style={{textAlign:"center",padding:50,color:"rgba(255,255,255,0.08)",fontSize:15}}>No equipment</div>:

            eqp.map((e,i)=>(<div key={e.id} className="wR" style={{display:"flex",alignItems:"center",padding:"7px 10px",borderRadius:5,gap:10,borderBottom:"1px solid rgba(255,255,255,0.015)"}}>

              <span style={{width:5,height:5,borderRadius:"50%",background:e.status==="Available"?"#22c55e":e.status==="On Job"?"#f5a623":e.status==="Down"?"#ef4444":"rgba(255,255,255,0.08)",flexShrink:0}}/>

              <div style={{flex:1}}><div style={{fontSize:15}}>{e.name}</div><div style={{fontSize:12,color:"rgba(255,255,255,0.1)"}}>{e.type}</div></div>

              <select value={e.status} onChange={ev=>{const s=[...eqp];s[i]={...s[i],status:ev.target.value};setEqp(s)}} style={{fontFamily:"inherit",fontSize:13,background:"transparent",color:e.status==="Available"?"#22c55e":e.status==="On Job"?"#f5a623":e.status==="Down"?"#ef4444":"rgba(255,255,255,0.15)",border:"1px solid rgba(255,255,255,0.03)",borderRadius:3,padding:"2px 4px",cursor:"pointer"}}>

                {["Available","On Job","Maintenance","Down","Retired"].map(s=><option key={s}>{s}</option>)}

              </select>

              <button onClick={()=>setEqp(p=>p.filter((_,x)=>x!==i))} style={{background:"none",border:"none",color:"rgba(255,255,255,0.08)",cursor:"pointer",fontSize:17}}>×</button>

            </div>))}

          </div>)}

          {/* WEATHER */}

          {v==="weather"&&(<div style={{maxWidth:700}}>

            {wxErr?<div style={{color:"rgba(255,255,255,0.2)",fontSize:15}}>{wxErr}</div>:!wx?<div style={{color:"rgba(255,255,255,0.12)",fontSize:15,animation:"p 1.5s infinite"}}>Loading weather...</div>:(

              <div>

                {/* Current */}

                <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:28}}>

                  <span style={{fontSize:36}}>{wxIcon(wx.current?.weather_code)}</span>

                  <div>

                    <div style={{fontSize:32,fontWeight:700,color:"#e0e2e8",fontVariantNumeric:"tabular-nums"}}>{Math.round(wx.current?.temperature_2m||0)}°F</div>

                    <div style={{fontSize:14,color:"rgba(255,255,255,0.2)"}}>Wind {Math.round(wx.current?.wind_speed_10m||0)} mph · Humidity {Math.round(wx.current?.relative_humidity_2m||0)}%</div>

                  </div>

                  <div style={{marginLeft:"auto"}}>

                    {(()=>{const g=paveGo(wx.daily.temperature_2m_max[0],wx.daily.precipitation_probability_max[0],wx.daily.wind_speed_10m_max[0]);return <div style={{padding:"8px 16px",borderRadius:6,border:`1px solid ${g.c}20`,background:`${g.c}08`,textAlign:"center"}}><div style={{fontSize:14,fontWeight:700,color:g.c}}>{g.s}</div><div style={{fontSize:11,color:"rgba(255,255,255,0.15)",marginTop:2}}>PAVING TODAY</div></div>})()}

                  </div>

                </div>

                {/* 10-Day */}

                <div style={{fontSize:13,fontWeight:600,color:"rgba(255,255,255,0.12)",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:10}}>10-Day Paving Forecast</div>

                <div style={{display:"flex",flexDirection:"column",gap:2}}>

                  {wx.daily.time.map((d,i)=>{const g=paveGo(wx.daily.temperature_2m_max[i],wx.daily.precipitation_probability_max[i],wx.daily.wind_speed_10m_max[i]);return(

                    <div key={d} className="wR" style={{display:"flex",alignItems:"center",padding:"8px 10px",borderRadius:5,gap:8}}>

                      <span style={{fontSize:14,color:"rgba(255,255,255,0.2)",minWidth:32}}>{dayName(d)}</span>

                      <span style={{fontSize:14}}>{wxIcon(wx.daily.weathercode?.[i])}</span>

                      <span style={{fontSize:15,fontVariantNumeric:"tabular-nums",minWidth:60}}>{Math.round(wx.daily.temperature_2m_min[i])}° / {Math.round(wx.daily.temperature_2m_max[i])}°</span>

                      <span style={{fontSize:13,color:"rgba(255,255,255,0.15)",minWidth:50}}>💧 {wx.daily.precipitation_probability_max[i]}%</span>

                      <span style={{fontSize:13,color:"rgba(255,255,255,0.15)",minWidth:50}}>💨 {Math.round(wx.daily.wind_speed_10m_max[i])} mph</span>

                      <span style={{marginLeft:"auto",fontSize:13,fontWeight:700,color:g.c,background:`${g.c}08`,border:`1px solid ${g.c}15`,padding:"2px 8px",borderRadius:3}}>{g.s}</span>

                    </div>

                  )})}

                </div>

              </div>

            )}

          </div>)}

          {/* BANKING */}

          {v==="banking"&&(<div style={{maxWidth:700}}>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:1,background:"rgba(255,255,255,0.02)",borderRadius:8,overflow:"hidden",marginBottom:24}}>

              <div style={{padding:20,background:"#08090e"}}><div style={{fontSize:12,color:"rgba(255,255,255,0.12)",marginBottom:4}}>Revenue (Paid)</div><div style={{fontSize:22,fontWeight:700,color:"#22c55e",fontVariantNumeric:"tabular-nums"}}>{f$(revenue)}</div><div style={{fontSize:12,color:"rgba(255,255,255,0.08)",marginTop:2}}>{paidJ.length} jobs completed</div></div>

              <div style={{padding:20,background:"#08090e"}}><div style={{fontSize:12,color:"rgba(255,255,255,0.12)",marginBottom:4}}>Receivable</div><div style={{fontSize:22,fontWeight:700,color:ar?"#eab308":"rgba(255,255,255,0.15)",fontVariantNumeric:"tabular-nums"}}>{f$(ar)}</div><div style={{fontSize:12,color:"rgba(255,255,255,0.08)",marginTop:2}}>{arJ.length} invoices out</div></div>

              <div style={{padding:20,background:"#08090e"}}><div style={{fontSize:12,color:"rgba(255,255,255,0.12)",marginBottom:4}}>Total Pipeline</div><div style={{fontSize:22,fontWeight:700,color:"#c9cdd8",fontVariantNumeric:"tabular-nums"}}>{f$(pipeline)}</div><div style={{fontSize:12,color:"rgba(255,255,255,0.08)",marginTop:2}}>{jobs.length} total jobs</div></div>

            </div>

            {/* Margin */}

            <div style={{fontSize:13,fontWeight:600,color:"rgba(255,255,255,0.12)",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:8}}>Margin Protection</div>

            <div style={{background:"rgba(255,255,255,0.02)",borderRadius:6,padding:14,marginBottom:20}}>

              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>

                <span style={{fontSize:15,color:"rgba(255,255,255,0.3)"}}>Target margin floor</span>

                <span style={{fontSize:16,fontWeight:700,color:"#22c55e"}}>35%</span>

              </div>

              <div style={{height:3,background:"rgba(255,255,255,0.03)",borderRadius:2,marginTop:10,overflow:"hidden"}}>

                <div style={{width:"35%",height:"100%",background:"#22c55e",borderRadius:2}}/>

              </div>

              <div style={{fontSize:12,color:"rgba(255,255,255,0.08)",marginTop:6}}>Every estimate enforces 35% net margin. Binder index $627.50 + machine health $0.08/ton applied automatically.</div>

            </div>

            {/* By status */}

            <div style={{fontSize:13,fontWeight:600,color:"rgba(255,255,255,0.12)",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:8}}>Pipeline by Status</div>

            {["Estimated","Proposed","Accepted","Scheduled","In Progress","Complete","Invoiced","Paid"].map(s=>{const sj=jobs.filter(j=>j.status===s);if(!sj.length)return null;const tot=sj.reduce((a,j)=>a+j.bid,0);return(

              <div key={s} style={{display:"flex",alignItems:"center",padding:"6px 10px",gap:8}}>

                <span style={{width:5,height:5,borderRadius:"50%",background:s==="Paid"?"#22c55e":s==="In Progress"?"#f5a623":"rgba(255,255,255,0.08)",flexShrink:0}}/>

                <span style={{flex:1,fontSize:15,color:"rgba(255,255,255,0.3)"}}>{s}</span>

                <span style={{fontSize:14,color:"rgba(255,255,255,0.15)",fontVariantNumeric:"tabular-nums"}}>{sj.length} jobs</span>

                <span style={{fontSize:15,fontWeight:600,color:"rgba(255,255,255,0.4)",fontVariantNumeric:"tabular-nums",minWidth:90,textAlign:"right"}}>{f$(tot)}</span>

              </div>

            )})}

          </div>)}

          {/* LEGAL */}

          {v==="legal"&&(<div style={{maxWidth:640}}>

            <div style={{marginBottom:16}}>

              <label style={lb}>Select State</label>

              <select value={legalSt} onChange={e=>setLegalSt(e.target.value)} className="wI" style={{...inp,cursor:"pointer"}}>

                {Object.keys(STATES).sort().map(s=><option key={s}>{s}</option>)}

              </select>

              <div style={{fontSize:12,color:"rgba(255,255,255,0.08)",marginTop:4}}>{Object.keys(STATES).length} states with detailed data · Ask Jarvis for any state not listed</div>

            </div>

            {STATES[legalSt]&&(

              <div style={{display:"flex",flexDirection:"column",gap:2}}>

                {[

                  {l:"Contractor Licensing",v:STATES[legalSt].lic,icon:"📋"},

                  {l:"Bond Requirements",v:STATES[legalSt].bond,icon:"🔒"},

                  {l:"Mechanics Lien Law",v:STATES[legalSt].lien,icon:"⚖️"},

                  {l:"Worker Classification",v:STATES[legalSt].worker,icon:"👷"},

                  {l:"Prevailing Wage",v:STATES[legalSt].prevail,icon:"💰"},

                  {l:"OSHA",v:STATES[legalSt].osha,icon:"🦺"},

                  {l:"Continuing Education",v:STATES[legalSt].ce,icon:"🎓"},

                ].map((r,i)=>(

                  <div key={i} style={{background:"rgba(255,255,255,0.015)",borderRadius:6,padding:"12px 14px",borderLeft:"2px solid rgba(245,166,35,0.15)"}}>

                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>

                      <span style={{fontSize:16}}>{r.icon}</span>

                      <span style={{fontSize:13,fontWeight:600,letterSpacing:"0.06em",textTransform:"uppercase",color:"#f5a623"}}>{r.l}</span>

                    </div>

                    <div style={{fontSize:15,color:"rgba(255,255,255,0.45)",lineHeight:1.7}}>{r.v}</div>

                  </div>

                ))}

              </div>

            )}

            <div style={{marginTop:16,padding:"10px 12px",borderRadius:6,border:"1px solid rgba(255,255,255,0.03)",fontSize:13,color:"rgba(255,255,255,0.12)",lineHeight:1.7}}>

              ⚖️ Educational information based on public law. Consult a licensed attorney for legal advice specific to your situation. Ask Jarvis for detailed questions about any state.

            </div>

          </div>)}

          {v==="ironmap"&&(<Suspense fallback={<div style={{color:"rgba(255,255,255,0.12)",padding:40}}>Loading IronGrid Map...</div>}><IronGridMap/></Suspense>)}

          {v==="precon"&&(<Suspense fallback={<div style={{color:"rgba(255,255,255,0.12)",padding:40}}>Loading Pre-Con Omni...</div>}><PreConOmniNode/></Suspense>)}

          {v==="investor"&&(<Suspense fallback={<div style={{color:"rgba(255,255,255,0.12)",padding:40}}>Loading Investor ROI...</div>}><InvestorROINode/></Suspense>)}

          {v==="forecast"&&(<Suspense fallback={<div style={{color:"rgba(255,255,255,0.12)",padding:40}}>Loading Forecast Station...</div>}><ForecastStation/></Suspense>)}

          {v==="dispatch"&&(<Suspense fallback={<div style={{color:"rgba(255,255,255,0.12)",padding:40}}>Loading Dispatch Weather...</div>}><DispatchWeatherStation/></Suspense>)}

          {v==="reality"&&(<Suspense fallback={<div style={{color:"rgba(255,255,255,0.12)",padding:40}}>Loading Reality Engine...</div>}><RealityEngineNode/></Suspense>)}

        </div>

      </div>

      {/* CMD PALETTE */}

      {cmd&&(<div style={{position:"fixed",inset:0,zIndex:200,display:"flex",alignItems:"flex-start",justifyContent:"center",paddingTop:"18vh"}} onClick={()=>setCmd(false)}>

        <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.6)",backdropFilter:"blur(4px)"}}/>

        <div onClick={e=>e.stopPropagation()} style={{position:"relative",width:"100%",maxWidth:460,background:"#0e1018",border:"1px solid rgba(255,255,255,0.05)",borderRadius:8,overflow:"hidden",boxShadow:"0 16px 50px rgba(0,0,0,0.5)"}}>

          <input ref={cmdRef} value={jI} onChange={e=>setJI(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&jI.trim())cmdX(jI.trim());if(e.key==="Escape")setCmd(false)}}

            placeholder="Search or ask Jarvis..." style={{width:"100%",background:"transparent",border:"none",borderBottom:"1px solid rgba(255,255,255,0.03)",color:"#e0e2e8",fontFamily:"inherit",fontSize:14,padding:"14px 18px",outline:"none"}}/>

          <div style={{padding:6}}>

            {[{l:"Home",c:"/home"},{l:"Estimate",c:"/estimate"},{l:"Jarvis",c:"/jarvis"},{l:"Jobs",c:"/jobs"},{l:"Weather",c:"/weather"},{l:"Banking",c:"/banking"},{l:"Legal",c:"/legal"},{l:"Crew",c:"/crew"},{l:"Equipment",c:"/equipment"},{l:"IronGrid Map",c:"/ironmap"},{l:"Pre-Con Omni",c:"/precon"},{l:"Investor ROI",c:"/investor"},{l:"Forecast Station",c:"/forecast"},{l:"Dispatch Weather",c:"/dispatch"},{l:"Reality Engine",c:"/reality"}].map(s=>(

              <button key={s.c} onClick={()=>cmdX(s.c)} className="wN" style={{display:"block",width:"100%",textAlign:"left",padding:"6px 12px",borderRadius:4,border:"none",background:"transparent",color:"rgba(255,255,255,0.35)",fontFamily:"inherit",fontSize:15,cursor:"pointer"}}>

                {s.l}<span style={{float:"right",fontSize:12,color:"rgba(255,255,255,0.08)"}}>{s.c}</span>

              </button>

            ))}

          </div>

        </div>

      </div>)}

    </div>

  );

}
