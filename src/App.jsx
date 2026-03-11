// FBA DASHBOARD API v8 — V2 with vendor details, vendor SKU, new inbound, daily
var CONFIG = {
  sheets: {
    main:'1F1hSU9znhuFlHSp1Ql-2g4-VwQrtRkPUBQzgZrQwdI0',
    fees:'1o3knUNKth0ehblfX-tsPXTpP3GEW5ms4S72Dyz5eDu0',
    sales:'1Sk6cEBn16WQNkn_h2hFWFUm2nM4w8KYT5Sedv1zUp6E',
    summary:'14W3T-O3q5bVYF5PlMbueozyYB5z3tzCPHxhtTAcJVlM',
    inbound:'1CdpmwuSHPtq3IuG6y3w7qn1bFTf1qulm7kaKRqnaSDc',
    coreDaily:'1c2PKs1yU2DCWvIVQSnJuLv9c-nm7C7M3OLwngEV1Vqw',
    bundleDaily:'1EWXEaV3f-uNTspWdPDdgXR2GLzQnZVbuJQP4lnZsYT4',
  },
  tabs: {
    cores:'Core Products',bundles:'Bundle SKUs',vendors:'Vendor List',
    fees:'Current Fees by ASIN',sales:'Sales by Period by ASIN',
    dashboard:'Dashboard_Agg',bundleSales:'Monthly Bundle Sales',
    priceHist:'Monthly Price History',bundleInv:'Monthly Bundle Inventory',
    coreInv:'Monthly Core Inventory',
    inbound:'Sheet1',
    coreDailyHist:'Inventory History',bundleDailyHist:'Inventory History',
  },
  refreshMinutes:15,cacheTTL:1200,
};

function doGet(e){var p=e?e.parameter:{};var action=p.action||'live';var callback=p.callback;var result;try{switch(action){case'live':result=getLiveData();break;case'history':result=getHistoryData();break;case'daily':result=getDailyData();break;case'all':result=getLiveData();result.history=getHistoryData();break;case'dashboard':result=getDashboardCached();break;case'refresh':refreshAllCaches();result={status:'ok'};break;case'status':result={timestamp:getTS(),note:'v8'};break;default:result={error:'Unknown: '+action}}}catch(err){result={error:err.message}}var json=JSON.stringify(result);if(callback)return ContentService.createTextOutput(callback+'('+json+')').setMimeType(ContentService.MimeType.JAVASCRIPT);return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON)}

var CK=95000;
function cSet(key,data){var cache=CacheService.getScriptCache();var json=JSON.stringify(data);var n=Math.ceil(json.length/CK);var pairs={};pairs[key+'_n']=String(n);for(var i=0;i<n;i++)pairs[key+'_'+i]=json.substring(i*CK,(i+1)*CK);var entries=Object.entries(pairs);for(var i=0;i<entries.length;i+=25)cache.putAll(Object.fromEntries(entries.slice(i,i+25)),CONFIG.cacheTTL);Logger.log('['+key+'] '+json.length+' chars, '+n+' chunks')}
function cGet(key){var cache=CacheService.getScriptCache();var nStr=cache.get(key+'_n');if(!nStr)return null;var n=parseInt(nStr);var keys=[];for(var i=0;i<n;i++)keys.push(key+'_'+i);var vals=cache.getAll(keys);var json='';for(var i=0;i<n;i++){var c=vals[key+'_'+i];if(!c)return null;json+=c}try{return JSON.parse(json)}catch(e){return null}}
function getTS(){return CacheService.getScriptCache().get('_ts')||''}

