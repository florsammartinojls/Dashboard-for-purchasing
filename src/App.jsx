import{useState,useMemo,useCallback,useEffect,useRef}from"react";
import{BarChart,Bar,LineChart,Line,ComposedChart,XAxis,YAxis,CartesianGrid,Tooltip,Legend,ResponsiveContainer}from"recharts";

const API='https://script.google.com/macros/s/AKfycbzt83RC7YYrE59ATSs8E5g9724bMdZPwepFHXDU-mM6IJ4g719ixQDj7x6wVoYg_grk9Q/exec';
let _jid=0;
function jp(url,t=60000){return new Promise((res,rej)=>{const cb='__jp'+(++_jid)+'_'+Date.now();const tm=setTimeout(()=>{cl();rej(new Error('Timeout'))},t);const s=document.createElement('script');function cl(){clearTimeout(tm);delete window[cb];s.parentNode&&s.parentNode.removeChild(s)}window[cb]=d=>{cl();res(d)};s.src=url+(url.includes('?')?'&':'?')+'callback='+cb;s.onerror=()=>{cl();rej(new Error('Network'))};document.head.appendChild(s)})}
function apiCall(a){return jp(API+'?action='+a+'&_t='+Date.now())}

const R=n=>n==null?"\u2014":Math.round(n).toLocaleString("en-US");
const D=n=>n==null?"\u2014":"$"+Math.round(n).toLocaleString("en-US");
const D2=n=>n==null?"\u2014":"$"+n.toLocaleString("en-US",{maximumFractionDigits:2});
const D4=n=>"$"+n.toFixed(4);
const P=n=>n==null?"\u2014":n.toFixed(1)+"%";
const MN=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const YR_C={2023:"#8b5cf6",2024:"#3b82f6",2025:"#22c55e",2026:"#f59e0b"};
const OOS_C={2023:"#ef4444",2024:"#f87171",2025:"#fca5a5",2026:"#fecaca"};
const BLUE="#3b82f6",TEAL="#2dd4bf",GREEN="#22c55e",YELLOW="#eab308";
const TT={contentStyle:{backgroundColor:"#1f2937",border:"1px solid #374151",borderRadius:"8px"}};
const DOMESTIC=["us","usa","united states",""];
const DEC_OPTS=["","Bought","No Recommendation","Sourcing","Ignore"];
const JLS_CONTACT="704-345-4660 | Purchasing@JLSTradingCo.com";

function getStatus(doc,lt,buf,th){const cd=th?.critDays||lt,wd=th?.warnDays||(lt+buf);return doc<=cd?"critical":doc<=wd?"warning":"healthy"}
function calcAllIn(c){return(c.raw||0)+(c.inb||0)+(c.pp||0)+(c.jfn||0)+(c.pq||0)+(c.ji||0)+(c.fba||0)}
function calcNeedQty(c,td){return Math.ceil(Math.max(0,td*c.dsr-calcAllIn(c)))}
function calcOrderQty(nq,moq){return nq<=0?0:Math.max(nq,moq||0)}
function calcDocAfter(c,oq){return oq<=0?Math.round(c.doc):c.dsr>0?Math.round((calcAllIn(c)+oq)/c.dsr):999}
function isDom(co){return DOMESTIC.includes((co||"").toLowerCase().trim())}
function getTD(v,stg){return isDom(v?.country)?stg.domesticDoc:stg.intlDoc}
function fmtTs(ts){if(!ts)return"";try{const d=new Date(ts);return isNaN(d.getTime())?"":d.toLocaleTimeString()}catch{return""}}
function fmtEta(s){if(!s)return"";try{const p=s.split("-");if(p.length===3)return MN[parseInt(p[1])-1]+" "+parseInt(p[2])+", "+p[0];return s}catch{return s}}
function cLbl(rec){return MN[(rec.m||1)-1]+" "+String(rec.y||0).slice(2)}
function fmtDay(s){if(!s)return"";try{const p=s.split("-");return MN[parseInt(p[1])-1]+" "+parseInt(p[2])}catch{return s}}
function tdStr(){return new Date().toISOString().split('T')[0]}
function fmtSlash(s){if(!s)return"";try{const p=s.split("-");return p[1]+"/"+p[2]+"/"+p[0]}catch{return s}}
function curMonth(){const d=new Date();return{y:d.getFullYear(),m:d.getMonth()+1}}

function calcSeasonal(coreId,hist){
  const ms=(hist||[]).filter(h=>h.core===coreId);if(ms.length<6)return null;
  const byM={};ms.forEach(h=>{if(!byM[h.m])byM[h.m]=[];byM[h.m].push(h.avgDsr)});
  const avgByM={};Object.entries(byM).forEach(([m,v])=>{avgByM[m]=v.reduce((a,b)=>a+b,0)/v.length});
  const vals=Object.values(avgByM);const mn=vals.reduce((a,b)=>a+b,0)/vals.length;
  if(mn===0)return null;const cv=Math.sqrt(vals.reduce((a,b)=>a+Math.pow(b-mn,2),0)/vals.length)/mn;
  if(cv<=0.3)return null;
  const qA={Q1:0,Q2:0,Q3:0,Q4:0},qN={Q1:0,Q2:0,Q3:0,Q4:0};
  Object.entries(avgByM).forEach(([m,v])=>{const mi=parseInt(m);const q=mi<=3?"Q1":mi<=6?"Q2":mi<=9?"Q3":"Q4";qA[q]+=v;qN[q]++});
  Object.keys(qA).forEach(q=>{if(qN[q]>0)qA[q]/=qN[q]});
  return{cv:cv.toFixed(2),peak:Object.entries(qA).sort((a,b)=>b[1]-a[1])[0][0]};
}

// === PO PDF ===
function genPOPdf(vendor,items,poNum,buyer,poDate){
  const addr=vendor.address||[vendor.address1,vendor.address2,vendor.city,vendor.state,vendor.zip].filter(Boolean).join(', ');
  const useCases=vendor.vou==='Cases';
  let rows='';let sub=0;
  items.forEach(i=>{
    const dq=useCases?Math.ceil(i.qty/(i.casePack||1)):i.qty;
    const pp=useCases?(i.cost*(i.casePack||1)):i.cost;
    const tot=dq*pp;sub+=tot;
    rows+=`<tr><td>${i.vsku||i.id}</td><td>${i.ti||''}</td><td style="text-align:right">${dq}</td><td style="text-align:right">$${pp.toFixed(2)}</td><td style="text-align:right">$${tot.toFixed(2)}</td></tr>`;
  });
  for(let i=items.length;i<20;i++)rows+='<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td></tr>';
  const html=`<!DOCTYPE html><html><head><title>PO ${poNum||''}</title><style>body{font-family:Arial,sans-serif;margin:40px;font-size:12px}h1{font-size:20px;margin:0 0 30px}table.info{width:100%;margin-bottom:10px}table.info td{padding:2px 8px;vertical-align:top}table.items{width:100%;border-collapse:collapse;margin-top:20px}table.items th,table.items td{border:1px solid #999;padding:6px 8px}table.items th{background:#f0f0f0;text-align:left}.addr{display:flex;gap:40px}.addr div{flex:1}@media print{body{margin:20px}}</style></head><body>
  <h1>JLS Trading Co. Purchase Order</h1>
  <table class="info"><tr><td><b>Date:</b> ${fmtSlash(poDate||tdStr())}</td><td><b>Order #:</b> ${poNum||''}</td></tr><tr><td><b>Buyer:</b> ${buyer||''}</td><td></td></tr><tr><td><b>Contact:</b> ${JLS_CONTACT}</td><td></td></tr></table>
  <table class="info"><tr><td><b>Seller:</b> ${vendor.name}</td></tr><tr><td><b>Rep:</b> ${vendor.contactName||'N/A'}</td></tr><tr><td><b>Address:</b> ${addr}</td></tr><tr><td><b>Email:</b> ${vendor.contactEmail||''}</td></tr></table>
  <div class="addr"><div><b>Ship To</b><br>JLS Trading Co.<br>ATTN: Receiving<br>5301 Terminal St<br>Charlotte, NC 28208</div><div><b>Bill To</b><br>JLS Trading Co.<br>ATTN: Accounts Payable<br>2198 Argentum Ave<br>Indian Land, SC 29707</div></div>
  <table class="info"><tr><td><b>Payment:</b> ${vendor.payment||''}</td></tr></table>
  <table class="items"><thead><tr><th>SKU</th><th>Item</th><th style="text-align:right">${useCases?'Cases':'Qty'}</th><th style="text-align:right">Price Per</th><th style="text-align:right">Total</th></tr></thead><tbody>${rows}<tr style="font-weight:bold"><td colspan="4" style="text-align:right">Sub-Total</td><td style="text-align:right">$${sub.toFixed(2)}</td></tr></tbody></table>
  <script>window.onload=function(){window.print()}<\/script></body></html>`;
  const w=window.open('','_blank');w.document.write(html);w.document.close();
}

// === 7f/7g COPY ===
function copyTo7f(v,items,poNum,buyer,eta){
  const dt=fmtSlash(tdStr());const e=eta?fmtSlash(eta):'';
  const rows=items.map(i=>{const cs=v.vou==='Cases'?Math.ceil(i.qty/(i.casePack||1)):'';
    return[dt,v.name,i.ti||'',i.vsku||'',i.qty,cs,i.id,buyer||'',D4(i.cost),v.country||'',v.terms||'',e,poNum||'','-'].join('\t')});
  navigator.clipboard.writeText(rows.join('\n'));
}
function copyTo7g(v,items,poNum,buyer){
  const dt=fmtSlash(tdStr());
  const rows=items.map(i=>[dt,buyer||'',i.id,i.qty,D2(i.qty*i.cost),i.inbShip?'$'+i.inbShip.toFixed(2):'$0.00','$0.00','$0.00',v.name].join('\t'));
  navigator.clipboard.writeText(rows.join('\n'));
}

