/* Navigation history (OFI · Flow, 2026-11-24): the browser's Back and Forward move between product screens and records;
   the top-bar back button uses the same history; refreshes add no entries; Back on the first entry stays in the product.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\nav-history.spec.js */
(function(){
  var results = [];
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var q = function(s){ return document.querySelector(s); };
  var errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e && e.message || e) }); } pub(); }
  function pub(){ var pre = document.getElementById('auth-test-results'); if(!pre){ pre = document.createElement('pre'); pre.id = 'auth-test-results'; document.body.appendChild(pre); } pre.textContent = JSON.stringify(results); }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  async function back(){ history.back(); await sleep(80); }
  async function fwd(){ history.forward(); await sleep(80); }
  function title(){ return (q('#topbar-title') || {}).textContent || ''; }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    try { localStorage.clear(); } catch(e){}
    /* In real use the sign-in screens are history entries of this same page before the product opens. Recreate that,
       so Back past the first product entry lands on a sign-in entry, not on the headless runner's blank start page. */
    history.pushState({ oontuAuth:'email' }, '', '#/sign-in');
    state.role = 'admin'; enterApp(); await sleep(150);
    var home = state.activeNav;

    await t('screens: each navigation is one history entry; Back and Forward move between them', async function(){
      ok(history.state && history.state.oontuNav && history.state.view, 'the first product screen is a history entry: ' + JSON.stringify(history.state));
      showView('jobs'); await sleep(20); showView('talent-pool'); await sleep(20);
      ok(state.activeNav === 'talent-pool' && /#\/app\/talent-pool$/.test(location.hash), 'address follows the screen: ' + location.hash);
      await back(); ok(state.activeNav === 'jobs', 'Back → Jobs, got ' + state.activeNav);
      await back(); ok(state.activeNav === home, 'Back → Home, got ' + state.activeNav);
      await fwd(); ok(state.activeNav === 'jobs', 'Forward → Jobs, got ' + state.activeNav);
    });

    await t('a screen redrawing itself adds no entry', async function(){
      showView('jobs'); await sleep(20);   // a real navigation first; then measure the redraws
      var n = history.length, i = NAVH.idx; showView('jobs'); showView('jobs'); await sleep(20);
      ok(history.length === n && NAVH.idx === i, 'no new entries: ' + history.length + ' vs ' + n);
    });

    await t('records: Back from a job returns to the list; Forward reopens the same job', async function(){
      var job = JOBS.find(function(j){ return jobInScope(j); }); ok(job, 'a job in scope');
      showView('jobs'); await sleep(20); openJob(job.id); await sleep(20);
      ok(/Job Detail/i.test(title()) && q('#main-content').textContent.indexOf(job.title) > -1, 'job detail open');
      ok(history.state.kind === 'record' && history.state.fn === 'openJob' && history.state.args[0] === job.id, 'the entry names the record: ' + JSON.stringify(history.state));
      await back(); ok(state.activeNav === 'jobs' && !/Job Detail/i.test(title()), 'back on the jobs list');
      await fwd(); ok(/Job Detail/i.test(title()) && q('#main-content').textContent.indexOf(job.title) > -1, 'the same job again');
    });

    await t('client detail: tab changes are not entries; Back leaves the client', async function(){
      var c = CLIENTS.find(function(x){ return clientVisibleTo(x); }); ok(c, 'a visible client');
      showView('client-management'); await sleep(20); openClientDetail(c.id); await sleep(20);
      var n = history.length; clientSetTab('jobs'); await sleep(10); clientSetTab('overview'); await sleep(10);
      ok(history.length === n, 'tabs added no entries');
      await back(); ok(state.activeNav === 'client-management' && !document.querySelector('[data-client-detail]') , 'back on the clients list');
    });

    await t('the top-bar back button shows once there is somewhere to go back to, and uses the same history', async function(){
      showView('interviews'); await sleep(20); showView('jobs'); await sleep(20);
      var btn = q('#topbar-back-btn'); ok(btn && !btn.classList.contains('hidden'), 'visible');
      var i = NAVH.idx; btn.click(); await sleep(80);
      ok(state.activeNav === 'interviews' && NAVH.idx === i - 1, 'went back one entry: ' + state.activeNav);
      await fwd(); ok(state.activeNav === 'jobs', 'and Forward undoes it');
    });

    await t('Settings keeps its entry when it rewrites the address', async function(){
      showView('settings'); await sleep(30); openSettings('workspace'); await sleep(30);
      ok(history.state && history.state.oontuNav && history.state.view === 'settings', 'the settings entry kept its state: ' + JSON.stringify(history.state));
      showView('jobs'); await sleep(20); await back(); ok(state.activeNav === 'settings', 'Back returns to Settings, got ' + state.activeNav);
    });

    await t('after a reload and sign-in, Oontu returns to the same record once, only for the same person and role', async function(){
      var job = JOBS.find(function(j){ return jobInScope(j); }); showView('jobs'); await sleep(20); openJob(job.id); await sleep(20);
      var saved = JSON.parse(sessionStorage.getItem('oontu.lastPlace') || 'null');
      ok(saved && saved.entry.fn === 'openJob' && saved.entry.args[0] === job.id && saved.who.role === state.role, 'this tab remembers the place: ' + JSON.stringify(saved && saved.entry));
      showView(homeForMe()); await sleep(20);
      oontuReloadReturn._setPending(saved); enterApp(); await sleep(40);
      ok(/Job Detail/i.test(document.getElementById('topbar-title').textContent) && document.getElementById('main-content').textContent.indexOf(job.title) > -1, 'returned to the job');
      ok(/Back where you were/.test(document.getElementById('toast-container').textContent), 'and says so');
      enterApp(); await sleep(30); ok(state.activeNav === homeForMe(), 'only once: the next sign-in opens Home');
      var other = JSON.parse(JSON.stringify(saved)); other.who.role = 'manager';
      oontuReloadReturn._setPending(other); enterApp(); await sleep(30); ok(state.activeNav === homeForMe(), 'a different role starts on Home');
    });

    await t('Back on the first product entry stays in the product', async function(){
      for(var guard = 0; NAVH.idx > 0 && guard < 40; guard++){ await back(); }
      ok(NAVH.idx === 0, 'reached the first product entry');
      var v = state.activeNav; await back(); await sleep(60);
      ok(!document.getElementById('app').classList.contains('hidden'), 'still in the product'); ok(state.activeNav === v, 'same screen: ' + state.activeNav);
      ok(history.state && history.state.oontuNav, 'a product entry again');
    });

    pub();
  }, 300); });
})();
