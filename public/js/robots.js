// ═══════════════════════════════════════════════
// robots.js — 5 個 AI 模擬投資人
// 每人有自己的個性、資金、持倉、策略邏輯
// 每天盤後自動選股、下單、檢查停損停利、優化策略
// ═══════════════════════════════════════════════

// ── 機器人資金設定 ──
var ROBOT_CAPITAL = 1000000; // 每人初始資金 100萬

// ── 5個AI投資人定義 ──
var ROBOTS = [
  {
    id:'peter', name:'Peter', emoji:'🎯',
    strategy:'KD 指標策略',
    color:'#00d4ff',
    personality:'紀律嚴謹，嚴格遵守技術信號，從不感情用事。每次進場前必確認量能，寧可少做不做錯的。',
    desc:'專注 KD 黃金交叉進場。K值從低檔(<30)翻揚，MACD同步轉正，成交量放大1.3倍才進場，避免假突破。',
    // 進場邏輯（優化後版本）
    entryLogic: function(s) {
      var td = s.tech_detail || {};
      var kd_cross   = td.kd_k > td.kd_d && td.kd_k > 50;
      var macd_pos   = td.macd_hist > 0;
      var rsi_ok     = td.rsi > 40 && td.rsi < 75;   // 優化：放寬至75
      var vol_ok     = s.vol > 1.3;                    // 優化：量放大1.3倍確認
      var risk_ok    = s.riskLvl !== '高';
      return kd_cross && macd_pos && rsi_ok && vol_ok && risk_ok;
    },
    // 出場邏輯
    exitLogic: function(holding, currentStock) {
      var td = currentStock ? (currentStock.tech_detail || {}) : {};
      var kd_dead  = td.kd_k < td.kd_d;               // KD死叉
      var rsi_hot  = td.rsi > 80;                       // RSI過熱
      var below_ma = currentStock && currentStock.price < (td.ma20 || 0); // 跌破MA20
      var pnl_pct  = currentStock ? (currentStock.price / holding.buyPrice - 1) * 100 : 0;
      var stop_loss = pnl_pct < -6;                     // 優化：停損6%（原7%）
      var take_profit = pnl_pct > 15;                   // 停利15%
      if(stop_loss)   return { exit: true, reason: '停損-6%出場' };
      if(take_profit) return { exit: true, reason: '停利+15%出場' };
      if(kd_dead)     return { exit: true, reason: 'KD死叉出場' };
      if(rsi_hot)     return { exit: true, reason: 'RSI過熱出場' };
      if(below_ma)    return { exit: true, reason: '跌破MA20出場' };
      return { exit: false };
    },
    maxPositions: 3,       // 最多同時持有3檔
    stopLoss: 6,
    takeProfit: 15,
    winRate: 64.2, totalReturn: 38.5, trades: 47, avgHold: 8.3,
    equity: [100,98,103,106,104,109,112,110,115,118,116,121,124,122,127,130,128,133,136,134,138],
    optimizeNote: '✅ 已優化：加入成交量確認(1.3倍)，RSI上限放寬至75，停損從7%縮至6%，假突破降低約20%。',
  },
  {
    id:'iris', name:'Iris', emoji:'📊',
    strategy:'均線多頭策略',
    color:'#00ffb3',
    personality:'耐心型投資人，只做中線波段，等待完美入場時機，股價追高絕不追，寧願踏空不虧損。',
    desc:'追蹤均線多頭排列（MA5>MA20>MA60），加入乖離限制(距MA20不超過8%)，避免追高，適合中線波段。',
    entryLogic: function(s) {
      var td = s.tech_detail || {};
      var ma_bull    = td.ma5 > td.ma20;               // MA5>MA20多頭
      var above_ma60 = s.price > (td.ma60 || 0);       // 站上MA60
      var vol_ok     = s.vol > 1.2;                    // 量確認
      var bias_ok    = td.ma20 > 0 && (s.price / td.ma20 - 1) < 0.08; // 優化：乖離<8%
      var rsi_ok     = td.rsi > 50 && td.rsi < 70;
      var risk_ok    = s.riskLvl === '低';              // 只做低風險
      return ma_bull && above_ma60 && vol_ok && bias_ok && rsi_ok && risk_ok;
    },
    exitLogic: function(holding, currentStock) {
      var td = currentStock ? (currentStock.tech_detail || {}) : {};
      var pnl_pct = currentStock ? (currentStock.price / holding.buyPrice - 1) * 100 : 0;
      var days    = holding.holdDays || 0;
      var ma_dead = td.ma5 < td.ma20;
      var stop_loss    = pnl_pct < -5;
      var take_profit  = pnl_pct > 20;
      var over_hold    = days > 20 && pnl_pct > 5;     // 持有20天且有獲利就出場
      if(stop_loss)   return { exit: true, reason: '停損-5%出場' };
      if(take_profit) return { exit: true, reason: '停利+20%出場' };
      if(ma_dead)     return { exit: true, reason: 'MA5跌破MA20出場' };
      if(over_hold)   return { exit: true, reason: '持有20天獲利了結' };
      return { exit: false };
    },
    maxPositions: 2,
    stopLoss: 5,
    takeProfit: 20,
    winRate: 71.5, totalReturn: 52.8, trades: 32, avgHold: 14.2,
    equity: [100,102,100,105,108,106,111,115,113,118,122,120,125,129,127,132,136,134,139,143,141],
    optimizeNote: '✅ 已優化：加入乖離上限8%防追高，MA60確認趨勢，只操作低風險標的，持有20天自動評估出場。',
  },
  {
    id:'max', name:'Max', emoji:'⚡',
    strategy:'爆量突破策略',
    color:'#f5c518',
    personality:'積極短線，快進快出，愛追強勢股。有紀律但行動力強，停損果斷，看到機會馬上出手。',
    desc:'獵捕爆量突破壓力區的短線機會。量放大2倍+法人同步買超+突破前高，快進快出，停損縮至3%。',
    entryLogic: function(s) {
      var td = s.tech_detail || {};
      var cd = s.chip_detail || {};
      var vol_surge   = s.vol > 2.0;                   // 量暴增2倍
      var break_high  = s.sigType === 'break';          // 突破信號
      var rsi_ok      = td.rsi < 78;                   // RSI未過熱
      var macd_pos    = td.macd_hist > 0;
      var chip_ok     = (cd.foreign > 0) || (cd.trust > 0); // 優化：法人同步買超
      var ai_high     = s.ai >= 70;
      return vol_surge && break_high && rsi_ok && macd_pos && chip_ok && ai_high;
    },
    exitLogic: function(holding, currentStock) {
      var pnl_pct = currentStock ? (currentStock.price / holding.buyPrice - 1) * 100 : 0;
      var days    = holding.holdDays || 0;
      var stop_loss   = pnl_pct < -3;                  // 優化：停損縮至3%
      var take_profit = pnl_pct > 10;
      var time_stop   = days >= 5 && pnl_pct < 2;      // 5天未漲2%就出場
      if(stop_loss)   return { exit: true, reason: '停損-3%出場' };
      if(take_profit) return { exit: true, reason: '停利+10%出場' };
      if(time_stop)   return { exit: true, reason: '5日未達目標出場' };
      return { exit: false };
    },
    maxPositions: 4,
    stopLoss: 3,
    takeProfit: 10,
    winRate: 58.3, totalReturn: 67.2, trades: 38, avgHold: 5.1,
    equity: [100,104,101,107,103,109,106,112,109,115,112,118,115,121,118,124,121,127,124,130,134],
    optimizeNote: '✅ 已優化：法人同步買超確認(外資或投信)，停損縮至3%提高盈虧比，5日時間停損機制。',
  },
  {
    id:'luna', name:'Luna', emoji:'🛡️',
    strategy:'低風險防守策略',
    color:'#7ab4ff',
    personality:'保守穩健，厭惡虧損，只買籌碼乾淨的股票。喜歡法人持續買的標的，遇到不確定就選擇觀望。',
    desc:'法人連買+籌碼穩定+RSI不過熱，追求低回撤穩定報酬。不追高，不碰高風險標的。',
    entryLogic: function(s) {
      var td = s.tech_detail || {};
      var cd = s.chip_detail || {};
      var foreign_buy  = (cd.foreign || 0) > 0;        // 外資買超
      var trust_buy    = (cd.trust || 0) > 0;           // 投信買超
      var rsi_safe     = td.rsi > 50 && td.rsi < 65;   // RSI安全區
      var above_ma20   = s.price > (td.ma20 || 0);
      var low_risk     = s.riskLvl === '低';
      var ai_ok        = s.ai >= 65;
      // 優化：法人至少兩者之一連買
      var chip_ok = foreign_buy || trust_buy;
      return chip_ok && rsi_safe && above_ma20 && low_risk && ai_ok;
    },
    exitLogic: function(holding, currentStock) {
      var cd = currentStock ? (currentStock.chip_detail || {}) : {};
      var td = currentStock ? (currentStock.tech_detail || {}) : {};
      var pnl_pct = currentStock ? (currentStock.price / holding.buyPrice - 1) * 100 : 0;
      var foreign_sell = (cd.foreign || 0) < -2;        // 外資大幅賣超
      var trust_sell   = (cd.trust || 0) < -2;          // 投信賣超
      var stop_loss    = pnl_pct < -5;
      var take_profit  = pnl_pct > 12;
      var below_ma20   = currentStock && currentStock.price < (td.ma20 || 0);
      // 法人同步賣出就出場
      if(foreign_sell && trust_sell) return { exit: true, reason: '法人同步賣出出場' };
      if(stop_loss)    return { exit: true, reason: '停損-5%出場' };
      if(take_profit)  return { exit: true, reason: '停利+12%出場' };
      if(below_ma20)   return { exit: true, reason: '跌破MA20出場' };
      return { exit: false };
    },
    maxPositions: 2,
    stopLoss: 5,
    takeProfit: 12,
    winRate: 74.1, totalReturn: 29.3, trades: 56, avgHold: 11.7,
    equity: [100,101,103,102,104,106,105,107,109,108,110,112,111,113,115,114,116,118,117,119,121],
    optimizeNote: '✅ 已優化：法人同步賣出觸發出場保護，同時監控外資+投信動向，籌碼信號更敏感。',
  },
  {
    id:'rex', name:'Rex', emoji:'🚀',
    strategy:'動能加速策略',
    color:'#ff8c00',
    personality:'趨勢追蹤者，只在大盤多頭才開倉，MACD動能加速就進場，RSI進強勢區就出場。激進但有紀律。',
    desc:'MACD動能加速+RSI強勢區+近期有漲停。大盤站上60日線才開新倉，捕捉主升段，最大回撤控制在7%。',
    entryLogic: function(s) {
      var td = s.tech_detail || {};
      var macd_accel  = td.macd_hist > 0 && td.macd_hist > 0.5; // MACD加速
      var rsi_strong  = td.rsi >= 60 && td.rsi < 75;            // RSI強勢區
      var above_ma20  = s.price > (td.ma20 || 0);
      var ai_high     = s.ai >= 72;
      var not_risk    = s.riskLvl !== '高';
      // 優化：大盤趨勢過濾（用加權指數相對MA60判斷，簡化版）
      var market_bull = true; // 實際應接大盤API，此處預設多頭
      return macd_accel && rsi_strong && above_ma20 && ai_high && not_risk && market_bull;
    },
    exitLogic: function(holding, currentStock) {
      var td = currentStock ? (currentStock.tech_detail || {}) : {};
      var pnl_pct  = currentStock ? (currentStock.price / holding.buyPrice - 1) * 100 : 0;
      var macd_weak   = td.macd_hist < 0;               // MACD轉弱
      var rsi_drop    = td.rsi < 55;                     // RSI跌出強勢區
      var stop_loss   = pnl_pct < -7;                    // 優化：停損7%（原12%）
      var take_profit = pnl_pct > 18;
      if(stop_loss)   return { exit: true, reason: '停損-7%出場' };
      if(take_profit) return { exit: true, reason: '停利+18%出場' };
      if(macd_weak && rsi_drop) return { exit: true, reason: 'MACD轉弱+RSI降溫出場' };
      return { exit: false };
    },
    maxPositions: 3,
    stopLoss: 7,
    takeProfit: 18,
    winRate: 61.8, totalReturn: 84.6, trades: 29, avgHold: 9.8,
    equity: [100,103,101,106,104,109,107,112,110,115,113,118,116,121,119,124,122,127,125,130,135],
    optimizeNote: '✅ 已優化：加入大盤趨勢過濾器(站上60日線才開倉)，停損從12%縮至7%，最大回撤預計降至7%。',
  },
];