// === COMPONENTS ===
function Dot({status}){return<span className={`inline-block w-3 h-3 rounded-full ${status==="critical"?"bg-red-500 animate-pulse":status==="warning"?"bg-amber-500":"bg-emerald-500"}`}/>}
function Loader({text}){return<div className="flex items-center justify-center py-20"><div className="text-center"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"/><p className="text-gray-400 text-sm">{text}</p></div></div>}
function Toast({msg,onClose}){useEffect(()=>{const t=setTimeout(onClose,3000);return()=>clearTimeout(t)},[onClose]);return<div className="fixed bottom-4 right-4 bg-emerald-600 text-white px-4 py-3 rounded-lg shadow-xl z-50">{"\u2705"} {msg}</div>}

function SearchSelect({value,onChange,options,placeholder}){
  const[open,setOpen]=useState(false);const[q,setQ]=useState("");const ref=useRef(null);
  useEffect(()=>{function h(e){if(ref.current&&!ref.current.contains(e.target))setOpen(false)}document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h)},[]);
  const filtered=options.filter(o=>o.toLowerCase().includes(q.toLowerCase()));
  return<div ref={ref} className="relative"><input type="text" value={open?q:(value||"")} placeholder={placeholder||"All Vendors"} onFocus={()=>{setOpen(true);setQ("")}} onChange={e=>{setQ(e.target.value);setOpen(true)}} className="bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg px-2 py-1.5 w-48"/>
    {open&&<div className="absolute z-40 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-80 overflow-auto w-56"><button onClick={()=>{onChange("");setOpen(false)}} className="w-full text-left px-3 py-1.5 text-sm text-gray-400 hover:bg-gray-700">All Vendors</button>{filtered.map(o=><button key={o} onClick={()=>{onChange(o);setOpen(false);setQ("")}} className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-700 ${o===value?"text-blue-400":"text-gray-300"}`}>{o}</button>)}</div>}</div>}

function SettingsModal({s,setS,onClose}){
  const[l,setL]=useState({...s});
  return<div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center" onClick={onClose}><div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md" onClick={e=>e.stopPropagation()}>
    <h2 className="text-lg font-semibold text-white mb-4">Settings</h2>
    <div className="space-y-4">
      <div><label className="text-sm text-gray-400 block mb-1">Buyer Initials</label><input type="text" value={l.buyer||''} onChange={e=>setL({...l,buyer:e.target.value})} placeholder="TG" className="bg-gray-800 border border-gray-600 text-white rounded px-3 py-2 w-full"/></div>
      <div className="grid grid-cols-2 gap-3"><div><label className="text-sm text-gray-400 block mb-1">Domestic DOC</label><input type="number" value={l.domesticDoc} onChange={e=>setL({...l,domesticDoc:+e.target.value})} className="bg-gray-800 border border-gray-600 text-white rounded px-3 py-2 w-full"/></div><div><label className="text-sm text-gray-400 block mb-1">Intl DOC</label><input type="number" value={l.intlDoc} onChange={e=>setL({...l,intlDoc:+e.target.value})} className="bg-gray-800 border border-gray-600 text-white rounded px-3 py-2 w-full"/></div></div>
      <div><label className="text-sm text-gray-400 block mb-1">Critical</label><select value={l.critMode} onChange={e=>setL({...l,critMode:e.target.value})} className="bg-gray-800 border border-gray-600 text-white rounded px-3 py-2 w-full"><option value="lt">Lead Time</option><option value="custom">Custom</option></select>{l.critMode==="custom"&&<input type="number" value={l.critDays} onChange={e=>setL({...l,critDays:+e.target.value})} className="mt-2 bg-gray-800 border border-gray-600 text-white rounded px-3 py-2 w-full"/>}</div>
      <div><label className="text-sm text-gray-400 block mb-1">Warning</label><select value={l.warnMode} onChange={e=>setL({...l,warnMode:e.target.value})} className="bg-gray-800 border border-gray-600 text-white rounded px-3 py-2 w-full"><option value="ltbuf">LT+Buffer</option><option value="custom">Custom</option></select>{l.warnMode==="custom"&&<input type="number" value={l.warnDays} onChange={e=>setL({...l,warnDays:+e.target.value})} className="mt-2 bg-gray-800 border border-gray-600 text-white rounded px-3 py-2 w-full"/>}</div>
      <div className="border-t border-gray-700 pt-4 space-y-3">{[["Active","fA"],["Visible","fV"]].map(([lb,k])=><div key={k} className="flex items-center justify-between"><span className="text-sm text-gray-300">{lb}</span><select value={l[k]} onChange={e=>setL({...l,[k]:e.target.value})} className="bg-gray-800 border border-gray-600 text-white rounded px-2 py-1 text-sm w-28"><option value="yes">Yes</option><option value="no">No</option><option value="all">All</option></select></div>)}<div className="flex items-center justify-between"><span className="text-sm text-gray-300">Ignored</span><select value={l.fI} onChange={e=>setL({...l,fI:e.target.value})} className="bg-gray-800 border border-gray-600 text-white rounded px-2 py-1 text-sm w-28"><option value="blank">Blank</option><option value="set">Not Blank</option><option value="all">All</option></select></div></div></div>
    <div className="flex gap-3 mt-6"><button onClick={()=>{setS(l);onClose()}} className="flex-1 bg-blue-600 text-white rounded-lg py-2 font-medium">Save</button><button onClick={onClose} className="flex-1 bg-gray-700 text-white rounded-lg py-2 font-medium">Cancel</button></div>
  </div></div>}

// === GLOSSARY ===
const DEF_GL=[{term:"C.DSR",desc:"Composite Daily Sales Rate."},{term:"DOC",desc:"Days of Coverage = All-In / DSR."},{term:"7f",desc:"Receiving Ledger."},{term:"7g",desc:"COGS Ledger."}];
function GlossaryTab({gl,setGl}){return<div className="p-4 max-w-4xl mx-auto"><h2 className="text-xl font-bold text-white mb-4">Glossary</h2><div className="space-y-1">{gl.map((g,i)=><div key={i} className={`flex gap-4 py-3 px-4 rounded-lg ${i%2===0?"bg-gray-900/50":""}`}><span className="text-blue-400 font-mono font-semibold text-sm min-w-[120px]">{g.term}</span><span className="text-gray-300 text-sm">{g.desc}</span></div>)}</div></div>}

// === PURCHASING TAB ===
function PurchasingTab({data,stg,onViewCore,daily,ov,setOv}){
  const[vm,setVm]=useState("core");const[sortBy,setSortBy]=useState("status");const[vf,setVf]=useState("");const[sf,setSf]=useState("");const[nf,setNf]=useState("all");const[minDoc,setMinDoc]=useState(0);
  const[toast,setToast]=useState(null);const[poNum,setPoNum]=useState("");const[poDate,setPoDate]=useState("");
  const vMap=useMemo(()=>{const m={};(data.vendors||[]).forEach(v=>m[v.name]=v);return m},[data.vendors]);
  const vendorNames=useMemo(()=>(data.vendors||[]).map(v=>v.name).sort(),[data.vendors]);
  const dc=(d,cd,wd)=>d<=cd?"text-red-400":d<=wd?"text-amber-400":"text-emerald-400";
  const enriched=useMemo(()=>{
    return(data.cores||[]).filter(c=>{
      if(stg.fA==="yes"&&c.active!=="Yes")return false;if(stg.fA==="no"&&c.active==="Yes")return false;
      if(stg.fV==="yes"&&c.visible!=="Yes")return false;if(stg.fV==="no"&&c.visible==="Yes")return false;
      if(stg.fI==="blank"&&!!c.ignoreUntil)return false;if(stg.fI==="set"&&!c.ignoreUntil)return false;return true;
    }).map(c=>{
      const v=vMap[c.ven]||{};const lt=v.lt||30;const td=getTD(v,stg);
      const cd=stg.critMode==="custom"?stg.critDays:lt;const wd=stg.warnMode==="custom"?stg.warnDays:lt+(c.buf||14);
      const st=getStatus(c.doc,lt,c.buf,{critDays:cd,warnDays:wd});const allIn=calcAllIn(c);
      const nq=calcNeedQty(c,td);const oq=calcOrderQty(nq,c.moq);
      const seas=calcSeasonal(c.id,(data._coreInv||[]));
      return{...c,status:st,allIn,needQty:nq,orderQty:oq,needDollar:+(oq*c.cost).toFixed(2),docAfter:calcDocAfter(c,oq),lt,critDays:cd,warnDays:wd,targetDoc:td,vc:v.country||"",seas};
    }).filter(c=>{if(vf&&c.ven!==vf)return false;if(sf&&c.status!==sf)return false;if(minDoc>0&&c.doc<minDoc)return false;if(nf==="need"&&c.needQty<=0)return false;if(nf==="ok"&&c.needQty>0)return false;return true})
    .sort((a,b)=>{const so={critical:0,warning:1,healthy:2};if(sortBy==="status")return so[a.status]-so[b.status];if(sortBy==="doc")return a.doc-b.doc;if(sortBy==="dsr")return b.dsr-a.dsr;if(sortBy==="need$")return b.needDollar-a.needDollar;return 0});
  },[data,stg,vf,sf,sortBy,vMap,nf,minDoc]);
  const sc=useMemo(()=>{const c={critical:0,warning:0,healthy:0};enriched.forEach(x=>c[x.status]++);return c},[enriched]);
  // Overrides
  const gO=(id)=>ov[id]||{};
  const setF=(id,f,v)=>setOv(p=>({...p,[id]:{...(p[id]||{}),[f]:v}}));
  const gPcs=(c)=>gO(c.id).pcs??0;
  const gCas=(c)=>gO(c.id).cas??0;
  const gInbS=(c)=>gO(c.id).inbShip??0;
  const gCogP=(c)=>gO(c.id).cogP??0;
  const gCogC=(c)=>gO(c.id).cogC??0;
  const gDec=(c)=>gO(c.id).dec??"";
  const hasPO=(c)=>(gPcs(c)>0||gCas(c)>0);
  // Vendor groups
  const vGroups=useMemo(()=>{if(vm!=="vendor")return[];const g={};enriched.forEach(c=>{if(!g[c.ven])g[c.ven]={v:vMap[c.ven]||{name:c.ven},cores:[]};g[c.ven].cores.push(c)});return Object.values(g).sort((a,b)=>b.cores.filter(c=>c.status==="critical").length-a.cores.filter(c=>c.status==="critical").length)},[enriched,vm,vMap]);
  const getPOItems=(cores)=>cores.filter(c=>hasPO(c)).map(c=>({id:c.id,ti:c.ti,vsku:c.vsku,qty:gPcs(c)||gCas(c)*(c.casePack||1),cost:c.cost,casePack:c.casePack||1,inbShip:gInbS(c)}));
  const markAllNeed=(cores)=>{const u={...ov};cores.filter(c=>c.needQty>0).forEach(c=>{u[c.id]={...(u[c.id]||{}),pcs:c.orderQty}});setOv(u)};
  const clearV=(cores)=>{const u={...ov};cores.forEach(c=>{delete u[c.id]});setOv(u)};
  // Totals for core view
  const totals=useMemo(()=>{let dsr=0,allIn=0,nq=0,oq=0,cost=0;enriched.forEach(c=>{dsr+=c.dsr;allIn+=c.allIn;nq+=c.needQty;oq+=c.orderQty;cost+=c.needDollar});return{dsr,allIn,nq,oq,cost}},[enriched]);

  return<div className="p-4">
    {toast&&<Toast msg={toast} onClose={()=>setToast(null)}/>}
    <div className="flex flex-wrap gap-2 items-center mb-4">
      <div className="flex bg-gray-800 rounded-lg p-0.5">{["core","vendor"].map(m=><button key={m} onClick={()=>setVm(m)} className={`px-3 py-1.5 rounded-md text-sm font-medium ${vm===m?"bg-blue-600 text-white":"text-gray-400"}`}>{m==="core"?"By Core":"By Vendor"}</button>)}</div>
      <SearchSelect value={vf} onChange={setVf} options={vendorNames} placeholder="All Vendors"/>
      <select value={sf} onChange={e=>setSf(e.target.value)} className="bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg px-2 py-1.5"><option value="">All Status</option><option value="critical">Critical</option><option value="warning">Warning</option><option value="healthy">Healthy</option></select>
      <select value={nf} onChange={e=>setNf(e.target.value)} className="bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg px-2 py-1.5"><option value="all">All</option><option value="need">Needs Purchase</option><option value="ok">No Need</option></select>
      {vm==="core"&&<><select value={sortBy} onChange={e=>setSortBy(e.target.value)} className="bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg px-2 py-1.5"><option value="status">Priority</option><option value="doc">DOC low</option><option value="dsr">DSR high</option><option value="need$">Need$ high</option></select><div className="flex items-center gap-1"><span className="text-gray-500 text-xs">MinDOC:</span><input type="number" value={minDoc} onChange={e=>setMinDoc(+e.target.value)} className="bg-gray-800 border border-gray-700 text-white text-sm rounded px-2 py-1 w-14"/></div></>}
      <div className="flex gap-2 ml-auto text-xs"><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"/>{sc.critical}</span><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"/>{sc.warning}</span><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"/>{sc.healthy}</span><span className="text-gray-500">|</span><span className="text-gray-300 font-semibold">{enriched.length}</span></div>
    </div>
    {vm==="vendor"&&<div className="flex flex-wrap gap-3 mb-4 items-center"><div className="flex items-center gap-1"><span className="text-gray-500 text-xs">PO#:</span><input type="text" value={poNum} onChange={e=>setPoNum(e.target.value)} placeholder="2637" className="bg-gray-800 border border-gray-700 text-white text-sm rounded px-2 py-1 w-20"/></div><div className="flex items-center gap-1"><span className="text-gray-500 text-xs">Date:</span><input type="date" value={poDate} onChange={e=>setPoDate(e.target.value)} className="bg-gray-800 border border-gray-700 text-white text-sm rounded px-2 py-1"/></div></div>}
    {/* CORE VIEW */}
    {vm==="core"&&<div className="overflow-x-auto rounded-xl border border-gray-800"><table className="w-full"><thead>
      <tr className="bg-gray-900/80 text-xs text-gray-400 uppercase"><th className="py-3 px-2 w-8"/><th className="py-3 px-2 text-left">Core</th><th className="py-3 px-2 text-left">Vendor</th><th className="py-3 px-2 text-left">Title</th><th className="py-3 px-2 text-right">DSR</th><th className="py-3 px-2 text-right">7D</th><th className="py-3 px-2 text-center">T</th><th className="py-3 px-2 text-right">DOC</th><th className="py-3 px-2 text-right">All-In</th><th className="py-3 px-2 text-right">MOQ</th><th className="py-3 px-2 text-center">S</th><th className="py-3 px-1 border-l-2 border-gray-600"/><th className="py-3 px-2 text-right">Need</th><th className="py-3 px-2 text-right">Order</th><th className="py-3 px-2 text-right">Cost</th><th className="py-3 px-2 text-right">After</th><th className="py-3 px-2 w-14"/></tr>
    </thead><tbody>{enriched.map(c=><tr key={c.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 text-sm">
      <td className="py-2 px-2"><Dot status={c.status}/></td><td className="py-2 px-2 text-blue-400 font-mono text-xs">{c.id}</td><td className="py-2 px-2 text-gray-400 text-xs truncate max-w-[100px]">{c.ven}</td><td className="py-2 px-2 text-gray-200 truncate max-w-[180px]">{c.ti}</td><td className="py-2 px-2 text-right">{R(c.dsr)}</td><td className="py-2 px-2 text-right">{R(c.d7)}</td>
      <td className="py-2 px-2 text-center">{c.d7>c.dsr?<span className="text-emerald-400">{"\u25B2"}</span>:c.d7<c.dsr?<span className="text-red-400">{"\u25BC"}</span>:"\u2014"}</td>
      <td className={`py-2 px-2 text-right font-semibold ${dc(c.doc,c.critDays,c.warnDays)}`}>{R(c.doc)}</td><td className="py-2 px-2 text-right">{R(c.allIn)}</td><td className="py-2 px-2 text-right text-gray-400 text-xs">{c.moq>0?R(c.moq):"\u2014"}</td>
      <td className="py-2 px-2 text-center">{c.seas&&<span className="text-purple-400 text-xs font-bold">{c.seas.peak}</span>}</td>
      <td className="py-2 px-1 border-l-2 border-gray-600"/><td className="py-2 px-2 text-right text-gray-300">{c.needQty>0?R(c.needQty):"\u2014"}</td><td className="py-2 px-2 text-right text-white font-semibold">{c.orderQty>0?R(c.orderQty):"\u2014"}</td><td className="py-2 px-2 text-right text-amber-300">{c.needDollar>0?D(c.needDollar):"\u2014"}</td>
      <td className={`py-2 px-2 text-right ${c.orderQty>0?dc(c.docAfter,c.critDays,c.warnDays):"text-gray-500"}`}>{c.orderQty>0?R(c.docAfter):"\u2014"}</td>
      <td className="py-2 px-2"><button onClick={()=>onViewCore(c.id)} className="text-blue-400 text-xs px-2 py-1 bg-blue-400/10 rounded">View</button></td></tr>)}</tbody>
    <tfoot><tr className="bg-gray-900 border-t-2 border-gray-700 text-sm font-semibold"><td colSpan={4} className="py-3 px-2 text-gray-300">{enriched.length} cores</td><td className="py-3 px-2 text-right text-white">{R(totals.dsr)}</td><td colSpan={3}/><td className="py-3 px-2 text-right text-white">{R(totals.allIn)}</td><td colSpan={2}/><td className="border-l-2 border-gray-600"/><td className="py-3 px-2 text-right">{R(totals.nq)}</td><td className="py-3 px-2 text-right text-white">{R(totals.oq)}</td><td className="py-3 px-2 text-right text-amber-300">{D(totals.cost)}</td><td colSpan={2}/></tr></tfoot></table></div>}
    {/* VENDOR VIEW */}
    {vm==="vendor"&&vGroups.map(grp=>{const v=grp.v;const td=getTD(v,stg);
      const poI=getPOItems(grp.cores);const poTotal=poI.reduce((s,i)=>s+i.qty*i.cost,0);const poCases=poI.reduce((s,i)=>s+(v.vou==='Cases'?Math.ceil(i.qty/(i.casePack||1)):0),0);
      const meets=poTotal>=(v.moqDollar||0);
      return<div key={v.name} className="mb-5 border border-gray-800 rounded-xl overflow-hidden">
        <div className="bg-gray-900 px-4 py-3">
          <div className="flex flex-wrap items-center gap-3 mb-2"><span className="text-white font-semibold">{v.name}</span>{v.country&&<span className="text-xs text-gray-500">{v.country}</span>}<span className="text-xs text-gray-400">LT:{v.lt}d</span><span className="text-xs text-gray-400">MOQ:{D(v.moqDollar)}</span><span className="text-xs text-gray-400">Target:{td}d</span><span className="text-xs text-gray-400">{v.payment||''}</span>
            {poI.length===0?<span className="ml-auto text-xs text-gray-400 bg-gray-700 px-2 py-0.5 rounded">No items</span>:<span className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded ${meets?"text-emerald-400 bg-emerald-400/10":"text-red-400 bg-red-400/10"}`}>{meets?"\u2713":"!"} {D(poTotal)}{poCases>0?" / "+poCases+" cases":""}</span>}
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <button onClick={()=>markAllNeed(grp.cores)} className="text-xs bg-blue-600/80 text-white px-2.5 py-1 rounded">Fill Recommended</button>
            <button onClick={()=>clearV(grp.cores)} className="text-xs bg-gray-700 text-gray-300 px-2.5 py-1 rounded">Clear</button>
            <div className="ml-auto flex gap-2">
              <button disabled={poI.length===0} onClick={()=>{genPOPdf(v,poI,poNum,stg.buyer,poDate);setToast("PO opened for "+v.name)}} className={`text-xs px-3 py-1.5 rounded font-medium ${poI.length?"bg-emerald-600 text-white":"bg-gray-700 text-gray-500 cursor-not-allowed"}`}>PO PDF</button>
              <button disabled={poI.length===0} onClick={()=>{copyTo7f(v,poI,poNum,stg.buyer,poDate);setToast("7f copied!")}} className={`text-xs px-3 py-1.5 rounded font-medium ${poI.length?"bg-teal-600 text-white":"bg-gray-700 text-gray-500 cursor-not-allowed"}`}>7f</button>
              <button disabled={poI.length===0} onClick={()=>{copyTo7g(v,poI,poNum,stg.buyer);setToast("7g copied!")}} className={`text-xs px-3 py-1.5 rounded font-medium ${poI.length?"bg-purple-600 text-white":"bg-gray-700 text-gray-500 cursor-not-allowed"}`}>7g</button>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto"><table className="w-full"><thead><tr className="text-xs text-gray-500 uppercase bg-gray-900/40"><th className="py-2 px-2 w-8"/><th className="py-2 px-2 text-left">Core</th><th className="py-2 px-2 text-left">VSKU</th><th className="py-2 px-2 text-left">Title</th><th className="py-2 px-2 text-right">DSR</th><th className="py-2 px-2 text-right">DOC</th><th className="py-2 px-2 text-right">All-In</th><th className="py-2 px-2 text-right">Rec.</th><th className="py-2 px-1 border-l-2 border-gray-600"/><th className="py-2 px-2 text-center">Pcs</th><th className="py-2 px-2 text-center">Cases</th><th className="py-2 px-2 text-center">Inb Ship</th><th className="py-2 px-2 text-center">COGS Pcs</th><th className="py-2 px-2 text-center">COGS Cas</th><th className="py-2 px-2 text-right">Cost</th><th className="py-2 px-2 w-14"/></tr></thead>
        <tbody>{grp.cores.map(c=>{const pcs=gPcs(c);const cas=gCas(c);const tot=(pcs||cas*(c.casePack||1))*c.cost;
          return<tr key={c.id} className={`border-t border-gray-800/30 hover:bg-gray-800/20 text-sm ${hasPO(c)?"bg-emerald-900/10":""}`}>
          <td className="py-2 px-2"><Dot status={c.status}/></td><td className="py-2 px-2 text-blue-400 font-mono text-xs">{c.id}</td><td className="py-2 px-2 text-gray-400 text-xs">{c.vsku||"\u2014"}</td><td className="py-2 px-2 text-gray-200 truncate max-w-[130px]">{c.ti}</td>
          <td className="py-2 px-2 text-right">{R(c.dsr)}</td><td className={`py-2 px-2 text-right font-semibold ${dc(c.doc,c.critDays,c.warnDays)}`}>{R(c.doc)}</td><td className="py-2 px-2 text-right">{R(c.allIn)}</td><td className="py-2 px-2 text-right text-gray-400 text-xs">{c.orderQty>0?R(c.orderQty):"\u2014"}</td>
          <td className="py-2 px-1 border-l-2 border-gray-600"/>
          <td className="py-1 px-1"><input type="number" value={pcs||''} onChange={e=>setF(c.id,'pcs',Math.max(0,+e.target.value||0))} placeholder="0" className="bg-gray-800 border border-gray-600 text-white text-xs rounded px-1 py-1 w-16 text-center"/></td>
          <td className="py-1 px-1"><input type="number" value={cas||''} onChange={e=>setF(c.id,'cas',Math.max(0,+e.target.value||0))} placeholder="0" className="bg-gray-800 border border-gray-600 text-white text-xs rounded px-1 py-1 w-16 text-center"/></td>
          <td className="py-1 px-1"><input type="number" value={gInbS(c)||''} onChange={e=>setF(c.id,'inbShip',Math.max(0,+e.target.value||0))} placeholder="0" className="bg-gray-800 border border-gray-600 text-white text-xs rounded px-1 py-1 w-16 text-center"/></td>
          <td className="py-1 px-1"><input type="number" value={gCogP(c)||''} onChange={e=>setF(c.id,'cogP',Math.max(0,+e.target.value||0))} placeholder="0" className="bg-gray-800 border border-gray-600 text-white text-xs rounded px-1 py-1 w-16 text-center"/></td>
          <td className="py-1 px-1"><input type="number" value={gCogC(c)||''} onChange={e=>setF(c.id,'cogC',Math.max(0,+e.target.value||0))} placeholder="0" className="bg-gray-800 border border-gray-600 text-white text-xs rounded px-1 py-1 w-16 text-center"/></td>
          <td className="py-2 px-2 text-right text-amber-300 text-xs">{tot>0?D(tot):"\u2014"}</td>
          <td className="py-2 px-2"><button onClick={()=>onViewCore(c.id)} className="text-blue-400 text-xs px-2 py-1 bg-blue-400/10 rounded">View</button></td></tr>})}
        <tr className="bg-gray-900/60 font-semibold text-sm border-t-2 border-gray-700"><td colSpan={4} className="py-2 px-2 text-gray-300">{grp.cores.length} items</td><td className="py-2 px-2 text-right text-white">{R(grp.cores.reduce((s,c)=>s+c.dsr,0))}</td><td/><td className="py-2 px-2 text-right">{R(grp.cores.reduce((s,c)=>s+c.allIn,0))}</td><td/><td className="border-l-2 border-gray-600"/><td className="py-2 px-2 text-center text-white">{R(grp.cores.reduce((s,c)=>s+gPcs(c),0))}</td><td className="py-2 px-2 text-center text-white">{R(grp.cores.reduce((s,c)=>s+gCas(c),0))}</td><td colSpan={3}/><td className="py-2 px-2 text-right text-amber-300">{D(grp.cores.reduce((s,c)=>s+(gPcs(c)||gCas(c)*(c.casePack||1))*c.cost,0))}</td><td/></tr>
        </tbody></table></div></div>})}</div>}

