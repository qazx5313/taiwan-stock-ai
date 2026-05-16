"""
台股AI量化平台 - 每日完整掃描腳本
================================================
修正版：用 Supabase 記錄掃描進度，避免重複掃描

批次規劃：
  每天分3個時段執行，每批最多290檔（580次API）
  進度存在 Supabase scan_progress 表
  下次執行時從上次結束的位置繼續

  批次1 (15:30) → 股票清單第 1   ~ 290 檔
  批次2 (16:30) → 股票清單第 291 ~ 580 檔
  批次3 (17:30) → 股票清單第 581 ~ 870 檔

  若當天3批都跑完仍有剩餘，隔天繼續
  新的一天自動從頭開始
"""

import os, json, time, requests
from datetime import datetime, timedelta

# ── 環境變數 ──
FINMIND_TOKEN = os.environ.get('FINMIND_TOKEN', '')
SUPABASE_URL  = os.environ.get('SUPABASE_URL',  '')
SUPABASE_KEY  = os.environ.get('SUPABASE_KEY',  '')
FORCE_FULL    = os.environ.get('FORCE_FULL', 'false').lower() == 'true'
# 手動指定從第幾檔開始（0=自動接續）
MANUAL_START  = int(os.environ.get('MANUAL_START', '0'))
FINMIND_URL_  = 'https://api.finmindtrade.com/api/v4/data'

# ── 速率控制 ──
RATE_SLEEP   = 7     # 每次請求間隔7秒（保守）
MAX_PER_HOUR = 580   # 每小時上限580次（留緩衝）
PER_BATCH    = 290   # 每批股票數

api_count  = 0
hour_start = time.time()


# ════════════════════════════════════════════
# Supabase 工具
# ════════════════════════════════════════════
def sb_headers():
    return {
        'apikey':        SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type':  'application/json',
    }

def sb_get(path, params=''):
    if not SUPABASE_URL: return []
    try:
        r = requests.get(
            f"{SUPABASE_URL}/rest/v1/{path}{'?'+params if params else ''}",
            headers=sb_headers(), timeout=15
        )
        return r.json() if r.ok else []
    except Exception as e:
        print(f"  Supabase GET 失敗: {e}")
        return []

def sb_upsert(path, data, conflict_col='symbol,date'):
    if not SUPABASE_URL: return False
    try:
        r = requests.post(
            f"{SUPABASE_URL}/rest/v1/{path}?on_conflict={conflict_col}",
            headers={**sb_headers(), 'Prefer': 'resolution=merge-duplicates,return=minimal'},
            json=data, timeout=30
        )
        return r.status_code in (200, 201)
    except Exception as e:
        print(f"  Supabase upsert 失敗: {e}")
        return False

def sb_upsert_progress(progress):
    """記錄今日掃描進度"""
    if not SUPABASE_URL: return
    try:
        requests.post(
            f"{SUPABASE_URL}/rest/v1/scan_progress?on_conflict=scan_date",
            headers={**sb_headers(), 'Prefer': 'resolution=merge-duplicates,return=minimal'},
            json=progress, timeout=15
        )
    except Exception as e:
        print(f"  進度記錄失敗: {e}")

def sb_get_progress(today):
    """取得今日掃描進度"""
    rows = sb_get('scan_progress', f'scan_date=eq.{today}&limit=1')
    if rows and len(rows) > 0:
        return rows[0]
    return None


# ════════════════════════════════════════════
# API 請求（帶速率控制）
# ════════════════════════════════════════════
def api_call(params):
    global api_count, hour_start

    elapsed = time.time() - hour_start
    if elapsed >= 3600:
        print(f"  新一小時，重置計數（舊: {api_count}）")
        api_count  = 0
        hour_start = time.time()

    if api_count >= MAX_PER_HOUR:
        wait = int(3600 - elapsed) + 30
        print(f"  達速率上限 {api_count}，等待 {wait} 秒...")
        time.sleep(wait)
        api_count  = 0
        hour_start = time.time()

    if FINMIND_TOKEN:
        params['token'] = FINMIND_TOKEN

    for attempt in range(3):
        try:
            r = requests.get(FINMIND_URL_, params=params, timeout=20)
            api_count += 1
            if r.status_code == 429:
                print("  Rate limit hit, 等待60秒...")
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
            if attempt == 2: raise
            time.sleep(15)
    return []


