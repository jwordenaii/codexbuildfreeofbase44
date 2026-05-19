// ═══════════════════════════════════════════════════════════════════════
// IronGridMap.tsx  ·  J. Worden & Sons Command Intelligence Platform
// 8-layer · 51-state · Real-time construction demand heatmap
// Layers: Construction Demand · Real Estate · Residential Permits ·
//         Commercial Permits · Raw Materials · Civil/Infrastructure ·
//         Labor & Capacity · Weather & Season
// API:    /api/intelligence  (Netlify Function or Next.js route)
// Refresh: every 15 min · poll on layer/cluster change
// ═══════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState, useCallback, useMemo, memo } from 'react';
import type { FC, MouseEvent as RMouseEvent } from 'react';
import './IronGridMap.css';

// ─── TYPES ──────────────────────────────────────────────────────────────────
export type Trend = 'up' | 'down' | 'flat';
export type DataLayer =
  | 'construction' | 'realestate' | 'respermits' | 'compermits'
  | 'rawmaterials' | 'civil' | 'labor' | 'weather';
export type ConstructionCluster =
  | 'paving' | 'concrete' | 'sitework' | 'utilities' | 'heavycivil' | 'roofing';

export interface StateNode { abbr: string; name: string; x: number; y: number; }

export interface StateSignal {
  abbr: string;
  // Layer 1 Construction
  constructionInterest: number;
  constructionTrend: Trend;
  topKeyword: string;
  keywordCluster: ConstructionCluster;
  // Layer 2 Real Estate
  medianListPrice: number | null;
  activeListings: number | null;
  daysOnMarket: number | null;
  priceChangePct: number | null;
  saleToListRatio: number | null;
  realEstateTrend: Trend;
  // Layer 3 Residential Permits
  resSingleFamily: number | null;
  resMultiFamily: number | null;
  resTotalUnits: number | null;
  resPermitChangePct: number | null;
  resPermitTrend: Trend;
  // Layer 4 Commercial Permits
  comOfficeRetail: number | null;
  comIndustrialWarehouse: number | null;
  comTotalValue: number | null;
  comPermitChangePct: number | null;
  comPermitTrend: Trend;
  // Layer 5 Raw Materials
  asphaltPriceIndex: number | null;
  concretePPI: number | null;
  steelRebarIndex: number | null;
  lumberPPI: number | null;
  dieselPricePerGallon: number | null;
  aggregateDemandIndex: number | null;
  materialsCostTrend: Trend;
  // Layer 6 Civil
  fhwaObligatedM: number | null;
  samGovContractsCount: number | null;
  femaDeclarations: number | null;
  dotActiveBids: number | null;
  civilDemandScore: number;
  civilTrend: Trend;
  // Layer 7 Labor
  constructionEmployment: number | null;
  jobPostingIndex: number | null;
  contractorDensity: number | null;
  laborAvailabilityScore: number;
  laborTrend: Trend;
  // Layer 8 Weather
  avgTempF: number | null;
  freezeThawRisk: 'high' | 'medium' | 'low' | null;
  pavingSeason: 'open' | 'marginal' | 'closed' | null;
  activeFemaAlerts: number | null;
  heatingDegreeDays: number | null;
  weatherRiskScore: number;
  lastUpdated: string;
}

export interface IntelligenceApiResponse {
  fetchedAt: string;
  layer: DataLayer;
  cluster: ConstructionCluster;
  signals: StateSignal[];
  globalMeta: {
    nationalAsphaltPriceIndex: number | null;
    nationalConcretePPI: number | null;
    nationalSteelIndex: number | null;
    nationalDieselAvg: number | null;
    totalFederalObligatedBn: number | null;
    activeFemaDeclarations: number | null;
  };
}

export interface FeedEntry {
  abbr: string; state: string; headline: string;
  sub: string; value: string; trend: Trend;
  layer: DataLayer; urgency: 'critical'|'high'|'medium'|'low'; ts: string;
}

// ─── STATIC DATA ────────────────────────────────────────────────────────────
export const POLL_MS = 15 * 60 * 1000;

export const STATES: StateNode[] = [
  {abbr:'AL',name:'Alabama',x:648,y:410},{abbr:'AK',name:'Alaska',x:120,y:520},
  {abbr:'AZ',name:'Arizona',x:218,y:415},{abbr:'AR',name:'Arkansas',x:575,y:375},
  {abbr:'CA',name:'California',x:111,y:296},{abbr:'CO',name:'Colorado',x:320,y:305},
  {abbr:'CT',name:'Connecticut',x:823,y:192},{abbr:'DE',name:'Delaware',x:800,y:243},
  {abbr:'FL',name:'Florida',x:699,y:505},{abbr:'GA',name:'Georgia',x:681,y:406},
  {abbr:'HI',name:'Hawaii',x:210,y:540},{abbr:'ID',name:'Idaho',x:196,y:178},
  {abbr:'IL',name:'Illinois',x:604,y:278},{abbr:'IN',name:'Indiana',x:636,y:270},
  {abbr:'IA',name:'Iowa',x:552,y:238},{abbr:'KS',name:'Kansas',x:472,y:310},
  {abbr:'KY',name:'Kentucky',x:668,y:300},{abbr:'LA',name:'Louisiana',x:585,y:455},
  {abbr:'ME',name:'Maine',x:862,y:140},{abbr:'MD',name:'Maryland',x:777,y:255},
  {abbr:'MA',name:'Massachusetts',x:837,y:176},{abbr:'MI',name:'Michigan',x:638,y:202},
  {abbr:'MN',name:'Minnesota',x:537,y:155},{abbr:'MS',name:'Mississippi',x:614,y:420},
  {abbr:'MO',name:'Missouri',x:568,y:300},{abbr:'MT',name:'Montana',x:274,y:140},
  {abbr:'NE',name:'Nebraska',x:452,y:265},{abbr:'NV',name:'Nevada',x:169,y:295},
  {abbr:'NH',name:'New Hampshire',x:845,y:162},{abbr:'NJ',name:'New Jersey',x:809,y:221},
  {abbr:'NM',name:'New Mexico',x:294,y:395},{abbr:'NY',name:'New York',x:796,y:184},
  {abbr:'NC',name:'N. Carolina',x:729,y:333},{abbr:'ND',name:'North Dakota',x:431,y:142},
  {abbr:'OH',name:'Ohio',x:682,y:246},{abbr:'OK',name:'Oklahoma',x:477,y:370},
  {abbr:'OR',name:'Oregon',x:141,y:195},{abbr:'PA',name:'Pennsylvania',x:769,y:220},
  {abbr:'RI',name:'Rhode Island',x:833,y:186},{abbr:'SC',name:'S. Carolina',x:726,y:370},
  {abbr:'SD',name:'South Dakota',x:431,y:193},{abbr:'TN',name:'Tennessee',x:640,y:340},
  {abbr:'TX',name:'Texas',x:416,y:443},{abbr:'UT',name:'Utah',x:234,y:305},
  {abbr:'VT',name:'Vermont',x:828,y:159},{abbr:'VA',name:'Virginia',x:748,y:289},
  {abbr:'WA',name:'Washington',x:155,y:148},{abbr:'WV',name:'West Virginia',x:726,y:268},
  {abbr:'WI',name:'Wisconsin',x:583,y:193},{abbr:'WY',name:'Wyoming',x:302,y:220},
  {abbr:'DC',name:'D.C.',x:783,y:262},
];