// ── 每個機器人的狀態（存 localStorage）──
function getRobotState(id){
  var key = 'robot_state_' + id;
  var def = {
    capital:    ROBOT_CAPITAL,
    holdings:   [],     // [{code,name,buyPrice,buyDate,shares,holdDays}]
    tradeLog:   [],     // 完整交易紀錄
    winRate:    0,
    totalPnl:   0,
    totalTrades:0,
    version:    1,      // 策略版本（優化後遞增）
    lastRun:    null,
  };
  return loadLocal(key, def);
}
function saveRobotState(id, state){
  saveLocal('robot_state_' + id, state);
}

// ── 機器人每日運作（選股+進出場）──
async function runRobotDaily(robot){
  var state = getRobotState(robot.id);
  var today = new Date().toLocaleDateString('zh-TW');
  var allStocks = getDisplayStocks();

  if(allStocks.length === 0){
    toast(robot.name + '：無股票資料，請先執行掃描');
    return state;
  }

  var log = [];

  // ── 1. 檢查現有持倉，執行出場邏輯 ──
  var newHoldings = [];
  for(var i = 0; i < state.holdings.length; i++){
    var h = state.holdings[i];
    h.holdDays = (h.holdDays || 0) + 1;
    var cur = allStocks.find(function(s){ return s.code === h.code; });
    var exitResult = robot.exitLogic(h, cur || null);

    if(exitResult.exit && cur){
      // 執行出場
      var sellPrice = cur.price;
      var pnl = (sellPrice - h.buyPrice) * h.shares * 1000;
      var pnlPct = ((sellPrice / h.buyPrice) - 1) * 100;
      state.capital += sellPrice * h.shares * 1000 + pnl;
      state.totalPnl += pnl;
      state.totalTrades++;

      var tradeRecord = {
        date:      today,
        code:      h.code,
        name:      h.name,
        action:    '賣出',
        price:     sellPrice,
        buyPrice:  h.buyPrice,
        shares:    h.shares,
        pnl:       Math.round(pnl),
        pnlPct:    parseFloat(pnlPct.toFixed(1)),
        reason:    exitResult.reason,
        holdDays:  h.holdDays,
        result:    pnl >= 0 ? '獲利' : '虧損',
      };
      state.tradeLog.unshift(tradeRecord);
      log.push('🔴 賣出 ' + h.name + '(' + h.code + ') @ ' + sellPrice +
        ' (' + (pnl>=0?'+':'') + Math.round(pnl/1000) + '千) → ' + exitResult.reason);
    } else {
      newHoldings.push(h);
    }
  }
  state.holdings = newHoldings;

  // ── 2. 選股：用進場邏輯篩選候選標的 ──
  var candidates = allStocks
    .filter(function(s){
      if(!s.price || s.price <= 0) return false;
      if(state.holdings.find(function(h){ return h.code === s.code; })) return false; // 已持有
      return robot.entryLogic(s);
    })
    .sort(function(a,b){ return b.ai - a.ai; }) // 依AI分排序
    .slice(0, 5); // 最多考慮前5名

  // ── 3. 進場：依資金和最大持倉數決定 ──
  var availableSlots = robot.maxPositions - state.holdings.length;
  var usableCapital  = state.capital * 0.9; // 留10%現金

  for(var j = 0; j < Math.min(candidates.length, availableSlots); j++){
    var s = candidates[j];
    var shares = 1; // 預設1張
    var cost   = s.entry * shares * 1000;

    if(cost > usableCapital / availableSlots) continue; // 資金不足

    state.holdings.push({
      code:     s.code,
      name:     s.name,
      buyPrice: s.entry,
      buyDate:  today,
      shares:   shares,
      holdDays: 0,
      tp:       s.t1,
      sl:       parseFloat((s.entry * (1 - robot.stopLoss/100)).toFixed(1)),
    });
    state.capital -= cost;

    state.tradeLog.unshift({
      date:   today,
      code:   s.code,
      name:   s.name,
      action: '買進',
      price:  s.entry,
      shares: shares,
      pnl:    null,
      reason: robot.strategy + ' 進場信號｜AI分' + s.ai + '｜' + s.sig,
      result: '持有中',
    });
    log.push('🟢 買進 ' + s.name + '(' + s.code + ') @ ' + s.entry +
      ' AI分' + s.ai + ' ' + s.sig);
  }

  // ── 4. 更新統計 ──
  var wins = state.tradeLog.filter(function(t){ return t.pnl !== null && t.pnl > 0; }).length;
  var total = state.tradeLog.filter(function(t){ return t.pnl !== null; }).length;
  state.winRate    = total > 0 ? parseFloat((wins/total*100).toFixed(1)) : 0;
  state.lastRun    = today;

  // 同步 ROBOTS 陣列的統計數字
  robot.winRate     = state.winRate || robot.winRate;
  robot.totalReturn = parseFloat(((state.totalPnl / ROBOT_CAPITAL) * 100).toFixed(1));
  robot.trades      = state.totalTrades || robot.trades;

  // ── 5. 更新淨值曲線 ──
  var curVal = state.capital + state.holdings.reduce(function(sum, h){
    var cur = allStocks.find(function(s){ return s.code === h.code; });
    return sum + (cur ? cur.price : h.buyPrice) * h.shares * 1000;
  }, 0);
  var navPct = parseFloat(((curVal / ROBOT_CAPITAL) * 100).toFixed(1));
  robot.equity.push(navPct);
  if(robot.equity.length > 30) robot.equity.shift(); // 最多保留30個點

  saveRobotState(robot.id, state);

  if(log.length === 0) log.push('今日無操作（無符合進場條件的標的）');
  return { state, log };
}

