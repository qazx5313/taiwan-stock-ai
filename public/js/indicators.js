// ═══════════════════════════════════════════════
// indicators.js — 指標選股模組
// 策略一：MACD 順勢交易
// 策略二：布林通道逆勢回歸
// ═══════════════════════════════════════════════

var currentIndicatorTab = 'macd';
var indicatorResults    = [];
var indicatorFilter     = 'all';
var indicatorRunning    = false;

// ── 切換策略 Tab ──
function switchIndicatorTab(tab, btn){
  currentIndicatorTab = tab;
  document.querySelectorAll('#tab-indicators .ft').forEach(function(b){ b.classList.remove('active'); });
  if(btn) btn.classList.add('active');
  document.getElementById('ind-desc-macd').style.display = tab==='macd' ? '' : 'none';
  document.getElementById('ind-desc-boll').style.display = tab==='boll' ? '' : 'none';
  // 重新套用篩選
  renderIndicatorTable(indicatorResults);
}

// ── 主篩選入口 ──
async function runIndicatorScreener(){
  if(indicatorRunning){ toast('分析中，請稍候'); return; }

  var all = getDisplayStocks();
  if(all.length === 0){
    toast('請先執行爆升選股取得股票資料');
    return;
  }

  indicatorRunning = true;
  indicatorResults = [];

  var prog    = document.getElementById('ind-progress');
  var statusEl= document.getElementById('ind-status');
  var barEl   = document.getElementById('ind-bar');
  var countEl = document.getElementById('ind-count');
  if(prog) prog.style.display = 'block';

  for(var i=0; i<all.length; i++){
    var s = all[i];
    if(statusEl) statusEl.textContent = '分析 ('+(i+1)+'/'+all.length+')：'+s.name;
    if(barEl) barEl.style.width = Math.round((i+1)/all.length*100)+'%';
    if(countEl) countEl.textContent = (i+1)+'/'+all.length;

    var result = currentIndicatorTab === 'macd'
      ? analyzeMACDTrend(s)
      : analyzeBollinger(s);

    if(result && result.score >= 50){
      indicatorResults.push(result);
    }
    await sleep(5); // 不阻塞UI
  }

  indicatorResults.sort(function(a,b){ return b.score - a.score; });
  if(prog) prog.style.display = 'none';
  indicatorRunning = false;

  document.getElementById('ind-result-count').textContent = indicatorResults.length;
  renderIndicatorTable(indicatorResults);
  toast(currentIndicatorTab==='macd' ? 'MACD策略' : '布林策略' +
    ' 找到 '+indicatorResults.length+' 檔符合標的');
}

