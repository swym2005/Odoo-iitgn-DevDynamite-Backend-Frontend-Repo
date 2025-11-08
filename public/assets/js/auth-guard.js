(function(){
  // Backward + forward compatible storage keys (FlowIQ → OrbitOne)
  const get = (k) => localStorage.getItem(k);
  const token = get('orbitone_token') || get('flowiq_token');
  const userRaw = get('orbitone_user') || get('flowiq_user');
  let user = null;
  try{ user = JSON.parse(userRaw||'null'); }catch(e){ user=null; }

  function setKeys(tok, usr){
    try{
      if(tok) localStorage.setItem('orbitone_token', tok);
      if(usr) localStorage.setItem('orbitone_user', typeof usr==='string'? usr : JSON.stringify(usr));
    }catch{}
  }
  // If found legacy keys but not new, mirror to new ones
  if(token && !get('orbitone_token')){ setKeys(token, userRaw); }

  function logout(){
    ['orbitone_token','orbitone_user','flowiq_token','flowiq_user'].forEach(k=> localStorage.removeItem(k));
    window.location.href='/login';
  }
  window.FlowIQ = window.FlowIQ || {}; window.FlowIQ.auth = Object.assign(window.FlowIQ.auth||{}, { logout });

  // Allow public routes without token
  const path = window.location.pathname;
  const publicPaths = ['/', '/login', '/docs'];
  if(publicPaths.includes(path)) return;

  // Enforce auth for app pages
  if(!token || !user){ logout(); return; }

  // Role → dashboard prefix
  const roleMap = {
    'Admin': '/admin-dashboard',
    'Project Manager': '/pm-dashboard',
    'Team Member': '/team-dashboard',
    'Finance': '/finance-dashboard'
  };
  const expectedPrefix = roleMap[user.role];
  if(!expectedPrefix) return; // unknown role, skip

  // Allowed cross-sections by role
  const allow = {
    'Admin': ['/admin-dashboard','/pm-dashboard','/team-dashboard','/finance-dashboard','/tasks','/timesheets-ui','/expenses-dashboard','/analytics-dashboard','/profile','/settings-dashboard'],
    'Project Manager': ['/pm-dashboard','/tasks','/timesheets-ui','/expenses-dashboard','/analytics-dashboard','/project-detail','/profile'],
    'Team Member': ['/team-dashboard','/tasks','/timesheets-ui','/profile'],
    'Finance': ['/finance-dashboard','/analytics-dashboard','/profile']
  };
  const allowed = allow[user.role] || [expectedPrefix];

  const isAllowed = allowed.some(p => path.startsWith(p));
  if(!isAllowed){
    // Redirect to role home
    const dest = expectedPrefix.endsWith('/')? expectedPrefix : expectedPrefix + '/';
    window.location.replace(dest);
  }
})();