// === DATA TABLE (alongside charts) ===
function DataTable({data,cols}){return<div className="overflow-x-auto mt-2"><table className="w-full text-xs"><thead><tr className="text-gray-500">{cols.map(c=><th key={c.key} className={`py-1 px-2 ${c.right?"text-right":"text-left"}`}>{c.label}</th>)}</tr></thead><tbody>{data.map((r,i)=><tr key={i} className={i%2===0?"bg-gray-800/20":""}>{cols.map(c=><td key={c.key} className={`py-1 px-2 ${c.right?"text-right":""} ${c.color?c.color(r):""}`}>{c.fmt?c.fmt(r[c.key]):r[c.key]}</td>)}</tr>)}</tbody></table></div>}

// === CORE DETAIL ===
function CoreDetailTab({data,stg,hist,daily,coreId,onBack,onGoBundle}){
  const[search,setSearch]=useState("");const[sel,setSel]=useState(coreId||null);
  useEffect(()=>{if(coreId)setSel(coreId)},[coreId]);
  const core=sel?(data.cores||[]).find(c=>c.id===sel):null;
  const vendor=core?(data.vendors||[]).find(v=>v.name===core.ven):null;
  const lt=vendor?.lt||30;const td=getTD(vendor,stg);
  const feesMap=useMemo(()=>{const m={};(data.fees||[]).forEach(f=>m[f.j]=f);return m},[data.fees]);
  const salesMap=useMemo(()=>{const m={};(data.sales||[]).forEach(s=>m[s.j]=s);return m},[data.sales]);
  const coreHist=useMemo(()=>(hist?.coreInv||[]).filter(h=>h.core===sel),[hist,sel]);
  const years=useMemo(()=>[...new Set(coreHist.map(h=>h.y))].sort(),[coreHist]);
  const cm2=curMonth();
  // Filter out current incomplete month
  const coreHistFull=useMemo(()=>coreHist.filter(h=>!(h.y===cm2.y&&h.m===cm2.m)),[coreHist,cm2]);
  const dsrChart=useMemo(()=>MN.map((m,i)=>{const row={month:m};years.forEach(y=>{const h=coreHistFull.find(x=>x.y===y&&x.m===i+1);row["dsr_"+y]=h?.avgDsr??null});return row}),[coreHistFull,years]);
  // DSR table data
  const dsrTable=useMemo(()=>MN.map((m,i)=>{const row={month:m};years.forEach(y=>{const h=coreHistFull.find(x=>x.y===y&&x.m===i+1);row[y]=h?.avgDsr!=null?Math.round(h.avgDsr):null});return row}),[coreHistFull,years]);
  const yTotals=useMemo(()=>{const t={};years.forEach(y=>{const r=coreHistFull.filter(h=>h.y===y);t[y]=r.length?Math.round(r.reduce((s,x)=>s+x.avgDsr,0)):0});return t},[coreHistFull,years]);
  const coreBundlesAll=useMemo(()=>{if(!core)return[];const byC1=(data.bundles||[]).filter(b=>b.core1===sel);if(byC1.length>0)return byC1;const jls=(core.jlsList||"").split(/[,\n]/).filter(Boolean).map(j=>j.trim());return(data.bundles||[]).filter(b=>jls.includes(b.j))},[core,sel,data.bundles]);
  const bIds=useMemo(()=>coreBundlesAll.map(b=>b.j),[coreBundlesAll]);
  const inboundShipments=useMemo(()=>{if(!sel||!data.inbound)return[];const ids=new Set([sel,...bIds].map(x=>(x||"").trim().toLowerCase()));return data.inbound.filter(s=>ids.has((s.core||"").trim().toLowerCase()))},[data.inbound,sel,bIds]);
  const bSalesH=useMemo(()=>(hist?.bundleSales||[]).filter(h=>bIds.includes(h.j)),[hist,bIds]);
  const unitsChart=useMemo(()=>{const byMY={};bSalesH.filter(h=>!(h.y===cm2.y&&h.m===cm2.m)).forEach(h=>{const k=h.y+"-"+h.m;if(!byMY[k])byMY[k]={y:h.y,m:h.m,u:0};byMY[k].u+=h.units});return MN.map((m,i)=>{const row={month:m};years.forEach(y=>{const r=byMY[y+"-"+(i+1)];row["u_"+y]=r?.u??null});return row})},[bSalesH,years,cm2]);
  const allIn=core?calcAllIn(core):0;const status=core?getStatus(core.doc,lt,core.buf||14,stg):"healthy";
  const nq=core?calcNeedQty(core,td):0;const oq=core?calcOrderQty(nq,core.moq):0;const da=core?calcDocAfter(core,oq):0;
  const seas=core?calcSeasonal(core.id,hist?.coreInv||[]):null;
  const pipeline=core?[{l:"Raw",v:core.raw},{l:"Inbound",v:core.inb},{l:"Pre-Proc",v:core.pp},{l:"JFN",v:core.jfn},{l:"Proc Q",v:core.pq},{l:"JI",v:core.ji},{l:"FBA",v:core.fba}]:[];
  const maxP=Math.max(...pipeline.map(p=>p.v),1);
  const totalBDsr=useMemo(()=>coreBundlesAll.reduce((s,b)=>s+(b.cd||0),0),[coreBundlesAll]);
  const totalPortRev=useMemo(()=>(data.sales||[]).reduce((s,x)=>s+(x.ltR||0),0),[data.sales]);
  const totalPortProfit=useMemo(()=>(data.sales||[]).reduce((s,x)=>s+(x.ltP||0),0),[data.sales]);
  const coreBundles=useMemo(()=>coreBundlesAll.map(b=>({...b,fee:feesMap[b.j],sale:salesMap[b.j],pct:totalBDsr>0?+((b.cd/totalBDsr)*100).toFixed(1):0})).sort((a,b)=>(b.cd||0)-(a.cd||0)),[coreBundlesAll,feesMap,salesMap,totalBDsr]);
  const etaText=useMemo(()=>inboundShipments.filter(s=>s.eta).map(s=>fmtEta(s.eta)).join(", "),[inboundShipments]);
  // Full daily detail
  const coreDays=useMemo(()=>(daily?.coreDays||[]).filter(d=>d.core===sel).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,14),[daily,sel]);
  const bTotals=useMemo(()=>{let dsr=0,ltR=0,ltP=0;coreBundles.forEach(b=>{dsr+=b.cd||0;if(b.sale){ltR+=b.sale.ltR||0;ltP+=b.sale.ltP||0}});return{dsr,ltR,ltP}},[coreBundles]);
  const dc=(d,cd,wd)=>d<=cd?"text-red-400":d<=wd?"text-amber-400":"text-emerald-400";

  if(!core)return<div className="p-4 max-w-4xl mx-auto"><div className="flex items-center gap-3 mb-4"><button onClick={onBack} className="text-gray-400 hover:text-white text-sm">{"\u2190"} Purchasing</button><input type="text" placeholder="Search core..." value={search} onChange={e=>setSearch(e.target.value)} className="bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 flex-1 max-w-md text-sm"/></div>{search.length>=2?<div className="space-y-1">{(data.cores||[]).filter(c=>{const q=search.toLowerCase();return c.id.toLowerCase().includes(q)||c.ti.toLowerCase().includes(q)}).slice(0,12).map(c=><button key={c.id} onClick={()=>setSel(c.id)} className="w-full text-left px-4 py-2.5 rounded-lg bg-gray-900/50 hover:bg-gray-800 flex items-center gap-3"><Dot status={getStatus(c.doc,(data.vendors||[]).find(v=>v.name===c.ven)?.lt||30,c.buf,stg)}/><span className="text-blue-400 font-mono text-sm">{c.id}</span><span className="text-gray-300 text-sm truncate">{c.ti}</span></button>)}</div>:<p className="text-gray-500 text-sm">Type at least 2 characters.</p>}</div>;

  return<div className="p-4 max-w-6xl mx-auto">
    <button onClick={()=>{setSel(null);onBack()}} className="text-gray-400 hover:text-white text-sm mb-4">{"\u2190"} Purchasing</button>
    <div className="bg-gray-900 rounded-xl p-4 mb-4 border border-gray-800">
      <div className="flex flex-wrap items-center gap-3 mb-2"><span className="text-xl font-bold text-white">{core.id}</span><Dot status={status}/><span className={`text-xs px-2 py-0.5 rounded font-semibold ${status==="critical"?"bg-red-500/20 text-red-400":status==="warning"?"bg-amber-500/20 text-amber-400":"bg-emerald-500/20 text-emerald-400"}`}>{status.toUpperCase()}</span>{seas&&<span className="text-xs px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 font-semibold">SEASONAL {seas.peak}</span>}</div>
      <p className="text-gray-300 text-sm mb-1">{core.ti}</p>
      <p className="text-gray-500 text-xs">{core.ven} · VSKU:{core.vsku||"\u2014"} · {D2(core.cost)} · LT:{lt}d · Target:{td}d</p></div>
    {/* KPIs */}
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
      {[{l:"C.DSR",v:R(core.dsr)},{l:"7D DSR",v:R(core.d7)},{l:"DOC",v:R(core.doc),c:dc(core.doc,lt,lt+(core.buf||14))},{l:"All-In",v:R(allIn)},{l:"Inbound",v:R(core.inb),sub:etaText}].map(k=><div key={k.l} className="bg-gray-900 rounded-lg p-3 border border-gray-800"><div className="text-gray-500 text-xs mb-1">{k.l}</div><div className={`text-lg font-bold ${k.c||"text-white"}`}>{k.v}</div>{k.sub&&<div className="text-emerald-400 text-xs mt-1">ETA: {k.sub}</div>}</div>)}</div>
    {/* INBOUND */}
    {inboundShipments.length>0&&<div className="bg-gray-900 rounded-xl p-4 mb-4 border border-gray-800"><h3 className="text-white font-semibold text-sm mb-3">Inbound Shipments</h3><table className="w-full text-xs"><thead><tr className="text-gray-500 uppercase"><th className="py-1 px-2 text-left">Order#</th><th className="py-1 px-2 text-left">Vendor</th><th className="py-1 px-2 text-right">Pcs</th><th className="py-1 px-2 text-right">Missing</th><th className="py-1 px-2 text-right">ETA</th></tr></thead><tbody>{inboundShipments.map((s,i)=><tr key={i}><td className="py-1.5 px-2 text-gray-300">{s.orderNum}</td><td className="py-1.5 px-2">{s.vendor}</td><td className="py-1.5 px-2 text-right text-white">{R(s.pieces)}</td><td className="py-1.5 px-2 text-right text-red-400">{s.piecesMissing>0?R(s.piecesMissing):"\u2014"}</td><td className="py-1.5 px-2 text-right text-emerald-400">{s.eta?fmtEta(s.eta):"\u2014"}</td></tr>)}</tbody></table></div>}
    {/* FULL DAILY DETAIL */}
    {coreDays.length>0&&<div className="bg-gray-900 rounded-xl p-4 mb-4 border border-gray-800"><h3 className="text-white font-semibold text-sm mb-3">Daily Detail (Last {coreDays.length} Days)</h3><div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="text-gray-500 uppercase"><th className="py-1 px-1 text-left">Date</th><th className="py-1 px-1 text-right">DSR</th><th className="py-1 px-1 text-right">1D</th><th className="py-1 px-1 text-right">3D</th><th className="py-1 px-1 text-right">7D</th><th className="py-1 px-1 text-right">DOC</th><th className="py-1 px-1 text-right">DOC#Δ</th><th className="py-1 px-1 text-right">DOC%Δ</th><th className="py-1 px-1 text-right">Cash</th><th className="py-1 px-1 text-right">All-In</th><th className="py-1 px-1 text-right">Raw</th><th className="py-1 px-1 text-right">Inb</th><th className="py-1 px-1 text-right">PP</th><th className="py-1 px-1 text-right">JFN</th><th className="py-1 px-1 text-right">PQ</th><th className="py-1 px-1 text-right">JI</th><th className="py-1 px-1 text-right">FBA</th></tr></thead><tbody>{coreDays.map((d,i)=>{
      const prev=coreDays[i+1];const docChg=prev?d.doc-prev.doc:null;const docPct=prev&&prev.doc>0?((d.doc-prev.doc)/prev.doc*100):null;
      return<tr key={d.date} className={i%2===0?"bg-gray-800/30":""}>
        <td className="py-1 px-1 text-gray-300">{fmtDay(d.date)}</td><td className="py-1 px-1 text-right text-white font-semibold">{R(d.dsr)}</td><td className="py-1 px-1 text-right">{R(d.d1)}</td><td className="py-1 px-1 text-right">{R(d.d3)}</td><td className="py-1 px-1 text-right">{R(d.d7)}</td>
        <td className={`py-1 px-1 text-right font-semibold ${dc(d.doc,lt,lt+(core.buf||14))}`}>{R(d.doc)}</td>
        <td className={`py-1 px-1 text-right ${docChg>0?"text-emerald-400":docChg<0?"text-red-400":"text-gray-500"}`}>{docChg!=null?(docChg>0?"+":"")+Math.round(docChg):"\u2014"}</td>
        <td className={`py-1 px-1 text-right ${docPct>0?"text-emerald-400":docPct<0?"text-red-400":"text-gray-500"}`}>{docPct!=null?(docPct>0?"+":"")+docPct.toFixed(1)+"%":"\u2014"}</td>
        <td className="py-1 px-1 text-right">{D(d.cash)}</td><td className="py-1 px-1 text-right">{R(d.own)}</td><td className="py-1 px-1 text-right">{R(d.raw)}</td><td className="py-1 px-1 text-right">{R(d.inb)}</td><td className="py-1 px-1 text-right">{R(d.pp)}</td><td className="py-1 px-1 text-right">{R(d.jfn)}</td><td className="py-1 px-1 text-right">{R(d.pq)}</td><td className="py-1 px-1 text-right">{R(d.ji)}</td><td className="py-1 px-1 text-right">{R(d.fba)}</td></tr>})}</tbody></table></div></div>}
    {/* MONTHLY DSR CHART + TABLE */}
    {coreHistFull.length>0&&<div className="bg-gray-900 rounded-xl p-4 mb-4 border border-gray-800"><h3 className="text-white font-semibold text-sm mb-2">Monthly DSR (YoY)</h3>
      <ResponsiveContainer width="100%" height={240}><ComposedChart data={dsrChart}><CartesianGrid strokeDasharray="3 3" stroke="#374151"/><XAxis dataKey="month" tick={{fill:"#9ca3af",fontSize:11}}/><YAxis tick={{fill:"#9ca3af",fontSize:11}}/><Tooltip {...TT}/><Legend/>{years.map(y=><Bar key={y} dataKey={"dsr_"+y} fill={YR_C[y]||"#6b7280"} opacity={0.85} radius={[2,2,0,0]} name={""+y}/>)}</ComposedChart></ResponsiveContainer>
      <div className="overflow-x-auto mt-3"><table className="w-full text-xs"><thead><tr className="text-gray-500"><th className="py-1 px-2 text-left">Month</th>{years.map(y=><th key={y} className="py-1 px-2 text-right" style={{color:YR_C[y]}}>{y}</th>)}</tr></thead><tbody>{dsrTable.map((r,i)=><tr key={i} className={i%2===0?"bg-gray-800/20":""}><td className="py-1 px-2 text-gray-300">{r.month}</td>{years.map(y=><td key={y} className="py-1 px-2 text-right text-white">{r[y]!=null?R(r[y]):""}</td>)}</tr>)}<tr className="border-t border-gray-700 font-semibold"><td className="py-1 px-2 text-gray-300">Total</td>{years.map(y=><td key={y} className="py-1 px-2 text-right text-white">{R(yTotals[y])}</td>)}</tr></tbody></table></div></div>}
    {/* MONTHLY UNITS CHART + TABLE */}
    {bSalesH.length>0&&<div className="bg-gray-900 rounded-xl p-4 mb-4 border border-gray-800"><h3 className="text-white font-semibold text-sm mb-2">Monthly Units (YoY) <span className="text-gray-500 text-xs font-normal">current month excluded</span></h3>
      <ResponsiveContainer width="100%" height={240}><LineChart data={unitsChart}><CartesianGrid strokeDasharray="3 3" stroke="#374151"/><XAxis dataKey="month" tick={{fill:"#9ca3af",fontSize:11}}/><YAxis tick={{fill:"#9ca3af",fontSize:11}}/><Tooltip {...TT}/><Legend/>{years.map(y=><Line key={y} dataKey={"u_"+y} stroke={YR_C[y]||"#6b7280"} strokeWidth={2} dot={{r:3}} connectNulls name={""+y}/>)}</LineChart></ResponsiveContainer>
      <div className="overflow-x-auto mt-3"><table className="w-full text-xs"><thead><tr className="text-gray-500"><th className="py-1 px-2 text-left">Month</th>{years.map(y=><th key={y} className="py-1 px-2 text-right" style={{color:YR_C[y]}}>{y}</th>)}</tr></thead><tbody>{unitsChart.map((r,i)=><tr key={i} className={i%2===0?"bg-gray-800/20":""}><td className="py-1 px-2 text-gray-300">{r.month}</td>{years.map(y=><td key={y} className="py-1 px-2 text-right text-white">{r["u_"+y]!=null?R(r["u_"+y]):""}</td>)}</tr>)}</tbody></table></div></div>}
    {/* PIPELINE */}
    <div className="bg-gray-900 rounded-xl p-4 mb-4 border border-gray-800"><h3 className="text-white font-semibold text-sm mb-3">Pipeline</h3><div className="flex items-end gap-2 h-32">{pipeline.map((p,i)=><div key={p.l} className="flex-1 flex flex-col items-center"><span className="text-white text-xs font-semibold mb-1">{R(p.v)}</span><div className="w-full rounded-t-md" style={{height:Math.max((p.v/maxP)*80,4)+"px",backgroundColor:i===pipeline.length-1?BLUE:i===0?TEAL:"#6b7280"}}/><span className="text-gray-500 text-xs mt-1">{p.l}</span></div>)}</div></div>
    {/* BUNDLES */}
    <div className="bg-gray-900 rounded-xl p-4 mb-4 border border-gray-800 overflow-x-auto">
      <h3 className="text-white font-semibold text-sm mb-3">Bundles ({coreBundles.length})</h3>
      {coreBundles.length>0?<table className="w-full text-sm"><thead><tr className="text-gray-500 text-xs uppercase"><th className="py-2 px-2 text-left">JLS</th><th className="py-2 px-2 text-left">Title</th><th className="py-2 px-2 text-right">C.DSR</th><th className="py-2 px-2 text-right">%Core</th><th className="py-2 px-2 text-right">FIB DOC</th><th className="py-2 px-1 border-l-2 border-gray-600"/><th className="py-2 px-2 text-right">Price</th><th className="py-2 px-2 text-right">GP</th><th className="py-2 px-2 text-right">LT Rev</th><th className="py-2 px-2 text-right">%Port</th><th className="py-2 px-2 text-right">LT Profit</th><th className="py-2 px-2 text-right">%Port</th><th className="py-2 px-2 w-14"/></tr></thead><tbody>{coreBundles.map(b=>{const rP=totalPortRev>0?((b.sale?.ltR||0)/totalPortRev*100):0;const pP=totalPortProfit>0?((b.sale?.ltP||0)/totalPortProfit*100):0;return<tr key={b.j} className="border-t border-gray-800/50 hover:bg-gray-800/20"><td className="py-2 px-2 text-blue-400 font-mono text-xs">{b.j}</td><td className="py-2 px-2 text-gray-200 truncate max-w-[140px]">{b.t}</td><td className="py-2 px-2 text-right">{R(b.cd)}</td><td className="py-2 px-2 text-right text-gray-300">{b.pct}%</td><td className="py-2 px-2 text-right">{R(b.fibDoc)}</td><td className="py-2 px-1 border-l-2 border-gray-600"/><td className="py-2 px-2 text-right">{b.fee?D2(b.fee.pr):"\u2014"}</td><td className="py-2 px-2 text-right text-emerald-400">{b.fee?D2(b.fee.gp):"\u2014"}</td><td className="py-2 px-2 text-right">{b.sale?D(b.sale.ltR):"\u2014"}</td><td className="py-2 px-2 text-right text-gray-400 text-xs">{rP>0?P(rP):""}</td><td className="py-2 px-2 text-right text-emerald-400">{b.sale?D(b.sale.ltP):"\u2014"}</td><td className="py-2 px-2 text-right text-gray-400 text-xs">{pP>0?P(pP):""}</td><td className="py-2 px-2"><button onClick={()=>onGoBundle(b.j)} className="text-blue-400 text-xs px-2 py-1 bg-blue-400/10 rounded">View</button></td></tr>})}
      <tr className="bg-gray-900/60 border-t-2 border-gray-700 font-semibold text-sm"><td colSpan={2} className="py-2 px-2 text-gray-300">Totals</td><td className="py-2 px-2 text-right text-white">{R(bTotals.dsr)}</td><td colSpan={2}/><td className="border-l-2 border-gray-600"/><td colSpan={2}/><td className="py-2 px-2 text-right text-white">{D(bTotals.ltR)}</td><td className="py-2 px-2 text-right text-gray-400 text-xs">{totalPortRev>0?P(bTotals.ltR/totalPortRev*100):""}</td><td className="py-2 px-2 text-right text-emerald-400">{D(bTotals.ltP)}</td><td className="py-2 px-2 text-right text-gray-400 text-xs">{totalPortProfit>0?P(bTotals.ltP/totalPortProfit*100):""}</td><td/></tr></tbody></table>:<p className="text-gray-500 text-sm">No bundles.</p>}</div>
    {/* PURCHASE REC */}
    <div className="bg-gray-900 rounded-xl p-4 border border-gray-800"><h3 className="text-white font-semibold text-sm mb-3">Purchase Recommendation</h3><div className="grid grid-cols-2 sm:grid-cols-5 gap-4">{[{l:"Current DOC",v:R(core.doc),c:dc(core.doc,lt,lt+(core.buf||14))},{l:"Need for "+td+"d",v:R(nq)},{l:"Order (MOQ:"+R(core.moq)+")",v:R(oq)},{l:"Cost",v:D(oq*core.cost),c:"text-amber-300"},{l:"After DOC",v:oq>0?R(da):"\u2014",c:"text-emerald-400"}].map(k=><div key={k.l}><div className="text-gray-500 text-xs">{k.l}</div><div className={`text-lg font-bold ${k.c||"text-white"}`}>{k.v}</div></div>)}</div></div>
  </div>}

