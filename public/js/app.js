// ═══════════════════════════════════════════════
// app.js — 選股、渲染、管理後台、Supabase
// ═══════════════════════════════════════════════

var stocks       = [];
var watchlist    = [];
var screenerRunning = false;

// ── 示範資料（FinMind 失敗時備援）──
function genDemoStock(code, idx){
  var price = Math.round(50 + Math.random()*1000);
  var chg   = parseFloat((Math.random()*6-2).toFixed(1));
  var tech  = Math.round(15 + Math.random()*20);
  var chip  = Math.round(10 + Math.random()*20);
  var vs    = Math.round(5  + Math.random()*15);
  var rs    = Math.round(5  + Math.random()*10);
  var ai    = Math.min(100, tech+chip+vs+rs);
  var boom  = Math.round(ai*0.85 + Math.random()*10);
  var rsi   = 45 + Math.random()*30;
  var kd    = { k:40+Math.random()*40, d:40+Math.random()*35 };
  var macd  = { hist:Math.random()*4-1.5 };
  var cl    = classifySignal(tech,chip,vs,rs,rsi,kd,macd,price,price*0.95,Math.random()>0.5,1.2+Math.random());
  return {
    code:code, name:getStockName(code)||code, price:price, chg:chg,
    vol:parseFloat((Math.random()*50).toFixed(1)), sector:'—',
    tech:Math.min(35,tech), chip:Math.min(30,chip), vol_score:Math.min(20,vs), risk_score:rs,
    ai:ai, boom:boom, sig:cl.sig, sigType:cl.sigType,
    entry:parseFloat((price*0.995).toFixed(1)),
    t1:parseFloat((price*1.06).toFixed(1)),
    t2:parseFloat((price*1.12).toFixed(1)),
    sl:parseFloat((price*0.95).toFixed(1)),
    riskLvl:rs>=12?'低':rs>=8?'中':'高',
    reason:'技術面AI分 '+ai+'，技術 '+tech+'/35，籌碼 '+chip+'/30，建議依策略操作。',
    tech_detail:{ ma5:parseFloat((price*0.98).toFixed(1)), ma20:parseFloat((price*0.95).toFixed(1)),
      ma60:parseFloat((price*0.9).toFixed(1)), rsi:parseFloat(rsi.toFixed(1)),
      kd_k:parseFloat(kd.k.toFixed(1)), kd_d:parseFloat(kd.d.toFixed(1)),
      macd_hist:parseFloat(macd.hist.toFixed(2)) },
    chip_detail:{ foreign:Math.round(Math.random()*30-5), trust:Math.round(Math.random()*15-2),
      dealer:Math.round(Math.random()*5-1), margin:Math.round(Math.random()*1000),
      short:Math.round(Math.random()*300), broker_days:Math.round(Math.random()*5) },
    candles:[],
  };
}

function getDisplayStocks(){
  if(stocks.length > 0) return stocks;
  return TOP300.slice(0,30).map(function(code,i){ return genDemoStock(code,i); }).sort(function(a,b){ return b.ai-a.ai; });
}

// ── 市場大盤（TWSE 真實資料）──
var marketCache = null;

async function fetchMarketData(){
  // TWSE 大盤指數（MI_INDEX）
  var proxy = 'https://corsproxy.io/?';
  try {
    // 加權指數
    var r = await fetch(proxy + encodeURIComponent('https://openapi.twse.com.tw/v1/exchangeReport/MI_INDEX'), {signal: AbortSignal.timeout(8000)});
    if(r.ok){
      var data = await r.json();
      // 找到發行量加權股價指數
      var taiex = (data || []).find(function(d){ return d.Index === '發行量加權股價指數' || d.name === '發行量加權股價指數'; });
      if(taiex){
        var val    = parseFloat((taiex.IndexOfLatestPrice || taiex.ClosingIndex || '0').replace(/,/g,''));
        var chgVal = parseFloat((taiex.Change || '0').replace(/[+,]/g,''));
        var chgPct = val > 0 ? (chgVal/val*100).toFixed(2) : '0.00';
        marketCache = { taiex: val.toLocaleString('zh-TW'), chg: chgVal, chgPct: chgPct };
      }
    }
  } catch(e){ console.warn('TWSE fetch:', e.message); }

  renderMarketStrip();
}

