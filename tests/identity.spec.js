/* Identity marks (2026-11-24/25): quiet workspace monogram (not Kairo's gradient), smart initials, a real workspace logo,
   one muted tint per workspace for people in several, and "Continue as …" naming the last workspace.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\identity.spec.js */
(function(){
  var results = [];
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var q = function(s, el){ return (el || document).querySelector(s); };
  var errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e && e.message || e) }); } pub(); }
  function pub(){ var pre = document.getElementById('auth-test-results'); if(!pre){ pre = document.createElement('pre'); pre.id = 'auth-test-results'; document.body.appendChild(pre); } pre.textContent = JSON.stringify(results); }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function eq(a, b, m){ if(a !== b) throw new Error((m ? m + ': ' : '') + 'expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a)); }
  var PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    try { localStorage.clear(); } catch(e){}
    state.role = 'admin'; enterApp(); await sleep(100);

    await t('initials come from the first two meaningful words; legal and generic suffixes are skipped', async function(){
      eq(oOrgInitials('Northstar Talent Partners Pvt. Ltd.'), 'NT'); eq(oOrgInitials('Vistaar HR Services'), 'VH'); eq(oOrgInitials('Kesar Staffing'), 'KS');
      eq(oOrgInitials('Infosys'), 'I', 'one word, one letter'); eq(oOrgInitials('The Hiring Co.'), 'H'); eq(oOrgInitials('Acme & Sons'), 'AS'); eq(oOrgInitials(''), '?');
    });

    await t('the sidebar tile is a quiet monogram: navy initials on a soft tint, not Kairo’s gradient', async function(){
      var el = q('#ws-initials'), cs = getComputedStyle(el);
      eq(el.textContent, oOrgInitials(ORG_STRUCTURE.profile.brandName), 'smart initials');
      ok(cs.backgroundImage === 'none' && cs.backgroundColor === 'rgb(238, 241, 246)' && cs.color === 'rgb(11, 31, 59)', 'quiet tint: ' + cs.backgroundImage + ' ' + cs.backgroundColor + ' ' + cs.color);
      ok(!el.style.background, 'one workspace: no per-workspace tint');
    });

    await t('a workspace logo replaces the initials in the sidebar and in Settings; Remove brings the initials back', async function(){
      ORG_STRUCTURE.profile.logo = PNG; renderSidebar(); await sleep(10);
      var el = q('#ws-initials'); ok(el.classList.contains('has-logo') && q('img', el) && q('img', el).getAttribute('src') === PNG, 'logo in the sidebar tile');
      showView('settings'); await sleep(30); openSettings('workspace', 'profile'); await sleep(30);
      var row = q('.s-logo.has-logo img'); ok(row, 'logo in Settings'); ok(/Replace/.test(document.getElementById('main-content').textContent) && /Remove/.test(document.getElementById('main-content').textContent), 'Replace and Remove');
      sLogoRemove(); await sleep(20);
      ok(!ORG_STRUCTURE.profile.logo && !q('#ws-initials').classList.contains('has-logo') && q('#ws-initials').textContent === oOrgInitials(ORG_STRUCTURE.profile.brandName), 'initials back');
      ok(/Upload logo/.test(document.getElementById('main-content').textContent), 'Settings offers Upload again');
    });

    await t('upload checks the file: a non-image is refused; a small PNG becomes the logo', async function(){
      sLogoPick({ files:[new File(['x'], 'notes.txt', { type:'text/plain' })], value:'' }); await sleep(10);
      ok(!ORG_STRUCTURE.profile.logo && /PNG, JPG, SVG or WebP/.test(document.getElementById('toast-container').textContent), 'wrong type refused');
      var bin = atob(PNG.split(',')[1]), arr = new Uint8Array(bin.length); for(var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      sLogoPick({ files:[new File([arr], 'logo.png', { type:'image/png' })], value:'' });
      for(var k = 0; k < 40 && !ORG_STRUCTURE.profile.logo; k++) await sleep(25);
      ok(/^data:image\/png/.test(ORG_STRUCTURE.profile.logo || '') && q('#ws-initials').classList.contains('has-logo'), 'uploaded and shown');
      sLogoRemove();
    });

    await t('several workspaces: one muted tint each (stable per workspace); the sign-in picker shows them', async function(){
      var a = oWorkspaceTint('ws_harbor'), b = oWorkspaceTint('ws_harbor'); eq(a.join(), b.join(), 'stable');
      ok(/^#[0-9A-F]{6}$/i.test(a[0]) && /^#[0-9A-F]{6}$/i.test(a[1]), 'a tint pair');
      authFlow.workspaces = [{ id:'ws_harbor', name:'Harbor Partners', roleLabel:'Recruiter' }, { id:'ws_kesar', name:'Kesar Staffing Pvt Ltd', roleLabel:'Owner' }];
      var d = document.createElement('div'); d.innerHTML = authWorkspacesStepHTML(); var marks = d.querySelectorAll('.au-ws__mark');
      eq(marks.length, 2); eq(marks[0].textContent, 'HP'); eq(marks[1].textContent, 'KS', 'suffix skipped in the picker');
      ok(marks[0].getAttribute('style') && /background:/.test(marks[0].getAttribute('style')), 'tinted when there are several');
      authFlow.workspaces = [{ id:'ws_harbor', name:'Harbor Partners', roleLabel:'Recruiter' }];
      d.innerHTML = authWorkspacesStepHTML(); ok(!d.querySelector('.au-ws__mark').getAttribute('style'), 'one workspace: the plain tint');
    });

    await t('"Continue as …" names the workspace this browser last used, and how many there are', async function(){
      authAppSession = Object.assign({}, authAppSession, { email:'sam@harbor.example' });
      authFlow.workspaces = [{ id:'a', name:'A' }, { id:'b', name:'B' }];
      enterApp(); await sleep(30);
      var last = oLastWorkspaceFor('sam@harbor.example'); ok(last && last.name === ORG_STRUCTURE.profile.brandName && last.count === 2, 'remembered: ' + JSON.stringify(last));
      ok(!oLastWorkspaceFor('someone@else.example'), 'never shown for another address');
      try { localStorage.setItem(AUTH_REMEMBER_KEY, 'sam@harbor.example'); } catch(e){}
      var app = document.getElementById('app'); app.classList.add('hidden'); app.classList.remove('flex'); document.getElementById('onboarding').classList.remove('hidden');
      authFlow = authInitialState(); OA.resetSignIn(); renderOnboardingScreen(); await sleep(40);
      var card = q('[data-act=si-continue]'); ok(card && /Continue as Sam/.test(card.textContent), 'the returning card');
      ok(q('.ow-acct__ws', card) && q('.ow-acct__ws', card).textContent === ORG_STRUCTURE.profile.brandName + ' · 2 workspaces', 'workspace line: ' + (q('.ow-acct__ws', card) || {}).textContent);
      var ic = q('.ow-acct__ic', card), cs = getComputedStyle(ic); ok(cs.backgroundImage === 'none' && cs.borderRadius === '50%', 'the person is a quiet circle, not the gradient: ' + cs.backgroundImage + ' ' + cs.borderRadius);
    });

    pub();
  }, 300); });
})();
