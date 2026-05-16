// ═══════════════════════════════════════════════
// industry.js — AI產業鏈地圖 + 大戶籌碼 + 重大公告
// 資料來源：FinMind API (真實資料)
// ═══════════════════════════════════════════════

var FINMIND_BASE = 'https://api.finmindtrade.com/api/v4/data';

// FinMind API 呼叫（共用 rate limit 控制）
async function fmFetch(params, timeoutMs) {
  var url = new URL(FINMIND_BASE);
  var token = getFinMindKey();
  Object.entries(params).forEach(function(e){ url.searchParams.set(e[0], e[1]); });
  if(token) url.searchParams.set('token', token);
  var r = await fetch(url.toString(), { signal: AbortSignal.timeout(timeoutMs || 15000) });
  if(!r.ok) throw new Error('HTTP ' + r.status);
  var j = await r.json();
  if(j.status !== 200) throw new Error(j.msg || 'API Error');
  return j.data || [];
}

// ════════════════════════════════════════════
// 產業鏈地圖（靜態節點 + 動態個股）
// ════════════════════════════════════════════

var MOCK_NODES = {
  'ai-compute': [
    {id:'n-asic',     layer:1, label:'ASIC / IP 設計',   color:'#6366f1', x:80,  y:60 },
    {id:'n-hpc',      layer:1, label:'HPC 與網通 IC',    color:'#6366f1', x:80,  y:170},
    {id:'n-cxl',      layer:1, label:'CXL 記憶體池化',   color:'#6366f1', x:80,  y:280},
    {id:'n-pkg',      layer:2, label:'先進封裝設備',      color:'#8b5cf6', x:300, y:20 },
    {id:'n-substrate',layer:2, label:'封裝材料/載板',     color:'#8b5cf6', x:300, y:110},
    {id:'n-glass',    layer:2, label:'玻璃基板',          color:'#8b5cf6', x:300, y:200},
    {id:'n-cowos',    layer:2, label:'CoWoS 先進封裝',   color:'#8b5cf6', x:300, y:290},
    {id:'n-test',     layer:2, label:'高階測試介面',      color:'#8b5cf6', x:300, y:380},
    {id:'n-hbm',      layer:2, label:'HBM 供應鏈',       color:'#8b5cf6', x:300, y:470},
    {id:'n-cpo',      layer:3, label:'矽光子 CPO',        color:'#06b6d4', x:520, y:20 },
    {id:'n-conn',     layer:3, label:'高速連接器',        color:'#06b6d4', x:520, y:110},
    {id:'n-aircool',  layer:3, label:'散熱與氣冷',        color:'#06b6d4', x:520, y:200},
    {id:'n-liqcool',  layer:3, label:'液冷散熱系統',      color:'#06b6d4', x:520, y:290},
    {id:'n-bbu',      layer:3, label:'BBU 備援系統',      color:'#06b6d4', x:520, y:380},
    {id:'n-psu',      layer:3, label:'電源供應器',        color:'#06b6d4', x:520, y:470},
    {id:'n-mlcc',     layer:3, label:'MLCC 電容',         color:'#06b6d4', x:520, y:560},
    {id:'n-inductor', layer:3, label:'功率電感',          color:'#06b6d4', x:520, y:640},
    {id:'n-optical',  layer:4, label:'高速光模組',        color:'#10b981', x:740, y:60 },
    {id:'n-server',   layer:4, label:'AI 伺服器組裝',     color:'#10b981', x:740, y:150},
    {id:'n-chassis',  layer:4, label:'機殼與滑軌',        color:'#10b981', x:740, y:240},
    {id:'n-network',  layer:4, label:'網通設備',          color:'#10b981', x:740, y:330},
    {id:'n-aiot',     layer:4, label:'Edge AI / AIoT',    color:'#10b981', x:740, y:420},
    {id:'n-sat',      layer:4, label:'低軌衛星',          color:'#10b981', x:740, y:510},
    {id:'n-defense',  layer:4, label:'軍工產業',          color:'#10b981', x:740, y:600},
  ],

  // ─── 消費與終端 ───
  'consumer': [
    // Layer 1: 消費電子 IC
    {id:'c-disp',   layer:1, label:'顯示驅動 IC',       color:'#f59e0b', x:80, y:80 },
    {id:'c-analog',  layer:1, label:'類比與功率管理 IC', color:'#f59e0b', x:80, y:200},
    {id:'c-auto',    layer:1, label:'車用電子 IC',       color:'#f59e0b', x:80, y:320},
    // Layer 2: 主流終端
    {id:'c-pkg',     layer:2, label:'主流封裝與測試',    color:'#ef4444', x:300, y:60 },
    {id:'c-dist',    layer:2, label:'IC 通路',           color:'#ef4444', x:300, y:180},
    {id:'c-mem',     layer:2, label:'記憶體模組',        color:'#ef4444', x:300, y:300},
    // Layer 3: 關鍵元件
    {id:'c-glass',   layer:3, label:'玻纖布',            color:'#06b6d4', x:520, y:20 },
    {id:'c-resist',  layer:3, label:'電阻與晶振',        color:'#06b6d4', x:520, y:100},
    {id:'c-conn',    layer:3, label:'連接器',            color:'#06b6d4', x:520, y:180},
    {id:'c-fpc',     layer:3, label:'軟板 FPC',          color:'#06b6d4', x:520, y:260},
    {id:'c-sensor',  layer:3, label:'光感測元件',        color:'#06b6d4', x:520, y:340},
    {id:'c-lens',    layer:3, label:'光學鏡頭',          color:'#06b6d4', x:520, y:420},
    {id:'c-panel',   layer:3, label:'面板產業',          color:'#06b6d4', x:520, y:500},
    {id:'c-mech',    layer:3, label:'精密機構',          color:'#06b6d4', x:520, y:580},
    {id:'c-pcb',     layer:3, label:'PCB 製造',          color:'#06b6d4', x:520, y:660},
    // Layer 4: 終端裝置
    {id:'c-pcnb',    layer:4, label:'PC / NB',           color:'#10b981', x:740, y:80 },
    {id:'c-phone',   layer:4, label:'手機與消費電子',    color:'#10b981', x:740, y:180},
    {id:'c-robot',   layer:4, label:'實體 AI 機器人',    color:'#10b981', x:740, y:280},
    {id:'c-xr',      layer:4, label:'AR/VR/XR 光學',    color:'#10b981', x:740, y:380},
    {id:'c-auto2',   layer:4, label:'工業自動化',        color:'#10b981', x:740, y:480},
  ],

  // ─── 晶圓製造上游 ───
  'wafer': [
    // Layer 1: 設備・材料・廠務
    {id:'w-equip',   layer:1, label:'晶圓廠設備',        color:'#8b5cf6', x:80, y:80 },
    {id:'w-mat',     layer:1, label:'半導體材料',        color:'#8b5cf6', x:80, y:220},
    {id:'w-epc',     layer:1, label:'設備工程 EPC',      color:'#8b5cf6', x:80, y:360},
    // Layer 2: 晶圓製造
    {id:'w-foundry', layer:2, label:'晶圓代工',          color:'#06b6d4', x:300, y:100},
    {id:'w-3rd',     layer:2, label:'第三代半導體',      color:'#06b6d4', x:300, y:280},
    // Layer 3: 封裝與測試
    {id:'w-cowos',   layer:3, label:'CoWoS 先進封裝',   color:'#6366f1', x:520, y:40 },
    {id:'w-test',    layer:3, label:'高階測試介面',      color:'#6366f1', x:520, y:160},
    {id:'w-hbm',     layer:3, label:'HBM 供應鏈',       color:'#6366f1', x:520, y:280},
    {id:'w-pkg',     layer:3, label:'主流封裝與測試',    color:'#6366f1', x:520, y:400},
    // Layer 4: 通路・模組
    {id:'w-dist',    layer:4, label:'IC 通路',           color:'#10b981', x:740, y:120},
    {id:'w-mem',     layer:4, label:'記憶體模組',        color:'#10b981', x:740, y:280},
  ],

  // ─── 綠色能源 ───
  'green': [
    // Layer 1: 上游原料
    {id:'g-mat',     layer:1, label:'電池關鍵材料',      color:'#10b981', x:80, y:200},
    // Layer 2: 製造
    {id:'g-cell',    layer:2, label:'電芯與模組',        color:'#22c55e', x:300, y:100},
    {id:'g-solar',   layer:2, label:'太陽能產業',        color:'#22c55e', x:300, y:280},
    // Layer 3: 系統整合
    {id:'g-batt',    layer:3, label:'動力電池與儲能',    color:'#84cc16', x:520, y:80 },
    {id:'g-ess',     layer:3, label:'儲能系統整合',      color:'#84cc16', x:520, y:280},
    // Layer 4: 電力基礎建設
    {id:'g-cable',   layer:4, label:'電器電纜',          color:'#f59e0b', x:740, y:120},
    {id:'g-wind',    layer:4, label:'離岸風電',          color:'#f59e0b', x:740, y:320},
  ],

  // ─── 數位與服務 ───
  'digital': [
    // Layer 1: 數位服務
    {id:'d-sw',      layer:1, label:'軟體與客服',        color:'#6366f1', x:80, y:40 },
    {id:'d-saas',    layer:1, label:'企業 SaaS',         color:'#6366f1', x:80, y:150},
    {id:'d-cloud',   layer:1, label:'雲端與 MSP',        color:'#6366f1', x:80, y:260},
    {id:'d-bpo',     layer:1, label:'整合與委外',        color:'#6366f1', x:80, y:370},
    {id:'d-ec',      layer:1, label:'電商電子',          color:'#6366f1', x:80, y:480},
    {id:'d-sec',     layer:1, label:'資安防護',          color:'#6366f1', x:80, y:590},
    // Layer 2: 金融
    {id:'d-bank',    layer:2, label:'銀行金融',          color:'#06b6d4', x:300, y:300},
    // Layer 3: 航運物流
    {id:'d-bulk',    layer:3, label:'散裝航運',          color:'#f59e0b', x:520, y:150},
    {id:'d-cont',    layer:3, label:'貨櫃航運',          color:'#f59e0b', x:520, y:350},
    // Layer 4: 其他產業
    {id:'d-us',      layer:4, label:'美國房市',          color:'#ef4444', x:740, y:150},
    {id:'d-chem',    layer:4, label:'石化與塑膠',        color:'#ef4444', x:740, y:350},
  ],
};