// ════════════════════════════════════════════
// 策略一：MACD 順勢交易分析
// ════════════════════════════════════════════
function analyzeMACDTrend(s){
  var td = s.tech_detail || {};
  var cd = s.chip_detail || {};
  var price  = s.price  || 0;
  var ma5    = td.ma5   || 0;
  var ma20   = td.ma20  || 0;
  var rsi    = td.rsi   || 50;
  var kd_k   = td.kd_k  || 50;
  var kd_d   = td.kd_d  || 50;
  var macd_h = td.macd_hist || 0;
  var vol    = s.vol    || 0;
  var chg    = s.chg    || 0;

  if(price <= 0 || ma20 <= 0) return null;

  // ── 趨勢判斷（35分）──
  var trendScore = 0;
  var trendDir   = 'neutral';

  var aboveMa20  = price > ma20;
  var ma5AboveMa20 = ma5 > ma20;
  var bias = (price / ma20 - 1) * 100; // 乖離率%

  if(aboveMa20)   trendScore += 15;
  if(ma5AboveMa20) trendScore += 10;
  if(s.ai >= 70)  trendScore += 5;   // AI高分代表多頭結構
  if(rsi > 50)    trendScore += 5;

  if(trendScore >= 25) trendDir = 'bull';
  else if(!aboveMa20 && !ma5AboveMa20) trendDir = 'bear';

  // ── MACD 狀態（30分）──
  var macdScore  = 0;
  var macdStatus = '';

  if(macd_h > 0){
    macdScore  += 15;
    macdStatus  = '柱狀翻紅';
    if(macd_h > 1) { macdScore += 10; macdStatus = '紅柱擴大'; }
  } else if(macd_h > -0.5 && macd_h <= 0){
    macdScore  += 10;
    macdStatus  = '綠柱收斂中';
  } else if(macd_h < -0.5){
    macdScore  += 0;
    macdStatus  = '空頭延伸';
  }
  // KD輔助確認
  if(kd_k > kd_d && kd_k > 50) macdScore += 5;

  // ── 量價確認（20分）──
  var volScore  = 0;
  if(vol > 1.3) volScore += 12;
  else if(vol > 1.0) volScore += 6;
  if(chg > 0) volScore += 5;
  if(s.boom >= 65) volScore += 3;

  // ── 風險過濾（15分，扣分制）──
  var riskScore = 15;
  var riskFlags = [];

  if(bias > 15){
    riskScore -= 10;
    riskFlags.push('乖離過大('+bias.toFixed(1)+'%)');
  }
  if(macd_h > 5){
    riskScore -= 5;
    riskFlags.push('MACD過熱');
  }
  if(rsi > 80){
    riskScore -= 5;
    riskFlags.push('RSI超買');
  }
  if(trendDir === 'bear'){
    riskScore -= 8;
    riskFlags.push('空頭趨勢');
  }
  riskScore = Math.max(0, riskScore);

  var totalScore = trendScore + macdScore + volScore + riskScore;
  if(totalScore < 50) return null;

  // ── 價格計算 ──
  var entry  = parseFloat((price * 1.002).toFixed(1));  // 略高於現價進場
  var sl     = parseFloat((ma20 * 0.98).toFixed(1));    // MA20下方2%
  if(sl >= entry) sl = parseFloat((entry * 0.95).toFixed(1)); // 保底-5%
  var t1     = parseFloat((entry * 1.08).toFixed(1));   // +8%
  var t2     = parseFloat((entry * 1.15).toFixed(1));   // +15%
  var watch  = parseFloat((price * 0.998).toFixed(1));  // 觀察是否守穩

  var riskLvl = riskScore >= 12 ? '低' : riskScore >= 8 ? '中' : '高';
  var reason  = buildMACDReason(trendDir, macdStatus, riskFlags, bias, vol, macd_h);

  return {
    strategy: 'macd',
    code:     s.code,
    name:     s.name,
    price:    price,
    trend:    trendDir === 'bull' ? '多頭' : trendDir === 'bear' ? '空頭' : '中性',
    trendDir: trendDir,
    status:   macdStatus,
    score:    Math.min(100, totalScore),
    direction:'多方',
    watch:    watch,
    entry:    entry,
    sl:       sl,
    t1:       t1,
    t2:       t2,
    riskLvl:  riskLvl,
    reason:   reason,
    scores:   { trend:trendScore, macd:macdScore, vol:volScore, risk:riskScore },
  };
}

function buildMACDReason(trend, macdStatus, flags, bias, vol, macd_h){
  var parts = [];
  if(trend==='bull') parts.push('多頭排列確認');
  parts.push('MACD'+macdStatus);
  if(vol > 1.3) parts.push('成交量放大'+vol.toFixed(1)+'倍');
  if(macd_h > 0) parts.push('柱狀翻正順勢做多');
  if(flags.length > 0) parts.push('⚠️ 注意：'+flags.join('、'));
  return parts.join('，') + '。';
}

