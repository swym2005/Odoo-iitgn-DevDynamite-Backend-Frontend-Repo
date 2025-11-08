(function(){
  const token = localStorage.getItem('flowiq_token');
  const userRaw = localStorage.getItem('flowiq_user');
  let user = null;
  try{ user = JSON.parse(userRaw||'null'); }catch(e){ user=null; }
  function logout(){ localStorage.removeItem('flowiq_token'); localStorage.removeItem('flowiq_user'); window.location.href='/'; }
  window.FlowIQ = window.FlowIQ || {}; window.FlowIQ.auth = Object.assign(window.FlowIQ.auth||{}, { logout });
  if(!token || !user){ logout(); return; }
  // Simple role-to-path enforcement (prefix match)
  const roleMap = {
    'Admin': '/admin-dashboard',
    'Project Manager': '/pm-dashboard',
    'Team Member': '/team-dashboard',
    'Finance': '/finance-dashboard'
  };
  const expectedPrefix = roleMap[user.role];
  if(expectedPrefix && window.location.pathname.startsWith('/') && window.location.pathname.startsWith(expectedPrefix) === false){
    // Allow visiting other supporting pages (tasks, timesheets, etc.) for PM/Admin; skip strict redirect for shared pages
    if(['Project Manager','Admin'].includes(user.role) && (
      window.location.pathname.startsWith('/tasks') ||
      window.location.pathname.startsWith('/timesheets-ui') ||
      window.location.pathname.startsWith('/expenses-dashboard') ||
      window.location.pathname.startsWith('/billing-dashboard') ||
      window.location.pathname.startsWith('/analytics-dashboard') ||
      window.location.pathname.startsWith('/project-detail')
    )){
      return; // allowed area
    }
    // Team Member allowed tasks & timesheets view
    if(user.role==='Team Member' && (window.location.pathname.startsWith('/tasks') || window.location.pathname.startsWith('/timesheets-ui'))){
      return;
    }
    // Finance allowed billing & analytics
    if(user.role==='Finance' && (window.location.pathname.startsWith('/billing-dashboard') || window.location.pathname.startsWith('/analytics-dashboard'))){
      return;
    }
    window.location.replace(expectedPrefix + '/');
  }
})();