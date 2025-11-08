(function(){
  const msgs=()=>document.getElementById('msgs');
  function add(role, text){ const d=document.createElement('div'); d.className='msg '+role; d.textContent=text; msgs().appendChild(d); msgs().scrollTop=msgs().scrollHeight; }
  function send(text){ add('user', text); add('ai','Thinking…');
    // Placeholder: call backend /ai/ask if available
    setTimeout(()=>{ const last=msgs().querySelector('.msg.ai:last-child'); if(last) last.textContent = `AI: (mock) Insight for: ${text}`; }, 600);
  }
  function bind(){
    document.getElementById('send').addEventListener('click',()=>{ const q=document.getElementById('q'); const v=q.value.trim(); if(!v) return; q.value=''; send(v); });
    document.querySelectorAll('.s').forEach(b=> b.addEventListener('click',()=> send(b.textContent)) );
  }
  document.addEventListener('DOMContentLoaded', bind);
})();