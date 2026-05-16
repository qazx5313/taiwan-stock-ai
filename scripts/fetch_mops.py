"""
fetch_mops.py — 爬取公開資訊觀測站重大訊息
https://mops.twse.com.tw/

由 GitHub Actions 每日執行，結果存入 Supabase stock_news 表
支援：上市(sii) + 上櫃(otc) + 興櫃(rotc)

MOPS 重大訊息 API：
  POST https://mops.twse.com.tw/mops/web/ajax_t100sb06
  參數：TYPEK=sii/otc/rotc, year=民國年, month, day

回傳 HTML table，用 BeautifulSoup 解析
"""

import os, re, time, json, requests
from datetime import datetime, timedelta
from bs4 import BeautifulSoup

SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_KEY = os.environ.get('SUPABASE_KEY', '')

# ── Supabase 工具 ──
def sb_headers():
    return {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=minimal',
    }

def sb_upsert(table, data, conflict):
    if not SUPABASE_URL or not data: return False
    try:
        r = requests.post(
            f"{SUPABASE_URL}/rest/v1/{table}?on_conflict={conflict}",
            headers=sb_headers(), json=data, timeout=30
        )
        return r.status_code in (200, 201)
    except Exception as e:
        print(f"  Supabase error: {e}")
        return False

# ── AI 判斷多空（關鍵字分析）──
def ai_judge(title, content=''):
    text = (title + ' ' + content).lower()

    # 分類
    cat = '重大事件'
    if any(w in text for w in ['澄清','更正','非事實','說明']): cat = '澄清回應'
    elif any(w in text for w in ['營收','eps','每股','盈餘','財報','損益']): cat = '財務數據'
    elif any(w in text for w in ['董事','監察','股東會','法人代表','改選']): cat = '公司治理'
    elif any(w in text for w in ['法說','investor','業績發表']): cat = '法說會'

    # 利多關鍵字
    bull = ['獲利','新高','突破','簽約','合作','大單','訂單','量產','成長','超越',
            '創新','獲獎','推出新','合併','收購','上調','配息','增資','入選',
            '通過','核准','獲得','中標','得標','投資','擴廠','新客戶']
    # 利空關鍵字
    bear = ['虧損','虧','下滑','不如預期','下修','警示','處分','違規','罰款',
            '取消','裁員','停工','調查','訴訟','減資','下市','停止','撤銷',
            '未達','虧','損失','賠','延誤','召回']
    # 需注意
    watch = ['異動','更換','辭任','轉讓','質押','申報','更正','變更','異動']

    bull_n  = sum(1 for w in bull  if w in text)
    bear_n  = sum(1 for w in bear  if w in text)
    watch_n = sum(1 for w in watch if w in text)

    if bear_n >= 2:
        jtype,jlabel,impact = 'risk',  '⚠️ 高風險','高'
        reason = f"含多項利空訊號（{','.join(w for w in bear if w in text)[:30]}），需密切關注。"
    elif bear_n == 1:
        jtype,jlabel,impact = 'bear',  '偏利空',  '中'
        reason = f"含利空訊號，短期股價可能承壓，建議觀望。"
    elif bull_n >= 3:
        jtype,jlabel,impact = 'bull',  '偏利多',  '高'
        reason = f"多項利多信號（{','.join(w for w in bull if w in text)[:30]}），股價有望正面反應。"
    elif bull_n >= 1:
        jtype,jlabel,impact = 'bull',  '偏利多',  '中' if bull_n < 2 else '中高'
        reason = f"含利多訊號（{','.join(w for w in bull if w in text)[:20]}），股價有望正面反應。"
    elif watch_n >= 1:
        jtype,jlabel,impact = 'watch', '需注意',  '中'
        reason = f"含異動訊號，需觀察後續影響是否改變公司基本面。"
    else:
        jtype,jlabel,impact = 'neutral','中性',   '低'
        reason = f"一般性公告，對股價短期影響有限。"

    return dict(judge_type=jtype, judge_label=jlabel, impact=impact,
                category=cat, reason=reason)

# ── 爬取 MOPS 重大訊息 ──
def fetch_mops_news(date_str, typek='sii'):
    """
    date_str: 'YYYY-MM-DD'
    typek: 'sii'(上市) / 'otc'(上櫃) / 'rotc'(興櫃)
    """
    dt      = datetime.strptime(date_str, '%Y-%m-%d')
    roc_yr  = dt.year - 1911
    month   = dt.strftime('%m')
    day     = dt.strftime('%d')

    url = 'https://mops.twse.com.tw/mops/web/ajax_t100sb06'
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'zh-TW,zh;q=0.9',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': 'https://mops.twse.com.tw/mops/web/t100sb06',
        'Origin': 'https://mops.twse.com.tw',
    }
    data = {
        'encodeURIComponent': '1',
        'step':    '1',
        'firstin': '1',
        'off':     '1',
        'TYPEK':   typek,
        'year':    str(roc_yr),
        'month':   month,
        'day':     day,
    }

    try:
        r = requests.post(url, data=data, headers=headers, timeout=20)
        r.raise_for_status()
        return r.text
    except Exception as e:
        print(f"  MOPS {typek} {date_str} 失敗: {e}")
        return ''

