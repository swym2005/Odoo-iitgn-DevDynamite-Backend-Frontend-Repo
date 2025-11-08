(function(){
  const { api, auth, ui } = window.FlowIQ;
  const me = (window.FlowIQ.auth && window.FlowIQ.auth.user && window.FlowIQ.auth.user()) || (JSON.parse(localStorage.getItem('flowiq_user')||'null'));
  const tbody = () => document.querySelector('#tblMyTasks tbody');
  let myProjects = [];

  async function fetchTasks(){
    // Get all projects where the user is team member
    const res = await api.getJSON('/pm/projects');
    myProjects = (res.projects||[]).filter(p => (p.teamMembers||[]).some(id=>String(id)===String(me?.id)) || String(p.manager?._id||p.manager)===String(me?.id));
    const allTasks = [];
    for(const p of myProjects){
      const t = await api.getJSON(`/pm/projects/${p._id}/tasks`);
      (t.tasks||[]).forEach(task=> allTasks.push({ ...task, project:p }));
    }
    return allTasks;
  }

  function render(list){
    tbody().innerHTML='';
    let open=0, done=0;
    list.forEach(t=>{
      if(t.status==='done') done++; else open++;
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${t.title}</td><td>${t.status}</td><td>${t.priority}</td><td>${t.dueDate? new Date(t.dueDate).toISOString().slice(0,10):''}</td><td>${t.project?.name||''}</td>`;
      tbody().appendChild(tr);
    });
    document.getElementById('kpiOpen').textContent=open;
    document.getElementById('kpiDone').textContent=done;
    // hours KPI optional via timesheets aggregation; skipping for now
  }

  async function createTask(){
    const title = document.getElementById('tTitle').value.trim();
    if(!title) return alert('Title required');
    const desc = document.getElementById('tDesc').value.trim();
    const due = document.getElementById('tDue').value || null;
    const priority = document.getElementById('tPriority').value || 'medium';
    if(!myProjects.length){ alert('No projects found to add a task.'); return; }
    const proj = myProjects[0];
    const payload = { title, description: desc, assignee: me?.id, dueDate: due, priority };
    await api.getJSON(`/pm/projects/${proj._id}/tasks`, { method:'POST', body: JSON.stringify(payload) });
    ui.closeModal('modalTask');
    start();
  }

  async function start(){
    try{
      const tasks = await fetchTasks();
      render(tasks);
    }catch(e){ console.error(e); alert('Failed to load tasks'); }
  }
  document.addEventListener('DOMContentLoaded',()=>{
    document.getElementById('btnNewTask').addEventListener('click',()=> ui.openModal('modalTask'));
    document.getElementById('tCreateBtn').addEventListener('click', createTask);
    ui.bindClose();
    start();
  });
})();