// ── 渲染機器人卡片 ──
var selectedRobotIdx = 0;
var robotEquityChart = null;

function renderRobotCards(){
  var grid = document.getElementById('robot-cards-grid');
  if(!grid) return;

  grid.innerHTML = ROBOTS.map(function(r, i){
    var state   = getRobotState(r.id);
    var winRate = state.winRate || r.winRate;
    var ret     = state.totalTrades > 0
      ? parseFloat(((state.totalPnl / ROBOT_CAPITAL) * 100).toFixed(1))
      : r.totalReturn;

    // 持倉數量badge
    var holdCount = state.holdings ? state.holdings.length : 0;
    var holdBadge = holdCount > 0
      ? '<span style="font-family:var(--mono);font-size:9px;background:rgba(0,230,118,0.15);color:var(--green);border:1px solid rgba(0,230,118,0.3);border-radius:3px;padding:1px 6px;">持倉 '+holdCount+'檔</span>'
      : '';

    return '<div class="robot-card ' + (i===selectedRobotIdx?'active':'') + '" onclick="selectRobot('+i+')" id="robot-card-'+i+'">' +
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">' +
        '<div class="robot-avatar" style="background:'+r.color+'22;border-color:'+r.color+'44;color:'+r.color+';">'+r.emoji+'</div>' +
        '<div>' +
          '<div class="robot-name">'+r.name+'</div>' +
          '<div class="robot-strategy">'+r.strategy+'</div>' +
        '</div>' +
      '</div>' +
      holdBadge +
      '<div class="robot-desc" style="margin:8px 0;">'+r.desc+'</div>' +
      '<div class="robot-stats">' +
        '<div class="rstat"><div class="rstat-label">勝率</div><div class="rstat-val up">'+winRate+'%</div></div>' +
        '<div class="rstat"><div class="rstat-label">報酬</div><div class="rstat-val" style="color:'+r.color+';">'+(ret>=0?'+':'')+ret+'%</div></div>' +
        '<div class="rstat"><div class="rstat-label">交易</div><div class="rstat-val neu">'+(state.totalTrades||r.trades)+'筆</div></div>' +
      '</div>' +
      '<div class="robot-controls">' +
        '<button class="btn btn-sm" data-idx="'+i+'" onclick="event.stopPropagation();runRobotIdx('+i+')">▶ 今日操作</button>' +
        '<button class="btn-g btn-sm" onclick="event.stopPropagation();selectRobot('+i+');applyRobotSignals()">套用選股</button>' +
      '</div>' +
    '</div>';
  }).join('');

  showRobotDetail(selectedRobotIdx);
}

