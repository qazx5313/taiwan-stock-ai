"""
robot_run.py — 盤後自動執行5個機器人策略
由 GitHub Actions 在 daily_scan.py 完成後呼叫
讀取 Supabase stock_scores → 執行進出場判斷 → 寫回 robot_trades 表
"""

import os, json, time, requests
from datetime import datetime, date

SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_KEY = os.environ.get('SUPABASE_KEY', '')
ROBOT_CAPITAL = 1_000_000  # 每人初始100萬

ROBOTS_DEF = [
    {
        'id': 'peter', 'name': 'Peter', 'strategy': 'KD指標策略',
        'stop_loss': 6, 'take_profit': 15, 'max_positions': 3,
        'entry': lambda s: (
            s.get('kd_k',0) > s.get('kd_d',0) and
            s.get('kd_k',0) > 50 and
            s.get('macd_hist',0) > 0 and
            40 < s.get('rsi',50) < 75 and
            s.get('vol_ratio',0) > 1.3 and
            s.get('risk_level','高') != '高'
        ),
    },
    {
        'id': 'iris', 'name': 'Iris', 'strategy': '均線多頭策略',
        'stop_loss': 5, 'take_profit': 20, 'max_positions': 2,
        'entry': lambda s: (
            s.get('ma5',0) > s.get('ma20',0) and
            s.get('price',0) > s.get('ma60',0) and
            s.get('vol_ratio',0) > 1.2 and
            s.get('ma20',0) > 0 and
            ((s.get('price',0) / s.get('ma20',1)) - 1) < 0.08 and
            50 < s.get('rsi',50) < 70 and
            s.get('risk_level','高') == '低'
        ),
    },
    {
        'id': 'max', 'name': 'Max', 'strategy': '爆量突破策略',
        'stop_loss': 3, 'take_profit': 10, 'max_positions': 4,
        'entry': lambda s: (
            s.get('vol_ratio',0) > 2.0 and
            s.get('signal_type','') == 'break' and
            s.get('rsi',50) < 78 and
            s.get('macd_hist',0) > 0 and
            (s.get('foreign',0) > 0 or s.get('trust',0) > 0) and
            s.get('total_score',0) >= 70
        ),
    },
    {
        'id': 'luna', 'name': 'Luna', 'strategy': '低風險防守策略',
        'stop_loss': 5, 'take_profit': 12, 'max_positions': 2,
        'entry': lambda s: (
            (s.get('foreign',0) > 0 or s.get('trust',0) > 0) and
            50 < s.get('rsi',50) < 65 and
            s.get('price',0) > s.get('ma20',0) and
            s.get('risk_level','高') == '低' and
            s.get('total_score',0) >= 65
        ),
    },
    {
        'id': 'rex', 'name': 'Rex', 'strategy': '動能加速策略',
        'stop_loss': 7, 'take_profit': 18, 'max_positions': 3,
        'entry': lambda s: (
            s.get('macd_hist',0) > 0.5 and
            60 <= s.get('rsi',50) < 75 and
            s.get('price',0) > s.get('ma20',0) and
            s.get('total_score',0) >= 72 and
            s.get('risk_level','高') != '高'
        ),
    },
]

