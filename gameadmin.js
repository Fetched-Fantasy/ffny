// GitHub Raw Link Authentication
const githubRawLink = "https://raw.githubusercontent.com/silentmason/farnous/main/FVRStaff.txt"; // Replace with your GitHub raw link

async function fetchAndAuthorizeEmailPassword(email, password) {
  try {
    const response = await fetch(githubRawLink);
    const text = await response.text();
    const authorizedPairs = text.split('\n').map(pair => pair.trim()); // Split by newline and trim whitespace

    const emailPasswordString = `${email}:${password}`;
    return authorizedPairs.includes(emailPasswordString);
  } catch (error) {
    console.error("Error fetching or parsing GitHub raw link:", error);
    return false; // Assume not authorized in case of an error
  }
}

function showToast(message, duration = 3000) {
    const toast = document.getElementById('offlineToast');
    const toastMessage = document.getElementById('offlineToastMessage');

    toastMessage.textContent = message;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, duration);
}

function readJSON(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch(e){ return []; }
}

function download(filename, text) {
  var a = document.createElement('a');
  a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(text);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function formatDate(ts) {
  if (!ts) return '';
  try { return new Date(ts).toLocaleString(); } catch(e) { return ts; }
}

function renderUsers(){
  var users = readJSON('ffny.users');
  var tbody = document.querySelector('#usersTable tbody');
  tbody.innerHTML = '';
  if (!users || users.length === 0) {
    var tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="4" class="muted">No users found</td>';
    tbody.appendChild(tr);
    return;
  }
  users.forEach(function(u, idx){
    var tr = document.createElement('tr');
    var isAdmin = !!u.isAdmin;
    tr.innerHTML = '<td>' + (u.username || '') + '</td>' +
                     '<td>' + (u.email || '') + '</td>' +
                     '<td>' + (u.createdAt ? new Date(u.createdAt).toLocaleString() : '') + '</td>' +
                     '<td class="actions">' +
                       '<button data-idx="'+idx+'" class="small exportUser">Export</button>' +
                       '<button data-idx="'+idx+'" class="small danger deleteUser">Delete</button>' +
                       (isAdmin ? '<button data-idx="'+idx+'" class="small" disabled>Admin</button>' : '<button data-idx="'+idx+'" class="small makeAdmin">Make Admin</button>') +
                     '</td>';
    tbody.appendChild(tr);
  });

  // attach handlers
  document.querySelectorAll('.exportUser').forEach(function(btn){
    btn.addEventListener('click', function(){
      var i = parseInt(btn.dataset.idx,10);
      var u = users[i];
      download('user_'+(u.username||'user')+'.json', JSON.stringify(u, null, 2));
    });
  });
  document.querySelectorAll('.deleteUser').forEach(function(btn){
    btn.addEventListener('click', function(){
      var i = parseInt(btn.dataset.idx,10);
      var u = users[i];
      if (!confirm('Delete user "' + (u.username||u.email||'') + '"? This cannot be undone.')) return;
      users.splice(i,1);
      localStorage.setItem('ffny.users', JSON.stringify(users));
      renderUsers();
    });
  });
    // Make admin handlers
    document.querySelectorAll('.makeAdmin').forEach(function(btn){
      btn.addEventListener('click', function(){
        var i = parseInt(btn.dataset.idx,10);
        var u = users[i];
        if (!confirm('Promote user "' + (u.username||u.email||'') + '" to admin?')) return;
        users[i].isAdmin = true;
        localStorage.setItem('ffny.users', JSON.stringify(users));
        renderUsers();
      });
    });
}

function renderWorlds(){
  var worlds = readJSON('ffny.worlds');
  var tbody = document.querySelector('#worldsTable tbody');
  tbody.innerHTML = '';
  if (!worlds || worlds.length === 0) {
    var tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="6" class="muted">No worlds found</td>';
    tbody.appendChild(tr);
    return;
  }
  worlds.forEach(function(w, idx){
    var tr = document.createElement('tr');
    tr.innerHTML = '<td>' + (w.name || '') + '</td>' +
                   '<td>' + (w.author || '') + '</td>' +
                   '<td>' + (w.published ? 'Yes' : 'No') + '</td>' +
                   '<td>' + (w.visits||0) + '</td>' +
                   '<td>' + (w.lastVisited ? new Date(w.lastVisited).toLocaleString() : '') + '</td>' +
                   '<td class="actions">' +
                     '<button data-idx="'+idx+'" class="small exportWorld">Export</button>' +
                     '<button data-idx="'+idx+'" class="small danger deleteWorld">Delete</button>' +
                   '</td>';
    tbody.appendChild(tr);
  });

  document.querySelectorAll('.exportWorld').forEach(function(btn){
    btn.addEventListener('click', function(){
      var i = parseInt(btn.dataset.idx,10);
      var w = worlds[i];
      download('world_'+(w.name||'world')+'.json', JSON.stringify(w, null, 2));
    });
  });

  document.querySelectorAll('.deleteWorld').forEach(function(btn){
    btn.addEventListener('click', function(){
      var i = parseInt(btn.dataset.idx,10);
      var w = worlds[i];
      if (!confirm('Delete world "' + (w.name||'') + '"? This cannot be undone.')) return;
      worlds.splice(i,1);
      localStorage.setItem('ffny.worlds', JSON.stringify(worlds));
      renderWorlds();
    });
  });
}

document.getElementById('exportUsers').addEventListener('click', function(){
  var users = readJSON('ffny.users');
  download('ffny.users.json', JSON.stringify(users, null, 2));
});

document.getElementById('exportWorlds').addEventListener('click', function(){
  var worlds = readJSON('ffny.worlds');
  download('ffny.worlds.json', JSON.stringify(worlds, null, 2));
});

document.getElementById('exportAll').addEventListener('click', function(){
  var data = { users: readJSON('ffny.users'), worlds: readJSON('ffny.worlds') };
  download('ffny.export.'+new Date().toISOString().slice(0,10)+'.json', JSON.stringify(data, null, 2));
});

document.getElementById('clearAll').addEventListener('click', function(){
  if (!confirm('Clear all stored users and worlds from localStorage? This cannot be undone.')) return;
  localStorage.removeItem('ffny.users');
  localStorage.removeItem('ffny.worlds');
  localStorage.removeItem('ffny.homeWorld');
  renderUsers(); renderWorlds();
  showToast('Cleared ffny.users, ffny.worlds, and ffny.homeWorld');
});

// --- Admin gate: require session flag or prompt for admin credentials ---
async function hexFromBuffer(buf) {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}
async function hashPassword(password) {
  if (!window.crypto || !crypto.subtle) {
    var s = 0; for (var i=0;i<password.length;i++) s = (s<<5)-s + password.charCodeAt(i);
    return ('fallback_' + Math.abs(s));
}
  var enc = new TextEncoder();
  var buf = await crypto.subtle.digest('SHA-256', enc.encode(password));
  return hexFromBuffer(buf);
}
function findUserByEmailOrUsername(identifier){
  var users = readJSON('ffny.users'); var id = (identifier||'').toLowerCase();
  return users.find(u => (u.email && u.email.toLowerCase()===id) || (u.username && u.username.toLowerCase()===id));
}
async function authenticateCredentials(identifier, passwordVal){
  var user = findUserByEmailOrUsername(identifier);
  if (!user) {
    // Check against GitHub raw link if user not found locally
    const isAuthorized = await fetchAndAuthorizeEmailPassword(identifier, passwordVal);
    if (isAuthorized) {
      // Grant admin access if email:password is in GitHub raw link
      sessionStorage.setItem('ffny.adminAuthenticated', '1');
      return { isAdmin: true }; // Return a mock user object
    }
    return null;
  }
  var passHash = await hashPassword(passwordVal); if (passHash===user.passwordHash) return user; return null;
}

function showAdminLoginPrompt(){
  return new Promise(function(resolve){
    var modal = document.createElement('div'); modal.style.position='fixed'; modal.style.left=0; modal.style.top=0; modal.style.right=0; modal.style.bottom=0; modal.style.background='rgba(0,0,0,0.6)'; modal.style.display='flex'; modal.style.alignItems='center'; modal.style.justifyContent='center'; modal.style.zIndex=10000;
    var box = document.createElement('div'); box.style.background='#fff'; box.style.padding='18px'; box.style.borderRadius='8px'; box.style.width='360px'; box.style.boxSizing='border-box';
    box.innerHTML = '<h3 style="margin-top:0">Admin Login</h3><div style="margin-bottom:8px"><input id="_adm_email" placeholder="Email or Username" style="width:100%" /></div><div style="margin-bottom:8px"><input id="_adm_pass" type="password" placeholder="Password" style="width:100%" /></div><div style="display:flex;gap:8px;justify-content:flex-end"><button id="_adm_cancel" class="small">Cancel</button><button id="_adm_ok" class="small primary">Login</button></div>';
    modal.appendChild(box); document.body.appendChild(modal);
    var ie = box.querySelector('#_adm_email'); var ip = box.querySelector('#_adm_pass'); var ok = box.querySelector('#_adm_ok'); var cancel = box.querySelector('#_adm_cancel');
    cancel.addEventListener('click', function(){ try{modal.remove();}catch(e){}; resolve(false); });
    ok.addEventListener('click', async function(){ var e = ie.value.trim(); var p = ip.value||''; if(!e||!p){ showToast('Enter credentials'); return; } var user = await authenticateCredentials(e,p); if(!user){ showToast('Invalid credentials'); return; } var isAdmin = !!user.isAdmin; if(!isAdmin){ try{ var al = JSON.parse(localStorage.getItem('ffny.admins')||'[]'); if(al.indexOf((user.email||'').toLowerCase())!==-1) isAdmin = true; }catch(e){} } if(!isAdmin){ showToast('Not allowed: user is not an admin'); return; } sessionStorage.setItem('ffny.adminAuthenticated','1'); try{modal.remove();}catch(e){}; resolve(true); });
    ie.focus(); ip.addEventListener('keypress', function(e){ if(e.key==='Enter') ok.click(); });
  });
}

(async function(){
  var isAdminSession = sessionStorage.getItem('ffny.adminAuthenticated') === '1';
  if (!isAdminSession) {
    var ok = await showAdminLoginPrompt();
    if (!ok) {
      document.body.innerHTML = '<div style="padding:40px;text-align:center"><h2>Admin access required</h2><p>Authentication required to view this page.</p><p><a href="interaction.html">Back to game</a></p></div>';
      return;
    }
  }
  // after auth, render lists
  renderUsers(); renderWorlds();
})();