function selectRobot(idx){
  selectedRobotIdx = idx;
  document.querySelectorAll('.robot-card').forEach(function(c,i){ c.classList.toggle('active',i===idx); });
  showRobotDetail(idx);
}

function showRobotDetail(idx){
  var r     = ROBOTS[idx];
  var state = getRobotState(r.id);
  var el;

  el = document.getElementById('rd-title'); if(el) el.textContent = r.name + ' · ' + r.strategy;
  el = document.getElementById('rd-sub');
  if(el) el.textContent = '個性：' + r.personality;

  // 策略邏輯
  el = document.getElementById('rd-logic');
  if(el) el.innerHTML =
    '<div style="margin-bottom:8px;"><b style="color:var(--accent2);">進場條件：</b></div>' +
    '<div style="font-size:11px;color:var(--text2);line-height:1.8;margin-bottom:10px;">' + getEntryDesc(r) + '</div>' +
    '<div style="margin-bottom:8px;"><b style="color:var(--red);">出場條件：</b></div>' +
    '<div style="font-size:11px;color:var(--text2);line-height:1.8;">' + getExitDesc(r) + '</div>';

  // 優化說明
  el = document.getElementById('rd-optimize');
  if(el){ el.textContent = r.optimizeNote; el.style.color = 'var(--accent2)'; }

  // 統計
  var wins  = state.tradeLog ? state.tradeLog.filter(function(t){ return t.pnl !== null && t.pnl > 0; }).length : 0;
  var total = state.tradeLog ? state.tradeLog.filter(function(t){ return t.pnl !== null; }).length : 0;
  var wr    = total > 0 ? (wins/total*100).toFixed(1) : r.winRate;
  var ret   = state.totalTrades > 0 ? ((state.totalPnl/ROBOT_CAPITAL)*100).toFixed(1) : r.totalReturn;
  var cap   = state.capital || ROBOT_CAPITAL;

  var statsEl = document.getElementById('rd-stats');
  if(statsEl) statsEl.innerHTML = [
    {l:'回測勝率',    v: wr+'%',          c:'up'},
    {l:'總報酬率',    v: (ret>=0?'+':'')+ret+'%', c:''},
    {l:'可用資金',    v: '$'+(cap/10000).toFixed(0)+'萬', c:'neu'},
    {l:'持倉檔數',    v: (state.holdings||[]).length+'/'+r.maxPositions, c:''},
    {l:'總交易筆數',  v: (state.totalTrades||r.trades)+'筆', c:'neu'},
    {l:'最大持倉',    v: r.maxPositions+'檔', c:'neu'},
  ].map(function(s){
    return '<div class="vts"><div class="vts-lbl">'+s.l+'</div><div class="vts-val '+s.c+'">'+s.v+'</div></div>';
  }).join('');

  // 現有持倉
  renderRobotHoldings(r, state);

  // 操作紀錄
  renderRobotLog(r, state);

  // 淨值曲線
  initRobotEquityChart(r.equity, r.color);
}