var MOCK_EDGES = {
  'ai-compute': [
    {from:'n-asic',from_layer:1, to:'n-cowos',  type:'supply'},
    {from:'n-asic',from_layer:1, to:'n-pkg',    type:'supply'},
    {from:'n-hpc', from_layer:1, to:'n-cowos',  type:'supply'},
    {from:'n-cxl', from_layer:1, to:'n-hbm',   type:'supply'},
    {from:'n-substrate',from_layer:2, to:'n-server', type:'supply'},
    {from:'n-cowos',from_layer:2, to:'n-server', type:'supply'},
    {from:'n-hbm', from_layer:2, to:'n-server', type:'supply'},
    {from:'n-conn',from_layer:3, to:'n-server', type:'supply'},
    {from:'n-aircool',from_layer:3, to:'n-server', type:'supply'},
    {from:'n-liqcool',from_layer:3, to:'n-server', type:'supply'},
    {from:'n-psu', from_layer:3, to:'n-server', type:'supply'},
    {from:'n-asic',from_layer:1, to:'n-cpo',   type:'tech'},
    {from:'n-glass',from_layer:2, to:'n-cowos', type:'tech'},
    {from:'n-test',from_layer:2, to:'n-hbm',  type:'tech'},
    {from:'n-cpo', from_layer:3, to:'n-optical',type:'tech'},
    {from:'n-server',from_layer:4, to:'n-network', type:'related'},
    {from:'n-server',from_layer:4, to:'n-aiot',   type:'related'},
    {from:'n-optical',from_layer:4, to:'n-sat',   type:'related'},
  ],

  // ─── 消費與終端 ───
  'consumer': [
    {from:'c-disp',  to:'c-panel', type:'supply'},
    {from:'c-disp',  to:'c-pcnb',  type:'supply'},
    {from:'c-disp',  to:'c-phone', type:'supply'},
    {from:'c-analog', to:'c-pcnb', type:'supply'},
    {from:'c-analog', to:'c-auto2',type:'supply'},
    {from:'c-auto',  to:'c-auto2', type:'supply'},
    {from:'c-pkg',   to:'c-dist',  type:'supply'},
    {from:'c-mem',   to:'c-pcnb',  type:'supply'},
    {from:'c-mem',   to:'c-phone', type:'supply'},
    {from:'c-glass', to:'c-pcb',   type:'supply'},
    {from:'c-conn',  to:'c-pcnb',  type:'supply'},
    {from:'c-fpc',   to:'c-phone', type:'supply'},
    {from:'c-sensor',to:'c-phone', type:'supply'},
    {from:'c-lens',  to:'c-phone', type:'supply'},
    {from:'c-lens',  to:'c-xr',    type:'supply'},
    {from:'c-panel', to:'c-pcnb',  type:'supply'},
    {from:'c-panel', to:'c-phone', type:'supply'},
    {from:'c-mech',  to:'c-robot', type:'supply'},
    {from:'c-pcb',   to:'c-pcnb',  type:'supply'},
    {from:'c-disp',  to:'c-xr',    type:'tech'},
    {from:'c-sensor',to:'c-robot', type:'tech'},
    {from:'c-auto',  to:'c-robot', type:'tech'},
    {from:'c-pcnb',  to:'c-phone', type:'related'},
    {from:'c-robot', to:'c-auto2', type:'related'},
  ],

  // ─── 晶圓製造上游 ───
  'wafer': [
    {from:'w-equip', to:'w-foundry',type:'supply'},
    {from:'w-mat',   to:'w-foundry',type:'supply'},
    {from:'w-mat',   to:'w-3rd',    type:'supply'},
    {from:'w-epc',   to:'w-foundry',type:'supply'},
    {from:'w-foundry',to:'w-cowos', type:'supply'},
    {from:'w-foundry',to:'w-pkg',   type:'supply'},
    {from:'w-3rd',   to:'w-cowos',  type:'supply'},
    {from:'w-cowos', to:'w-hbm',    type:'tech'},
    {from:'w-test',  to:'w-hbm',    type:'tech'},
    {from:'w-cowos', to:'w-dist',   type:'supply'},
    {from:'w-pkg',   to:'w-dist',   type:'supply'},
    {from:'w-hbm',   to:'w-mem',    type:'supply'},
    {from:'w-equip', to:'w-3rd',    type:'tech'},
  ],

  // ─── 綠色能源 ───
  'green': [
    {from:'g-mat',   to:'g-cell',  type:'supply'},
    {from:'g-mat',   to:'g-solar', type:'supply'},
    {from:'g-cell',  to:'g-batt',  type:'supply'},
    {from:'g-solar', to:'g-ess',   type:'supply'},
    {from:'g-batt',  to:'g-ess',   type:'supply'},
    {from:'g-ess',   to:'g-cable', type:'supply'},
    {from:'g-ess',   to:'g-wind',  type:'supply'},
    {from:'g-solar', to:'g-wind',  type:'related'},
    {from:'g-cell',  to:'g-ess',   type:'tech'},
  ],

  // ─── 數位與服務 ───
  'digital': [
    {from:'d-saas',  to:'d-bank',  type:'supply'},
    {from:'d-cloud', to:'d-saas',  type:'supply'},
    {from:'d-cloud', to:'d-bpo',   type:'supply'},
    {from:'d-sw',    to:'d-saas',  type:'supply'},
    {from:'d-sec',   to:'d-cloud', type:'supply'},
    {from:'d-ec',    to:'d-bpo',   type:'related'},
    {from:'d-bank',  to:'d-ec',    type:'related'},
    {from:'d-bulk',  to:'d-cont',  type:'related'},
    {from:'d-bpo',   to:'d-bulk',  type:'related'},
    {from:'d-us',    to:'d-chem',  type:'related'},
    {from:'d-cloud', to:'d-sec',   type:'tech'},
  ],
};

// 節點對應的股票代號（預定義）
var NODE_STOCK_CODES = {
  'n-asic':      ['3529','3443','3661','3035'],
  'n-hpc':       ['6533','6643','4966'],
  'n-cxl':       ['4966','6533'],
  'n-pkg':       ['2404','3017'],
  'n-substrate': ['8046','2049'],
  'n-glass':     ['2330'],
  'n-cowos':     ['2330','2354'],
  'n-test':      ['6533','3443'],
  'n-hbm':       ['4966'],
  'n-cpo':       ['2345'],
  'n-conn':      ['3665','3023','3217','6134'],
  'n-aircool':   ['3017','3324','2421','3483'],
  'n-liqcool':   ['3324','3017'],
  'n-bbu':       ['2308','6282'],
  'n-psu':       ['2308','2301','6282'],
  'n-mlcc':      ['2327','2492'],
  'n-inductor':  ['2301','2308'],
  'n-optical':   ['2345','3380'],
  'n-server':    ['2382','3231','6669','2356'],
  'n-chassis':   ['2382','3231'],
  'n-network':   ['2345','3045'],
  'n-aiot':      ['2454'],
  'n-sat':       ['2345','4966'],
  'n-defense':   ['2317','1590'],

  // 消費與終端
  'c-disp':    ['3034','3231','2451','3481'],
  'c-analog':  ['6768','2409','4966'],
  'c-auto':    ['8046','2388','6452'],
  'c-pkg':     ['2303','2325','2449'],
  'c-dist':    ['3356','2348','3014'],
  'c-mem':     ['2337','4256','3706'],
  'c-glass':   ['1303','1301','1802'],
  'c-resist':  ['2327','2492','2443'],
  'c-conn':    ['3665','3023','6134'],
  'c-fpc':     ['8101','6116','3231'],
  'c-sensor':  ['3652','3450','6274'],
  'c-lens':    ['3008','6244','5483'],
  'c-panel':   ['2340','3481','2409'],
  'c-mech':    ['2059','1590','2049'],
  'c-pcb':     ['8046','2383','2382'],
  'c-pcnb':    ['2382','2356','3231'],
  'c-phone':   ['2317','4938','2354'],
  'c-robot':   ['2049','1590','2059'],
  'c-xr':      ['3008','6244','2498'],
  'c-auto2':   ['2049','1590','2059'],

  // 晶圓製造上游
  'w-equip':   ['3057','6597','3085'],
  'w-mat':     ['4977','6269','5483'],
  'w-epc':     ['2404','5299','5014'],
  'w-foundry': ['2330','2303','5347'],
  'w-3rd':     ['6488','6523','3234'],
  'w-cowos':   ['2330','2354','5274'],
  'w-test':    ['2330','6533','3443'],
  'w-hbm':     ['4966','2330'],
  'w-pkg':     ['2303','2325','2449'],
  'w-dist':    ['3356','2348','3014'],
  'w-mem':     ['2337','4256'],

  // 綠色能源
  'g-mat':     ['1810','5009','6285'],
  'g-cell':    ['3691','5483','1337'],
  'g-solar':   ['3576','3561','2448'],
  'g-batt':    ['1326','6585','2308'],
  'g-ess':     ['6238','1590','2308'],
  'g-cable':   ['1312','1303','5009'],
  'g-wind':    ['3038','5299','2208'],

  // 數位與服務
  'd-sw':      ['2388','6214','3088'],
  'd-saas':    ['6214','3484','5347'],
  'd-cloud':   ['2301','3061','3556'],
  'd-bpo':     ['2388','6214','5347'],
  'd-ec':      ['8454','2388','3058'],
  'd-sec':     ['6214','3484','3085'],
  'd-bank':    ['2881','2882','2886','2884'],
  'd-bulk':    ['2603','2615','2609'],
  'd-cont':    ['2603','2609','2615'],
  'd-us':      ['5876','2882','2881'],
  'd-chem':    ['1301','1303','1326'],
};

