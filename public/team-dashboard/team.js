// Team Dashboard logic (restricts to tasks assigned to the team member without hitting PM-only routes excessively)
(function(){
  const { api, ui, auth } = window.FlowIQ;
  const me = auth.user();
  const cardsWrap = () => document.getElementById('myTaskCards');
  let myProjects = [];

  function escapeHtml(str){ return String(str||'').replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[s])); }

  function taskCard(t){
    const due = t.dueDate? new Date(t.dueDate).toISOString().slice(0,10):'—';
    return `<div class="project-card task-card" data-id="${t._id}" style="padding:.65rem">
      <div class="row"><span class="title" style="font-size:.85rem">${escapeHtml(t.title)}</span><span class="status-chip">${escapeHtml(t.status)}</span></div>
      <div class="meta">
        <div class="row"><span>Priority</span><span>${escapeHtml(t.priority||'medium')}</span></div>
        <div class="row"><span>Due</span><span>${due}</span></div>
        <div class="row"><span>Project</span><span>${escapeHtml(t.project?.name||'')}</span></div>
      </div>
    </div>`;
  }

  async function fetchProjects(){
    // Use dedicated team endpoint (no PM role required)
    try {
      const res = await api.get('/team/projects');
      myProjects = res.projects || [];
    } catch(e){ myProjects = []; }
    return myProjects;
  }

  function enforceRoleAccess(){
    const u = auth.user();
    if(!u){ window.location.href='/'; return; }
    if(['Admin','Finance','Project Manager'].includes(u.role)){
      window.location.href = '/';
    }
  }

  async function fetchTasks(){
    // Get tasks assigned to me across projects
    try{
      const res = await api.get('/team/tasks');
      return res.tasks || [];
    }catch(e){ return []; }
  }

  function render(list){
    const wrap = cardsWrap();
    if(!wrap) return;
    wrap.innerHTML='';
    let open=0, done=0;
    list.forEach(t=>{ if(t.status==='done') done++; else open++; wrap.insertAdjacentHTML('beforeend', taskCard(t)); });
    if(!list.length){
      const empty=document.createElement('div'); empty.style.cssText='padding:1rem;opacity:.7'; empty.textContent='No tasks yet.'; wrap.appendChild(empty);
    }
    document.getElementById('kpiOpen').textContent=open;
    document.getElementById('kpiDone').textContent=done;
  }

  async function populateProjectSelect(){
    const select = document.getElementById('tProjectSelect');
    select.innerHTML='';
    myProjects.forEach(p=>{
      const opt=document.createElement('option');
      opt.value=p._id; opt.textContent=p.name; select.appendChild(opt);
    });
    if(!myProjects.length){
      const opt=document.createElement('option'); opt.textContent='No accessible projects'; opt.disabled=true; select.appendChild(opt);
    }
    const newBtn = document.getElementById('btnNewTask');
    if(newBtn){
      if(!myProjects.length){
        newBtn.setAttribute('disabled','disabled');
        newBtn.title='No accessible projects to create tasks';
      } else {
        newBtn.removeAttribute('disabled');
        newBtn.title='Create a task in a selected project';
      }
    }
  }

  function populateTsProjects(){
    const sel = document.getElementById('tsProject');
    if(!sel) return;
    sel.innerHTML='';
    myProjects.forEach(p=>{ const opt=document.createElement('option'); opt.value=p._id; opt.textContent=p.name; sel.appendChild(opt); });
    if(!myProjects.length){ const opt=document.createElement('option'); opt.textContent='No accessible projects'; opt.disabled=true; sel.appendChild(opt); }
    const date = document.getElementById('tsDate'); if(date) date.value = new Date().toISOString().slice(0,10);
  }

  async function submitTimesheet(){
    const project = document.getElementById('tsProject').value;
    const hours = parseFloat(document.getElementById('tsHours').value);
    const billable = document.getElementById('tsBillable').value === 'true';
    const date = document.getElementById('tsDate').value || undefined;
    const note = document.getElementById('tsNote').value || undefined;
    const fb = document.getElementById('tsFeedback');
    fb.textContent='';
    if(!project) return fb.textContent='Select a project';
    if(!(hours>0)) return fb.textContent='Enter hours (>0)';
    try{
      await api.post('/timesheets', { project, hours, billable, note, date });
      fb.textContent='Logged!';
      fb.style.color='#22c55e';
      document.getElementById('tsHours').value='';
      document.getElementById('tsNote').value='';
    }catch(e){ fb.textContent=e.message; fb.style.color='#ef4444'; }
  }

  async function createTask(){
    const title = document.getElementById('tTitle').value.trim();
    if(!title) return alert('Title required');
    const desc = document.getElementById('tDesc').value.trim();
    const due = document.getElementById('tDue').value || null;
    const priority = document.getElementById('tPriority').value || 'medium';
    if(!myProjects.length){ alert('No accessible project found'); return; }
    const projectId = document.getElementById('tProjectSelect').value;
  const payload = { title, description: desc, dueDate: due, priority };
    try {
      await api.post(`/team/projects/${projectId}/tasks`, payload);
      ui.closeModal('modalTask');
      start();
    } catch(e){ alert(e.message); }
  }

  async function start(){
    // load projects first so user sees selectable list
    await fetchProjects();
    await populateProjectSelect();
    populateTsProjects();
    const tasks = await fetchTasks();
    render(tasks);
  }
  document.addEventListener('DOMContentLoaded',()=>{
    enforceRoleAccess();
    document.getElementById('btnNewTask').addEventListener('click',()=> {
      populateProjectSelect();
      ui.openModal('modalTask');
    });
    document.getElementById('tCreateBtn').addEventListener('click', createTask);
    const tsSubmit=document.getElementById('tsSubmit'); if(tsSubmit) tsSubmit.addEventListener('click', submitTimesheet);
    const tsReset=document.getElementById('tsReset'); if(tsReset) tsReset.addEventListener('click', ()=>{ document.getElementById('tsHours').value=''; document.getElementById('tsNote').value=''; document.getElementById('tsBillable').value='true'; document.getElementById('tsFeedback').textContent=''; });
    ui.bindClose();
    start();
  });
})();