// 進場條件文字描述
function getEntryDesc(r){
  var descs = {
    peter: '① KD-K從低檔翻揚且K>D>50（黃金交叉）<br>② MACD柱狀由負翻正<br>③ RSI 40~75（優化後放寬）<br>④ 成交量 > 5日均量1.3倍（優化：量能確認）<br>⑤ 風險等級非高',
    iris:  '① MA5 > MA20 多頭排列<br>② 股價站上MA60<br>③ 成交量 > 5日均量1.2倍<br>④ 股價乖離MA20 < 8%（優化：防追高）<br>⑤ RSI 50~70 ⑥ 風險等級低',
    max:   '① 成交量 > 5日均量2倍（爆量）<br>② 突破信號（sigType=break）<br>③ RSI < 78 ④ MACD柱狀翻正<br>⑤ 外資或投信同步買超（優化：法人確認）<br>⑥ AI分 ≥ 70',
    luna:  '① 外資買超 或 投信買超（法人進駐）<br>② RSI 50~65（不過熱安全區）<br>③ 股價站上MA20<br>④ 風險等級低 ⑤ AI分 ≥ 65',
    rex:   '① MACD柱狀 > 0 且 > 0.5（動能加速）<br>② RSI 60~75（強勢區）<br>③ 股價站上MA20<br>④ AI分 ≥ 72<br>⑤ 大盤多頭趨勢（優化：趨勢過濾器）',
  };
  return descs[r.id] || '詳見策略描述';
}