// ════════════════════════════════════════════
// 策略二：布林通道逆勢回歸分析
// ════════════════════════════════════════════
function analyzeBollinger(s){
  var td    = s.tech_detail || {};
  var price = s.price  || 0;
  var ma20  = td.ma20  || 0;
  var rsi   = td.rsi   || 50;
  var vol   = s.vol    || 0;
  var chg   = s.chg    || 0;

  if(price <= 0 || ma20 <= 0) return null;

  // 用 AI 分數的 tech_detail 模擬布林通道
  // 實際上需要計算標準差，這裡用 RSI 和價格位置估算
  var bias     = (price / ma20 - 1) * 100;  // 乖離率
  var ma5      = td.ma5  || ma20;
  var ma60     = td.ma60 || ma20;

  // 布林通道估算（2倍標準差 ≈ 10-15% 乖離）
  var upperBand = ma20 * 1.12;  // 上軌估算
  var lowerBand = ma20 * 0.88;  // 下軌估算
  var bandwidth = (upperBand - lowerBand) / ma20; // 通道寬度

  // 布林位置判斷
  var nearLower  = price <= lowerBand * 1.02;   // 接近或跌破下軌
  var nearUpper  = price >= upperBand * 0.98;   // 接近或突破上軌
  var expanding  = bandwidth > 0.25;             // 布林通道擴張（趨勢盤）

  // ── 布林位置（30分）──
  var bollScore  = 0;
  var bollStatus = '';
  var direction  = 'neutral';

  if(nearLower && bias < -5){
    bollScore  = 25 + Math.min(5, Math.abs(bias));
    bollStatus = '觸下軌反彈機會';
    direction  = 'bull';
  } else if(nearUpper && bias > 5){
    bollScore  = 25 + Math.min(5, bias);
    bollStatus = '觸上軌回落風險';
    direction  = 'bear';
  } else if(bias < -3){
    bollScore  = 15;
    bollStatus = '偏離中軌向下';
    direction  = 'bull';
  } else if(bias > 3){
    bollScore  = 15;
    bollStatus = '偏離中軌向上';
    direction  = 'bear';
  } else {
    bollStatus = '中軌附近整理';
    bollScore  = 5;
  }

  // ── RSI 狀態（20分）──
  var rsiScore = 0;
  if(direction === 'bull'){
    if(rsi < 35)       { rsiScore = 20; }   // 超賣，最佳反彈點
    else if(rsi < 45)  { rsiScore = 12; }
    else if(rsi < 55)  { rsiScore = 5; }
  } else if(direction === 'bear'){
    if(rsi > 65)       { rsiScore = 20; }   // 超買，最佳回落點
    else if(rsi > 55)  { rsiScore = 12; }
    else if(rsi > 45)  { rsiScore = 5; }
  }

  // ── 趨勢濾網（20分）──
  var trendScore = 0;
  var isBullTrend = price > ma60 && ma5 > ma20;
  var isBearTrend = price < ma60 && ma5 < ma20;

  if(direction === 'bull'){
    if(!isBearTrend) trendScore += 15;   // 非空頭才做逆勢多
    if(isBullTrend)  trendScore += 5;    // 多頭格局回測更佳
  } else if(direction === 'bear'){
    if(!isBullTrend) trendScore += 15;   // 非多頭才做逆勢空
    if(isBearTrend)  trendScore += 5;
  }
  // 布林通道擴張時降分（趨勢盤不做逆勢）
  if(expanding) trendScore = Math.round(trendScore * 0.5);

  // ── 量價風險（15分）──
  var volScore  = 15;
  var volFlags  = [];
  if(direction === 'bull'){
    // 多單：成交量不可暴增（恐慌下殺不接刀）
    if(vol > 3.0 && chg < -3){
      volScore -= 10;
      volFlags.push('恐慌暴量下殺');
    }
    if(chg < -5) { volScore -= 5; volFlags.push('急跌'); }
  } else if(direction === 'bear'){
    // 空單：不可強勢放量突破
    if(vol > 2.0 && chg > 3){
      volScore -= 10;
      volFlags.push('強勢放量突破');
    }
  }
  volScore = Math.max(0, volScore);

  // ── 支撐壓力（15分）──
  var suppScore = 10; // 預設中性
  if(direction === 'bull' && rsi < 35) suppScore = 15;
  if(direction === 'bear' && rsi > 65) suppScore = 15;

  var totalScore = bollScore + rsiScore + trendScore + volScore + suppScore;
  if(totalScore < 50 || direction === 'neutral') return null;

  // ── 價格計算 ──
  var entry, sl, t1, t2, watch;
  if(direction === 'bull'){
    entry = parseFloat((price * 1.005).toFixed(1));
    sl    = parseFloat((lowerBand * 0.99).toFixed(1));
    if(sl >= entry) sl = parseFloat((entry * 0.95).toFixed(1));
    t1    = parseFloat(ma20.toFixed(1));          // 第一目標：中軌
    t2    = parseFloat(upperBand.toFixed(1));     // 第二目標：上軌
    watch = parseFloat((lowerBand * 1.01).toFixed(1));
  } else {
    entry = parseFloat((price * 0.995).toFixed(1));
    sl    = parseFloat((upperBand * 1.01).toFixed(1));
    t1    = parseFloat(ma20.toFixed(1));
    t2    = parseFloat(lowerBand.toFixed(1));
    watch = parseFloat((upperBand * 0.99).toFixed(1));
  }

  var riskLvl = (volScore >= 12 && trendScore >= 10) ? '低' : (volScore >= 8) ? '中' : '高';
  var reason  = buildBollReason(direction, bollStatus, rsi, bias, expanding, volFlags);

  return {
    strategy:  'boll',
    code:      s.code,
    name:      s.name,
    price:     price,
    trend:     isBullTrend ? '多頭' : isBearTrend ? '空頭' : '震盪',
    trendDir:  direction,
    status:    bollStatus,
    score:     Math.min(100, totalScore),
    direction: direction === 'bull' ? '多方反彈' : '空方回落',
    watch:     watch,
    entry:     entry,
    sl:        sl,
    t1:        t1,
    t2:        t2,
    riskLvl:   riskLvl,
    reason:    reason,
    scores:    { boll:bollScore, rsi:rsiScore, trend:trendScore, vol:volScore, supp:suppScore },
  };
}