// === BUNDLE DETAIL ===
function BundleDetailTab({data,stg,hist,daily,bundleId,onBack,onGoCore}){
  const[search,setSearch]=useState("");const[sel,setSel]=useState(bundleId||null);
  useEffect(()=>{if(bundleId)setSel(bundleId)},[bundleId]);
  const bundle=sel?(data.bundles||[]).find(b=>b.j===sel):null;
  const fee=bundle?(data.fees||[]).find(f=>f.j===bundle.j):null;
  const sale=bundle?(data.sales||[]).find(s=>s.j===bundle.j):null;
  const core=bundle?(data.cores||[]).find(c=>c.id===bundle.core1):null;
  const salesHist=useMemo(()=>(hist?.bundleSales||[]).filter(h=>h.j===sel).sort((a,b)=>a.y===b.y?a.m-b.m:a.y-b.y),[hist,sel]);
  const yoyYears=useMemo(()=>[...new Set(salesHist.map(h=>h.y))].sort(),[salesHist]);
  const cm2=curMonth();
  const salesHistFull=useMemo(()=>salesHist.filter(h=>!(h.y===cm2.y&&h.m===cm2.m)),[salesHist,cm2]);
  const yoyData=useMemo(()=>MN.map((m,i)=>{const r={month:m};yoyYears.forEach(y=>{const rec=salesHistFull.find(h=>h.y===y&&h.m===i+1);r["u_"+y]=rec?.units??null;r["r_"+y]=rec?.rev??null});return r}),[salesHistFull,yoyYears]);
  const totalPortRev=useMemo(()=>(data.sales||[]).reduce((s,x)=>s+(x.ltR||0),0),[data.sales]);
  const totalPortProfit=useMemo(()=>(data.sales||[]).reduce((s,x)=>s+(x.ltP||0),0),[data.sales]);
  const bundleDays=useMemo(()=>(daily?.bundleDays||[]).filter(d=>d.j===sel).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,14),[daily,sel]);

  if(!bundle)return<div className="p-4 max-w-4xl mx-auto"><div className="flex items-center gap-3 mb-4"><button onClick={onBack} className="text-gray-400 hover:text-white text-sm">{"\u2190"} Back</button><input type="text" placeholder="Search bundle..." value={search} onChange={e=>setSearch(e.target.value)} className="bg-gray-800 border border-gray-700 text-white rounded-lg px-4 py-2.5 flex-1 max-w-md text-sm"/></div>{search.length>=2?<div className="space-y-1">{(data.bundles||[]).filter(b=>{const q=search.toLowerCase();return b.j.toLowerCase().includes(q)||b.t.toLowerCase().includes(q)}).slice(0,12).map(b=><button key={b.j} onClick={()=>setSel(b.j)} className="w-full text-left px-4 py-2.5 rounded-lg bg-gray-900/50 hover:bg-gray-800 flex items-center gap-3"><span className="text-blue-400 font-mono text-sm">{b.j}</span><span className="text-gray-300 text-sm truncate">{b.t}</span></button>)}</div>:<p className="text-gray-500 text-sm">Type at least 2 characters.</p>}</div>;

  const pct=core?.dsr>0?((bundle.cd/core.dsr)*100).toFixed(1):"\u2014";
  return<div className="p-4 max-w-6xl mx-auto">
    <button onClick={()=>{setSel(null);onBack()}} className="text-gray-400 hover:text-white text-sm mb-4">{"\u2190"} Back</button>
    <div className="bg-gray-900 rounded-xl p-4 mb-4 border border-gray-800"><div className="flex flex-wrap items-center gap-3 mb-2"><span className="text-xl font-bold text-white">{bundle.j}</span>{core&&<button onClick={()=>onGoCore(core.id)} className="text-blue-400 text-xs bg-blue-400/10 px-2 py-0.5 rounded">→{core.id}</button>}</div><p className="text-gray-300 text-sm">{bundle.t}</p><p className="text-gray-500 text-xs">ASIN:{bundle.asin} · {bundle.vendors}</p></div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
      <div className="bg-gray-900 rounded-xl p-4 border border-gray-800"><h4 className="text-gray-500 text-xs uppercase mb-3">Sales & Inventory</h4><div className="grid grid-cols-3 gap-y-4">{[{l:"C.DSR",v:bundle.cd},{l:"% Core",v:pct+"%"},{l:"Comp DOC",v:bundle.doc},{l:"FIB DOC",v:bundle.fibDoc},{l:"FBA Inv",v:bundle.fibInv},{l:"Reserved",v:bundle.reserved}].map(k=><div key={k.l}><div className="text-gray-500 text-xs">{k.l}</div><div className="text-white font-bold text-lg">{typeof k.v==="number"?R(k.v):k.v}</div></div>)}</div></div>
      <div className="bg-gray-900 rounded-xl p-4 border border-gray-800"><h4 className="text-gray-500 text-xs uppercase mb-3">Profitability</h4><div className="grid grid-cols-3 gap-y-4">{[{l:"Price",v:fee?.pr},{l:"COGS",v:fee?.pdmtCogs},{l:"AICOGS",v:fee?.aicogs},{l:"Total Fee",v:fee?.totalFee},{l:"GP",v:fee?.gp,c:"text-emerald-400"},{l:"Net Rev",v:fee?.netRev}].map(k=><div key={k.l}><div className="text-gray-500 text-xs">{k.l}</div><div className={`font-bold text-lg ${k.c||"text-white"}`}>{k.v!=null?D2(k.v):"\u2014"}</div></div>)}</div></div></div>
    {/* REVENUE TABLE */}
    {sale&&<div className="bg-gray-900 rounded-xl p-4 mb-4 border border-gray-800"><h3 className="text-white font-semibold text-sm mb-3">Revenue</h3><table className="w-full text-sm"><thead><tr className="text-gray-500 text-xs uppercase"><th className="py-2 text-left"/><th className="py-2 text-right">Lifetime</th><th className="py-2 text-right">%Port</th><th className="py-2 text-right">Last Year</th><th className="py-2 text-right">This Year</th><th className="py-2 text-right">YoY</th></tr></thead><tbody>
      <tr className="border-t border-gray-800"><td className="py-2 text-gray-400">Revenue</td><td className="py-2 text-right text-white">{D(sale.ltR)}</td><td className="py-2 text-right text-gray-400 text-xs">{totalPortRev>0?P(sale.ltR/totalPortRev*100):""}</td><td className="py-2 text-right">{D(sale.lyR)}</td><td className="py-2 text-right">{D(sale.tyR)}</td><td className="py-2 text-right">{sale.lyR>0?(((sale.tyR-sale.lyR)/sale.lyR)*100).toFixed(0)+"%":"\u2014"}</td></tr>
      <tr className="border-t border-gray-800"><td className="py-2 text-gray-400">Profit</td><td className="py-2 text-right text-emerald-400">{D(sale.ltP)}</td><td className="py-2 text-right text-gray-400 text-xs">{totalPortProfit>0?P(sale.ltP/totalPortProfit*100):""}</td><td className="py-2 text-right text-emerald-400">{D(sale.lyP)}</td><td className="py-2 text-right text-emerald-400">{D(sale.tyP)}</td><td className="py-2 text-right">{sale.lyP>0?(((sale.tyP-sale.lyP)/sale.lyP)*100).toFixed(0)+"%":"\u2014"}</td></tr></tbody></table></div>}
    {/* DAILY DETAIL */}
    {bundleDays.length>0&&<div className="bg-gray-900 rounded-xl p-4 mb-4 border border-gray-800"><h3 className="text-white font-semibold text-sm mb-3">Daily Detail (Last {bundleDays.length} Days)</h3><div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="text-gray-500 uppercase"><th className="py-1 px-1 text-left">Date</th><th className="py-1 px-1 text-right">DSR</th><th className="py-1 px-1 text-right">1D</th><th className="py-1 px-1 text-right">3D</th><th className="py-1 px-1 text-right">7D</th><th className="py-1 px-1 text-right">DOC</th><th className="py-1 px-1 text-right">FIB</th><th className="py-1 px-1 text-right">SC</th><th className="py-1 px-1 text-right">Res</th><th className="py-1 px-1 text-right">Inb</th><th className="py-1 px-1 text-right">Cash</th></tr></thead><tbody>{bundleDays.map((d,i)=><tr key={d.date} className={i%2===0?"bg-gray-800/30":""}><td className="py-1 px-1 text-gray-300">{fmtDay(d.date)}</td><td className="py-1 px-1 text-right text-white font-semibold">{R(d.dsr)}</td><td className="py-1 px-1 text-right">{R(d.d1)}</td><td className="py-1 px-1 text-right">{R(d.d3)}</td><td className="py-1 px-1 text-right">{R(d.d7)}</td><td className="py-1 px-1 text-right">{R(d.doc)}</td><td className="py-1 px-1 text-right">{R(d.fib)}</td><td className="py-1 px-1 text-right">{R(d.sc)}</td><td className="py-1 px-1 text-right">{R(d.res)}</td><td className="py-1 px-1 text-right">{R(d.inb)}</td><td className="py-1 px-1 text-right">{D(d.cash)}</td></tr>)}</tbody></table></div></div>}
    {/* RECENT SALES */}
    {sale&&<div className="bg-gray-900 rounded-xl p-4 mb-4 border border-gray-800"><h3 className="text-white font-semibold text-sm mb-3">Recent Sales</h3><div className="grid grid-cols-2 sm:grid-cols-4 gap-4">{[{l:"This Month",u:sale.tmU,r:sale.tmR},{l:"Last Month",u:sale.lmU,r:sale.lmR},{l:"Last 7d",u:sale.l7U,r:sale.l7R},{l:"Last 28d",u:sale.l28U,r:sale.l28R}].map(p=><div key={p.l}><div className="text-gray-500 text-xs">{p.l}</div><div className="text-white font-semibold">{R(p.u)} units</div><div className="text-gray-400 text-xs">{D(p.r)}</div></div>)}</div></div>}
    {/* YOY CHART + TABLE */}
    {salesHistFull.length>0&&<div className="bg-gray-900 rounded-xl p-4 mb-4 border border-gray-800"><h3 className="text-white font-semibold text-sm mb-2">YoY Units <span className="text-gray-500 text-xs font-normal">current month excluded</span></h3>
      <ResponsiveContainer width="100%" height={240}><LineChart data={yoyData}><CartesianGrid strokeDasharray="3 3" stroke="#374151"/><XAxis dataKey="month" tick={{fill:"#9ca3af",fontSize:11}}/><YAxis tick={{fill:"#9ca3af",fontSize:11}}/><Tooltip {...TT}/><Legend/>{yoyYears.map(y=><Line key={y} dataKey={"u_"+y} stroke={YR_C[y]||"#6b7280"} strokeWidth={2} dot={{r:3}} name={""+y} connectNulls/>)}</LineChart></ResponsiveContainer>
      <div className="overflow-x-auto mt-3"><table className="w-full text-xs"><thead><tr className="text-gray-500"><th className="py-1 px-2 text-left">Month</th>{yoyYears.map(y=><th key={y} className="py-1 px-2 text-right" style={{color:YR_C[y]}}>{y}</th>)}</tr></thead><tbody>{yoyData.map((r,i)=><tr key={i} className={i%2===0?"bg-gray-800/20":""}><td className="py-1 px-2 text-gray-300">{r.month}</td>{yoyYears.map(y=><td key={y} className="py-1 px-2 text-right text-white">{r["u_"+y]!=null?R(r["u_"+y]):""}</td>)}</tr>)}</tbody></table></div></div>}
  </div>}

