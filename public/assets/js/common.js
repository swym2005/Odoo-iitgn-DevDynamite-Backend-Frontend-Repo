// FlowIQ common utilities
(function(){
  window.FlowIQ = window.FlowIQ || {};
  const API_BASE = '';
  function token(){ return localStorage.getItem('orbitone_token') || localStorage.getItem('flowiq_token'); }
  function user(){ try{return JSON.parse(localStorage.getItem('orbitone_user')||localStorage.getItem('flowiq_user')||'null');}catch(e){return null;} }
  function authHeaders(){ 
    const tok = token();
    if(!tok) {
      console.warn('No token found in localStorage');
      return { 'Content-Type':'application/json' };
    }
    return { 'Authorization':'Bearer '+tok, 'Content-Type':'application/json' }; 
  }
  async function request(path, opts={}){
    const tok = token();
    if(!tok && path !== '/auth/login' && path !== '/auth/signup') {
      console.warn('Request to', path, 'without token');
    }
    const headers = { ...authHeaders(), ...(opts.headers||{}) };
    // Ensure Authorization header is preserved if token exists
    if(tok && !headers['Authorization'] && !headers['authorization']) {
      headers['Authorization'] = 'Bearer ' + tok;
    }
    const res = await fetch(API_BASE+path, { ...opts, headers });
    if(res.status === 401){ 
      // Clean up all token keys
      ['orbitone_token','orbitone_user','flowiq_token','flowiq_user'].forEach(k=> localStorage.removeItem(k));
      window.location.replace('/login'); 
      return; 
    }
    let json=null; try{ json = await res.json(); }catch(e){ json=null; }
    if(!res.ok || (json && json.success===false)){
      const msg = json?.message || ('Request failed: '+res.status);
      throw new Error(msg);
    }
    return json;
  }
  const api = {
    get(path){ return request(path); },
    post(path, body){ return request(path, { method:'POST', body: JSON.stringify(body) }); },
    patch(path, body){ return request(path, { method:'PATCH', body: JSON.stringify(body) }); },
    put(path, body){ 
      // If body is FormData, use multipart, otherwise JSON
      if(body instanceof FormData){
        return api.putMultipart(path, body);
      }
      return request(path, { method:'PUT', body: JSON.stringify(body) }); 
    },
    del(path){ return request(path, { method:'DELETE' }); },
    async postMultipart(path, formData){
      // Use a raw fetch to avoid JSON headers; include auth if available
      const headers = token()? { 'Authorization': 'Bearer '+token() } : {};
      const res = await fetch(API_BASE+path, { method:'POST', headers, body: formData });
      if(res.status === 401){ 
        ['orbitone_token','orbitone_user','flowiq_token','flowiq_user'].forEach(k=> localStorage.removeItem(k));
        window.location.replace('/login'); 
        return; 
      }
      let json=null; try{ json = await res.json(); }catch(e){ json=null; }
      if(!res.ok || (json && json.success===false)){
        const msg = json?.message || ('Request failed: '+res.status);
        throw new Error(msg);
      }
      return json;
    },
    async putMultipart(path, formData){
      // Use a raw fetch to avoid JSON headers; include auth if available
      const headers = token()? { 'Authorization': 'Bearer '+token() } : {};
      const res = await fetch(API_BASE+path, { method:'PUT', headers, body: formData });
      if(res.status === 401){ 
        ['orbitone_token','orbitone_user','flowiq_token','flowiq_user'].forEach(k=> localStorage.removeItem(k));
        window.location.replace('/login'); 
        return; 
      }
      let json=null; try{ json = await res.json(); }catch(e){ json=null; }
      if(!res.ok || (json && json.success===false)){
        const msg = json?.message || ('Request failed: '+res.status);
        throw new Error(msg);
      }
      return json;
    },
    getJSON: request,
  };
  window.FlowIQ.api = api;
  window.FlowIQ.auth = { token, user };
  window.FlowIQ.ui = {
    openModal(id){ document.getElementById(id)?.classList.remove('hidden'); },
    closeModal(id){ document.getElementById(id)?.classList.add('hidden'); },
    bindClose(){ document.querySelectorAll('[data-close]')?.forEach(btn=>btn.addEventListener('click',()=>{ const m=btn.closest('.modal-backdrop'); if(m) m.classList.add('hidden'); })); },
    showLoader(target){
      const el = typeof target==='string'? document.querySelector(target) : target;
      if(!el) return; const div=document.createElement('div'); div.className='flowiq-loader'; div.innerHTML='<div class="spinner"></div>'; el.dataset.loaderAttached='1'; el.appendChild(div);
    },
    hideLoader(target){ const el = typeof target==='string'? document.querySelector(target) : target; if(!el) return; const ld=el.querySelector('.flowiq-loader'); if(ld) ld.remove(); }
  };

  // Notifications mini-client
  window.FlowIQ.notify = (function(){
    let badgeEl=null, panelEl=null, listEl=null, loading=false, timer=null;
    function init(){
      badgeEl=document.getElementById('notifBadge');
      panelEl=document.getElementById('notifPanel');
      listEl=document.getElementById('notifList');
      const toggle=document.getElementById('notifToggle');
      if(toggle){ toggle.addEventListener('click',()=>{ panelEl?.classList.toggle('hidden'); if(!panelEl.classList.contains('hidden')) fetchNotifications(); }); }
      fetchUnread();
      timer=setInterval(fetchUnread, 30000);
      window.addEventListener('beforeunload',()=>{ if(timer) clearInterval(timer); });
    }
    async function fetchUnread(){ try{ const res= await api.get('/notifications/unread-count'); if(badgeEl){ badgeEl.textContent = res.count>99? '99+': String(res.count||0); badgeEl.style.display = res.count? 'inline-flex':'none'; } }catch{} }
    async function fetchNotifications(){ if(loading) return; loading=true; if(listEl){ listEl.innerHTML='<li class="muted">Loading…</li>'; }
      try{ const res= await api.get('/notifications'); const items=res.items||[]; if(!items.length){ listEl.innerHTML='<li class="muted">No notifications</li>'; } else { listEl.innerHTML=''; items.forEach(n=>{ const li=document.createElement('li'); li.className='notif-item'+(n.read?' read':''); li.innerHTML=`<div class='notif-title'>${escapeHtml(n.title||'')}</div><div class='notif-msg'>${escapeHtml(n.message||'')}</div><div class='notif-meta'>${new Date(n.createdAt).toLocaleString()} ${n.link?`<a href='${n.link}' class='notif-link'>Open</a>`:''}</div>`; listEl.appendChild(li); }); }
      }catch(e){ if(listEl) listEl.innerHTML='<li class="muted">Failed to load</li>'; }
      finally{ loading=false; }
    }
    async function markAll(){ try{ await api.post('/notifications/read',{ all:true }); fetchNotifications(); fetchUnread(); }catch(e){ alert(e.message); } }
    function escapeHtml(str){ return String(str||'').replace(/[&<>'"]/g, s=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;","\"":"&quot;"}[s])); }
    return { init, fetchUnread, fetchNotifications, markAll };
  })();

  // Role-based feature gating helper
  window.FlowIQ.gate = function mapGating(){
    const u = user();
    if(!u) return;
    const role = u.role;
    // Elements annotated with data-roles (comma separated) will be kept only if role is included
    document.querySelectorAll('[data-roles]')?.forEach(el=>{
      const allowed = el.getAttribute('data-roles').split(',').map(s=>s.trim());
      if(!allowed.includes(role)){
        // If destructive (buttons/actions), disable + hide visually but keep layout minimal
        if(el.tagName==='BUTTON' || el.tagName==='A' || el.hasAttribute('data-action')){
          el.setAttribute('disabled','disabled');
          el.classList.add('gated-hidden');
        } else {
          el.classList.add('gated-hidden');
        }
      }
    });
    // Elements with data-hide-for containing roles to hide
    document.querySelectorAll('[data-hide-for]')?.forEach(el=>{
      const deny = el.getAttribute('data-hide-for').split(',').map(s=>s.trim());
      if(deny.includes(role)){
        el.classList.add('gated-hidden');
      }
    });
  };
  document.addEventListener('DOMContentLoaded',()=>{
    try{ window.FlowIQ.gate(); }catch(e){}
    try{ window.FlowIQ.notify.init(); }catch(e){}
  });
})();