function buildBollReason(dir, status, rsi, bias, expanding, flags){
  var parts = [];
  parts.push(status);
  if(dir==='bull'){
    parts.push('RSI ' + rsi.toFixed(0) + (rsi<35?' 超賣':'') + ' 反彈機會');
    parts.push('乖離 ' + bias.toFixed(1) + '%');
  } else {
    parts.push('RSI ' + rsi.toFixed(0) + (rsi>65?' 超買':'') + ' 回落風險');
    parts.push('乖離 ' + bias.toFixed(1) + '%');
  }
  if(expanding) parts.push('⚠️ 布林通道擴張（趨勢強度高，謹慎逆勢）');
  if(flags.length>0) parts.push('⚠️ '+flags.join('、'));
  return parts.join('，') + '。';
}

// ── 渲染結果表格 ──
function filterIndicator(f, btn){
  indicatorFilter = f;
  document.querySelectorAll('#tab-indicators .ftabs .ft').forEach(function(b){ b.classList.remove('active'); });
  if(btn) btn.classList.add('active');
  renderIndicatorTable(indicatorResults);
}

function renderIndicatorTable(results){
  var filtered = results.filter(function(r){
    if(indicatorFilter === 'bull') return r.trendDir === 'bull';
    if(indicatorFilter === 'bear') return r.trendDir === 'bear';
    if(indicatorFilter === 'high') return r.score >= 75;
    return true;
  });

  document.getElementById('ind-result-count').textContent = filtered.length;

  var tbody = document.getElementById('ind-tbody');
  if(!tbody) return;

  if(filtered.length === 0){
    tbody.innerHTML = '<tr><td colspan="14" class="empty">目前無符合條件的標的</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(function(r){
    var dirColor  = r.trendDir==='bull' ? 'var(--green)' : r.trendDir==='bear' ? 'var(--red)' : 'var(--text2)';
    var dirIcon   = r.trendDir==='bull' ? '▲' : r.trendDir==='bear' ? '▼' : '─';
    var scoreColor= r.score>=80?'#00d4ff':r.score>=65?'var(--accent2)':'var(--gold)';
    var rmap      = {'低':'risk-low','中':'risk-mid','高':'risk-high'};

    // 分數條
    var scoreBar = '<div class="ms">' +
      '<span style="font-family:var(--mono);font-weight:700;color:'+scoreColor+';min-width:24px;">'+r.score+'</span>' +
      '<div class="mb" style="width:40px;"><div class="mf" style="width:'+r.score+'%;background:'+scoreColor+'"></div></div>' +
      '</div>';

    // 策略狀態 badge
    var strat = r.strategy === 'macd' ? 'MACD' : 'BOLL';
    var stratColor = r.strategy === 'macd' ? '#1a6fff' : '#00ffb3';

    return '<tr>' +
      '<td><div class="tn">'+escHtml(r.name)+'</div></td>' +
      '<td><div class="tk">'+r.code+'</div></td>' +
      '<td><span class="pv">'+r.price+'</span></td>' +
      '<td style="color:'+dirColor+';font-family:var(--mono);font-size:11px;">'+dirIcon+' '+r.trend+'</td>' +
      '<td><span style="font-size:9px;font-family:var(--mono);background:'+stratColor+'22;color:'+stratColor+';border:1px solid '+stratColor+'44;border-radius:3px;padding:2px 6px;">'+r.status+'</span></td>' +
      '<td>'+scoreBar+'</td>' +
      '<td style="font-family:var(--mono);font-size:10px;color:'+dirColor+';">'+r.direction+'</td>' +
      '<td style="font-family:var(--mono);color:var(--text2);">'+r.watch+'</td>' +
      '<td style="font-family:var(--mono);color:var(--green);">'+r.entry+'</td>' +
      '<td style="font-family:var(--mono);color:var(--red);">'+r.sl+'</td>' +
      '<td style="font-family:var(--mono);color:var(--accent);">'+r.t1+'</td>' +
      '<td style="font-family:var(--mono);color:var(--accent2);">'+r.t2+'</td>' +
      '<td class="'+(rmap[r.riskLvl]||'')+'">'+r.riskLvl+'</td>' +
      '<td>' +
        '<button class="btn btn-sm" onclick="showIndicatorDetail('+JSON.stringify(r).replace(/"/g,"'")+')" >詳情</button>' +
      '</td>' +
    '</tr>';
  }).join('');
}

