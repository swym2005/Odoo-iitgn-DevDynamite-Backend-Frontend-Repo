(function(){
  const { api, ui } = window.FlowIQ;
  let settings=null;
  const roles=['Admin','Project Manager','Team Member','Finance','Vendor'];

  // =============== Company Settings ===============
  function rowTemplate(r){
    return `<tr data-role="${r.role}"><td>${r.role}</td><td><input type="number" step="0.01" value="${r.rate}" class="rate-input" style="width:90px"/></td><td><button class="table-btn btn-del">Delete</button></td></tr>`;
  }
  function renderRates(){
    const tb=document.querySelector('#tblRates tbody');
    if(!tb) return;
    tb.innerHTML='';
    (settings.hourlyRates||[]).forEach(r=> tb.insertAdjacentHTML('beforeend', rowTemplate(r)));
    bindRateDeletes();
  }
  async function loadSettings(){ const res=await api.get('/admin/settings'); settings=res.settings; hydrate(); }
  function hydrate(){ if(!settings) return; sCompany.value=settings.companyName||''; sCurrency.value=settings.currency||'USD'; sTax.value=settings.taxRate||0; sTheme.value=settings.theme||'light'; sLogo.value=settings.logoUrl||''; sGST.value=settings.gstNumber||''; sAddress.value=settings.address||''; renderRates(); }
  function bindRateDeletes(){ document.querySelectorAll('#tblRates .btn-del').forEach(btn=> btn.addEventListener('click',()=>{ const role=btn.closest('tr').dataset.role; settings.hourlyRates = settings.hourlyRates.filter(r=> r.role!==role); renderRates(); })); }
  function addRate(){ const existingRoles=(settings.hourlyRates||[]).map(r=>r.role); const next=roles.find(r=> !existingRoles.includes(r)); if(!next){ alert('All roles already have a rate'); return; } settings.hourlyRates = settings.hourlyRates || []; settings.hourlyRates.push({ role: next, rate: 0 }); renderRates(); }
  async function save(){
    const rows=[...document.querySelectorAll('#tblRates tbody tr')];
    settings.hourlyRates = rows.map(r=>({ role:r.dataset.role, rate:Number(r.querySelector('input').value||0) }));
    const payload={ companyName:sCompany.value.trim(), currency:sCurrency.value.trim(), taxRate:Number(sTax.value||0), theme:sTheme.value, logoUrl:sLogo.value.trim(), gstNumber:sGST.value.trim(), address:sAddress.value.trim(), hourlyRates: settings.hourlyRates };
    try{ const res=await api.put('/admin/settings', payload); if(!res.success) throw new Error(res.message||'Save failed'); settings=res.settings; hydrate(); alert('Settings saved'); }catch(e){ alert(e.message); }
  }

  // =============== Global Finance Lists ===============
  let projects=[]; let activeDoc='invoices';
  function financeUI(){
    const content=document.querySelector('.content'); if(!content) return;
    const card=document.createElement('div'); card.className='table-card'; card.style.marginTop='1rem';
    card.innerHTML=`<h2>Global Finance Lists</h2>
      <div class="tabs" style="display:flex;gap:.5rem;margin:.5rem 0 .8rem">
        <button class="button-outline" data-doc="invoices">Invoices</button>
        <button class="button-outline" data-doc="bills">Vendor Bills</button>
        <button class="button-outline" data-doc="sales">Sales Orders</button>
        <button class="button-outline" data-doc="purchase">Purchase Orders</button>
        <button class="button-outline" data-doc="expenses">Expenses</button>
      </div>
      <div class="filters" style="display:grid;grid-template-columns: repeat(auto-fit,minmax(160px,1fr)); gap:.5rem; align-items:end;">
        <div><label>Status</label><select id="fStatus"><option value="">All</option><option>Draft</option><option>Paid</option><option>Pending</option><option>Approved</option><option>Rejected</option></select></div>
        <div><label>Project</label><select id="fProject"><option value="">All</option></select></div>
        <div><label>From</label><input id="fFrom" type="date"/></div>
        <div><label>To</label><input id="fTo" type="date"/></div>
        <div><label>Search</label><input id="fSearch" placeholder="number, party, desc"/></div>
        <div><label>Group By</label><select id="fGroup"><option value="">None</option><option value="project">Project</option><option value="status">Status</option><option value="party">Party</option></select></div>
        <div style="display:flex;gap:.5rem"><button class="button-outline" id="fReset">Reset</button><button class="button-primary" id="fApply">Apply</button></div>
      </div>
      <div class="table-wrap" id="wrapList" style="margin-top:.8rem">
        <table class="table" id="tblGlobal"><thead><tr><th>Number</th><th>Party</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead><tbody></tbody></table>
      </div>
      <div class="table-wrap hidden" id="wrapGroup" style="margin-top:.8rem">
        <table class="table" id="tblGroup"><thead><tr><th>Group</th><th>Count</th><th>Total</th></tr></thead><tbody></tbody></table>
      </div>`;
    content.appendChild(card);

    // Bind tab clicks
    card.querySelectorAll('[data-doc]').forEach(btn=> btn.addEventListener('click',()=>{ activeDoc=btn.dataset.doc; refreshFinance(); }));
    // Bind filter buttons
    card.querySelector('#fApply').addEventListener('click', refreshFinance);
    card.querySelector('#fReset').addEventListener('click', ()=>{ ['fStatus','fProject','fFrom','fTo','fSearch','fGroup'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; }); refreshFinance(); });
    loadProjectsToFilter();
    refreshFinance();
  }

  async function loadProjectsToFilter(){
    try{ const res=await api.get('/pm/projects'); projects=res.projects||[]; }catch{ projects=[]; }
    const sel=document.getElementById('fProject'); if(!sel) return; sel.innerHTML='<option value="">All</option>' + projects.map(p=>`<option value="${p._id}">${escapeHtml(p.name)}</option>`).join('');
  }
  function escapeHtml(str){ return String(str||'').replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[s])); }
  function fmtCur(v){ if(v==null) return '—'; return '$'+Number(v).toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2}); }

  function buildQuery(){
    const q={};
    const status=document.getElementById('fStatus').value; if(status) q.status=status;
    const project=document.getElementById('fProject').value; if(project) q.project=project;
    const from=document.getElementById('fFrom').value; if(from) q.from=from;
    const to=document.getElementById('fTo').value; if(to) q.to=to;
    const search=document.getElementById('fSearch').value; if(search) q.search=search;
    const groupBy=document.getElementById('fGroup').value; if(groupBy) q.groupBy=groupBy;
    return q;
  }

  async function refreshFinance(){
    const q = buildQuery();
    const e = encodeQuery(q);
    let endpoint='';
    if(activeDoc==='invoices') endpoint='/finance/invoices';
    if(activeDoc==='bills') endpoint='/finance/vendor-bills';
    if(activeDoc==='sales') endpoint='/finance/sales-orders';
    if(activeDoc==='purchase') endpoint='/finance/purchase-orders';
    if(activeDoc==='expenses') endpoint='/expense';
    const url = endpoint + (e? ('?'+e):'');
    try{
      ui && ui.showLoader && ui.showLoader(document.querySelector('#wrapList'));
      const res = await api.get(url);
      const items = res.items || res.expenses || [];
      const groups = res.groups || null;
      renderFinance(items, groups);
    }catch(err){ console.error('finance load failed', err); }
    finally{ ui && ui.hideLoader && ui.hideLoader(document.querySelector('#wrapList')); }
  }

  function encodeQuery(q){ return Object.entries(q).map(([k,v])=> encodeURIComponent(k)+'='+encodeURIComponent(v)).join('&'); }

  function renderFinance(items, groups){
    const wrapList=document.getElementById('wrapList');
    const wrapGroup=document.getElementById('wrapGroup');
    const tb=document.querySelector('#tblGlobal tbody');
    const tg=document.querySelector('#tblGroup tbody');
    const groupBy=document.getElementById('fGroup').value;
    const useGroup = !!groupBy && Array.isArray(groups);
    wrapList.classList.toggle('hidden', useGroup);
    wrapGroup.classList.toggle('hidden', !useGroup);
    if(useGroup){
      tg.innerHTML='';
      groups.forEach(g=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td>${escapeHtml(g.key)}</td><td>${g.count}</td><td>${fmtCur(g.total)}</td>`; tg.appendChild(tr); });
      return;
    }
    tb.innerHTML='';
    if(!items.length){ const tr=document.createElement('tr'); tr.innerHTML='<td colspan="5" style="padding:1rem;text-align:center;opacity:.7">No records</td>'; tb.appendChild(tr); return; }
    items.forEach(d=>{
      const party=d.customer||d.vendor||d.submittedBy?.name||'';
      const date=d.date || d.createdAt;
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${escapeHtml(d.number||d._id||'')}</td><td>${escapeHtml(party)}</td><td>${fmtCur(d.amount)}</td><td><span class="status-chip status-${String(d.status||'').toLowerCase()}">${escapeHtml(d.status||'')}</span></td><td>${date? new Date(date).toLocaleDateString(): '—'}</td>`;
      tb.appendChild(tr);
    });
  }

  // =============== Bind & Start ===============
  function bind(){ const add=document.getElementById('btnAddRate'); if(add) add.addEventListener('click', addRate); const saveBtn=document.getElementById('btnSaveSettings'); if(saveBtn) saveBtn.addEventListener('click', save); }

  document.addEventListener('DOMContentLoaded',()=>{ bind(); loadSettings(); financeUI(); });
})();