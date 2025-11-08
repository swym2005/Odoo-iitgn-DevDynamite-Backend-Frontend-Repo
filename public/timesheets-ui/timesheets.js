(function(){
  const { api, ui } = window.FlowIQ;
  function el(id){return document.getElementById(id);} 
  const tbody=()=>document.querySelector('#tblTs tbody');
  const contentArea = document.querySelector('.content');
  let entries=[]; let projects=[]; let tasks=[];

  async function loadProjects(){
    try{ const res = await api.get('/pm/projects'); projects = res.projects||[]; }catch{ projects=[]; }
    const filterSel = el('tsProjectFilter');
    const createSel = el('tsProjectSelect');
    if(!projects.length){
      filterSel.innerHTML = '<option value="">(No Projects)</option>';
      createSel.innerHTML = '<option value="">(No Projects)</option>';
      return;
    }
    filterSel.innerHTML = '<option value="">All Projects</option>' + projects.map(p=>`<option value="${p._id}">${p.name}</option>`).join('');
    createSel.innerHTML = projects.map(p=>`<option value="${p._id}">${p.name}</option>`).join('');
    // Default filter if empty
    if(!filterSel.value){ filterSel.value = projects[0]._id; }
  }

  async function loadTasks(projectId){
    if(!projectId){ tasks=[]; el('tsTaskSelect').innerHTML = '<option value="">(No project)</option>'; return; }
    try{ const res = await api.get(`/pm/projects/${projectId}/tasks`); tasks = res.tasks||[]; }catch{ tasks=[]; }
    el('tsTaskSelect').innerHTML = '<option value="">(None)</option>' + tasks.map(t=>`<option value="${t._id}">${t.title}</option>`).join('');
  }

  async function loadTimesheets(){
    const pid = el('tsProjectFilter').value || ((projects[0] && projects[0]._id) || '');
    if(!pid){ entries=[]; render(); return; }
    try{
      const res = await api.get(`/pm/projects/${pid}/timesheets`);
      entries = res.timesheets||[];
    }catch(e){ entries=[]; }
    entries = entries.map(t=> ({ date: t.date? new Date(t.date).toISOString().slice(0,10):'', task: t.task?.title||'', hours: t.hours, billable: t.billable, notes: t.note||'', project: projects.find(p=> String(p._id)===String(t.project))?.name || '' }));
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
    const hours = parseFloat(el('tsHours').value||'0'); const date = el('tsDate').value || new Date().toISOString().slice(0,10); const note = el('tsNotes').value.trim(); const billable = el('tsBillable').checked;
    try{
      ui.showLoader(contentArea);
      await api.post(`/pm/projects/${pid}/timesheets`, { task: taskId, hours, billable, note, date });
      ui.closeModal('modalTs');
      // Ensure list shows the project we just logged hours for
      if(el('tsProjectFilter')) el('tsProjectFilter').value = pid;
      await loadTimesheets();
      render();
    }catch(e){ alert(e.message); }
    finally { ui.hideLoader(contentArea); }
  }

  async function start(){ ui.showLoader(contentArea); try{ await loadProjects(); const initialPid = el('tsProjectFilter').value || ((projects[0] && projects[0]._id) || ''); await loadTasks(initialPid); await loadTimesheets(); render(); } finally { ui.hideLoader(contentArea); } }
  document.addEventListener('DOMContentLoaded',()=>{ el('btnLog').addEventListener('click',async()=> { await loadTasks(el('tsProjectSelect').value); ui.openModal('modalTs'); }); el('tsSave').addEventListener('click', save); el('tsProjectFilter').addEventListener('change', async()=>{ await loadTasks(el('tsProjectFilter').value); await loadTimesheets(); render(); }); el('tsProjectSelect').addEventListener('change', async()=>{ await loadTasks(el('tsProjectSelect').value); }); el('searchTs').addEventListener('input', render); ui.bindClose(); start(); });
})();