// ═══════════════════════════════════════════════
// config.js — 設定、股票清單（FinMind動態載入）
// ═══════════════════════════════════════════════

var CFG = {
  rsi_period:14, kd_period:9, macd_fast:12, macd_slow:26, macd_sig:9,
  vol_ratio:1.5, price_min:10, vol_min_b:1, ai_min:60,
  weights:{ tech:35, chip:30, volume:20, risk:15 },
};
var FINMIND_URL = 'https://api.finmindtrade.com/api/v4/data';

// ── API Key 存取 ──
function getKey(k){ return localStorage.getItem(k) || ''; }
function getFinMindKey(){ return getKey('finmind_key'); }
function getSBUrl(){     return getKey('sb_url'); }
function getSBKey(){     return getKey('sb_key'); }
function getClaudeKey(){ return getKey('claude_key'); }

// ── 工具 ──
function loadLocal(k,def){ try{ return JSON.parse(localStorage.getItem(k))||def; }catch(e){ return def; } }
function saveLocal(k,v){ localStorage.setItem(k,JSON.stringify(v)); }
function fmtMoney(n){ if(Math.abs(n)>=10000)return (n/10000).toFixed(1)+'萬'; return n.toLocaleString('zh-TW'); }
function sleep(ms){ return new Promise(function(r){ setTimeout(r,ms); }); }
function escHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function hashPass(s){ return btoa(btoa(s+'tw_stock_ai_salt_2025')); }
function toast(msg){
  var t=document.getElementById('toast'); if(!t)return;
  t.textContent=msg; t.classList.add('show');
  setTimeout(function(){ t.classList.remove('show'); },3000);
}

// ── 股票名稱對照表（動態從 FinMind 載入，初始為空）──
var LISTED_STOCKS = {};   // { code: name }
var STOCK_SECTOR  = {};   // { code: sector }
var TOP300        = [];   // 掃描用代號清單

// 是否已載入完整股票清單
var stockListLoaded = false;

// 從 FinMind TaiwanStockInfo 取得完整上市上櫃清單
async function loadStockList(){
  if(stockListLoaded) return;
  var cached = loadLocal('stock_list_cache', null);
  var cacheDate = loadLocal('stock_list_date', '');
  var today = new Date().toISOString().split('T')[0];

  // 使用今日快取
  if(cached && cacheDate === today && Object.keys(cached).length > 100){
    LISTED_STOCKS = cached.names || {};
    STOCK_SECTOR  = cached.sectors || {};
    TOP300        = Object.keys(LISTED_STOCKS);
    stockListLoaded = true;
    updateStockCount();
    return;
  }

  try{
    var token = getFinMindKey();
    var url   = new URL(FINMIND_URL);
    url.searchParams.set('dataset','TaiwanStockInfo');
    if(token) url.searchParams.set('token', token);

    var r = await fetch(url.toString(), { signal: AbortSignal.timeout(15000) });
    if(!r.ok) throw new Error('HTTP '+r.status);
    var json = await r.json();
    if(json.status !== 200) throw new Error(json.msg||'錯誤');

    var data = json.data || [];
    var names = {}, sectors = {};

    data.forEach(function(d){
      var id   = d.stock_id   || '';
      var name = d.stock_name || '';
      var type = d.type       || '';
      var cat  = d.industry_category || '—';

      // 只保留上市(twse)和上櫃(tpex)的普通股
      // 排除：ETF(前綴00)、權證(6位數)、債券、特別股(後綴P)
      if(!id || !name) return;
      if(!/^\d{4}$/.test(id)) return;  // 只要4位數代號（普通股）
      if(type !== 'twse' && type !== 'tpex') return;

      names[id]   = name;
      sectors[id] = cat;
    });

    LISTED_STOCKS = names;
    STOCK_SECTOR  = sectors;
    TOP300        = Object.keys(names);
    stockListLoaded = true;

    // 快取到 localStorage
    saveLocal('stock_list_cache', { names:names, sectors:sectors });
    saveLocal('stock_list_date', today);
    updateStockCount();

    // ✅ 清單載入完成後，刷新儀表板顯示（用真實股票代號）
    if(typeof renderDashTable === 'function') renderDashTable();
    if(typeof renderFullTable === 'function') renderFullTable();

    console.log('股票清單載入完成：'+TOP300.length+'檔');

  } catch(e){
    console.warn('loadStockList 失敗:', e.message);
    // Fallback：使用內建常見股清單
    useFallbackStockList();
  }
}

function useFallbackStockList(){
  var fallback = {
    '2330':'台積電','2317':'鴻海','2454':'聯發科','2382':'廣達','3711':'日月光投控',
    '2308':'台達電','2303':'聯電','2881':'富邦金','2882':'國泰金','2886':'兆豐金',
    '2002':'中鋼','1301':'台塑','1303':'南亞','1326':'台化','2412':'中華電',
    '3008':'大立光','2912':'統一超','2105':'正新','5871':'中信金','2884':'玉山金',
    '2887':'台新金','2885':'元大金','2880':'華南金','2888':'新光金',
    '6505':'台塑化','2207':'和泰車','2357':'華碩','2379':'瑞昱','3034':'聯詠',
    '2395':'研華','2345':'智邦','5904':'寶雅','2603':'長榮','2609':'陽明',
    '2615':'萬海','2377':'微星','2376':'技嘉','3045':'台灣大','4904':'遠傳',
    '6669':'緯穎','3231':'緯創','4938':'和碩','2354':'鴻準',
    '3016':'嘉晶','6533':'晶心科','8046':'南電','2337':'旺宏','6770':'力積電',
    '2344':'華邦電','2408':'南科','2448':'晶電','4958':'臻鼎-KY',
    '6415':'矽力-KY','2049':'上銀','2059':'川湖','1590':'亞德客-KY',
    '2492':'華新科','3443':'創意','2498':'宏達電','3673':'TPK-KY',
    '2404':'漢唐','3546':'陞泰','2014':'中鴻','2015':'豐興','2022':'聚亨',
    '2023':'燁輝','2025':'千興','2027':'大成鋼','2029':'盛餘','2031':'新光鋼',
    '2062':'橋椿','2066':'瑞展','2201':'裕隆','2204':'中華','2206':'三陽工',
  };
  LISTED_STOCKS = fallback;
  TOP300 = Object.keys(fallback);
  stockListLoaded = true;
  updateStockCount();
}

function updateStockCount(){
  var el = document.getElementById('total-stock-count');
  if(el) el.textContent = TOP300.length+'檔';
}

function getStockName(code){  return LISTED_STOCKS[code] || code; }
function getStockSector(code){ return STOCK_SECTOR[code]  || '—'; }
function isListed(code){ return !!LISTED_STOCKS[code]; }


// ── API Key 存取 ──
function getKey(k){ return localStorage.getItem(k) || ''; }
function getFinMindKey(){ return getKey('finmind_key'); }
function getSBUrl(){ return getKey('sb_url'); }
function getSBKey(){ return getKey('sb_key'); }
function getClaudeKey(){ return getKey('claude_key'); }

