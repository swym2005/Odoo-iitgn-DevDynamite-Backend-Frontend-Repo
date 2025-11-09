import '/assets/css/cards.css';
(function(){
  const { api } = window.FlowIQ;
  const cards = document.getElementById('cards');
  const qSearch = document.getElementById('qSearch');
  const qStatus = document.getElementById('qStatus');
  const kpiWrap = document.getElementById('kpiWrap');

  function escapeHtml(str){ return String(str||'').replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[s])); }

  function projectCard(p){
    // Calculate profit percentage, capped at -100% for clarity (loss cannot exceed 100% of revenue)
    const profit = (p.revenue||0) - (p.cost||0);
    const profitPct = (p.revenue && p.revenue > 0) ? Math.max(-100, Math.min(100, (profit / p.revenue) * 100)).toFixed(1) : '--';
    const progress = p.progress!=null? p.progress : 0;
    const budget = Number(p.budget||0);
    const cost = Number(p.cost||0);
    const usage = budget>0 ? Math.min(100, Math.round(cost/budget*100)) : 0;
    return `<div class="project-card">
      <div class="thumb">🗂️</div>
      <div class="row"><span class="title">${escapeHtml(p.name)}</span><span class="status-chip">${escapeHtml(p.status)}</span></div>
      <div class="meta">
        <div class="row"><span>Client</span><span>${escapeHtml(p.client||'—')}</span></div>
        <div class="row"><span>Budget</span><span>$ ${(p.budget||0).toLocaleString()}</span></div>
        <div class="row"><span>Profit</span><span>${profitPct==='--'?'--': profitPct+'%'}</span></div>
        <div class="row"><span>Deadline</span><span>${p.deadline? new Date(p.deadline).toISOString().slice(0,10): '—'}</span></div>
      </div>
      <div class="progress"><span style="width:${progress}%"></span></div>
      <div class="progress budget" title="Budget used: ${usage}%"><span style="width:${usage}%"></span></div>
      <div class="actions">
        <a class="button-outline" href="/project-detail/?id=${p._id}">View</a>
        <a class="button-outline" href="/tasks/?projectId=${p._id}">Tasks</a>
      </div>
    </div>`;
  }

  async function loadProjects(){
    try{ const res = await api.get('/pm/projects'); return res.projects||[]; }catch{ return []; }
  }

  async function loadKPIs(){
    // Try analytics overview (PM/Admin), else fallback quick KPIs
    try{
      const res = await api.get('/analytics/overview');
      const r = res || {};
      renderKPIs([
        { name:'Revenue', value: r.totalRevenue!=null? formatCurrency(r.totalRevenue): '—' },
        { name:'Cost', value: r.totalCost!=null? formatCurrency(r.totalCost): '—' },
        { name:'Profit', value: r.profit!=null? formatCurrency(r.profit): '—' },
        { name:'Utilization', value: r.avgUtilization!=null? Math.round(r.avgUtilization*100)+'%': '—' },
      ]);
      return;
    }catch{}
    renderKPIs([]);
  }

  function formatCurrency(v){ if(v==null) return '—'; return '₹ '+Number(v).toLocaleString(undefined,{minimumFractionDigits:0}); }

  function renderKPIs(list){
    kpiWrap.innerHTML = '';
    const base = list.length? list: [
      { name:'Active Projects', value:'—' },
      { name:'Delayed Tasks', value:'—' },
      { name:'Hours Logged', value:'—' },
      { name:'Revenue Earned', value:'—' },
    ];
    base.forEach(k=>{
      const d=document.createElement('div'); d.className='kpi'; d.innerHTML=`<h3>${escapeHtml(k.name)}</h3><div class="value">${k.value}</div>`; kpiWrap.appendChild(d);
    });
  }

  function applyFilters(list){
    const s = (qSearch.value||'').toLowerCase();
    const st = qStatus.value||'';
    return list.filter(p => (!st || p.status===st) && (!s || [p.name, p.client].some(x=> String(x||'').toLowerCase().includes(s))));
  }

  async function start(){
    const list = await loadProjects();
    loadKPIs();
    render(list);
    qSearch.addEventListener('input',()=> render(list));
    qStatus.addEventListener('change',()=> render(list));
  }

  function render(list){
    const filtered = applyFilters(list);
    cards.innerHTML='';
    if(!filtered.length){ cards.innerHTML = `<div style="padding:1rem;opacity:.7">No matching projects</div>`; return; }
    filtered.forEach(p=> cards.insertAdjacentHTML('beforeend', projectCard(p)));
  }

  document.addEventListener('DOMContentLoaded', start);
})();