// === VENDOR DETAILS TAB ===
function VendorDetailsTab({data,stg}){
  const[sel,setSel]=useState(null);
  const vMap=useMemo(()=>{const m={};(data.vendors||[]).forEach(v=>m[v.name]=v);return m},[data.vendors]);
  const vSummary=useMemo(()=>{
    const g={};(data.cores||[]).filter(c=>c.active==="Yes").forEach(c=>{
      if(!g[c.ven])g[c.ven]={name:c.ven,cr:0,wa:0,he:0,cores:0,totalDsr:0};
      const v=vMap[c.ven]||{};const lt=v.lt||30;const st=getStatus(c.doc,lt,c.buf||14,stg);
      g[c.ven][st==="critical"?"cr":st==="warning"?"wa":"he"]++;g[c.ven].cores++;g[c.ven].totalDsr+=c.dsr;
    });return Object.values(g).sort((a,b)=>b.cr-a.cr||b.wa-a.wa);
  },[data.cores,vMap,stg]);
  const selV=sel?vMap[sel]:null;
  const selCores=useMemo(()=>sel?(data.cores||[]).filter(c=>c.ven===sel):[]    ,[data.cores,sel]);

  if(selV)return<div className="p-4 max-w-4xl mx-auto">
    <button onClick={()=>setSel(null)} className="text-gray-400 hover:text-white text-sm mb-4">← All Vendors</button>
    <div className="bg-gray-900 rounded-xl p-4 mb-4 border border-gray-800">
      <h2 className="text-xl font-bold text-white mb-2">{selV.name}</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 text-sm">{[["Country",selV.country],["Lead Time",selV.lt+"d"],["Payment",selV.payment],["Terms",selV.terms],["Order Method",selV.orderMethod],["$ MOQ",D(selV.moqDollar)],["Cases MOQ",R(selV.moqCases)],["Contact",selV.contactName],["Email",selV.contactEmail],["Phone",selV.contactPhone],["Address",selV.address||[selV.address1,selV.city,selV.state,selV.zip].filter(Boolean).join(', ')]].map(([l,v])=><div key={l}><div className="text-gray-500 text-xs">{l}</div><div className="text-white">{v||"\u2014"}</div></div>)}</div></div>
    <div className="bg-gray-900 rounded-xl p-4 border border-gray-800"><h3 className="text-white font-semibold text-sm mb-3">Cores ({selCores.length})</h3><table className="w-full text-xs"><thead><tr className="text-gray-500 uppercase"><th className="py-1 px-2 w-8"/><th className="py-1 px-2 text-left">Core</th><th className="py-1 px-2 text-left">Title</th><th className="py-1 px-2 text-right">DSR</th><th className="py-1 px-2 text-right">DOC</th><th className="py-1 px-2 text-right">All-In</th></tr></thead><tbody>{selCores.map(c=>{const lt=selV.lt||30;const st=getStatus(c.doc,lt,c.buf||14,stg);return<tr key={c.id}><td className="py-1 px-2"><Dot status={st}/></td><td className="py-1 px-2 text-blue-400 font-mono">{c.id}</td><td className="py-1 px-2 text-gray-200 truncate max-w-[200px]">{c.ti}</td><td className="py-1 px-2 text-right">{R(c.dsr)}</td><td className="py-1 px-2 text-right">{R(c.doc)}</td><td className="py-1 px-2 text-right">{R(calcAllIn(c))}</td></tr>})}</tbody></table></div></div>;

  return<div className="p-4 max-w-4xl mx-auto"><h2 className="text-xl font-bold text-white mb-4">Vendor Overview</h2>
    <div className="space-y-1">{vSummary.map(v=><button key={v.name} onClick={()=>setSel(v.name)} className="w-full text-left px-4 py-3 rounded-lg bg-gray-900/50 hover:bg-gray-800 flex items-center gap-4">
      <div className="flex gap-1 min-w-[80px]">{v.cr>0&&<span className="text-xs bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded font-semibold">{v.cr}</span>}{v.wa>0&&<span className="text-xs bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-semibold">{v.wa}</span>}<span className="text-xs bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded">{v.he}</span></div>
      <span className="text-white font-medium flex-1">{v.name}</span>
      <span className="text-gray-500 text-xs">{v.cores} cores · DSR:{R(v.totalDsr)}</span>
    </button>)}</div></div>}

