(function(){
  const { api, ui } = window.FlowIQ;
  const cardsList = () => document.getElementById('cardsList');
  let selected=null;

  function escapeHtml(str){ return String(str||'').replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[s])); }

  function projectCardMarkup(p){
  const profitPct = p.revenue? (((p.revenue||0)-(p.cost||0))/(p.revenue||1)*100).toFixed(1):'--';
  const progress = p.progress!=null? p.progress : 0;
  const budget = Number(p.budget||0);
  const cost = Number(p.cost||0);
  const usage = budget>0 ? Math.min(100, Math.round(cost/budget*100)) : 0;
    return `
      <div class="project-card" data-id="${p._id}">
        <div class="thumb">🗂️</div>
        <div class="row"><span class="title">${escapeHtml(p.name)}</span><span class="status-chip">${escapeHtml(p.status)}</span></div>
        <div class="meta">
          <div class="row"><span>Client</span><span>${escapeHtml(p.client||'—')}</span></div>
          <div class="row"><span>Budget</span><span>₹ ${(p.budget||0).toLocaleString()}</span></div>
          <div class="row"><span>Profit</span><span>${profitPct==='--'?'--': profitPct+'%'}</span></div>
          <div class="row"><span>Deadline</span><span>${p.deadline? new Date(p.deadline).toISOString().slice(0,10): '—'}</span></div>
        </div>
  <div class="progress"><span style="width:${progress}%"></span></div>
  <div class="progress budget" title="Budget used: ${usage}%"><span style="width:${usage}%"></span></div>
        <div class="actions">
          <a class="button-outline btn-view" href="/project-detail/?id=${p._id}">View</a>
          <a class="button-outline btn-tasks" href="/tasks/?projectId=${p._id}">Tasks</a>
        </div>
      </div>`;
  }

  async function loadProjects(){
    try{
      const res = await api.get('/pm/projects');
      return res.projects || [];
    }catch(e){
      console.warn('Projects load failed', e);
      return [];
    }
  }

  async function loadKPIs(){
    const res = await api.get('/pm/dashboard');
    const k = res.KPIs || {};
    document.getElementById('kpiActive').textContent = k.activeProjects ?? '0';
    document.getElementById('kpiProfit').textContent = ((k.profitPercent||0)*100).toFixed(1)+'%';
    document.getElementById('kpiHours').textContent = (k.hoursLogged||0)+'h'; // default (all projects)
    document.getElementById('kpiPending').textContent = k.pendingApprovals ?? '0';
  }

  async function updateHoursForSelected(){
    if(!selected) return;
    try{
      const res = await api.get(`/pm/projects/${selected._id}/timesheets`);
      const total = (res.timesheets||[]).reduce((s,t)=> s + Number(t.hours||0), 0);
      document.getElementById('kpiHours').textContent = total + 'h';
    }catch(e){ /* keep default if fails */ }
  }

  function render(list){
    const wrap = cardsList();
    if(!wrap) return;
    wrap.innerHTML='';
    if(!Array.isArray(list) || list.length===0){
      const empty=document.createElement('div');
      empty.style.cssText='padding:1rem;opacity:.7';
      empty.textContent='No projects found for your scope.';
      wrap.appendChild(empty);
      return;
    }
    list.forEach(p=>{ wrap.insertAdjacentHTML('beforeend', projectCardMarkup(p)); });
    // bind selection on cards
    wrap.querySelectorAll('.project-card').forEach(card=>{
      card.addEventListener('click',()=>{
        const id = card.getAttribute('data-id');
        const proj = list.find(x=> String(x._id)===String(id));
        if(!proj) return;
        selected=proj;
        wrap.querySelectorAll('.project-card').forEach(c=> c.classList.remove('selected'));
        card.classList.add('selected');
        updateHoursForSelected();
      });
    });
  }

  function buildProjectKanban(projects){
    const container=document.getElementById('projectKanban');
    if(!container) return;
    const statuses=['planning','active','on-hold','completed','cancelled'];
    container.innerHTML='';
    statuses.forEach(st=>{
      const col=document.createElement('div');
      col.className='project-col';
      col.style.cssText='background:#141e2e;border:1px solid #26344a;border-radius:16px;padding:.7rem .75rem;display:flex;flex-direction:column;gap:.6rem;min-height:200px;';
      col.innerHTML=`<h3 style='margin:.2rem 0 .4rem;font-size:.7rem;letter-spacing:.5px;text-transform:uppercase;color:#9aa9bd'>${st}</h3>`;
      const wrap=document.createElement('div'); wrap.className='proj-cards'; wrap.style.cssText='display:flex;flex-direction:column;gap:.55rem;';
      // Enable drop for status change
      wrap.dataset.status = st;
      wrap.addEventListener('dragover',e=>{ e.preventDefault(); wrap.style.outline='2px dashed #4f9fff55'; });
      wrap.addEventListener('dragleave',()=>{ wrap.style.outline='none'; });
      wrap.addEventListener('drop',async e=>{
        e.preventDefault(); wrap.style.outline='none';
        const id = e.dataTransfer.getData('text/plain');
        if(!id) return;
        try{ await api.patch(`/pm/projects/${id}`, { status: st }); start(); }catch(err){ alert('Failed to move project: '+err.message); }
      });
      projects.filter(p=>p.status===st).forEach(p=>{
        const card=document.createElement('div');
        card.className='project-card';
        card.style.cursor='grab';
        card.setAttribute('draggable','true');
        card.addEventListener('dragstart',e=>{ e.dataTransfer.setData('text/plain', p._id); });
  const profitPct = p.revenue? (((p.revenue||0)-(p.cost||0))/(p.revenue||1)*100).toFixed(1):'--';
  const progress = p.progress!=null? p.progress : 0;
  const budget = Number(p.budget||0);
  const cost = Number(p.cost||0);
  const usage = budget>0 ? Math.min(100, Math.round(cost/budget*100)) : 0;
        card.innerHTML=`
          <div class="row"><span class="title">${escapeHtml(p.name)}</span><span class="status-chip">${escapeHtml(p.status)}</span></div>
          <div class="meta">
            <div class="row"><span>Client</span><span>${escapeHtml(p.client||'—')}</span></div>
            <div class="row"><span>Budget</span><span>₹ ${(p.budget||0).toLocaleString()}</span></div>
            <div class="row"><span>Profit</span><span>${profitPct==='--'?'--': profitPct+'%'}</span></div>
            <div class="row"><span>Deadline</span><span>${p.deadline? new Date(p.deadline).toISOString().slice(0,10):'—'}</span></div>
          </div>
          <div class="progress"><span style="width:${progress}%"></span></div>
          <div class="progress budget" title="Budget used: ${usage}%"><span style="width:${usage}%"></span></div>
        `;
        card.addEventListener('click',()=>{ selected=p; updateHoursForSelected(); wrap.querySelectorAll('.project-card').forEach(c=> c.classList.remove('selected')); card.classList.add('selected'); });
        wrap.appendChild(card);
      });
      col.appendChild(wrap);
      container.appendChild(col);
    });
  }

  // Dynamic analytics charts (update without recreating canvases repeatedly)
  let costRevChart=null, utilChart=null, analyticsTimer=null;
  async function loadAnalytics(){
    try{
      const res = await api.get('/pm/analytics');
      if(!window.Chart) return;
      const cvr=document.getElementById('chartCvR');
      const util=document.getElementById('chartUtil');
      // Ensure consistent ordering using costVsRevenue array
      const labels=res.costVsRevenue.map(p=>p.name);
      const costData=res.costVsRevenue.map(p=>p.cost);
      const revData=res.costVsRevenue.map(p=>p.revenue);
      if(costRevChart){
        costRevChart.data.labels=labels;
        costRevChart.data.datasets[0].data=costData;
        costRevChart.data.datasets[1].data=revData;
        costRevChart.update();
      }else{
        costRevChart=new Chart(cvr,{ type:'line', data:{ labels, datasets:[{ label:'Cost', data:costData, borderColor:'#ef4444', backgroundColor:'#ef444433' },{ label:'Revenue', data:revData, borderColor:'#10b981', backgroundColor:'#10b98133' }] }, options:{ plugins:{legend:{labels:{color:'#e6edf5'}}}, scales:{x:{ticks:{color:'#9aa9bd'}},y:{ticks:{color:'#9aa9bd'}}}} });
      }
      const utilLabels=res.utilization.map(u=> u.name || String(u.userId).slice(-6));
      const utilData=res.utilization.map(u=> Math.round(u.utilization*100));
      if(utilChart){
        utilChart.data.labels=utilLabels;
        utilChart.data.datasets[0].data=utilData;
        utilChart.update();
      }else{
        utilChart=new Chart(util,{ type:'bar', data:{ labels:utilLabels, datasets:[{ label:'Utilization %', data:utilData, backgroundColor:'#4f9fff55', borderColor:'#4f9fff' }] }, options:{ plugins:{legend:{labels:{color:'#e6edf5'}}}, scales:{x:{ticks:{color:'#9aa9bd'}},y:{ticks:{color:'#9aa9bd'}}}} });
      }
    }catch(e){ /* silent */ }
  }
  function startAnalyticsAutoRefresh(){
    if(analyticsTimer) clearInterval(analyticsTimer);
    analyticsTimer=setInterval(loadAnalytics, 30000); // refresh every 30s
  }
  window.addEventListener('beforeunload',()=>{ if(analyticsTimer) clearInterval(analyticsTimer); });

  let creating=false;
  async function createProject(){
    if(creating) return; creating=true;
    const name=document.getElementById('pName').value.trim(); if(!name){ creating=false; return alert('Project name required'); }
    const desc=document.getElementById('pDesc').value.trim();
    const budget=Number(document.getElementById('pBudget').value||0);
    const deadline=document.getElementById('pDeadline').value||null;
    const manager = (window.FlowIQ.auth.user() && (window.FlowIQ.auth.user()._id || window.FlowIQ.auth.user().id)) || undefined;
  const teamEmails = document.getElementById('pTeam').value.trim();
  const payload = { name, description:desc, budget, deadline, manager, teamEmails };
    try{ await api.post('/pm/projects', payload); ui.closeModal('modalProject'); document.getElementById('pName').value=''; document.getElementById('pDesc').value=''; document.getElementById('pBudget').value=''; document.getElementById('pDeadline').value=''; start(); }catch(e){ alert(e.message); } finally { creating=false; }
  }

  async function loadPendingExpenses(){
    if(!selected) return alert('Select a project');
    try{ const res = await api.get(`/pm/projects/${selected._id}/expenses`); const pend=(res.expenses||[]).filter(e=> e.status==='pending'); const body=document.querySelector('#tblPendExp tbody'); body.innerHTML=''; pend.forEach(e=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td>${e.description||e.expenseName||''}</td><td>₹ ${(e.amount||0).toLocaleString()}</td><td>${e.submittedBy?.name||''}</td><td>${e.date? new Date(e.date).toISOString().slice(0,10):''}</td><td><button class='table-btn approve' data-id='${e._id}'>Approve</button><button class='table-btn reject' data-id='${e._id}'>Reject</button></td>`; body.appendChild(tr); }); body.querySelectorAll('.approve').forEach(b=> b.addEventListener('click',()=> changeExpenseStatus(b.dataset.id,'approve'))); body.querySelectorAll('.reject').forEach(b=> b.addEventListener('click',()=> changeExpenseStatus(b.dataset.id,'reject'))); ui.openModal('modalExp'); }catch(err){ alert('Failed to load expenses'); }
  }
  async function changeExpenseStatus(id,action){
    try{ await api.post(`/pm/projects/${selected._id}/expenses/${id}/${action==='approve'?'approve':'reject'}`,{}); await loadPendingExpenses(); }catch(e){ alert('Update failed'); }
  }

  function bind(){
    document.getElementById('btnNewProj').addEventListener('click',()=> { 
      // reset form for create
      document.getElementById('pName').value='';
      document.getElementById('pDesc').value='';
      document.getElementById('pBudget').value='';
      document.getElementById('pDeadline').value='';
      const btn=document.getElementById('pCreateBtn');
      btn.textContent='Create';
      btn.onclick=createProject;
      ui.openModal('modalProject');
    });
    document.getElementById('pCreateBtn').addEventListener('click', createProject);
    ui.bindClose();
    document.getElementById('btnView').addEventListener('click',()=>{ if(!selected) return alert('Select a project'); window.location.href='/project-detail/?id='+selected._id; });
    document.getElementById('btnTask').addEventListener('click',()=>{ if(!selected) return alert('Select a project'); window.location.href='/tasks/?projectId='+selected._id; });
    const approveBtn=document.getElementById('btnApprove'); if(approveBtn){ approveBtn.addEventListener('click', loadPendingExpenses); }
    const editBtn=document.getElementById('btnEdit'); if(editBtn){ editBtn.addEventListener('click',()=>{ if(!selected) return alert('Select a project'); openEditModal(selected); }); }
    const delBtn=document.getElementById('btnDelete'); if(delBtn){ delBtn.addEventListener('click',()=>{ if(!selected) return alert('Select a project'); if(confirm('Delete project? This cannot be undone.')) deleteProject(selected._id); }); }
    const toggleList=document.getElementById('toggleList'); const toggleKanban=document.getElementById('toggleKanban');
    if(toggleList && toggleKanban){
      toggleList.addEventListener('click',()=>{
        document.getElementById('projectsListSection').classList.remove('hidden');
        document.getElementById('projectsKanbanSection').classList.add('hidden');
      });
      toggleKanban.addEventListener('click',()=>{
        document.getElementById('projectsKanbanSection').classList.remove('hidden');
        document.getElementById('projectsListSection').classList.add('hidden');
      });
    }
    const markAll=document.getElementById('notifMarkAll'); if(markAll){ markAll.addEventListener('click',()=> window.FlowIQ.notify.markAll()); }
  }

  function openEditModal(p){
    // reuse create modal fields for edit for simplicity
    ui.openModal('modalProject');
    document.getElementById('pName').value=p.name||'';
    document.getElementById('pDesc').value=p.description||'';
    document.getElementById('pBudget').value=p.budget||0;
    document.getElementById('pDeadline').value=p.deadline? new Date(p.deadline).toISOString().slice(0,10):'';
    // Replace create button handler
    const btn=document.getElementById('pCreateBtn');
    btn.textContent='Save';
    btn.onclick=async ()=>{
      const payload={
        name:document.getElementById('pName').value.trim(),
        description:document.getElementById('pDesc').value.trim(),
        budget:Number(document.getElementById('pBudget').value||0),
        deadline:document.getElementById('pDeadline').value||null,
      };
      try{ await api.patch(`/pm/projects/${p._id}`, payload); ui.closeModal('modalProject'); btn.textContent='Create'; btn.onclick=createProject; start(); }catch(e){ alert(e.message); }
    };
  }

  async function deleteProject(id){
    try{ await api.del(`/pm/projects/${id}`); selected=null; start(); }catch(e){ alert('Delete failed: '+e.message); }
  }

  function applyProjectSearch(projects){
    const input=document.querySelector('.topbar .search input');
    if(!input) return projects;
    const term=input.value.trim().toLowerCase();
    if(!term) return projects;
    return projects.filter(p=>{
      return [p.name, p.client, p.status].some(v=> String(v||'').toLowerCase().includes(term));
    });
  }

  function hookSearch(projects){
    const input=document.querySelector('.topbar .search input');
    if(!input) return;
    input.addEventListener('input',()=>{
      const filtered=applyProjectSearch(projects);
      render(filtered);
      buildProjectKanban(filtered);
    });
  }

  async function start(){
    try{ const projects = await loadProjects(); hookSearch(projects); const filtered=applyProjectSearch(projects); render(filtered); buildProjectKanban(filtered); await loadKPIs(); await loadAnalytics(); startAnalyticsAutoRefresh(); }catch(e){ alert('Failed to load projects: '+e.message); }
  }
  document.addEventListener('DOMContentLoaded',()=>{ bind(); start(); });
})();