# ════════════════════════════════════════════
# 股票清單（TaiwanStockInfo × 近期成交量）
# ════════════════════════════════════════════
def get_stock_list():
    cache_file = 'scripts/output/stock_list.json'
    today = datetime.now().strftime('%Y-%m-%d')

    # 今日快取直接用
    if os.path.exists(cache_file):
        with open(cache_file) as f:
            cached = json.load(f)
        if cached.get('date') == today and len(cached.get('stocks', {})) > 500:
            print(f"  使用快取股票清單（{len(cached['stocks'])} 檔）")
            return cached['stocks'], cached['sectors']

    # Step 1: 取基本資料
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
    print(f"  TaiwanStockInfo 共 {len(all_info)} 筆")

    # Step 2: 近10日有成交量（確保跨週末）
    print("過濾現在有在交易的股票（近10日成交量）...")
    end_date   = datetime.now()
    start_date = end_date - timedelta(days=10)
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
        print(f"  近10日有成交：{len(active_ids)} 檔")
    except Exception as e:
        print(f"  ⚠️ 取成交資料失敗: {e}，使用全部清單")
        active_ids = set(all_info.keys())

    # Step 3: 交叉比對
    stocks = {sid: all_info[sid] for sid in active_ids if sid in all_info}
    print(f"  ✅ 確認在交易中：{len(stocks)} 檔")

    os.makedirs('scripts/output', exist_ok=True)
    with open(cache_file, 'w', encoding='utf-8') as f:
        json.dump({'date': today, 'stocks': stocks, 'sectors': sectors}, f, ensure_ascii=False)
    return stocks, sectors


# ════════════════════════════════════════════
# K線 + 籌碼
# ════════════════════════════════════════════
def get_candles(symbol, days=120):
    end   = datetime.now()
    start = end - timedelta(days=days + 30)
    fmt   = lambda d: d.strftime('%Y-%m-%d')
    data  = api_call({
        'dataset':    'TaiwanStockPrice',
        'data_id':    symbol,
        'start_date': fmt(start),
        'end_date':   fmt(end),
    })
    result = []
    for d in data:
        try:
            c = float(d.get('close', 0) or 0)
            if c <= 0: continue
            result.append({
                'date':   d['date'],
                'open':   float(d.get('open', c)),
                'high':   float(d.get('max',  c)),
                'low':    float(d.get('min',  c)),
                'close':  c,
                'volume': int(d.get('Trading_Volume', 0) or 0),
            })
        except: continue
    return result

