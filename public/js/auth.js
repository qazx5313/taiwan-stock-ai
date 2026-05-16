// ═══════════════════════════════════════════════
// auth.js — 登入、註冊、帳號管理
// ═══════════════════════════════════════════════

var currentUser = null;

// ── 開啟/關閉 Auth Modal ──
function openAuth(mode){
  switchAuthTab(mode || 'login');
  document.getElementById('auth-modal').classList.add('open');
}
function closeAuth(){
  document.getElementById('auth-modal').classList.remove('open');
}
function switchAuthTab(mode){
  document.getElementById('auth-login').style.display    = mode==='login'    ? '' : 'none';
  document.getElementById('auth-register').style.display = mode==='register' ? '' : 'none';
  document.getElementById('tab-login-btn').classList.toggle('active', mode==='login');
  document.getElementById('tab-reg-btn').classList.toggle('active',   mode==='register');
  document.getElementById('auth-modal-title').textContent = mode==='login' ? '登入帳號' : '申請會員';
}

// ── 登入 ──
async function doLogin(){
  var username = (document.getElementById('login-username').value || '').trim().toLowerCase();
  var pass     = document.getElementById('login-pass').value;
  var errEl    = document.getElementById('login-err');
  errEl.style.color = 'var(--red)';
  errEl.textContent = '';

  if(!username || !pass){ errEl.textContent = '請填寫用戶名稱與密碼'; return; }

  // 管理員帳號（hardcoded，不需資料庫）
  if(username === 'admin' && pass === 'admin123'){
    currentUser = {
      id: 0, username:'admin', display:'管理員', role:'admin', status:'active',
      perms:{ dashboard:true, signals:true, robots:true, report:true },
      expiry: null,
    };
    saveLocal('current_session', currentUser);
    closeAuth(); enterApp(); return;
  }

  var users = await loadAllUsers();
  var found  = users.find(function(u){ return u.username === username; });

  if(!found){ errEl.textContent = '找不到此用戶名稱'; return; }

  var status = found.status || 'pending';
  if(status === 'pending'){  errEl.textContent = '帳號審核中，請等待管理員開通'; return; }
  if(status === 'inactive'){ errEl.textContent = '帳號已停用，請聯絡管理員'; return; }
  if(found.password !== hashPass(pass)){ errEl.textContent = '密碼錯誤'; return; }

  if(found.expiry){
    var exp = new Date(found.expiry);
    if(exp < new Date()){ errEl.textContent = '使用期限已到期，請聯絡管理員'; return; }
  }

  currentUser = {
    id:      found.id,
    username:found.username,
    display: found.display || found.username,
    role:    found.role    || 'member',
    status:  found.status,
    perms:   found.perms   || { dashboard:true, signals:false, robots:false, report:true },
    expiry:  found.expiry  || null,
  };
  saveLocal('current_session', currentUser);
  closeAuth();
  enterApp();
}

// ── 申請會員 ──
async function doRegister(){
  var username = (document.getElementById('reg-username').value || '').trim().toLowerCase();
  var display  = (document.getElementById('reg-display').value  || '').trim();
  var pass     = document.getElementById('reg-pass').value;
  var pass2    = document.getElementById('reg-pass2').value;
  var errEl    = document.getElementById('reg-err');
  errEl.style.color = 'var(--red)';
  errEl.textContent = '';

  if(!username || !display || !pass){ errEl.textContent = '請填寫所有欄位'; return; }
  if(!/^[a-z0-9_]{4,20}$/.test(username)){ errEl.textContent = '用戶名稱只能用小寫英文、數字、底線，4～20字元'; return; }
  if(pass.length < 6){ errEl.textContent = '密碼至少6位'; return; }
  if(pass !== pass2){ errEl.textContent = '兩次密碼不一致'; return; }

  var users = await loadAllUsers();
  if(users.find(function(u){ return u.username === username; })){
    errEl.textContent = '此用戶名稱已被使用，請換一個'; return;
  }

  var newUser = {
    username:   username,
    display:    display,
    password:   hashPass(pass),
    role:       'member',
    status:     'pending',
    perms:      { dashboard:false, signals:false, robots:false, report:false },
    expiry:     null,
    created_at: new Date().toISOString(),
  };

  var ok = await saveUserRecord(newUser);
  if(ok){
    errEl.style.color = 'var(--green)';
    errEl.textContent = '申請成功！請等待管理員審核開通後再登入。';
    document.getElementById('reg-username').value = '';
    document.getElementById('reg-display').value  = '';
    document.getElementById('reg-pass').value     = '';
    document.getElementById('reg-pass2').value    = '';
  } else {
    errEl.textContent = '申請失敗，請稍後再試';
  }
}