function num(v){if(v===''||v==null)return 0;var n=Number(v);return isNaN(n)?0:Math.round(n*1000)/1000}
function str(v){return v==null?'':String(v).trim()}
function monthStr(v){if(!v)return'';if(v instanceof Date){if(isNaN(v.getTime()))return'';var y=v.getFullYear();var m=v.getMonth()+1;return y+'-'+(m<10?'0'+m:''+m)}var s=String(v).trim();if(/^\d{4}-\d{2}$/.test(s))return s;try{var d=new Date(s);if(!isNaN(d.getTime())){var y=d.getFullYear();var m=d.getMonth()+1;return y+'-'+(m<10?'0'+m:''+m)}}catch(e){}return s}
function dateStr(v){if(!v)return'';if(v instanceof Date){if(isNaN(v.getTime()))return'';var y=v.getFullYear();var m=v.getMonth()+1;var d=v.getDate();return y+'-'+(m<10?'0'+m:''+m)+'-'+(d<10?'0'+d:''+d)}var s=String(v).trim();try{var dt=new Date(s);if(!isNaN(dt.getTime())){var y=dt.getFullYear();var mo=dt.getMonth()+1;var d=dt.getDate();return y+'-'+(mo<10?'0'+mo:''+mo)+'-'+(d<10?'0'+d:''+d)}}catch(e){}return s}
function getYM(v){if(!v)return null;var d=v instanceof Date?v:new Date(v);if(isNaN(d.getTime()))return null;return{y:d.getFullYear(),m:d.getMonth()+1}}

function readSheet(sid,tab){try{var s=SpreadsheetApp.openById(sid).getSheetByName(tab);if(!s){Logger.log('Tab not found: '+tab);return{h:[],r:[]}}var d=s.getDataRange().getValues();var hi=0;for(var i=0;i<Math.min(d.length,5);i++){var row=d[i];var found=false;for(var j=0;j<row.length;j++){var cs=String(row[j]);if(cs.indexOf('Core')>=0||cs.indexOf('JLS')>=0||cs.indexOf('Vendor')>=0||cs.indexOf('Cases')>=0||cs.indexOf('Month')>=0||cs.indexOf('Units')>=0||cs.indexOf('Date')>=0||cs.indexOf('Unique')>=0){found=true;break}}if(found){hi=i;break}}return{h:d[hi]||[],r:d.slice(hi+1)}}catch(e){Logger.log('Read err ['+tab+']: '+e.message);return{h:[],r:[]}}}
function cm(headers){var m={};for(var i=0;i<headers.length;i++)m[String(headers[i]).trim()]=i;return m}
function g(row,c,name){var i=c[name];return i!==undefined?row[i]:undefined}

// === LIVE DATA PROCESSORS ===
function processCores(){var d=readSheet(CONFIG.sheets.main,CONFIG.tabs.cores);var c=cm(d.h);return d.r.filter(function(row){return row[c['Core Number']]}).map(function(row){return{id:str(g(row,c,'Core Number')),ti:str(g(row,c,'Internal Title')),vsku:str(g(row,c,'Vendor SKU')),dsr:num(g(row,c,'DSR')),d1:num(g(row,c,'1 Day DSR')),d3:num(g(row,c,'3 Day DSR')),d7:num(g(row,c,'7 Day DSR')),doc:num(g(row,c,'Complete DOC')),cash:num(g(row,c,'Cash Invested')),own:num(g(row,c,'All-In Owned Pieces')),raw:num(g(row,c,'Raw Pieces')),inb:num(g(row,c,'Inbound Pieces')),pp:num(g(row,c,'Pre-Processed Pieces')),jfn:num(g(row,c,'JFN Pieces')),pq:num(g(row,c,'Processing Queue Pieces')),ji:num(g(row,c,'JLS Inbound to FBA Pieces')),fba:num(g(row,c,'Total FBA & Inbound Pieces')),jlsList:str(g(row,c,'Attached JLS #s')),ven:str(g(row,c,'Vendor')),vou:str(g(row,c,'Vendor Order Unit')),casePack:num(g(row,c,'Vendor Case Pack')),cost:num(g(row,c,'Latest Vendor Cost per Piece')),moq:num(g(row,c,'MOQ (Pieces)')),buf:num(g(row,c,'Buffer Days')),minLevel:num(g(row,c,'Minimum Level')),note:str(g(row,c,'Note for Next Order')),blendedCost:num(g(row,c,'Blended Vendor Cost per Piece')),cat:str(g(row,c,'Core Category')),tag1:str(g(row,c,'Tag 1')),tag2:str(g(row,c,'Tag 2')),hazmat:str(g(row,c,'Hazmat')),active:str(g(row,c,'Active')),ignoreUntil:str(g(row,c,'Ignore Until')),visible:str(g(row,c,'Visible')),restockable:str(g(row,c,'Restockable'))}})}

