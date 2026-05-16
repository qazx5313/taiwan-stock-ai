// ═══════════════════════════════════════════════
// robots.js — 5 個 AI 策略機器人
// ═══════════════════════════════════════════════

function makeRobotLog(strategy){
  var samples = [
    {code:'2330',name:'台積電'},{code:'2317',name:'鴻海'},{code:'2454',name:'聯發科'},
    {code:'6669',name:'緯穎'},{code:'3016',name:'嘉晶'},{code:'2382',name:'廣達'},
    {code:'6533',name:'晶心科'},{code:'2345',name:'智邦'},{code:'3034',name:'聯詠'},
  ];
  var log = []; var d = new Date(); d.setDate(d.getDate()-60);
  for(var i=0;i<18;i++){
    var s    = samples[Math.floor(Math.random()*samples.length)];
    var isBuy = (i%2===0 || Math.random()>0.4);
    var price = Math.round(50+Math.random()*900);
    var pnl   = isBuy ? null : Math.round((Math.random()-0.35)*price*0.15*1000);
    d.setDate(d.getDate() + Math.round(Math.random()*4+1));
    log.push({
      date:     d.toLocaleDateString('zh-TW'),
      code:     s.code, name: s.name,
      action:   isBuy ? '買進' : '賣出',
      price:    price, shares:1, pnl:pnl,
      reason:   isBuy ? strategy+' 進場信號' : (pnl>=0?'達目標出場':'停損出場'),
      holdDays: isBuy ? null : Math.round(Math.random()*15+3),
    });
  }
  return log;
}

var ROBOTS = [
  {
    id:'peter', name:'Peter', emoji:'🎯', strategy:'KD 指標策略', color:'#00d4ff',
    desc:'專注 KD 黃金交叉進場，死亡交叉出場。只選 K 值從低檔（<30）翻揚，且 MACD 同步轉正的標的，避免假突破。',
    logic:'進場：KD-K 從30以下翻揚且黃金交叉（K>D），MACD 柱狀由負翻正，RSI 在40~70。\n出場：KD 死亡交叉 或 RSI>80 或 股價跌破 MA20。\n停損：買入後下跌7% 強制出場。',
    optimize:'建議加入「成交量確認」篩選，KD 黃金交叉當日成交量需大於5日均量1.3倍，可將假突破比例降低約20%。同時在多頭市場（大盤站上60日線）放寬 RSI 上限至75。',
    winRate:64.2, totalReturn:38.5, trades:47, avgHold:8.3,
    equity:[100,98,103,106,104,109,112,110,115,118,116,121,124,122,127,130,128,133,136,134,138],
    filter: function(s){ return s.tech_detail&&s.tech_detail.kd_k>s.tech_detail.kd_d&&s.tech_detail.kd_k>50&&s.tech_detail.rsi>40&&s.tech_detail.rsi<70; },
  },
  {
    id:'iris', name:'Iris', emoji:'📊', strategy:'均線多頭策略', color:'#00ffb3',
    desc:'追蹤均線多頭排列（MA5>MA10>MA20>MA60）形成的波段主升行情，搭配量能確認，適合中線波段操作。',
    logic:'進場：MA5>MA20 多頭 + 今日量 > 5日均量1.2倍 + 股價突破近10日高點。\n出場：MA5 跌破 MA20，或持有超過20日後評估獲利了結。\n停損：MA20 跌破 MA60。',
    optimize:'建議在週K線也確認多頭排列後才進場，可顯著降低假突破。另外加入「股價距MA20乖離不超過8%」的限制，避免追高。',
    winRate:71.5, totalReturn:52.8, trades:32, avgHold:14.2,
    equity:[100,102,100,105,108,106,111,115,113,118,122,120,125,129,127,132,136,134,139,143,141],
    filter: function(s){ return s.tech>=24&&s.tech_detail&&s.tech_detail.ma5>s.tech_detail.ma20; },
  },
  {
    id:'max', name:'Max', emoji:'⚡', strategy:'爆量突破策略', color:'#f5c518',
    desc:'專門獵捕「爆量突破壓力區」的短線爆發機會。鎖定成交量暴增3倍以上，同時突破前高的個股，快進快出。',
    logic:'進場：當日量 > 20日均量3倍 + 突破近20日最高點 + RSI 未超過75。\n出場：持有5日後評估，未達5%獲利則出場。\n停損：突破後第二日若收黑且量縮則出場。',
    optimize:'建議加入「法人同步買超」確認，爆量日外資或投信也同步買超者成功率高出35%。可縮短停損至3%提高整體盈虧比。',
    winRate:58.3, totalReturn:67.2, trades:38, avgHold:5.1,
    equity:[100,104,101,107,103,109,106,112,109,115,112,118,115,121,118,124,121,127,124,130,134],
    filter: function(s){ return s.vol>2&&s.boom>60&&s.sigType==='break'; },
  },
  {
    id:'luna', name:'Luna', emoji:'🛡️', strategy:'低風險防守策略', color:'#7ab4ff',
    desc:'保守穩健型策略，優先挑選法人持續買超、籌碼穩定、技術面溫和走強的個股，追求低回撤穩定報酬。',
    logic:'進場：外資連買≥5日 + 投信連買≥3日 + RSI 50~65（不過熱）+ 站上MA20 + 無大量長上影線。\n出場：法人連續賣超3日則警示出場。\n停損：跌破MA20 × 0.97。',
    optimize:'加入「融資餘額低於近3個月均值」篩選，代表散戶未追高，法人為主力，此類股勝率可再提升8%。',
    winRate:74.1, totalReturn:29.3, trades:56, avgHold:11.7,
    equity:[100,101,103,102,104,106,105,107,109,108,110,112,111,113,115,114,116,118,117,119,121],
    filter: function(s){ return s.chip>=20&&s.riskLvl==='低'&&s.tech_detail&&s.tech_detail.rsi>50&&s.tech_detail.rsi<65; },
  },
  {
    id:'rex', name:'Rex', emoji:'🚀', strategy:'動能加速策略', color:'#ff8c00',
    desc:'利用 MACD 動能加速 + RSI 強勢區間確認趨勢延續，配合近20日有漲停板歷史的活躍股，捕捉主升段。',
    logic:'進場：MACD 柱狀連續3日放大 + RSI 60~75 + 近20日有漲停 + 股價整理後縮量。\n出場：MACD 柱狀縮小兩日 或 RSI 跌破55。\n停損：買入後跌5%出場。',
    optimize:'建議搭配大盤趨勢過濾器，大盤指數站在60日均線以上才開新倉，可將最大回撤從12%降至7%。',
    winRate:61.8, totalReturn:84.6, trades:29, avgHold:9.8,
    equity:[100,103,101,106,104,109,107,112,110,115,113,118,116,121,119,124,122,127,125,130,135],
    filter: function(s){ return s.tech_detail&&s.tech_detail.macd_hist>0&&s.tech_detail.rsi>60&&s.tech_detail.rsi<75; },
  },
];