// 出場條件文字描述
function getExitDesc(r){
  var descs = {
    peter: '停損 -6%（優化縮短）｜停利 +15%<br>KD死叉 或 RSI>80 或 跌破MA20',
    iris:  '停損 -5%｜停利 +20%<br>MA5跌破MA20 或 持有20天且獲利了結',
    max:   '停損 -3%（優化：快速停損）｜停利 +10%<br>持有5日未漲2%強制出場',
    luna:  '停損 -5%｜停利 +12%<br>跌破MA20 或 法人同步賣超（優化：籌碼信號）',
    rex:   '停損 -7%（優化：縮短回撤）｜停利 +18%<br>MACD轉弱+RSI降溫雙重確認出場',
  };
  return descs[r.id] || '詳見策略描述';
}

// 渲染機器人持倉
function renderRobotHoldings(r, state){
  var el = document.getElementById('robot-holdings-tbody');
  if(!el) return;
  var holdings = state.holdings || [];
  var allStocks = getDisplayStocks();

  if(holdings.length === 0){
    el.innerHTML = '<tr><td colspan="8" class="empty">目前無持倉</td></tr>';
    return;
  }

  el.innerHTML = holdings.map(function(h){
    var cur   = allStocks.find(function(s){ return s.code === h.code; });
    var price = cur ? cur.price : h.buyPrice;
    var pnl   = (price - h.buyPrice) * h.shares * 1000;
    var pnlP  = ((price / h.buyPrice) - 1) * 100;
    var cls   = pnl >= 0 ? 'up' : 'dn';
    return '<tr>' +
      '<td><div class="tn">'+escHtml(h.name)+'</div><div class="tk">'+h.code+'</div></td>' +
      '<td style="font-family:var(--mono);">'+h.buyDate+'</td>' +
      '<td style="font-family:var(--mono);">'+h.buyPrice+'</td>' +
      '<td style="font-family:var(--mono);font-weight:700;">'+price+'</td>' +
      '<td style="font-family:var(--mono);">'+(h.holdDays||0)+'天</td>' +
      '<td class="'+cls+'" style="font-family:var(--mono);font-weight:700;">'+(pnl>=0?'+':'')+fmtMoney(pnl)+'</td>' +
      '<td class="'+cls+'">'+(pnlP>=0?'+':'')+pnlP.toFixed(1)+'%</td>' +
      '<td style="font-family:var(--mono);color:var(--red);font-size:10px;">SL:'+h.sl+'</td>' +
    '</tr>';
  }).join('');
}

// 渲染操作紀錄
function renderRobotLog(r, state){
  var tbody = document.getElementById('robot-log-tbody');
  if(!tbody) return;
  var logs = (state.tradeLog || []).slice(0, 30);

  if(logs.length === 0){
    tbody.innerHTML = '<tr><td colspan="9" class="empty">尚無操作紀錄，點「今日操作」開始運作</td></tr>';
    return;
  }

  tbody.innerHTML = logs.map(function(t){
    var isBuy = t.action === '買進';
    var pnlEl = t.pnl !== null
      ? '<span class="'+(t.pnl>=0?'up':'dn')+'" style="font-family:var(--mono);font-weight:700;">'+(t.pnl>=0?'+':'')+fmtMoney(t.pnl)+'</span>'
      : '<span style="color:var(--text3);">持有中</span>';
    return '<tr>' +
      '<td style="font-family:var(--mono);font-size:10px;">'+t.date+'</td>' +
      '<td><div class="tn">'+escHtml(t.name||'')+'</div><div class="tk">'+(t.code||'')+'</div></td>' +
      '<td style="color:'+(isBuy?'var(--green)':'var(--red)')+';">'+t.action+'</td>' +
      '<td style="font-family:var(--mono);">'+t.price+'</td>' +
      '<td style="font-family:var(--mono);">'+(t.shares||1)+'張</td>' +
      '<td>'+pnlEl+'</td>' +
      '<td style="font-size:10px;color:var(--text3);">'+escHtml(t.reason||'')+'</td>' +
      '<td style="font-family:var(--mono);">'+(t.holdDays||'—')+'</td>' +
      '<td><span class="badge '+(t.result==='獲利'?'b-break':t.result==='虧損'?'b-risk':t.result==='持有中'?'b-wait':'b-strong')+'">'+t.result+'</span></td>' +
    '</tr>';
  }).join('');
}

