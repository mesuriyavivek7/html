/* Accessibility and responsive checks (package 8, 2026-11-24): every visible button on the main screens has a name,
   every form field has a label, no screen scrolls the whole page sideways, and the closed Intelligence Signals panel
   never widens the page. Run at more widths with -Width (768 and 1024 were checked by hand for this pass).
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\a11y-responsive.spec.js */
(function(){
  var results = [];
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  async function t(name, fn){ try { await fn(); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e && e.message || e) }); } pub(); }
  function pub(){ var pre = document.getElementById('auth-test-results'); if(!pre){ pre = document.createElement('pre'); pre.id = 'auth-test-results'; document.body.appendChild(pre); } pre.textContent = JSON.stringify(results); }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function vis(el){ var r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; }
  function named(el){ return !!((el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || '').trim() || el.getAttribute('aria-labelledby') || el.querySelector('img[alt]:not([alt=""])')); }
  function labelled(i){ if(i.type === 'hidden' || !vis(i)) return true; if(i.getAttribute('aria-label') || i.getAttribute('aria-labelledby') || i.getAttribute('title')) return true; if(i.id && document.querySelector('label[for="' + i.id + '"]')) return true; return !!i.closest('label'); }
  var SCREENS = { admin:['admin-dashboard','jobs','talent-pool','interviews','client-management','approval-center','kairo-team','intelligence','settings','admin-paytrack'], recruiter:['dashboard','jobs','talent-pool','interviews','my-todo'], manager:['manager-dashboard','manager-team'], hm:['hm-dashboard','hm-jobs'] };

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    try { localStorage.clear(); } catch(e){}
    var problems = { names:[], labels:[], page:[] };
    for(var role in SCREENS){
      state.role = role; enterApp(); await sleep(80);
      for(var i = 0; i < SCREENS[role].length; i++){
        var v = SCREENS[role][i]; showView(v); await sleep(60);
        var m = document.getElementById('main-content');
        [].slice.call(m.querySelectorAll('button, [role=button]')).filter(function(b){ return vis(b) && !named(b); }).forEach(function(b){ problems.names.push(role + '/' + v + ': ' + b.outerHTML.slice(0, 80)); });
        [].slice.call(m.querySelectorAll('input, select, textarea')).filter(function(x){ return !labelled(x); }).forEach(function(x){ problems.labels.push(role + '/' + v + ': ' + x.outerHTML.slice(0, 80)); });
        if(document.documentElement.scrollWidth > innerWidth + 1) problems.page.push(role + '/' + v + ' page +' + (document.documentElement.scrollWidth - innerWidth));
        if(m.scrollWidth > m.clientWidth + 1) problems.page.push(role + '/' + v + ' column +' + (m.scrollWidth - m.clientWidth));
      }
    }
    await t('every visible button on the main screens has an accessible name', async function(){ ok(!problems.names.length, problems.names.length + ': ' + problems.names.slice(0, 3).join(' || ')); });
    await t('every visible form field on the main screens has a label', async function(){ ok(!problems.labels.length, problems.labels.length + ': ' + problems.labels.slice(0, 3).join(' || ')); });
    await t('no main screen scrolls sideways: not the page, not the main column', async function(){ ok(!problems.page.length, problems.page.join(', ')); });
    await t('the closed Intelligence Signals panel never widens the page (clipped)', async function(){
      state.role = 'admin'; enterApp(); await sleep(60); showView('intelligence'); await sleep(60);
      var iq = document.getElementById('iq'); ok(iq && getComputedStyle(iq).overflowX === 'clip', 'clip: ' + (iq && getComputedStyle(iq).overflowX));
      var m = document.getElementById('main-content'); ok(m.scrollWidth <= m.clientWidth + 1, 'main column ' + m.scrollWidth + ' vs ' + m.clientWidth);
    });
    await t('the task toggle says what it does and whether it is done', async function(){
      state.role = 'recruiter'; enterApp(); await sleep(60); showView('my-todo'); await sleep(60);
      var b = document.querySelector('#main-content button[aria-pressed]'); ok(b && /^Mark as (not )?done: /.test(b.getAttribute('aria-label')), 'toggle: ' + (b && b.getAttribute('aria-label')));
    });
    pub();
  }, 300); });
})();