// === MAIN APP ===
const TABS=[{id:"purchasing",l:"Purchasing"},{id:"core",l:"Core Detail"},{id:"bundle",l:"Bundle Detail"},{id:"vendors",l:"Vendors"},{id:"glossary",l:"Glossary"}];
export default function App(){
  const[tab,setTab]=useState("purchasing");const[showS,setShowS]=useState(false);
  const[stg,setStg]=useState({buyer:'',domesticDoc:90,intlDoc:180,critMode:"lt",critDays:30,warnMode:"ltbuf",warnDays:60,fA:"yes",fI:"blank",fV:"yes"});
  const[gl,setGl]=useState(DEF_GL);const[coreId,setCoreId]=useState(null);const[bundleId,setBundleId]=useState(null);
  const[data,setData]=useState({cores:[],bundles:[],vendors:[],sales:[],fees:[],inbound:[]});
  const[hist,setHist]=useState({bundleSales:[],coreInv:[],bundleInv:[],priceHist:[]});
  const[daily,setDaily]=useState({coreDays:[],bundleDays:[]});
  const[ov,setOv]=useState({});// Manual overrides persist across tabs
  const[loading,setLoading]=useState(true);const[error,setError]=useState(null);const[ts,setTs]=useState("");const[ready,setReady]=useState({h:false,d:false});
  const load=useCallback(()=>{setLoading(true);setError(null);apiCall('live').then(d=>{
    setData({cores:d.cores||[],bundles:d.bundles||[],vendors:d.vendors||[],sales:d.sales||[],fees:d.fees||[],inbound:d.inbound||[]});
    setTs(d.timestamp||"");setLoading(false);
    apiCall('history').then(h=>{setHist(h);setReady(r=>({...r,h:true}))}).catch(()=>setReady(r=>({...r,h:true})));
    apiCall('daily').then(d=>{setDaily(d);setReady(r=>({...r,d:true}))}).catch(()=>setReady(r=>({...r,d:true})));
  }).catch(e=>{setError(e.message);setLoading(false)})},[]);
  useEffect(()=>{load()},[load]);
  const dataH=useMemo(()=>({...data,_coreInv:hist.coreInv}),[data,hist]);
  const sc=useMemo(()=>{const c={critical:0,warning:0,healthy:0};(data.cores||[]).forEach(x=>{if(x.active!=="Yes")return;const v=(data.vendors||[]).find(v=>v.name===x.ven);c[getStatus(x.doc,v?.lt||30,x.buf||14,stg)]++});return c},[data,stg]);
  const goCore=useCallback(id=>{setCoreId(id);setTab("core")},[]);
  const goBundle=useCallback(id=>{setBundleId(id);setTab("bundle")},[]);
  if(loading)return<div className="min-h-screen bg-gray-950"><Loader text="Loading dashboard..."/></div>;
  if(error)return<div className="min-h-screen bg-gray-950 flex items-center justify-center"><div className="text-center"><p className="text-red-400 mb-4">{error}</p><button onClick={load} className="bg-blue-600 text-white px-6 py-2 rounded-lg">Retry</button></div></div>;
  return<div className="min-h-screen bg-gray-950 text-gray-200">
    <header className="bg-gray-900 border-b border-gray-800 px-4 py-3 sticky top-0 z-40"><div className="flex items-center justify-between max-w-7xl mx-auto"><div className="flex items-center gap-3"><h1 className="text-white font-bold text-lg">FBA Dashboard <span className="text-xs text-blue-400">V2</span></h1><span className="text-xs text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded font-medium">LIVE — {data.cores.length} cores</span>{stg.buyer&&<span className="text-xs text-gray-400 bg-gray-800 px-2 py-0.5 rounded">{stg.buyer}</span>}{fmtTs(ts)&&<span className="text-xs text-gray-500">{fmtTs(ts)}</span>}{(!ready.h||!ready.d)&&<span className="text-xs text-yellow-500 animate-pulse">Loading...</span>}</div><div className="flex items-center gap-3"><div className="flex gap-2 text-xs"><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"/>{sc.critical}</span><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"/>{sc.warning}</span><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"/>{sc.healthy}</span></div><button onClick={load} className="text-gray-400 hover:text-white text-sm px-2 py-1 rounded hover:bg-gray-800">↻</button><button onClick={()=>setShowS(true)} className="text-gray-400 hover:text-white text-lg px-2 py-1 rounded hover:bg-gray-800">⚙️</button></div></div></header>
    <nav className="bg-gray-900/50 border-b border-gray-800 px-4 sticky top-[53px] z-30"><div className="flex gap-0 max-w-7xl mx-auto overflow-x-auto">{TABS.map(t=><button key={t.id} onClick={()=>{setTab(t.id);if(t.id!=="core")setCoreId(null);if(t.id!=="bundle")setBundleId(null)}} className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap ${tab===t.id?"border-blue-500 text-blue-400":"border-transparent text-gray-500 hover:text-gray-300"}`}>{t.l}</button>)}</div></nav>
    <main className="max-w-7xl mx-auto">
      {tab==="purchasing"&&<PurchasingTab data={dataH} stg={stg} onViewCore={goCore} daily={daily} ov={ov} setOv={setOv}/>}
      {tab==="core"&&<CoreDetailTab data={data} stg={stg} hist={hist} daily={daily} coreId={coreId} onBack={()=>setTab("purchasing")} onGoBundle={goBundle}/>}
      {tab==="bundle"&&<BundleDetailTab data={data} stg={stg} hist={hist} daily={daily} bundleId={bundleId} onBack={()=>{if(coreId)setTab("core");else setTab("purchasing")}} onGoCore={goCore}/>}
      {tab==="vendors"&&<VendorDetailsTab data={data} stg={stg}/>}
      {tab==="glossary"&&<GlossaryTab gl={gl} setGl={setGl}/>}
    </main>
    {showS&&<SettingsModal s={stg} setS={setStg} onClose={()=>setShowS(false)}/>}
  </div>}
