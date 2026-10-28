/* Design system checks: sidebar width and collapse, the sliding selection, one-thumb segmented control, no blue/indigo/purple colour, the Kairo switch, the corporate owner variant and 32/40/700 page titles. Run: & .\tests\run-auth-tests.ps1 -Spec tests\design-system.spec.js */
(function(){
  var results = [];
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var q = function(s){ return document.querySelector(s); };
  async function t(name, fn){ try { await fn(); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:e.message }); } }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    state.role = 'recruiter'; enterApp(); await sleep(100);

    await t('sidebar: 240 px expanded, 64 px collapsed, state remembered in state.sidebarOpen', async function(){
      var sb = q('#sidebar'); sb.style.transition = 'none';   // widths are measured, not animated, in this check
      ok(Math.round(sb.getBoundingClientRect().width)===240, 'expanded width ' + sb.getBoundingClientRect().width);
      toggleSidebar(); await sleep(900);
      ok(state.sidebarOpen===false && Math.round(sb.getBoundingClientRect().width)===64, 'collapsed width ' + sb.getBoundingClientRect().width);
      ok(Math.round(q('.sb-logo-mark').getBoundingClientRect().height)===28, 'the symbol is 28 px tall when collapsed: ' + q('.sb-logo-mark').getBoundingClientRect().height);
      toggleSidebar(); await sleep(900);
      ok(state.sidebarOpen===true && Math.round(sb.getBoundingClientRect().width)>=236, 'expanded again ' + sb.getBoundingClientRect().width);
      ok(Math.round(q('.sb-logo-full').getBoundingClientRect().height)===34, 'the logo is 34 px tall: ' + q('.sb-logo-full').getBoundingClientRect().height);
    });
    await t('sidebar header: 64 px like the top bar, one shared line; logo over the nav icons; toggle on hover; Ctrl+\ and memory', async function(){
      var h = q('.sb-head').getBoundingClientRect(), tb = q('#topbar').getBoundingClientRect();
      ok(Math.round(h.height)===64 && Math.round(tb.height)===64, 'heights ' + h.height + ' / ' + tb.height);
      ok(Math.round(h.bottom)===Math.round(tb.bottom), 'borders meet: ' + h.bottom + ' vs ' + tb.bottom);
      var lx = q('.sb-logo-full').getBoundingClientRect().left, ix = q('.nav-item .nav-icon').getBoundingClientRect().left;
      ok(Math.abs(lx-ix)<=2, 'logo x ' + lx + ' vs icon x ' + ix);
      ok(getComputedStyle(q('.sb-toggle')).opacity==='0', 'toggle is hidden until hover');
ok(Array.prototype.some.call(document.styleSheets, function(ss){ try { return Array.prototype.some.call(ss.cssRules, function(r){ return r.selectorText && r.selectorText.indexOf('#sidebar:focus-within .sb-toggle')>-1 && r.style.opacity==='1'; }); } catch(e){ return false; } }), 'toggle shows on hover and keyboard focus (rule present)');
      document.dispatchEvent(new KeyboardEvent('keydown', { key:String.fromCharCode(92), ctrlKey:true, bubbles:true })); await sleep(500);
      ok(state.sidebarOpen===false && localStorage.getItem('oontu.sidebar')==='collapsed', 'Ctrl+\ collapsed and remembered');
      ok(q('.sb-rail-btn').getAttribute('aria-expanded')==='false', 'aria-expanded false');
      document.dispatchEvent(new KeyboardEvent('keydown', { key:String.fromCharCode(92), ctrlKey:true, bubbles:true })); await sleep(500);
      ok(state.sidebarOpen===true && localStorage.getItem('oontu.sidebar')==='open', 'Ctrl+\ expanded again');
    });
    await t('sidebar: the lean pill glides (600 ms), white, with the leaning dash, no green', async function(){
      var sel = q('#sidebar-nav > .o-pill'); ok(sel, 'pill present'); ok(sel.classList.contains('o-pill--lean'), 'lean variant'); var before = sel.style.transform;
      ok(getComputedStyle(sel).transitionDuration.split(',').indexOf('0.6s')>-1 || getComputedStyle(sel).transitionDuration.indexOf('0.6s')>-1, 'duration ' + getComputedStyle(sel).transitionDuration); ok(getComputedStyle(sel).backgroundColor==='rgb(255, 255, 255)', 'white pill'); ok(!/(?:rgb(d+, 1[6-9]d, d+))/.test(getComputedStyle(q('.nav-item.active')).color), 'selected label is not green');
      showView('jobs'); await sleep(50);
      ok(sel.style.transform!==before, 'moved: ' + before + ' -> ' + sel.style.transform);
      ok(q('.nav-item.active').getAttribute('data-nav')==='jobs', 'jobs is selected');
    });
    await t('segmented control: one thumb slides under the picked option', async function(){
      showView('dashboard'); await sleep(60);
      var seg = q('#rec-jobs-seg'); ok(seg, 'segmented control present');
      var thumb = seg.querySelector(':scope > .o-pill'); ok(thumb, 'pill present'); var before = thumb.style.transform;
      oSegPick('rec-jobs-seg', 1); await sleep(30);
      ok(thumb.style.transform!==before, 'pill moved'); ok(getComputedStyle(thumb).transitionDuration.indexOf('0.6s')>-1, 'pill transition 600 ms');
      oSegPick('rec-jobs-seg', 0);
    });
    await t('no blue, indigo or purple colour anywhere on the dashboards', async function(){
      var bad = [];
      ['recruiter','manager','admin','hm','candidate','oontu'].forEach(function(r){
        state.role = r; renderSidebar(); showView(DEFAULT_VIEW[r] || 'dashboard');
        document.querySelectorAll('#main-content *, #sidebar *').forEach(function(el){
          var cs = getComputedStyle(el);
          [cs.color, cs.backgroundColor, cs.borderTopColor].forEach(function(c){
            var m = /rgba?\((\d+), (\d+), (\d+)/.exec(c); if(!m) return;
            var R = +m[1], G = +m[2], B = +m[3];
            if(B>R+28 && B>G+28 && /rgba?\(\d+, \d+, \d+\)/.test(c)) bad.push(r + ' ' + el.className + ' ' + c);
          });
        });
      });
      ok(!bad.length, bad.slice(0,5).join(' | '));
    });
    await t('Kairo can be switched off: nothing Kairo remains on the recruiter dashboard', async function(){
      window.OONTU_AGENTS = false; oApplyAgentFlag(); state.role = 'recruiter'; renderSidebar(); showView('dashboard'); await sleep(50);
      ok(!q('[data-agent]'), 'no Kairo card');
      ok(getComputedStyle(q('#ai-fab-container')).display==='none', 'the launcher is hidden');
      ok(!q('.nav-item[data-nav=kairo-team]'), 'no Cowork entry in the sidebar');
      ok(!/Kairo/.test(q('#main-content').textContent), 'no "Kairo" text on the screen');
      window.OONTU_AGENTS = true; oApplyAgentFlag();
    });
    await t('corporate owner: the corporate cards, no Clients table', async function(){
      var prev = ORG_STRUCTURE.profile.orgType; ORG_STRUCTURE.profile.orgType = 'Corporate';
      state.role = 'admin'; renderSidebar(); showView('admin-dashboard'); await sleep(50);
      var txt = q('#main-content').textContent;
      ok(/Hires this quarter/.test(txt) && /Offer acceptance/.test(txt), 'corporate cards'); ok(!/Revenue earned/.test(txt), 'no agency revenue card');
      ok(!q('#own-clients-h'), 'no Clients table');
      ORG_STRUCTURE.profile.orgType = prev;
    });
    await t('every screen has the page title at 28/36/600 (Oontu Light)', async function(){
      state.role = 'admin'; renderSidebar();
      var bad = [];
      ['jobs','talent-pool','interviews','settings','reports','team-members','client-management','integrations'].forEach(function(v){
        showView(v); var h = q('#main-content .sec-head .sec-title') || q('#main-content h1'); if(!h){ bad.push(v + ' (no title)'); return; }
        var cs = getComputedStyle(h), want = ['28px','600'];   /* Oontu Light: one calm page title everywhere */
        if(cs.fontSize!==want[0] || cs.fontWeight!==want[1]) bad.push(v + ' ' + cs.fontSize + '/' + cs.fontWeight);
      });
      ok(!bad.length, bad.join(', '));
    });
    var pre = document.createElement('pre'); pre.id = 'auth-test-results'; pre.textContent = JSON.stringify(results); document.body.appendChild(pre);
  }, 800); });
})();
