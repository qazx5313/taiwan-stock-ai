// ═══════════════════════════════════════════════
// modal-report.js — 股票詳情 Modal + 每日報告
// ═══════════════════════════════════════════════

var modalCode  = '';
var modalChart = null;

function openModal(code){
  var all = getDisplayStocks();
  var s   = all.find(function(x){ return x.code===code; }) || genDemoStock(code,0);
  modalCode = code;

  var el;
  el = document.getElementById('m-title'); if(el) el.textContent = s.name;
  el = document.getElementById('m-sub');   if(el) el.textContent = s.code+' · '+s.sector+' · '+new Date().toLocaleDateString('zh-TW');
  el = document.getElementById('m-entry'); if(el) el.textContent = s.entry;
  el = document.getElementById('m-t1');    if(el) el.textContent = s.t1;
  el = document.getElementById('m-t2');    if(el) el.textContent = s.t2;
  el = document.getElementById('m-sl');    if(el) el.textContent = s.sl;
  el = document.getElementById('m-boom');  if(el) el.textContent = s.boom+'%';

  var rEl = document.getElementById('m-risk');
  if(rEl){ rEl.textContent = s.riskLvl; rEl.className = s.riskLvl==='低'?'px-v risk-low':s.riskLvl==='中'?'px-v risk-mid':'px-v risk-high'; }

  var analysisEl = document.getElementById('m-analysis');
  if(analysisEl) analysisEl.textContent = s.reason;

  var td = s.tech_detail || {};
  var techEl = document.getElementById('m-tech');
  if(techEl) techEl.innerHTML = [
    ['MA5',td.ma5],['MA20',td.ma20],['MA60',td.ma60],
    ['RSI(14)',td.rsi],['KD-K',td.kd_k],['KD-D',td.kd_d],['MACD柱',td.macd_hist],
  ].map(function(p){
    return '<div class="cfg-row"><span class="cfg-lbl">'+p[0]+'</span><span class="cfg-val">'+(p[1]||'—')+'</span></div>';
  }).join('');

  var cd = s.chip_detail || {};
  var chipEl = document.getElementById('m-chip');
  if(chipEl) chipEl.innerHTML = [
    ['外資(億)',cd.foreign||0],['投信(億)',cd.trust||0],
    ['自營商',cd.dealer||0],['融資(張)',cd.margin||0],
    ['融券(張)',cd.short||0],['分點連買(日)',cd.broker_days||0],
  ].map(function(p){
    var v = p[1]; var cls = v>0?'up':v<0?'dn':'';
    return '<div class="cfg-row"><span class="cfg-lbl">'+p[0]+'</span><span class="cfg-val '+cls+'">'+(v>0?'+':'')+v+'</span></div>';
  }).join('');

  initModalChart(s);
  document.getElementById('detail-modal').classList.add('open');
}

function closeModal(){
  document.getElementById('detail-modal').classList.remove('open');
  if(modalChart){ modalChart.destroy(); modalChart=null; }
}

function initModalChart(s){
  var ctx = document.getElementById('m-chart');
  if(!ctx) return;
  if(modalChart){ modalChart.destroy(); modalChart=null; }

  var prices = (s.candles && s.candles.length > 0)
    ? s.candles.slice(-30).map(function(c){ return parseFloat(c.close); })
    : (function(){
        var arr = [];
        for(var i=0;i<30;i++){
          var base = s.price * 0.9;
          arr.push(parseFloat((base + (i/30)*(s.price-base) + Math.random()*s.price*0.02).toFixed(1)));
        }
        arr[29] = s.price;
        return arr;
      })();

  modalChart = new Chart(ctx, {
    type:'line',
    data:{
      labels: prices.map(function(_,i){ return i===prices.length-1?'今':'D'+(i+1); }),
      datasets:[{ data:prices, borderColor:'#00d4ff', borderWidth:1.5, fill:true,
        backgroundColor:(function(c){
          var g = c.chart.ctx.createLinearGradient(0,0,0,190);
          g.addColorStop(0,'rgba(0,212,255,0.18)'); g.addColorStop(1,'rgba(0,212,255,0)'); return g;
        }), tension:0.3, pointRadius:0 }]
    },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{legend:{display:false}},
      scales:{
        x:{ticks:{color:'#2d5070',font:{size:9}},grid:{color:'rgba(0,212,255,0.04)'}},
        y:{ticks:{color:'#2d5070',font:{size:9}},grid:{color:'rgba(0,212,255,0.04)'}},
      }
    }
  });
}

