(function(){
  const { api, ui } = window.FlowIQ;
  const usersTbody = () => document.querySelector('#tblUsers tbody');
  let selectedUser = null;

  async function loadUsers(){
    const res = await api.get('/admin/users');
    return res.users || [];
  }

  function renderUsers(list){
    usersTbody().innerHTML='';
    list.forEach(u=>{
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${u.name}</td><td><span class="badge role-${u.role.replace(/ /g,'\\ ')}">${u.role}</span></td><td>${u.email}</td><td class="${u.status==='active'?'status-active':'status-inactive'}">${u.status||'active'}</td><td>${(u.createdAt||'').slice(0,10)}</td>`;
      tr.addEventListener('click',()=> selectRow(u,tr));
      usersTbody().appendChild(tr);
    });
  }

  function selectRow(user,tr){
    selectedUser = user;
    document.querySelectorAll('#tblUsers tbody tr').forEach(r=>r.classList.remove('row-selected'));
    tr.classList.add('row-selected');
    document.getElementById('btnChangeRole').disabled=false;
    document.getElementById('btnDeactivate').disabled=false;
  }

  async function loadKPIs(){
    const res = await api.get('/admin/dashboard');
    const k = res.kpis || {};
    document.getElementById('kpiUsers').textContent = k.totalUsers ?? '0';
    document.getElementById('kpiProjects').textContent = k.activeProjects ?? '0';
    document.getElementById('kpiRevenue').textContent = '₹ '+(k.totalRevenue||0).toLocaleString();
    document.getElementById('kpiExpenses').textContent = '₹ '+(k.totalExpenses||0).toLocaleString();
  }

  async function createUser(){
    const name=document.getElementById('mName').value.trim();
    const email=document.getElementById('mEmail').value.trim();
    const pass=document.getElementById('mPass').value;
    const role=document.getElementById('mRole').value;
    if(!name||!email||!pass){ return alert('All fields required'); }
    try{
      await api.post('/admin/users',{ name,email,password:pass,role });
      ui.closeModal('modalCreate');
      start();
    }catch(e){ alert(e.message); }
  }

  async function changeRole(){
    if(!selectedUser) return;
    const newRole = prompt('New role (Admin, Project Manager, Team Member, Finance):', selectedUser.role);
    if(!newRole) return;
    try{ await api.patch(`/admin/users/${selectedUser._id}`, { role:newRole }); start(); }catch(e){ alert(e.message); }
  }

  async function deactivate(){
    if(!selectedUser) return;
    try{ await api.patch(`/admin/users/${selectedUser._id}`, { status:'inactive' }); start(); }catch(e){ alert(e.message); }
  }

  // Overhauled system analytics using overview analytics endpoint for richer data
  function initAnalytics(){
    api.get('/analytics/overview').then(res=>{
      if(!window.Chart) return;
      const revCtx=document.getElementById('chartRevenue');
      const usersCtx=document.getElementById('chartUsers');
      const growth=res.charts?.revenueGrowth||[];
      const revLabels=growth.map(r=> r.label);
      const revData=growth.map(r=> r.revenue);
      new Chart(revCtx,{ type:'line', data:{ labels:revLabels, datasets:[{ label:'Revenue', data:revData, borderColor:'#4f9fff', backgroundColor:'#4f9fff33' }] }, options:{ plugins:{legend:{labels:{color:'#e6edf5'}}}, scales:{x:{ticks:{color:'#9aa9bd'}},y:{ticks:{color:'#9aa9bd'}}}} });
      const util = res.charts?.utilization || [];
      const userLabels=util.map(u=>u.name||String(u.userId).slice(-6));
      const userHours=util.map(u=>u.hours);
      new Chart(usersCtx,{ type:'bar', data:{ labels:userLabels, datasets:[{ label:'Hours Logged', data:userHours, backgroundColor:'#8b5cf655', borderColor:'#8b5cf6' }] }, options:{ plugins:{legend:{labels:{color:'#e6edf5'}}}, scales:{x:{ticks:{color:'#9aa9bd'}},y:{ticks:{color:'#9aa9bd'}}}} });
    }).catch(()=>{});
  }

  function bind(){
    document.getElementById('btnCreateUser').addEventListener('click',()=> ui.openModal('modalCreate'));
    document.getElementById('mCreateBtn').addEventListener('click', createUser);
    document.getElementById('btnChangeRole').addEventListener('click', changeRole);
    document.getElementById('btnDeactivate').addEventListener('click', deactivate);
    document.getElementById('btnAnalytics').addEventListener('click',()=>{ ui.openModal('modalAnalytics'); initAnalytics(); });
    ui.bindClose();
  }

  async function start(){
    try{
      const [users] = await Promise.all([loadUsers(), loadKPIs()]);
      renderUsers(users);
    }catch(e){ alert('Failed loading admin data: '+e.message); }
  }
  document.addEventListener('DOMContentLoaded',()=>{ bind(); start(); });
})();