function processBundles(){var d=readSheet(CONFIG.sheets.main,CONFIG.tabs.bundles);var c=cm(d.h);return d.r.filter(function(row){return row[c['JLS #']]}).map(function(row){return{j:str(g(row,c,'JLS #')),t:str(g(row,c,'Short Title')),cd:num(g(row,c,'Complete DSR')),fbaDsr:num(g(row,c,'FBA DSR')),d7fba:num(g(row,c,'7 Day FBA DSR')),d7comp:num(g(row,c,'7 Day Complete DSR')),d1:num(g(row,c,'1 Day FBA DSR')),d3:num(g(row,c,'3 Day FBA DSR')),cogs:num(g(row,c,'COGS')),pdmtCogs:num(g(row,c,'PDMT COGS')),aicogs:num(g(row,c,'AICOGS')),cash:num(g(row,c,'Cash Invested')),doc:num(g(row,c,'Complete DOC')),fibDoc:num(g(row,c,'FIBDOC')),fibInv:num(g(row,c,'FIB Inventory')),scInv:num(g(row,c,'SC Inventory')),reserved:num(g(row,c,'Reserved')),inbound:num(g(row,c,'Inbound')),brand:str(g(row,c,'Brand')),active:str(g(row,c,'Active')),tag1:str(g(row,c,'Tag 1')),replenTag:str(g(row,c,'Replen Tag')),ignoreUntil:str(g(row,c,'Ignore Until')),asin:str(g(row,c,'ASIN')),bundleCode:str(g(row,c,'Bundle Code')),numCores:num(g(row,c,'Number of Cores')),vendors:str(g(row,c,'Vendors')),core1:str(g(row,c,'Core 1'))}})}

function processVendors(){var d=readSheet(CONFIG.sheets.main,CONFIG.tabs.vendors);var c=cm(d.h);return d.r.filter(function(row){return row[c['Vendor Name']]}).map(function(row){return{name:str(g(row,c,'Vendor Name')),code:str(g(row,c,'Short Code')),vou:str(g(row,c,'Vendor Order Unit')),dead:str(g(row,c,'Dead Vendor or Supply Vendor')),lt:num(g(row,c,'Lead Time (Days)')),bizDays:num(g(row,c,'Business Days to Receive')),moqDollar:num(g(row,c,'$ MOQ')),moqCases:num(g(row,c,'Cases MOQ')),payment:str(g(row,c,'Payment Method')),terms:str(g(row,c,'Terms')),orderMethod:str(g(row,c,'Order Method')),country:str(g(row,c,'Country')),contactName:str(g(row,c,'Order Contact Name')),contactPhone:str(g(row,c,'Order Contact Phone')),contactEmail:str(g(row,c,'Order Contact Email')),address:str(g(row,c,'Combined Address')),address1:str(g(row,c,'Address 1')),address2:str(g(row,c,'Address 2')),city:str(g(row,c,'City')),state:str(g(row,c,'State')),zip:str(g(row,c,'Zip'))}})}

