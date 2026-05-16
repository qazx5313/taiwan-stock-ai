// ═══════════════════════════════════════════════
// config.js — 設定、股票名稱、上市股票清單
// ═══════════════════════════════════════════════

// ── 系統設定 ──
var CFG = {
  rsi_period:14, kd_period:9, macd_fast:12, macd_slow:26, macd_sig:9,
  vol_ratio:1.5, price_min:10, vol_min_b:1, ai_min:60,
  weights:{ tech:35, chip:30, volume:20, risk:15 },
};
var FINMIND_URL = 'https://api.finmindtrade.com/api/v4/data';

// ── API Key 存取 ──
function getKey(k){ return localStorage.getItem(k) || ''; }
function getFinMindKey(){ return getKey('finmind_key'); }
function getSBUrl(){ return getKey('sb_url'); }
function getSBKey(){ return getKey('sb_key'); }
function getClaudeKey(){ return getKey('claude_key'); }

// ── 工具函式 ──
function loadLocal(k, def){ try{ return JSON.parse(localStorage.getItem(k)) || def; } catch(e){ return def; } }
function saveLocal(k, v){ localStorage.setItem(k, JSON.stringify(v)); }
function fmtMoney(n){ if(Math.abs(n)>=10000) return (n/10000).toFixed(1)+'萬'; return n.toLocaleString('zh-TW'); }
function sleep(ms){ return new Promise(function(r){ setTimeout(r,ms); }); }
function escHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function toast(msg){
  var t = document.getElementById('toast');
  if(!t) return;
  t.textContent = msg; t.classList.add('show');
  setTimeout(function(){ t.classList.remove('show'); }, 3000);
}

// ── 密碼 hash ──
function hashPass(s){ return btoa(btoa(s + 'tw_stock_ai_salt_2025')); }

// ── 上市中的台股代號（已排除已下市股票）──
// 資料來源：TWSE 上市公司，截至 2025 年，僅保留上市中個股
var LISTED_STOCKS = {
  // 半導體
  '2330':'台積電','2303':'聯電','2454':'聯發科','2379':'瑞昱',
  '3034':'聯詠','3443':'創意','6533':'晶心科','3016':'嘉晶',
  '2344':'華邦電','2337':'旺宏','6770':'力積電','2408':'南科',
  '2448':'晶電','3711':'日月光投控','6415':'矽力-KY','2049':'上銀',
  // 電子代工/組裝
  '2317':'鴻海','2354':'鴻準','3231':'緯創','4938':'和碩',
  '2382':'廣達','6669':'緯穎','2308':'台達電','2357':'華碩',
  '2376':'技嘉','2377':'微星','2395':'研華',
  // 封裝測試
  '8046':'南電','4958':'臻鼎-KY','2345':'智邦','6505':'台塑化',
  // 面板/光電
  '3008':'大立光','2492':'華新科',
  // 網通/軟體
  '3045':'台灣大','4904':'遠傳','2412':'中華電',
  // 金融
  '2881':'富邦金','2882':'國泰金','2886':'兆豐金','2884':'玉山金',
  '2887':'台新金','2885':'元大金','2880':'華南金','2888':'新光金',
  '5871':'中信金','2891':'中信金控',
  // 傳產/鋼鐵
  '2002':'中鋼','1301':'台塑','1303':'南亞','1326':'台化',
  '2014':'中鴻','2015':'豐興','2022':'聚亨','2023':'燁輝',
  '2025':'千興','2027':'大成鋼','2029':'盛餘','2031':'新光鋼',
  '2062':'橋椿','2066':'瑞展',
  // 汽車/機械
  '2201':'裕隆','2204':'中華','2206':'三陽工','2207':'和泰車',
  '2059':'川湖','1590':'亞德客-KY',
  // 航運
  '2603':'長榮','2609':'陽明','2615':'萬海',
  // 零售/食品
  '2912':'統一超','5904':'寶雅','2105':'正新',
  // IC設計/其他科技
  '6184':'大成鋼','3546':'陞泰','4952':'凌通','2498':'宏達電',
  '3673':'TPK-KY','2404':'漢唐',
};

// 有效上市代號清單（用於掃描，已排除已下市）
var TOP300 = Object.keys(LISTED_STOCKS);

function getStockName(code){ return LISTED_STOCKS[code] || code; }
function isListed(code){ return !!LISTED_STOCKS[code]; }
