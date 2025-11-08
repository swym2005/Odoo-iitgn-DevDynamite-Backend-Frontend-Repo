(function(){
  const { api, ui, auth } = window.FlowIQ;
  const qs = new URLSearchParams(location.search);
  const projectId = qs.get('projectId');
  if(!projectId){ console.warn('Missing projectId'); }
  const map = { 'todo':'New', 'in-progress':'In Progress', 'blocked':'Blocked', 'done':'Done', 'review':'In Progress' };

  function el(id){return document.getElementById(id);} 

  function renderColumns(columns){
    const colMap = {
      'New': columns.todo || [],
      'In Progress': (columns['in-progress']||[]).concat(columns.review||[]),
      'Blocked': columns.blocked || [],
      'Done': columns.done || []
    };
    ['New','In Progress','Blocked','Done'].forEach(c=>{ el('col-'+c).innerHTML=''; });
    Object.entries(colMap).forEach(([col,tasks])=>{
      tasks.forEach(t=>{
        const d=document.createElement('div'); d.className='task'; d.setAttribute('draggable','true'); d.dataset.id=t._id; d.dataset.status=t.status;
        d.innerHTML=`<div>${t.title}</div><div class="small">${t.assignee?.name||'Unassigned'} • ${t.dueDate? new Date(t.dueDate).toISOString().slice(0,10):''} • <span class="priority-${t.priority}">${t.priority}</span></div>`;
        bindDrag(d);
        el('col-'+col).appendChild(d);
      })
    });
  }

  async function loadKanban(){
    const res = await api.get(`/pm/projects/${projectId}/kanban`);
    return res.columns || { };
  }

  function bindDrag(node){
    node.addEventListener('dragstart',e=>{ node.classList.add('dragging'); e.dataTransfer.setData('text/plain',node.dataset.id); e.dataTransfer.setData('status', node.dataset.status); });
    node.addEventListener('dragend',()=> node.classList.remove('dragging'));
  }
  function bindCols(){
    document.querySelectorAll('.column .tasks').forEach(area=>{
      area.addEventListener('dragover',e=>{ e.preventDefault(); });
      area.addEventListener('drop',async e=>{ e.preventDefault(); const id=e.dataTransfer.getData('text/plain'); const fromStatus=e.dataTransfer.getData('status'); const toCol=area.id.replace('col-',''); const toStatus = Object.keys(map).find(k=> map[k]===toCol) || 'todo'; const index = area.querySelectorAll('.task').length; try{ await api.post(`/pm/projects/${projectId}/kanban/reorder`, { taskId:id, from:{ status:fromStatus, index:0 }, to:{ status: toStatus, index } }); start(); }catch(err){ alert('Reorder failed'); } });
    });
  }

  async function loadProjectAndMembers(){
    // Get project detail to retrieve manager and team members
    try{
      const res = await api.get(`/pm/projects/${projectId}`);
      const p = res.project || res;
      // Fill project field
      const pInput = document.getElementById('tProject');
      if(pInput) pInput.value = p.name || projectId;
      // Build members list: manager + teamMembers
      const members = [];
      if(p.manager){ members.push({ _id: p.manager._id || p.manager, name: p.manager.name || 'Manager' }); }
      (p.teamMembers||[]).forEach(m=> members.push({ _id: m._id || m, name: m.name || m.email || 'Member' }));
      const uniq = new Map(); members.forEach(m=> uniq.set(String(m._id), m));
      const sel = document.getElementById('tAssignee');
      if(sel){ sel.innerHTML = '<option value="">Unassigned</option>' + Array.from(uniq.values()).map(m=>`<option value="${m._id}">${m.name}</option>`).join(''); }
    }catch(e){ console.warn('Failed to load project detail', e); }
  }

  async function createTask(){
    const title=document.getElementById('tTitle').value.trim(); if(!title) return alert('Title required');
    const assignee=document.getElementById('tAssignee').value||null; const due=document.getElementById('tDue').value||null; const priority=(document.getElementById('tPriority').value||'low').toLowerCase();
    try{ await api.post(`/pm/projects/${projectId}/tasks`, { title, assignee, dueDate: due, priority }); ui.closeModal('modalTask'); start(); }catch(e){ alert(e.message); }
  }

  async function start(){ const columns = await loadKanban(); renderColumns(columns); bindCols(); await loadProjectAndMembers(); }
  document.addEventListener('DOMContentLoaded',()=>{ document.getElementById('btnNewTask').addEventListener('click',async()=> { await loadProjectAndMembers(); ui.openModal('modalTask'); }); document.getElementById('tCreate').addEventListener('click', createTask); ui.bindClose(); start(); });
})();