// ── 進入主程式 ──
function enterApp(){
  document.getElementById('landing-page').style.display = 'none';
  document.getElementById('main-app').classList.add('visible');
  var u = currentUser;
  document.getElementById('user-name-badge').textContent = u.display || u.username;
  document.getElementById('user-avatar').textContent     = (u.display || u.username).charAt(0).toUpperCase();
  document.getElementById('st-user').textContent         = u.display || u.username;

  // 只有管理員才顯示管理後台按鈕
  var adminBtn = document.getElementById('admin-nav-btn');
  if(adminBtn) adminBtn.style.display = (u.role === 'admin') ? '' : 'none';

  // 根據權限顯示/隱藏導覽按鈕
  applyNavPermissions(u);

  loadKeysToForm();
  updateStatusBar();
  startClock();
  watchlist = loadLocal('tw_watchlist', []);
  renderMarketStrip();
  renderDashTable();
  renderFullTable();
  renderRobotCards();
  initReport();
  initAdmin();
  renderProfile();
  document.getElementById('st-count').textContent = (typeof stocks !== 'undefined' ? stocks.length : 0) || '0';
  toast('歡迎回來，' + (u.display || u.username) + '！');
}

// 根據用戶權限控制導覽列可見性
function applyNavPermissions(u){
  var perms = u.perms || {};
  var isAdmin = u.role === 'admin';

  // 導覽按鈕對應 tab
  var navMap = {
    'nav-signals':  'signals',
    'nav-robots':   'robots',
    'nav-report':   'report',
  };
  Object.keys(navMap).forEach(function(btnId){
    var el = document.getElementById(btnId);
    if(!el) return;
    var perm = navMap[btnId];
    if(isAdmin || perms[perm]){
      el.style.display = '';
    } else {
      el.style.display = 'none';
    }
  });
}

// 檢查某 tab 是否有權限，無權限則顯示鎖定畫面
function checkPerm(perm){
  if(!currentUser) return false;
  if(currentUser.role === 'admin') return true;
  return !!(currentUser.perms && currentUser.perms[perm]);
}

function showAccessDenied(tabEl){
  tabEl.innerHTML = '<div class="access-denied">' +
    '<div class="access-denied-icon">🔒</div>' +
    '<div class="access-denied-title">無使用權限</div>' +
    '<div class="access-denied-sub">此功能需要管理員開通，請聯絡管理員申請開通權限</div>' +
    '</div>';
}

function doLogout(){
  currentUser = null;
  localStorage.removeItem('current_session');
  document.getElementById('main-app').classList.remove('visible');
  document.getElementById('landing-page').style.display = 'flex';
  toast('已登出');
}

// ── Supabase 用戶 CRUD ──
async function loadAllUsers(){
  var sbUrl = getSBUrl(); var sbKey = getSBKey();
  if(sbUrl && sbKey){
    try{
      var r = await fetch(sbUrl + '/rest/v1/platform_users?select=*&order=created_at.desc', {
        headers:{ 'apikey':sbKey, 'Authorization':'Bearer '+sbKey }
      });
      if(r.ok){
        var data = await r.json();
        if(Array.isArray(data)){ saveLocal('platform_users', data); return data; }
      }
    } catch(e){ console.warn('loadUsers:', e.message); }
  }
  return loadLocal('platform_users', []);
}

async function saveUserRecord(user){
  var sbUrl = getSBUrl(); var sbKey = getSBKey();
  if(sbUrl && sbKey){
    try{
      var r = await fetch(sbUrl + '/rest/v1/platform_users', {
        method: 'POST',
        headers:{ 'apikey':sbKey, 'Authorization':'Bearer '+sbKey,
          'Content-Type':'application/json', 'Prefer':'return=representation' },
        body: JSON.stringify(user)
      });
      if(r.ok || r.status === 201){
        var saved = await r.json();
        var users = loadLocal('platform_users', []);
        users.push(Array.isArray(saved) ? saved[0] : saved);
        saveLocal('platform_users', users);
        return true;
      }
      console.warn('saveUser HTTP', r.status);
    } catch(e){ console.warn('saveUser:', e.message); }
  }
  // localStorage fallback
  var users = loadLocal('platform_users', []);
  user.id = Date.now();
  users.push(user);
  saveLocal('platform_users', users);
  return true;
}

