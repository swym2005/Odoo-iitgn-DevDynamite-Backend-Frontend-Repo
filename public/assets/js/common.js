// FlowIQ common utilities
(function(){
  window.FlowIQ = window.FlowIQ || {};
  const API_BASE = '';
  function token(){ return localStorage.getItem('flowiq_token'); }
  function user(){ try{return JSON.parse(localStorage.getItem('flowiq_user')||'null');}catch(e){return null;} }
  function authHeaders(){ return token()? { 'Authorization':'Bearer '+token(), 'Content-Type':'application/json' } : { 'Content-Type':'application/json' }; }
  async function request(path, opts={}){
    const res = await fetch(API_BASE+path, { ...opts, headers:{...authHeaders(), ...(opts.headers||{})} });
    if(res.status === 401){ localStorage.removeItem('flowiq_token'); localStorage.removeItem('flowiq_user'); window.location.replace('/'); return; }
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
    del(path){ return request(path, { method:'DELETE' }); },
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
})();