async function genDetailAI(){
  var all = getDisplayStocks();
  var s   = all.find(function(x){ return x.code===modalCode; }) || genDemoStock(modalCode,0);
  var btn = document.getElementById('m-ai-btn');
  var box = document.getElementById('m-analysis');
  if(btn){ btn.disabled=true; btn.textContent='分析中...'; }
  if(box) box.innerHTML = '🤖 AI深度分析中<span class="dots"></span>';

  var claudeKey = getClaudeKey();
  if(!claudeKey){
    await sleep(1000);
    if(box) box.textContent = s.reason + '\n\n【提示】請在後台設定 Claude API Key 啟用 AI 深度分析。';
    if(btn){ btn.textContent='🤖 AI深度分析'; btn.disabled=false; }
    return;
  }
  try{
    var r = await fetch('https://api.anthropic.com/v1/messages', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        model:'claude-sonnet-4-20250514', max_tokens:500,
        messages:[{ role:'user', content:
          '分析台股 '+s.code+' '+s.name+'：現價'+s.price+'，AI分'+s.ai+
          '，RSI '+s.tech_detail.rsi+'，KD K/D='+s.tech_detail.kd_k+'/'+s.tech_detail.kd_d+
          '，MACD柱'+s.tech_detail.macd_hist+'，外資'+(s.chip_detail.foreign>0?'+':'')+s.chip_detail.foreign+'億。'+
          '給深度分析、操作建議。繁體中文，200字內。'
        }]
      })
    });
    var data = await r.json();
    if(box) box.textContent = (data.content && data.content[0] ? data.content[0].text : '') || s.reason;
  } catch(e){
    if(box) box.textContent = s.reason;
  }
  if(btn){ btn.textContent='🤖 AI深度分析'; btn.disabled=false; }
}

// ── 每日報告 ──
// ════════════════════════════════════════════
// 每日報告系統（日期列表模式）
// reports 儲存格式：{ '2026-05-16': { html, published, created } }
// ════════════════════════════════════════════

var currentReportDate = null;  // 目前查看的報告日期

function getReports(){
  return loadLocal('tw_reports', {});
}
function saveReports(obj){
  saveLocal('tw_reports', obj);
}

// 初始化報告頁
function initReport(){
  renderReportList();
  initSectors();
}

// 渲染左側日期列表
function renderReportList(){
  var reports  = getReports();
  var dates    = Object.keys(reports).sort().reverse(); // 新→舊
  var listEl   = document.getElementById('report-date-list');
  var countEl  = document.getElementById('report-count');
  var isAdmin  = currentUser && currentUser.role === 'admin';

  if(countEl) countEl.textContent = dates.length + ' 份';

  // 管理員才顯示右側操作按鈕
  var adminActions = document.getElementById('report-admin-actions');
  if(adminActions) adminActions.style.display = isAdmin ? 'flex' : 'none';

  if(!listEl) return;

  if(dates.length === 0){
    listEl.innerHTML = '<div class="empty" style="padding:20px;">尚無報告記錄</div>';
    return;
  }

  listEl.innerHTML = dates.map(function(d){
    var rep      = reports[d];
    var isToday  = d === new Date().toISOString().split('T')[0];
    var isPub    = rep.published;
    var isActive = d === currentReportDate;

    // 格式化日期顯示
    var dateObj = new Date(d);
    var weekDays = ['日','一','二','三','四','五','六'];
    var displayDate = dateObj.getFullYear() + '/' +
      String(dateObj.getMonth()+1).padStart(2,'0') + '/' +
      String(dateObj.getDate()).padStart(2,'0') +
      '（週' + weekDays[dateObj.getDay()] + '）';

    return '<div onclick="viewReport(\'' + d + '\')" style="' +
      'display:flex;align-items:center;justify-content:space-between;' +
      'padding:10px 12px;border-radius:7px;cursor:pointer;' +
      'background:' + (isActive ? 'rgba(0,212,255,0.1)' : 'var(--bg2)') + ';' +
      'border:1px solid ' + (isActive ? 'var(--accent)' : 'var(--border2)') + ';' +
      'margin-bottom:4px;transition:all 0.15s;">' +
      '<div>' +
        '<div style="font-size:12px;font-weight:' + (isToday?'700':'500') + ';color:' + (isToday?'var(--text1)':'var(--text2)') + ';">' +
          displayDate + (isToday?' <span style="font-family:var(--mono);font-size:9px;color:var(--accent2);">今日</span>':'') +
        '</div>' +
        '<div style="font-family:var(--mono);font-size:9px;color:var(--text3);margin-top:2px;">' +
          (rep.created ? (rep.created.split('T')[1]||'').substring(0,5) + ' 產生' : '') +
        '</div>' +
      '</div>' +
      '<div style="display:flex;gap:5px;align-items:center;">' +
        '<span class="badge ' + (isPub ? 'b-break' : 'b-wait') + '">' + (isPub ? '已發布' : '草稿') + '</span>' +
        (isAdmin ? '<button class="btn-d btn-sm" style="padding:2px 7px;font-size:9px;" onclick="event.stopPropagation();deleteReport(\'' + d + '\')">刪除</button>' : '') +
      '</div>' +
    '</div>';
  }).join('');
}