async function updateUserRecord(id, patch){
  var sbUrl = getSBUrl(); var sbKey = getSBKey();
  if(sbUrl && sbKey){
    try{
      var r = await fetch(sbUrl + '/rest/v1/platform_users?id=eq.' + id, {
        method: 'PATCH',
        headers:{ 'apikey':sbKey, 'Authorization':'Bearer '+sbKey,
          'Content-Type':'application/json', 'Prefer':'return=minimal' },
        body: JSON.stringify(patch)
      });
      if(r.ok){
        var users = loadLocal('platform_users', []);
        var idx = users.findIndex(function(u){ return String(u.id) === String(id); });
        if(idx >= 0) Object.assign(users[idx], patch);
        saveLocal('platform_users', users);
        return true;
      }
    } catch(e){ console.warn('updateUser:', e.message); }
  }
  var users = loadLocal('platform_users', []);
  var idx = users.findIndex(function(u){ return String(u.id) === String(id); });
  if(idx >= 0){ Object.assign(users[idx], patch); saveLocal('platform_users', users); }
  return true;
}

// ── 管理員：帳號管理 ──
function openNewUserModal(){ document.getElementById('new-user-modal').classList.add('open'); }

async function grantUserAccess(){
  var username = (document.getElementById('nu-username').value || '').trim().toLowerCase();
  var role     = document.getElementById('nu-role').value;
  var days     = parseInt(document.getElementById('nu-days').value);
  var perms    = {
    dashboard: document.getElementById('perm-dashboard').checked,
    signals:   document.getElementById('perm-signals').checked,
    robots:    document.getElementById('perm-robots').checked,
    report:    document.getElementById('perm-report').checked,
  };
  var errEl = document.getElementById('nu-err');
  errEl.style.color = 'var(--red)'; errEl.textContent = '';
  if(!username){ errEl.textContent = '請填入用戶名稱'; return; }

  var users = await loadAllUsers();
  var found = users.find(function(u){ return u.username === username; });
  if(!found){ errEl.textContent = '找不到此用戶名稱（用戶需先申請才能開通）'; return; }

  var expiry = (days === 9999) ? null : new Date(Date.now() + days*86400000).toISOString().split('T')[0];
  await updateUserRecord(found.id, { role:role, status:'active', expiry:expiry, perms:perms });

  document.getElementById('new-user-modal').classList.remove('open');
  renderUserTable();
  toast('已開通 ' + (found.display||found.username) + ' · ' + role + ' · ' + (days===9999?'永久':days+'天'));
}

async function renderUserTable(){
  var users = await loadAllUsers();
  var nonAdmin = users.filter(function(u){ return u.username !== 'admin'; });
  var countEl = document.getElementById('user-count');
  if(countEl) countEl.textContent = nonAdmin.length;

  var roleLabel = { admin:'管理員', vip:'VIP', member:'一般' };
  var rows = nonAdmin.map(function(u){
    var expDate  = u.expiry ? new Date(u.expiry) : null;
    var daysLeft = expDate  ? Math.ceil((expDate - Date.now()) / 86400000) : 9999;
    var isActive = u.status === 'active' && (daysLeft > 0 || daysLeft === 9999);
    var permsStr = Object.entries(u.perms || {})
      .filter(function(e){ return e[1]; })
      .map(function(e){ return ({dashboard:'儀表板',signals:'選股',robots:'機器人',report:'報告'}[e[0]]||e[0]); })
      .join('、') || '—';
    var uid   = escHtml(String(u.id || ''));
    var ustat = escHtml(u.status || 'pending');
    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td><div style="font-weight:500;">' + escHtml(u.display||'—') + '</div></td>' +
      '<td style="font-family:var(--mono);font-size:11px;color:var(--accent);">' + escHtml(u.username||'—') + '</td>' +
      '<td><span class="badge ' + (u.role==='admin'?'b-admin':u.role==='vip'?'b-strong':'b-wait') + '">' + (roleLabel[u.role]||u.role) + '</span></td>' +
      '<td><span class="badge ' + (ustat==='pending'?'b-wait':isActive?'b-break':'b-risk') + '">' + (ustat==='pending'?'待審核':isActive?'有效':'停用') + '</span></td>' +
      '<td style="font-family:var(--mono);font-size:10px;">' + ((u.created_at||'').split('T')[0]||'—') + '</td>' +
      '<td style="font-family:var(--mono);font-size:10px;">' + (u.expiry||'永久') + '</td>' +
      '<td style="font-family:var(--mono);">' + (daysLeft===9999?'∞':daysLeft>0?daysLeft+'天':'已到期') + '</td>' +
      '<td style="font-size:10px;color:var(--text2);">' + permsStr + '</td>' +
      '<td><div style="display:flex;gap:4px;">' +
        '<button class="btn btn-sm" data-uid="' + uid + '" onclick="quickGrant(this.dataset.uid)">開通設定</button>' +
        '<button class="btn-d btn-sm" data-uid="' + uid + '" data-status="' + ustat + '" onclick="toggleUserStatus(this.dataset.uid,this.dataset.status)">' + (isActive?'停用':'啟用') + '</button>' +
      '</div></td>';
    return tr.outerHTML;
  });

  var tbody = document.getElementById('user-table-body');
  if(tbody) tbody.innerHTML = rows.length ? rows.join('') : '<tr><td colspan="9" class="empty">尚無用戶，等待有人申請會員</td></tr>';
}

