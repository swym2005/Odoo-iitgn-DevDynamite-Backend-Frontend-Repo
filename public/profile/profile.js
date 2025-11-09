(function(){
  const { api, ui } = window.FlowIQ;
  if(!api || !ui){ 
    console.error('FlowIQ not loaded');
    return;
  }
  
  let profile=null; 
  let hoursChart=null;
  
  function setText(id,val){ 
    const el=document.getElementById(id); 
    if(el) el.textContent=val||'—'; 
  }
  
  function getEl(id){
    const el = document.getElementById(id);
    if(!el) console.warn('Element not found:', id);
    return el;
  }
  
  async function loadProfile(){ 
    try {
      // Check if we have a token first
      const token = window.FlowIQ.auth.token();
      if(!token) {
        console.error('No authentication token found in localStorage');
        // Check all possible token keys
        const allKeys = ['orbitone_token', 'flowiq_token'];
        const foundKeys = allKeys.filter(k => localStorage.getItem(k));
        console.log('Available token keys:', foundKeys);
        // Clean up any stale tokens
        ['orbitone_token','orbitone_user','flowiq_token','flowiq_user'].forEach(k=> localStorage.removeItem(k));
        window.location.href = '/login';
        return;
      }
      
      console.log('Token found, length:', token.length);
      console.log('Token preview:', token.substring(0, 20) + '...');
      
      // Verify token format (JWT tokens have 3 parts separated by dots)
      if(!token.includes('.')) {
        console.error('Invalid token format - not a JWT');
        ['orbitone_token','orbitone_user','flowiq_token','flowiq_user'].forEach(k=> localStorage.removeItem(k));
        window.location.href = '/login';
        return;
      }
      
      const res = await api.get('/profile'); 
      if(!res || !res.success){
        throw new Error(res?.message || 'Failed to load profile');
      }
      profile = res.profile; 
      if(!profile) {
        throw new Error('Profile data is empty');
      }
      hydrate(); 
      await loadHours(); 
    } catch(e){ 
      console.error('Profile load error:', e);
      console.error('Error stack:', e.stack);
      // Handle unauthorized errors
      if(e.message && (e.message.includes('401') || e.message.includes('Unauthorized') || e.message.includes('expired') || e.message.includes('Invalid'))) {
        console.log('Token is invalid or expired, redirecting to login');
        // Clean up tokens and redirect
        ['orbitone_token','orbitone_user','flowiq_token','flowiq_user'].forEach(k=> localStorage.removeItem(k));
        window.location.href = '/login';
        return;
      }
      const errorMsg = e.message || 'Unknown error';
      console.error('Profile error details:', errorMsg);
      // Only show alert if it's not a navigation error
      if(!errorMsg.includes('redirect') && !errorMsg.includes('401') && !errorMsg.includes('Unauthorized')) {
        alert('Failed to load profile: ' + errorMsg);
      }
    }
  }
  
  function hydrate(){ 
    if(!profile) {
      console.warn('No profile data');
      return;
    }
    setText('profName', profile.name || '—');
    setText('profRole', profile.role || '—');
    setText('profEmail', profile.email || '—');
    setText('profTheme', profile.preferences?.theme || 'system');
    
    const fName = getEl('fName');
    const fPhone = getEl('fPhone');
    const fLocation = getEl('fLocation');
    const prefTheme = getEl('prefTheme');
    const prefEmail = getEl('prefEmail');
    const prefPush = getEl('prefPush');
    
    if(fName) fName.value = profile.name || '';
    if(fPhone) fPhone.value = profile.phone || '';
    if(fLocation) fLocation.value = profile.location || '';
    if(prefTheme) prefTheme.value = profile.preferences?.theme || 'system';
    if(prefEmail) prefEmail.value = String(profile.preferences?.notifications?.email !== false);
    if(prefPush) prefPush.value = String(profile.preferences?.notifications?.push !== false);
  }
  
  async function saveInfo(){ 
    const fName = getEl('fName');
    const fPhone = getEl('fPhone');
    const fLocation = getEl('fLocation');
    const fAvatar = getEl('fAvatar');
    
    if(!fName) return alert('Name field not found');
    
    const fd = new FormData(); 
    fd.append('name', fName.value.trim()); 
    if(fPhone) fd.append('phone', fPhone.value.trim()); 
    if(fLocation) fd.append('location', fLocation.value.trim()); 
    
    const av = fAvatar?.files?.[0]; 
    if(av) fd.append('avatar', av); 
    
    try{ 
      const res = await api.put('/profile', fd);
      if(!res || !res.success) throw new Error(res?.message || 'Save failed'); 
      profile = res.profile; 
      hydrate(); 
      alert('Profile updated successfully'); 
    } catch(e){ 
      console.error('Save error:', e);
      alert('Failed to save: ' + (e.message || 'Unknown error')); 
    } 
  }
  
  async function changePassword(){ 
    const pwCurrent = getEl('pwCurrent');
    const pwNew = getEl('pwNew');
    const pwConfirm = getEl('pwConfirm');
    const pwMsg = getEl('pwMsg');
    
    if(!pwCurrent || !pwNew || !pwConfirm || !pwMsg) {
      return alert('Password fields not found');
    }
    
    const cur = pwCurrent.value; 
    const nw = pwNew.value; 
    const cf = pwConfirm.value; 
    
    if(!cur || !nw || nw.length < 6 || nw !== cf){ 
      pwMsg.textContent = 'Check inputs (min 6 chars, match confirm).'; 
      return; 
    } 
    
    pwMsg.textContent = 'Processing…'; 
    try{ 
      const res = await api.post('/profile/change-password', { 
        currentPassword: cur, 
        newPassword: nw 
      }); 
      if(!res || !res.success) throw new Error(res?.message || 'Failed'); 
      pwMsg.textContent = 'Password updated successfully'; 
      pwCurrent.value = ''; 
      pwNew.value = ''; 
      pwConfirm.value = ''; 
    } catch(e){ 
      console.error('Password change error:', e);
      pwMsg.textContent = e.message || 'Failed to update password'; 
    } 
  }
  
  async function savePrefs(){ 
    const prefTheme = getEl('prefTheme');
    const prefEmail = getEl('prefEmail');
    const prefPush = getEl('prefPush');
    
    if(!prefTheme || !prefEmail || !prefPush) {
      return alert('Preference fields not found');
    }
    
    const theme = prefTheme.value; 
    const email = prefEmail.value === 'true'; 
    const push = prefPush.value === 'true'; 
    
    try{ 
      const res = await api.put('/profile/preferences', { 
        theme, 
        notifications: { email, push } 
      }); 
      if(!res || !res.success) throw new Error(res?.message || 'Failed'); 
      profile = res.profile; 
      hydrate(); 
      alert('Preferences saved successfully'); 
    } catch(e){ 
      console.error('Preferences save error:', e);
      alert('Failed to save preferences: ' + (e.message || 'Unknown error')); 
    } 
  }
  
  async function loadHours(){ 
    const usageLoading = getEl('usageLoading');
    try{ 
      // Try to get timesheets overview
      const res = await api.get('/timesheets/overview').catch(() => null);
      
      if(res && res.hoursPerProject && Array.isArray(res.hoursPerProject) && res.hoursPerProject.length > 0){ 
        renderHours(res.hoursPerProject); 
      } else {
        if(usageLoading) usageLoading.textContent = 'No hours logged yet';
      }
    } catch(e){ 
      console.warn('Hours load error:', e);
      if(usageLoading) usageLoading.textContent = 'No hours data available'; 
    } 
  }
  
  function renderHours(rows){ 
    const el = getEl('usageLoading');
    if(el) el.remove(); 
    if(!window.Chart) {
      console.warn('Chart.js not loaded');
      return;
    }
    const ctx = getEl('chartHours');
    if(!ctx) {
      console.warn('Chart canvas not found');
      return;
    }
    
    const labels = rows.map(r => r.projectName || r.projectId?.slice(-6) || 'Unknown'); 
    const data = rows.map(r => r.hours || 0); 
    
    if(hoursChart){ 
      hoursChart.data.labels = labels; 
      hoursChart.data.datasets[0].data = data; 
      hoursChart.update(); 
    } else { 
      hoursChart = new Chart(ctx, { 
        type: 'bar', 
        data: { 
          labels, 
          datasets: [{ 
            label: 'Hours Logged', 
            data, 
            backgroundColor: '#8b5cf655', 
            borderColor: '#8b5cf6' 
          }] 
        }, 
        options: { 
          plugins: { legend: { labels: { color: '#e6edf5' } } }, 
          scales: { 
            x: { ticks: { color: '#9aa9bd' } }, 
            y: { ticks: { color: '#9aa9bd' } }
          }
        } 
      }); 
    } 
  }
  
  function bind(){ 
    const btnInfoSave = getEl('btnInfoSave');
    const btnInfoReset = getEl('btnInfoReset');
    const btnPwChange = getEl('btnPwChange');
    const btnPrefSave = getEl('btnPrefSave');
    const btnPrefReset = getEl('btnPrefReset');
    
    if(btnInfoSave) btnInfoSave.addEventListener('click', saveInfo); 
    if(btnInfoReset) btnInfoReset.addEventListener('click', hydrate); 
    if(btnPwChange) btnPwChange.addEventListener('click', changePassword); 
    if(btnPrefSave) btnPrefSave.addEventListener('click', savePrefs); 
    if(btnPrefReset) btnPrefReset.addEventListener('click', hydrate); 
  }
  
  document.addEventListener('DOMContentLoaded', () => { 
    bind(); 
    loadProfile(); 
  });
})();