function processSales(){var d=readSheet(CONFIG.sheets.sales,CONFIG.tabs.sales);var c=cm(d.h);return d.r.filter(function(row){return row[c['JLS #']]}).map(function(row){return{j:str(g(row,c,'JLS #')),t:str(g(row,c,'Short Title')),asin:str(g(row,c,'ASIN')),tmU:num(g(row,c,'This Month Units')),tmR:num(g(row,c,'This Month Revenue')),tmP:num(g(row,c,'This Month Profit')),lmU:num(g(row,c,'Last Month Units')),lmR:num(g(row,c,'Last Month Revenue')),lmP:num(g(row,c,'Last Month Profit')),lm1U:num(g(row,c,'Last Month -1 Units')),lm1R:num(g(row,c,'Last Month -1 Revenue')),lm1P:num(g(row,c,'Last Month -1 Profit')),ydU:num(g(row,c,'Yesterday Units')),ydR:num(g(row,c,'Yesterday Revenue')),ydP:num(g(row,c,'Yesterday Profit')),l7U:num(g(row,c,'Last 7 Days Units')),l7R:num(g(row,c,'Last 7 Days Revenue')),l7P:num(g(row,c,'Last 7 Days Profit')),l14U:num(g(row,c,'Last 8-14 Days Units')),l14R:num(g(row,c,'Last 8-14 Days Revenue')),l28U:num(g(row,c,'Last 28 Days Units')),l28R:num(g(row,c,'Last 28 Days Revenue')),l28P:num(g(row,c,'Last 28 Days Profit')),l84U:num(g(row,c,'Last 84 Days Units')),l84R:num(g(row,c,'Last 84 Days Revenue')),l84P:num(g(row,c,'Last 84 Days Profit')),l365U:num(g(row,c,'Last 365 Days Units')),l365R:num(g(row,c,'Last 365 Days Revenue')),l365P:num(g(row,c,'Last 365 Days Profit')),tyU:num(g(row,c,'This Year Units')),tyR:num(g(row,c,'This Year Revenue')),tyP:num(g(row,c,'This Year Profit')),lyU:num(g(row,c,'Last Year Units')),lyR:num(g(row,c,'Last Year Revenue')),lyP:num(g(row,c,'Last Year Profit')),ltU:num(g(row,c,'Lifetime Units')),ltR:num(g(row,c,'Lifetime Revenue')),ltP:num(g(row,c,'Lifetime Profit'))}})}

function processFees(){var d=readSheet(CONFIG.sheets.fees,CONFIG.tabs.fees);var c=cm(d.h);return d.r.filter(function(row){return row[c['JLS #']]}).map(function(row){return{j:str(g(row,c,'JLS #')),asin:str(g(row,c,'ASIN')),t:str(g(row,c,'Short Title')),pr:num(g(row,c,'Price')),refFee:num(g(row,c,'Referral Fee')),fbaFee:num(g(row,c,'FBA Fee')),jfnFee:num(g(row,c,'JFN Fee')),totalFee:num(g(row,c,'Total Fee')),netRev:num(g(row,c,'Net Revenue')),pdmtCogs:num(g(row,c,'PDMT COGS')),aicogs:num(g(row,c,'AICOGS')),gp:num(g(row,c,'Gross Profit')),bePr:num(g(row,c,'Breakeven Price')),beAcos:num(g(row,c,'Breakeven ACoS')),dubAcos:num(g(row,c,'Double Up ACoS'))}})}

// NEW INBOUND — reads from Final Arrival Date sheet
function processInbound(){var d=readSheet(CONFIG.sheets.inbound,CONFIG.tabs.inbound);var c=cm(d.h);return d.r.filter(function(row){var cv=g(row,c,'Core #');return cv&&String(cv).trim()!==''}).map(function(row){return{core:str(g(row,c,'Core #')),name:str(g(row,c,'Name')),vendor:str(g(row,c,'Vendor')),shortTitle:str(g(row,c,'Short Title')),vsku:str(g(row,c,'Vendor SKU')),pieces:num(g(row,c,'Pieces Ordered')),cases:num(g(row,c,'Cases Ordered')),price:num(g(row,c,'Piece Price')),terms:str(g(row,c,'Terms')),orderNum:str(g(row,c,'Order #')),eta:dateStr(g(row,c,'Final Arrival Date')),origEta:dateStr(g(row,c,'Expected Arrival')),piecesMissing:num(g(row,c,'Pieces Missing')),country:str(g(row,c,'Country'))}})}