// ════════════════════════════════════════════
// 節點個股詳細資料（含題材熱度）
// ════════════════════════════════════════════
var NODE_STOCKS_DATA = {
  // 消費與終端
  'c-disp': [
    {code:'3034',name:'聯詠',  sector:'顯示驅動IC', score:78, heat:88, tech:'多頭', chip:'外資買超', inst:'外資買', tags:['顯示驅動','OLED驅動']},
    {code:'2451',name:'創見',  sector:'記憶體模組', score:65, heat:62, tech:'整理', chip:'持平',    inst:'中性',  tags:['記憶體','消費電子']},
    {code:'3481',name:'群創',  sector:'面板',       score:61, heat:58, tech:'整理', chip:'持平',    inst:'中性',  tags:['面板','顯示器']},
  ],
  'c-lens': [
    {code:'3008',name:'大立光',sector:'光學鏡頭',   score:85, heat:82, tech:'強勢', chip:'外資買超', inst:'外資買', tags:['光學鏡頭','手機鏡頭','AR光學']},
    {code:'6244',name:'茂林-KY',sector:'光學元件',  score:71, heat:68, tech:'多頭', chip:'持平',    inst:'投信買', tags:['光學','XR元件']},
    {code:'5483',name:'中美晶',sector:'矽晶圓',     score:69, heat:65, tech:'整理', chip:'持平',    inst:'中性',  tags:['矽晶圓','光學材料']},
  ],
  'c-robot': [
    {code:'2049',name:'上銀',  sector:'精密機械',   score:82, heat:91, tech:'強勢突破', chip:'外資大買', inst:'外資買', tags:['機器人','線性滑軌','AI機器人']},
    {code:'1590',name:'亞德客-KY',sector:'氣動元件',score:79, heat:87, tech:'強勢',    chip:'買超',    inst:'外資買', tags:['氣動','機器人','精密']},
    {code:'2059',name:'川湖',  sector:'精密零件',   score:76, heat:83, tech:'強勢',    chip:'買超',    inst:'外資買', tags:['滑軌','精密機構','伺服器']},
  ],
  // 晶圓製造上游
  'w-foundry': [
    {code:'2330',name:'台積電',sector:'晶圓代工',   score:90, heat:95, tech:'強勢突破', chip:'法人全買', inst:'外資買', tags:['晶圓代工','CoWoS','3nm']},
    {code:'2303',name:'聯電',  sector:'晶圓代工',   score:72, heat:70, tech:'多頭',     chip:'外資買超', inst:'外資買', tags:['晶圓代工','成熟製程']},
    {code:'5347',name:'世界先進',sector:'晶圓代工', score:68, heat:65, tech:'整理',    chip:'持平',    inst:'中性',  tags:['晶圓代工','功率IC']},
  ],
  'w-3rd': [
    {code:'6488',name:'環球晶',sector:'第三代半導體',score:83, heat:86, tech:'強勢',   chip:'外資買超', inst:'外資買', tags:['碳化矽','SiC','第三代半導體']},
    {code:'6523',name:'達爾全',sector:'功率半導體', score:71, heat:74, tech:'多頭',    chip:'持平',    inst:'投信買', tags:['GaN','氮化鎵']},
    {code:'3234',name:'光環新網',sector:'資料中心', score:65, heat:60, tech:'整理',   chip:'持平',    inst:'中性',  tags:['碳化矽材料']},
  ],
  // 綠色能源
  'g-batt': [
    {code:'1326',name:'台化',  sector:'石化',       score:67, heat:72, tech:'整理',    chip:'持平',    inst:'中性',  tags:['電池材料','儲能']},
    {code:'6585',name:'貝斯達',sector:'電池模組',   score:74, heat:79, tech:'多頭',    chip:'買超',    inst:'投信買', tags:['儲能電池','ESS']},
    {code:'2308',name:'台達電',sector:'電源',       score:80, heat:85, tech:'強勢',    chip:'外資買超', inst:'外資買', tags:['UPS','儲能系統','逆變器']},
  ],
  'g-wind': [
    {code:'3038',name:'全台',  sector:'離岸風電',   score:63, heat:78, tech:'整理',    chip:'持平',    inst:'中性',  tags:['離岸風電','水下基礎']},
    {code:'5299',name:'杰力',  sector:'風電元件',   score:61, heat:74, tech:'觀察',    chip:'持平',    inst:'中性',  tags:['風電','電力設備']},
    {code:'2208',name:'台船',  sector:'造船',       score:58, heat:68, tech:'觀察',    chip:'持平',    inst:'中性',  tags:['離岸風電','浮台']},
  ],
  'g-solar': [
    {code:'3576',name:'聯合再生',sector:'太陽能',   score:59, heat:64, tech:'整理',    chip:'持平',    inst:'中性',  tags:['太陽能電池','模組']},
    {code:'3561',name:'昱晶',  sector:'太陽能',     score:56, heat:61, tech:'觀察',    chip:'持平',    inst:'中性',  tags:['太陽能','多晶矽']},
  ],
  // 數位與服務
  'd-bank': [
    {code:'2881',name:'富邦金',sector:'金控',       score:74, heat:68, tech:'多頭',    chip:'外資買超', inst:'外資買', tags:['金控','銀行','保險']},
    {code:'2882',name:'國泰金',sector:'金控',       score:72, heat:65, tech:'多頭',    chip:'持平',    inst:'中性',  tags:['金控','壽險']},
    {code:'2886',name:'兆豐金',sector:'金控',       score:68, heat:62, tech:'整理',    chip:'持平',    inst:'中性',  tags:['金控','銀行','外匯']},
    {code:'2884',name:'玉山金',sector:'金控',       score:69, heat:64, tech:'整理',    chip:'持平',    inst:'中性',  tags:['金控','數位銀行']},
  ],
  'd-cont': [
    {code:'2603',name:'長榮',  sector:'貨櫃航運',   score:77, heat:72, tech:'多頭',    chip:'外資買超', inst:'外資買', tags:['貨櫃航運','全球貿易']},
    {code:'2609',name:'陽明',  sector:'貨櫃航運',   score:71, heat:68, tech:'多頭',    chip:'持平',    inst:'中性',  tags:['貨櫃航運']},
    {code:'2615',name:'萬海',  sector:'貨櫃航運',   score:68, heat:65, tech:'整理',    chip:'持平',    inst:'中性',  tags:['貨櫃航運','亞洲航線']},
  ],
  'd-bulk': [
    {code:'2603',name:'長榮',  sector:'航運',       score:77, heat:72, tech:'多頭',    chip:'外資買超', inst:'外資買', tags:['散裝','鐵礦砂']},
    {code:'2615',name:'萬海',  sector:'散裝航運',   score:68, heat:65, tech:'整理',    chip:'持平',    inst:'中性',  tags:['散裝航運']},
  ],
  'd-cloud': [
    {code:'2301',name:'光寶科',sector:'雲端',       score:76, heat:74, tech:'多頭',    chip:'買超',    inst:'投信買', tags:['雲端服務','機房']},
    {code:'3061',name:'威健',  sector:'IT服務',     score:62, heat:60, tech:'整理',    chip:'持平',    inst:'中性',  tags:['IT服務','MSP']},
  ],
  'd-sec': [
    {code:'6214',name:'精誠',  sector:'資安',       score:70, heat:78, tech:'多頭',    chip:'買超',    inst:'投信買', tags:['資安','SOC','雲端資安']},
    {code:'3484',name:'崧騰',  sector:'資安',       score:65, heat:72, tech:'整理',    chip:'持平',    inst:'中性',  tags:['資安','IoT安全']},
  ],
};

// 題材熱度計算（各主題）
var THEME_HEAT = {
  'ai-compute': 95,
  'consumer':   72,
  'wafer':      85,
  'green':      78,
  'digital':    68,
};

