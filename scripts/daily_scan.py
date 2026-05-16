"""
台股AI量化平台 - 每日完整掃描腳本
================================================
執行方式：
  GitHub Actions 每天分3批自動執行（各消耗約580次API）
  合計約 1740 次，可掃描 860+ 檔股票

批次規劃（每批 ~290 檔 × 2次API = 580次）：
  Batch 0 (自動判斷) → 依執行時間決定批次
  Batch 1  → codes[0:290]
  Batch 2  → codes[290:580]
  Batch 3  → codes[580:870]
  Batch 4  → codes[870:] (若有)

環境變數：
  FINMIND_TOKEN  - FinMind API Token
  SUPABASE_URL   - Supabase Project URL
  SUPABASE_KEY   - Supabase Anon Key
  BATCH_NUM      - 批次號（0=自動判斷）
  FORCE_FULL     - 強制全掃（true/false）
"""

import os
import json
import time
import math
import requests
from datetime import datetime, timedelta

# ── 環境變數 ──
FINMIND_TOKEN = os.environ.get('FINMIND_TOKEN', '')
SUPABASE_URL  = os.environ.get('SUPABASE_URL',  '')
SUPABASE_KEY  = os.environ.get('SUPABASE_KEY',  '')
BATCH_NUM     = int(os.environ.get('BATCH_NUM', '0'))
FORCE_FULL    = os.environ.get('FORCE_FULL', 'false').lower() == 'true'
FINMIND_URL   = 'https://api.finmindtrade.com/api/v4/data'

# ── 速率控制 ──
# 有Token: 600次/小時 = 10次/分鐘
# 每次請求間隔 7 秒（保守）= 每小時約 514 次，安全
RATE_SLEEP    = 7
MAX_PER_HOUR  = 580   # 保留 20 次緩衝
PER_BATCH     = 290   # 每批股票數（290 × 2次 = 580次）

api_count   = 0
hour_start  = time.time()


def api_call(params):
    """帶速率控制的 FinMind API"""
    global api_count, hour_start

    # 每小時重置
    elapsed = time.time() - hour_start
    if elapsed >= 3600:
        print(f"  新一小時，重置計數（舊計數: {api_count}）")
        api_count  = 0
        hour_start = time.time()

    # 接近上限：等到下一小時
    if api_count >= MAX_PER_HOUR:
        wait = int(3600 - elapsed) + 30
        print(f"  達到速率上限 {api_count} 次，等待 {wait} 秒...")
        time.sleep(wait)
        api_count  = 0
        hour_start = time.time()

    if FINMIND_TOKEN:
        params['token'] = FINMIND_TOKEN

    for attempt in range(3):
        try:
            r = requests.get(FINMIND_URL, params=params, timeout=20)
            api_count += 1
            if r.status_code == 429:          # Rate limit
                time.sleep(60)
                continue
            if r.status_code != 200:
                raise Exception(f'HTTP {r.status_code}')
            j = r.json()
            if j.get('status') != 200:
                raise Exception(j.get('msg', 'API錯誤'))
            time.sleep(RATE_SLEEP)
            return j.get('data', [])
        except Exception as e:
            if attempt == 2:
                raise
            time.sleep(15)
    return []


# ════════════════════════════════════════════
# 資料取得
# ════════════════════════════════════════════