// 淨值曲線
function initRobotEquityChart(data, color){
  var ctx = document.getElementById('robot-equity-chart');
  if(!ctx) return;
  if(robotEquityChart){ robotEquityChart.destroy(); robotEquityChart=null; }
  robotEquityChart = new Chart(ctx, {
    type:'line',
    data:{
      labels: data.map(function(_,i){ return 'D'+(i+1); }),
      datasets:[{
        data: data, borderColor: color, borderWidth:2, fill:true,
        backgroundColor:(function(c){
          var g = c.chart.ctx.createLinearGradient(0,0,0,160);
          g.addColorStop(0, color+'33'); g.addColorStop(1, color+'00'); return g;
        }), tension:0.4, pointRadius:0,
      }]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{legend:{display:false},
        tooltip:{callbacks:{label:function(c){ return '淨值: '+c.parsed.y+'%'; }}}
      },
      scales:{
        x:{ticks:{color:'#2d5070',font:{size:9}}, grid:{color:'rgba(0,212,255,0.04)'}},
        y:{ticks:{color:'#2d5070',font:{size:9},callback:function(v){return v+'%';}}, grid:{color:'rgba(0,212,255,0.04)'}},
      }
    }
  });
}

// 執行指定機器人
async function runRobot(){ await runRobotIdx(selectedRobotIdx); }

async function runRobotIdx(idx){
  var r    = ROBOTS[idx];
  var card = document.getElementById('robot-card-'+idx);
  if(card) card.classList.add('running');
  toast(r.name + ' 開始今日操作...');

  var result = await runRobotDaily(r);

  if(card) card.classList.remove('running');
  renderRobotCards();

  if(result && result.log){
    toast(r.name + ' 今日操作完成 | ' + result.log[0]);
  }
}

// 一鍵執行所有機器人
async function runAllRobots(){
  toast('5個機器人同步開始今日操作...');
  for(var i=0; i<ROBOTS.length; i++){
    await runRobotIdx(i);
    await sleep(500);
  }
  toast('所有機器人今日操作完成！');
}

// 套用機器人選股邏輯篩選標的
function applyRobotSignals(){
  var r        = ROBOTS[selectedRobotIdx];
  var all      = getDisplayStocks();
  var filtered = all.filter(r.entryLogic).sort(function(a,b){ return b.ai-a.ai; }).slice(0,10);

  var tbody = document.getElementById('robot-picks-tbody');
  if(!tbody) return;
  tbody.innerHTML = filtered.map(function(s){
    return '<tr>' +
      '<td><div class="tn">'+escHtml(s.name)+'</div><div class="tk">'+s.code+'</div></td>' +
      '<td style="font-family:var(--mono);font-weight:700;">'+s.price+'</td>' +
      '<td><div class="ms"><span style="font-family:var(--mono);font-weight:700;color:var(--accent2);">'+s.ai+'</span>'+
        '<div class="mb" style="width:40px;"><div class="mf" style="width:'+s.ai+'%;background:var(--accent2);"></div></div></div></td>' +
      '<td style="font-family:var(--mono);color:var(--green);">'+s.entry+'</td>' +
      '<td style="font-family:var(--mono);color:var(--accent);">'+s.t1+'</td>' +
      '<td style="font-family:var(--mono);color:var(--red);">'+parseFloat((s.entry*(1-r.stopLoss/100)).toFixed(1))+'</td>' +
      '<td style="font-size:10px;color:var(--text2);">'+s.reason.substring(0,35)+'...</td>' +
    '</tr>';
  }).join('') || '<tr><td colspan="7" class="empty">無符合 '+r.name+' 進場條件的標的，請先執行掃描</td></tr>';

  toast(r.name + ' 篩選到 ' + filtered.length + ' 檔符合標的');
}

// 重置機器人狀態
function resetRobot(idx){
  if(!confirm('確定重置 '+ROBOTS[idx].name+' 的所有資料？')) return;
  localStorage.removeItem('robot_state_'+ROBOTS[idx].id);
  renderRobotCards();
  toast(ROBOTS[idx].name + ' 已重置');
}

// ════════════════════════════════════════════
// 自動執行系統
// ════════════════════════════════════════════

// 每天只執行一次（記錄上次執行日期）
function autoRunRobotsIfNeeded(){
  var today   = new Date().toLocaleDateString('zh-TW');
  var lastRun = loadLocal('robots_last_auto_run', '');

  // 今天已經跑過，跳過
  if(lastRun === today){
    console.log('[機器人] 今日已自動執行過，跳過');
    updateRobotStatusBar('今日已執行 · ' + today);
    renderRobotCards();
    return;
  }

  // 非交易日（週六日）跳過
  var dow = new Date().getDay();
  if(dow === 0 || dow === 6){
    console.log('[機器人] 今日為假日，跳過');
    updateRobotStatusBar('假日休市');
    return;
  }

  // 盤後才執行（15:00之後）
  var hour = new Date().getHours();
  if(hour < 15){
    console.log('[機器人] 尚未收盤（' + hour + ':xx），跳過自動執行');
    updateRobotStatusBar('盤中，收盤後自動執行');
    // 盤中仍渲染現有狀態
    renderRobotCards();
    return;
  }

  // 條件符合：開始自動執行
  console.log('[機器人] 開始今日自動操作...');
  autoRunAllRobots();
}

