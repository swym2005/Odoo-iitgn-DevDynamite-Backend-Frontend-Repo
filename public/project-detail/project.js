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

  function charts(){ if(!window.Chart) return; const ctx=document.getElementById('chartProgress');
    // For now progress from summary.progress
    const done = summary.progress || 0; const remaining = 100 - done;
    new Chart(ctx,{ type:'bar', data:{ labels:['Done','Remaining'], datasets:[{label:'Tasks', data:[done,remaining], backgroundColor:['#10b981','#4f9fff55'], borderColor:['#10b981','#4f9fff']}] }, options:{ plugins:{legend:{labels:{color:'#e6edf5'}}}, scales:{x:{ticks:{color:'#9aa9bd'}},y:{ticks:{color:'#9aa9bd'}}}} }); }

  function bind(){
    // tabs
    document.querySelectorAll('.tab-btn').forEach(btn=>{
      btn.addEventListener('click',()=>{
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
    // Inject SO->Invoice button if not present
    const toolbar = document.querySelector('[data-panel="linked"] .space-between .flex');
    if(toolbar && !document.getElementById('btnSOToINV')){
      const btn=document.createElement('button'); btn.className='button-outline'; btn.id='btnSOToINV'; btn.textContent='Invoice from SO'; btn.title='Convert latest Sales Order to Customer Invoice'; toolbar.insertBefore(btn, toolbar.querySelector('#btnAddPO'));
      btn.addEventListener('click', async ()=>{
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
    if(addINV){ addINV.addEventListener('click', async ()=>{
      const customer = prompt('Customer name?'); if(!customer) return;
      const amount = Number(prompt('Invoice amount?')||'0'); if(!(amount>0)) return alert('Invalid amount');
      try{ await api.post(`/pm/projects/${projectId}/billing/invoice`, { amount }); await api.post(`/pm/projects/${projectId}/linked-docs`, { type:'INV', refId: 'Quick', meta:{ partner: customer, amount, status:'Draft' } }); await loadBilling(); }catch(e){ alert(e.message); }
    }); }
    if(addBILL){ addBILL.addEventListener('click', async ()=>{
      const vendor = prompt('Vendor?'); if(!vendor) return;
      const amount = Number(prompt('Bill amount?')||'0'); if(!(amount>0)) return alert('Invalid amount');
      try{ await api.post(`/pm/projects/${projectId}/linked-docs`, { type:'BILL', refId: 'New', meta:{ partner: vendor, amount, status:'Pending' } }); await loadBilling(); }catch(e){ alert(e.message); }
    }); }
    if(addSO){ addSO.addEventListener('click', async ()=>{
      const customer = prompt('Customer for SO?'); if(!customer) return;
      const amount = Number(prompt('SO amount?')||'0'); if(!(amount>0)) return alert('Invalid amount');
      try{ const so = await api.post('/finance/sales-orders', { customer, project: projectId, amount });
        await api.post(`/pm/projects/${projectId}/linked-docs`, { type:'SO', refId: so?.item?.number || 'SO', meta:{ partner: customer, amount, status: so?.item?.status } });
        await loadBilling();
      }catch(e){ alert(e.message); }
    }); }
    if(addPO){ addPO.addEventListener('click', async ()=>{
      const vendor = prompt('Vendor for PO?'); if(!vendor) return;
      const amount = Number(prompt('PO amount?')||'0'); if(!(amount>0)) return alert('Invalid amount');
      try{ const po = await api.post('/finance/purchase-orders', { vendor, project: projectId, amount });
        await api.post(`/pm/projects/${projectId}/linked-docs`, { type:'PO', refId: po?.item?.number || 'PO', meta:{ partner: vendor, amount, status: po?.item?.status } });
        await loadBilling();
      }catch(e){ alert(e.message); }
    }); }
    if(addEXP){ addEXP.addEventListener('click', async ()=>{
      const amount = Number(prompt('Expense amount?')||'0'); if(!(amount>0)) return alert('Invalid amount');
      const desc = prompt('Expense description?') || 'Expense';
      try{ await api.post(`/pm/projects/${projectId}/expenses`, { amount, description: desc, date: new Date().toISOString().slice(0,10) }); await api.post(`/pm/projects/${projectId}/linked-docs`, { type:'EXP', refId: desc, meta:{ partner:'Team', amount, status:'submitted' } }); await loadBilling(); }catch(e){ alert(e.message); }
    }); }
    // quick finance panel actions
    const qInv=document.getElementById('qCreateInv'); if(qInv){ qInv.addEventListener('click', async ()=>{ const a=Number(document.getElementById('qInvAmt').value||'0'); if(!(a>0)) return alert('Enter amount'); try{ await api.post(`/pm/projects/${projectId}/billing/invoice`, { amount:a }); await loadBilling(); }catch(e){ alert(e.message); } }); }
    const qBill=document.getElementById('qCreateBill'); if(qBill){ qBill.addEventListener('click', async ()=>{ const a=Number(document.getElementById('qBillAmt').value||'0'); if(!(a>0)) return alert('Enter amount'); try{ await api.post(`/pm/projects/${projectId}/linked-docs`, { type:'BILL', refId: 'Quick', meta:{ amount:a, status:'Pending' } }); await loadBilling(); }catch(e){ alert(e.message); } }); }
    const qExp=document.getElementById('qCreateExp'); if(qExp){ qExp.addEventListener('click', async ()=>{ const a=Number(document.getElementById('qExpAmt').value||'0'); if(!(a>0)) return alert('Enter amount'); try{ await api.post(`/pm/projects/${projectId}/expenses`, { amount:a, description:'Quick expense' }); await loadBilling(); }catch(e){ alert(e.message); } }); }
    ui.bindClose();
  }

  async function start(){ await loadProject(); await loadBilling(); charts(); bind(); }
  document.addEventListener('DOMContentLoaded', start);
})();