def get_stock_list():
    """取得「今天有交易」的上市上櫃股票（TaiwanStockInfo × 近日成交量過濾）"""
    cache_file = 'scripts/output/stock_list.json'
    today = datetime.now().strftime('%Y-%m-%d')
    if os.path.exists(cache_file):
        with open(cache_file) as f:
            cached = json.load(f)
        if cached.get('date') == today and len(cached.get('stocks', {})) > 100:
            print(f"  使用快取股票清單（{len(cached['stocks'])} 檔）")
            return cached['stocks'], cached['sectors']

    # Step 1: 取基本資料（名稱、產業、市場別）
    print("取得股票清單（TaiwanStockInfo）...")
    info_data = api_call({'dataset': 'TaiwanStockInfo'})
    all_info = {}
    sectors  = {}
    for d in info_data:
        sid  = str(d.get('stock_id',   '')).strip()
        name = str(d.get('stock_name', '')).strip()
        typ  = str(d.get('type',       '')).strip()
        cat  = str(d.get('industry_category', '—')).strip()
        if not sid or not name:         continue
        if len(sid) != 4:               continue
        if not sid.isdigit():           continue
        if typ not in ('twse', 'tpex'): continue
        if any(x in name for x in ['指數','ETF','基金','債券','期貨']): continue
        all_info[sid] = name
        sectors[sid]  = cat
    print(f"  TaiwanStockInfo 共 {len(all_info)} 筆（含已下市）")

    # Step 2: 取近5日有成交量的股票（= 現在還在交易）
    print("取得近日成交資料（過濾已下市）...")
    end_date   = datetime.now()
    start_date = end_date - timedelta(days=5)
    fmt = lambda d: d.strftime('%Y-%m-%d')
    try:
        price_data = api_call({
            'dataset':    'TaiwanStockPrice',
            'start_date': fmt(start_date),
            'end_date':   fmt(end_date),
        })
        active_ids = set()
        for d in price_data:
            sid = str(d.get('stock_id', '')).strip()
            vol = int(d.get('Trading_Volume', 0) or 0)
            if vol > 0 and len(sid) == 4 and sid.isdigit():
                active_ids.add(sid)
        print(f"  近5日有成交：{len(active_ids)} 檔")
    except Exception as e:
        print(f"  ⚠️  取成交資料失敗: {e}，使用原始清單")
        active_ids = set(all_info.keys())

    # Step 3: 交叉比對 → 只保留在交易中且有名稱的股票
    stocks = {sid: all_info[sid] for sid in active_ids if sid in all_info}
    print(f"  ✅ 確認在交易中：{len(stocks)} 檔")

    os.makedirs('scripts/output', exist_ok=True)
    with open(cache_file, 'w', encoding='utf-8') as f:
        json.dump({'date': today, 'stocks': stocks, 'sectors': sectors}, f, ensure_ascii=False)
    return stocks, sectors


def get_candles(symbol, days=120):
    """取日K線"""
    end   = datetime.now()
    start = end - timedelta(days=days + 30)
    data  = api_call({
        'dataset':    'TaiwanStockPrice',
        'data_id':    symbol,
        'start_date': start.strftime('%Y-%m-%d'),
        'end_date':   end.strftime('%Y-%m-%d'),
    })
    result = []
    for d in data:
        try:
            c = float(d.get('close', 0) or 0)
            if c <= 0: continue
            result.append({
                'date':   d['date'],
                'open':   float(d.get('open',  c)),
                'high':   float(d.get('max',   c)),
                'low':    float(d.get('min',   c)),
                'close':  c,
                'volume': int(d.get('Trading_Volume', 0) or 0),
            })
        except:
            continue
    return result


def get_chips(symbol):
    """取三大法人（允許失敗）"""
    end   = datetime.now()
    start = end - timedelta(days=5)
    try:
        data = api_call({
            'dataset':    'TaiwanStockInstitutionalInvestorsBuySell',
            'data_id':    symbol,
            'start_date': start.strftime('%Y-%m-%d'),
            'end_date':   end.strftime('%Y-%m-%d'),
        })
        result = {'foreign': 0, 'trust': 0, 'dealer': 0}
        for d in data:
            try:
                net  = (int(d.get('buy',0) or 0)) - (int(d.get('sell',0) or 0))
                name = d.get('name', '')
                if   name == '外資':    result['foreign'] += net
                elif name == '投信':    result['trust']   += net
                elif '自營' in name:   result['dealer']  += net
            except:
                continue
        result['foreign'] = round(result['foreign'] / 1000)
        result['trust']   = round(result['trust']   / 1000)
        result['dealer']  = round(result['dealer']  / 1000)
        return result
    except:
        return {'foreign': 0, 'trust': 0, 'dealer': 0}


# ════════════════════════════════════════════
# 技術指標 + AI 評分
# ════════════════════════════════════════════

def sma(arr, n):
    s = arr[-n:]
    return sum(s) / len(s) if s else 0