// 查看某日報告
function viewReport(date){
  currentReportDate = date;
  var reports = getReports();
  var rep     = reports[date];
  if(!rep){ toast('找不到此報告'); return; }

  var dateObj  = new Date(date);
  var weekDays = ['日','一','二','三','四','五','六'];
  var titleStr = dateObj.getFullYear() + ' 年 ' +
    (dateObj.getMonth()+1) + ' 月 ' +
    dateObj.getDate() + ' 日（週' + weekDays[dateObj.getDay()] + '）市場報告';

  var titleEl = document.getElementById('rep-title');
  if(titleEl) titleEl.textContent = titleStr;

  var bodyEl = document.getElementById('rep-body');
  if(bodyEl) bodyEl.innerHTML = rep.html || '<div class="empty">報告內容為空</div>';

  // 更新管理員操作按鈕狀態
  var isAdmin  = currentUser && currentUser.role === 'admin';
  var clearBtn = document.getElementById('clear-btn');
  var pubBtn   = document.getElementById('pub-btn');
  if(clearBtn && isAdmin) clearBtn.disabled = false;
  if(pubBtn   && isAdmin){
    pubBtn.disabled  = rep.published;
    pubBtn.textContent = rep.published ? '✓ 已發布' : '✓ 發布';
  }

  // 重新渲染列表（更新 active 狀態）
  renderReportList();
}

// 刪除單份報告（管理員）
function deleteReport(date){
  if(!confirm('確定刪除 ' + date + ' 的報告？')) return;
  var reports = getReports();
  delete reports[date];
  saveReports(reports);
  if(currentReportDate === date){
    currentReportDate = null;
    var bodyEl = document.getElementById('rep-body');
    if(bodyEl) bodyEl.innerHTML = '<div class="empty">← 點左側日期查看報告</div>';
    var titleEl = document.getElementById('rep-title');
    if(titleEl) titleEl.textContent = '請選擇日期查看報告';
  }
  renderReportList();
  toast('已刪除 ' + date + ' 的報告');
}

// 清除目前查看的報告（管理員）
function clearSelectedReport(){
  if(currentReportDate) deleteReport(currentReportDate);
}

// 清除全部報告（管理員）
function clearAllReports(){
  if(!confirm('確定清除所有報告？此操作無法還原。')) return;
  saveReports({});
  currentReportDate = null;
  var bodyEl = document.getElementById('rep-body');
  if(bodyEl) bodyEl.innerHTML = '<div class="empty">← 點左側日期查看報告</div>';
  renderReportList();
  toast('已清除全部報告');
}

// 強勢族群
function initSectors(){
  var sectors = [
    {n:'AI伺服器',chg:'+2.4%',m:'爆發'},{n:'先進封裝CoWoS',chg:'+1.8%',m:'強勢'},
    {n:'碳化矽SiC',chg:'+3.1%',m:'爆發'},{n:'ABF載板',chg:'+0.9%',m:'偏多'},
    {n:'RISC-V',chg:'+4.2%',m:'爆發'},{n:'電動車',chg:'-0.3%',m:'整理'},
  ];
  var secEl = document.getElementById('sector-list');
  if(secEl) secEl.innerHTML = sectors.map(function(s){
    return '<div style="display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border2);">' +
      '<span style="font-size:12px;">'+s.n+'</span>' +
      '<div style="display:flex;gap:7px;align-items:center;">' +
        '<span class="'+(s.chg.startsWith('+')?'up':'dn')+'" style="font-family:var(--mono);font-size:11px;">'+s.chg+'</span>' +
        '<span class="badge '+(s.m==='爆發'?'b-break':s.m==='強勢'?'b-strong':'b-wait')+'">'+s.m+'</span>' +
      '</div></div>';
  }).join('');
}

