/* Design system checks (Oontu Design 2.0, 2026-11-21): sidebar 248/76 and collapse, the sliding selection (200 ms), one-thumb segmented control, no indigo or purple, the Kairo switch, the corporate owner variant and 24/600 page titles. Run: & .\tests\run-auth-tests.ps1 -Spec tests\design-system.spec.js */
(function(){
  var results = [];
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var q = function(s){ return document.querySelector(s); };
  async function t(name, fn){ try { await fn(); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:e.message }); } }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    state.role = 'recruiter'; enterApp(); await sleep(100);

    await t('sidebar: 248 px expanded, 76 px collapsed, state remembered in state.sidebarOpen', async function(){   // Design 2.0 (was 240 / 64)
      var sb = q('#sidebar'); sb.style.transition = 'none';   // widths are measured, not animated, in this check
      ok(Math.round(sb.getBoundingClientRect().width)===248, 'expanded width ' + sb.getBoundingClientRect().width);
      toggleSidebar(); await sleep(900);
      ok(state.sidebarOpen===false && Math.round(sb.getBoundingClientRect().width)===76, 'collapsed width ' + sb.getBoundingClientRect().width);
      ok(Math.round(q('.sb-logo-mark').getBoundingClientRect().height)===32, 'the app icon is 32 px when collapsed: ' + q('.sb-logo-mark').getBoundingClientRect().height);
      toggleSidebar(); await sleep(900);
      ok(state.sidebarOpen===true && Math.round(sb.getBoundingClientRect().width)>=244, 'expanded again ' + sb.getBoundingClientRect().width);
      ok(Math.round(q('.sb-logo-full').getBoundingClientRect().height)===32, 'the wordmark is 32 px tall: ' + q('.sb-logo-full').getBoundingClientRect().height);
    });
    await t('sidebar header: logo over the nav icons; toggle quiet until hover; Ctrl+\ and memory', async function(){   // Design 2.0 has no header rule line, so the 64 px shared-line check is gone
      var lx = q('.sb-logo-full').getBoundingClientRect().left, ix = q('.nav-item .nav-icon').getBoundingClientRect().left;
      ok(Math.abs(lx-ix)<=2, 'logo x ' + lx + ' vs icon x ' + ix);
      ok(+getComputedStyle(q('.sb-toggle')).opacity < 1, 'toggle is quiet until hover: ' + getComputedStyle(q('.sb-toggle')).opacity);   // Design 2.0: 0.6 at rest (was hidden, 0)
ok(Array.prototype.some.call(document.styleSheets, function(ss){ try { return Array.prototype.some.call(ss.cssRules, function(r){ return r.selectorText && r.selectorText.indexOf('#sidebar:focus-within .sb-toggle')>-1 && r.style.opacity==='1'; }); } catch(e){ return false; } }), 'toggle shows on hover and keyboard focus (rule present)');
      document.dispatchEvent(new KeyboardEvent('keydown', { key:String.fromCharCode(92), ctrlKey:true, bubbles:true })); await sleep(500);
      ok(state.sidebarOpen===false && localStorage.getItem('oontu.sidebar')==='collapsed', 'Ctrl+\ collapsed and remembered');
      ok(q('.sb-rail-btn').getAttribute('aria-expanded')==='false', 'aria-expanded false');
      document.dispatchEvent(new KeyboardEvent('keydown', { key:String.fromCharCode(92), ctrlKey:true, bubbles:true })); await sleep(500);
      ok(state.sidebarOpen===true && localStorage.getItem('oontu.sidebar')==='open', 'Ctrl+\ expanded again');
    });
    await t('sidebar: the lean pill glides (200 ms, the Design 2.0 motion), white, with the leaning dash, no green', async function(){
      var sel = q('#sidebar-nav > .o-pill'); ok(sel, 'pill present'); ok(sel.classList.contains('o-pill--lean'), 'lean variant'); var before = sel.style.transform;
      ok(getComputedStyle(sel).transitionDuration.indexOf('0.2s')>-1, 'duration ' + getComputedStyle(sel).transitionDuration); ok(getComputedStyle(sel).backgroundColor==='rgb(255, 255, 255)', 'white pill'); ok(!/(?:rgb(d+, 1[6-9]d, d+))/.test(getComputedStyle(q('.nav-item.active')).color), 'selected label is not green');
      showView('jobs'); await sleep(50);
      ok(sel.style.transform!==before, 'moved: ' + before + ' -> ' + sel.style.transform);
      ok(q('.nav-item.active').getAttribute('data-nav')==='jobs', 'jobs is selected');
    });
    await t('segmented control: one thumb slides under the picked option', async function(){
      showView('dashboard'); await sleep(60);
      var seg = q('#rec-jobs-seg'); ok(seg, 'segmented control present');
      var thumb = seg.querySelector(':scope > .o-pill'); ok(thumb, 'pill present'); var before = thumb.style.transform;
      oSegPick('rec-jobs-seg', 1); await sleep(30);
      ok(thumb.style.transform!==before, 'pill moved'); ok(getComputedStyle(thumb).transitionDuration.indexOf('0.2s')>-1, 'pill transition 200 ms');
      oSegPick('rec-jobs-seg', 0);
    });
    await t('no indigo or purple colour anywhere on the dashboards (the Design 2.0 blue accent is allowed)', async function(){
      var bad = [];
      ['recruiter','manager','admin','hm','candidate','oontu'].forEach(function(r){
        state.role = r; renderSidebar(); showView(DEFAULT_VIEW[r] || 'dashboard');
        document.querySelectorAll('#main-content *, #sidebar *').forEach(function(el){
          var cs = getComputedStyle(el);
          [cs.color, cs.backgroundColor, cs.borderTopColor].forEach(function(c){
            var m = /rgba?\((\d+), (\d+), (\d+)/.exec(c); if(!m) return;
            var R = +m[1], G = +m[2], B = +m[3];
            var mx = Math.max(R, G, B), mn = Math.min(R, G, B), hue = mx===mn ? 0 : mx===B ? 60 * ((R - G) / (mx - mn)) + 240 : mx===R ? (60 * ((G - B) / (mx - mn)) + 360) % 360 : 60 * ((B - R) / (mx - mn)) + 120;
            if(mx - mn > 40 && hue >= 245 && hue <= 330 && /rgba?\(\d+, \d+, \d+\)/.test(c)) bad.push(r + ' ' + el.className + ' ' + c);   // was: any blue (B > R+28 and G+28)
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
    await t('every screen has the page title at 24/600 (Oontu Design 2.0)', async function(){
      state.role = 'admin'; renderSidebar();
      var bad = [];
      ['jobs','talent-pool','interviews','settings','reports','team-members','client-management','integrations'].forEach(function(v){
        showView(v); var h = q('#main-content .sec-head .sec-title') || q('#main-content h1'); if(!h){ bad.push(v + ' (no title)'); return; }
        var cs = getComputedStyle(h), want = ['24px','600'];   /* Design 2.0: one calm page title everywhere (was 28px, Oontu Light) */
        if(cs.fontSize!==want[0] || cs.fontWeight!==want[1]) bad.push(v + ' ' + cs.fontSize + '/' + cs.fontWeight);
      });
      ok(!bad.length, bad.join(', '));
    });
    var pre = document.createElement('pre'); pre.id = 'auth-test-results'; pre.textContent = JSON.stringify(results); document.body.appendChild(pre);
  }, 800); });
})();