def get_chips(symbol):
    end   = datetime.now()
    start = end - timedelta(days=5)
    fmt   = lambda d: d.strftime('%Y-%m-%d')
    try:
        data = api_call({
            'dataset':    'TaiwanStockInstitutionalInvestorsBuySell',
            'data_id':    symbol,
            'start_date': fmt(start),
            'end_date':   fmt(end),
        })
        result = {'foreign': 0, 'trust': 0, 'dealer': 0}
        for d in data:
            try:
                net  = (int(d.get('buy',0) or 0)) - (int(d.get('sell',0) or 0))
                name = d.get('name', '')
                if   name == '外資':    result['foreign'] += net
                elif name == '投信':    result['trust']   += net
                elif '自營' in name:   result['dealer']  += net
            except: continue
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
    return round((ema(closes, fast) - ema(closes, slow)) * 0.1, 3)

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
    had_lu = any((c['close']-c['open'])/(c['open'] or 1) > 0.095 for c in candles[-20:])
    lc     = candles[-1]
    body_high  = max(lc['open'], lc['close'])
    upper_shad = (lc['high'] - body_high) / (body_high or 1)
    prev_c = closes[-2] if len(closes) >= 2 else closes[-1]
    chg    = round((price / (prev_c or 1) - 1) * 100, 2)
    vol_b  = round(price * vol / 1e8, 1)

    # 技術面 /35
    tech = 0
    if price > ma20:  tech += 4
    if price > ma60:  tech += 2
    if ma5   > ma20:  tech += 2
    if 50 < rsi < 70: tech += 7
    elif rsi >= 70:   tech += 3
    elif rsi > 45:    tech += 3
    if kd_k > kd_d and kd_k > 50: tech += 7
    elif kd_k > kd_d:              tech += 4
    if macd_h > 0:    tech += 7
    elif macd_h > -0.5: tech += 3
    if price >= high20 * 0.99:   tech += 6
    elif price >= high20 * 0.95: tech += 3
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

    if   risk <= 5:                                sig, stype = '假突破風險', 'risk'
    elif tech>=28 and volR>1.5 and price>=ma20:    sig, stype = '強勢突破',   'break'
    elif chip>=22 and tech>=22:                    sig, stype = '主力建倉',   'whale'
    elif volR>1.5 and tech>=20:                    sig, stype = '爆量突破',   'break'
    elif tech>=22 and kd_k>kd_d:                   sig, stype = '量價轉強',   'strong'
    elif ai >= 70:                                 sig, stype = '短線偏多',   'strong'
    elif rsi > 50:                                 sig, stype = '等待回測',   'wait'
    else:                                          sig, stype = '觀察中',     'wait'

    entry    = round(price * 0.995, 1)
    sl_ma    = round(ma20 * 0.99, 1) if ma20 > 0 else 0
    sl_pct   = round(entry * 0.93, 1)
    sl       = sl_ma if (sl_ma > 0 and sl_ma < entry) else sl_pct
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
        'entry_price': entry,
        'target1':     round(price * 1.06, 1),
        'target2':     round(price * 1.12, 1),
        'stop_loss':   sl,
        'risk_level':  risk_lvl,
        'tech_detail': {
            'ma5':round(ma5,1), 'ma20':round(ma20,1), 'ma60':round(ma60,1),
            'rsi':round(rsi,1), 'kd_k':kd_k, 'kd_d':kd_d, 'macd_hist':macd_h
        },
        'chip_detail': {
            'foreign':chips['foreign'], 'trust':chips['trust'], 'dealer':chips['dealer']
        },
        'reason': (
            f"技術{tech}/35，籌碼{chip}/30，量價{vs}/20，風控{risk}/15。"
            + (f"外資{'買' if chips['foreign']>0 else '賣'}超{abs(chips['foreign'])}億，" if chips['foreign']!=0 else '')
            + f"RSI {round(rsi,0):.0f}，KD {'黃金' if kd_k>kd_d else '死亡'}交叉。"
        ),
    }


# ════════════════════════════════════════════
# 批次寫入 Supabase
# ════════════════════════════════════════════
def save_batch(records):
    if not records or not SUPABASE_URL: return
    for i in range(0, len(records), 50):
        chunk = records[i:i+50]
        ok = sb_upsert('stock_scores', chunk, 'symbol,date')
        if ok:
            print(f"  ✅ 寫入 {i+len(chunk)} 筆")
        else:
            print(f"  ⚠️  寫入失敗，稍後重試")
            time.sleep(5)
            sb_upsert('stock_scores', chunk, 'symbol,date')
        time.sleep(0.3)


