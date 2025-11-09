(function(){
  const { api, ui, auth } = window.FlowIQ;
  const qs = new URLSearchParams(location.search);
  let projectId = qs.get('projectId');
  const map = { 'todo':'New', 'in-progress':'In Progress', 'blocked':'Blocked', 'done':'Done', 'review':'In Progress' };
  const role = (auth.user()||{}).role || '';

  function el(id){return document.getElementById(id);} 
  let allProjects = [];

  async function fetchProjects(){
    try{ const res = (role==='Team Member') ? await api.get('/team/projects') : await api.get('/pm/projects'); allProjects = res.projects||[]; }
    catch{ allProjects = []; }
    const sel = el('fProject');
    if(sel){
      sel.innerHTML = (allProjects.length? '' : '<option value="">No Projects</option>') + allProjects.map(p=>`<option value="${p._id}">${p.name}</option>`).join('');
    }
    // Initialize projectId if missing
    if(!projectId && allProjects.length){ projectId = String(allProjects[0]._id); updateUrlProject(projectId); }
    if(sel && projectId){ sel.value = projectId; }
  }

  function updateUrlProject(id){
    const url = new URL(location.href);
    url.searchParams.set('projectId', id);
    history.replaceState({}, '', url.toString());
  }

  let currentTaskId = null;
  function renderColumns(columns){
    const colMap = {
      'New': columns.todo || [],
      'In Progress': (columns['in-progress']||[]).concat(columns.review||[]),
      'Blocked': columns.blocked || [],
      'Done': columns.done || []
    };
    ['New','In Progress','Blocked','Done'].forEach(c=>{ 
      const colEl = el('col-'+c);
      if(colEl) colEl.innerHTML=''; 
    });
    
    let totalTasks = 0;
    Object.entries(colMap).forEach(([col,tasks])=>{
      totalTasks += tasks.length;
      tasks.forEach(t=>{
        const d=document.createElement('div'); 
        d.className='task'; 
        d.setAttribute('draggable','true'); 
        d.dataset.id=t._id; 
        d.dataset.status=t.status;
        
        // Enhanced task card with more information
        const projectName = t.project?.name || '';
        const assigneeName = t.assignee?.name || 'Unassigned';
        const dueDate = t.dueDate ? new Date(t.dueDate).toISOString().slice(0,10) : '';
        const priority = (t.priority || 'medium').charAt(0).toUpperCase() + (t.priority || 'medium').slice(1);
        const description = t.description ? (t.description.length > 50 ? t.description.substring(0, 50) + '...' : t.description) : '';
        
        d.innerHTML = `
          <div style="font-weight:600;margin-bottom:.2rem">${escapeHtml(t.title || 'Untitled Task')}</div>
          ${projectName ? `<div class="small" style="opacity:.7;margin-bottom:.2rem">${escapeHtml(projectName)}</div>` : ''}
          ${description ? `<div class="small" style="opacity:.6;margin-bottom:.2rem;font-size:.6rem">${escapeHtml(description)}</div>` : ''}
          <div class="small" style="display:flex;gap:.4rem;flex-wrap:wrap;align-items:center">
            <span>${escapeHtml(assigneeName)}</span>
            ${dueDate ? `<span>• ${dueDate}</span>` : ''}
            <span class="priority-${priority}" style="margin-left:auto">${priority}</span>
          </div>
        `;
        
        d.addEventListener('click',()=> openTaskModal(t));
        bindDrag(d);
        const colEl = el('col-'+col);
        if(colEl) colEl.appendChild(d);
      });
      
      // Show empty state if no tasks in column
      const colEl = el('col-'+col);
      if(colEl && tasks.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.className = 'small';
        emptyMsg.style.cssText = 'opacity:.4;padding:.5rem;text-align:center;font-style:italic';
        emptyMsg.textContent = 'No tasks';
        colEl.appendChild(emptyMsg);
      }
    });
    
    // Log for debugging
    if(totalTasks === 0) {
      console.warn('No tasks found for project:', projectId);
    }
  }
  
  function escapeHtml(str) {
    if(!str) return '';
    return String(str).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
  }

  async function loadKanban(){
    if(!projectId){
      return { };
    }
    if(role==='Team Member'){
      // Team members now fetch all tasks in the project (including unassigned)
      const res = await api.get(`/team/projects/${projectId}/tasks`);
      const tasks = res.tasks || [];
      const cols = { 'todo': [], 'in-progress': [], 'blocked': [], 'done': [], 'review': [] };
      tasks.forEach(t=> { if(cols[t.status]) cols[t.status].push(t); else cols['todo'].push(t); });
      return cols;
    } else {
      const res = await api.get(`/pm/projects/${projectId}/kanban`);
      return res.columns || { };
    }
  }

  function bindDrag(node){
    node.addEventListener('dragstart',e=>{ node.classList.add('dragging'); e.dataTransfer.setData('text/plain',node.dataset.id); e.dataTransfer.setData('status', node.dataset.status); });
    node.addEventListener('dragend',()=> node.classList.remove('dragging'));
  }
  function bindCols(){
    document.querySelectorAll('.column .tasks').forEach(area=>{
      // Enable drag-and-drop for all roles (including Team Members)
      area.addEventListener('dragover',e=>{ e.preventDefault(); });
      area.addEventListener('drop',async e=>{ 
        e.preventDefault(); 
        const id=e.dataTransfer.getData('text/plain'); 
        const fromStatus=e.dataTransfer.getData('status'); 
        const toCol=area.id.replace('col-',''); 
        const toStatus = Object.keys(map).find(k=> map[k]===toCol) || 'todo'; 
        const index = area.querySelectorAll('.task').length; 
        try{ 
          // Use appropriate endpoint based on role
          if(role==='Team Member'){
            await api.patch(`/team/projects/${projectId}/tasks/${id}`, { status: toStatus }); 
          } else {
            await api.post(`/pm/projects/${projectId}/kanban/reorder`, { taskId:id, from:{ status:fromStatus, index:0 }, to:{ status: toStatus, index } }); 
          }
          start(); 
        }catch(err){ alert('Failed to update task status: ' + (err.message || 'Unknown error')); } 
      });
    });
  }

  async function loadProjectAndMembers(){
    // Get project detail to retrieve manager and team members
    try{
      if(role==='Team Member'){ return; }
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
    const due=document.getElementById('tDue').value||null; const priority=(document.getElementById('tPriority').value||'low').toLowerCase();
    const status = document.getElementById('tStatus')?.value || 'todo';
    try{
      const desc = document.getElementById('tDesc').value.trim();
      if(role==='Team Member'){
        await api.post(`/team/projects/${projectId}/tasks`, { title, description: desc, dueDate: due, priority, status });
      } else {
        const assignee=document.getElementById('tAssignee').value||null;
        await api.post(`/pm/projects/${projectId}/tasks`, { title, description: desc, assignee, dueDate: due, priority, status });
      }
      ui.closeModal('modalTask'); start();
    }catch(e){ alert(e.message); }
  }

  async function start(){
    if(!projectId){ 
      await fetchProjects(); 
      if(!projectId && allProjects.length > 0) {
        projectId = allProjects[0]._id;
        updateUrlProject(projectId);
      }
    }
    if(!projectId) {
      console.warn('No project selected');
      // Show message to user
      ['New','In Progress','Blocked','Done'].forEach(c=>{ 
        const colEl = el('col-'+c);
        if(colEl) {
          colEl.innerHTML = '<div class="small" style="opacity:.4;padding:.5rem;text-align:center;font-style:italic">Select a project to view tasks</div>';
        }
      });
      return;
    }
    const columns = await loadKanban(); 
    console.log('Loaded columns:', columns);
    renderColumns(columns); 
    bindCols(); 
    if(projectId) await loadProjectAndMembers();
  }
  function openTaskModal(task){
    // Populate fields
    const modalTitle = document.getElementById('taskModalTitle');
    if(task){
      modalTitle.textContent = 'Task Details';
      document.getElementById('tTitle').value = task.title || '';
      document.getElementById('tDesc').value = task.description || '';
      document.getElementById('tDue').value = task.dueDate ? new Date(task.dueDate).toISOString().slice(0,10) : '';
      document.getElementById('tPriority').value = (task.priority||'medium').charAt(0).toUpperCase()+ (task.priority||'medium').slice(1);
      // Set status field
      const statusField = document.getElementById('tStatus');
      if(statusField) {
        statusField.value = task.status || 'todo';
      }
      const saveBtn = document.getElementById('tSave');
      const createBtn = document.getElementById('tCreate');
      createBtn.style.display='none';
      saveBtn.style.display='inline-block';
      currentTaskId = task._id;
      // Inject self-assign button if needed
      const actionWrap = saveBtn && saveBtn.parentElement;
      let selfBtn = document.getElementById('btnSelfAssign');
      if(!selfBtn && actionWrap){
        selfBtn = document.createElement('button');
        selfBtn.id='btnSelfAssign';
        selfBtn.className='button-outline';
        selfBtn.textContent='Assign to me';
        selfBtn.style.display='none';
        actionWrap.insertBefore(selfBtn, saveBtn);
      }
      if(selfBtn){
        const canSelfAssign = role==='Team Member' && (!task.assignee || !task.assignee._id);
        selfBtn.style.display = canSelfAssign? 'inline-block':'none';
        selfBtn.onclick = async ()=>{
          try{
            await api.patch(`/team/projects/${projectId}/tasks/${task._id}/assign-self`, {});
            await loadTaskExtras(task._id);
            ui.closeModal('modalTask');
            start();
          }catch(e){ alert(e.message); }
        };
      }
      saveBtn.onclick = async ()=>{
        try{
          const payload = {
            title: document.getElementById('tTitle').value.trim(),
            description: document.getElementById('tDesc').value.trim(),
            dueDate: document.getElementById('tDue').value || null,
            priority: (document.getElementById('tPriority').value||'medium').toLowerCase(),
            status: document.getElementById('tStatus')?.value || task.status || 'todo',
          };
          // Use appropriate endpoint based on role
          if(role==='Team Member'){
            await api.patch(`/team/projects/${projectId}/tasks/${task._id}`, payload);
          } else {
            await api.patch(`/pm/projects/${projectId}/tasks/${task._id}`, payload);
          }
          ui.closeModal('modalTask'); start();
        }catch(e){ alert(e.message); }
      };
      loadTaskExtras(task._id);
    } else {
      modalTitle.textContent='New Task';
      document.getElementById('tTitle').value='';
      document.getElementById('tDesc').value='';
      document.getElementById('tDue').value='';
      document.getElementById('tPriority').value='Medium';
      const statusField = document.getElementById('tStatus');
      if(statusField) {
        statusField.value = 'todo';
      }
      document.getElementById('tCreate').style.display='inline-block';
      document.getElementById('tSave').style.display='none';
      clearTaskExtras(); currentTaskId = null;
    }
    ui.openModal('modalTask');
  }

  function clearTaskExtras(){
    const cList = document.getElementById('commentsList'); if(cList) cList.innerHTML='';
    const aList = document.getElementById('activityList'); if(aList) aList.innerHTML='';
    const attBody = document.querySelector('#tblAttachments tbody'); if(attBody) attBody.innerHTML='';
  }
  async function loadTaskExtras(taskId){
    // Placeholder: expecting endpoint /pm/tasks/:id for full task detail
    try{
      const res = await api.get(`/pm/tasks/${taskId}`);
      const task = res.task || res;
      renderComments(task.comments||[]);
      renderActivity(task.activity||[]);
      renderAttachments(task.attachments||[]);
    }catch(e){ /* silent for now */ }
  }
  function renderComments(list){
    const wrap = document.getElementById('commentsList'); if(!wrap) return; wrap.innerHTML='';
    const me = (auth.user()||{});
    list.forEach(c=>{
      const isMine = String(c.user?._id||c.user) === String(me._id||me.id||'');
      const div=document.createElement('div'); div.className='comment-item';
      const actions = isMine? `<div style="display:flex;gap:.4rem"><a href="#" data-action="edit-comment" data-id="${c._id}" class="table-btn">Edit</a><a href="#" data-action="delete-comment" data-id="${c._id}" class="table-btn" style="color:#ef4444">Delete</a></div>` : '';
      div.innerHTML=`<div style='font-weight:600;display:flex;justify-content:space-between;align-items:center'><span>${(c.user&&c.user.name)||'User'}</span>${actions}</div><div>${c.text}</div><div style='opacity:.55;font-size:.6rem'>${new Date(c.createdAt||c.at||Date.now()).toLocaleString()}</div>`;
      wrap.appendChild(div);
    });
  }
  function renderActivity(list){
    const wrap = document.getElementById('activityList'); if(!wrap) return; wrap.innerHTML='';
    list.forEach(a=>{
      const div=document.createElement('div'); div.className='activity-item';
      div.innerHTML=`<div><strong>${a.type}</strong> • ${new Date(a.at||Date.now()).toLocaleString()}</div><div style='opacity:.65'>${JSON.stringify(a.meta||{})}</div>`;
      wrap.appendChild(div);
    });
  }
  function renderAttachments(list){
    const body = document.querySelector('#tblAttachments tbody'); if(!body) return; body.innerHTML='';
    list.forEach(att=>{
      const tr=document.createElement('tr'); tr.innerHTML=`<td>${att.name||'file'}</td><td>${att.size? att.size+' bytes':'—'}</td><td>${att.type||'—'}</td><td><a class='table-btn' href='${att.url}' target='_blank'>Open</a></td>`; body.appendChild(tr);
    });
  }
  // Tabs interaction
  document.addEventListener('click',e=>{
    if(e.target.classList && e.target.classList.contains('tab-btn')){
      const tab = e.target.getAttribute('data-tab');
      document.querySelectorAll('.tab-btn').forEach(b=> b.classList.remove('active'));
      e.target.classList.add('active');
      document.querySelectorAll('.tab-panel').forEach(p=>{
        if(p.getAttribute('data-panel')===tab) p.classList.remove('hidden'); else p.classList.add('hidden');
      });
    }
  });
  const btnAddComment = document.getElementById('btnAddComment');
  if(btnAddComment){ btnAddComment.addEventListener('click', async ()=>{
    try{
      const input = document.getElementById('commentInput');
      const text = (input.value||'').trim();
      if(!text){ return; }
      if(!currentTaskId){ return alert('Open a task first'); }
      await api.post(`/pm/projects/${projectId}/tasks/${currentTaskId}/comments`, { text });
      input.value='';
      await loadTaskExtras(currentTaskId);
    }catch(e){ alert(e.message); }
  }); }

  const attachInput = document.getElementById('attachInput');
  if(attachInput){ attachInput.addEventListener('change', async (e)=>{
    const files = Array.from(e.target.files||[]);
    if(!files.length || !currentTaskId){ return; }
    for(const f of files){
      const form = new FormData();
      form.append('file', f);
      try{ await api.postMultipart(`/pm/projects/${projectId}/tasks/${currentTaskId}/attachments/upload`, form); }
      catch(err){ console.error('attach upload failed', err); alert('Failed to upload: '+f.name); }
    }
    await loadTaskExtras(currentTaskId);
    attachInput.value='';
  }); }

  // Comment actions (edit/delete) via delegation
  document.addEventListener('click', async (e)=>{
    const t = e.target;
    if(!(t && t.getAttribute)) return;
    const action = t.getAttribute('data-action');
    if(!action) return;
    if(action==='delete-comment'){
      e.preventDefault();
      const id = t.getAttribute('data-id');
      if(!currentTaskId || !id) return;
      try{ await api.del(`/pm/projects/${projectId}/tasks/${currentTaskId}/comments/${id}`); await loadTaskExtras(currentTaskId); }
      catch(err){ alert(err.message); }
    }
    if(action==='edit-comment'){
      e.preventDefault();
      const id = t.getAttribute('data-id');
      if(!currentTaskId || !id) return;
      const newText = window.prompt('Edit comment:');
      if(newText===null) return;
      try{ await api.patch(`/pm/projects/${projectId}/tasks/${currentTaskId}/comments/${id}`, { text: newText }); await loadTaskExtras(currentTaskId); }
      catch(err){ alert(err.message); }
    }
  });
  document.addEventListener('DOMContentLoaded',()=>{
    // Populate projects and set selection
    fetchProjects().then(()=> start());
    // Change selected project via dropdown
    el('fProject').addEventListener('change', async (e)=>{ projectId = e.target.value || null; if(projectId) updateUrlProject(projectId); await start(); });
    document.getElementById('btnNewTask').addEventListener('click',async()=> { if(!projectId){ return alert('Select a project first'); } await loadProjectAndMembers(); openTaskModal(null); });
    document.getElementById('tCreate').addEventListener('click', createTask); ui.bindClose();
  });
})();
