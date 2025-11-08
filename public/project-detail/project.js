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
      docsTbody().innerHTML='';
      (res.billing||[]).forEach(r=> addDoc(r.type==='revenue'?'Revenue':'Expense', r));
    }catch(e){ /* silent */ }
  }

  function charts(){ if(!window.Chart) return; const ctx=document.getElementById('chartProgress');
    // For now progress from summary.progress
    const done = summary.progress || 0; const remaining = 100 - done;
    new Chart(ctx,{ type:'bar', data:{ labels:['Done','Remaining'], datasets:[{label:'Tasks', data:[done,remaining], backgroundColor:['#10b981','#4f9fff55'], borderColor:['#10b981','#4f9fff']}] }, options:{ plugins:{legend:{labels:{color:'#e6edf5'}}}, scales:{x:{ticks:{color:'#9aa9bd'}},y:{ticks:{color:'#9aa9bd'}}}} }); }

  function bind(){
    document.getElementById('btnAI').addEventListener('click',()=> ui.openModal('modalAI'));
    ui.bindClose();
  }

  async function start(){ await loadProject(); await loadBilling(); charts(); bind(); }
  document.addEventListener('DOMContentLoaded', start);
})();