# ════════════════════════════════════════════
# 主程式
# ════════════════════════════════════════════
def main():
    now   = datetime.now()
    today = now.strftime('%Y-%m-%d')

    print(f"{'='*55}")
    print(f"台股AI每日完整掃描  {now.strftime('%Y-%m-%d %H:%M')}")
    print(f"{'='*55}")
    print(f"FinMind Token : {'已設定' if FINMIND_TOKEN else '未設定（300次/hr上限）'}")
    print(f"Supabase      : {'已設定' if SUPABASE_URL else '未設定'}")

    os.makedirs('scripts/output', exist_ok=True)

    # ── 取得完整股票清單（有快取則用）──
    stocks_map, sectors_map = get_stock_list()
    all_codes = sorted(stocks_map.keys())  # 固定排序，確保批次不重複
    total     = len(all_codes)
    print(f"股票總數: {total} 檔")

    # ── 從 Supabase 讀取今日掃描進度 ──
    progress = sb_get_progress(today)

    if FORCE_FULL:
        # 強制全掃（管理員手動觸發）
        start_idx   = 0
        batch_label = 'FULL（強制全部）'
    elif MANUAL_START > 0:
        # 手動指定起始位置
        start_idx   = MANUAL_START - 1
        batch_label = f'手動從第 {MANUAL_START} 檔開始'
    elif progress and progress.get('scan_date') == today:
        # 今日已有進度，從上次結束的位置繼續
        start_idx   = int(progress.get('last_index', 0))
        scanned     = int(progress.get('scanned_count', 0))
        batch_label = f'接續批次（已掃 {scanned} 檔，從第 {start_idx+1} 檔繼續）'
        if start_idx >= total:
            print(f"今日所有股票已掃描完畢（{scanned}/{total}），結束。")
            return
    else:
        # 今日全新開始
        start_idx   = 0
        batch_label = '今日第一批（全新開始）'

    # 計算本批結束位置
    end_idx    = min(start_idx + PER_BATCH, total)
    scan_codes = all_codes[start_idx:end_idx]

    if not scan_codes:
        print("無需掃描的股票，結束。")
        return

    est_api = len(scan_codes) * 2
    est_min = len(scan_codes) * 2 * RATE_SLEEP // 60
    print(f"\n本批: {batch_label}")
    print(f"掃描範圍: 第 {start_idx+1} ~ {end_idx} 檔（共 {len(scan_codes)} 檔）")
    print(f"預估: {est_api} 次API，約 {est_min} 分鐘")
    print(f"整體進度: {start_idx}/{total} ({start_idx/total*100:.1f}%)\n")

    results = []
    errors  = []

    for i, code in enumerate(scan_codes):
        name   = stocks_map.get(code, code)
        sector = sectors_map.get(code, '—')
        abs_idx = start_idx + i  # 在全部清單中的絕對位置
        pct     = (abs_idx + 1) / total * 100

        print(f"[{i+1:3d}/{len(scan_codes)}] 全體{pct:5.1f}%  {name}({code})", end='  ')

        try:
            candles = get_candles(code)
            if len(candles) < 20:
                print("K線不足，跳過")
                continue

            chips  = get_chips(code)
            record = compute_score(code, name, sector, candles, chips)

            if record:
                results.append(record)
                risk_icon = {'低':'🟢','中':'🟡','高':'🔴'}.get(record['risk_level'],'⚪')
                print(f"AI:{record['total_score']:3d}  {record['signal'][:6]}  {risk_icon}  API:{api_count}")
            else:
                print("評分失敗")

        except Exception as e:
            errors.append({'code': code, 'error': str(e)})
            print(f"❌ {str(e)[:40]}")

        # 每50筆存一次 + 更新進度
        if len(results) > 0 and len(results) % 50 == 0:
            print(f"\n  → 中途存檔 {len(results)} 筆...")
            save_batch(results[-50:])
            # 更新 Supabase 進度
            sb_upsert_progress({
                'scan_date':     today,
                'last_index':    abs_idx + 1,
                'scanned_count': (int(progress.get('scanned_count', 0)) if progress else 0) + len(results),
                'total_count':   total,
                'updated_at':    datetime.now().isoformat(),
            })

    # 存入剩餘資料
    remainder = len(results) % 50
    if remainder > 0:
        save_batch(results[-remainder:])

    # 更新最終進度
    final_scanned = (int(progress.get('scanned_count', 0)) if progress else 0) + len(results)
    sb_upsert_progress({
        'scan_date':     today,
        'last_index':    end_idx,
        'scanned_count': final_scanned,
        'total_count':   total,
        'completed':     end_idx >= total,
        'updated_at':    datetime.now().isoformat(),
    })

    # 排序
    results.sort(key=lambda x: x['total_score'], reverse=True)

    # 摘要
    summary = {
        'batch':          batch_label,
        'scan_date':      today,
        'scanned_this_batch': len(results),
        'total_scanned':  final_scanned,
        'total_stocks':   total,
        'progress_pct':   round(end_idx / total * 100, 1),
        'api_calls':      api_count,
        'errors':         len(errors),
        'top10': [
            f"{r['name']}({r['symbol']}) AI:{r['total_score']} {r['signal']}"
            for r in results[:10]
        ],
    }

    with open('scripts/output/summary.json', 'w', encoding='utf-8') as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)

    print(f"\n{'='*55}")
    print(f"本批掃完: {len(results)} 檔")
    print(f"今日累計: {final_scanned}/{total} ({summary['progress_pct']}%)")
    print(f"API消耗:  {api_count} 次")
    print(f"錯誤:     {len(errors)}")
    if end_idx < total:
        print(f"下批從:   第 {end_idx+1} 檔繼續")
    else:
        print(f"✅ 今日全部掃描完畢！")
    print("Top 10:")
    for s in summary['top10']:
        print(f"  {s}")
    print(f"{'='*55}")


if __name__ == '__main__':
    main()