export const CLUSTERS: Record<ConstructionCluster,{label:string;keywords:string[]}> = {
  paving:       {label:'Paving & Asphalt',   keywords:['asphalt paving contractor','driveway paving','parking lot paving','asphalt repair','pothole repair contractor','sealcoating contractor','asphalt resurfacing','commercial paving contractor']},
  concrete:     {label:'Concrete',           keywords:['concrete contractor','concrete driveway','concrete repair','flatwork concrete','concrete slab contractor','concrete paving']},
  sitework:     {label:'Site Work',          keywords:['excavation contractor','site grading contractor','land clearing contractor','dirt work contractor','earthwork contractor']},
  utilities:    {label:'Underground Util.',  keywords:['trenching contractor','underground utilities contractor','water line repair','sewer line contractor','utility installation contractor']},
  heavycivil:   {label:'Heavy Civil',        keywords:['heavy civil contractor','DOT paving contractor','VDOT contractor','infrastructure contractor','highway contractor']},
  roofing:      {label:'Commercial Roofing', keywords:['commercial roofing contractor','flat roof repair','TPO roofing contractor','roof replacement contractor']},
};

export const LAYER_META: Record<DataLayer,{label:string;icon:string;accent:string;group:string;desc:string}> = {
  construction: {label:'Construction Demand',   icon:'◈',accent:'#00d4ff',group:'demand',  desc:'Google Trends · 7-day relative search interest by state'},
  realestate:   {label:'Real Estate Activity',  icon:'⬡',accent:'#a78bfa',group:'market',  desc:'Median list price · active listings · days on market · YoY'},
  respermits:   {label:'Residential Permits',   icon:'◆',accent:'#34d399',group:'permits', desc:'Census BPS · single-family + multi-family units authorized/mo'},
  compermits:   {label:'Commercial Permits',    icon:'◇',accent:'#fbbf24',group:'permits', desc:'Census C404 · office, retail, industrial, warehouse value'},
  rawmaterials: {label:'Raw Materials',         icon:'▲',accent:'#f97316',group:'supply',  desc:'Asphalt OPIS · Concrete PPI · Steel CME · Diesel EIA · Lumber BLS'},
  civil:        {label:'Civil & Infrastructure',icon:'⬢',accent:'#06b6d4',group:'supply',  desc:'FHWA obligations · SAM.gov bids · FEMA declarations · DOT bids'},
  labor:        {label:'Labor & Capacity',      icon:'●',accent:'#e879f9',group:'capacity',desc:'BLS construction employment · job posting index · contractor density'},
  weather:      {label:'Weather & Season',      icon:'◉',accent:'#94a3b8',group:'risk',    desc:'NOAA temp · freeze-thaw risk · paving season status · HDD'},
};

// ─── PURE UTILITIES ─────────────────────────────────────────────────────────
const clamp = (v:number,lo:number,hi:number) => Math.max(lo,Math.min(hi,v));
const lerp  = (a:number,b:number,t:number)  => a+(b-a)*clamp(t,0,1);

function hexToRgb(hex:string):[number,number,number]{
  const h=hex.replace('#','');
  return[parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];
}

export function heatColor(intensity:number,accentHex:string):string{
  const t=intensity/100;
  const[ar,ag,ab]=hexToRgb(accentHex);
  return `rgb(${Math.round(lerp(5,ar,t))},${Math.round(lerp(12,ag,t))},${Math.round(lerp(20,ab,t))})`;
}

export const dotR  = (i:number) => 3.5+(i/100)*9;
export const glowR = (i:number) => dotR(i)+8+(i/100)*10;
export const trendArrow = (t:Trend) => t==='up'?'▲':t==='down'?'▼':'—';
export const trendClr   = (t:Trend) => t==='up'?'#34d399':t==='down'?'#f87171':'#334e68';

export const fmt$   = (v:number|null) => v===null?'—':v>=1_000_000?`$${(v/1_000_000).toFixed(2)}M`:v>=1_000?`$${Math.round(v/1_000)}K`:`$${v}`;
export const fmt$M  = (v:number|null) => v===null?'—':v>=1000?`$${(v/1000).toFixed(1)}B`:v>=1?`$${v.toFixed(0)}M`:`$${(v*1000).toFixed(0)}K`;
export const fmtK   = (v:number|null) => v===null?'—':v>=1_000?`${(v/1_000).toFixed(1)}K`:String(Math.round(v));
export const fmtPct = (v:number|null,d=1) => v===null?'—':`${v>0?'+':''}${v.toFixed(d)}%`;
export const fmtIdx = (v:number|null) => v===null?'—':v.toFixed(1);
export const fmtTemp= (v:number|null) => v===null?'—':`${Math.round(v)}°F`;

export function layerIntensity(sig:StateSignal,layer:DataLayer):number{
  switch(layer){
    case 'construction': return sig.constructionInterest;
    case 'realestate':   return sig.priceChangePct===null?0:clamp(50+sig.priceChangePct*4,0,100);
    case 'respermits':   return sig.resPermitChangePct===null?(sig.resTotalUnits?40:0):clamp(50+sig.resPermitChangePct*2,0,100);
    case 'compermits':   return sig.comPermitChangePct===null?(sig.comTotalValue?40:0):clamp(50+sig.comPermitChangePct*2,0,100);
    case 'rawmaterials': return sig.asphaltPriceIndex===null?0:clamp((sig.asphaltPriceIndex-80)*2.5,0,100);
    case 'civil':        return sig.civilDemandScore;
    case 'labor':        return clamp(100-sig.laborAvailabilityScore,0,100);
    case 'weather':      return sig.weatherRiskScore;
    default:             return 0;
  }
}

export function layerTrend(sig:StateSignal,layer:DataLayer):Trend{
  switch(layer){
    case 'construction': return sig.constructionTrend;
    case 'realestate':   return sig.realEstateTrend;
    case 'respermits':   return sig.resPermitTrend;
    case 'compermits':   return sig.comPermitTrend;
    case 'rawmaterials': return sig.materialsCostTrend;
    case 'civil':        return sig.civilTrend;
    case 'labor':        return sig.laborTrend;
    default:             return 'flat';
  }
}

