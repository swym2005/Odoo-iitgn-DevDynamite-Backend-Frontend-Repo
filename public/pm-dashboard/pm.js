(function(){
  const { api, ui } = window.FlowIQ;
  const tbody = () => document.querySelector('#tblProjects tbody');
  let selected=null;

  async function loadProjects(){
    const res = await api.get('/pm/projects');
    return res.projects || [];
  }

  async function loadKPIs(){
    const res = await api.get('/pm/dashboard');
    const k = res.KPIs || {};
    document.getElementById('kpiActive').textContent = k.activeProjects ?? '0';
    document.getElementById('kpiProfit').textContent = ((k.profitPercent||0)*100).toFixed(1)+'%';
    document.getElementById('kpiHours').textContent = (k.hoursLogged||0)+'h';
    document.getElementById('kpiPending').textContent = k.pendingApprovals ?? '0';
  }

  function render(list){
    tbody().innerHTML='';
    list.forEach(p=>{
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${p.name}</td><td>${p.client||''}</td><td>${p.status}</td><td>₹ ${(p.budget||0).toLocaleString()}</td><td>${p.revenue? ((p.revenue-p.cost)/p.revenue*100).toFixed(1)+'%':'--'}</td><td>${p.deadline? new Date(p.deadline).toISOString().slice(0,10):''}</td><td><button class='table-btn btn-select' data-id='${p._id}'>Select</button></td>`;
      tr.addEventListener('click',()=>{ selected=p; document.querySelectorAll('#tblProjects tbody tr').forEach(r=>r.classList.remove('row-selected')); tr.classList.add('row-selected'); });
      tbody().appendChild(tr);
    });
    // bind select buttons
    document.querySelectorAll('.btn-select').forEach(btn=> btn.addEventListener('click',e=>{ e.stopPropagation(); const id=btn.dataset.id; const proj=list.find(x=> String(x._id)===id); if(proj){ selected=proj; document.querySelectorAll('#tblProjects tbody tr').forEach(r=>r.classList.remove('row-selected')); btn.closest('tr').classList.add('row-selected'); } }));
  }

  function charts(){ api.get('/pm/analytics').then(res=>{ if(!window.Chart) return; const cvr=document.getElementById('chartCvR'); const util=document.getElementById('chartUtil'); const cvrLabels=res.projectProgress.map(p=>p.name); const costData=res.costVsRevenue.map(x=>x.cost); const revData=res.costVsRevenue.map(x=>x.revenue); new Chart(cvr,{ type:'line', data:{ labels:cvrLabels, datasets:[{ label:'Cost', data:costData, borderColor:'#ef4444', backgroundColor:'#ef444433' },{ label:'Revenue', data:revData, borderColor:'#10b981', backgroundColor:'#10b98133' }] }, options:{ plugins:{legend:{labels:{color:'#e6edf5'}}}, scales:{x:{ticks:{color:'#9aa9bd'}},y:{ticks:{color:'#9aa9bd'}}}} }); const utilLabels=res.utilization.map(u=>u.userId); const utilData=res.utilization.map(u=> Math.round(u.utilization*100)); new Chart(util,{ type:'bar', data:{ labels:utilLabels, datasets:[{ label:'Utilization %', data:utilData, backgroundColor:'#4f9fff55', borderColor:'#4f9fff' }] }, options:{ plugins:{legend:{labels:{color:'#e6edf5'}}}, scales:{x:{ticks:{color:'#9aa9bd'}},y:{ticks:{color:'#9aa9bd'}}}} }); }).catch(()=>{}); }

  async function createProject(){
    const name=document.getElementById('pName').value.trim(); if(!name) return alert('Project name required');
    const desc=document.getElementById('pDesc').value.trim();
    const budget=Number(document.getElementById('pBudget').value||0);
    const deadline=document.getElementById('pDeadline').value||null;
    // parse team emails if provided (optional enhancement later to map to ids)
    const teamRaw = (document.getElementById('pTeam').value||'').trim();
    const manager = (window.FlowIQ.auth.user() && (window.FlowIQ.auth.user()._id || window.FlowIQ.auth.user().id)) || undefined;
    const payload = { name, description:desc, budget, deadline, manager };
    try{ await api.post('/pm/projects', payload); ui.closeModal('modalProject'); start(); }catch(e){ alert(e.message); }
  }

  async function loadPendingExpenses(){
    if(!selected) return alert('Select a project');
    try{ const res = await api.get(`/pm/projects/${selected._id}/expenses`); const pend=(res.expenses||[]).filter(e=> e.status==='pending'); const body=document.querySelector('#tblPendExp tbody'); body.innerHTML=''; pend.forEach(e=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td>${e.description||e.expenseName||''}</td><td>₹ ${(e.amount||0).toLocaleString()}</td><td>${e.submittedBy?.name||''}</td><td>${e.date? new Date(e.date).toISOString().slice(0,10):''}</td><td><button class='table-btn approve' data-id='${e._id}'>Approve</button><button class='table-btn reject' data-id='${e._id}'>Reject</button></td>`; body.appendChild(tr); }); body.querySelectorAll('.approve').forEach(b=> b.addEventListener('click',()=> changeExpenseStatus(b.dataset.id,'approve'))); body.querySelectorAll('.reject').forEach(b=> b.addEventListener('click',()=> changeExpenseStatus(b.dataset.id,'reject'))); ui.openModal('modalExp'); }catch(err){ alert('Failed to load expenses'); }
  }
  async function changeExpenseStatus(id,action){
    try{ await api.post(`/pm/projects/${selected._id}/expenses/${id}/${action==='approve'?'approve':'reject'}`,{}); await loadPendingExpenses(); }catch(e){ alert('Update failed'); }
  }

  function bind(){
    document.getElementById('btnNewProj').addEventListener('click',()=> ui.openModal('modalProject'));
    document.getElementById('pCreateBtn').addEventListener('click', createProject);
    ui.bindClose();
    document.getElementById('btnView').addEventListener('click',()=>{ if(!selected) return alert('Select a project'); window.location.href='/project-detail/?id='+selected._id; });
    document.getElementById('btnTask').addEventListener('click',()=>{ if(!selected) return alert('Select a project'); window.location.href='/tasks/?projectId='+selected._id; });
    const approveBtn=document.getElementById('btnApprove'); if(approveBtn){ approveBtn.addEventListener('click', loadPendingExpenses); }
  }

  async function start(){
    try{ const projects = await loadProjects(); render(projects); await loadKPIs(); charts(); }catch(e){ alert('Failed to load projects: '+e.message); }
  }
  document.addEventListener('DOMContentLoaded',()=>{ bind(); start(); });
})();
