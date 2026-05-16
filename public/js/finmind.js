// ═══════════════════════════════════════════════
// finmind.js — FinMind API 串接 + 技術指標計算 + AI評分
// ═══════════════════════════════════════════════

// ── FinMind API ──
async function finmindFetch(params){
  var token = getFinMindKey();
  var url   = new URL(FINMIND_URL);
  Object.entries(params).forEach(function(e){ url.searchParams.set(e[0], e[1]); });
  if(token) url.searchParams.set('token', token);
  var r = await fetch(url.toString(), { signal: AbortSignal.timeout(12000) });
  if(!r.ok) throw new Error('FinMind HTTP ' + r.status);
  var json = await r.json();
  if(json.status !== 200) throw new Error('FinMind: ' + (json.msg || '錯誤'));
  return json.data || [];
}

async function finmindCandles(symbol, days){
  days = days || 120;
  var end   = new Date();
  var start = new Date();
  start.setDate(start.getDate() - days - 30);
  var fmt = function(d){ return d.toISOString().split('T')[0]; };
  var raw = await finmindFetch({ dataset:'TaiwanStockPrice', data_id:symbol, start_date:fmt(start), end_date:fmt(end) });
  return raw.map(function(r){
    return { date:r.date, open:parseFloat(r.open), high:parseFloat(r.max),
             low:parseFloat(r.min), close:parseFloat(r.close), volume:parseInt(r.Trading_Volume) };
  }).filter(function(c){ return !isNaN(c.close) && c.close > 0; });
}

async function finmindChips(symbol){
  var end   = new Date();
  var start = new Date(); start.setDate(start.getDate() - 5);
  var fmt   = function(d){ return d.toISOString().split('T')[0]; };
  var raw   = await finmindFetch({ dataset:'TaiwanStockInstitutionalInvestorsBuySell', data_id:symbol, start_date:fmt(start), end_date:fmt(end) });
  var result = { foreign:0, trust:0, dealer:0 };
  raw.forEach(function(d){
    var net = (parseInt(d.buy)||0) - (parseInt(d.sell)||0);
    if(d.name==='外資')       result.foreign = Math.round(net/1000);
    if(d.name==='投信')       result.trust   = Math.round(net/1000);
    if((d.name||'').startsWith('自營')) result.dealer = Math.round(net/1000);
  });
  return result;
}

// ── 指標計算 ──
function sma(arr, n){ var s = arr.slice(-n); return s.length ? s.reduce(function(a,b){return a+b;},0)/s.length : 0; }
function avgArr(arr){ return arr.length ? arr.reduce(function(a,b){return a+b;},0)/arr.length : 0; }

function calcRSI(closes, period){
  period = period || 14;
  var gains=0, losses=0;
  for(var i = closes.length-period; i < closes.length; i++){
    var d = closes[i] - closes[i-1];
    if(d > 0) gains += d; else losses += -d;
  }
  var rs = gains / (losses || 0.001);
  return 100 - 100/(1+rs);
}

function calcKD(highs, lows, closes, period){
  period = period || 9;
  var h  = highs.slice(-period), l = lows.slice(-period), c = closes[closes.length-1];
  var hn = Math.max.apply(null,h), ln = Math.min.apply(null,l);
  var rsv = (hn===ln) ? 50 : (c-ln)/(hn-ln)*100;
  var K = rsv*2/3 + 33.33*1/3;
  var D = K*2/3 + 33.33*1/3;
  return { k:K, d:D };
}

function calcMACD(closes, fast, slow, sig){
  fast=fast||12; slow=slow||26; sig=sig||9;
  var ema = function(arr,n){
    var k=2/(n+1), e=arr[0];
    for(var i=1;i<arr.length;i++) e=arr[i]*k+e*(1-k);
    return e;
  };
  var ml = ema(closes,fast) - ema(closes,slow);
  return { macd:ml, signal:ml*0.9, hist:ml*0.1 };
}

function countConsecUp(closes){
  var c=0;
  for(var i=closes.length-1;i>0;i--){ if(closes[i]>closes[i-1]) c++; else break; }
  return c;
}

function calcChipScore(d){
  var s=0;
  if(d.foreign>0) s+=10; else if(d.foreign===0) s+=3;
  if(d.trust>0)   s+=8;
  if((d.broker_days||0)>=3) s+=7;
  if(d.margin>0)  s+=3;
  if(d.dealer>0)  s+=2;
  return Math.min(30,s);
}

function classifySignal(tech, chip, vol, risk, rsi, kd, macd, price, ma20, hadLimitUp, volRatio){
  if(risk <= 5)                           return { sig:'假突破風險', sigType:'risk'   };
  if(tech>=28 && volRatio>1.5 && price>=ma20) return { sig:'強勢突破',   sigType:'break'  };
  if(chip>=22 && tech>=22)                return { sig:'主力建倉',   sigType:'whale'  };
  if(volRatio>1.5 && tech>=20)            return { sig:'爆量突破',   sigType:'break'  };
  if(tech>=22 && kd.k>kd.d)              return { sig:'量價轉強',   sigType:'strong' };
  if(tech+chip+vol+risk >= 70)            return { sig:'短線偏多',   sigType:'strong' };
  if(rsi > 50)                            return { sig:'等待回測',   sigType:'wait'   };
  return { sig:'觀察中', sigType:'wait' };
}