export function urgency(intensity:number):'critical'|'high'|'medium'|'low'{
  return intensity>=80?'critical':intensity>=60?'high':intensity>=40?'medium':'low';
}

export function emptySignals():StateSignal[]{
  return STATES.map(s=>({
    abbr:s.abbr, constructionInterest:0, constructionTrend:'flat', topKeyword:'', keywordCluster:'paving',
    medianListPrice:null, activeListings:null, daysOnMarket:null, priceChangePct:null, saleToListRatio:null, realEstateTrend:'flat',
    resSingleFamily:null, resMultiFamily:null, resTotalUnits:null, resPermitChangePct:null, resPermitTrend:'flat',
    comOfficeRetail:null, comIndustrialWarehouse:null, comTotalValue:null, comPermitChangePct:null, comPermitTrend:'flat',
    asphaltPriceIndex:null, concretePPI:null, steelRebarIndex:null, lumberPPI:null, dieselPricePerGallon:null, aggregateDemandIndex:null, materialsCostTrend:'flat',
    fhwaObligatedM:null, samGovContractsCount:null, femaDeclarations:null, dotActiveBids:null, civilDemandScore:0, civilTrend:'flat',
    constructionEmployment:null, jobPostingIndex:null, contractorDensity:null, laborAvailabilityScore:50, laborTrend:'flat',
    avgTempF:null, freezeThawRisk:null, pavingSeason:null, activeFemaAlerts:null, heatingDegreeDays:null, weatherRiskScore:0,
    lastUpdated:'',
  } as StateSignal));
}

// ─── TOOLTIP SUB-COMPONENT ───────────────────────────────────────────────────
interface TooltipProps{sig:StateSignal;pos:{x:number;y:number};layer:DataLayer;accent:string;}
const Tooltip=memo(({sig,pos,layer,accent}:TooltipProps)=>{
  const name=STATES.find(s=>s.abbr===sig.abbr)?.name??sig.abbr;
  const lm=LAYER_META[layer];
  const tx=Math.min(pos.x+16,720); const ty=Math.max(pos.y-125,8);
  type Row=[string,string,string?];
  const rows:Row[]=[];
  if(layer==='construction'){
    rows.push(['SEARCH INTEREST',`${sig.constructionInterest} / 100`]);
    rows.push(['TOP KEYWORD',sig.topKeyword||'—']);
    rows.push(['CLUSTER',CLUSTERS[sig.keywordCluster]?.label??'—']);
    rows.push(['TREND',`${trendArrow(sig.constructionTrend)} ${sig.constructionTrend.toUpperCase()}`,trendClr(sig.constructionTrend)]);
  }else if(layer==='realestate'){
    rows.push(['MEDIAN LIST PRICE',fmt$(sig.medianListPrice)]);
    rows.push(['ACTIVE LISTINGS',fmtK(sig.activeListings)]);
    rows.push(['DAYS ON MARKET',sig.daysOnMarket!==null?String(sig.daysOnMarket):'—']);
    rows.push(['SALE / LIST RATIO',sig.saleToListRatio!==null?sig.saleToListRatio.toFixed(2):'—']);
    rows.push(['YoY PRICE CHG',fmtPct(sig.priceChangePct),trendClr(sig.realEstateTrend)]);
  }else if(layer==='respermits'){
    rows.push(['SINGLE-FAMILY / MO',fmtK(sig.resSingleFamily)]);
    rows.push(['MULTI-FAMILY / MO',fmtK(sig.resMultiFamily)]);
    rows.push(['TOTAL UNITS / MO',fmtK(sig.resTotalUnits)]);
    rows.push(['YoY CHANGE',fmtPct(sig.resPermitChangePct),trendClr(sig.resPermitTrend)]);
  }else if(layer==='compermits'){
    rows.push(['OFFICE + RETAIL',fmt$M(sig.comOfficeRetail)]);
    rows.push(['INDUSTRIAL + WHSE',fmt$M(sig.comIndustrialWarehouse)]);
    rows.push(['TOTAL VALUE',fmt$M(sig.comTotalValue)]);
    rows.push(['YoY CHANGE',fmtPct(sig.comPermitChangePct),trendClr(sig.comPermitTrend)]);
  }else if(layer==='rawmaterials'){
    rows.push(['ASPHALT INDEX',fmtIdx(sig.asphaltPriceIndex)]);
    rows.push(['CONCRETE PPI',fmtIdx(sig.concretePPI)]);
    rows.push(['STEEL REBAR IDX',fmtIdx(sig.steelRebarIndex)]);
    rows.push(['DIESEL $/GAL',sig.dieselPricePerGallon!==null?`$${sig.dieselPricePerGallon.toFixed(3)}`:'—']);
    rows.push(['LUMBER PPI',fmtIdx(sig.lumberPPI)]);
    rows.push(['COST TREND',`${trendArrow(sig.materialsCostTrend)} ${sig.materialsCostTrend.toUpperCase()}`,trendClr(sig.materialsCostTrend)]);
  }else if(layer==='civil'){
    rows.push(['DEMAND SCORE',`${sig.civilDemandScore} / 100`]);
    rows.push(['FHWA OBLIGATED',fmt$M(sig.fhwaObligatedM)]);
    rows.push(['FED BIDS OPEN',fmtK(sig.samGovContractsCount)]);
    rows.push(['STATE DOT BIDS',fmtK(sig.dotActiveBids)]);
    rows.push(['FEMA DECLARATIONS',fmtK(sig.femaDeclarations)]);
    rows.push(['TREND',`${trendArrow(sig.civilTrend)} ${sig.civilTrend.toUpperCase()}`,trendClr(sig.civilTrend)]);
  }else if(layer==='labor'){
    rows.push(['CONSTRUCTION EMP',`${sig.constructionEmployment?.toFixed(1)??'—'}K`]);
    rows.push(['JOB POSTING IDX',fmtIdx(sig.jobPostingIndex)]);
    rows.push(['CONTRACTOR/100K',`${sig.contractorDensity?.toFixed(0)??'—'}`]);
    rows.push(['AVAILABILITY',`${sig.laborAvailabilityScore} / 100`]);
    rows.push(['TREND',`${trendArrow(sig.laborTrend)} ${sig.laborTrend.toUpperCase()}`,trendClr(sig.laborTrend)]);
  }else{
    rows.push(['AVG TEMP',fmtTemp(sig.avgTempF)]);
    rows.push(['PAVING SEASON',sig.pavingSeason?.toUpperCase()??'—']);
    rows.push(['FREEZE-THAW',sig.freezeThawRisk?.toUpperCase()??'—']);
    rows.push(['HEAT DEG DAYS',fmtK(sig.heatingDegreeDays)]);
    rows.push(['FEMA ALERTS',fmtK(sig.activeFemaAlerts)]);
    rows.push(['OPP SCORE',`${sig.weatherRiskScore} / 100`]);
  }
  const h=30+rows.length*16+8;
  return(
    <g transform={`translate(${tx},${ty})`} style={{pointerEvents:'none'}}>
      <rect width={230} height={h} rx={3} fill="#000" opacity={0.45} transform="translate(3,3)"/>
      <rect width={230} height={h} rx={3} fill="#060e1a" stroke={accent} strokeWidth={1} opacity={0.98}/>
      <rect width={230} height={3} rx={2} fill={accent} opacity={0.9}/>
      <text x={10} y={20} fontSize={11} fontFamily="'JetBrains Mono',monospace" fontWeight="700" fill={accent} letterSpacing="1.2">
        {lm.icon}  {name.toUpperCase()}
      </text>
      {rows.map(([lbl,val,clr],i)=>(
        <g key={lbl} transform={`translate(0,${30+i*16})`}>
          <text x={10} y={0} fontSize={7.5} fontFamily="monospace" fill="#2a5a7a" letterSpacing="0.8">{lbl}</text>
          <text x={220} y={0} textAnchor="end" fontSize={8} fontFamily="monospace" fontWeight="600" fill={clr??'#aacce8'}>{val}</text>
        </g>
      ))}
    </g>
  );
});
Tooltip.displayName='Tooltip';