// === HISTORY PROCESSORS (unchanged) ===
function processBundleSales(){var d=readSheet(CONFIG.sheets.summary,CONFIG.tabs.bundleSales);var c=cm(d.h);return d.r.filter(function(row){return row[c['JLS #']]}).map(function(row){return{j:str(g(row,c,'JLS #')),month:monthStr(g(row,c,'Month')),y:num(g(row,c,'Year')),m:num(g(row,c,'Mo')),units:num(g(row,c,'Units')),rev:num(g(row,c,'Revenue')),profit:num(g(row,c,'Profit')),avgPrice:num(g(row,c,'Avg Price'))}})}
function processCoreInvSummary(){var d=readSheet(CONFIG.sheets.summary,CONFIG.tabs.coreInv);var c=cm(d.h);return d.r.filter(function(row){return row[c['Core']]}).map(function(row){return{core:str(g(row,c,'Core')),month:monthStr(g(row,c,'Month')),y:num(g(row,c,'Year')),m:num(g(row,c,'Mo')),avgDsr:num(g(row,c,'Avg DSR')),avg7d:num(g(row,c,'Avg 7D DSR')),avgDoc:num(g(row,c,'Avg DOC')),avgOwn:num(g(row,c,'Avg All-In Own')),avgFba:num(g(row,c,'Avg FBA')),oosDays:num(g(row,c,'OOS Days')),newOos:num(g(row,c,'New OOS Events')),dataDays:num(g(row,c,'Data Days'))}})}
function processBundleInvSummary(){var d=readSheet(CONFIG.sheets.summary,CONFIG.tabs.bundleInv);var c=cm(d.h);return d.r.filter(function(row){return row[c['JLS #']]}).map(function(row){return{j:str(g(row,c,'JLS #')),month:monthStr(g(row,c,'Month')),y:num(g(row,c,'Year')),m:num(g(row,c,'Mo')),avgDsr:num(g(row,c,'Avg DSR')),avg7d:num(g(row,c,'Avg 7D DSR')),avgDoc:num(g(row,c,'Avg DOC')),avgFib:num(g(row,c,'Avg FIB Inv')),dataDays:num(g(row,c,'Data Days'))}})}
function processPriceHist(){var d=readSheet(CONFIG.sheets.summary,CONFIG.tabs.priceHist);var c=cm(d.h);return d.r.filter(function(row){return row[c['JLS #']]}).map(function(row){return{j:str(g(row,c,'JLS #')),month:monthStr(g(row,c,'Month')),y:num(g(row,c,'Year')),m:num(g(row,c,'Mo')),avgPrice:num(g(row,c,'Avg Price')),avgGp:num(g(row,c,'Avg GP')),avgFee:num(g(row,c,'Avg Total Fee')),dataPoints:num(g(row,c,'Data Points'))}})}
function processDashboard(){var d=readSheet(CONFIG.sheets.summary,CONFIG.tabs.dashboard);var c=cm(d.h);return d.r.filter(function(row){return row[c['Month']]}).map(function(row){return{month:monthStr(g(row,c,'Month')),units:num(g(row,c,'Units')),rev:num(g(row,c,'Revenue')),profit:num(g(row,c,'Profit'))}})}

// === DAILY DATA (last 14 days raw) ===
function getDailyData(){
  var cutoff=new Date();cutoff.setDate(cutoff.getDate()-14);
  var cd=readSheet(CONFIG.sheets.coreDaily,CONFIG.tabs.coreDailyHist);var cc=cm(cd.h);
  var coreDays=[];
  for(var i=0;i<cd.r.length;i++){
    var row=cd.r[i];var dv=g(row,cc,'Date');if(!dv)continue;
    var dt=dv instanceof Date?dv:new Date(dv);if(isNaN(dt.getTime())||dt<cutoff)continue;
    coreDays.push({date:dateStr(dv),core:str(g(row,cc,'Core Number')),dsr:num(g(row,cc,'DSR')),d7:num(g(row,cc,'7 Day DSR')),doc:num(g(row,cc,'Complete DOC')),own:num(g(row,cc,'All-In Owned Pieces')),fba:num(g(row,cc,'Total FBA & Inbound Pieces'))});
  }
  var bd=readSheet(CONFIG.sheets.bundleDaily,CONFIG.tabs.bundleDailyHist);var bc=cm(bd.h);
  var bundleDays=[];
  for(var i=0;i<bd.r.length;i++){
    var row=bd.r[i];var dv=g(row,bc,'Date');if(!dv)continue;
    var dt=dv instanceof Date?dv:new Date(dv);if(isNaN(dt.getTime())||dt<cutoff)continue;
    bundleDays.push({date:dateStr(dv),j:str(g(row,bc,'JLS #')),dsr:num(g(row,bc,'Complete DSR')),d7:num(g(row,bc,'7 Day Complete DSR')),doc:num(g(row,bc,'Complete DOC')),fib:num(g(row,bc,'FIB Inventory'))});
  }
  return{coreDays:coreDays,bundleDays:bundleDays};
}

