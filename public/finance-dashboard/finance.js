// finance.js - dynamic finance dashboard logic
// Assumes endpoints: /finance/dashboard, /finance/invoices, /finance/bills, /finance/sales-orders, /finance/purchase-orders
// and creation endpoints: POST /finance/invoices, /finance/bills, /finance/sales-orders, /finance/purchase-orders

(function(){
  const token = (window.FlowIQ && window.FlowIQ.auth && window.FlowIQ.auth.token && window.FlowIQ.auth.token()) || null;
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
  const projFilter = document.getElementById('finProjFilter');

  const modal = document.getElementById('modalNewDoc');
  const btnNew = document.getElementById('btnNewDoc');
  const docType = document.getElementById('docType');
  const docRef = document.getElementById('docRef');
  const tblLine = document.querySelector('#tblLineItems tbody');
  const btnAddLine = document.getElementById('btnAddLine');
  const liTotal = document.getElementById('liTotal');
  let lineItems = [];

  function recomputeLineTotals(){
    let sum=0;
    lineItems.forEach(li => {
      const qty = Number(li.quantity||0);
      const price = Number(li.unitPrice||0);
      const tax = Number(li.taxRate||0);
      li.total = Math.round(qty * price * (1+tax) * 100)/100;
      sum += li.total;
    });
    liTotal.textContent = formatCurrency(sum);
    if(lineItems.length){
      docAmount.value = sum.toFixed(2);
      docAmount.setAttribute('disabled','disabled');
    } else {
      docAmount.removeAttribute('disabled');
    }
  }

  function renderLineItems(){
    tblLine.innerHTML='';
    if(!lineItems.length){
      const tr=document.createElement('tr');
      tr.innerHTML='<td colspan="6" style="padding:.6rem;text-align:center;opacity:.6">No line items added.</td>';
      tblLine.appendChild(tr);
      recomputeLineTotals();
      return;
    }
    lineItems.forEach((li,idx)=>{
      const tr=document.createElement('tr');
      tr.innerHTML=`<td><input class="li-input" data-field="product" value="${escapeHtml(li.product||'')}" placeholder="Product or description" /></td>
        <td><input class="li-input" type="number" min="0" step="1" data-field="quantity" value="${li.quantity}" style="width:70px" /></td>
        <td><input class="li-input" type="number" min="0" step="0.01" data-field="unitPrice" value="${li.unitPrice}" style="width:100px" /></td>
        <td><input class="li-input" type="number" min="0" max="1" step="0.01" data-field="taxRate" value="${li.taxRate}" style="width:70px" /></td>
        <td class="li-total">${formatCurrency(li.total||0)}</td>
        <td><button class="table-btn li-remove" data-idx="${idx}">✕</button></td>`;
      tblLine.appendChild(tr);
    });
    tblLine.querySelectorAll('.li-input').forEach(inp=>{
      inp.addEventListener('input',()=>{
        const field = inp.getAttribute('data-field');
        const rowIdx = Array.from(tblLine.children).indexOf(inp.closest('tr'));
        if(rowIdx>=0){
          if(['quantity','unitPrice','taxRate'].includes(field)){
            lineItems[rowIdx][field] = Number(inp.value||0);
          } else {
            lineItems[rowIdx][field] = inp.value;
          }
          recomputeLineTotals();
          renderLineItems();
        }
      });
    });
    tblLine.querySelectorAll('.li-remove').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const i = Number(btn.getAttribute('data-idx'));
        lineItems.splice(i,1);
        renderLineItems();
      });
    });
    recomputeLineTotals();
  }

  btnAddLine.addEventListener('click',()=>{
    lineItems.push({ product:'', quantity:1, unitPrice:0, taxRate:0, total:0 });
    renderLineItems();
  });
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
      if(status==='Confirmed') actions.push({label:'Create Invoice', action:'convert-invoice', isConvert:true});
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
      btn.addEventListener('click',()=> {
        if(a.isConvert){ convertSalesOrder(id); }
        else transitionStatus(collection,id,a.action);
      });
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
      const queryParts=[]; const proj=projFilter?.value||''; if(proj) queryParts.push('project='+encodeURIComponent(proj));
      const data = await api.get(endpoint + (queryParts.length? ('?'+queryParts.join('&')):''));
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
      renderGroupSummary(collection, items);
    } catch(e){ console.error('list load error', endpoint, e); }
  }

  async function convertSalesOrder(id){
    try{ await api.post(`/finance/sales-orders/${id}/convert-invoice`, {}); await reloadAll(); }
    catch(e){ console.error('convert failed', e); alert(e.message); }
  }

  function escapeHtml(str){ return String(str).replace(/[&<>'"]/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[s])); }

  async function reloadAll(){
    await Promise.all([fetchDashboard(), loadInvoices(), loadBills(), loadSales(), loadPurchase()]);
  }

  function renderGroupSummary(collection, items){
    const map=new Map(); items.forEach(i=>{ const key=i.status||'—'; const entry=map.get(key)||{count:0,total:0}; entry.count++; entry.total+=Number(i.amount||0); map.set(key,entry); });
    const summary=[...map.entries()].sort((a,b)=> b[1].total - a[1].total).map(([st,info])=> `${st}: ${info.count} (${formatCurrency(info.total)})`).join(' • ');
    const idMap={ 'invoices':'grpInvoices','vendor-bills':'grpBills','sales-orders':'grpSales','purchase-orders':'grpPurchase' };
    const elId=idMap[collection]; if(!elId) return; const el=document.getElementById(elId); if(el) el.textContent= summary || '—';
  }

  searchInput.addEventListener('input', () => reloadAll());
  projFilter.addEventListener('change', ()=> reloadAll());

  docCreateBtn.addEventListener('click', async () => {
    const type = docType.value;
    const payload = {
      amount: Number(docAmount.value||0),
      date: docDate.value || new Date().toISOString(),
    };
    if(lineItems.length){
      payload.lineItems = lineItems.map(li => ({
        product: li.product,
        quantity: Number(li.quantity||0),
        unitPrice: Number(li.unitPrice||0),
        taxRate: Number(li.taxRate||0),
      }));
    }
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
      docRef.value=''; docParty.value=''; docAmount.value=''; docDate.value=''; docProject.value=''; lineItems=[]; renderLineItems();
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
  ensureProjects().then(()=>{ renderLineItems(); reloadAll(); });
  async function ensureProjectFilter(){ try{ const res= await api.get('/pm/projects'); const list=res.projects||[]; projFilter.innerHTML='<option value="">All Projects</option>'+list.map(p=>`<option value="${p._id}">${escapeHtml(p.name)}</option>`).join(''); }catch{ projFilter.innerHTML='<option value="">All Projects</option>'; } }
  ensureProjectFilter();
})();
