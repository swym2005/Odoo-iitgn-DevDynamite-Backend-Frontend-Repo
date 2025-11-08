// finance.js - dynamic finance dashboard logic
// Assumes endpoints: /finance/dashboard, /finance/invoices, /finance/bills, /finance/sales-orders, /finance/purchase-orders
// and creation endpoints: POST /finance/invoices, /finance/bills, /finance/sales-orders, /finance/purchase-orders

(function(){
  const token = localStorage.getItem('flowiq_token');
  if(!token){ window.location.href='/'; return; }

  const kRev = document.getElementById('kRev');
  const kExp = document.getElementById('kExp');
  const kProfit = document.getElementById('kProfit');
  const kMargin = document.getElementById('kMargin');

  const tblInvoices = document.querySelector('#tblInvoices tbody');
  const tblBills = document.querySelector('#tblBills tbody');
  const tblSales = document.querySelector('#tblSales tbody');
  const tblPurchase = document.querySelector('#tblPurchase tbody');
  const searchInput = document.getElementById('finSearch');

  const modal = document.getElementById('modalNewDoc');
  const btnNew = document.getElementById('btnNewDoc');
  const docType = document.getElementById('docType');
  const docNumber = document.getElementById('docNumber');
  const docParty = document.getElementById('docParty');
  const docAmount = document.getElementById('docAmount');
  const docDate = document.getElementById('docDate');
  const docProject = document.getElementById('docProject');
  const docCreateBtn = document.getElementById('docCreateBtn');

  const api = window.FlowIQ.api;
  const UI = window.FlowIQ.ui;
  const loaderArea = document.getElementById('financeContent');

  let projects = [];

  function openModal(){ modal.classList.remove('hidden'); }
  function closeModal(){ modal.classList.add('hidden'); }
  modal.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click', closeModal));
  btnNew.addEventListener('click', async ()=>{
    await ensureProjects();
    openModal();
  });

  async function ensureProjects(){
    if(projects.length) return projects;
    try { const res = await api.get('/pm/projects'); projects = res.projects||[]; } catch { projects = []; }
    docProject.innerHTML = '<option value="">(Optional)</option>' + projects.map(p=>`<option value="${p._id}">${escapeHtml(p.name)}</option>`).join('');
    return projects;
  }

  async function fetchDashboard(){
    UI.showLoader(loaderArea);
    try {
      const res = await api.get('/finance/dashboard');
      if(res){
        kRev.textContent = formatCurrency(res.revenue);
        kExp.textContent = formatCurrency(res.totalCost);
        kProfit.textContent = formatCurrency(res.grossProfit);
        const margin = res.revenue ? (res.grossProfit / res.revenue * 100) : 0;
        kMargin.textContent = margin.toFixed(1)+'%';
      }
    } catch(e){ console.error('dashboard error', e); }
    finally { UI.hideLoader(loaderArea); }
  }

  function formatCurrency(v){ if(v==null) return '—'; return '$'+Number(v).toLocaleString(undefined,{minimumFractionDigits:2, maximumFractionDigits:2}); }

  async function loadInvoices(){ await loadList('/finance/invoices', tblInvoices, 'invoices'); }
  async function loadBills(){ await loadList('/finance/vendor-bills', tblBills, 'vendor-bills'); }
  async function loadSales(){ await loadList('/finance/sales-orders', tblSales, 'sales-orders'); }
  async function loadPurchase(){ await loadList('/finance/purchase-orders', tblPurchase, 'purchase-orders'); }

  function rowActions(collection, id, status){
    const container = document.createElement('div');
    container.className='row-actions';
    const actions = [];
    // Map status transitions to available endpoints
    // Sales Orders: Draft -> Confirmed -> Paid
    if(collection==='sales-orders'){
      if(status==='Draft') actions.push({label:'Confirm', action:'confirm'});
      if(status==='Confirmed') actions.push({label:'Mark Paid', action:'paid'});
    }
    // Purchase Orders: Draft -> Approved -> Paid
    if(collection==='purchase-orders'){
      if(status==='Draft') actions.push({label:'Approve', action:'approve'});
      if(status==='Approved') actions.push({label:'Mark Paid', action:'paid'});
    }
    // Invoices: Draft -> Paid
    if(collection==='invoices'){
      if(status==='Draft') actions.push({label:'Mark Paid', action:'paid'});
    }
    // Vendor Bills: Pending -> Paid
    if(collection==='vendor-bills'){
      if(status==='Pending') actions.push({label:'Mark Paid', action:'paid'});
    }
    actions.forEach(a=>{
      const btn = document.createElement('button');
      btn.className='table-btn';
      btn.textContent=a.label;
      btn.addEventListener('click',()=> transitionStatus(collection,id,a.action));
      container.appendChild(btn);
    });
    return container;
  }

  async function transitionStatus(collection,id,action){
    try {
      await api.post(`/finance/${collection}/${id}/${action}`, {});
      await reloadAll();
    } catch(e){ console.error('status transition failed', e); }
  }

  async function loadList(endpoint, tbody, collection){
    try {
      const data = await api.get(endpoint);
      const items = data.items || data || [];
      const q = (searchInput.value||'').toLowerCase();
      tbody.innerHTML='';
      items.filter(d => !q || JSON.stringify(d).toLowerCase().includes(q)).forEach(doc => {
        const tr = document.createElement('tr');
        const party = doc.customer || doc.vendor || '';
        tr.innerHTML = `<td>${escapeHtml(doc.number||doc._id||'')}</td>`+
          `<td>${escapeHtml(party)}</td>`+
          `<td>${formatCurrency(doc.amount)}</td>`+
          `<td><span class=\"status-chip status-${(doc.status||'').toLowerCase()}\">${escapeHtml(doc.status||'')}</span></td>`+
          `<td>${doc.date ? new Date(doc.date).toLocaleDateString() : '—'}</td>`+
          `<td></td>`;
        const actionsCell = tr.querySelector('td:last-child');
        actionsCell.appendChild(rowActions(collection, doc._id, doc.status));
        tbody.appendChild(tr);
      });
    } catch(e){ console.error('list load error', endpoint, e); }
  }

  function escapeHtml(str){ return String(str).replace(/[&<>'"]/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[s])); }

  async function reloadAll(){
    await Promise.all([fetchDashboard(), loadInvoices(), loadBills(), loadSales(), loadPurchase()]);
  }

  searchInput.addEventListener('input', () => reloadAll());

  docCreateBtn.addEventListener('click', async () => {
    const type = docType.value;
    const payload = {
      amount: Number(docAmount.value||0),
      date: docDate.value || new Date().toISOString(),
    };
    const projectVal = docProject.value || '';
    if(projectVal) payload.project = projectVal;
    // Map party field
    if(type==='invoice' || type==='sales') payload.customer = docParty.value.trim();
    if(type==='bill' || type==='purchase') payload.vendor = docParty.value.trim();
    let endpoint;
    switch(type){
      case 'invoice': endpoint='/finance/invoices'; break;
      case 'bill': endpoint='/finance/vendor-bills'; break;
      case 'sales': endpoint='/finance/sales-orders'; break;
      case 'purchase': endpoint='/finance/purchase-orders'; break;
    }
    try {
      await api.post(endpoint, payload);
      closeModal();
      docNumber.value=''; docParty.value=''; docAmount.value=''; docDate.value=''; docProject.value='';
      await reloadAll();
    } catch(e){ console.error('create doc failed', e); alert(e.message); }
  });

  function showOnly(id){
    ['secInvoices','secBills','secSales','secPurchase'].forEach(sec => {
      document.getElementById(sec).style.display = (sec===id)?'block':'none';
    });
  }
  document.getElementById('navInvoices').addEventListener('click', e=>{ e.preventDefault(); showOnly('secInvoices'); });
  document.getElementById('navBills').addEventListener('click', e=>{ e.preventDefault(); showOnly('secBills'); });
  document.getElementById('navSales').addEventListener('click', e=>{ e.preventDefault(); showOnly('secSales'); });
  document.getElementById('navPurchase').addEventListener('click', e=>{ e.preventDefault(); showOnly('secPurchase'); });

  showOnly('secInvoices');
  ensureProjects().then(reloadAll);
})();
