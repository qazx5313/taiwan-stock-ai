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
  ]
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
  ]
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
};

var LAYER_LABELS = ['AI 晶片設計','先進封裝製程','AI 伺服器元件','AI 終端應用'];
var LAYER_COLORS = ['#6366f1','#8b5cf6','#06b6d4','#10b981'];
var currentTheme = 'ai-compute';
var selectedNode = null;
var industryWatchlist = loadLocal('industry_watchlist', []);

// ── 切換主題 ──
function switchTheme(themeId, btn){
  currentTheme = themeId; selectedNode = null;
  document.querySelectorAll('#tab-industry .ft').forEach(function(b){ b.classList.remove('active'); });
  if(btn) btn.classList.add('active');
  if(themeId !== 'ai-compute'){
    document.getElementById('node-title').textContent    = '開發中';
    document.getElementById('node-subtitle').textContent = '此主題即將推出';
    document.getElementById('node-stocks-list').innerHTML = '<div class="empty" style="padding:40px;">此主題資料建置中...</div>';
    drawMap([],[]);
    return;
  }
  drawMap(MOCK_NODES[themeId]||[], MOCK_EDGES[themeId]||[]);
}

// ── 繪製 SVG 地圖 ──
function drawMap(nodes, edges){
  var svg  = document.getElementById('industry-svg');
  var cont = document.getElementById('industry-map-container');
  if(!svg || !cont) return;
  var W = cont.clientWidth || 900, H = cont.clientHeight || 580;
  svg.setAttribute('viewBox','0 0 '+(W-20)+' '+(H-20));
  svg.innerHTML = '';
  if(!nodes.length){ return; }

  var layerW  = (W - 60) / 4;
  var nodePos = {};
  [1,2,3,4].forEach(function(l){
    var ln = nodes.filter(function(n){ return n.layer===l; });
    var totalH = H - 80;
    var step   = ln.length > 1 ? totalH / ln.length : totalH;
    ln.forEach(function(n,i){
      nodePos[n.id] = {
        x: 30 + (l-1)*layerW + layerW/2,
        y: 40 + step*i + (ln.length===1 ? totalH/2 : step*0.3),
      };
    });
  });

  // 層分隔線 + 層標題
  [1,2,3,4].forEach(function(l,i){
    if(i<3){
      var sep = document.createElementNS('http://www.w3.org/2000/svg','line');
      var lx  = 30 + l*layerW;
      sep.setAttribute('x1',lx); sep.setAttribute('y1','10');
      sep.setAttribute('x2',lx); sep.setAttribute('y2',H-10);
      sep.setAttribute('stroke','rgba(255,255,255,0.04)'); sep.setAttribute('stroke-width','1');
      svg.appendChild(sep);
    }
    var t = document.createElementNS('http://www.w3.org/2000/svg','text');
    t.setAttribute('x', 30+(l-1)*layerW+layerW/2); t.setAttribute('y','13');
    t.setAttribute('text-anchor','middle'); t.setAttribute('fill',LAYER_COLORS[i]);
    t.setAttribute('font-size','8.5'); t.setAttribute('font-family','Share Tech Mono');
    t.setAttribute('letter-spacing','0.5');
    t.textContent = LAYER_LABELS[i] || '';
    svg.appendChild(t);
  });

  // 連接線
  var edgeStyle = {
    supply:  {stroke:'#3b82f6', dash:'none',  w:'2'},
    tech:    {stroke:'#8b5cf6', dash:'5,3',   w:'1.5'},
    related: {stroke:'#6b7280', dash:'3,3',   w:'1'},
  };
  edges.forEach(function(e){
    var fp = nodePos[e.from], tp = nodePos[e.to];
    if(!fp||!tp) return;
    var st = edgeStyle[e.type]||edgeStyle.related;
    var mx = (fp.x+tp.x)/2;
    var path = document.createElementNS('http://www.w3.org/2000/svg','path');
    path.setAttribute('d','M '+fp.x+' '+fp.y+' C '+mx+' '+fp.y+' '+mx+' '+tp.y+' '+tp.x+' '+tp.y);
    path.setAttribute('stroke',st.stroke); path.setAttribute('stroke-width',st.w);
    path.setAttribute('stroke-dasharray',st.dash); path.setAttribute('fill','none');
    path.setAttribute('opacity','0.45');
    svg.appendChild(path);
  });

  // 節點
  nodes.forEach(function(n){
    var pos = nodePos[n.id]; if(!pos) return;
    var g = document.createElementNS('http://www.w3.org/2000/svg','g');
    g.setAttribute('cursor','pointer'); g.setAttribute('data-id',n.id);
    var bw=118,bh=34,br=7;
    var rect = document.createElementNS('http://www.w3.org/2000/svg','rect');
    rect.setAttribute('x',pos.x-bw/2); rect.setAttribute('y',pos.y-bh/2);
    rect.setAttribute('width',bw); rect.setAttribute('height',bh); rect.setAttribute('rx',br);
    rect.setAttribute('fill',n.color+'18'); rect.setAttribute('stroke',n.color+'66');
    rect.setAttribute('stroke-width','1.5'); rect.setAttribute('class','node-rect');
    g.appendChild(rect);
    var txt = document.createElementNS('http://www.w3.org/2000/svg','text');
    txt.setAttribute('x',pos.x); txt.setAttribute('y',pos.y+4);
    txt.setAttribute('text-anchor','middle'); txt.setAttribute('fill','#ddeeff');
    txt.setAttribute('font-size','10'); txt.setAttribute('font-family','Noto Sans TC,sans-serif');
    txt.textContent = n.label;
    g.appendChild(txt);
    g.addEventListener('click',   function(){ selectNode(n); });
    g.addEventListener('mouseenter',function(){ rect.setAttribute('fill',n.color+'35'); rect.setAttribute('stroke',n.color); });
    g.addEventListener('mouseleave',function(){
      if(selectedNode&&selectedNode.id===n.id) return;
      rect.setAttribute('fill',n.color+'18'); rect.setAttribute('stroke',n.color+'66');
    });
    svg.appendChild(g);
  });
}

// ── 點選節點 ──
function selectNode(node){
  selectedNode = node;
  var svg = document.getElementById('industry-svg');
  if(svg) svg.querySelectorAll('[data-id]').forEach(function(g){
    var rect = g.querySelector('.node-rect');
    var nd   = (MOCK_NODES[currentTheme]||[]).find(function(n){ return n.id===g.getAttribute('data-id'); });
    if(!nd||!rect) return;
    if(nd.id===node.id){
      rect.setAttribute('fill',nd.color+'50'); rect.setAttribute('stroke',nd.color); rect.setAttribute('stroke-width','2.5');
    } else {
      rect.setAttribute('fill',nd.color+'18'); rect.setAttribute('stroke',nd.color+'66'); rect.setAttribute('stroke-width','1.5');
    }
  });
  document.getElementById('node-title').textContent    = node.label;
  document.getElementById('node-subtitle').textContent = '載入相關個股中...';
  document.getElementById('node-stocks-list').innerHTML = '<div style="text-align:center;padding:30px;color:var(--accent2);font-family:var(--mono);">⟳ 從 FinMind 載入...</div>';
  fetchNodeStocks(node.id);
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
    drawMap(MOCK_NODES['ai-compute'], MOCK_EDGES['ai-compute']);
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