// === DAILY HISTORY AGGREGATION ===
function aggregateCoreDailyByMonth(){
  var d=readSheet(CONFIG.sheets.coreDaily,CONFIG.tabs.coreDailyHist);var c=cm(d.h);
  var buckets={};
  for(var i=0;i<d.r.length;i++){
    var row=d.r[i];var dateVal=g(row,c,'Date');var coreId=str(g(row,c,'Core Number'));
    if(!coreId||!dateVal)continue;var ym=getYM(dateVal);if(!ym)continue;
    var key=coreId+'|'+ym.y+'|'+ym.m;
    if(!buckets[key])buckets[key]={core:coreId,y:ym.y,m:ym.m,dsrSum:0,d7Sum:0,docSum:0,ownSum:0,fbaSum:0,oos:0,newOos:0,n:0};
    var b=buckets[key];b.dsrSum+=num(g(row,c,'DSR'));b.d7Sum+=num(g(row,c,'7 Day DSR'));b.docSum+=num(g(row,c,'Complete DOC'));b.ownSum+=num(g(row,c,'All-In Owned Pieces'));b.fbaSum+=num(g(row,c,'Total FBA & Inbound Pieces'));
    var oosVal=g(row,c,'Out of Stock');if(oosVal==='Yes'||oosVal===true||oosVal===1||oosVal==='TRUE')b.oos++;
    var newOosVal=g(row,c,'New Out of Stock');if(newOosVal==='Yes'||newOosVal===true||newOosVal===1||newOosVal==='TRUE')b.newOos++;b.n++;
  }
  var result=[];var keys=Object.keys(buckets);
  for(var i=0;i<keys.length;i++){var b=buckets[keys[i]];var mo=b.y+'-'+(b.m<10?'0'+b.m:''+b.m);result.push({core:b.core,month:mo,y:b.y,m:b.m,avgDsr:Math.round(b.dsrSum/b.n*1000)/1000,avg7d:Math.round(b.d7Sum/b.n*1000)/1000,avgDoc:Math.round(b.docSum/b.n*1000)/1000,avgOwn:Math.round(b.ownSum/b.n*1000)/1000,avgFba:Math.round(b.fbaSum/b.n*1000)/1000,oosDays:b.oos,newOos:b.newOos,dataDays:b.n})}
  return result;
}
function aggregateBundleDailyByMonth(){
  var d=readSheet(CONFIG.sheets.bundleDaily,CONFIG.tabs.bundleDailyHist);var c=cm(d.h);
  var buckets={};
  for(var i=0;i<d.r.length;i++){
    var row=d.r[i];var dateVal=g(row,c,'Date');var jls=str(g(row,c,'JLS #'));
    if(!jls||!dateVal)continue;var ym=getYM(dateVal);if(!ym)continue;
    var key=jls+'|'+ym.y+'|'+ym.m;
    if(!buckets[key])buckets[key]={j:jls,y:ym.y,m:ym.m,dsrSum:0,d7Sum:0,docSum:0,fibSum:0,n:0};
    var b=buckets[key];b.dsrSum+=num(g(row,c,'Complete DSR'));b.d7Sum+=num(g(row,c,'7 Day Complete DSR'));b.docSum+=num(g(row,c,'Complete DOC'));b.fibSum+=num(g(row,c,'FIB Inventory'));b.n++;
  }
  var result=[];var keys=Object.keys(buckets);
  for(var i=0;i<keys.length;i++){var b=buckets[keys[i]];var mo=b.y+'-'+(b.m<10?'0'+b.m:''+b.m);result.push({j:b.j,month:mo,y:b.y,m:b.m,avgDsr:Math.round(b.dsrSum/b.n*1000)/1000,avg7d:Math.round(b.d7Sum/b.n*1000)/1000,avgDoc:Math.round(b.docSum/b.n*1000)/1000,avgFib:Math.round(b.fibSum/b.n*1000)/1000,dataDays:b.n})}
  return result;
}
function mergeCoreInv(summary,daily){var existing={};for(var i=0;i<summary.length;i++)existing[summary[i].core+'|'+summary[i].y+'|'+summary[i].m]=true;var merged=summary.slice();for(var i=0;i<daily.length;i++){var d=daily[i];if(!existing[d.core+'|'+d.y+'|'+d.m])merged.push(d)}return merged}
function mergeBundleInv(summary,daily){var existing={};for(var i=0;i<summary.length;i++)existing[summary[i].j+'|'+summary[i].y+'|'+summary[i].m]=true;var merged=summary.slice();for(var i=0;i<daily.length;i++){var d=daily[i];if(!existing[d.j+'|'+d.y+'|'+d.m])merged.push(d)}return merged}