def parse_mops_html(html, date_str, typek):
    """解析 MOPS HTML table，回傳公告列表"""
    if not html or 'ajax_t100sb06' in html.lower():
        return []

    soup    = BeautifulSoup(html, 'html.parser')
    records = []

    # MOPS 回傳的是一個 HTML table
    tables = soup.find_all('table')
    for table in tables:
        rows = table.find_all('tr')
        for row in rows[1:]:  # 跳過 header
            cells = row.find_all(['td','th'])
            if len(cells) < 5:
                continue
            texts = [c.get_text(strip=True) for c in cells]
            # 欄位：時間 | 公司代號 | 公司名稱 | 說明 | 主旨
            # 或：序號 | 時間 | 公司代號 | 公司名稱 | 主旨
            try:
                if len(texts) >= 5:
                    # 判斷欄位格式
                    if re.match(r'\d{2}:\d{2}', texts[0]):
                        # 格式1: 時間|代號|名稱|說明|主旨
                        t_time  = texts[0]
                        t_code  = texts[1]
                        t_name  = texts[2]
                        t_title = texts[4] if len(texts) > 4 else texts[3]
                        t_desc  = texts[3]
                    elif re.match(r'\d{2}:\d{2}', texts[1]):
                        # 格式2: 序號|時間|代號|名稱|主旨
                        t_time  = texts[1]
                        t_code  = texts[2]
                        t_name  = texts[3]
                        t_title = texts[4] if len(texts) > 4 else ''
                        t_desc  = ''
                    else:
                        continue

                    if not t_code or not t_title:
                        continue

                    judge = ai_judge(t_title, t_desc)
                    records.append({
                        'stock_id':    t_code,
                        'stock_name':  t_name,
                        'date':        date_str,
                        'time':        t_time,
                        'title':       t_title[:500],
                        'description': t_desc[:1000],
                        'link':        f'https://mops.twse.com.tw/mops/web/t100sb06',
                        'source':      f'MOPS-{typek}',
                        'judge_type':  judge['judge_type'],
                        'judge_label': judge['judge_label'],
                        'impact':      judge['impact'],
                        'category':    judge['category'],
                        'reason':      judge['reason'],
                    })
            except Exception as e:
                continue

    return records

def run():
    today = datetime.now()
    print(f"{'='*50}")
    print(f"MOPS 重大訊息爬蟲  {today.strftime('%Y-%m-%d %H:%M')}")
    print(f"Supabase: {'已設定' if SUPABASE_URL else '未設定'}")
    print(f"{'='*50}")

    all_records = []

    # 爬取近3天（週末補齊）
    for days_ago in range(0, 4):
        dt       = today - timedelta(days=days_ago)
        date_str = dt.strftime('%Y-%m-%d')

        # 跳過週六日
        if dt.weekday() >= 5:
            continue

        print(f"\n--- {date_str} ---")
        for typek in ['sii', 'otc']:
            print(f"  爬取 {typek}...", end=' ')
            html    = fetch_mops_news(date_str, typek)
            records = parse_mops_html(html, date_str, typek)
            print(f"{len(records)} 筆")
            all_records.extend(records)
            time.sleep(2)  # 避免太頻繁

    print(f"\n總計: {len(all_records)} 筆公告")

    if not all_records:
        print("無資料，可能 MOPS 格式改變或網站暫時無回應")
        return

    # 去重（同一天同公司同標題）
    seen    = set()
    unique  = []
    for r in all_records:
        key = f"{r['stock_id']}_{r['date']}_{r['title'][:30]}"
        if key not in seen:
            seen.add(key)
            unique.append(r)

    print(f"去重後: {len(unique)} 筆")

    # 存 Supabase
    if SUPABASE_URL:
        for i in range(0, len(unique), 50):
            chunk = unique[i:i+50]
            ok = sb_upsert('stock_news', chunk, 'stock_id,date,title')
            print(f"  {'✅' if ok else '⚠️'} 寫入 {i+len(chunk)}/{len(unique)} 筆")
            time.sleep(0.3)
    else:
        # 無 Supabase 時輸出 JSON 檔案（測試用）
        import os
        os.makedirs('scripts/output', exist_ok=True)
        with open('scripts/output/mops_news.json', 'w', encoding='utf-8') as f:
            json.dump(unique, f, ensure_ascii=False, indent=2)
        print(f"已輸出到 scripts/output/mops_news.json")

    # 印出統計
    from collections import Counter
    judges = Counter(r['judge_type'] for r in unique)
    print(f"\n判斷分佈: {dict(judges)}")
    print(f"高影響公告: {sum(1 for r in unique if r['impact'] in ['高','中高'])} 則")

    # Top 5
    print("\nTop 5 高影響公告:")
    top = [r for r in unique if r['impact'] in ['高','中高']][:5]
    for r in top:
        print(f"  [{r['judge_label']}] {r['stock_id']} {r['stock_name']}: {r['title'][:50]}")

if __name__ == '__main__':
    run()