// 產生 AI 報告（存入日期記錄）
async function genAIReport(){
  var btn = document.querySelector('[onclick="genAIReport()"]');
  if(btn){ btn.disabled=true; btn.textContent='🤖 AI分析中...'; }

  var all  = getDisplayStocks();
  var top  = all.filter(function(s){ return s.ai>=70; }).slice(0,5);
  var claudeKey = getClaudeKey();

  if(!claudeKey || top.length===0){
    genRuleReport(top);
    if(btn){ btn.textContent='🤖 AI 產生今日報告'; btn.disabled=false; }
    return;
  }

  var stockList = top.map(function(s){
    return s.code+s.name+'(AI分'+s.ai+','+s.sig+',入場'+s.entry+')';
  }).join('、');

  try{
    var r = await fetch('https://api.anthropic.com/v1/messages', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        model:'claude-sonnet-4-20250514', max_tokens:1200,
        messages:[{ role:'user', content:
          '台股AI分析師，今日市場：外資偏多。AI精選：'+stockList+
          '。產出今日市場分析報告，含大盤、強勢族群、個股推薦（入場/目標/停損）、風險提醒。繁體中文，結構清晰。'
        }]
      })
    });
    var data = await r.json();
    var text = (data.content && data.content[0]) ? data.content[0].text : '';
    var html = '<div style="font-size:12px;color:var(--text2);line-height:1.9;">'+
      text.replace(/\n\n/g,'</p><p style="margin-bottom:12px;">').replace(/\n/g,'<br>')+'</div>';
    saveReportForDate(html);
    toast('AI 報告產生完成');
  } catch(e){ genRuleReport(top); }

  if(btn){ btn.textContent='🤖 AI 產生今日報告'; btn.disabled=false; }
}

function genRuleReport(top){
  var all  = getDisplayStocks();
  var list = (top && top.length>0) ? top : all.filter(function(s){ return s.ai>=65; }).slice(0,5);
  var html =
    '<div style="margin-bottom:14px;"><div style="font-family:var(--mono);font-size:11px;color:var(--accent);letter-spacing:1px;margin-bottom:8px;">【大盤分析】</div>' +
    '<div style="font-size:12px;color:var(--text2);line-height:1.9;">今日加權指數偏多，外資持續買超，市場情緒維持積極。</div></div>' +
    '<div style="margin-bottom:14px;"><div style="font-family:var(--mono);font-size:11px;color:var(--accent);letter-spacing:1px;margin-bottom:8px;">【AI 精選個股】</div>' +
    list.map(function(s){
      return '<div style="background:var(--bg2);border:1px solid var(--border2);border-radius:7px;padding:11px;margin-bottom:9px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">' +
          '<span style="font-weight:700;">'+escHtml(s.name)+' <span style="font-family:var(--mono);font-size:10px;color:var(--text3);">'+s.code+'</span></span>' +
          '<span class="badge b-break">'+s.sig+'</span></div>' +
        '<div style="font-family:var(--mono);font-size:10px;color:var(--text3);margin-bottom:5px;">' +
          'AI分 '+s.ai+' · 爆升率 '+s.boom+'% · 入場 '+s.entry+' · 目標 '+s.t1+' · 停損 '+s.sl+'</div>' +
        '<div style="font-size:11px;color:var(--text2);">'+s.reason+'</div></div>';
    }).join('') + '</div>' +
    '<div><div style="font-family:var(--mono);font-size:11px;color:var(--red);letter-spacing:1px;margin-bottom:8px;">【風險提醒】</div>' +
    '<div style="font-size:12px;color:var(--text2);line-height:1.9;">⚠️ 注意部位控管，假突破風險個股請勿追高，停損請嚴格執行。</div></div>';

  saveReportForDate(html);
  toast('報告產生完成');
}

// 儲存報告到今日
function saveReportForDate(html){
  var today   = new Date().toISOString().split('T')[0];
  var reports = getReports();
  reports[today] = {
    html:      html,
    published: false,
    created:   new Date().toISOString(),
  };
  saveReports(reports);
  currentReportDate = today;

  // 更新側邊按鈕
  var pubBtnSide = document.getElementById('pub-btn-side');
  if(pubBtnSide){ pubBtnSide.disabled = false; }

  renderReportList();
  viewReport(today);
}

function publishReport(){
  if(!currentReportDate){ toast('請先選擇要發布的報告'); return; }
  var reports = getReports();
  if(!reports[currentReportDate]){ toast('找不到此報告'); return; }
  reports[currentReportDate].published = true;
  saveReports(reports);
  renderReportList();
  var pubBtn     = document.getElementById('pub-btn');
  var pubBtnSide = document.getElementById('pub-btn-side');
  if(pubBtn){     pubBtn.disabled=true;     pubBtn.textContent='✓ 已發布'; }
  if(pubBtnSide){ pubBtnSide.disabled=true; pubBtnSide.textContent='✓ 已發布'; }
  toast(currentReportDate + ' 報告已發布');
}