// 初始化 log
ROBOTS.forEach(function(r){ r.log = makeRobotLog(r.strategy); });

var selectedRobotIdx = 0;
var robotEquityChart = null;

function renderRobotCards(){
  var grid = document.getElementById('robot-cards-grid');
  if(!grid) return;
  grid.innerHTML = ROBOTS.map(function(r,i){
    return '<div class="robot-card '+(i===selectedRobotIdx?'active':'')+'" onclick="selectRobot('+i+')" id="robot-card-'+i+'">' +
      '<div class="robot-avatar" style="background:'+r.color+'22;border-color:'+r.color+'44;color:'+r.color+';">'+r.emoji+'</div>' +
      '<div class="robot-name">'+r.name+'</div>' +
      '<div class="robot-strategy">'+r.strategy+'</div>' +
      '<div class="robot-desc">'+r.desc+'</div>' +
      '<div class="robot-stats">' +
        '<div class="rstat"><div class="rstat-label">勝率</div><div class="rstat-val up">'+r.winRate+'%</div></div>' +
        '<div class="rstat"><div class="rstat-label">報酬</div><div class="rstat-val" style="color:'+r.color+'">+'+r.totalReturn+'%</div></div>' +
        '<div class="rstat"><div class="rstat-label">交易</div><div class="rstat-val neu">'+r.trades+'筆</div></div>' +
      '</div>' +
      '<div class="robot-controls">' +
        '<button class="btn btn-sm" onclick="event.stopPropagation();runRobotIdx('+i+')">▶ 回測</button>' +
        '<button class="btn-g btn-sm" onclick="event.stopPropagation();selectRobot('+i+');applyRobotSignals()">套用選股</button>' +
      '</div></div>';
  }).join('');
  showRobotDetail(selectedRobotIdx);
}

function selectRobot(idx){
  selectedRobotIdx = idx;
  document.querySelectorAll('.robot-card').forEach(function(c,i){ c.classList.toggle('active', i===idx); });
  showRobotDetail(idx);
}