// ─── STATE NODE (memoised) ───────────────────────────────────────────────────
interface SNProps{
  st:StateNode; sig:StateSignal; layer:DataLayer; accent:string;
  pulse:boolean; isHovered:boolean; isSelected:boolean;
  onEnter:(abbr:string,e:RMouseEvent<SVGGElement>)=>void;
  onLeave:()=>void; onClick:(abbr:string)=>void;
}
const StateNodeEl=memo(({st,sig,layer,accent,pulse,isHovered,isSelected,onEnter,onLeave,onClick}:SNProps)=>{
  const intensity=layerIntensity(sig,layer);
  const trend=layerTrend(sig,layer);
  const r=dotR(intensity); const gr=glowR(intensity);
  const isHot=intensity>=72; const isMed=intensity>=42&&!isHot;
  const fill=layer==='weather'&&sig.pavingSeason
    ?sig.pavingSeason==='open'?'#34d399':sig.pavingSeason==='closed'?'#f87171':'#fbbf24'
    :heatColor(intensity,accent);
  let valLabel='';
  if(intensity>=68){
    if(layer==='construction')      valLabel=String(sig.constructionInterest);
    else if(layer==='realestate')   valLabel=fmt$(sig.medianListPrice);
    else if(layer==='respermits')   valLabel=fmtK(sig.resTotalUnits);
    else if(layer==='compermits')   valLabel=fmt$M(sig.comTotalValue);
    else if(layer==='rawmaterials') valLabel=fmtIdx(sig.asphaltPriceIndex);
    else if(layer==='civil')        valLabel=`${sig.civilDemandScore}`;
    else if(layer==='labor')        valLabel=`${sig.constructionEmployment?.toFixed(0)??'—'}K`;
    else if(layer==='weather')      valLabel=sig.pavingSeason?.toUpperCase().slice(0,4)??'';
  }
  return(
    <g transform={`translate(${st.x},${st.y})`} style={{cursor:'pointer'}}
      onClick={()=>onClick(st.abbr)}
      onMouseEnter={e=>onEnter(st.abbr,e)}
      onMouseLeave={onLeave}>
      {(isHot||isSelected)&&<circle r={gr} fill={accent} opacity={pulse?0.07:0.03} style={{transition:'opacity 1.6s ease-in-out'}} filter="url(#igm-bloom)"/>}
      {(isMed||isHovered)&&<circle r={r+7} fill={accent} opacity={pulse?0.13:0.06} style={{transition:'opacity 1.6s ease-in-out'}}/>}
      {isSelected&&<circle r={r+5} fill="none" stroke={accent} strokeWidth={1.5} opacity={0.85} strokeDasharray="3 2"/>}
      <circle r={r} fill={fill} stroke={intensity>15?accent:'#1a2a3a'} strokeWidth={(isSelected||isHovered)?2:intensity>50?1.5:0.8} opacity={0.95}/>
      {intensity>30&&<circle r={r*0.35} cx={-r*0.2} cy={-r*0.2} fill="#ffffff" opacity={0.13}/>}
      {intensity>20&&(
        <line x1={0} y1={-r-3} x2={0} y2={-r-3+(trend==='up'?-3:trend==='down'?3:0)}
          stroke={trendClr(trend)} strokeWidth={1.5} opacity={0.9}/>
      )}
      <text y={r+9} textAnchor="middle" fontSize={intensity>55?8.5:7.5}
        fontFamily="'JetBrains Mono','Courier New',monospace"
        fontWeight={intensity>55?'700':'500'}
        fill={intensity>35?'#e0f0ff':'#2a4a6a'} letterSpacing="0.8">
        {st.abbr}
      </text>
      {valLabel&&(
        <text y={-r-6} textAnchor="middle" fontSize={6.5}
          fontFamily="'JetBrains Mono',monospace"
          fill={accent} opacity={0.95} letterSpacing="0.3">
          {valLabel}
        </text>
      )}
    </g>
  );
});
StateNodeEl.displayName='StateNodeEl';