// 節點題材熱度
var NODE_HEAT = {
  // AI算力
  'n-asic':88,'n-hpc':92,'n-cxl':85,'n-cowos':90,'n-server':94,
  'n-aircool':91,'n-liqcool':89,'n-conn':83,'n-psu':79,
  // 消費與終端
  'c-robot':91,'c-sensor':82,'c-lens':78,'c-disp':74,'c-phone':70,
  'c-auto':76,'c-xr':88,'c-auto2':85,'c-mech':83,
  // 晶圓
  'w-foundry':90,'w-3rd':86,'w-cowos':88,'w-hbm':85,'w-equip':79,
  // 綠色
  'g-batt':82,'g-ess':79,'g-wind':75,'g-solar':62,'g-mat':70,
  // 數位
  'd-cont':72,'d-bulk':68,'d-bank':65,'d-sec':78,'d-cloud':74,
};

// ── 主題設定 ──
var THEME_CONFIG = {
  'ai-compute': {
    layers: ['AI 晶片設計','先進封裝製程','AI 伺服器元件','AI 終端應用'],
    colors: ['#6366f1','#8b5cf6','#06b6d4','#10b981'],
  },
  'consumer': {
    layers: ['消費電子 IC','主流終端','關鍵元件','終端裝置'],
    colors: ['#f59e0b','#ef4444','#06b6d4','#10b981'],
  },
  'wafer': {
    layers: ['設備・材料・廠務','晶圓製造','封裝與測試','通路・模組'],
    colors: ['#8b5cf6','#06b6d4','#6366f1','#10b981'],
  },
  'green': {
    layers: ['上游原料','製造','系統整合','電力基礎建設'],
    colors: ['#10b981','#22c55e','#84cc16','#f59e0b'],
  },
  'digital': {
    layers: ['數位服務','金融','航運物流','其他產業'],
    colors: ['#6366f1','#06b6d4','#f59e0b','#ef4444'],
  },
};

// ── 切換主題 ──
function switchTheme(themeId, btn){
  currentTheme = themeId; selectedNode = null;
  document.querySelectorAll('#tab-industry .ft').forEach(function(b){ b.classList.remove('active'); });
  if(btn) btn.classList.add('active');

  // 更新主題熱度顯示
  var heatEl = document.getElementById('theme-heat-display');
  if(heatEl){
    var h = THEME_HEAT[themeId] || 70;
    var hc = h>=85?'var(--green)':h>=70?'var(--accent2)':'var(--gold)';
    heatEl.innerHTML = '題材熱度：<span style="color:'+hc+';font-weight:700;">'+h+'</span>';
  }

  // 重置個股面板
  var titleEl = document.getElementById('node-title');
  var subEl   = document.getElementById('node-subtitle');
  var listEl  = document.getElementById('node-stocks-list');
  if(titleEl) titleEl.textContent = '點選節點';
  if(subEl)   subEl.textContent   = '查看相關個股';
  if(listEl)  listEl.innerHTML    = '<div class="empty" style="padding:30px;">← 點擊節點查看個股</div>';

  drawMap(MOCK_NODES[themeId]||[], MOCK_EDGES[themeId]||[], themeId);
}

var currentTheme  = 'ai-compute';
var selectedNode  = null;
var industryWatchlist = loadLocal('industry_watchlist', []);

// ── 繪製 SVG 地圖（支援所有主題）──
function drawMap(nodes, edges, themeId){
  themeId = themeId || currentTheme;
  var cfg  = THEME_CONFIG[themeId] || THEME_CONFIG['ai-compute'];
  var svg  = document.getElementById('industry-svg');
  var cont = document.getElementById('industry-map-container');
  if(!svg || !cont) return;
  var W = cont.clientWidth || 900, H = cont.clientHeight || 600;
  svg.setAttribute('viewBox','0 0 '+(W-20)+' '+(H-20));
  svg.innerHTML = '';
  if(!nodes.length){ return; }

  var layerW  = (W - 60) / 4;
  var nodePos = {};

  // 按 layer 分組自動排列
  [1,2,3,4].forEach(function(l){
    var ln     = nodes.filter(function(n){ return n.layer===l; });
    var usableH= H - 80;
    var step   = ln.length > 1 ? usableH / ln.length : usableH;
    ln.forEach(function(n, i){
      nodePos[n.id] = {
        x: 30 + (l-1)*layerW + layerW/2,
        y: 40 + step*i + (ln.length===1 ? usableH/2 : step*0.25),
      };
    });
  });

  // 層分隔線 + 層標題
  [1,2,3,4].forEach(function(l, i){
    if(i < 3){
      var sep = document.createElementNS('http://www.w3.org/2000/svg','line');
      var lx  = 30 + l*layerW;
      sep.setAttribute('x1',lx); sep.setAttribute('y1','10');
      sep.setAttribute('x2',lx); sep.setAttribute('y2',H-10);
      sep.setAttribute('stroke','rgba(255,255,255,0.04)');
      sep.setAttribute('stroke-width','1');
      svg.appendChild(sep);
    }
    var t = document.createElementNS('http://www.w3.org/2000/svg','text');
    t.setAttribute('x', 30+(l-1)*layerW+layerW/2);
    t.setAttribute('y', '13');
    t.setAttribute('text-anchor','middle');
    t.setAttribute('fill', cfg.colors[i] || '#6366f1');
    t.setAttribute('font-size','9');
    t.setAttribute('font-family','Share Tech Mono');
    t.setAttribute('letter-spacing','0.5');
    t.textContent = (cfg.layers[i]) || '';
    svg.appendChild(t);
  });

  // 關係線
  var edgeStyle = {
    supply:  {stroke:'#3b82f6', dash:'none', w:'2'},
    tech:    {stroke:'#8b5cf6', dash:'5,3',  w:'1.5'},
    related: {stroke:'#6b7280', dash:'3,3',  w:'1'},
  };
  edges.forEach(function(e){
    var fp = nodePos[e.from], tp = nodePos[e.to];
    if(!fp||!tp) return;
    var st = edgeStyle[e.type] || edgeStyle.related;
    var mx = (fp.x+tp.x)/2;
    var path = document.createElementNS('http://www.w3.org/2000/svg','path');
    path.setAttribute('d','M '+fp.x+' '+fp.y+' C '+mx+' '+fp.y+' '+mx+' '+tp.y+' '+tp.x+' '+tp.y);
    path.setAttribute('stroke', st.stroke);
    path.setAttribute('stroke-width', st.w);
    path.setAttribute('stroke-dasharray', st.dash);
    path.setAttribute('fill','none');
    path.setAttribute('opacity','0.45');
    svg.appendChild(path);
  });

  // 節點
  nodes.forEach(function(n){
    var pos  = nodePos[n.id]; if(!pos) return;
    var heat = NODE_HEAT[n.id] || 60;
    var g    = document.createElementNS('http://www.w3.org/2000/svg','g');
    g.setAttribute('cursor','pointer');
    g.setAttribute('data-id', n.id);
    g.setAttribute('data-theme', themeId);

    var bw=120, bh=34, br=7;
    var rect = document.createElementNS('http://www.w3.org/2000/svg','rect');
    rect.setAttribute('x', pos.x-bw/2); rect.setAttribute('y', pos.y-bh/2);
    rect.setAttribute('width', bw); rect.setAttribute('height', bh);
    rect.setAttribute('rx', br);
    rect.setAttribute('fill', n.color+'18');
    rect.setAttribute('stroke', n.color+'66');
    rect.setAttribute('stroke-width','1.5');
    rect.setAttribute('class','node-rect');
    g.appendChild(rect);

    // 節點文字
    var txt = document.createElementNS('http://www.w3.org/2000/svg','text');
    txt.setAttribute('x', pos.x); txt.setAttribute('y', pos.y+2);
    txt.setAttribute('text-anchor','middle');
    txt.setAttribute('fill','#ddeeff');
    txt.setAttribute('font-size','9.5');
    txt.setAttribute('font-family','Noto Sans TC,sans-serif');
    txt.textContent = n.label;
    g.appendChild(txt);

    // 熱度條（節點底部）
    if(heat > 0){
      var barBg = document.createElementNS('http://www.w3.org/2000/svg','rect');
      barBg.setAttribute('x', pos.x-bw/2+4); barBg.setAttribute('y', pos.y+bh/2-6);
      barBg.setAttribute('width', bw-8); barBg.setAttribute('height', 3);
      barBg.setAttribute('rx', 1.5); barBg.setAttribute('fill','rgba(255,255,255,0.06)');
      g.appendChild(barBg);
      var heatColor = heat>=85?'#00e676':heat>=70?'#00d4ff':'#f5c518';
      var barFg = document.createElementNS('http://www.w3.org/2000/svg','rect');
      barFg.setAttribute('x', pos.x-bw/2+4); barFg.setAttribute('y', pos.y+bh/2-6);
      barFg.setAttribute('width', Math.round((bw-8)*heat/100));
      barFg.setAttribute('height', 3);
      barFg.setAttribute('rx', 1.5); barFg.setAttribute('fill', heatColor);
      barFg.setAttribute('opacity','0.8');
      g.appendChild(barFg);
    }

    g.addEventListener('click', function(){ selectNode(n); });
    g.addEventListener('mouseenter', function(){
      rect.setAttribute('fill', n.color+'35');
      rect.setAttribute('stroke', n.color);
      rect.setAttribute('stroke-width','2');
    });
    g.addEventListener('mouseleave', function(){
      if(selectedNode && selectedNode.id===n.id) return;
      rect.setAttribute('fill', n.color+'18');
      rect.setAttribute('stroke', n.color+'66');
      rect.setAttribute('stroke-width','1.5');
    });
    svg.appendChild(g);
  });
}