def calc_rsi(closes, period=14):
    if len(closes) < period + 1: return 50.0
    gains = losses = 0.0
    for i in range(len(closes) - period, len(closes)):
        d = closes[i] - closes[i-1]
        if d > 0: gains  += d
        else:     losses -= d
    rs = gains / (losses or 0.001)
    return 100 - 100 / (1 + rs)

def calc_kd(highs, lows, closes, period=9):
    n  = min(period, len(highs))
    hn = max(highs[-n:])
    ln = min(lows[-n:])
    c  = closes[-1]
    rsv = 50.0 if hn == ln else (c - ln) / (hn - ln) * 100
    k   = rsv * 2/3 + 33.33 / 3
    d   = k   * 2/3 + 33.33 / 3
    return round(k, 1), round(d, 1)

def calc_macd_hist(closes, fast=12, slow=26):
    if len(closes) < slow: return 0.0
    def ema(arr, n):
        k = 2 / (n + 1); e = arr[0]
        for v in arr[1:]: e = v * k + e * (1 - k)
        return e
    ml = ema(closes, fast) - ema(closes, slow)
    return round(ml * 0.1, 3)

def count_consec_up(closes):
    c = 0
    for i in range(len(closes)-1, 0, -1):
        if closes[i] > closes[i-1]: c += 1
        else: break
    return c

def compute_score(code, name, sector, candles, chips):
    closes = [c['close']  for c in candles]
    highs  = [c['high']   for c in candles]
    lows   = [c['low']    for c in candles]
    vols   = [c['volume'] for c in candles]
    if len(closes) < 20: return None

    price  = closes[-1]
    vol    = vols[-1]
    ma5    = sma(closes, 5)
    ma20   = sma(closes, 20)
    ma60   = sma(closes, min(60, len(closes)))
    rsi    = calc_rsi(closes)
    kd_k, kd_d = calc_kd(highs, lows, closes)
    macd_h = calc_macd_hist(closes)
    vol5   = sum(vols[-6:-1]) / 5 if len(vols) >= 6 else (vol or 1)
    volR   = vol / vol5 if vol5 > 0 else 0
    high20 = max(highs[-20:])
    had_lu = any((c['close']-c['open']) / (c['open'] or 1) > 0.095 for c in candles[-20:])

    lc         = candles[-1]
    body_high  = max(lc['open'], lc['close'])
    upper_shad = (lc['high'] - body_high) / (body_high or 1)
    prev_c     = closes[-2] if len(closes) >= 2 else closes[-1]
    chg        = round((price / (prev_c or 1) - 1) * 100, 2)
    vol_b      = round(price * vol / 1e8, 1)

    # 技術面 /35
    tech = 0
    if price > ma20:                  tech += 4
    if price > ma60:                  tech += 2
    if ma5   > ma20:                  tech += 2
    if 50 < rsi < 70:                 tech += 7
    elif rsi >= 70:                   tech += 3
    elif rsi > 45:                    tech += 3
    if kd_k > kd_d and kd_k > 50:    tech += 7
    elif kd_k > kd_d:                 tech += 4
    if macd_h > 0:                    tech += 7
    elif macd_h > -0.5:               tech += 3
    if price >= high20 * 0.99:        tech += 6
    elif price >= high20 * 0.95:      tech += 3
    tech = min(35, tech)

    # 籌碼面 /30
    chip = 0
    if   chips['foreign'] > 0: chip += 10
    elif chips['foreign'] == 0: chip += 3
    if   chips['trust']   > 0: chip += 8
    if   chips['dealer']  > 0: chip += 2
    chip = min(30, chip)

    # 量價 /20
    vs = 0
    if volR > 1.5:           vs += 8
    elif volR > 1.2:         vs += 4
    if had_lu:               vs += 6
    if price >= high20*0.98: vs += 6
    vs = min(20, vs)

    # 風控 /15
    risk = 15
    if rsi > 80:                            risk -= 5
    if upper_shad > 0.02:                   risk -= 4
    if count_consec_up(closes) > 5:         risk -= 3
    if ma20 > 0 and (price/ma20-1) > 0.12: risk -= 3
    risk = max(0, risk)

    ai   = min(100, tech + chip + vs + risk)
    boom = min(100, round(ai * 0.88 + 5))

    if   risk <= 5:                           sig, stype = '假突破風險', 'risk'
    elif tech>=28 and volR>1.5 and price>=ma20: sig, stype = '強勢突破', 'break'
    elif chip>=22 and tech>=22:               sig, stype = '主力建倉', 'whale'
    elif volR>1.5 and tech>=20:               sig, stype = '爆量突破', 'break'
    elif tech>=22 and kd_k>kd_d:             sig, stype = '量價轉強', 'strong'
    elif ai >= 70:                            sig, stype = '短線偏多', 'strong'
    elif rsi > 50:                            sig, stype = '等待回測', 'wait'
    else:                                     sig, stype = '觀察中',   'wait'

    sl       = round(ma20 * 0.99, 1) if ma20 > 0 else round(price * 0.95, 1)
    risk_lvl = '低' if risk >= 12 else '中' if risk >= 8 else '高'

    return {
        'symbol':      code,
        'name':        name,
        'sector':      sector,
        'date':        datetime.now().strftime('%Y-%m-%d'),
        'price':       round(price, 2),
        'chg_pct':     chg,
        'volume_b':    vol_b,
        'tech_score':  tech,
        'chip_score':  chip,
        'vol_score':   vs,
        'risk_score':  risk,
        'total_score': ai,
        'boom_prob':   boom,
        'signal':      sig,
        'signal_type': stype,
        'entry_price': round(price * 0.995, 1),
        'target1':     round(price * 1.06,  1),
        'target2':     round(price * 1.12,  1),
        'stop_loss':   sl,
        'risk_level':  risk_lvl,
        'tech_detail': {'ma5':round(ma5,1),'ma20':round(ma20,1),
            'ma60':round(ma60,1),'rsi':round(rsi,1),
            'kd_k':kd_k,'kd_d':kd_d,'macd_hist':macd_h},
        'chip_detail': {'foreign':chips['foreign'],
            'trust':chips['trust'],'dealer':chips['dealer']},
        'reason': f"技術面{tech}/35，籌碼面{chip}/30，量價{vs}/20，風控{risk}/15。" +
                  (f"外資{'買超' if chips['foreign']>0 else '賣超'}{abs(chips['foreign'])}億，" if chips['foreign'] != 0 else '') +
                  (f"RSI {round(rsi,0):.0f}，" if rsi else '') +
                  (f"KD {'黃金交叉' if kd_k>kd_d else '死亡交叉'}。"),
    }