// 詳情 toast（簡易版）
function showIndicatorDetail(r){
  // 開啟股票詳情 modal
  openModal(r.code);
  // 同時 toast 顯示策略建議
  toast('['+r.direction+'] '+r.name+' 順勢分:'+r.score+' | 進:'+r.entry+' 停:'+r.sl+' 目標:'+r.t1);
}

// CSV 匯出
function exportIndicatorCSV(){
  if(!indicatorResults.length){ toast('尚無資料'); return; }
  var rows = [['名稱','代號','現價','趨勢','策略狀態','分數','方向','觀察價','進場','停損','目標一','目標二','風險','理由'].join(',')];
  indicatorResults.forEach(function(r){
    rows.push([r.name,r.code,r.price,r.trend,r.status,r.score,r.direction,r.watch,r.entry,r.sl,r.t1,r.t2,r.riskLvl,r.reason.replace(/,/g,'；')].join(','));
  });
  var blob = new Blob(['\uFEFF'+rows.join('\n')], {type:'text/csv;charset=utf-8'});
  var a    = document.createElement('a');
  a.href   = URL.createObjectURL(blob);
  a.download = '指標選股_'+(currentIndicatorTab==='macd'?'MACD':'布林')+'_'+new Date().toLocaleDateString('zh-TW').replace(/\//g,'')+'.csv';
  a.click();
  toast('CSV匯出完成');
}