// ── 點選節點 ──
function selectNode(node){
  selectedNode = node;
  // 高亮選中節點
  var svg = document.getElementById('industry-svg');
  if(svg) svg.querySelectorAll('[data-id]').forEach(function(g){
    var rect = g.querySelector('.node-rect');
    var nid  = g.getAttribute('data-id');
    var nd   = (MOCK_NODES[currentTheme]||[]).find(function(n){ return n.id===nid; });
    if(!nd||!rect) return;
    if(nd.id===node.id){
      rect.setAttribute('fill', nd.color+'50');
      rect.setAttribute('stroke', nd.color);
      rect.setAttribute('stroke-width','2.5');
    } else {
      rect.setAttribute('fill', nd.color+'18');
      rect.setAttribute('stroke', nd.color+'66');
      rect.setAttribute('stroke-width','1.5');
    }
  });

  // 節點標題 + 熱度
  var heat = NODE_HEAT[node.id] || 60;
  var hc   = heat>=85?'var(--green)':heat>=70?'var(--accent2)':'var(--gold)';
  var titleEl = document.getElementById('node-title');
  var subEl   = document.getElementById('node-subtitle');
  if(titleEl) titleEl.textContent = node.label;
  if(subEl) subEl.innerHTML = '題材熱度 <span style="color:'+hc+';font-family:var(--mono);font-weight:700;">'+heat+'</span> · 載入個股中...';

  document.getElementById('node-stocks-list').innerHTML =
    '<div style="text-align:center;padding:20px;color:var(--accent2);font-family:var(--mono);font-size:10px;">⟳ 載入中...</div>';

  // 優先用詳細資料，fallback 用 stock codes
  var detailed = NODE_STOCKS_DATA[node.id];
  if(detailed){
    if(subEl) subEl.innerHTML = '題材熱度 <span style="color:'+hc+';font-family:var(--mono);font-weight:700;">'+heat+'</span> · 相關個股 '+detailed.length+' 檔';
    renderNodeStocksDetailed(detailed);
  } else {
    fetchNodeStocks(node.id).then(function(){
      if(subEl) subEl.innerHTML = '題材熱度 <span style="color:'+hc+';font-family:var(--mono);font-weight:700;">'+heat+'</span> · 相關個股';
    });
  }
}

