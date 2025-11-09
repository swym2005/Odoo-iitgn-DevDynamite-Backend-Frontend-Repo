(function(){
  const { api, ui } = window.FlowIQ;
  function el(id){return document.getElementById(id);} 
  const tbody=()=>document.querySelector('#tblTs tbody');
  const contentArea = document.querySelector('.content');
  let entries=[]; let projects=[]; let tasks=[];

  async function loadProjects(){
    const user = window.FlowIQ.auth.user();
    const role = user?.role || '';
    try{ 
      // Use appropriate endpoint based on role
      const res = (role === 'Team Member') 
        ? await api.get('/team/projects') 
        : await api.get('/pm/projects'); 
      projects = res.projects||[]; 
    }catch{ projects=[]; }
    const filterSel = el('tsProjectFilter');
    const createSel = el('tsProjectSelect');
    if(!projects.length){
      filterSel.innerHTML = '<option value="">(No Projects)</option>';
      createSel.innerHTML = '<option value="">(No Projects)</option>';
      return;
    }
    filterSel.innerHTML = '<option value="">All Projects</option>' + projects.map(p=>`<option value="${p._id}">${p.name}</option>`).join('');
    createSel.innerHTML = projects.map(p=>`<option value="${p._id}">${p.name}</option>`).join('');
    // Default filter to show all
    filterSel.value = '';
  }

  async function loadTasks(projectId){
    if(!projectId){ tasks=[]; el('tsTaskSelect').innerHTML = '<option value="">(No project)</option>'; return; }
    const user = window.FlowIQ.auth.user();
    const role = user?.role || '';
    try{ 
      // Use appropriate endpoint based on role
      const res = (role === 'Team Member')
        ? await api.get(`/team/projects/${projectId}/tasks`)
        : await api.get(`/pm/projects/${projectId}/tasks`); 
      tasks = res.tasks||[]; 
    }catch{ tasks=[]; }
    el('tsTaskSelect').innerHTML = '<option value="">(None)</option>' + tasks.map(t=>`<option value="${t._id}">${t.title}</option>`).join('');
  }

  async function loadTimesheets(){
    const pid = el('tsProjectFilter').value || '';
    try{
      // Use the user-specific timesheets endpoint
      const res = await api.get('/timesheets' + (pid ? `?project=${pid}` : ''));
      console.log('Loaded timesheets:', res);
      entries = res.items || [];
      console.log('Timesheet entries:', entries);
    }catch(e){ 
      console.error('Failed to load timesheets:', e);
      entries=[]; 
    }
    entries = entries.map(t=> { 
      const projectName = t.project?.name || projects.find(p=> String(p._id)===String(t.project?._id || t.project))?.name || 'Unknown';
      return {
        date: t.date? new Date(t.date).toISOString().slice(0,10):'', 
        task: t.task?.title || 'No task', 
        hours: t.hours, 
        billable: t.billable, 
        notes: t.note||'', 
        project: projectName
      };
    });
    console.log('Mapped entries:', entries);
  }

  function render(){
    const term = (el('searchTs').value||'').toLowerCase();
    tbody().innerHTML='';
    const filtered = entries.filter(r=> !term || r.task.toLowerCase().includes(term) || r.project.toLowerCase().includes(term));
    filtered.forEach(r=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td>${r.date}</td><td>${r.task}</td><td>${r.hours}</td><td>${r.billable?'Yes':'No'}</td><td>${r.notes||''}</td><td>${r.project}</td>`; tbody.appendChild(tr); });
    stats(filtered);
    charts(filtered);
  }

  function stats(list){ const total=list.reduce((s,r)=>s+Number(r.hours||0),0); const bill=list.filter(r=>r.billable).reduce((s,r)=>s+Number(r.hours||0),0); const nb=total-bill; el('kHours').textContent=total; el('kBillable').textContent= total? Math.round(bill/total*100)+'%' : '0%'; el('kNonBillable').textContent= total? Math.round(nb/total*100)+'%' : '0%'; }
  // Persist chart instances so we can destroy before re-rendering
  let donutChart=null, barChart=null;
  function charts(list){
    if(!window.Chart) return;
    const donut=el('chartDonut');
    const bar=el('chartBar');
    const bill=list.filter(r=>r.billable).reduce((s,r)=>s+Number(r.hours||0),0);
    const nb=list.filter(r=>!r.billable).reduce((s,r)=>s+Number(r.hours||0),0);
    try{ if(donutChart){ donutChart.destroy(); donutChart=null; } }catch(e){}
    donutChart = new Chart(donut,{ type:'doughnut', data:{ labels:['Billable','Non-Billable'], datasets:[{ data:[bill,nb], backgroundColor:['#10b981','#4f9fff55'], borderColor:['#10b981','#4f9fff'] }] }, options:{plugins:{legend:{labels:{color:'#e6edf5'}}}}});
    const projNames=[]; const seen={};
    for(var i=0;i<list.length;i++){ var n=list[i].project||''; if(!seen[n]){ projNames.push(n); seen[n]=1; } }
    const hrs=projNames.map(function(n){ return list.filter(function(r){return r.project===n;}).reduce(function(s,r){return s+Number(r.hours||0);},0); });
    try{ if(barChart){ barChart.destroy(); barChart=null; } }catch(e){}
    barChart = new Chart(bar,{ type:'bar', data:{ labels:projNames, datasets:[{ label:'Hours', data:hrs, backgroundColor:'#8b5cf655', borderColor:'#8b5cf6' }] }, options:{ plugins:{legend:{labels:{color:'#e6edf5'}}}, scales:{x:{ticks:{color:'#9aa9bd'}},y:{ticks:{color:'#9aa9bd'}}}} });
  }

  async function save(){
    const pid = el('tsProjectSelect').value; if(!pid) return alert('Select a project');
    const taskId = el('tsTaskSelect').value || null;
    const hours = parseFloat(el('tsHours').value||'0'); 
    const date = el('tsDate').value || new Date().toISOString().slice(0,10); 
    const note = el('tsNotes').value.trim(); 
    const billable = el('tsBillable').checked;
    try{
      ui.showLoader(contentArea);
      // Use the user-specific timesheets endpoint
      await api.post('/timesheets', { project: pid, task: taskId, hours, billable, note, date });
      ui.closeModal('modalTs');
      // Clear form
      el('tsHours').value = '';
      el('tsNotes').value = '';
      el('tsBillable').checked = true;
      // Refresh list
      await loadTimesheets();
      render();
    }catch(e){ alert(e.message); }
    finally { ui.hideLoader(contentArea); }
  }

  async function start(){ 
    ui.showLoader(contentArea); 
    try{ 
      await loadProjects(); 
      console.log('Projects loaded:', projects);
      const initialPid = el('tsProjectFilter').value || ''; 
      if(initialPid) {
        await loadTasks(initialPid); 
      }
      await loadTimesheets(); 
      render(); 
    } finally { 
      ui.hideLoader(contentArea); 
    } 
  }
  document.addEventListener('DOMContentLoaded',()=>{ el('btnLog').addEventListener('click',async()=> { await loadTasks(el('tsProjectSelect').value); ui.openModal('modalTs'); }); el('tsSave').addEventListener('click', save); el('tsProjectFilter').addEventListener('change', async()=>{ await loadTasks(el('tsProjectFilter').value); await loadTimesheets(); render(); }); el('tsProjectSelect').addEventListener('change', async()=>{ await loadTasks(el('tsProjectSelect').value); }); el('searchTs').addEventListener('input', render); ui.bindClose(); start(); });
})();