async function quickGrant(id){
  var users = await loadAllUsers();
  var u = users.find(function(x){ return String(x.id) === String(id); });
  if(!u) return;
  // Pre-fill the modal
  document.getElementById('nu-username').value = u.username;
  openNewUserModal();
}

async function toggleUserStatus(id, currentStatus){
  var newStatus = currentStatus === 'active' ? 'inactive' : 'active';
  await updateUserRecord(id, { status: newStatus });
  renderUserTable();
  toast(newStatus === 'active' ? '已啟用' : '已停用');
}

// ── Profile 頁面 ──
function renderProfile(){
  if(!currentUser) return;
  var u = currentUser;
  var avatarEl = document.getElementById('profile-avatar-big');
  var nameEl   = document.getElementById('profile-name');
  var unameEl  = document.getElementById('profile-uname');
  var roleEl   = document.getElementById('profile-role');

  if(avatarEl) avatarEl.textContent = (u.display||u.username||'U').charAt(0).toUpperCase();
  if(nameEl)   nameEl.textContent   = u.display || u.username || '—';
  if(unameEl)  unameEl.textContent  = '@' + (u.username || '—');

  var roleLabel = {admin:'管理員', vip:'VIP 會員', member:'一般會員'};
  var roleClass = {admin:'b-admin', vip:'b-strong', member:'b-wait'};
  if(roleEl){ roleEl.textContent = roleLabel[u.role]||'一般會員'; roleEl.className = 'badge '+(roleClass[u.role]||'b-wait'); }

  var detailEl = document.getElementById('profile-details');
  if(detailEl) detailEl.innerHTML =
    '<div class="cfg-row"><span class="cfg-lbl">用戶名稱</span><span class="cfg-val">'+escHtml(u.username)+'</span></div>'+
    '<div class="cfg-row"><span class="cfg-lbl">角色</span><span class="cfg-val">'+(roleLabel[u.role]||'一般')+'</span></div>'+
    '<div class="cfg-row"><span class="cfg-lbl">到期日</span><span class="cfg-val">'+(u.expiry||'永久')+'</span></div>';

  var permsMap = { dashboard:'儀表板', signals:'爆升選股', robots:'策略機器人', report:'每日報告' };
  var permsEl  = document.getElementById('profile-perms');
  if(permsEl) permsEl.innerHTML = '<div class="perm-grid">' +
    Object.entries(permsMap).map(function(e){
      var has = (u.role==='admin') || !!(u.perms && u.perms[e[0]]);
      return '<div class="perm-item"><span class="perm-label">'+e[1]+'</span>' +
        '<span class="perm-status '+(has?'perm-on':'perm-off')+'">'+(has?'✓ 開放':'✕ 未開放')+'</span></div>';
    }).join('') + '</div>';

  var expDate  = u.expiry ? new Date(u.expiry) : null;
  var daysLeft = expDate  ? Math.ceil((expDate - Date.now()) / 86400000) : 9999;
  var expiryEl = document.getElementById('profile-expiry');
  if(expiryEl) expiryEl.innerHTML =
    '<div style="font-family:var(--mono);font-size:20px;font-weight:700;color:'+
    (daysLeft>30?'var(--green)':daysLeft>7?'var(--gold)':'var(--red)')+';">'+
    (daysLeft===9999?'∞ 永久':daysLeft+'天')+'</div>'+
    '<div style="font-size:10px;color:var(--text3);margin-top:4px;">'+(u.expiry?'到期：'+u.expiry:'無使用期限')+'</div>';
}