# ════════════════════════════════════════════
# Supabase 寫入
# ════════════════════════════════════════════

def save_batch(records):
    if not SUPABASE_URL or not SUPABASE_KEY:
        return
    headers = {
        'apikey':        SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type':  'application/json',
        'Prefer':        'resolution=merge-duplicates,return=minimal',
    }
    for i in range(0, len(records), 50):
        chunk = records[i:i+50]
        try:
            r = requests.post(
                SUPABASE_URL + '/rest/v1/stock_scores',
                headers=headers, json=chunk, timeout=30
            )
            if r.status_code not in (200, 201):
                print(f"  ⚠️  Supabase 寫入 HTTP {r.status_code}: {r.text[:80]}")
        except Exception as e:
            print(f"  ⚠️  Supabase 寫入錯誤: {e}")
        time.sleep(0.3)


# ════════════════════════════════════════════
# 主程式
# ════════════════════════════════════════════

def main():
    now = datetime.now()
    print(f"{'='*50}")
    print(f"台股AI每日完整掃描  {now.strftime('%Y-%m-%d %H:%M')}")
    print(f"{'='*50}")
    print(f"FinMind Token : {'已設定' if FINMIND_TOKEN else '未設定（300次/hr限制）'}")
    print(f"Supabase      : {'已設定' if SUPABASE_URL else '未設定'}")

    os.makedirs('scripts/output', exist_ok=True)

    # 1. 取得完整股票清單（有快取則用快取，不消耗次數）
    stocks_map, sectors_map = get_stock_list()
    all_codes = sorted(stocks_map.keys())
    total     = len(all_codes)
    print(f"股票總數: {total} 檔")

    # 2. 決定本批要掃哪個區間
    if FORCE_FULL:
        # 強制全掃（管理員手動觸發）
        scan_codes = all_codes
        batch_label = 'FULL'
    elif BATCH_NUM == 0:
        # 自動排程：依 UTC 時間決定批次（每批 PER_BATCH 檔）
        utc_hour = now.hour
        # 07:30 UTC → batch_idx=0, 08:30 → 1, 09:30 → 2
        batch_idx  = max(0, utc_hour - 7)
        start_idx  = batch_idx * PER_BATCH
        end_idx    = start_idx + PER_BATCH
        scan_codes = all_codes[start_idx:end_idx]
        batch_label = f'自動批次 {batch_idx+1}（{start_idx+1}~{min(end_idx,total)}）'
    else:
        # 手動指定批次
        start_idx  = (BATCH_NUM - 1) * PER_BATCH
        end_idx    = start_idx + PER_BATCH
        scan_codes = all_codes[start_idx:end_idx]
        batch_label = f'批次 {BATCH_NUM}（{start_idx+1}~{min(end_idx,total)}）'

    if not scan_codes:
        print(f"此批次無股票可掃（{batch_label}），結束。")
        return

    est_api  = len(scan_codes) * 2
    est_min  = int(len(scan_codes) * 2 * RATE_SLEEP / 60)
    print(f"本批掃描: {batch_label}，共 {len(scan_codes)} 檔")
    print(f"預估消耗: {est_api} 次 API，約 {est_min} 分鐘")
    print()

    results = []
    errors  = []

    for i, code in enumerate(scan_codes):
        name   = stocks_map.get(code, code)
        sector = sectors_map.get(code, '—')
        pct    = (i + 1) / len(scan_codes) * 100
        print(f"[{i+1:3d}/{len(scan_codes)}] {pct:5.1f}%  {name}({code})", end='  ')

        try:
            candles = get_candles(code)
            if len(candles) < 20:
                print("K線不足，跳過")
                continue

            chips = get_chips(code)

            rec = compute_score(code, name, sector, candles, chips)
            if rec:
                results.append(rec)
                risk_icon = {'低':'🟢','中':'🟡','高':'🔴'}.get(rec['risk_level'],'⚪')
                print(f"AI:{rec['total_score']:3d}  {rec['signal'][:6]}  {risk_icon} {rec['risk_level']}  API總計:{api_count}")
            else:
                print("評分失敗")

        except Exception as e:
            errors.append({'code': code, 'error': str(e)})
            print(f"❌ {str(e)[:40]}")

        # 每 50 筆存一次（防止中途失敗全丟）
        if len(results) > 0 and len(results) % 50 == 0:
            print(f"\n  → 中途存檔 {len(results)} 筆...")
            save_batch(results[-50:])

    # 最後剩餘
    remainder = len(results) % 50
    if remainder > 0:
        save_batch(results[-remainder:])

    # 排序
    results.sort(key=lambda x: x['total_score'], reverse=True)

    # 摘要
    top10 = results[:10]
    summary = {
        'batch':         batch_label,
        'scan_date':     now.strftime('%Y-%m-%d'),
        'scan_time':     now.strftime('%H:%M'),
        'total_scanned': len(results),
        'api_calls':     api_count,
        'errors':        len(errors),
        'top10': [
            f"{r['name']}({r['symbol']})  AI:{r['total_score']}  {r['signal']}  {r['risk_level']}風險"
            for r in top10
        ],
    }

    with open('scripts/output/summary.json', 'w', encoding='utf-8') as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)

    print()
    print(f"{'='*50}")
    print(f"掃描完成")
    print(f"  掃描檔數  : {len(results)}")
    print(f"  API 消耗  : {api_count} 次")
    print(f"  錯誤      : {len(errors)}")
    print(f"  Top 10 :")
    for s in summary['top10']:
        print(f"    {s}")
    print(f"{'='*50}")


if __name__ == '__main__':
    main()