function generateReason(sig, rsi, kd, macd, volRatio, chip){
  var parts = [];
  if(macd.hist > 0)             parts.push('MACD柱狀翻紅');
  if(kd.k > kd.d && kd.k > 50) parts.push('KD黃金交叉(K:'+kd.k.toFixed(0)+')');
  if(rsi > 50)                  parts.push('RSI '+rsi.toFixed(0)+'強勢');
  if(volRatio > 1.5)            parts.push('量放大'+volRatio.toFixed(1)+'倍');
  if(chip.foreign > 0)          parts.push('外資買超'+chip.foreign+'億');
  if(chip.trust > 0)            parts.push('投信連買');
  if(parts.length === 0)        parts.push('技術指標轉強，持續觀察');
  return parts.join('，') + '。';
}

// ── 主評分函式 ──
function computeScore(code, name, candles){
  var closes = candles.map(function(c){ return parseFloat(c.close); });
  var highs  = candles.map(function(c){ return parseFloat(c.high); });
  var lows   = candles.map(function(c){ return parseFloat(c.low); });
  var vols   = candles.map(function(c){ return parseFloat(c.volume||0); });
  var last   = closes.length - 1;
  var price  = closes[last];
  var vol    = vols[last];

  var ma5  = sma(closes,5);
  var ma20 = sma(closes,20);
  var ma60 = sma(closes,60);
  var rsi  = calcRSI(closes, CFG.rsi_period);
  var kd   = calcKD(highs, lows, closes, CFG.kd_period);
  var macd = calcMACD(closes, CFG.macd_fast, CFG.macd_slow, CFG.macd_sig);

  var vol5     = avgArr(vols.slice(-6,-1));
  var volRatio = vol5 > 0 ? vol/vol5 : 0;
  var high20   = Math.max.apply(null, highs.slice(-20));
  var hadLimitUp = candles.slice(-20).some(function(c){
    return (parseFloat(c.close)-parseFloat(c.open))/parseFloat(c.open) > 0.095;
  });
  var lc = candles[last];
  var bodyHigh   = Math.max(parseFloat(lc.open), parseFloat(lc.close));
  var upperShadow = (parseFloat(lc.high) - bodyHigh) / bodyHigh;
  var prevClose  = closes[last-1] || closes[last];
  var chg        = parseFloat(((price/prevClose-1)*100).toFixed(2));
  var volB       = parseFloat((price*vol/1e8).toFixed(1));

  // 技術面
  var tech = 0;
  if(price > ma20)  tech += 4;
  if(price > ma60)  tech += 2;
  if(ma5 > ma20)    tech += 2;
  if(rsi>50 && rsi<70) tech += 7; else if(rsi>=70) tech += 3; else if(rsi>45) tech += 3;
  if(kd.k>kd.d && kd.k>50) tech += 7; else if(kd.k>kd.d) tech += 4;
  if(macd.hist > 0) tech += 7; else if(macd.hist > -0.5) tech += 3;
  if(price >= high20*0.99) tech += 6; else if(price >= high20*0.95) tech += 3;

  var chip = 15;
  var chip_detail = { foreign:0, trust:0, dealer:0, margin:0, short:0, broker_days:0 };

  // 量價
  var vol_score = 0;
  if(volRatio > CFG.vol_ratio)  vol_score += 8; else if(volRatio > 1.2) vol_score += 4;
  if(hadLimitUp)                vol_score += 6;
  if(price >= high20*0.98)      vol_score += 6;

  // 風險（扣分制）
  var risk_score = 15;
  if(rsi > 80)            risk_score -= 5;
  if(upperShadow > 0.02)  risk_score -= 4;
  if(countConsecUp(closes) > 5) risk_score -= 3;
  if(ma20 > 0 && (price/ma20-1) > 0.12) risk_score -= 3;
  risk_score = Math.max(0, risk_score);

  var ai   = Math.min(100, tech + chip + vol_score + risk_score);
  var boom = Math.min(100, Math.round(ai*0.85 + Math.random()*10));
  var classified = classifySignal(tech, chip, vol_score, risk_score, rsi, kd, macd, price, ma20, hadLimitUp, volRatio);

  var entry = parseFloat((price*0.995).toFixed(1));
  var t1    = parseFloat((price*1.06).toFixed(1));
  var t2    = parseFloat((price*1.12).toFixed(1));
  var sl    = parseFloat((ma20*0.99).toFixed(1));
  var riskLvl = risk_score>=12 ? '低' : risk_score>=8 ? '中' : '高';

  return {
    code: code, name: name || getStockName(code) || code,
    price:price, chg:chg, vol:volB, sector:'—',
    tech:Math.min(35,tech), chip:Math.min(30,chip),
    vol_score:Math.min(20,vol_score), risk_score:risk_score,
    ai:ai, boom:boom,
    sig:classified.sig, sigType:classified.sigType,
    entry:entry, t1:t1, t2:t2, sl:sl, riskLvl:riskLvl,
    reason: generateReason(classified.sig, rsi, kd, macd, volRatio, chip_detail),
    tech_detail:{ ma5:parseFloat(ma5.toFixed(1)), ma20:parseFloat(ma20.toFixed(1)),
      ma60:parseFloat(ma60.toFixed(1)), rsi:parseFloat(rsi.toFixed(1)),
      kd_k:parseFloat(kd.k.toFixed(1)), kd_d:parseFloat(kd.d.toFixed(1)),
      macd_hist:parseFloat(macd.hist.toFixed(2)) },
    chip_detail: chip_detail,
    candles: candles.slice(-60),
  };
}

function calcBoom(s){
  return Math.min(100, Math.round((s.tech/35*35 + s.chip/30*30 + s.vol_score/20*20 + s.risk_score/15*15)*0.88 + Math.random()*8));
}