// ── 渲染詳細個股資料（有 NODE_STOCKS_DATA）──
function renderNodeStocksDetailed(stocks){
  var el = document.getElementById('node-stocks-list');
  if(!el) return;
  if(!stocks.length){ el.innerHTML = '<div class="empty">無個股資料</div>'; return; }

  el.innerHTML = stocks.map(function(s){
    var sc = s.score>=85?'var(--green)':s.score>=75?'var(--accent)':s.score>=65?'var(--gold)':'var(--text2)';
    var hc = s.heat>=85?'var(--green)':s.heat>=70?'var(--accent2)':'var(--gold)';
    var iw = industryWatchlist.indexOf(s.code) >= 0;
    var tags = (s.tags||[]).map(function(t){
      return '<span style="background:rgba(0,212,255,0.08);border:1px solid rgba(0,212,255,0.2);border-radius:10px;padding:1px 7px;font-size:9px;color:var(--accent);font-family:var(--mono);">'+escHtml(t)+'</span>';
    }).join(' ');

    // 籌碼顏色
    var chipColor = s.chip&&(s.chip.includes('買超')||s.chip.includes('大買'))?'var(--green)':
                   s.chip&&s.chip.includes('賣超')?'var(--red)':'var(--text2)';

    return '<div style="background:var(--bg2);border:1px solid var(--border2);border-radius:9px;padding:12px;margin-bottom:9px;transition:border-color 0.15s;" '+
      'onmouseenter="this.style.borderColor=\'var(--border)\'" onmouseleave="this.style.borderColor=\'var(--border2)\'">' +
      // 標題行
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">' +
        '<div>' +
          '<div style="display:flex;align-items:center;gap:7px;">' +
            '<span style="font-size:14px;font-weight:700;color:var(--text1);">'+escHtml(s.name)+'</span>' +
            '<span style="font-family:var(--mono);font-size:10px;color:var(--text3);background:var(--bg3);padding:1px 6px;border-radius:3px;">'+s.code+'</span>' +
          '</div>' +
          '<div style="font-size:10px;color:var(--text3);margin-top:2px;">'+escHtml(s.sector)+'</div>' +
        '</div>' +
        '<div style="text-align:right;">' +
          '<div style="font-family:var(--mono);font-size:18px;font-weight:700;color:'+sc+';">'+s.score+'</div>' +
          '<div style="font-size:9px;color:var(--text3);">AI分</div>' +
        '</div>' +
      '</div>' +
      // 題材熱度
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">' +
        '<span style="font-size:9px;color:var(--text3);">題材熱度</span>' +
        '<div style="flex:1;height:4px;background:rgba(255,255,255,0.06);border-radius:2px;overflow:hidden;">' +
          '<div style="width:'+s.heat+'%;height:100%;border-radius:2px;background:'+hc+';transition:width 0.5s;"></div>' +
        '</div>' +
        '<span style="font-family:var(--mono);font-size:10px;color:'+hc+';font-weight:700;">'+s.heat+'</span>' +
      '</div>' +
      // 狀態格
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;margin-bottom:8px;">' +
        '<div style="background:var(--bg3);border-radius:5px;padding:4px 7px;">' +
          '<div style="font-size:8px;color:var(--text3);margin-bottom:1px;">技術</div>' +
          '<div style="font-size:10px;font-weight:500;color:'+getTechColor(s.tech)+';">'+escHtml(s.tech||'—')+'</div>' +
        '</div>' +
        '<div style="background:var(--bg3);border-radius:5px;padding:4px 7px;">' +
          '<div style="font-size:8px;color:var(--text3);margin-bottom:1px;">籌碼</div>' +
          '<div style="font-size:10px;font-weight:500;color:'+chipColor+';">'+escHtml(s.chip||'—')+'</div>' +
        '</div>' +
        '<div style="background:var(--bg3);border-radius:5px;padding:4px 7px;">' +
          '<div style="font-size:8px;color:var(--text3);margin-bottom:1px;">法人</div>' +
          '<div style="font-size:10px;font-weight:500;color:var(--accent2);">'+escHtml(s.inst||'—')+'</div>' +
        '</div>' +
      '</div>' +
      // 標籤 + 操作
      '<div style="display:flex;justify-content:space-between;align-items:flex-end;">' +
        '<div style="display:flex;flex-wrap:wrap;gap:3px;">'+tags+'</div>' +
        '<div style="display:flex;gap:4px;flex-shrink:0;">' +
          '<button onclick="openModal(\''+s.code+'\')" style="background:rgba(0,212,255,0.1);border:1px solid rgba(0,212,255,0.25);border-radius:4px;padding:2px 8px;font-size:9px;color:var(--accent);cursor:pointer;">詳情</button>' +
          '<button onclick="toggleIndustryWatch(\''+s.code+'\',\''+escHtml(s.name)+'\',this)" style="background:transparent;border:1px solid '+(iw?'var(--accent2)':'var(--border)')+';border-radius:4px;padding:2px 8px;font-size:10px;color:'+(iw?'var(--accent2)':'var(--text3)')+';cursor:pointer;">'+(iw?'★':'☆')+'</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }).join('');
}

// ── 從 FinMind 取個股資料 ──
async function fetchNodeStocks(nodeId){
  var codes = NODE_STOCK_CODES[nodeId] || [];
  if(!codes.length){
    document.getElementById('node-stocks-list').innerHTML = '<div class="empty">此節點暫無對應個股</div>';
    document.getElementById('node-subtitle').textContent = '相關個股';
    return;
  }

  // 從已掃描的 stocks 取資料（優先用已有的評分資料）
  var allStocks = getDisplayStocks();
  var results   = [];

  codes.forEach(function(code){
    var found = allStocks.find(function(s){ return s.code === code; });
    if(found){
      results.push(found);
    } else {
      // 補上基本資料
      results.push({
        code:     code,
        name:     getStockName(code) || code,
        price:    0,
        ai:       '—',
        sig:      '—',
        sigType:  'wait',
        riskLvl:  '—',
        tech_detail: {},
        chip_detail: {},
        sector: getStockSector(code) || '—',
      });
    }
  });

  document.getElementById('node-subtitle').textContent = '相關個股 ' + results.length + ' 檔';
  renderNodeStocks(results);
}

function renderNodeStocks(stocks){
  var el = document.getElementById('node-stocks-list');
  if(!el) return;
  if(!stocks.length){
    el.innerHTML = '<div class="empty">無個股資料</div>';
    return;
  }

  el.innerHTML = stocks.map(function(s){
    var scoreColor = s.ai>=85?'var(--green)':s.ai>=75?'var(--accent)':s.ai>=65?'var(--gold)':'var(--text2)';
    var isWatched  = industryWatchlist.indexOf(s.code) >= 0;
    var td         = s.tech_detail || {};
    var cd         = s.chip_detail || {};
    var techLabel  = !td.rsi ? '—' : td.rsi>60&&td.ma5>td.ma20 ? '多頭強勢' : td.rsi>50 ? '偏多' : td.rsi<40 ? '偏弱' : '整理';
    var chipLabel  = cd.foreign>0 ? '外資買超' : cd.foreign<0 ? '外資賣超' : cd.trust>0 ? '投信買超' : '中性';
    var sigClass   = {break:'b-break',whale:'b-whale',strong:'b-strong',wait:'b-wait',risk:'b-risk'}[s.sigType]||'b-wait';

    return '<div style="background:var(--bg2);border:1px solid var(--border2);border-radius:9px;padding:12px;margin-bottom:9px;transition:border-color 0.15s;" '+
      'onmouseenter="this.style.borderColor=\'var(--border)\'" onmouseleave="this.style.borderColor=\'var(--border2)\'">' +
      // 頭部
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">' +
        '<div>' +
          '<div style="display:flex;align-items:center;gap:7px;">' +
            '<span style="font-size:14px;font-weight:700;color:var(--text1);">'+escHtml(s.name)+'</span>' +
            '<span style="font-family:var(--mono);font-size:10px;color:var(--text3);background:var(--bg3);padding:1px 6px;border-radius:3px;">'+s.code+'</span>' +
          '</div>' +
          '<div style="font-size:10px;color:var(--text3);margin-top:2px;">'+escHtml(s.sector||'—')+'</div>' +
        '</div>' +
        '<div style="text-align:right;">' +
          '<div style="font-family:var(--mono);font-size:18px;font-weight:700;color:'+scoreColor+';">'+(s.ai||'—')+'</div>' +
          '<div style="font-size:9px;color:var(--text3);">AI分</div>' +
        '</div>' +
      '</div>' +
      // 狀態
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px;margin-bottom:8px;">' +
        '<div style="background:var(--bg3);border-radius:5px;padding:4px 7px;">' +
          '<div style="font-size:8px;color:var(--text3);margin-bottom:1px;">技術</div>' +
          '<div style="font-size:10px;font-weight:500;color:var(--accent2);">'+techLabel+'</div>' +
        '</div>' +
        '<div style="background:var(--bg3);border-radius:5px;padding:4px 7px;">' +
          '<div style="font-size:8px;color:var(--text3);margin-bottom:1px;">籌碼</div>' +
          '<div style="font-size:10px;font-weight:500;color:'+(chipLabel.indexOf('買')>=0?'var(--green)':'var(--text2)')+';">'+chipLabel+'</div>' +
        '</div>' +
        '<div style="background:var(--bg3);border-radius:5px;padding:4px 7px;">' +
          '<div style="font-size:8px;color:var(--text3);margin-bottom:1px;">現價</div>' +
          '<div style="font-family:var(--mono);font-size:11px;font-weight:700;color:var(--text1);">'+(s.price||'—')+'</div>' +
        '</div>' +
      '</div>' +
      // 信號 + 操作
      '<div style="display:flex;justify-content:space-between;align-items:center;">' +
        (s.sig!='—'?'<span class="badge '+sigClass+'">'+s.sig+'</span>':'<span></span>') +
        '<div style="display:flex;gap:5px;">' +
          '<button onclick="openModal(\''+s.code+'\')" style="background:rgba(0,212,255,0.1);border:1px solid rgba(0,212,255,0.25);border-radius:4px;padding:2px 8px;font-size:10px;color:var(--accent);cursor:pointer;">詳情</button>' +
          '<button onclick="toggleIndustryWatch(\''+s.code+'\',\''+escHtml(s.name)+'\',this)" style="background:transparent;border:1px solid '+(isWatched?'var(--accent2)':'var(--border)')+';border-radius:4px;padding:2px 8px;font-size:10px;color:'+(isWatched?'var(--accent2)':'var(--text3)')+';cursor:pointer;">'+(isWatched?'★':'☆')+'</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }).join('');
}

function getTechColor(t){
  return t==='強勢突破'?'var(--green)':t==='強勢'?'var(--accent2)':t==='多頭'?'var(--accent)':t==='整理'?'var(--gold)':'var(--text2)';
}

function toggleIndustryWatch(code, name, btn){
  var idx = industryWatchlist.indexOf(code);
  if(idx>=0){
    industryWatchlist.splice(idx,1);
    btn.textContent='☆'; btn.style.borderColor='var(--border)'; btn.style.color='var(--text3)';
    toast('移除收藏 '+name);
  } else {
    industryWatchlist.push(code);
    btn.textContent='★'; btn.style.borderColor='var(--accent2)'; btn.style.color='var(--accent2)';
    toast('已收藏 '+name+' ('+code+')');
  }
  saveLocal('industry_watchlist', industryWatchlist);
}

function initIndustryMap(){
  setTimeout(function(){
    drawMap(MOCK_NODES['ai-compute'], MOCK_EDGES['ai-compute'], 'ai-compute');
    // 初始化主題熱度顯示
    var heatEl = document.getElementById('theme-heat-display');
    if(heatEl){
      var h = THEME_HEAT['ai-compute'];
      heatEl.innerHTML = '題材熱度：<span style="color:var(--green);font-weight:700;">'+h+'</span>';
    }
  }, 100);
}

// ════════════════════════════════════════════
// 大戶籌碼排行 — FinMind TaiwanStockHoldingSharesPer
// 股權分散表：level 對應持股張數級別
// ════════════════════════════════════════════

var bigHolderCache = {};  // key: "lot_week"
var bigHolderRunning = false;

// 持股分級對照（持股張數→FinMind HoldingSharesLevel）
var LOT_LEVEL_MAP = {
  '200':  ['200~400','400~800','800~1000','1000以上'],
  '400':  ['400~800','800~1000','1000以上'],
  '800':  ['800~1000','1000以上'],
  '1000': ['1000以上'],
};

async function renderBigHolder(){
  var lot  = (document.getElementById('holder-lot') ||{}).value  || '400';
  var week = (document.getElementById('holder-week')||{}).value || '2';
  var key  = lot+'_'+week;

  // 先顯示快取（如果有）
  if(bigHolderCache[key]){
    renderBigHolderTable(bigHolderCache[key]);
    return;
  }

  var tbody = document.getElementById('big-holder-tbody');
  if(!tbody) return;
  tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:20px;font-family:var(--mono);font-size:10px;color:var(--accent2);">⟳ 從 FinMind 載入大戶籌碼...</td></tr>';

  if(bigHolderRunning){ toast('資料載入中，請稍候'); return; }
  bigHolderRunning = true;

  try{
    var today = new Date();
    var past  = new Date(); past.setDate(past.getDate() - parseInt(week)*7 - 3);
    var fmt   = function(d){ return d.toISOString().split('T')[0]; };

    // 取最近兩次股權分散表資料（今日 vs week前）
    var data = await fmFetch({
      dataset:    'TaiwanStockHoldingSharesPer',
      start_date: fmt(past),
      end_date:   fmt(today),
    }, 20000);

    if(!data || data.length===0){
      tbody.innerHTML = '<tr><td colspan="8" class="empty">無資料（FinMind API 可能需要設定 Token）</td></tr>';
      bigHolderRunning = false; return;
    }

    // 找最新日期 和 最早日期
    var dates = [...new Set(data.map(function(d){ return d.date; }))].sort();
    if(dates.length < 2){
      tbody.innerHTML = '<tr><td colspan="8" class="empty">資料不足（需要至少兩個日期）</td></tr>';
      bigHolderRunning = false; return;
    }
    var latestDate  = dates[dates.length-1];
    var earlierDate = dates[Math.max(0, dates.length - parseInt(week)*2 - 1)];

    // 目標持股等級
    var targetLevels = LOT_LEVEL_MAP[lot] || LOT_LEVEL_MAP['400'];

    // 計算每檔股票在目標持股級別的「最新 - 較早」變化
    var byCode = {};
    data.forEach(function(d){
      if(!d.stock_id || !targetLevels.includes(d.HoldingSharesLevel)) return;
      if(!byCode[d.stock_id]) byCode[d.stock_id] = {};
      if(d.date===latestDate){
        if(!byCode[d.stock_id].latest) byCode[d.stock_id].latest = 0;
        byCode[d.stock_id].latest  += parseFloat(d.percent||0);
        byCode[d.stock_id].latestU  = (byCode[d.stock_id].latestU||0) + parseInt(d.unit||0);
      }
      if(d.date===earlierDate){
        if(!byCode[d.stock_id].earlier) byCode[d.stock_id].earlier = 0;
        byCode[d.stock_id].earlier += parseFloat(d.percent||0);
        byCode[d.stock_id].earlierU = (byCode[d.stock_id].earlierU||0) + parseInt(d.unit||0);
      }
    });

    // 計算增減，轉換成排行榜格式
    var results = [];
    Object.keys(byCode).forEach(function(code){
      var rec = byCode[code];
      if(rec.latest===undefined || rec.earlier===undefined) return;
      var addPct   = parseFloat((rec.latest - rec.earlier).toFixed(2));
      var addUnits = ((rec.latestU||0) - (rec.earlierU||0));
      var addLots  = Math.round(addUnits / 1000); // 單位換算
      if(addPct === 0) return;
      results.push({
        code:     code,
        name:     getStockName(code) || code,
        sector:   getStockSector(code) || '—',
        orig:     parseFloat(rec.earlier.toFixed(2)),
        latest:   parseFloat(rec.latest.toFixed(2)),
        addLots:  addLots,
        addPct:   addPct,
        chipScore: Math.min(99, Math.max(1, Math.round(50 + addPct*5))),
        aiJudge:  addPct>=8?'強力買進':addPct>=5?'積極買進':addPct>=2?'持續增持':addPct>0?'逢低買進':addPct>=-2?'小幅減持':'持續賣出',
        judgeType: addPct>=2?'bull':addPct>=-2?'neutral':'bear',
      });
    });

    // 依增加比例排序，取前20
    results.sort(function(a,b){ return b.addPct - a.addPct; });
    results = results.slice(0,20);
    results.forEach(function(r,i){ r.rank = i+1; });

    bigHolderCache[key] = results;
    renderBigHolderTable(results);

  } catch(e){
    console.warn('BigHolder fetch error:', e.message);
    tbody.innerHTML = '<tr><td colspan="8" class="empty">載入失敗：'+escHtml(e.message)+'<br><small style="color:var(--text3);">請確認 FinMind Token 已設定</small></td></tr>';
  }
  bigHolderRunning = false;
}

function renderBigHolderTable(data){
  var tbody = document.getElementById('big-holder-tbody');
  if(!tbody || !data) return;
  if(!data.length){
    tbody.innerHTML = '<tr><td colspan="8" class="empty">無符合條件的資料</td></tr>';
    return;
  }
  var judgeColor = {bull:'var(--green)',bear:'var(--red)',neutral:'var(--text2)'};
  tbody.innerHTML = data.map(function(d){
    var ac = d.addPct>=0?'var(--green)':'var(--red)';
    var sc = d.chipScore>=85?'var(--green)':d.chipScore>=70?'var(--accent)':'var(--gold)';
    return '<tr>' +
      '<td style="font-family:var(--mono);color:var(--text3);">'+(d.rank<=3?['🥇','🥈','🥉'][d.rank-1]:d.rank)+'</td>' +
      '<td><div class="tn">'+escHtml(d.name)+'</div><div class="tk">'+d.code+'</div></td>' +
      '<td style="font-family:var(--mono);font-size:11px;">'+d.orig+'%</td>' +
      '<td style="font-family:var(--mono);font-weight:700;color:'+ac+';">'+d.latest+'%</td>' +
      '<td style="font-family:var(--mono);color:'+ac+';">'+(d.addLots>0?'+':'')+d.addLots.toLocaleString()+'張</td>' +
      '<td style="font-family:var(--mono);font-weight:700;color:'+ac+';">'+(d.addPct>0?'+':'')+d.addPct+'%</td>' +
      '<td style="font-size:10px;color:var(--text3);">'+escHtml(d.sector)+'</td>' +
      '<td><div style="display:flex;align-items:center;gap:4px;"><span style="font-family:var(--mono);font-weight:700;color:'+sc+';font-size:12px;">'+d.chipScore+'</span><div style="width:28px;height:4px;background:var(--border2);border-radius:2px;overflow:hidden;"><div style="width:'+d.chipScore+'%;height:100%;background:'+sc+';border-radius:2px;"></div></div></div></td>' +
      '<td><span style="font-size:10px;color:'+judgeColor[d.judgeType]+';font-weight:500;">'+d.aiJudge+'</span></td>' +
    '</tr>';
  }).join('');
}

// ════════════════════════════════════════════
// 重大資訊觀測站 — FinMind TaiwanStockNews
// ════════════════════════════════════════════

var newsCache     = [];
var newsRunning   = false;
var newsPageFilter = 'all';
var dashNewsFilter = 'all';

async function fetchNews(){
  if(newsRunning){ toast('公告載入中...'); return; }
  newsRunning = true;

  var days  = parseInt((document.getElementById('news-days')||{}).value || '3');
  var past  = new Date(); past.setDate(past.getDate() - days);
  var fmt   = function(d){ return d.toISOString().split('T')[0]; };
  var pastStr = fmt(past);

  var updEl = document.getElementById('news-update-time');
  if(updEl) updEl.textContent = '載入中...';
  var container = document.getElementById('news-container');
  if(container) container.innerHTML = '<div style="text-align:center;padding:30px;font-family:var(--mono);font-size:10px;color:var(--accent2);">⟳ 從 Supabase 讀取 MOPS 公告...</div>';

  var sbUrl = getSBUrl(); var sbKey = getSBKey();

  if(!sbUrl || !sbKey){
    if(container) container.innerHTML = '<div class="empty">請先在後台設定 Supabase URL 和 Key</div>';
    newsRunning = false; return;
  }

  try{
    var r = await fetch(sbUrl + '/rest/v1/stock_news?select=*&date=gte.' + pastStr + '&order=date.desc,time.desc&limit=200', {
      headers:{ 'apikey':sbKey, 'Authorization':'Bearer '+sbKey }
    });

    if(!r.ok) throw new Error('Supabase HTTP ' + r.status);
    var data = await r.json();

    if(!data || data.length === 0){
      if(container) container.innerHTML = '<div class="empty" style="padding:30px;">Supabase 無公告資料<br><small style="color:var(--text3);">請先執行 GitHub Actions → 手動觸發 mops 批次</small></div>';
      newsRunning = false; return;
    }

    // 轉換格式
    newsCache = data.map(function(d, i){
      return {
        id:        i,
        code:      d.stock_id   || '—',
        name:      d.stock_name || getStockName(d.stock_id) || d.stock_id || '—',
        date:      d.date       || '—',
        time:      d.time       || '—',
        title:     d.title      || '—',
        desc:      d.description|| '',
        link:      d.link       || '',
        judge:     d.judge_label|| '中性',
        judgeType: d.judge_type || 'neutral',
        impact:    d.impact     || '低',
        reason:    d.reason     || '',
        cat:       d.category   || '重大事件',
        source:    d.source     || 'MOPS',
      };
    });

    updateNewsStats();
    if(updEl) updEl.textContent = new Date().toLocaleTimeString('zh-TW');
    renderNewsPage();
    renderDashNews();
    toast('已載入 ' + newsCache.length + ' 則 MOPS 公告');

  } catch(e){
    console.warn('fetchNews error:', e.message);
    if(container) container.innerHTML = '<div class="empty">讀取失敗：'+escHtml(e.message)+'</div>';
  }
  newsRunning = false;
}

// AI 關鍵字判斷多空
function aiJudgeNews(title, desc){
  var text = (title + ' ' + desc).toLowerCase();

  // 分類判斷
  var cat = '重大事件';
  if(text.includes('澄清')||text.includes('更正')||text.includes('非事實'))  cat = '澄清回應';
  else if(text.includes('營收')||text.includes('eps')||text.includes('財報')||text.includes('盈餘')) cat = '財務數據';
  else if(text.includes('董事')||text.includes('監察')||text.includes('股東會')||text.includes('法人'))  cat = '公司治理';
  else if(text.includes('法說')||text.includes('investor'))  cat = '法說會';

  // 利多關鍵字
  var bullWords = ['獲利','新高','突破','簽約','合作','訂單','量產','客戶','上調','配息','成長',
                   '優於','超越','創新','研發成功','獲獎','推出','發布','合併','收購'];
  // 利空關鍵字
  var bearWords = ['虧損','下滑','不如預期','下修','警示','處分','違規','召回','下市','罰款',
                   '取消','減少','裁員','縮減','停工','調查','訴訟','未達'];
  // 中性/注意
  var watchWords = ['異動','更換','辭任','轉投資','轉讓','股權','申報','更正'];

  var bullCount = bullWords.filter(function(w){ return text.includes(w); }).length;
  var bearCount = bearWords.filter(function(w){ return text.includes(w); }).length;
  var watchCount= watchWords.filter(function(w){ return text.includes(w); }).length;

  var type, label, impact, reason;
  if(bearCount >= 2){
    type='risk'; label='⚠️ 高風險'; impact='高';
    reason = '標題含多個利空訊號（'+bearWords.filter(function(w){return text.includes(w);}).slice(0,3).join('、')+'），需密切關注。';
  } else if(bearCount >= 1){
    type='bear'; label='偏利空'; impact=bearCount>=2?'高':'中';
    reason = '含利空關鍵字，短期股價可能承壓，建議觀望。';
  } else if(bullCount >= 3){
    type='bull'; label='偏利多'; impact='高';
    reason = '多項利多信號（'+bullWords.filter(function(w){return text.includes(w);}).slice(0,3).join('、')+'），對股價有正面推動。';
  } else if(bullCount >= 1){
    type='bull'; label='偏利多'; impact=bullCount>=2?'中高':'中';
    reason = '含利多訊號，股價有望正面反應。';
  } else if(watchCount >= 1){
    type='watch'; label='需注意'; impact='中';
    reason = '含異動訊號，需觀察後續影響。';
  } else {
    type='neutral'; label='中性'; impact='低';
    reason = '一般性公告，對股價短期影響有限。';
  }

  return { type:type, label:label, impact:impact, reason:reason, cat:cat };
}

function updateNewsStats(){
  var el;
  el=document.getElementById('stat-total'); if(el) el.textContent=newsCache.length;
  el=document.getElementById('stat-bull');  if(el) el.textContent=newsCache.filter(function(n){return n.judgeType==='bull';}).length;
  el=document.getElementById('stat-bear');  if(el) el.textContent=newsCache.filter(function(n){return n.judgeType==='bear'||n.judgeType==='risk';}).length;
  el=document.getElementById('stat-high');  if(el) el.textContent=newsCache.filter(function(n){return n.impact==='高'||n.impact==='中高';}).length;
  el=document.getElementById('news-count'); if(el) el.textContent=newsCache.length;
}

// ── 完整公告頁 ──
function filterNews(f, btn){
  newsPageFilter = f;
  document.querySelectorAll('#tab-news .ftabs .ft').forEach(function(b){ b.classList.remove('active'); });
  if(btn) btn.classList.add('active');
  renderNewsPage();
}

function renderNewsPage(){
  var searchVal = ((document.getElementById('news-search')||{}).value||'').trim().toLowerCase();
  var data = newsCache.filter(function(n){
    var matchSearch = !searchVal || n.name.toLowerCase().includes(searchVal) || n.code.includes(searchVal) || n.title.toLowerCase().includes(searchVal);
    var matchFilter = newsPageFilter==='all' ? true :
      newsPageFilter==='bull'    ? n.judgeType==='bull' :
      newsPageFilter==='bear'    ? (n.judgeType==='bear'||n.judgeType==='risk') :
      newsPageFilter==='neutral' ? n.judgeType==='neutral' :
      newsPageFilter==='high'    ? (n.impact==='高'||n.impact==='中高') : true;
    return matchSearch && matchFilter;
  });

  updateNewsStats();
  var countEl=document.getElementById('news-count'); if(countEl) countEl.textContent=data.length;

  var judgeStyle = {
    bull:    {bg:'rgba(0,230,118,0.08)', brd:'rgba(0,230,118,0.25)', col:'var(--green)'},
    bear:    {bg:'rgba(255,50,89,0.08)',  brd:'rgba(255,50,89,0.25)',  col:'var(--red)'},
    neutral: {bg:'rgba(107,153,204,0.08)',brd:'rgba(107,153,204,0.25)',col:'var(--text2)'},
    watch:   {bg:'rgba(245,197,24,0.08)', brd:'rgba(245,197,24,0.25)', col:'var(--gold)'},
    risk:    {bg:'rgba(255,50,89,0.12)',  brd:'rgba(255,50,89,0.5)',   col:'var(--red)'},
  };
  var impactColor = {'高':'var(--red)','中高':'var(--gold)','中':'var(--text2)','低':'var(--text3)'};
  var catColor    = {'重大事件':'#6366f1','公司治理':'#06b6d4','澄清回應':'#8b5cf6','財務數據':'#10b981','法說會':'#f59e0b'};

  var container = document.getElementById('news-container');
  if(!container) return;

  if(!data.length && newsCache.length===0){
    container.innerHTML = '<div class="empty">請點「載入公告」取得最新重大訊息</div>';
    return;
  }

  container.innerHTML = data.slice(0,50).map(function(n){
    var js = judgeStyle[n.judgeType]||judgeStyle.neutral;
    var cc = catColor[n.cat]||'#6b7280';
    return '<div style="background:var(--bg2);border:1px solid var(--border2);border-radius:10px;padding:14px;margin-bottom:10px;border-left:4px solid '+cc+';transition:border-color 0.15s;" onmouseenter="this.style.borderColor=\'var(--border)\'" onmouseleave="this.style.borderColor=\'var(--border2)\'">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;flex-wrap:wrap;gap:6px;">' +
        '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">' +
          '<span style="font-size:9px;background:'+cc+'22;color:'+cc+';border:1px solid '+cc+'44;border-radius:3px;padding:2px 8px;font-family:var(--mono);">'+n.cat+'</span>' +
          '<span style="font-family:var(--mono);font-size:12px;color:var(--accent);font-weight:700;">'+n.code+'</span>' +
          '<span style="font-size:13px;font-weight:700;color:var(--text1);">'+escHtml(n.name)+'</span>' +
          '<span style="font-family:var(--mono);font-size:10px;color:var(--text3);">'+n.date+' '+n.time+'</span>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:5px;flex-shrink:0;">' +
          '<span style="font-size:9px;font-family:var(--mono);color:'+impactColor[n.impact]+';border:1px solid;border-color:'+impactColor[n.impact]+'55;border-radius:3px;padding:2px 7px;">影響 '+n.impact+'</span>' +
          '<span style="font-size:10px;background:'+js.bg+';color:'+js.col+';border:1px solid '+js.brd+';border-radius:4px;padding:3px 10px;font-weight:700;">'+n.label+'</span>' +
        '</div>' +
      '</div>' +
      '<div style="font-size:12px;color:var(--text1);line-height:1.6;margin-bottom:8px;">'+escHtml(n.title)+'</div>' +
      '<div style="background:rgba(0,255,179,0.04);border:1px solid rgba(0,255,179,0.12);border-radius:6px;padding:8px;font-size:11px;color:var(--text2);line-height:1.7;position:relative;">' +
        '<span style="position:absolute;top:-7px;left:10px;background:var(--bg2);padding:0 6px;font-family:var(--mono);font-size:8px;color:var(--accent2);">AI 分析</span>' +
        escHtml(n.reason) +
      '</div>' +
      (n.link?'<div style="margin-top:8px;"><a href="'+n.link+'" target="_blank" style="font-family:var(--mono);font-size:9px;color:var(--accent);text-decoration:none;">🔗 查看原文</a></div>':'') +
    '</div>';
  }).join('') || '<div class="empty">無符合條件的公告</div>';
}

// ── 儀表板公告（前6則，無需重新 fetch）──
function filterDashNews(f, btn){
  dashNewsFilter = f;
  document.querySelectorAll('[id^="news-dash-tab-"]').forEach(function(b){ b.classList.remove('active'); });
  if(btn) btn.classList.add('active');
  renderDashNews();
}

function renderDashNews(){
  var el = document.getElementById('dash-news-list');
  if(!el) return;

  var data = newsCache.filter(function(n){
    if(dashNewsFilter==='bull')  return n.judgeType==='bull';
    if(dashNewsFilter==='bear')  return n.judgeType==='bear'||n.judgeType==='risk';
    if(dashNewsFilter==='high')  return n.impact==='高'||n.impact==='中高';
    return true;
  }).slice(0,6);

  if(!data.length){
    el.innerHTML = '<div class="empty" style="padding:20px;">點上方「載入公告」取得最新重大訊息</div>';
    return;
  }

  var judgeStyle = {
    bull:    {bg:'rgba(0,230,118,0.08)', brd:'rgba(0,230,118,0.25)', col:'var(--green)'},
    bear:    {bg:'rgba(255,50,89,0.08)',  brd:'rgba(255,50,89,0.25)',  col:'var(--red)'},
    neutral: {bg:'rgba(107,153,204,0.08)',brd:'rgba(107,153,204,0.25)',col:'var(--text2)'},
    watch:   {bg:'rgba(245,197,24,0.08)', brd:'rgba(245,197,24,0.25)', col:'var(--gold)'},
    risk:    {bg:'rgba(255,50,89,0.12)',  brd:'rgba(255,50,89,0.5)',   col:'var(--red)'},
  };
  var catColor = {'重大事件':'#6366f1','公司治理':'#06b6d4','澄清回應':'#8b5cf6','財務數據':'#10b981','法說會':'#f59e0b'};

  el.innerHTML = data.map(function(n){
    var js=judgeStyle[n.judgeType]||judgeStyle.neutral;
    var cc=catColor[n.cat]||'#6b7280';
    return '<div style="background:var(--bg2);border:1px solid var(--border2);border-radius:8px;padding:11px;margin-bottom:8px;border-left:3px solid '+cc+';">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">' +
        '<div style="display:flex;align-items:center;gap:7px;">' +
          '<span style="font-size:9px;background:'+cc+'22;color:'+cc+';border:1px solid '+cc+'44;border-radius:3px;padding:1px 7px;font-family:var(--mono);">'+n.cat+'</span>' +
          '<span style="font-family:var(--mono);font-size:11px;color:var(--accent);">'+n.code+'</span>' +
          '<span style="font-size:12px;font-weight:600;color:var(--text1);">'+escHtml(n.name)+'</span>' +
        '</div>' +
        '<span style="font-size:9px;background:'+js.bg+';color:'+js.col+';border:1px solid '+js.brd+';border-radius:3px;padding:1px 7px;font-weight:600;">'+n.label+'</span>' +
      '</div>' +
      '<div style="font-size:11px;color:var(--text1);line-height:1.5;margin-bottom:3px;">'+escHtml(n.title.substring(0,60))+(n.title.length>60?'...':'')+'</div>' +
      '<div style="font-family:var(--mono);font-size:9px;color:var(--text3);">'+n.date+' '+n.time+'</div>' +
    '</div>';
  }).join('');
}

// ── 四重篩選條件狀態 ──
function updateFilterStatus(){
  ['vix','kd','pbr','yield'].forEach(function(k){
    var el=document.getElementById('st-'+k);
    if(el) el.innerHTML='<span class="badge b-wait">需接真實API</span>';
  });
}

function toggleFourFilter(el){
  el.classList.toggle('on'); el.classList.toggle('off');
  var isOn=el.classList.contains('on');
  var lbl=document.getElementById('four-filter-label');
  if(lbl) lbl.textContent=isOn?'已啟用':'已停用';
  toast('四重篩選'+(isOn?'已啟用':'已停用'));
}

function autoAnalyzeAll(){
  if(!getClaudeKey()){ toast('請在後台設定 Claude API Key 才能使用 AI 批次分析'); return; }
  toast('AI 批次分析中... ('+newsCache.length+' 則公告)');
}

// ── 儀表板初始化 ──
function initDashboard(){
  renderBigHolder();
  renderDashNews();
}
