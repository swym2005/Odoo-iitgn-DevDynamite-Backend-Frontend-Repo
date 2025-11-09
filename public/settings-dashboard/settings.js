(function(){
  const { api, ui } = window.FlowIQ;
  let settings=null;
  const roles=['Admin','Project Manager','Team Member','Finance','Vendor'];

  // =============== Company Settings ===============
  const sCompany = () => document.getElementById('sCompany');
  const sCurrency = () => document.getElementById('sCurrency');
  const sTax = () => document.getElementById('sTax');
  const sTheme = () => document.getElementById('sTheme');
  const sLogo = () => document.getElementById('sLogo');
  const sGST = () => document.getElementById('sGST');
  const sAddress = () => document.getElementById('sAddress');
  
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
  async function loadSettings(){ 
    try {
      const res=await api.get('/admin/settings'); 
      settings=res.settings; 
      hydrate(); 
    } catch(e) { console.warn('Settings load failed', e); }
  }
  function hydrate(){ 
    if(!settings) return; 
    if(sCompany()) sCompany().value=settings.companyName||''; 
    if(sCurrency()) sCurrency().value=settings.currency||'USD'; 
    if(sTax()) sTax().value=settings.taxRate||0; 
    if(sTheme()) sTheme().value=settings.theme||'light'; 
    if(sLogo()) sLogo().value=settings.logoUrl||''; 
    if(sGST()) sGST().value=settings.gstNumber||''; 
    if(sAddress()) sAddress().value=settings.address||''; 
    renderRates(); 
  }
  function bindRateDeletes(){ 
    document.querySelectorAll('#tblRates .btn-del').forEach(btn=> {
      btn.addEventListener('click',()=>{ 
        const role=btn.closest('tr').dataset.role; 
        settings.hourlyRates = settings.hourlyRates.filter(r=> r.role!==role); 
        renderRates(); 
      });
    });
  }
  function addRate(){ 
    const existingRoles=(settings.hourlyRates||[]).map(r=>r.role); 
    const next=roles.find(r=> !existingRoles.includes(r)); 
    if(!next){ alert('All roles already have a rate'); return; } 
    settings.hourlyRates = settings.hourlyRates || []; 
    settings.hourlyRates.push({ role: next, rate: 0 }); 
    renderRates(); 
  }
  async function save(){
    const rows=[...document.querySelectorAll('#tblRates tbody tr')];
    settings.hourlyRates = rows.map(r=>({ role:r.dataset.role, rate:Number(r.querySelector('input').value||0) }));
    const payload={ 
      companyName:sCompany()?.value.trim()||'', 
      currency:sCurrency()?.value.trim()||'USD', 
      taxRate:Number(sTax()?.value||0), 
      theme:sTheme()?.value||'light', 
      logoUrl:sLogo()?.value.trim()||'', 
      gstNumber:sGST()?.value.trim()||'', 
      address:sAddress()?.value.trim()||'', 
      hourlyRates: settings.hourlyRates 
    };
    try{ 
      const res=await api.put('/admin/settings', payload); 
      if(!res.success) throw new Error(res.message||'Save failed'); 
      settings=res.settings; 
      hydrate(); 
      alert('Settings saved'); 
    }catch(e){ alert(e.message); }
  }

  // =============== Global Finance Lists ===============
  let projects=[]; let activeDoc='invoices';
  
  function bindTabs(){
    document.querySelectorAll('.sidebar .nav-item[data-tab]').forEach(btn=>{
      btn.addEventListener('click',(e)=>{
        e.preventDefault();
        const tab=btn.dataset.tab;
        document.querySelectorAll('.sidebar .nav-item[data-tab]').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        const financePanel = document.getElementById('financePanel');
        const companyPanel = document.getElementById('companyPanel');
        if(financePanel) financePanel.classList.toggle('hidden', tab!=='finance');
        if(companyPanel) companyPanel.classList.toggle('hidden', tab!=='company');
        if(tab==='finance'){ refreshFinance(); }
      });
    });
  }
  
  function financeUI(){
    // Bind document type tabs
    document.querySelectorAll('#financePanel [data-doc]').forEach(btn=>{
      btn.addEventListener('click',()=>{
        activeDoc=btn.dataset.doc;
        document.querySelectorAll('#financePanel [data-doc]').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        refreshFinance();
      });
    });
    
    // Bind filter buttons
    const fApply = document.getElementById('fApply');
    const fReset = document.getElementById('fReset');
    if(fApply) fApply.addEventListener('click', refreshFinance);
    if(fReset) fReset.addEventListener('click', ()=>{
      ['fStatus','fProject','fPartner','fFrom','fTo','fSearch','fGroup'].forEach(id=>{
        const el=document.getElementById(id);
        if(el) el.value='';
      });
      refreshFinance();
    });
    
    // Bind new document button
    const btnNewDoc = document.getElementById('btnNewDoc');
    if(btnNewDoc){
      btnNewDoc.style.display='block';
      btnNewDoc.addEventListener('click', ()=> openDocumentModal());
    }
    
    loadProjectsToFilter();
    refreshFinance();
  }

  async function loadProjectsToFilter(){
    try{ 
      const res=await api.get('/pm/projects'); 
      projects=res.projects||[]; 
    }catch(e){ 
      projects=[]; 
    }
    const sel=document.getElementById('fProject'); 
    if(!sel) return; 
    sel.innerHTML='<option value="">All</option>' + projects.map(p=>`<option value="${p._id}">${escapeHtml(p.name)}</option>`).join('');
  }
  function escapeHtml(str){ return String(str||'').replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[s])); }
  function fmtCur(v){ if(v==null) return '—'; return '₹ '+Number(v).toLocaleString(undefined,{minimumFractionDigits:0, maximumFractionDigits:0}); }

  function buildQuery(){
    const q={};
    const status=document.getElementById('fStatus')?.value; if(status) q.status=status;
    const project=document.getElementById('fProject')?.value; if(project) q.project=project;
    const partner=document.getElementById('fPartner')?.value; if(partner) q.partner=partner;
    const from=document.getElementById('fFrom')?.value; if(from) q.from=from;
    const to=document.getElementById('fTo')?.value; if(to) q.to=to;
    const search=document.getElementById('fSearch')?.value; if(search) q.search=search;
    const groupBy=document.getElementById('fGroup')?.value; if(groupBy) q.groupBy=groupBy;
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
      if(ui && ui.showLoader) ui.showLoader(document.querySelector('#wrapList'));
      const res = await api.get(url);
      const items = res.items || res.expenses || [];
      const groups = res.groups || null;
      renderFinance(items, groups);
    }catch(err){ console.error('finance load failed', err); }
    finally{ if(ui && ui.hideLoader) ui.hideLoader(document.querySelector('#wrapList')); }
  }

  function encodeQuery(q){ return Object.entries(q).map(([k,v])=> encodeURIComponent(k)+'='+encodeURIComponent(v)).join('&'); }

  function renderFinance(items, groups){
    const wrapList=document.getElementById('wrapList');
    const wrapGroup=document.getElementById('wrapGroup');
    const tb=document.querySelector('#tblGlobal tbody');
    const tg=document.querySelector('#tblGroup tbody');
    const groupBy=document.getElementById('fGroup')?.value || '';
    const useGroup = !!groupBy && Array.isArray(groups) && groups.length>0;
    if(wrapList) wrapList.classList.toggle('hidden', useGroup);
    if(wrapGroup) wrapGroup.classList.toggle('hidden', !useGroup);
    if(useGroup){
      if(!tg) return;
      tg.innerHTML='';
      groups.forEach(g=>{ 
        const tr=document.createElement('tr'); 
        tr.innerHTML=`<td>${escapeHtml(g.key)}</td><td>${g.count}</td><td>${fmtCur(g.total)}</td>`; 
        tg.appendChild(tr); 
      });
      return;
    }
    if(!tb) return;
    tb.innerHTML='';
    if(!items.length){ 
      const tr=document.createElement('tr'); 
      tr.innerHTML='<td colspan="7" style="padding:1rem;text-align:center;opacity:.7">No records found</td>'; 
      tb.appendChild(tr); 
      return; 
    }
    items.forEach(d=>{
      const party=d.customer||d.vendor||d.submittedBy?.name||'—';
      const date=d.date || d.createdAt;
      const projectName = d.project?.name || (d.project ? 'Linked' : '—');
      const projectId = d.project?._id || d.project || null;
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${escapeHtml(d.number||d._id||'')}</td><td>${escapeHtml(party)}</td><td>₹ ${(d.amount||0).toLocaleString()}</td><td><span class="status-chip status-${String(d.status||'').toLowerCase()}">${escapeHtml(d.status||'')}</span></td><td>${escapeHtml(projectName)}</td><td>${date? new Date(date).toLocaleDateString(): '—'}</td><td><button class="table-btn" data-action="link" data-id="${d._id}" data-type="${activeDoc}" ${projectId?'disabled title="Already linked"':''}>${projectId?'Linked':'Link to Project'}</button></td>`;
      tb.appendChild(tr);
    });
    // Bind link buttons
    tb.querySelectorAll('[data-action="link"]').forEach(btn=>{
      if(btn.disabled) return;
      btn.addEventListener('click', ()=> openLinkModal(btn.dataset.id, btn.dataset.type));
    });
  }
  
  function openLinkModal(docId, docType){
    const modal = document.getElementById('modalDoc');
    const title = document.getElementById('modalDocTitle');
    const content = document.getElementById('modalDocContent');
    const saveBtn = document.getElementById('modalDocSave');
    if(!modal || !title || !content) return;
    
    title.textContent = 'Link Document to Project';
    content.innerHTML = `
      <div class="form-grid">
        <label>Select Project</label>
        <select id="linkProject" class="button-outline" style="padding:.55rem .7rem">
          <option value="">Select a project...</option>
          ${projects.map(p=>`<option value="${p._id}">${escapeHtml(p.name)}</option>`).join('')}
        </select>
      </div>
    `;
    
    saveBtn.onclick = async ()=>{
      const projectId = document.getElementById('linkProject').value;
      if(!projectId) return alert('Please select a project');
      try{
        await api.post(`/pm/projects/${projectId}/linked-docs`, {
          type: docType.toUpperCase().substring(0,3),
          refId: docId,
          meta: { linked: true }
        });
        ui.closeModal('modalDoc');
        refreshFinance();
        alert('Document linked to project successfully');
      }catch(e){ alert(e.message); }
    };
    
    ui.openModal('modalDoc');
  }
  
  function openDocumentModal(){
    const modal = document.getElementById('modalDoc');
    const title = document.getElementById('modalDocTitle');
    const content = document.getElementById('modalDocContent');
    const saveBtn = document.getElementById('modalDocSave');
    if(!modal || !title || !content) return;
    
    const docLabels = {
      invoices: 'Customer Invoice',
      bills: 'Vendor Bill',
      sales: 'Sales Order',
      purchase: 'Purchase Order',
      expenses: 'Expense'
    };
    
    title.textContent = `Create ${docLabels[activeDoc] || 'Document'}`;
    const isInvoice = activeDoc === 'invoices';
    const isBill = activeDoc === 'bills';
    const isSO = activeDoc === 'sales';
    const isPO = activeDoc === 'purchase';
    const isExpense = activeDoc === 'expenses';
    
    content.innerHTML = `
      <div class="form-grid">
        ${isSO || isInvoice ? `<label>Customer</label><input id="docCustomer" placeholder="Customer name"/>` : ''}
        ${isBill || isPO ? `<label>Vendor</label><input id="docVendor" placeholder="Vendor name"/>` : ''}
        ${isExpense ? `<label>Description</label><input id="docDescription" placeholder="Expense description"/>` : ''}
        <label>Amount</label><input id="docAmount" type="number" step="0.01" placeholder="Amount"/>
        <label>Project (Optional)</label>
        <select id="docProject" class="button-outline" style="padding:.55rem .7rem">
          <option value="">No project</option>
          ${projects.map(p=>`<option value="${p._id}">${escapeHtml(p.name)}</option>`).join('')}
        </select>
      </div>
    `;
    
    saveBtn.onclick = async ()=>{
      const amount = Number(document.getElementById('docAmount').value||0);
      const projectId = document.getElementById('docProject').value || null;
      if(!(amount>0)) return alert('Amount is required');
      
      try{
        let result;
        if(isSO){
          const customer = document.getElementById('docCustomer').value.trim();
          if(!customer) return alert('Customer is required');
          result = await api.post('/finance/sales-orders', { customer, project: projectId, amount });
        } else if(isPO){
          const vendor = document.getElementById('docVendor').value.trim();
          if(!vendor) return alert('Vendor is required');
          result = await api.post('/finance/purchase-orders', { vendor, project: projectId, amount });
        } else if(isInvoice){
          const customer = document.getElementById('docCustomer').value.trim();
          if(!customer) return alert('Customer is required');
          result = await api.post('/finance/invoices', { customer, project: projectId, amount });
        } else if(isBill){
          const vendor = document.getElementById('docVendor').value.trim();
          if(!vendor) return alert('Vendor is required');
          result = await api.post('/finance/vendor-bills', { vendor, project: projectId, amount });
        } else if(isExpense){
          const description = document.getElementById('docDescription').value.trim();
          if(!description) return alert('Description is required');
          if(!projectId) return alert('Project is required for expenses');
          result = await api.post(`/pm/projects/${projectId}/expenses`, { amount, description, date: new Date().toISOString().slice(0,10) });
        }
        ui.closeModal('modalDoc');
        refreshFinance();
        alert('Document created successfully');
      }catch(e){ alert(e.message); }
    };
    
    ui.openModal('modalDoc');
  }

  // =============== Bind & Start ===============
  function bind(){ 
    const add=document.getElementById('btnAddRate'); 
    if(add) add.addEventListener('click', addRate); 
    const saveBtn=document.getElementById('btnSaveSettings'); 
    if(saveBtn) saveBtn.addEventListener('click', save);
    bindTabs();
    ui.bindClose();
  }

  document.addEventListener('DOMContentLoaded',()=>{ bind(); loadSettings(); financeUI(); });
})();
