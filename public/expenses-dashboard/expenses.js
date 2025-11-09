(function(){
  const { api, ui } = window.FlowIQ;
  const tblBody = () => document.querySelector('#tblExpenses tbody');
  const tblProjBody = () => document.querySelector('#tblByProject tbody');
  const projectFilter = () => document.getElementById('projectFilter');
  const contentArea = document.querySelector('.content');
  let expenses = [];
  let byProject = [];
  let projectsCache = [];

  async function loadProjects(){
    // reuse PM projects for select; if unauthorized ignore
    try{ const res = await api.get('/pm/projects'); projectsCache = res.projects||[]; }catch(e){ projectsCache = []; }
    const sel = projectFilter(); sel.innerHTML = '<option value="">All Projects</option>' + projectsCache.map(p=>`<option value="${p._id}">${p.name}</option>`).join('');
    const modalSel = document.getElementById('eProject');
    modalSel.innerHTML = projectsCache.map(p=>`<option value="${p._id}">${p.name}</option>`).join('');
  }

  async function loadExpenses(){
    const proj = projectFilter().value;
    const res = await api.get('/expenses'+(proj?`?project=${proj}`:''));
    expenses = res.expenses||[];
  }

  async function loadKPIs(){
    const res = await api.get('/expenses/dashboard');
    const k = res.kpis||{}; const chart = res.chart||[]; byProject = chart;
    document.getElementById('kTotal').textContent = '₹ '+(k.totalExpenses||0).toLocaleString();
    document.getElementById('kApproved').textContent = ((k.approvedPercent||0)*100).toFixed(1)+'%';
    document.getElementById('kBillable').textContent = ((k.billablePercent||0)*100).toFixed(1)+'%';
    document.getElementById('kReimbursed').textContent = ((k.reimbursedPercent||0)*100).toFixed(1)+'%';
  }

  function render(){
    const term = (document.getElementById('searchBox').value||'').toLowerCase();
    const currentUser = window.FlowIQ?.auth?.user();
    const userRole = currentUser?.role || '';
    const canApprove = userRole === 'Admin' || userRole === 'Project Manager';
    tblBody().innerHTML='';
    expenses.filter(e=> !term || (e.expenseName||'').toLowerCase().includes(term)).forEach(e=>{
      const tr=document.createElement('tr');
      const statusCell = `<td><span class="status-chip status-${e.status}">${e.status}</span></td>`;
      const actionsCell = canApprove && e.status === 'pending' 
        ? `<td><button class="table-btn approve-btn" data-id="${e._id}">Approve</button><button class="table-btn reject-btn" style="color:#ef4444;margin-left:.4rem" data-id="${e._id}">Reject</button></td>`
        : '<td>—</td>';
      tr.innerHTML=`<td>${e.expenseName}</td><td>₹ ${(e.amount||0).toLocaleString()}</td><td>${e.project?.name||''}</td><td>${e.submittedBy?.name||''}</td>${statusCell}<td>${e.billable?'Yes':'No'}</td><td>${e.date? new Date(e.date).toISOString().slice(0,10):''}</td>${actionsCell}`;
      tblBody().appendChild(tr);
    });
    // Bind approve/reject buttons
    if(canApprove){
      tblBody().querySelectorAll('.approve-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          try{
            await api.post(`/expenses/${btn.dataset.id}/approve`, {});
            await refreshAll();
            alert('Expense approved');
          }catch(e){ alert('Failed to approve: ' + (e.message || 'Unknown error')); }
        });
      });
      tblBody().querySelectorAll('.reject-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          try{
            await api.post(`/expenses/${btn.dataset.id}/reject`, {});
            await refreshAll();
            alert('Expense rejected');
          }catch(e){ alert('Failed to reject: ' + (e.message || 'Unknown error')); }
        });
      });
    }
    // by project
    tblProjBody().innerHTML='';
    byProject.forEach(r=>{
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${r.projectName||'(Unnamed)'}</td><td>₹ ${(r.amount||0).toLocaleString()}</td>`;
      tblProjBody().appendChild(tr);
    });
  }

  async function submitExpense(){
    const amount=parseFloat(document.getElementById('eAmount').value||'0');
    const description=document.getElementById('eDesc').value.trim();
    const project=document.getElementById('eProject').value;
    const billable=document.getElementById('eBillable').checked;
    const file=document.getElementById('eReceipt').files[0];
    if(!amount || !description){ return alert('Enter amount & description'); }
    const form=new FormData();
    form.append('amount', amount);
    form.append('description', description);
    form.append('project', project);
    form.append('billable', billable);
    if(file) form.append('receipt', file);
    try{
      ui.showLoader(contentArea);
      const res = await fetch('/expenses', { method:'POST', headers: { 'Authorization':'Bearer '+localStorage.getItem('flowiq_token') }, body: form });
      if(!res.ok) throw new Error('Submit failed');
      ui.closeModal('modalExpense');
      await refreshAll();
    }catch(e){ alert(e.message); }
    finally { ui.hideLoader(contentArea); }
  }

  async function refreshAll(){
    ui.showLoader(contentArea);
    try{
      await Promise.all([loadExpenses(), loadKPIs()]);
      render();
    } finally { ui.hideLoader(contentArea); }
  }
  
  // Expose refresh function globally so PM dashboard can trigger it
  window.refreshExpenses = refreshAll;

  function bind(){
    document.getElementById('btnSubmit').addEventListener('click',()=> ui.openModal('modalExpense'));
    document.getElementById('eSubmit').addEventListener('click', submitExpense);
    projectFilter().addEventListener('change', refreshAll);
    document.getElementById('searchBox').addEventListener('input', render);
    ui.bindClose();
    const file=document.getElementById('eReceipt'); const prev=document.getElementById('ePreview');
    file.addEventListener('change',()=>{ const f=file.files[0]; if(!f){ prev.style.display='none'; return; } const r=new FileReader(); r.onload=()=>{ prev.src=r.result; prev.style.display='block'; }; r.readAsDataURL(f); });
  }

  async function start(){ ui.showLoader(contentArea); try{ await loadProjects(); await refreshAll(); } finally { ui.hideLoader(contentArea); } bind(); }
  document.addEventListener('DOMContentLoaded', start);
})();