// ─── GLOBAL TICKER BAR ──────────────────────────────────────────────────────
interface TickerProps{meta:IntelligenceApiResponse['globalMeta']|null;}
const TickerBar:FC<TickerProps>=({meta})=>{
  if(!meta)return null;
  const items=[
    meta.nationalAsphaltPriceIndex!==null&&`ASPHALT IDX  ${fmtIdx(meta.nationalAsphaltPriceIndex)}`,
    meta.nationalConcretePPI!==null&&`CONCRETE PPI  ${fmtIdx(meta.nationalConcretePPI)}`,
    meta.nationalSteelIndex!==null&&`STEEL  ${fmtIdx(meta.nationalSteelIndex)}`,
    meta.nationalDieselAvg!==null&&`DIESEL AVG  $${meta.nationalDieselAvg.toFixed(3)}/gal`,
    meta.totalFederalObligatedBn!==null&&`FHWA OBLIGATED  $${meta.totalFederalObligatedBn.toFixed(1)}B`,
    meta.activeFemaDeclarations!==null&&`FEMA ACTIVE  ${meta.activeFemaDeclarations}`,
  ].filter(Boolean) as string[];
  return(
    <div className="igm-ticker">
      <span className="igm-ticker-label">NATIONAL INDICES</span>
      <div className="igm-ticker-track">
        <div className="igm-ticker-inner">
          {[...items,...items].map((item,i)=>(
            <span key={i} className="igm-ticker-item">{item}</span>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── FEED ENTRY ROW ──────────────────────────────────────────────────────────
const FeedRow:FC<{entry:FeedEntry;accent:string}>=({entry,accent})=>(
  <div className={`igm-feed-row igm-feed-${entry.urgency}`}>
    <span className="igm-feed-abbr" style={{color:accent}}>{entry.abbr}</span>
    <div className="igm-feed-body">
      <span className="igm-feed-headline">{entry.headline}</span>
      <span className="igm-feed-sub">{entry.sub}</span>
    </div>
    <div className="igm-feed-right">
      <span className="igm-feed-value">{entry.value}</span>
      <span className="igm-feed-ts">{entry.ts}</span>
    </div>
    <span className="igm-feed-trend" style={{color:trendClr(entry.trend)}}>{trendArrow(entry.trend)}</span>
  </div>
);

// ─── RANK ROW ────────────────────────────────────────────────────────────────
const RankRow:FC<{rank:number;sig:StateSignal;layer:DataLayer;accent:string}>=({rank,sig,layer,accent})=>{
  const name=STATES.find(s=>s.abbr===sig.abbr)?.name??sig.abbr;
  const intensity=layerIntensity(sig,layer);
  return(
    <div className="igm-rank-row">
      <span className="igm-rank-num" style={{color:rank<=3?accent:'#334e68'}}>{String(rank).padStart(2,'0')}</span>
      <span className="igm-rank-name">{name}</span>
      <div className="igm-rank-bar-wrap">
        <div className="igm-rank-bar" style={{width:`${intensity}%`,background:accent,opacity:0.15+intensity/100*0.75}}/>
      </div>
      <span className="igm-rank-val" style={{color:accent}}>{Math.round(intensity)}</span>
    </div>
  );
};

// ─── DETAIL PANEL (selected state) ──────────────────────────────────────────
interface DetailProps{sig:StateSignal;layer:DataLayer;accent:string;onClose:()=>void;}
const DetailPanel:FC<DetailProps>=({sig,layer,accent,onClose})=>{
  const name=STATES.find(s=>s.abbr===sig.abbr)?.name??sig.abbr;
  const intensity=layerIntensity(sig,layer);
  const trend=layerTrend(sig,layer);
  return(
    <div className="igm-detail">
      <div className="igm-detail-header" style={{borderColor:accent}}>
        <span className="igm-detail-title" style={{color:accent}}>{LAYER_META[layer].icon} {name.toUpperCase()}</span>
        <button className="igm-detail-close" onClick={onClose} style={{color:accent}}>✕</button>
      </div>
      <div className="igm-detail-intensity">
        <div className="igm-detail-bar-bg">
          <div className="igm-detail-bar-fill" style={{width:`${intensity}%`,background:accent}}/>
        </div>
        <span style={{color:accent}}>{Math.round(intensity)}</span>
        <span className="igm-detail-trend" style={{color:trendClr(trend)}}>{trendArrow(trend)} {trend.toUpperCase()}</span>
      </div>
      {layer==='construction'&&(
        <div className="igm-detail-grid">
          <div className="igm-detail-kv"><span>Search Interest</span><strong style={{color:accent}}>{sig.constructionInterest}/100</strong></div>
          <div className="igm-detail-kv"><span>Top Keyword</span><strong>{sig.topKeyword||'—'}</strong></div>
          <div className="igm-detail-kv"><span>Cluster</span><strong>{CLUSTERS[sig.keywordCluster]?.label}</strong></div>
        </div>
      )}
      {layer==='realestate'&&(
        <div className="igm-detail-grid">
          <div className="igm-detail-kv"><span>Median List Price</span><strong style={{color:accent}}>{fmt$(sig.medianListPrice)}</strong></div>
          <div className="igm-detail-kv"><span>Active Listings</span><strong>{fmtK(sig.activeListings)}</strong></div>
          <div className="igm-detail-kv"><span>Days on Market</span><strong>{sig.daysOnMarket??'—'}</strong></div>
          <div className="igm-detail-kv"><span>Sale/List Ratio</span><strong>{sig.saleToListRatio?.toFixed(2)??'—'}</strong></div>
          <div className="igm-detail-kv"><span>YoY Price Change</span><strong style={{color:trendClr(sig.realEstateTrend)}}>{fmtPct(sig.priceChangePct)}</strong></div>
        </div>
      )}
      {layer==='respermits'&&(
        <div className="igm-detail-grid">
          <div className="igm-detail-kv"><span>Single-Family / Mo</span><strong style={{color:accent}}>{fmtK(sig.resSingleFamily)}</strong></div>
          <div className="igm-detail-kv"><span>Multi-Family / Mo</span><strong>{fmtK(sig.resMultiFamily)}</strong></div>
          <div className="igm-detail-kv"><span>Total Units / Mo</span><strong>{fmtK(sig.resTotalUnits)}</strong></div>
          <div className="igm-detail-kv"><span>YoY Change</span><strong style={{color:trendClr(sig.resPermitTrend)}}>{fmtPct(sig.resPermitChangePct)}</strong></div>
        </div>
      )}
      {layer==='compermits'&&(
        <div className="igm-detail-grid">
          <div className="igm-detail-kv"><span>Office + Retail</span><strong style={{color:accent}}>{fmt$M(sig.comOfficeRetail)}</strong></div>
          <div className="igm-detail-kv"><span>Industrial + Whse</span><strong>{fmt$M(sig.comIndustrialWarehouse)}</strong></div>
          <div className="igm-detail-kv"><span>Total Value</span><strong>{fmt$M(sig.comTotalValue)}</strong></div>
          <div className="igm-detail-kv"><span>YoY Change</span><strong style={{color:trendClr(sig.comPermitTrend)}}>{fmtPct(sig.comPermitChangePct)}</strong></div>
        </div>
      )}
      {layer==='rawmaterials'&&(
        <div className="igm-detail-grid">
          <div className="igm-detail-kv"><span>Asphalt Index (OPIS)</span><strong style={{color:accent}}>{fmtIdx(sig.asphaltPriceIndex)}</strong></div>
          <div className="igm-detail-kv"><span>Concrete PPI (BLS)</span><strong>{fmtIdx(sig.concretePPI)}</strong></div>
          <div className="igm-detail-kv"><span>Steel Rebar (CME)</span><strong>{fmtIdx(sig.steelRebarIndex)}</strong></div>
          <div className="igm-detail-kv"><span>Diesel $/gal (EIA)</span><strong>{sig.dieselPricePerGallon!==null?`$${sig.dieselPricePerGallon.toFixed(3)}`:'—'}</strong></div>
          <div className="igm-detail-kv"><span>Lumber PPI (BLS)</span><strong>{fmtIdx(sig.lumberPPI)}</strong></div>
          <div className="igm-detail-kv"><span>Aggregate Demand</span><strong>{fmtIdx(sig.aggregateDemandIndex)}</strong></div>
        </div>
      )}
      {layer==='civil'&&(
        <div className="igm-detail-grid">
          <div className="igm-detail-kv"><span>Demand Score</span><strong style={{color:accent}}>{sig.civilDemandScore}/100</strong></div>
          <div className="igm-detail-kv"><span>FHWA Obligated</span><strong>{fmt$M(sig.fhwaObligatedM)}</strong></div>
          <div className="igm-detail-kv"><span>Fed Bids (SAM.gov)</span><strong>{fmtK(sig.samGovContractsCount)}</strong></div>
          <div className="igm-detail-kv"><span>State DOT Bids</span><strong>{fmtK(sig.dotActiveBids)}</strong></div>
          <div className="igm-detail-kv"><span>FEMA Declarations</span><strong style={{color:sig.femaDeclarations?'#f97316':'inherit'}}>{fmtK(sig.femaDeclarations)}</strong></div>
        </div>
      )}
      {layer==='labor'&&(
        <div className="igm-detail-grid">
          <div className="igm-detail-kv"><span>Construction Emp.</span><strong style={{color:accent}}>{sig.constructionEmployment?.toFixed(1)??'—'}K</strong></div>
          <div className="igm-detail-kv"><span>Job Posting Index</span><strong>{fmtIdx(sig.jobPostingIndex)}</strong></div>
          <div className="igm-detail-kv"><span>Contractors/100K</span><strong>{sig.contractorDensity?.toFixed(0)??'—'}</strong></div>
          <div className="igm-detail-kv"><span>Availability Score</span><strong>{sig.laborAvailabilityScore}/100</strong></div>
        </div>
      )}
      {layer==='weather'&&(
        <div className="igm-detail-grid">
          <div className="igm-detail-kv"><span>Avg Temperature</span><strong style={{color:accent}}>{fmtTemp(sig.avgTempF)}</strong></div>
          <div className="igm-detail-kv"><span>Paving Season</span><strong style={{color:sig.pavingSeason==='open'?'#34d399':sig.pavingSeason==='closed'?'#f87171':'#fbbf24'}}>{sig.pavingSeason?.toUpperCase()??'—'}</strong></div>
          <div className="igm-detail-kv"><span>Freeze-Thaw Risk</span><strong style={{color:sig.freezeThawRisk==='high'?'#f87171':sig.freezeThawRisk==='medium'?'#fbbf24':'#34d399'}}>{sig.freezeThawRisk?.toUpperCase()??'—'}</strong></div>
          <div className="igm-detail-kv"><span>Heating Degree Days</span><strong>{fmtK(sig.heatingDegreeDays)}</strong></div>
          <div className="igm-detail-kv"><span>FEMA Alerts Active</span><strong style={{color:sig.activeFemaAlerts?'#f97316':'inherit'}}>{fmtK(sig.activeFemaAlerts)}</strong></div>
          <div className="igm-detail-kv"><span>Opportunity Score</span><strong style={{color:accent}}>{sig.weatherRiskScore}/100</strong></div>
        </div>
      )}
    </div>
  );
};

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────────
export default function IronGridMap(){
  const[activeLayer,setActiveLayer]   =useState<DataLayer>('construction');
  const[activeCluster,setActiveCluster]=useState<ConstructionCluster>('paving');
  const[signals,setSignals]           =useState<StateSignal[]>(emptySignals());
  const[feed,setFeed]                 =useState<FeedEntry[]>([]);
  const[globalMeta,setGlobalMeta]     =useState<IntelligenceApiResponse['globalMeta']|null>(null);
  const[loading,setLoading]           =useState(true);
  const[error,setError]               =useState<string|null>(null);
  const[fetchedAt,setFetchedAt]       =useState('');
  const[hoveredAbbr,setHoveredAbbr]   =useState<string|null>(null);
  const[hoveredPos,setHoveredPos]     =useState<{x:number;y:number}|null>(null);
  const[selectedAbbr,setSelectedAbbr] =useState<string|null>(null);
  const[pulse,setPulse]               =useState(false);
  const[scanY,setScanY]               =useState(0);

  const pollRef   =useRef<ReturnType<typeof setInterval>|null>(null);
  const feedRef   =useRef<HTMLDivElement|null>(null);
  const feedPos   =useRef(0);
  const feedAnim  =useRef(0);
  const stateMap  =useMemo(()=>new Map(STATES.map(s=>[s.abbr,s])),[]);
  const lm        =LAYER_META[activeLayer];

  // Pulse + scanline
  useEffect(()=>{
    const p=setInterval(()=>setPulse(v=>!v),1600);
    const s=setInterval(()=>setScanY(y=>(y+2.5)%580),16);
    return()=>{clearInterval(p);clearInterval(s);};
  },[]);

  // Feed scroll
  useEffect(()=>{
    const el=feedRef.current;
    if(!el||feed.length===0)return;
    cancelAnimationFrame(feedAnim.current);
    const run=()=>{
      feedPos.current+=0.45;
      if(feedPos.current>=el.scrollHeight/2)feedPos.current=0;
      el.scrollTop=feedPos.current;
      feedAnim.current=requestAnimationFrame(run);
    };
    feedAnim.current=requestAnimationFrame(run);
    return()=>cancelAnimationFrame(feedAnim.current);
  },[feed]);

  // Data fetch
  const fetchData=useCallback(async(layer:DataLayer,cluster:ConstructionCluster)=>{
    setLoading(true);setError(null);
    try{
      const res=await fetch(`/api/intelligence?layer=${layer}&cluster=${cluster}`);
      if(!res.ok)throw new Error(`API ${res.status}`);
      const data:IntelligenceApiResponse=await res.json();
      const map:Record<string,StateSignal>={};
      data.signals.forEach(s=>{map[s.abbr]=s;});
      setSignals(STATES.map(st=>map[st.abbr]??{...emptySignals().find(e=>e.abbr===st.abbr)!,lastUpdated:data.fetchedAt}));
      setFetchedAt(data.fetchedAt);
      setGlobalMeta(data.globalMeta);
      // Build feed
      const sorted=[...data.signals]
        .filter(s=>layerIntensity(s,layer)>25)
        .sort((a,b)=>layerIntensity(b,layer)-layerIntensity(a,layer))
        .slice(0,20);
      setFeed(sorted.map(sig=>{
        const name=stateMap.get(sig.abbr)?.name??sig.abbr;
        const ts=sig.lastUpdated?new Date(sig.lastUpdated).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',hour12:true}):'—';
        const intensity=layerIntensity(sig,layer);
        let headline='',sub='',value='';
        if(layer==='construction'){headline=sig.topKeyword||'Signal active';sub=CLUSTERS[sig.keywordCluster]?.label;value=`${sig.constructionInterest}/100`;}
        else if(layer==='realestate'){headline=`Median ${fmt$(sig.medianListPrice)}`;sub=`${fmtK(sig.activeListings)} listings · ${sig.daysOnMarket??'—'} DOM`;value=`${fmtPct(sig.priceChangePct)} YoY`;}
        else if(layer==='respermits'){headline=`${fmtK(sig.resTotalUnits)} units/mo`;sub=`SF ${fmtK(sig.resSingleFamily)} · MF ${fmtK(sig.resMultiFamily)}`;value=`${fmtPct(sig.resPermitChangePct)} YoY`;}
        else if(layer==='compermits'){headline=`${fmt$M(sig.comTotalValue)} permitted`;sub='Office/Retail + Industrial/Whse';value=`${fmtPct(sig.comPermitChangePct)} YoY`;}
        else if(layer==='rawmaterials'){headline=`Asphalt ${fmtIdx(sig.asphaltPriceIndex)}`;sub=`Diesel $${sig.dieselPricePerGallon?.toFixed(2)??'—'} · Steel ${fmtIdx(sig.steelRebarIndex)}`;value=`PPI ${fmtIdx(sig.concretePPI)}`;}
        else if(layer==='civil'){headline=`${fmtK(sig.samGovContractsCount)} fed bids`;sub=`FHWA ${fmt$M(sig.fhwaObligatedM)} obligated`;value=`Score ${sig.civilDemandScore}`;}
        else if(layer==='labor'){headline=`${sig.constructionEmployment?.toFixed(1)??'—'}K employed`;sub=`${sig.contractorDensity?.toFixed(0)??'—'} contractors/100K`;value=`Avail ${sig.laborAvailabilityScore}`;}
        else{headline=sig.pavingSeason?`Season ${sig.pavingSeason.toUpperCase()}`:'Pending';sub=`${fmtTemp(sig.avgTempF)} · FT:${sig.freezeThawRisk??'—'}`;value=`Opp ${sig.weatherRiskScore}`;}
        return{abbr:sig.abbr,state:name,headline,sub,value,trend:layerTrend(sig,layer),layer,urgency:urgency(intensity),ts};
      }));
    }catch(e){
      setError(e instanceof Error?e.message:'Fetch failed');
      setSignals(emptySignals());setFeed([]);
    }finally{setLoading(false);}
  },[stateMap]);

  useEffect(()=>{
    fetchData(activeLayer,activeCluster);
    if(pollRef.current)clearInterval(pollRef.current);
    pollRef.current=setInterval(()=>fetchData(activeLayer,activeCluster),POLL_MS);
    return()=>{if(pollRef.current)clearInterval(pollRef.current);};
  },[activeLayer,activeCluster,fetchData]);

  const sigMap=useMemo(()=>Object.fromEntries(signals.map(s=>[s.abbr,s])),[signals]);
  const topStates=useMemo(()=>[...signals].filter(s=>layerIntensity(s,activeLayer)>0).sort((a,b)=>layerIntensity(b,activeLayer)-layerIntensity(a,activeLayer)).slice(0,7),[signals,activeLayer]);
  const hoveredSig=hoveredAbbr?sigMap[hoveredAbbr]:null;
  const selectedSig=selectedAbbr?sigMap[selectedAbbr]:null;

  const handleEnter=useCallback((abbr:string,e:RMouseEvent<SVGGElement>)=>{
    setHoveredAbbr(abbr);
    const svg=(e.currentTarget as SVGGElement).closest('svg');
    if(svg){const r=svg.getBoundingClientRect();setHoveredPos({x:e.clientX-r.left,y:e.clientY-r.top});}
  },[]);
  const handleLeave =useCallback(()=>{setHoveredAbbr(null);setHoveredPos(null);},[]);
  const handleClick =useCallback((abbr:string)=>setSelectedAbbr(s=>s===abbr?null:abbr),[]);

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return(
    <div className="igm-root" style={{'--accent':lm.accent} as React.CSSProperties}>

      {/* ── GLOBAL TICKER ── */}
      <TickerBar meta={globalMeta}/>

      {/* ── TOP BAR ── */}
      <header className="igm-topbar">
        <div className="igm-topbar-left">
          <span className="igm-wordmark">J. WORDEN &amp; SONS</span>
          <span className="igm-topbar-div">|</span>
          <span className="igm-topbar-layer" style={{color:lm.accent}}>{lm.icon} {lm.label.toUpperCase()}</span>
        </div>
        <div className="igm-topbar-center">
          <span className={`igm-status-dot ${loading?'igm-s-loading':error?'igm-s-error':'igm-s-live'}`}/>
          <span className="igm-status-txt">{loading?'ACQUIRING':error?'SIGNAL LOST':'LIVE'}</span>
          {!loading&&!error&&fetchedAt&&(
            <span className="igm-ts">
              {new Date(fetchedAt).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',hour12:true})}
              <span className="igm-ts-note"> · 15 MIN REFRESH</span>
            </span>
          )}
        </div>
        <div className="igm-topbar-right">
          <span className="igm-coverage">51-STATE COVERAGE</span>
          <button className="igm-refresh-btn" onClick={()=>fetchData(activeLayer,activeCluster)} disabled={loading} title="Refresh now">
            <span className={loading?'igm-spin':''}>{loading?'⟳':'↺'}</span>
          </button>
        </div>
      </header>

      {/* ── LAYER NAV ── */}
      <nav className="igm-layers">
        {(Object.keys(LAYER_META) as DataLayer[]).map(lk=>{
          const cfg=LAYER_META[lk];
          return(
            <button key={lk} className={`igm-layer-btn ${activeLayer===lk?'igm-layer-active':''}`}
              style={activeLayer===lk?{'--btn-accent':cfg.accent} as React.CSSProperties:{}}
              onClick={()=>setActiveLayer(lk)}
              title={cfg.desc}>
              <span className="igm-layer-icon">{cfg.icon}</span>
              <span className="igm-layer-lbl">{cfg.label}</span>
            </button>
          );
        })}
      </nav>

      {/* ── CLUSTER ROW (construction only) ── */}
      {activeLayer==='construction'&&(
        <div className="igm-clusters">
          {(Object.keys(CLUSTERS) as ConstructionCluster[]).map(ck=>(
            <button key={ck} className={`igm-cluster-btn ${activeCluster===ck?'igm-cluster-active':''}`}
              style={activeCluster===ck?{color:lm.accent,borderColor:lm.accent+'88'}:{}}
              onClick={()=>setActiveCluster(ck)}>
              {CLUSTERS[ck].label}
            </button>
          ))}
        </div>
      )}

      {/* ── BODY ── */}
      <div className="igm-body">

        {/* ── MAP ── */}
        <div className="igm-map-wrap">
          {error&&<div className="igm-error-banner">⚠ {error} — check /api/intelligence endpoint</div>}
          <svg viewBox="0 0 960 580" className="igm-svg" aria-label="51-state construction intelligence map">
            <defs>
              <radialGradient id="igm-bg" cx="50%" cy="45%" r="55%">
                <stop offset="0%" stopColor="#0a1525"/>
                <stop offset="100%" stopColor="#040a10"/>
              </radialGradient>
              <filter id="igm-bloom" x="-80%" y="-80%" width="260%" height="260%">
                <feGaussianBlur stdDeviation="7" result="blur"/>
                <feComposite in="SourceGraphic" in2="blur" operator="over"/>
              </filter>
              <pattern id="igm-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke={lm.accent} strokeWidth="0.15" opacity="0.07"/>
              </pattern>
            </defs>
            <rect width="960" height="580" fill="url(#igm-bg)"/>
            <rect width="960" height="580" fill="url(#igm-grid)"/>
            {/* Scanline sweep */}
            <line x1={0} y1={scanY} x2={960} y2={scanY} stroke={lm.accent} strokeWidth={1.5} opacity={0.06}/>
            <line x1={0} y1={scanY-2} x2={960} y2={scanY-2} stroke={lm.accent} strokeWidth={0.5} opacity={0.03}/>
            {/* Corner brackets */}
            {([[0,0,1,1],[960,0,-1,1],[0,580,1,-1],[960,580,-1,-1]] as [number,number,number,number][]).map(([cx,cy,sx,sy],i)=>(
              <g key={i} transform={`translate(${cx},${cy}) scale(${sx},${sy})`}>
                <line x1={0} y1={0} x2={32} y2={0} stroke={lm.accent} strokeWidth={1.5} opacity={0.5}/>
                <line x1={0} y1={0} x2={0} y2={32} stroke={lm.accent} strokeWidth={1.5} opacity={0.5}/>
                <line x1={3} y1={0} x2={3} y2={3} stroke={lm.accent} strokeWidth={1} opacity={0.3}/>
              </g>
            ))}
            {/* State nodes */}
            {STATES.map(st=>{
              const sig=sigMap[st.abbr];
              if(!sig)return null;
              return<StateNodeEl key={st.abbr} st={st} sig={sig} layer={activeLayer} accent={lm.accent}
                pulse={pulse} isHovered={hoveredAbbr===st.abbr} isSelected={selectedAbbr===st.abbr}
                onEnter={handleEnter} onLeave={handleLeave} onClick={handleClick}/>;
            })}
            {/* Tooltip */}
            {hoveredSig&&hoveredPos&&<Tooltip sig={hoveredSig} pos={hoveredPos} layer={activeLayer} accent={lm.accent}/>}
            {/* Legend */}
            <g transform="translate(20,552)">
              {[0,25,50,75,100].map((v,i)=>(
                <g key={v} transform={`translate(${i*58},0)`}>
                  <circle r={4} fill={heatColor(v,lm.accent)}/>
                  <text x={8} y={4} fontSize={7.5} fontFamily="monospace" fill="#2a4a6a">{v}</text>
                </g>
              ))}
              <text x={320} y={4} fontSize={7} fontFamily="monospace" fill="#1a3a5a">{lm.desc}</text>
            </g>
          </svg>
          {loading&&(
            <div className="igm-loading-overlay">
              <div className="igm-spinner"/>
              <span>ACQUIRING SIGNAL…</span>
            </div>
          )}
        </div>

        {/* ── SIDEBAR ── */}
        <aside className="igm-sidebar">
          {/* Top states ranking */}
          <div className="igm-panel">
            <div className="igm-panel-hdr">TOP STATES <span className="igm-panel-layer" style={{color:lm.accent}}>{lm.icon} {activeLayer.toUpperCase()}</span></div>
            {topStates.length===0&&!loading
              ?<div className="igm-empty">No signal — check API endpoint</div>
              :topStates.map((sig,i)=><RankRow key={sig.abbr} rank={i+1} sig={sig} layer={activeLayer} accent={lm.accent}/>)
            }
          </div>

          {/* Detail panel — selected state */}
          {selectedSig&&(
            <DetailPanel sig={selectedSig} layer={activeLayer} accent={lm.accent} onClose={()=>setSelectedAbbr(null)}/>
          )}

          {/* Live feed */}
          <div className="igm-panel igm-panel-feed">
            <div className="igm-panel-hdr">
              LIVE SIGNAL FEED
              <span className={`igm-feed-dot ${loading?'igm-s-loading':'igm-s-live'}`}/>
            </div>
            <div className="igm-feed-scroll" ref={feedRef}>
              {[...feed,...feed].map((e,i)=><FeedRow key={i} entry={e} accent={lm.accent}/>)}
              {feed.length===0&&!loading&&<div className="igm-empty">{error?'Feed unavailable':'No signals above threshold'}</div>}
            </div>
          </div>

          {/* Keywords / data sources */}
          <div className="igm-panel">
            <div className="igm-panel-hdr">DATA SOURCES</div>
            <div className="igm-sources">
              {activeLayer==='construction'&&CLUSTERS[activeCluster].keywords.map(kw=>(
                <div key={kw} className="igm-source-tag" style={{borderColor:lm.accent+'33'}}>{kw}</div>
              ))}
              {activeLayer==='realestate'&&['Zillow Research API','ATTOM Data','MLS Aggregator','Census ACS'].map(s=>(
                <div key={s} className="igm-source-tag" style={{borderColor:lm.accent+'33'}}>{s}</div>
              ))}
              {activeLayer==='respermits'&&['Census Bureau BPS','HUD State of Cities','NAHB Housing Data'].map(s=>(
                <div key={s} className="igm-source-tag" style={{borderColor:lm.accent+'33'}}>{s}</div>
              ))}
              {activeLayer==='compermits'&&['Census C404','McGraw-Hill Dodge','CoStar Analytics'].map(s=>(
                <div key={s} className="igm-source-tag" style={{borderColor:lm.accent+'33'}}>{s}</div>
              ))}
              {activeLayer==='rawmaterials'&&['OPIS Asphalt Prices','BLS Producer Price Index','CME Steel Futures','EIA Diesel Prices','USGS Mineral Commodities'].map(s=>(
                <div key={s} className="igm-source-tag" style={{borderColor:lm.accent+'33'}}>{s}</div>
              ))}
              {activeLayer==='civil'&&['FHWA FMIS','SAM.gov Contracts','FEMA Declarations API','State DOT Portals'].map(s=>(
                <div key={s} className="igm-source-tag" style={{borderColor:lm.accent+'33'}}>{s}</div>
              ))}
              {activeLayer==='labor'&&['BLS QCEW','BLS JOLTS','Indeed Hiring Lab','State Licensing Boards'].map(s=>(
                <div key={s} className="igm-source-tag" style={{borderColor:lm.accent+'33'}}>{s}</div>
              ))}
              {activeLayer==='weather'&&['NOAA Climate Data','NWS API','FEMA Hazard Data','Degree Day Calculator'].map(s=>(
                <div key={s} className="igm-source-tag" style={{borderColor:lm.accent+'33'}}>{s}</div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