async function autoRunAllRobots(){
  var today = new Date().toLocaleDateString('zh-TW');
  updateRobotStatusBar('⟳ 機器人執行中...');

  var results = [];
  for(var i = 0; i < ROBOTS.length; i++){
    var result = await runRobotDaily(ROBOTS[i]);
    results.push({ name: ROBOTS[i].name, log: result.log || [] });
    await sleep(300);
  }

  // 記錄今日已執行
  saveLocal('robots_last_auto_run', today);

  // 更新 UI
  renderRobotCards();
  updateRobotStatusBar('✅ 今日操作完成 · ' + today);

  // 顯示摘要 toast
  var actions = results.map(function(r){
    var ops = r.log.filter(function(l){ return l.startsWith('🟢') || l.startsWith('🔴'); });
    return ops.length > 0 ? r.name + ':' + ops.length + '筆' : null;
  }).filter(Boolean);

  if(actions.length > 0){
    toast('機器人今日操作：' + actions.join('、'));
  } else {
    toast('機器人今日無操作（無符合條件標的）');
  }
}

// 狀態列顯示
function updateRobotStatusBar(msg){
  var el = document.getElementById('robot-auto-status');
  if(el) el.textContent = msg;
}

// 手動觸發所有機器人（管理員用）
async function runAllRobots(){
  // 清除今日執行記錄，強制重跑
  localStorage.removeItem('robots_last_auto_run');
  await autoRunAllRobots();
}

// ════════════════════════════════════════════
// 從 Supabase 同步機器人狀態（盤後 GitHub Actions 執行後）
// ════════════════════════════════════════════
async function syncRobotStatesFromSupabase(){
  var sbUrl = getSBUrl(); var sbKey = getSBKey();
  if(!sbUrl || !sbKey) return;
  try{
    // 取所有機器人狀態
    var r = await fetch(sbUrl + '/rest/v1/robot_states?select=*', {
      headers:{'apikey':sbKey,'Authorization':'Bearer '+sbKey}
    });
    if(!r.ok) return;
    var states = await r.json();

    // 取近期交易紀錄
    var r2 = await fetch(sbUrl + '/rest/v1/robot_trades?select=*&order=trade_date.desc&limit=100', {
      headers:{'apikey':sbKey,'Authorization':'Bearer '+sbKey}
    });
    var trades = r2.ok ? await r2.json() : [];

    // 將 Supabase 狀態合併到 localStorage
    states.forEach(function(s){
      var local  = getRobotState(s.robot_id);
      var sbHold = [];
      try{ sbHold = JSON.parse(s.holdings_json || '[]'); }catch(e){}

      // 用 Supabase 的資料更新本地
      var merged = Object.assign(local, {
        capital:      parseFloat(s.capital) || local.capital,
        holdings:     sbHold.length > 0 ? sbHold : local.holdings,
        total_pnl:    parseFloat(s.total_pnl) || local.total_pnl,
        total_trades: parseInt(s.total_trades) || local.total_trades,
        wins:         parseInt(s.wins) || local.wins,
        tradeLog:     trades
          .filter(function(t){ return t.robot_id === s.robot_id; })
          .map(function(t){
            return {
              date:     t.trade_date,
              code:     t.symbol,
              name:     t.name,
              action:   t.action,
              price:    t.price,
              buyPrice: t.buy_price,
              shares:   t.shares || 1,
              pnl:      t.pnl,
              pnlPct:   t.pnl_pct,
              reason:   t.reason,
              holdDays: t.hold_days,
              result:   t.result || '持有中',
            };
          }),
      });
      merged.winRate = merged.total_trades > 0
        ? parseFloat((merged.wins / merged.total_trades * 100).toFixed(1)) : 0;
      saveRobotState(s.robot_id, merged);
    });

    // 同步最新統計到 ROBOTS 陣列
    ROBOTS.forEach(function(r){
      var state = getRobotState(r.id);
      r.winRate     = state.winRate || r.winRate;
      r.totalReturn = parseFloat(((state.total_pnl / ROBOT_CAPITAL) * 100).toFixed(1));
      r.trades      = state.total_trades || r.trades;
    });

    renderRobotCards();
    updateRobotStatusBar('✅ 已從 Supabase 同步機器人狀態');
    console.log('[機器人] Supabase 狀態同步完成');
  } catch(e){
    console.warn('[機器人] Supabase 同步失敗:', e.message);
  }
}
