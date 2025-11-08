(function(){
  const api = window.FlowIQ?.api;
  function el(id){return document.getElementById(id);} const fmt=n=>'₹ '+Number(n||0).toLocaleString();
  let revChart=null, cvChart=null, statusChart=null, radarChart=null;

  async function load(){
    try{
      const res = await api.get('/analytics/overview');
      const k=res.kpis||{};
      el('aRev').textContent=fmt(k.totalRevenue);
      el('aMargin').textContent= (k.avgProfitMargin? (k.avgProfitMargin*100).toFixed(1):'0.0')+'%';
      el('aROI').textContent= ((1-(k.expenseRatio||0))*100).toFixed(1)+'%';
      el('aHours').textContent= (k.hoursLogged||0).toLocaleString();
      charts(res.charts||{});
    }catch(e){ console.warn('Analytics load failed',e); }
  }

  function charts(data){ if(!window.Chart) return; const growth=data.revenueGrowth||[]; const costRv=data.costVsRevenue||[]; const task=data.taskCompletion||{done:0,remaining:0}; const util=data.utilization||[];
    // Revenue growth
    const gLabels=growth.map(g=>g.label); const gData=growth.map(g=>g.revenue);
    if(!revChart){ revChart=new Chart(document.getElementById('chartRevGrowth'),{ type:'line', data:{ labels:gLabels, datasets:[{label:'Revenue', data:gData, borderColor:'#4f9fff', backgroundColor:'#4f9fff33'}] }, options:{ plugins:{legend:{labels:{color:'#e6edf5'}}}, scales:{x:{ticks:{color:'#9aa9bd'}},y:{ticks:{color:'#9aa9bd'}}}}}); } else { revChart.data.labels=gLabels; revChart.data.datasets[0].data=gData; revChart.update(); }
    // Cost vs Revenue by project
    const cLabels=costRv.map(r=>r.projectName); const cCost=costRv.map(r=>r.cost); const cRev=costRv.map(r=>r.revenue);
    if(!cvChart){ cvChart=new Chart(document.getElementById('chartCvRp'),{ type:'bar', data:{ labels:cLabels, datasets:[{label:'Cost', data:cCost, backgroundColor:'#ef444455', borderColor:'#ef4444'},{label:'Revenue', data:cRev, backgroundColor:'#10b98155', borderColor:'#10b981'}] }, options:{ plugins:{legend:{labels:{color:'#e6edf5'}}}, scales:{x:{ticks:{color:'#9aa9bd'}},y:{ticks:{color:'#9aa9bd'}}}}}); } else { cvChart.data.labels=cLabels; cvChart.data.datasets[0].data=cCost; cvChart.data.datasets[1].data=cRev; cvChart.update(); }
    // Task status (done vs remaining)
    if(!statusChart){ statusChart=new Chart(document.getElementById('chartStatus'),{ type:'pie', data:{ labels:['Done','Remaining'], datasets:[{ data:[task.done,task.remaining], backgroundColor:['#10b981','#4f9fff55'] }] }, options:{ plugins:{legend:{labels:{color:'#e6edf5'}}}}}); } else { statusChart.data.datasets[0].data=[task.done,task.remaining]; statusChart.update(); }
    // Utilization radar
    const uLabels=util.map(u=>u.name||'User'); const uData=util.map(u=> Math.round(u.utilization*100));
    if(!radarChart){ radarChart=new Chart(document.getElementById('chartRadar'),{ type:'radar', data:{ labels:uLabels, datasets:[{ label:'Util %', data:uData, backgroundColor:'#8b5cf633', borderColor:'#8b5cf6', pointBackgroundColor:'#8b5cf6' }] }, options:{ scales:{ r:{ pointLabels:{ color:'#9aa9bd' }, grid:{ color:'#2d3a55' }, angleLines:{ color:'#2d3a55' }, ticks:{ display:false } } }, plugins:{legend:{labels:{color:'#e6edf5'}}}} }); } else { radarChart.data.labels=uLabels; radarChart.data.datasets[0].data=uData; radarChart.update(); }
  }

  function bind(){ document.getElementById('btnDownload').addEventListener('click',()=> window.location='/analytics/overview/download'); }
  function start(){ load(); bind(); setInterval(load,60000); }
  document.addEventListener('DOMContentLoaded', start);
})();