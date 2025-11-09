(function(){
  const { ui, api } = window.FlowIQ;
  const docsTbody = () => document.querySelector('#tblDocs tbody');
  let projectId = null;
  let summary = { budget:0, revenue:0, cost:0, profit:0 };

  function qp(name){ return new URLSearchParams(location.search).get(name); }

  function renderKPI(){
    document.getElementById('kBudget').textContent = '₹ '+(summary.budget||0).toLocaleString();
    document.getElementById('kRevenue').textContent = '₹ '+(summary.revenue||0).toLocaleString();
    document.getElementById('kCost').textContent = '₹ '+(summary.cost||0).toLocaleString();
    document.getElementById('kProfit').textContent = '₹ '+(summary.profit||0).toLocaleString();
  }
  function addDoc(type, record){
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${type}</td><td>${record.number||record._id||'-'}</td><td>${record.partner||record.client||'-'}</td><td>₹ ${(record.amount||record.budget||0).toLocaleString()}</td><td>${record.status||record.state||''}</td>`;
    docsTbody().appendChild(tr);
  }

  async function loadProject(){
    projectId = qp('id');
    if(!projectId){ return alert('Missing project id'); }
    try{
      const res = await api.get(`/pm/projects/${projectId}`);
      summary = res.summary || summary;
      renderKPI();
    }catch(e){ alert('Failed to load project: '+e.message); }
  }

  async function loadBilling(){
    if(!projectId) return;
    try{
      const res = await api.get(`/pm/projects/${projectId}/billing`);
      const links = await api.get(`/pm/projects/${projectId}/linked-docs`).catch(()=>({linkedDocs:[]}));
      docsTbody().innerHTML='';
      (res.billing||[]).forEach(r=> addDoc(r.type==='revenue'?'Revenue':'Expense', { number:r.number, partner:r.partner, amount:r.amount, status:r.status }));
      (links.linkedDocs||[]).forEach(ld=> addDoc(ld.type || 'Link', { number: ld.refId, partner: (ld.meta&&ld.meta.partner)||'-', amount: (ld.meta&&ld.meta.amount)||0, status: (ld.meta&&ld.meta.status)||'' }));
    }catch(e){ /* silent */ }
  }

  let progressChart = null, teamHoursChart = null;
  function charts(){ 
    if(!window.Chart) return; 
    const ctx=document.getElementById('chartProgress');
    if(ctx){
    // For now progress from summary.progress
    const done = summary.progress || 0; const remaining = 100 - done;
      if(progressChart){
        progressChart.data.datasets[0].data = [done, remaining];
        progressChart.update();
      }else{
        progressChart = new Chart(ctx,{ type:'bar', data:{ labels:['Done','Remaining'], datasets:[{label:'Tasks', data:[done,remaining], backgroundColor:['#10b981','#4f9fff55'], borderColor:['#10b981','#4f9fff']}] }, options:{ plugins:{legend:{labels:{color:'#e6edf5'}}}, scales:{x:{ticks:{color:'#9aa9bd'}},y:{ticks:{color:'#9aa9bd'}}}} }); 
      }
    }
  }
  
  async function loadTeamUsage(){
    if(!projectId) return;
    try{
      const res = await api.get(`/pm/projects/${projectId}/timesheets/chart`);
      if(!window.Chart) return;
      const ctx = document.getElementById('chartTeamHours');
      if(!ctx) return;
      
      const members = res.hoursPerMember || [];
      if(members.length === 0){
        ctx.parentElement.innerHTML = '<div style="padding:2rem;text-align:center;opacity:.6">No timesheet data available</div>';
        return;
      }
      
      const labels = members.map(m => m.name || 'Unknown');
      const hoursData = members.map(m => m.hours || 0);
      const billableData = members.map(m => m.billableHours || 0);
      const nonBillableData = members.map(m => m.nonBillableHours || 0);
      
      if(teamHoursChart){
        teamHoursChart.data.labels = labels;
        teamHoursChart.data.datasets[0].data = hoursData;
        teamHoursChart.data.datasets[1].data = billableData;
        teamHoursChart.data.datasets[2].data = nonBillableData;
        teamHoursChart.update();
      }else{
        teamHoursChart = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: labels,
            datasets: [
              {
                label: 'Total Hours',
                data: hoursData,
                backgroundColor: '#4f9fff55',
                borderColor: '#4f9fff',
                borderWidth: 1
              },
              {
                label: 'Billable Hours',
                data: billableData,
                backgroundColor: '#10b98155',
                borderColor: '#10b981',
                borderWidth: 1
              },
              {
                label: 'Non-Billable Hours',
                data: nonBillableData,
                backgroundColor: '#ef444455',
                borderColor: '#ef4444',
                borderWidth: 1
              }
            ]
          },
          options: {
            plugins: {
              legend: {
                labels: { color: '#e6edf5' }
              }
            },
            scales: {
              x: {
                ticks: { color: '#9aa9bd' },
                grid: { color: '#2d3a55' }
              },
              y: {
                ticks: { color: '#9aa9bd' },
                grid: { color: '#2d3a55' },
                beginAtZero: true
              }
            }
          }
        });
      }
    }catch(e){
      console.warn('Failed to load team usage:', e);
      const ctx = document.getElementById('chartTeamHours');
      if(ctx && ctx.parentElement){
        ctx.parentElement.innerHTML = '<div style="padding:2rem;text-align:center;opacity:.6">Failed to load team usage data</div>';
      }
    }
  }

  function bind(){
    // tabs
    document.querySelectorAll('.tab-btn').forEach(btn=>{
      btn.addEventListener('click',()=>{
        // Load team usage when team tab is clicked
        if(btn.dataset.tab === 'team'){
          loadTeamUsage();
        }
        // Reload documents for linking when Settings tab is clicked
        if(btn.dataset.tab === 'settings'){
          loadDocumentsForLinking();
        }
        const tab=btn.dataset.tab; document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.tab-panel').forEach(p=> p.classList.add('hidden'));
        const active=document.querySelector(`.tab-panel[data-panel="${tab}"]`); if(active) active.classList.remove('hidden');
      });
    });
    document.getElementById('btnAI').addEventListener('click',()=> ui.openModal('modalAI'));
    const addINV=document.getElementById('btnAddINV');
    const addBILL=document.getElementById('btnAddBILL');
    const addSO=document.getElementById('btnAddSO');
    const addPO=document.getElementById('btnAddPO');
    const addEXP=document.getElementById('btnAddEXP');
    // Bind Invoice from SO button
    const btnSOToINV = document.getElementById('btnSOToINV');
    if(btnSOToINV){
      btnSOToINV.addEventListener('click', async ()=>{
        try{
          const res = await api.get(`/pm/projects/${projectId}/sales-orders`);
          const items = res.items||[];
          if(!items.length) return alert('No Sales Orders found for this project');
          const confirmed = items.find(it=> it.status==='Confirmed') || items[0];
          const invRes = await api.post(`/pm/sales-orders/${confirmed._id}/convert-invoice`, {});
          await loadBilling();
          alert('Invoice created from '+(confirmed.number||'SO'));
        }catch(e){ alert(e.message); }
      });
    }
    if(addINV){ addINV.addEventListener('click', ()=> openAddDocModal('invoice')); }
    if(addBILL){ addBILL.addEventListener('click', ()=> openAddDocModal('bill')); }
    if(addSO){ addSO.addEventListener('click', ()=> openLinkDocModal('so')); }
    if(addPO){ addPO.addEventListener('click', ()=> openLinkDocModal('po')); }
    if(addEXP){ addEXP.addEventListener('click', ()=> openAddDocModal('expense')); }
    // quick finance panel actions
    const qInv=document.getElementById('qCreateInv'); if(qInv){ qInv.addEventListener('click', async ()=>{ const a=Number(document.getElementById('qInvAmt').value||'0'); if(!(a>0)) return alert('Enter amount'); try{ await api.post(`/pm/projects/${projectId}/billing/invoice`, { amount:a }); await loadBilling(); }catch(e){ alert(e.message); } }); }
    const qBill=document.getElementById('qCreateBill'); if(qBill){ qBill.addEventListener('click', async ()=>{ const a=Number(document.getElementById('qBillAmt').value||'0'); if(!(a>0)) return alert('Enter amount'); try{ await api.post(`/pm/projects/${projectId}/linked-docs`, { type:'VendorBill', refId: 'Quick', meta:{ amount:a, status:'Pending' } }); await loadBilling(); }catch(e){ alert(e.message); } }); }
    const qExp=document.getElementById('qCreateExp'); if(qExp){ qExp.addEventListener('click', async ()=>{ const a=Number(document.getElementById('qExpAmt').value||'0'); if(!(a>0)) return alert('Enter amount'); try{ await api.post(`/pm/projects/${projectId}/expenses`, { amount:a, description:'Quick expense' }); await loadBilling(); }catch(e){ alert(e.message); } }); }
    ui.bindClose();
  }

  async function loadDocumentsForLinking(){
    if(!projectId) return;
    try{
      // Load all documents that are not linked to this project
      const [sos, pos, invoices, bills, expenses] = await Promise.all([
        api.get('/finance/sales-orders').catch(()=>({items:[]})),
        api.get('/finance/purchase-orders').catch(()=>({items:[]})),
        api.get('/finance/invoices').catch(()=>({items:[]})),
        api.get('/finance/vendor-bills').catch(()=>({items:[]})),
        api.get('/expenses').catch(()=>({expenses:[]}))
      ]);
      
      // Populate dropdowns
      const linkSO = document.getElementById('linkSO');
      const linkPO = document.getElementById('linkPO');
      const linkInvoice = document.getElementById('linkInvoice');
      const linkBill = document.getElementById('linkBill');
      const linkExpense = document.getElementById('linkExpense');
      
      if(linkSO){
        const unlinkedSOs = (sos.items||[]).filter(so => !so.project || String(so.project) !== String(projectId));
        linkSO.innerHTML = '<option value="">Select SO...</option>' + 
          (unlinkedSOs.length > 0 
            ? unlinkedSOs.map(so => `<option value="${so._id}">${so.number || so._id} - ${so.customer || ''} (₹${(so.amount||0).toLocaleString()})</option>`).join('')
            : '<option value="" disabled>No unlinked Sales Orders found</option>');
        // Remove existing event listeners by cloning the element
        const newLinkSO = linkSO.cloneNode(true);
        linkSO.parentNode.replaceChild(newLinkSO, linkSO);
        newLinkSO.addEventListener('change', async (e)=>{
          if(!e.target.value) return;
          try{
            const selectedSO = unlinkedSOs.find(s=>String(s._id)===e.target.value);
            await api.post(`/pm/projects/${projectId}/linked-docs`, { 
              type:'SO', 
              refId: e.target.value, 
              meta:{ partner: selectedSO?.customer||'', amount: selectedSO?.amount||0 } 
            });
            await loadBilling();
            await loadDocumentsForLinking(); // Reload to update dropdown
            alert('Sales Order linked successfully');
          }catch(err){ alert(err.message); }
        });
      }
      
      if(linkPO){
        const unlinkedPOs = (pos.items||[]).filter(po => !po.project || String(po.project) !== String(projectId));
        linkPO.innerHTML = '<option value="">Select PO...</option>' + 
          (unlinkedPOs.length > 0 
            ? unlinkedPOs.map(po => `<option value="${po._id}">${po.number || po._id} - ${po.vendor || ''} (₹${(po.amount||0).toLocaleString()})</option>`).join('')
            : '<option value="" disabled>No unlinked Purchase Orders found</option>');
        const newLinkPO = linkPO.cloneNode(true);
        linkPO.parentNode.replaceChild(newLinkPO, linkPO);
        newLinkPO.addEventListener('change', async (e)=>{
          if(!e.target.value) return;
          try{
            const selectedPO = unlinkedPOs.find(p=>String(p._id)===e.target.value);
            await api.post(`/pm/projects/${projectId}/linked-docs`, { 
              type:'PO', 
              refId: e.target.value, 
              meta:{ partner: selectedPO?.vendor||'', amount: selectedPO?.amount||0 } 
            });
            await loadBilling();
            await loadDocumentsForLinking(); // Reload to update dropdown
            alert('Purchase Order linked successfully');
          }catch(err){ alert(err.message); }
        });
      }
      
      if(linkInvoice){
        const unlinkedInvoices = (invoices.items||[]).filter(inv => !inv.project || String(inv.project) !== String(projectId));
        linkInvoice.innerHTML = '<option value="">Select Invoice...</option>' + 
          (unlinkedInvoices.length > 0 
            ? unlinkedInvoices.map(inv => `<option value="${inv._id}">${inv.number || inv._id} - ${inv.customer || ''} (₹${(inv.amount||0).toLocaleString()})</option>`).join('')
            : '<option value="" disabled>No unlinked Invoices found</option>');
        const newLinkInvoice = linkInvoice.cloneNode(true);
        linkInvoice.parentNode.replaceChild(newLinkInvoice, linkInvoice);
        newLinkInvoice.addEventListener('change', async (e)=>{
          if(!e.target.value) return;
          try{
            const selectedInv = unlinkedInvoices.find(i=>String(i._id)===e.target.value);
            await api.post(`/pm/projects/${projectId}/linked-docs`, { 
              type:'CustomerInvoice', 
              refId: e.target.value, 
              meta:{ partner: selectedInv?.customer||'', amount: selectedInv?.amount||0 } 
            });
            await loadBilling();
            await loadDocumentsForLinking(); // Reload to update dropdown
            alert('Invoice linked successfully');
          }catch(err){ alert(err.message); }
        });
      }
      
      if(linkBill){
        const unlinkedBills = (bills.items||[]).filter(bill => !bill.project || String(bill.project) !== String(projectId));
        linkBill.innerHTML = '<option value="">Select Bill...</option>' + 
          (unlinkedBills.length > 0 
            ? unlinkedBills.map(bill => `<option value="${bill._id}">${bill.number || bill._id} - ${bill.vendor || ''} (₹${(bill.amount||0).toLocaleString()})</option>`).join('')
            : '<option value="" disabled>No unlinked Vendor Bills found</option>');
        const newLinkBill = linkBill.cloneNode(true);
        linkBill.parentNode.replaceChild(newLinkBill, linkBill);
        newLinkBill.addEventListener('change', async (e)=>{
          if(!e.target.value) return;
          try{
            const selectedBill = unlinkedBills.find(b=>String(b._id)===e.target.value);
            await api.post(`/pm/projects/${projectId}/linked-docs`, { 
              type:'VendorBill', 
              refId: e.target.value, 
              meta:{ partner: selectedBill?.vendor||'', amount: selectedBill?.amount||0 } 
            });
            await loadBilling();
            await loadDocumentsForLinking(); // Reload to update dropdown
            alert('Vendor Bill linked successfully');
          }catch(err){ alert(err.message); }
        });
      }
      
      if(linkExpense){
        const expenseList = expenses.expenses || [];
        const unlinkedExpenses = expenseList.filter(exp => !exp.project || String(exp.project) !== String(projectId));
        linkExpense.innerHTML = '<option value="">Select Expense...</option>' + 
          (unlinkedExpenses.length > 0 
            ? unlinkedExpenses.map(exp => `<option value="${exp._id}">${exp.description || exp.expenseName || exp._id} - ${exp.submittedBy?.name || 'Team'} (₹${(exp.amount||0).toLocaleString()})</option>`).join('')
            : '<option value="" disabled>No unlinked Expenses found</option>');
        const newLinkExpense = linkExpense.cloneNode(true);
        linkExpense.parentNode.replaceChild(newLinkExpense, linkExpense);
        newLinkExpense.addEventListener('change', async (e)=>{
          if(!e.target.value) return;
          try{
            const selectedExp = unlinkedExpenses.find(ex=>String(ex._id)===e.target.value);
            await api.post(`/pm/projects/${projectId}/linked-docs`, { 
              type:'Expense', 
              refId: e.target.value, 
              meta:{ partner: selectedExp?.submittedBy?.name || 'Team', amount: selectedExp?.amount||0, status: selectedExp?.status || 'pending' } 
            });
            await loadBilling();
            await loadDocumentsForLinking(); // Reload to update dropdown
            alert('Expense linked successfully');
          }catch(err){ alert(err.message); }
        });
      }
    }catch(e){ console.warn('Failed to load documents for linking', e); }
  }

  function bindSettings(){
    // Create Sales Order
    const btnCreateSO = document.getElementById('btnCreateSO');
    if(btnCreateSO){
      btnCreateSO.addEventListener('click', async ()=>{
        const customer = document.getElementById('sCustomer').value.trim();
        const amount = Number(document.getElementById('sAmount').value||0);
        if(!customer || !(amount>0)) return alert('Customer and amount required');
        try{
          const so = await api.post('/finance/sales-orders', { customer, project: projectId, amount });
          await api.post(`/pm/projects/${projectId}/linked-docs`, { 
            type:'SO', 
            refId: so?.item?.number || so?.invoice?.number || 'SO', 
            meta:{ partner: customer, amount, status: so?.item?.status || 'Draft' } 
          });
          document.getElementById('sCustomer').value = '';
          document.getElementById('sAmount').value = '';
          await loadBilling();
          await loadDocumentsForLinking();
          alert('Sales Order created and linked');
        }catch(e){ alert(e.message); }
      });
    }
    
    // Create Purchase Order
    const btnCreatePO = document.getElementById('btnCreatePO');
    if(btnCreatePO){
      btnCreatePO.addEventListener('click', async ()=>{
        const vendor = document.getElementById('pVendor').value.trim();
        const amount = Number(document.getElementById('pAmount').value||0);
        if(!vendor || !(amount>0)) return alert('Vendor and amount required');
        try{
          const po = await api.post('/finance/purchase-orders', { vendor, project: projectId, amount });
          await api.post(`/pm/projects/${projectId}/linked-docs`, { 
            type:'PO', 
            refId: po?.item?.number || 'PO', 
            meta:{ partner: vendor, amount, status: po?.item?.status || 'Draft' } 
          });
          document.getElementById('pVendor').value = '';
          document.getElementById('pAmount').value = '';
          await loadBilling();
          await loadDocumentsForLinking();
          alert('Purchase Order created and linked');
        }catch(e){ alert(e.message); }
      });
    }
    
    // Create Customer Invoice
    const btnCreateInvoice = document.getElementById('btnCreateInvoice');
    if(btnCreateInvoice){
      btnCreateInvoice.addEventListener('click', async ()=>{
        const customer = document.getElementById('iCustomer').value.trim();
        const amount = Number(document.getElementById('iAmount').value||0);
        if(!customer || !(amount>0)) return alert('Customer and amount required');
        try{
          const inv = await api.post('/finance/invoices', { customer, project: projectId, amount });
          // Link the invoice to the project
          await api.post(`/pm/projects/${projectId}/linked-docs`, { 
            type:'CustomerInvoice', 
            refId: inv?.item?.number || inv?.item?._id || 'INV', 
            meta:{ partner: customer, amount, status: inv?.item?.status || 'Draft' } 
          });
          document.getElementById('iCustomer').value = '';
          document.getElementById('iAmount').value = '';
          await loadBilling();
          await loadDocumentsForLinking();
          alert('Invoice created and linked');
        }catch(e){ alert(e.message); }
      });
    }
    
    // Create Vendor Bill
    const btnCreateBill = document.getElementById('btnCreateBill');
    if(btnCreateBill){
      btnCreateBill.addEventListener('click', async ()=>{
        const vendor = document.getElementById('bVendor').value.trim();
        const amount = Number(document.getElementById('bAmount').value||0);
        if(!vendor || !(amount>0)) return alert('Vendor and amount required');
        try{
          const bill = await api.post('/finance/vendor-bills', { vendor, project: projectId, amount });
          // Link the bill to the project
          await api.post(`/pm/projects/${projectId}/linked-docs`, { 
            type:'VendorBill', 
            refId: bill?.item?.number || bill?.item?._id || 'BILL', 
            meta:{ partner: vendor, amount, status: bill?.item?.status || 'Draft' } 
          });
          document.getElementById('bVendor').value = '';
          document.getElementById('bAmount').value = '';
          await loadBilling();
          await loadDocumentsForLinking();
          alert('Vendor Bill created and linked');
        }catch(e){ alert(e.message); }
      });
    }
    
    // Create Expense
    const btnCreateExpense = document.getElementById('btnCreateExpense');
    if(btnCreateExpense){
      btnCreateExpense.addEventListener('click', async ()=>{
        const description = document.getElementById('eDescription').value.trim();
        const amount = Number(document.getElementById('eAmount').value||0);
        if(!description || !(amount>0)) return alert('Description and amount required');
        try{
          await api.post(`/pm/projects/${projectId}/expenses`, { amount, description });
          await api.post(`/pm/projects/${projectId}/linked-docs`, { 
            type:'Expense', 
            refId: description, 
            meta:{ partner:'Team', amount, status:'submitted' } 
          });
          document.getElementById('eDescription').value = '';
          document.getElementById('eAmount').value = '';
          await loadBilling();
          alert('Expense created and linked');
        }catch(e){ alert(e.message); }
      });
    }
    
    // Trigger Invoice from SO
    const btnTriggerInvoice = document.getElementById('btnTriggerInvoice');
    if(btnTriggerInvoice){
      btnTriggerInvoice.addEventListener('click', async ()=>{
        try{
          const res = await api.get(`/pm/projects/${projectId}/sales-orders`);
          const items = res.items||[];
          if(!items.length) return alert('No Sales Orders found for this project');
          const confirmed = items.find(it=> it.status==='Confirmed') || items[0];
          const invRes = await api.post(`/pm/sales-orders/${confirmed._id}/convert-invoice`, {});
          await loadBilling();
          await loadDocumentsForLinking();
          alert('Invoice created from '+(confirmed.number||'SO'));
        }catch(e){ alert(e.message); }
      });
    }
  }

  function openAddDocModal(type){
    const modal = document.getElementById('modalAddDoc');
    const title = document.getElementById('modalAddDocTitle');
    const content = document.getElementById('modalAddDocContent');
    const saveBtn = document.getElementById('modalAddDocSave');
    if(!modal || !title || !content || !saveBtn) return;
    
    const labels = {
      'so': 'Create Sales Order',
      'po': 'Create Purchase Order',
      'invoice': 'Create Customer Invoice',
      'bill': 'Create Vendor Bill',
      'expense': 'Create Expense'
    };
    
    title.textContent = labels[type] || 'Add Document';
    
    if(type === 'so'){
      content.innerHTML = `
        <label>Customer Name</label>
        <input id="docCustomer" placeholder="Enter customer name" />
        <label>Amount (₹)</label>
        <input id="docAmount" type="number" step="0.01" min="0" placeholder="Enter amount" />
      `;
      saveBtn.onclick = async ()=>{
        const customer = document.getElementById('docCustomer').value.trim();
        const amount = Number(document.getElementById('docAmount').value||0);
        if(!customer || !(amount>0)) return alert('Customer name and amount are required');
        try{
          const so = await api.post('/finance/sales-orders', { customer, project: projectId, amount });
          await api.post(`/pm/projects/${projectId}/linked-docs`, { type:'SO', refId: so?.item?.number || 'SO', meta:{ partner: customer, amount, status: so?.item?.status } });
          await loadBilling();
          ui.closeModal('modalAddDoc');
          alert('Sales Order created and linked');
        }catch(e){ alert(e.message); }
      };
    } else if(type === 'po'){
      content.innerHTML = `
        <label>Vendor Name</label>
        <input id="docVendor" placeholder="Enter vendor name" />
        <label>Amount (₹)</label>
        <input id="docAmount" type="number" step="0.01" min="0" placeholder="Enter amount" />
      `;
      saveBtn.onclick = async ()=>{
        const vendor = document.getElementById('docVendor').value.trim();
        const amount = Number(document.getElementById('docAmount').value||0);
        if(!vendor || !(amount>0)) return alert('Vendor name and amount are required');
        try{
          const po = await api.post('/finance/purchase-orders', { vendor, project: projectId, amount });
          await api.post(`/pm/projects/${projectId}/linked-docs`, { type:'PO', refId: po?.item?.number || 'PO', meta:{ partner: vendor, amount, status: po?.item?.status } });
          await loadBilling();
          ui.closeModal('modalAddDoc');
          alert('Purchase Order created and linked');
        }catch(e){ alert(e.message); }
      };
    } else if(type === 'invoice'){
      content.innerHTML = `
        <label>Customer Name</label>
        <input id="docCustomer" placeholder="Enter customer name" />
        <label>Amount (₹)</label>
        <input id="docAmount" type="number" step="0.01" min="0" placeholder="Enter amount" />
      `;
      saveBtn.onclick = async ()=>{
        const customer = document.getElementById('docCustomer').value.trim();
        const amount = Number(document.getElementById('docAmount').value||0);
        if(!customer || !(amount>0)) return alert('Customer name and amount are required');
        try{
          await api.post('/finance/invoices', { customer, project: projectId, amount });
          await loadBilling();
          ui.closeModal('modalAddDoc');
          alert('Invoice created and linked');
        }catch(e){ alert(e.message); }
      };
    } else if(type === 'bill'){
      content.innerHTML = `
        <label>Vendor Name</label>
        <input id="docVendor" placeholder="Enter vendor name" />
        <label>Amount (₹)</label>
        <input id="docAmount" type="number" step="0.01" min="0" placeholder="Enter amount" />
      `;
      saveBtn.onclick = async ()=>{
        const vendor = document.getElementById('docVendor').value.trim();
        const amount = Number(document.getElementById('docAmount').value||0);
        if(!vendor || !(amount>0)) return alert('Vendor name and amount are required');
        try{
          await api.post('/finance/vendor-bills', { vendor, project: projectId, amount });
          await loadBilling();
          ui.closeModal('modalAddDoc');
          alert('Vendor Bill created and linked');
        }catch(e){ alert(e.message); }
      };
    } else if(type === 'expense'){
      content.innerHTML = `
        <label>Description</label>
        <input id="docDescription" placeholder="Enter expense description" />
        <label>Amount (₹)</label>
        <input id="docAmount" type="number" step="0.01" min="0" placeholder="Enter amount" />
      `;
      saveBtn.onclick = async ()=>{
        const description = document.getElementById('docDescription').value.trim();
        const amount = Number(document.getElementById('docAmount').value||0);
        if(!description || !(amount>0)) return alert('Description and amount are required');
        try{
          await api.post(`/pm/projects/${projectId}/expenses`, { amount, description });
          await api.post(`/pm/projects/${projectId}/linked-docs`, { type:'Expense', refId: description, meta:{ partner:'Team', amount, status:'submitted' } });
          await loadBilling();
          ui.closeModal('modalAddDoc');
          alert('Expense created and linked');
        }catch(e){ alert(e.message); }
      };
    }
    
    ui.openModal('modalAddDoc');
  }

  async function openLinkDocModal(type){
    const modal = document.getElementById('modalAddDoc');
    const title = document.getElementById('modalAddDocTitle');
    const content = document.getElementById('modalAddDocContent');
    const saveBtn = document.getElementById('modalAddDocSave');
    if(!modal || !title || !content || !saveBtn) return;
    
    title.textContent = type === 'so' ? 'Link Sales Order' : 'Link Purchase Order';
    
    try{
      const endpoint = type === 'so' ? '/finance/sales-orders' : '/finance/purchase-orders';
      const res = await api.get(endpoint);
      const items = res.items || [];
      const unlinked = items.filter(item => !item.project || String(item.project) !== String(projectId));
      
      if(unlinked.length === 0){
        return alert(`No unlinked ${type === 'so' ? 'Sales Orders' : 'Purchase Orders'} found. Create one first or use the Settings tab to link existing documents.`);
      }
      
      content.innerHTML = `
        <label>Select ${type === 'so' ? 'Sales Order' : 'Purchase Order'}</label>
        <select id="linkDocSelect" class="button-outline" style="padding:.55rem .7rem">
          <option value="">Select ${type === 'so' ? 'SO' : 'PO'}...</option>
          ${unlinked.map(item => `<option value="${item._id}" data-partner="${type === 'so' ? (item.customer || '') : (item.vendor || '')}" data-amount="${item.amount || 0}">${item.number || item._id} - ${type === 'so' ? (item.customer || '') : (item.vendor || '')} (₹${(item.amount||0).toLocaleString()})</option>`).join('')}
        </select>
      `;
      
      saveBtn.onclick = async ()=>{
        const select = document.getElementById('linkDocSelect');
        const selectedId = select.value;
        if(!selectedId) return alert('Please select a document');
        
        const selectedOption = select.options[select.selectedIndex];
        const partner = selectedOption.dataset.partner || '';
        const amount = Number(selectedOption.dataset.amount || 0);
        
        try{
          await api.post(`/pm/projects/${projectId}/linked-docs`, { 
            type: type === 'so' ? 'SO' : 'PO', 
            refId: selectedId, 
            meta:{ partner, amount } 
          });
          await loadBilling();
          await loadDocumentsForLinking();
          ui.closeModal('modalAddDoc');
          alert(`${type === 'so' ? 'Sales Order' : 'Purchase Order'} linked successfully`);
        }catch(e){ alert(e.message); }
      };
      
      ui.openModal('modalAddDoc');
    }catch(e){
      alert('Failed to load documents: ' + (e.message || 'Unknown error'));
    }
  }

  async function start(){ 
    await loadProject(); 
    await loadBilling(); 
    await loadDocumentsForLinking();
    charts(); 
    bind(); 
    bindSettings();
  }
  document.addEventListener('DOMContentLoaded', start);
})();