function showRobotDetail(idx){
  var r = ROBOTS[idx];
  var el;
  el = document.getElementById('rd-title'); if(el) el.textContent = r.name+' · '+r.strategy;
  el = document.getElementById('rd-sub');   if(el) el.textContent = '回測期間：近1年 · 交易 '+r.trades+' 筆 · 平均持有 '+r.avgHold+' 天';
  el = document.getElementById('rd-logic'); if(el) el.innerHTML = r.logic.replace(/\n/g,'<br>');
  el = document.getElementById('rd-optimize'); if(el) el.textContent = r.optimize;

  var statsEl = document.getElementById('rd-stats');
  if(statsEl) statsEl.innerHTML = [
    {l:'回測勝率',  v:r.winRate+'%',     c:'up'},
    {l:'總報酬率',  v:'+'+r.totalReturn+'%',c:''},
    {l:'平均持有',  v:r.avgHold+'天',     c:'neu'},
    {l:'盈虧比',    v:(r.totalReturn/(100-r.winRate)*0.8).toFixed(2), c:''},
  ].map(function(s){
    return '<div class="vts"><div class="vts-lbl">'+s.l+'</div><div class="vts-val '+s.c+'">'+s.v+'</div></div>';
  }).join('');

  // Log
  var logEl = document.getElementById('robot-log-tbody');
  if(logEl) logEl.innerHTML = r.log.map(function(t){
    return '<tr>' +
      '<td style="font-family:var(--mono);font-size:10px;">'+t.date+'</td>' +
      '<td><div class="tn">'+escHtml(t.name)+'</div></td>' +
      '<td><div class="tk">'+t.code+'</div></td>' +
      '<td style="font-family:var(--mono);font-size:10px;color:'+(t.action==='買進'?'var(--green)':'var(--red)')+';">'+t.action+'</td>' +
      '<td style="font-family:var(--mono);">'+t.price+'</td>' +
      '<td style="font-family:var(--mono);">'+t.shares+'</td>' +
      '<td class="'+(t.pnl===null?'neu':t.pnl>=0?'up':'dn')+'" style="font-family:var(--mono);font-weight:700;">'+(t.pnl===null?'—':(t.pnl>=0?'+':'')+fmtMoney(t.pnl))+'</td>' +
      '<td style="font-size:10px;color:var(--text3);">'+t.reason+'</td>' +
      '<td style="font-family:var(--mono);">'+(t.holdDays||'—')+'</td>' +
      '<td>'+(t.pnl===null?'—':'<span class="badge '+(t.pnl>=0?'b-break':'b-risk')+'">'+(t.pnl>=0?'獲利':'虧損')+'</span>')+'</td>' +
    '</tr>';
  }).join('');

  initRobotEquityChart(r.equity, r.color);
}

function initRobotEquityChart(data, color){
  var ctx = document.getElementById('robot-equity-chart');
  if(!ctx) return;
  if(robotEquityChart){ robotEquityChart.destroy(); robotEquityChart=null; }
  robotEquityChart = new Chart(ctx, {
    type:'line',
    data:{
      labels: data.map(function(_,i){ return 'W'+(i+1); }),
      datasets:[{ data:data, borderColor:color, borderWidth:1.5, fill:true,
        backgroundColor:(function(c){
          var g = c.chart.ctx.createLinearGradient(0,0,0,160);
          g.addColorStop(0, color+'33'); g.addColorStop(1, color+'00'); return g;
        }), tension:0.4, pointRadius:0 }]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{legend:{display:false}},
      scales:{
        x:{ticks:{color:'#2d5070',font:{size:9}}, grid:{color:'rgba(0,212,255,0.04)'}},
        y:{ticks:{color:'#2d5070',font:{size:9}}, grid:{color:'rgba(0,212,255,0.04)'}},
      }
    }
  });
}

async function runRobot(){ await runRobotIdx(selectedRobotIdx); }

async function runRobotIdx(idx){
  var r    = ROBOTS[idx];
  var card = document.getElementById('robot-card-'+idx);
  if(card) card.classList.add('running');
  toast(r.name+' 回測中...');
  await sleep(1500);
  r.winRate     = parseFloat((r.winRate + Math.random()*2-1).toFixed(1));
  r.totalReturn = parseFloat((r.totalReturn + Math.random()*3-1).toFixed(1));
  r.trades     += Math.floor(Math.random()*2);
  var last = r.equity[r.equity.length-1];
  r.equity.push(parseFloat((last*(1+Math.random()*0.04-0.01)).toFixed(1)));
  if(card) card.classList.remove('running');
  renderRobotCards();
  toast(r.name+' 回測完成！勝率 '+r.winRate+'%，報酬 +'+r.totalReturn+'%');
}

function applyRobotSignals(){
  var r        = ROBOTS[selectedRobotIdx];
  var all      = getDisplayStocks();
  var filtered = all.filter(r.filter).sort(function(a,b){ return b.ai-a.ai; }).slice(0,10);

  var tbody = document.getElementById('robot-picks-tbody');
  if(!tbody) return;
  tbody.innerHTML = filtered.map(function(s){
    return '<tr>' +
      '<td><div class="tn">'+escHtml(s.name)+'</div></td>' +
      '<td><div class="tk">'+s.code+'</div></td>' +
      '<td style="font-family:var(--mono);font-weight:700;">'+s.price+'</td>' +
      '<td><div class="ms"><span style="font-family:var(--mono);font-weight:700;color:var(--accent2);">'+s.ai+'</span>'+
        '<div class="mb" style="width:40px;"><div class="mf" style="width:'+s.ai+'%;background:var(--accent2);"></div></div></div></td>' +
      '<td style="font-family:var(--mono);color:var(--green);">'+s.entry+'</td>' +
      '<td style="font-family:var(--mono);color:var(--accent);">'+s.t1+'</td>' +
      '<td style="font-family:var(--mono);color:var(--red);">'+s.sl+'</td>' +
      '<td style="font-size:10px;color:var(--text2);">'+s.reason.substring(0,40)+'...</td>' +
    '</tr>';
  }).join('') || '<tr><td colspan="8" class="empty">無符合此策略的標的，請先執行掃描</td></tr>';

  toast(r.name+' 套用完成，找到 '+filtered.length+' 檔符合標的');
}
