/* Apple-style motion, the rail brand and one left edge (2026-11-20).
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\motion.spec.js */
(function(){
  var results = [];
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message + ' @' + (e.lineno || '')); });
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e && e.message || e) }); } }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function q(s){ return document.querySelector(s); }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    state.role = 'admin'; enterApp(); await sleep(150);

    /* 2026-11-21: one motion layer (Oontu-Apple-Inspired-Motion-Style.md): 80/120/200/320/480 ms, standard/enter/exit easing; older names are aliases */
    await t('tokens: one scale, older names are aliases of it, springs only for the switch knob', async function(){
      var cs = getComputedStyle(document.documentElement), v = function(n){ return cs.getPropertyValue(n).trim(); };
      ok(v('--motion-instant') === '80ms' && v('--motion-fast') === '120ms' && v('--motion-base') === '200ms' && v('--motion-slow') === '320ms' && v('--motion-page') === '480ms', 'scale');
      ok(/cubic-bezier\(\s*\.2,\s*0,\s*0,\s*1\s*\)/.test(v('--ease-standard')) && /cubic-bezier\(\s*0,\s*0,\s*0,\s*1\s*\)/.test(v('--ease-enter')) && /cubic-bezier\(\s*\.3,\s*0,\s*1,\s*1\s*\)/.test(v('--ease-exit')), 'easing: ' + v('--ease-standard'));
      var same = { '--t-fast':'--motion-fast', '--t-base':'--motion-base', '--t-glide':'--motion-base', '--t-view':'--motion-slow', '--t-sheet':'--motion-slow', '--spring':'--ease-standard', '--spring-smooth':'--ease-enter', '--ease-out':'--ease-enter', '--ease-in':'--ease-exit', '--ow-spring':'--ease-standard', '--o-spring':'--ease-standard' };
      Object.keys(same).forEach(function(n){ ok(v(n) === v(same[n]), n + ' follows ' + same[n] + ': ' + v(n)); });
      ok(document.querySelectorAll('style#oontu-motion').length === 1 && !document.getElementById('apple-motion'), 'one motion layer');
    });
    await t('components: menus rise 4 px in 200 ms, dialogs 16 px in 320 ms, drawers slide; buttons press 1 px; no transition: all', async function(){
      var probe = function(cls, tag){ var el = document.createElement(tag || 'div'); el.className = cls; document.body.appendChild(el); var s = getComputedStyle(el), r = { name:s.animationName, dur:s.animationDuration, tp:s.transitionProperty }; el.remove(); return r; };
      var m = probe('o-menu'); ok(m.name === 'o-menu-enter' && m.dur === '0.2s', 'menu: ' + JSON.stringify(m));
      var d = probe('modal-panel'); ok(d.name === 'o-panel-enter' && d.dur === '0.32s', 'dialog: ' + JSON.stringify(d));
      var s = probe('app-sheet'); ok(s.name === 'o-drawer-enter' && s.dur === '0.32s', 'drawer: ' + JSON.stringify(s));
      var ta = probe('transition-all', 'button'); ok(ta.tp.indexOf('all') < 0, 'transition-all is narrowed: ' + ta.tp);
      var b = probe('o-btn', 'button'); ok(b.tp.indexOf('all') < 0 && b.tp.indexOf('transform') > -1, 'button transitions: ' + b.tp);
      var css = [].map.call(document.querySelectorAll('style'), function(x){ return x.id === '' && /tailwind/i.test(x.textContent.slice(0, 200)) ? '' : x.textContent; }).join('\n');
      ok(!/transition:\s*all\b/.test(css), 'no transition: all in Oontu styles');
      /* each part's duration is a token (or 0s); a later time in the part is a delay and may stay raw */
      var rawPart = function(p){ var s = p.replace(/var\(--ease-[a-z]+\)/g, ''); if(/cubic-bezier\(|(^|\s)ease(-in|-out|-in-out)?(\s|$)/.test(s)) return true; var first = (p.match(/var\(--(motion|t)-[a-z-]+\)|(^|\s)\d*\.?\d+m?s(?=\s|$)/) || [''])[0].trim(); return /^\d*\.?\d+m?s$/.test(first) && !/^0m?s$/.test(first); };
      var raw = (css.match(/(?:^|[;{\s])transition\s*:[^;}{]*/g) || []).filter(function(d){ var v = d.replace(/^[\s;{]*transition\s*:/, ''); if(/^\s*none/.test(v) || /var\(--[a-z-]+\s*,/.test(v)) return false; var parts = [], depth = 0, cur = ''; v.split('').forEach(function(ch){ if(ch === '(') depth++; if(ch === ')') depth--; if(ch === ',' && !depth){ parts.push(cur); cur = ''; } else cur += ch; }); parts.push(cur); return parts.some(rawPart); });
      ok(raw.length === 0, 'every CSS transition reads the tokens; raw: ' + raw.slice(0, 3).join(' | '));
    });
    await t('Kairo at rest: frames are still when idle; the mark only moves while Kairo works', async function(){
      showView(homeForMe()); await sleep(80);
      var k = q('.bh-kairo'); if(k) ok(getComputedStyle(k).animationName === 'none', 'Home Kairo frame still: ' + getComputedStyle(k).animationName);
      var m = document.createElement('span'); m.innerHTML = iqMark(22); document.body.appendChild(m); ok(getComputedStyle(m.firstChild).animationName === 'none', 'idle mark still'); m.remove();
      var rm = [].filter.call(document.querySelectorAll('style#oontu-motion'), Boolean)[0].textContent; ok(/prefers-reduced-motion:reduce[\s\S]*animation-duration:\.01ms !important/.test(rm), 'reduced motion in the layer');
    });
    await t('a screen change is one movement: no per-card stagger, no scroll reveal', async function(){
      showView('jobs'); await sleep(20); showView(homeForMe()); await sleep(20);
      var kids = [].slice.call(document.querySelectorAll('#main-content .o-page > *'), 0, 4);
      ok(kids.every(function(el){ return getComputedStyle(el).animationName === 'none'; }), 'children still: ' + kids.map(function(el){ return getComputedStyle(el).animationName; }));
    });
    await t('a screen change plays the settle-in motion; redrawing the same screen does not', async function(){
      showView('jobs'); var m = q('#main-content'); ok(m.getAttribute('data-am') === '1', 'new screen animates');
      ok(/am-view-in/.test(getComputedStyle(m).animationName), 'animation: ' + getComputedStyle(m).animationName);
      showView('jobs'); ok(!m.hasAttribute('data-am'), 'same screen does not flash');
    });
    await t('collapse: the rail shows the app icon, the selection sits on the active item, labels come back on expand', async function(){
      showView(homeForMe()); await sleep(50); state.sidebarOpen = true; applySidebarVisibility(); await sleep(50);
      toggleSidebar(); await sleep(900);
      ok(q('#sidebar').classList.contains('rail'), 'rail'); var img = q('.sb-rail-btn .sb-logo-mark img'); ok(img && /oontu-app-icon\.svg$/.test(img.getAttribute('src')), 'app icon in the rail');
      var pill = q('#sidebar-nav > .o-pill'), act = q('#sidebar-nav .nav-item.active');
      ok(pill && act, 'pill and active item'); var a = pill.getBoundingClientRect(), b = act.getBoundingClientRect(); ok(Math.abs(a.top - b.top) < 3 && Math.abs(a.left - b.left) < 3 && a.width > 30, 'pill on the active item: ' + JSON.stringify([a.top, a.left, a.width, b.top, b.left]));
      toggleSidebar(); await sleep(900); ok(!q('#sidebar').classList.contains('rail'), 'expanded again');
    });
    await t('one left edge: the top bar search lines up with the page column on Home, rail or open', async function(){
      showView(homeForMe()); await sleep(600);
      var check = function(label){ var main = q('#main-content'), first = [].find.call(main.children, function(el){ return el.offsetWidth > 240; }); var s = q('#topbar .o-search, #topbar [class*="search"]') || q('#topbar').firstElementChild;
        var d = Math.abs(first.getBoundingClientRect().left - q('#topbar').getBoundingClientRect().left - parseFloat(getComputedStyle(q('#topbar')).paddingLeft)); ok(d < 3, label + ' off by ' + d); };
      check('open'); toggleSidebar(); await sleep(900); check('rail'); toggleSidebar(); await sleep(900);
    });
    await t('brand files: favicon and app icon are the new O. tiles', async function(){
      var fav = q('link[rel="icon"][type="image/svg+xml"]'); ok(fav && /favicon\.svg$/.test(fav.getAttribute('href')), 'svg favicon linked');
      ok(q('link[rel="apple-touch-icon"]'), 'apple touch icon');
    });

    var pre = document.createElement('pre'); pre.id = 'auth-test-results'; pre.textContent = JSON.stringify(results); document.body.appendChild(pre);
  }, 800); });
})();