def sb_get(path, params=''):
    r = requests.get(
        f"{SUPABASE_URL}/rest/v1/{path}{'?'+params if params else ''}",
        headers={'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY},
        timeout=15
    )
    return r.json() if r.ok else []

def sb_post(path, data, upsert_on=None):
    prefer = f'resolution=merge-duplicates,return=minimal'
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    if upsert_on:
        url += f"?on_conflict={upsert_on}"
    r = requests.post(url,
        headers={'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY,
                 'Content-Type': 'application/json', 'Prefer': prefer},
        json=data, timeout=15
    )
    return r.ok

def sb_patch(path, params, data):
    r = requests.patch(
        f"{SUPABASE_URL}/rest/v1/{path}?{params}",
        headers={'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY,
                 'Content-Type': 'application/json', 'Prefer': 'return=minimal'},
        json=data, timeout=15
    )
    return r.ok

def get_robot_state(robot_id):
    rows = sb_get('robot_states', f'robot_id=eq.{robot_id}&limit=1')
    if rows and len(rows) > 0:
        state = rows[0]
        state['holdings'] = json.loads(state.get('holdings_json') or '[]')
        return state
    return {
        'robot_id':   robot_id,
        'capital':    ROBOT_CAPITAL,
        'holdings':   [],
        'total_pnl':  0,
        'total_trades': 0,
        'wins':       0,
    }

def save_robot_state(state):
    state_copy = dict(state)
    state_copy['holdings_json'] = json.dumps(state_copy.pop('holdings', []), ensure_ascii=False)
    state_copy['updated_at'] = datetime.now().isoformat()
    sb_post('robot_states', state_copy, upsert_on='robot_id')

def run_all_robots():
    today = date.today().isoformat()
    dow   = datetime.now().weekday()
    if dow >= 5:
        print("週末，跳過機器人執行")
        return

    # 取今日股票評分（只取有效資料）
    scores_raw = sb_get('stock_scores', f'date=eq.{today}&total_score=gte.60&order=total_score.desc&limit=200')
    if not scores_raw:
        print(f"今日 {today} 無股票評分資料，跳過機器人")
        return

    # 解析 tech_detail / chip_detail
    def parse_stock(row):
        td = {}
        cd = {}
        try: td = json.loads(row.get('tech_detail') or '{}')
        except: pass
        try: cd = json.loads(row.get('chip_detail') or '{}')
        except: pass
        return {
            'symbol':      row.get('symbol',''),
            'name':        row.get('name',''),
            'price':       float(row.get('price') or 0),
            'total_score': int(row.get('total_score') or 0),
            'signal_type': row.get('signal_type',''),
            'risk_level':  row.get('risk_level','高'),
            'entry_price': float(row.get('entry_price') or 0),
            'stop_loss':   float(row.get('stop_loss') or 0),
            'target1':     float(row.get('target1') or 0),
            # tech_detail 展開
            'ma5':         float(td.get('ma5') or 0),
            'ma20':        float(td.get('ma20') or 0),
            'ma60':        float(td.get('ma60') or 0),
            'rsi':         float(td.get('rsi') or 50),
            'kd_k':        float(td.get('kd_k') or 50),
            'kd_d':        float(td.get('kd_d') or 50),
            'macd_hist':   float(td.get('macd_hist') or 0),
            'vol_ratio':   float(row.get('volume_b') or 0),
            # chip_detail 展開
            'foreign':     int(cd.get('foreign') or 0),
            'trust':       int(cd.get('trust') or 0),
            'dealer':      int(cd.get('dealer') or 0),
        }

    stocks = [parse_stock(r) for r in scores_raw if float(r.get('price') or 0) > 0]
    stocks_map = {s['symbol']: s for s in stocks}
    print(f"今日股票資料：{len(stocks)} 檔")

    for rdef in ROBOTS_DEF:
        print(f"\n── {rdef['name']} ({rdef['strategy']}) ──")
        state = get_robot_state(rdef['id'])

        # 1. 出場檢查
        new_holdings = []
        for h in state['holdings']:
            cur = stocks_map.get(h['symbol'])
            cur_price = cur['price'] if cur else h['buy_price']
            pnl_pct   = (cur_price / h['buy_price'] - 1) * 100 if h['buy_price'] > 0 else 0
            hold_days = h.get('hold_days', 0) + 1

            exit_reason = None
            if pnl_pct <= -rdef['stop_loss']:
                exit_reason = f"停損-{rdef['stop_loss']}%出場"
            elif pnl_pct >= rdef['take_profit']:
                exit_reason = f"停利+{rdef['take_profit']}%出場"
            elif rdef['id'] == 'max' and hold_days >= 5 and pnl_pct < 2:
                exit_reason = "5日未達目標出場"

            if exit_reason:
                pnl = (cur_price - h['buy_price']) * h.get('shares',1) * 1000
                state['total_pnl']    += pnl
                state['total_trades'] += 1
                if pnl > 0: state['wins'] += 1
                state['capital']      += cur_price * h.get('shares',1) * 1000

                sb_post('robot_trades', {
                    'robot_id':   rdef['id'],
                    'symbol':     h['symbol'],
                    'name':       h.get('name',''),
                    'action':     '賣出',
                    'price':      cur_price,
                    'buy_price':  h['buy_price'],
                    'shares':     h.get('shares',1),
                    'pnl':        round(pnl),
                    'pnl_pct':    round(pnl_pct,1),
                    'reason':     exit_reason,
                    'hold_days':  hold_days,
                    'result':     '獲利' if pnl >= 0 else '虧損',
                    'trade_date': today,
                })
                print(f"  🔴 賣出 {h.get('name','')}({h['symbol']}) @ {cur_price} | {exit_reason} | PnL:{round(pnl/1000)}千")
            else:
                h['hold_days'] = hold_days
                new_holdings.append(h)

        state['holdings'] = new_holdings

        # 2. 進場篩選
        available = rdef['max_positions'] - len(state['holdings'])
        if available > 0:
            held_codes = {h['symbol'] for h in state['holdings']}
            candidates = [s for s in stocks
                if s['symbol'] not in held_codes
                and s['price'] > 0
                and rdef['entry'](s)
            ][:5]

            for s in candidates[:available]:
                ep     = s['entry_price'] or s['price'] * 0.995
                cost   = ep * 1 * 1000
                if cost > state['capital'] * 0.4: continue

                state['capital'] -= cost
                state['holdings'].append({
                    'symbol':    s['symbol'],
                    'name':      s['name'],
                    'buy_price': ep,
                    'buy_date':  today,
                    'shares':    1,
                    'hold_days': 0,
                    'sl':        round(ep * (1 - rdef['stop_loss']/100), 1),
                    'tp':        s['target1'] or round(ep * (1 + rdef['take_profit']/100), 1),
                })
                sb_post('robot_trades', {
                    'robot_id':   rdef['id'],
                    'symbol':     s['symbol'],
                    'name':       s['name'],
                    'action':     '買進',
                    'price':      ep,
                    'shares':     1,
                    'pnl':        None,
                    'reason':     f"{rdef['strategy']} 進場信號｜AI分{s['total_score']}",
                    'result':     '持有中',
                    'trade_date': today,
                })
                print(f"  🟢 買進 {s['name']}({s['symbol']}) @ {ep} | AI分{s['total_score']}")

        save_robot_state(state)
        wr = round(state['wins'] / state['total_trades'] * 100, 1) if state['total_trades'] > 0 else 0
        ret = round(state['total_pnl'] / ROBOT_CAPITAL * 100, 1)
        print(f"  持倉:{len(state['holdings'])} | 勝率:{wr}% | 報酬:{ret:+}% | 可用資金:{state['capital']/10000:.0f}萬")

if __name__ == '__main__':
    print(f"=== 機器人盤後自動執行 {datetime.now()} ===")
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("未設定 Supabase，跳過")
    else:
        run_all_robots()
    print("=== 完成 ===")
