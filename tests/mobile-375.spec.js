/* QA fix A8: at 375 px no main screen scrolls the page sideways, with CX off and on. Tables stack or scroll inside their
   own box. Besides the page width, every visible element must end inside the screen unless it sits in its own
   scrolling box (so the fix cannot be a page-wide clip that hides content). Headless Chrome will not open a window
   narrower than 500 px, so the app is loaded in a 375 × 812 frame (as cowork-visual does at 390).
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\mobile-375.spec.js          (CX off)
        & .\tests\run-auth-tests.ps1 -Spec tests\mobile-375.spec.js -Cx      (CX on) */
(function(){
  if(window !== window.top) return;   // the frame loads the same page; the spec runs once, in the top page
  var results = [];
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  async function t(name, fn){ try { await fn(); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e && e.message || e) }); } pub(); }
  function pub(){ var pre = document.getElementById('auth-test-results'); if(!pre){ pre = document.createElement('pre'); pre.id = 'auth-test-results'; document.body.appendChild(pre); } pre.textContent = JSON.stringify(results); }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  var W = 375, H = 812;
  var SCREENS = { admin:['admin-dashboard','jobs','talent-pool','interviews','client-management','approval-center','kairo-team','intelligence','settings','admin-paytrack','reports'],
    recruiter:['dashboard','jobs','talent-pool','interviews','my-todo'], manager:['manager-dashboard','manager-team'], hm:['hm-dashboard','hm-jobs'], oontu:['oontu-dashboard','oontu-finance','oontu-custops','oontu-approvals','oontu-invoices','oontu-mywork'] };
  /* screens opened by a call rather than showView */
  var EXTRA = { admin:[['job page', "openJob(JOBS.find(function(j){ return j.status === 'Active'; }).id)"], ['candidate profile', 'openCandidate(CANDIDATES[0].id)'], ['inbox', "if(typeof ibOpenPage === 'function') ibOpenPage(); else openMessages('team')"]],
    recruiter:[['job page', "openJob(JOBS.find(function(j){ return j.status === 'Active'; }).id)"], ['candidate profile', 'openCandidate(CANDIDATES[1].id)']] };

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    var CXON = typeof cxOn === 'function' && cxOn();
    var fr = document.createElement('iframe'); fr.style.cssText = 'position:fixed;left:0;top:0;width:' + W + 'px;height:' + H + 'px;border:0;z-index:-1;opacity:0'; fr.src = location.href; document.body.appendChild(fr);
    for(var i = 0; i < 300 && !(fr.contentWindow && fr.contentWindow.enterApp && fr.contentWindow.document.readyState === 'complete'); i++) await sleep(50);
    await sleep(500); var w = fr.contentWindow, d = w.document;
    if(CXON && w.cxSetSwitch && !w.cxOn()) w.cxSetSwitch(true);
    /* inside its own scrolling box (any ancestor that scrolls sideways and itself ends on screen) */
    function scroller(el){ for(var p = el.parentElement; p && p !== d.body && p.id !== 'app'; p = p.parentElement){ var o = w.getComputedStyle(p).overflowX; if((o === 'auto' || o === 'scroll') && p.getBoundingClientRect().right <= W + 1 && p.id !== 'main-content') return p; } return null; }
    function sel(el){ return el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''); }
    function overflowers(){
      var out = [];
      [].forEach.call(d.querySelectorAll('#app *'), function(el){
        var r = el.getBoundingClientRect(); if(r.width === 0 || r.height === 0 || r.right <= W + 1) return;
        var cs = w.getComputedStyle(el); if(cs.visibility === 'hidden' || (cs.position === 'fixed' && r.left >= W - 1)) return;
        if(el.closest('[aria-hidden="true"], .hidden, [hidden]')) return;
        if(el.ownerSVGElement) return;   // shapes inside an svg: the svg itself is checked
        if(el.closest('.sr-only')) return;   // screen-reader-only tables are clipped to 1 px on purpose
        if(scroller(el)) return;
        if(el.closest('#iq') && !el.closest('#iq.is-open, #iq[aria-expanded="true"]') && w.getComputedStyle(d.getElementById('iq')).overflowX === 'clip') return;   // the closed Signals panel is clipped on purpose
        out.push(sel(el) + ' +' + Math.round(r.right - W) + (out.length ? '' : ' [in ' + [el.parentElement, el.parentElement && el.parentElement.parentElement, el.parentElement && el.parentElement.parentElement && el.parentElement.parentElement.parentElement].filter(Boolean).map(sel).join(' < ') + ']'));
      });
      return out;
    }
    var page = [], els = [], seen = 0;
    async function check(label){
      seen++; await sleep(40);
      var dw = d.documentElement.scrollWidth, bw = d.body.scrollWidth;
      if(dw > W + 1 || bw > W + 1) page.push(label + ' page +' + (Math.max(dw, bw) - W));
      var o = overflowers(); if(o.length) els.push(label + ': ' + o.slice(0, 3).join(', '));
    }
    var ob2 = d.getElementById('onboarding'); if(ob2) ob2.classList.add('hidden');
    for(var role in SCREENS){
      try { w.eval("state.role = '" + role + "'; enterApp();"); await sleep(80); } catch(e){ page.push(role + ' could not enter: ' + e.message); continue; }
      for(var k = 0; k < SCREENS[role].length; k++){
        var v = SCREENS[role][k]; try { w.showView(v); } catch(e){ continue; } await check(role + '/' + v);
        if(v === 'kairo-team' && CXON) for(var c = 0, tabs = ['credits','campaigns','live']; c < tabs.length; c++){ try { w.eval("CA.agent = null; CA.tab = '" + tabs[c] + "'; caRefresh();"); } catch(e){} await check(role + '/cowork-' + tabs[c]); }
      }
      for(var x = 0; x < (EXTRA[role] || []).length; x++){ try { w.eval(EXTRA[role][x][1]); } catch(e){ page.push(role + '/' + EXTRA[role][x][0] + ' could not open: ' + e.message); continue; } await check(role + '/' + EXTRA[role][x][0]); try { if(w.closeMessages) w.closeMessages(); } catch(e){} }
    }
    var tiles = 'n/a'; if(CXON){ try { w.eval("state.role = 'admin'; enterApp(); showView('kairo-team'); CA.agent = null; CA.tab = 'credits'; caRefresh();"); await sleep(60); var g = d.querySelector('#cx-credits-view .o-cols'); tiles = g ? w.getComputedStyle(g).gridTemplateColumns.split(' ').length : 'missing'; } catch(e){ tiles = 'error ' + e.message; } }
    fr.remove();
    results.push({ name:'RESULT width ' + W + ' · CX ' + (CXON ? 'on' : 'off') + ' · ' + seen + ' screens checked', pass:true });
    await t('at 375 px no main screen scrolls the page sideways (CX ' + (CXON ? 'on' : 'off') + ')', async function(){ ok(seen >= 20, 'screens ' + seen); ok(!page.length, page.join(' | ')); });
    await t('every element ends inside the screen or inside its own scrolling box (CX ' + (CXON ? 'on' : 'off') + ')', async function(){ ok(!els.length, els.length + ' screens: ' + els.slice(0, 30).join(' || ')); });
    if(CXON) await t('Cowork › Credits number tiles are two across on a phone, so big numbers are not cut', async function(){ ok(tiles === 2, 'columns: ' + tiles); });
    pub();
  }, 300); });
})();
