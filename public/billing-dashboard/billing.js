(function(){
  const { ui } = window.FlowIQ;
  const docs=[
    {type:'Sales Order', number:'SO-1001', partner:'Acme', project:'Apollo', amount:200000, status:'Confirmed'},
    {type:'Customer Invoice', number:'INV-543', partner:'Acme', project:'Apollo', amount:120000, status:'Paid'},
    {type:'Vendor Bill', number:'BILL-225', partner:'VendorX', project:'Apollo', amount:40000, status:'Posted'},
    {type:'Expense', number:'EXP-77', partner:'Team', project:'Apollo', amount:12000, status:'Approved'}
  ];
  const tbody=()=>document.querySelector('#tbl tbody');
  function el(id){return document.getElementById(id);} function fmt(n){return '₹ '+Number(n).toLocaleString();}
  function calcKPIs(){
    const revenue = docs.filter(d=>d.type==='Customer Invoice' || d.type==='Sales Order').reduce((s,d)=>s+d.amount,0);
    const cost = docs.filter(d=>d.type==='Vendor Bill' || d.type==='Expense' || d.type==='Purchase Order').reduce((s,d)=>s+d.amount,0);
    const outstanding = docs.filter(d=>d.type==='Customer Invoice' && d.status!=='Paid').reduce((s,d)=>s+d.amount,0);
    el('kRev').textContent = fmt(revenue);
    el('kCost').textContent = fmt(cost);
    el('kOut').textContent = fmt(outstanding);
    // Cap profit percentage at -100% to 100% for clarity
    const profit = revenue - cost;
    const profitPct = (revenue && revenue > 0) ? Math.max(-100, Math.min(100, Math.round((profit/revenue)*100))) : null;
    el('kProfit').textContent = profitPct !== null ? profitPct+'%' : '—';
  }
  function render(){ const mode = el('tab').value; tbody().innerHTML=''; docs.filter(d=>{
    if(mode==='SO') return d.type==='Sales Order';
    if(mode==='PO') return d.type==='Purchase Order';
    if(mode==='INV') return d.type==='Customer Invoice';
    if(mode==='BILL') return d.type==='Vendor Bill';
    if(mode==='EXP') return d.type==='Expense';
    return true; }).forEach(d=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td>${d.number}</td><td>${d.partner}</td><td>${d.project}</td><td>${fmt(d.amount)}</td><td>${d.status}</td>`; tbody().appendChild(tr); }); calcKPIs(); }
  function bind(){ el('btnCreateDoc').addEventListener('click',()=> ui.openModal('modalDoc')); ui.bindClose(); el('dCreate').addEventListener('click',()=>{ const type=el('dType').value; const number=el('dNum').value.trim(); const partner=el('dPartner').value.trim(); const project=el('dProject').value.trim(); const amount=parseFloat(el('dAmount').value||'0'); const status=el('dStatus').value.trim()||'Draft'; if(!number||!partner||!project||!amount){ return alert('Fill required fields'); } docs.push({type, number, partner, project, amount, status}); ui.closeModal('modalDoc'); render(); }); el('tab').addEventListener('change',render); }
  function start(){ render(); bind(); }
  document.addEventListener('DOMContentLoaded', start);
})();