(function(){
  const { useState, useEffect } = React;

  const API = {
    signup: (payload) => fetch('/auth/signup', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) }).then(r=>r.json()),
    login: (payload) => fetch('/auth/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) }).then(r=>r.json()),
  };

  const roles = [ 'Admin', 'Project Manager', 'Team Member', 'Finance' ];

  function saveAuth(token, user){
    localStorage.setItem('flowiq_token', token);
    localStorage.setItem('flowiq_user', JSON.stringify(user));
  }
  function getToken(){ return localStorage.getItem('flowiq_token'); }

  function AuthApp(){
    const [tab, setTab] = useState('login');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // form state
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState(roles[0]);
    const [remember, setRemember] = useState(false);

    useEffect(()=>{ setError(''); setSuccess(''); }, [tab]);

    function handleLogin(e){
      e.preventDefault();
      setError(''); setSuccess('');
      const trimmedEmail = (email||'').trim();
      if(!trimmedEmail){ setError('Please enter your email.'); return; }
      if(!(password||'').length){ setError('Please enter your password.'); return; }
      setLoading(true);
      API.login({ email: trimmedEmail, password, rememberMe: remember })
        .then(data=>{
          if(!data.success){ throw new Error(data.message || 'Login failed'); }
          saveAuth(data.token, data.user);
          setSuccess('Login successful');
          setTimeout(()=>{ window.location.href = data.redirectPath || '/'; }, 600);
        })
        .catch(err=> setError(err.message))
        .finally(()=> setLoading(false));
    }
    function handleSignup(e){
      e.preventDefault();
      setError(''); setSuccess('');
      const trimmedName = (name||'').trim();
      const trimmedEmail = (email||'').trim();
      if(!trimmedName){ setError('Please enter your name.'); return; }
      if(!trimmedEmail){ setError('Please enter your email.'); return; }
      if((password||'').length < 6){ setError('Password must be at least 6 characters.'); return; }
      setLoading(true);
      API.signup({ name: trimmedName, email: trimmedEmail, password, role })
        .then(data=>{
          if(!data.success){ throw new Error(data.message || 'Signup failed'); }
          saveAuth(data.token, data.user);
          setSuccess('Account created');
          setTimeout(()=>{ window.location.href = data.redirectPath || '/'; }, 800);
        })
        .catch(err=> setError(err.message))
        .finally(()=> setLoading(false));
    }

    return (
      React.createElement('div', { className:'app-shell' }, [
        React.createElement(LeftStage, { key:'left' }),
        React.createElement('div', { className:'right-auth', key:'right' },
          React.createElement('div', { className:'card fade-in slide-up' }, [
            React.createElement('div', { className:'card-header' }, [
              React.createElement('div', { className:'brand' }, [
                React.createElement('div', { className:'dot' }),
                React.createElement('span', null, 'FlowIQ')
              ]),
              // Fix tabs rendering: map over both entries instead of leaving the first as raw array (which rendered as "loginLogin")
              React.createElement('div', { className:'tabs' },
                [ ['login','Login'], ['signup','Signup'] ].map(([val,label]) =>
                  React.createElement('button', { type:'button', key:val, className:'tab' + (tab===val?' active':''), onClick:()=>setTab(val) }, label)
                )
              )
            ]),
            React.createElement('form', { className:'form', onSubmit: tab==='login'?handleLogin:handleSignup }, [
              React.createElement('div', { className:'row' + (tab==='signup' ? ' slide-up' : ''), style: { display: tab==='signup' ? 'grid' : 'none' } }, [
                React.createElement('label', { className:'label' }, 'Name'),
                React.createElement('input', { className:'input', required: tab==='signup', value:name, onChange:e=>setName(e.target.value), placeholder:'Your full name' })
              ]),
              React.createElement('div', { className:'row' }, [
                React.createElement('label', { className:'label' }, 'Email'),
                React.createElement('input', { type:'email', className:'input', required:true, value:email, onChange:e=>setEmail(e.target.value), placeholder:'you@company.com' })
              ]),
              React.createElement('div', { className:'row' }, [
                React.createElement('label', { className:'label' }, 'Password'),
                React.createElement('input', { type:'password', className:'input', required:true, minLength:6, value:password, onChange:e=>setPassword(e.target.value), placeholder:'••••••••' })
              ]),
              React.createElement('div', { className:'row', style: { display: tab==='signup' ? 'grid' : 'none' } }, [
                React.createElement('label', { className:'label' }, 'Role'),
                React.createElement('select', { className:'select', required: tab==='signup', value:role, onChange:e=>setRole(e.target.value) }, roles.map(r=>React.createElement('option', { key:r, value:r }, r)))
              ]),
              tab==='login' && React.createElement('div', { className:'helper' }, [
                React.createElement('label', null, [
                  React.createElement('input', { type:'checkbox', className:'checkbox', checked:remember, onChange:e=>setRemember(e.target.checked) }),
                  React.createElement('span', { className:'small' }, 'Remember me')
                ]),
                React.createElement('a', { href:'#', className:'small', onClick:(e)=>{ e.preventDefault(); alert('Password reset flow not implemented in UI yet.'); } }, 'Forgot password?')
              ]),
              error && React.createElement('div', { className:'error' }, error),
              success && React.createElement('div', { className:'success' }, success),
              React.createElement('button', { type:'submit', disabled: loading || (tab==='signup' ? (!name.trim() || !email.trim() || password.length < 6) : (!email.trim() || !password.length)) , className:'btn btn-primary' }, loading ? 'Please wait…' : (tab==='login'?'Login':'Create Account')),
              React.createElement('div', { className:'footer-note' }, 'Smarter Project Management — Powered by AI')
            ])
          ])
        )
      ])
    );
  }

  function LeftStage(){
    return (
      React.createElement('div', { className:'left-stage' }, [
        React.createElement('div', { className:'blob b1', key:'b1' }),
        React.createElement('div', { className:'blob b2', key:'b2' }),
        React.createElement('div', { className:'grid-overlay', key:'go' }),
        React.createElement('div', { className:'stage-content fade-in slide-up' }, [
          React.createElement('div', { className:'tag' }, [
            React.createElement('span', null, 'AI Enhanced')
          ]),
          React.createElement('div', { className:'h1' }, 'Smarter Project Management — Powered by AI'),
          React.createElement('p', { className:'sub' }, 'Intelligent dashboards, automated timesheets, predictive expense tracking and more. FlowIQ elevates your team performance.')
        ])
      ])
    );
  }

  ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(AuthApp));
})();