// === REFRESH ===
function refreshAllCaches(){
  var start=new Date();Logger.log('=== REFRESH START v8 ===');
  try{cSet('cores',processCores())}catch(e){Logger.log('ERR cores:'+e.message)}
  try{cSet('bundles',processBundles())}catch(e){Logger.log('ERR bundles:'+e.message)}
  try{cSet('vendors',processVendors())}catch(e){Logger.log('ERR vendors:'+e.message)}
  try{cSet('sales',processSales())}catch(e){Logger.log('ERR sales:'+e.message)}
  try{cSet('fees',processFees())}catch(e){Logger.log('ERR fees:'+e.message)}
  try{cSet('inbound',processInbound())}catch(e){Logger.log('ERR inbound:'+e.message)}
  try{cSet('dashboard',processDashboard())}catch(e){Logger.log('ERR dashboard:'+e.message)}
  try{cSet('h_bsales',processBundleSales())}catch(e){Logger.log('ERR h_bsales:'+e.message)}
  try{cSet('h_price',processPriceHist())}catch(e){Logger.log('ERR h_price:'+e.message)}
  try{var cs=processCoreInvSummary();var cd=aggregateCoreDailyByMonth();cSet('h_coreinv',mergeCoreInv(cs,cd))}catch(e){Logger.log('ERR h_coreinv:'+e.message)}
  try{var bs=processBundleInvSummary();var bd=aggregateBundleDailyByMonth();cSet('h_binv',mergeBundleInv(bs,bd))}catch(e){Logger.log('ERR h_binv:'+e.message)}
  CacheService.getScriptCache().put('_ts',new Date().toISOString(),CONFIG.cacheTTL);
  Logger.log('=== DONE: '+((new Date()-start)/1000).toFixed(1)+'s ===');
}

function getLiveData(){var cores=cGet('cores');if(!cores){refreshAllCaches();cores=cGet('cores')}return{cores:cores||[],bundles:cGet('bundles')||[],vendors:cGet('vendors')||[],sales:cGet('sales')||[],fees:cGet('fees')||[],inbound:cGet('inbound')||[],timestamp:getTS()}}
function getHistoryData(){var bs=cGet('h_bsales');if(!bs){try{refreshAllCaches();bs=cGet('h_bsales')}catch(e){bs=[]}}return{bundleSales:bs||[],coreInv:cGet('h_coreinv')||[],bundleInv:cGet('h_binv')||[],priceHist:cGet('h_price')||[]}}
function getDashboardCached(){return cGet('dashboard')||processDashboard()}
function setupTrigger(){var triggers=ScriptApp.getProjectTriggers();for(var i=0;i<triggers.length;i++){if(triggers[i].getHandlerFunction()==='refreshAllCaches')ScriptApp.deleteTrigger(triggers[i])}ScriptApp.newTrigger('refreshAllCaches').timeBased().everyMinutes(CONFIG.refreshMinutes).create();Logger.log('Trigger created');refreshAllCaches()}
function testLive(){var d=getLiveData();Logger.log('Cores:'+d.cores.length+' Bundles:'+d.bundles.length+' Vendors:'+d.vendors.length+' Inbound:'+d.inbound.length)}
function testHistory(){var h=getHistoryData();Logger.log('BundleSales:'+h.bundleSales.length+' CoreInv:'+h.coreInv.length)}