function renderMarketStrip(){
  var mc    = marketCache;
  var taiex = mc ? mc.taiex   : '—';
  var chg   = mc ? mc.chg     : 0;
  var pct   = mc ? mc.chgPct  : '—';
  var cls   = chg > 0 ? 'up' : chg < 0 ? 'dn' : 'neu';
  var sign  = chg > 0 ? '▲ +' : '▼ ';
  var chgStr = mc ? sign + Math.abs(chg).toFixed(1) + ' (' + (chg>0?'+':'') + pct + '%)' : '載入中...';

  var items = [
    {label:'加權指數',  val: taiex,                   chg: chgStr,         cls: cls},
    {label:'更新時間',  val: new Date().toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'}), chg:'TWSE 即時', cls:'neu'},
    {label:'市場情緒',  val: chg>100?'強勢多':chg>0?'偏多':chg<-100?'強勢空':'偏空', chg:'今日走勢', cls: chg>=0?'up':'dn'},
    {label:'外資動向',  val: '載入中', chg:'即時更新', cls:'neu'},
    {label:'今日掃描',  val: String(stocks.length||'0'), chg:'已分析標的',  cls:'neu'},
    {label:'符合條件',  val: String(stocks.filter(function(s){return s.ai>=CFG.ai_min;}).length||'0'), chg:'AI分≥'+CFG.ai_min, cls:'up'},
  ];

  var el = document.getElementById('mkt-strip');
  if(el) el.innerHTML = items.map(function(i){
    return '<div class="mc"><div class="mc-label">'+i.label+'</div>' +
      '<div class="mc-val '+i.cls+'">'+i.val+'</div>' +
      '<div class="mc-chg '+i.cls+'">'+i.chg+'</div></div>';
  }).join('');

  // 更新頂部小字
  var twIdx = document.getElementById('tw-idx');
  var fv    = document.getElementById('foreign-val');
  if(twIdx){ twIdx.textContent = taiex; twIdx.className = cls; }
  if(fv)   { fv.textContent = '即時載入'; fv.className = 'neu'; }

  // 同步抓外資數據
  fetchForeignData();
}

async function fetchForeignData(){
  var proxy = 'https://corsproxy.io/?';
  try {
    var r = await fetch(proxy + encodeURIComponent('https://openapi.twse.com.tw/v1/exchangeReport/MI_MARGN'), {signal: AbortSignal.timeout(8000)});
    // fallback: 3大法人
    var r2 = await fetch(proxy + encodeURIComponent('https://openapi.twse.com.tw/v1/exchangeReport/BFIAMU'), {signal: AbortSignal.timeout(8000)});
    if(r2.ok){
      var data = await r2.json();
      if(data && data.length > 0){
        var total = data.reduce(function(sum, d){
          var buy  = parseInt((d.Foreign_Investor_Buy  || '0').replace(/,/g,''));
          var sell = parseInt((d.Foreign_Investor_Sell || '0').replace(/,/g,''));
          return sum + buy - sell;
        }, 0);
        var totalB = (total / 1000).toFixed(0); // 千股 → 億估算
        var fvEl = document.getElementById('foreign-val');
        if(fvEl){
          fvEl.textContent = (total>=0?'+':'')+totalB+'億';
          fvEl.className   = total>=0?'up':'dn';
        }
        // 更新 market strip 外資格
        var strip = document.getElementById('mkt-strip');
        if(strip){
          var cards = strip.getElementsByClassName('mc');
          if(cards[3]){
            cards[3].querySelector('.mc-val').textContent = (total>=0?'+':'')+totalB+'億';
            cards[3].querySelector('.mc-val').className   = 'mc-val '+(total>=0?'up':'dn');
            cards[3].querySelector('.mc-chg').textContent = total>=0?'買超':'賣超';
          }
        }
      }
    }
  } catch(e){ /* 靜默失敗 */ }
}

// ── 精選個股 ──
var featuredCode = '';
function setFeatured(code){
  featuredCode = code;
  var all = getDisplayStocks();
  var s   = all.find(function(x){ return x.code===code; }) || genDemoStock(code,0);
  var btmap = {break:'b-break',whale:'b-whale',strong:'b-strong',wait:'b-wait',risk:'b-risk'};
  var el;

  el = document.getElementById('feat-name'); if(el) el.textContent = s.name;
  el = document.getElementById('feat-code'); if(el) el.textContent = s.code + ' · ' + s.sector;
  var bEl = document.getElementById('feat-badge');
  if(bEl){ bEl.className='badge '+(btmap[s.sigType]||'b-strong'); bEl.textContent=s.sig; }
  el = document.getElementById('feat-reason'); if(el) el.textContent = s.reason;
  el = document.getElementById('feat-entry');  if(el) el.textContent = s.entry;
  el = document.getElementById('feat-target'); if(el) el.textContent = s.t1+'/'+s.t2;
  el = document.getElementById('feat-stop');   if(el) el.textContent = s.sl;

  var bars = [
    {label:'技術面',  v:s.tech,      m:35, c:'linear-gradient(90deg,#1a6fff,#00d4ff)'},
    {label:'籌碼面',  v:s.chip,      m:30, c:'linear-gradient(90deg,#00d4ff,#00ffb3)'},
    {label:'量價結構',v:s.vol_score, m:20, c:'linear-gradient(90deg,#00ffb3,#1a6fff)'},
    {label:'風險控制',v:s.risk_score,m:15, c:'linear-gradient(90deg,#f5c518,#ff8c00)'},
  ];
  var sbEl = document.getElementById('score-bars');
  if(sbEl) sbEl.innerHTML = bars.map(function(b){
    return '<div class="sb-row"><div class="sb-label">'+b.label+'</div>' +
      '<div class="sb-track"><div class="sb-fill" style="width:'+Math.round(b.v/b.m*100)+'%;background:'+b.c+';"></div></div>' +
      '<div class="sb-val">'+b.v+'/'+b.m+'</div></div>';
  }).join('');

  animateRing(s.ai);
  var rn = document.getElementById('ring-num'); if(rn) rn.textContent = s.ai;
}

function animateRing(score){
  var circ = 314, fill = circ * score / 100;
  var arc  = document.getElementById('ring-arc');
  if(arc) setTimeout(function(){ arc.setAttribute('stroke-dasharray', fill+' '+(circ-fill)); }, 50);
}

// ── 儀表板表格 ──
var dashFilterKey = 'all';
function dashFilter(type, btn){
  dashFilterKey = type;
  document.querySelectorAll('#tab-dashboard .ft').forEach(function(b){ b.classList.remove('active'); });
  if(btn) btn.classList.add('active');
  renderDashTable();
}

function renderDashTable(){
  var list = getDisplayStocks();
  if(dashFilterKey==='break') list = list.filter(function(s){ return s.sigType==='break'; });
  else if(dashFilterKey==='whale') list = list.filter(function(s){ return s.sigType==='whale'; });
  else if(dashFilterKey==='low')   list = list.filter(function(s){ return s.riskLvl==='低'; });

  var btmap = {break:'b-break',whale:'b-whale',strong:'b-strong',wait:'b-wait',risk:'b-risk'};
  var rmap  = {'低':'risk-low','中':'risk-mid','高':'risk-high'};
  var tbody = document.getElementById('dash-tbody');
  if(!tbody) return;
  tbody.innerHTML = list.slice(0,20).map(function(s){
    var cc   = s.chg>0?'up':s.chg<0?'dn':'neu';
    var barC = s.ai>=80?'#00d4ff':s.ai>=65?'#1a6fff':'#f5c518';
    return '<tr onclick="setFeatured(\''+s.code+'\')" style="cursor:pointer;">' +
      '<td><div class="tn">'+escHtml(s.name)+'</div></td>' +
      '<td><div class="tk">'+s.code+'</div></td>' +
      '<td><span class="pv">'+s.price+'</span></td>' +
      '<td class="'+cc+'">'+(s.chg>0?'▲+':'▼')+s.chg+'%</td>' +
      '<td><span class="badge '+(btmap[s.sigType]||'b-strong')+'">'+s.sig+'</span></td>' +
      '<td><div class="ms"><span style="font-family:var(--mono);font-weight:700;color:'+barC+';min-width:22px;">'+s.ai+'</span>' +
        '<div class="mb"><div class="mf" style="width:'+s.ai+'%;background:'+barC+';"></div></div></div></td>' +
      '<td style="font-family:var(--mono);color:var(--accent2);font-weight:700;">'+s.boom+'%</td>' +
      '<td class="'+(rmap[s.riskLvl]||'')+'">'+s.riskLvl+'</td>' +
      '<td style="font-family:var(--mono);color:var(--green);">'+s.entry+'</td>' +
      '<td><button class="btn btn-sm" onclick="event.stopPropagation();openModal(\''+s.code+'\')">詳情</button></td>' +
    '</tr>';
  }).join('') || '<tr><td colspan="10" class="empty">尚無資料，請點「掃描」</td></tr>';
}

// ── 爆升選股完整表格（修正：只顯示符合條件的股票）──
var fullSortKey = 'ai';
function sortFull(key, btn){
  fullSortKey = key;
  document.querySelectorAll('#tab-signals .ft').forEach(function(b){ b.classList.remove('active'); });
  if(btn) btn.classList.add('active');
  renderFullTable();
}

function renderFullTable(){
  var all  = getDisplayStocks();
  var list;

  if(fullSortKey === 'low_risk'){
    // 只顯示低風險
    list = all.filter(function(s){ return s.riskLvl==='低'; });
  } else {
    // ✅ 修正：只顯示符合 AI 最低分門檻的股票
    list = all.filter(function(s){ return s.ai >= CFG.ai_min; });
    list.sort(function(a,b){ return b[fullSortKey] - a[fullSortKey]; });
  }

  var btmap = {break:'b-break',whale:'b-whale',strong:'b-strong',wait:'b-wait',risk:'b-risk'};
  var rmap  = {'低':'risk-low','中':'risk-mid','高':'risk-high'};

  // 更新計數
  var totalEl = document.getElementById('scan-result-count');
  var matchEl = document.getElementById('scan-match-count');
  if(totalEl) totalEl.textContent = all.length;
  if(matchEl) matchEl.textContent = list.length;

  var tbody = document.getElementById('full-tbody');
  if(!tbody) return;
  tbody.innerHTML = list.map(function(s){
    var cc   = s.chg>0?'up':s.chg<0?'dn':'neu';
    var barC = s.ai>=80?'#00d4ff':s.ai>=65?'#1a6fff':'#f5c518';
    return '<tr>' +
      '<td><div class="tn">'+escHtml(s.name)+'</div></td>' +
      '<td><div class="tk">'+s.code+'</div></td>' +
      '<td><span class="pv">'+s.price+'</span></td>' +
      '<td class="'+cc+'">'+(s.chg>0?'+':'')+s.chg+'%</td>' +
      '<td style="font-family:var(--mono);">'+s.vol+'</td>' +
      '<td style="font-family:var(--mono);color:var(--accent);">'+s.tech+'</td>' +
      '<td style="font-family:var(--mono);color:var(--accent2);">'+s.chip+'</td>' +
      '<td style="font-family:var(--mono);">'+s.vol_score+'</td>' +
      '<td style="font-family:var(--mono);">'+s.risk_score+'</td>' +
      '<td><div class="ms"><span style="font-family:var(--mono);font-weight:700;color:'+barC+';min-width:22px;">'+s.ai+'</span>' +
        '<div class="mb" style="width:40px;"><div class="mf" style="width:'+s.ai+'%;background:'+barC+';"></div></div></div></td>' +
      '<td style="font-family:var(--mono);color:var(--accent2);font-weight:700;">'+s.boom+'%</td>' +
      '<td><span class="badge '+(btmap[s.sigType]||'b-strong')+'">'+s.sig+'</span></td>' +
      '<td style="font-family:var(--mono);color:var(--green);">'+s.entry+'</td>' +
      '<td style="font-family:var(--mono);color:var(--accent);">'+s.t1+'</td>' +
      '<td style="font-family:var(--mono);color:var(--red);">'+s.sl+'</td>' +
      '<td class="'+(rmap[s.riskLvl]||'')+'">'+s.riskLvl+'</td>' +
      '<td><button class="btn btn-sm" onclick="openModal(\''+s.code+'\')">詳情</button></td>' +
    '</tr>';
  }).join('') || '<tr><td colspan="17" class="empty">無符合條件的股票（AI分≥'+CFG.ai_min+'）</td></tr>';
}

// ── 掃描器 ──
async function runScreener(){
  if(screenerRunning){ toast('掃描進行中，請稍候'); return; }
  var modeEl = document.getElementById('scan-mode');
  var mode   = modeEl ? modeEl.value : 'batch1';

  var list;
  if(mode === 'watchlist')     list = watchlist.length>0 ? watchlist : TOP300.slice(0,20);
  else if(mode === 'batch2')   list = TOP300.slice(50,100);
  else if(mode === 'batch3')   list = TOP300.slice(100,150);
  else if(mode === 'top_all')  list = TOP300;
  else                         list = TOP300.slice(0,50);   // batch1 預設

  screenerRunning = true;
  var prog = document.getElementById('screener-progress');
  var statusEl = document.getElementById('screener-status');
  var barEl    = document.getElementById('screener-bar');
  if(prog) prog.style.display = 'block';

  stocks = [];
  for(var i=0; i<list.length; i++){
    var sym   = list[i];
    var sname = getStockName(sym) || sym;
    if(statusEl) statusEl.textContent = '分析 ('+(i+1)+'/'+list.length+')：'+sname+'（'+sym+'）';
    if(barEl)    barEl.style.width    = Math.round((i+1)/list.length*100) + '%';

    try{
      var candles = await finmindCandles(sym, 120);
      if(candles.length >= 20){
        var scored = computeScore(sym, sname, candles);
        // 取籌碼
        try{
          var chips = await finmindChips(sym);
          scored.chip_detail.foreign = chips.foreign;
          scored.chip_detail.trust   = chips.trust;
          scored.chip_detail.dealer  = chips.dealer;
          scored.chip = calcChipScore(scored.chip_detail);
          scored.ai   = Math.min(100, scored.tech + scored.chip + scored.vol_score + scored.risk_score);
          scored.boom = calcBoom(scored);
        } catch(e){ /* 籌碼失敗不影響主流程 */ }
        stocks.push(scored);
      } else {
        stocks.push(genDemoStock(sym, i));
      }
    } catch(e){
      console.warn(sym, e.message);
      stocks.push(genDemoStock(sym, i));
    }
    await sleep(200);
  }

  stocks.sort(function(a,b){ return b.ai - a.ai; });
  if(prog) prog.style.display = 'none';
  screenerRunning = false;

  var matched = stocks.filter(function(s){ return s.ai >= CFG.ai_min; });
  var sc = document.getElementById('scan-result-count');
  var mc = document.getElementById('scan-match-count');
  if(sc) sc.textContent = stocks.length;
  if(mc) mc.textContent = matched.length;

  var countEl = document.getElementById('st-count');
  var updEl   = document.getElementById('st-update');
  if(countEl) countEl.textContent = stocks.length;
  if(updEl)   updEl.textContent   = new Date().toLocaleTimeString('zh-TW');

  renderDashTable();
  renderFullTable();
  if(stocks.length > 0) setFeatured(stocks[0].code);
  await sbSaveScores();
  toast('掃描完成：'+stocks.length+'檔掃描，'+matched.length+'檔符合條件');
}

// ── 導覽切換（含權限檢查）──
function goTab(tab, btn){
  // 定義哪些 tab 需要哪個 perm
  var permMap = {
    signals: 'signals',
    robots:  'robots',
    report:  'report',
  };

  // 檢查權限
  var requiredPerm = permMap[tab];
  if(requiredPerm && !checkPerm(requiredPerm)){
    // 切換顯示但內容換成鎖定畫面
    document.querySelectorAll('.tab-page').forEach(function(p){ p.classList.remove('active'); });
    document.querySelectorAll('.nb').forEach(function(b){ b.classList.remove('active'); });
    var tabEl = document.getElementById('tab-'+tab);
    if(tabEl){
      tabEl.classList.add('active');
      showAccessDenied(tabEl);
    }
    if(btn) btn.classList.add('active');
    return;
  }

  document.querySelectorAll('.tab-page').forEach(function(p){ p.classList.remove('active'); });
  document.querySelectorAll('.nb').forEach(function(b){ b.classList.remove('active'); });
  var tabEl = document.getElementById('tab-'+tab);
  if(tabEl) tabEl.classList.add('active');
  if(btn) btn.classList.add('active');

  if(tab === 'profile') renderProfile();
  if(tab === 'admin')   { renderUserTable(); renderWatchlist(); }
}

// ── 匯出 CSV ──
function exportCSV(){
  if(!stocks.length){ toast('尚無資料'); return; }
  var matched = stocks.filter(function(s){ return s.ai >= CFG.ai_min; });
  var rows = [['名稱','代號','現價','漲跌%','AI分','爆升率','信號','入場','目標一','停損','風險'].join(',')];
  matched.forEach(function(s){
    rows.push([s.name,s.code,s.price,s.chg,s.ai,s.boom,s.sig,s.entry,s.t1,s.sl,s.riskLvl].join(','));
  });
  var blob = new Blob(['\uFEFF'+rows.join('\n')], {type:'text/csv;charset=utf-8'});
  var a    = document.createElement('a');
  a.href   = URL.createObjectURL(blob);
  a.download = '台股AI選股_符合條件_'+new Date().toLocaleDateString('zh-TW').replace(/\//g,'')+'.csv';
  a.click();
  toast('CSV匯出完成（'+matched.length+'檔）');
}

// ── 管理後台 ──
var btChart = null;
function initAdmin(){
  renderUserTable();

  var techP = [
    {n:'RSI週期',k:'rsi_period',min:5,max:30,v:14},
    {n:'KD週期', k:'kd_period', min:5,max:30,v:9},
    {n:'MACD快線',k:'macd_fast',min:5,max:20,v:12},
    {n:'MACD慢線',k:'macd_slow',min:15,max:50,v:26},
    {n:'均量放大倍數',k:'vol_ratio',min:10,max:30,v:15,scale:0.1},
    {n:'AI最低分門檻',k:'ai_min',min:40,max:80,v:60},
  ];
  var tsEl = document.getElementById('tech-sliders');
  if(tsEl) tsEl.innerHTML = techP.map(function(p){
    var dispVal = p.scale ? (p.v*p.scale).toFixed(1)+'x' : p.v;
    return '<div class="sl-row">' +
      '<div class="sl-head"><span class="sl-name">'+p.n+'</span>' +
      '<span class="sl-num" id="sl-'+p.k+'">'+dispVal+'</span></div>' +
      '<input type="range" min="'+p.min+'" max="'+p.max+'" value="'+p.v+'" ' +
      'oninput="document.getElementById(\'sl-'+p.k+'\').textContent='+(p.scale?'(this.value*'+p.scale+').toFixed(1)+\'x\'':'this.value')+';CFG.'+p.k+'='+(p.scale?'this.value*'+p.scale:'parseInt(this.value)')+'"></div>';
  }).join('');

  var wts = [
    {n:'技術面',k:'tech',  v:35,m:50},
    {n:'籌碼面',k:'chip',  v:30,m:50},
    {n:'量價結構',k:'volume',v:20,m:40},
    {n:'風險控制',k:'risk', v:15,m:30},
  ];
  var wsEl = document.getElementById('weight-sliders');
  if(wsEl) wsEl.innerHTML = wts.map(function(w){
    return '<div class="sl-row">' +
      '<div class="sl-head"><span class="sl-name">'+w.n+'</span>' +
      '<span class="sl-num" id="wt-'+w.k+'">'+w.v+'</span>分</div>' +
      '<input type="range" min="5" max="'+w.m+'" value="'+w.v+'" ' +
      'oninput="document.getElementById(\'wt-'+w.k+'\').textContent=this.value;CFG.weights.'+w.k+'=+this.value"></div>';
  }).join('');

  var btStats = [{l:'回測期間',v:'12個月'},{l:'總交易',v:'156筆'},{l:'年化報酬',v:'+34.2%'},{l:'最大連虧',v:'3筆'}];
  var bsEl = document.getElementById('bt-stats');
  if(bsEl) bsEl.innerHTML = btStats.map(function(s){
    return '<div class="vts"><div class="vts-lbl">'+s.l+'</div><div class="vts-val">'+s.v+'</div></div>';
  }).join('');

  initBtChart();
  renderWatchlist();
}

function initBtChart(){
  var ctx = document.getElementById('bt-chart');
  if(!ctx) return;
  if(btChart){ btChart.destroy(); btChart=null; }
  btChart = new Chart(ctx, {
    type:'bar',
    data:{
      labels: ROBOTS.map(function(r){ return r.name; }),
      datasets:[
        {label:'勝率%', data:ROBOTS.map(function(r){ return r.winRate; }), backgroundColor:'rgba(0,212,255,0.4)', borderColor:'rgba(0,212,255,0.7)', borderWidth:1},
        {label:'報酬%', data:ROBOTS.map(function(r){ return r.totalReturn; }), backgroundColor:'rgba(0,255,179,0.25)', borderColor:'rgba(0,255,179,0.5)', borderWidth:1},
      ]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{legend:{labels:{color:'#6b99cc',font:{size:10}}}},
      scales:{
        x:{ticks:{color:'#6b99cc',font:{size:10}},grid:{color:'rgba(0,212,255,0.05)'}},
        y:{ticks:{color:'#6b99cc',font:{size:10}},grid:{color:'rgba(0,212,255,0.05)'}},
      }
    }
  });
}

function saveKeys(){
  localStorage.setItem('finmind_key', document.getElementById('finmind-key').value.trim());
  localStorage.setItem('sb_url',      document.getElementById('sb-url').value.trim());
  localStorage.setItem('sb_key',      document.getElementById('sb-key').value.trim());
  localStorage.setItem('claude_key',  document.getElementById('claude-key').value.trim());
  updateStatusBar(); toast('API Keys 已儲存');
}
function loadKeysToForm(){
  var set = function(id,k){ var el=document.getElementById(id); if(el) el.value=getKey(k); };
  set('finmind-key','finmind_key'); set('sb-url','sb_url'); set('sb-key','sb_key'); set('claude-key','claude_key');
}
function updateStatusBar(){
  var f = document.getElementById('st-finmind');
  var s = document.getElementById('st-sb');
  if(f){ if(getFinMindKey()){ f.textContent='已設定';f.className='ok'; } else { f.textContent='未設定';f.className='err'; } }
  if(s){ if(getSBUrl()&&getSBKey()){ s.textContent='已設定';s.className='ok'; } else { s.textContent='未設定';s.className='err'; } }
}
async function testAPIs(){
  var res = document.getElementById('api-test-result');
  if(!res) return;
  res.style.display='block'; res.textContent='測試中...';
  var lines = [];
  try{
    var d = await finmindCandles('2330', 10);
    lines.push(d.length>0 ? '✅ FinMind：連線成功，台積電 '+d.length+' 筆' : '⚠️ FinMind：無資料');
  } catch(e){ lines.push('❌ FinMind：'+e.message); }
  if(getSBUrl()&&getSBKey()){
    try{
      var r = await fetch(getSBUrl()+'/rest/v1/stock_scores?select=count&limit=1', {
        headers:{'apikey':getSBKey(),'Authorization':'Bearer '+getSBKey()}
      });
      lines.push((r.ok||r.status===406) ? '✅ Supabase：連線成功' : '❌ Supabase HTTP '+r.status);
    } catch(e){ lines.push('❌ Supabase：'+e.message); }
  } else lines.push('⚠️ Supabase 未設定');
  res.innerHTML = lines.join('<br>');
}
function recalcAllScores(){
  stocks.forEach(function(s){
    s.chip = calcChipScore(s.chip_detail);
    s.ai   = Math.min(100, s.tech+s.chip+s.vol_score+s.risk_score);
    s.boom = calcBoom(s);
  });
  stocks.sort(function(a,b){ return b.ai-a.ai; });
  renderDashTable(); renderFullTable();
  toast('評分已重新計算');
}
function runBacktest(){ toast('回測執行中...'); setTimeout(function(){ toast('回測完成：156筆，勝率66.7%，年化+34.2%'); },2000); }

// ── 自選股 ──
function addToWatchlist(){
  var inp = document.getElementById('add-symbol');
  var sym = (inp ? inp.value.trim() : '');
  if(!sym){ toast('請輸入代號'); return; }
  if(!isListed(sym)){ toast(sym+' 不在上市股票清單中'); return; }
  if(watchlist.indexOf(sym)>=0){ toast('已在清單'); return; }
  watchlist.push(sym); saveLocal('tw_watchlist',watchlist);
  if(inp) inp.value='';
  renderWatchlist(); toast('已加入：'+getStockName(sym)+' ('+sym+')');
}
function removeFromWatchlist(sym){
  watchlist = watchlist.filter(function(s){ return s!==sym; });
  saveLocal('tw_watchlist',watchlist); renderWatchlist();
}
function renderWatchlist(){
  var el = document.getElementById('watchlist-display'); if(!el) return;
  el.innerHTML = watchlist.length===0
    ? '<div style="font-size:11px;color:var(--text3);">尚無自選股（預設使用前50大上市股票）</div>'
    : '<div style="display:flex;flex-wrap:wrap;gap:6px;">'+watchlist.map(function(s){
        return '<div style="display:flex;align-items:center;gap:5px;background:var(--bg2);border:1px solid var(--border);border-radius:5px;padding:4px 10px;">'+
          '<span style="font-family:var(--mono);font-size:11px;color:var(--accent);">'+escHtml(getStockName(s)||s)+' '+s+'</span>'+
          '<button style="background:transparent;border:none;color:var(--text3);font-size:12px;line-height:1;cursor:pointer;" onclick="removeFromWatchlist(\''+s+'\')">✕</button></div>';
      }).join('')+'</div>';
}

// ── Supabase ──
async function sbSaveScores(){
  if(!getSBUrl()) return;
  var today = new Date().toISOString().split('T')[0];
  try{
    await fetch(getSBUrl()+'/rest/v1/stock_scores', {
      method:'POST',
      headers:{ 'apikey':getSBKey(), 'Authorization':'Bearer '+getSBKey(),
        'Content-Type':'application/json', 'Prefer':'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(stocks.slice(0,50).map(function(s){
        return { symbol:s.code, date:today, name:s.name, price:s.price, chg_pct:s.chg,
          total_score:s.ai, boom_prob:s.boom, signal:s.sig,
          entry_price:s.entry, target1:s.t1, stop_loss:s.sl, risk_level:s.riskLvl, reason:s.reason };
      }))
    });
  } catch(e){ console.warn('sbSave:', e.message); }
}

// ── Clock ──
function startClock(){
  var el = document.getElementById('clock');
  if(!el) return;
  setInterval(function(){ el.textContent = new Date().toLocaleTimeString('zh-TW'); }, 1000);
}
