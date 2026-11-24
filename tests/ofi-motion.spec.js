/* OFI motion families (2026-11-24): named behaviours on the existing motion tokens. Guided passage on Back/Forward,
   context expansion on opening a record (not on a history replay), focus shift for the Kairo panel only when it opens
   (no replay on every message), interruptible restarts, and a short fade under reduced motion.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\ofi-motion.spec.js */
(function(){
  var results = [];
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var q = function(s){ return document.querySelector(s); };
  var errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e && e.message || e) }); } pub(); }
  function pub(){ var pre = document.getElementById('auth-test-results'); if(!pre){ pre = document.createElement('pre'); pre.id = 'auth-test-results'; document.body.appendChild(pre); } pre.textContent = JSON.stringify(results); }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function anim(el){ var s = getComputedStyle(el); return { name:s.animationName, dur:s.animationDuration }; }
  function css(){ return [].slice.call(document.styleSheets).map(function(s){ try { return [].slice.call(s.cssRules).map(function(r){ return r.cssText; }).join('\n'); } catch(e){ return ''; } }).join('\n'); }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    try { localStorage.clear(); } catch(e){}
    history.pushState({ oontuAuth:'email' }, '', '#/sign-in');
    state.role = 'recruiter'; enterApp(); await sleep(150);
    var main = document.getElementById('main-content');
    var job = JOBS.find(function(j){ return jobInScope(j); });

    await t('the families use the existing tokens: expansion 320 ms, passage 200 ms, focus 320 ms', async function(){
      var d = document.createElement('div'); d.className = 'om-expand'; document.body.appendChild(d); ok(anim(d).dur === '0.32s' && anim(d).name === 'om-expand', JSON.stringify(anim(d)));
      d.className = 'om-complete'; ok(anim(d).dur === '0.2s', 'completion 200 ms'); d.className = 'om-focus'; ok(anim(d).dur === '0.32s', 'focus 320 ms'); d.remove();
      ok(/om-correct[^{]*\{[^}]*var\(--motion-fast\)/.test(css()) || /\.om-correct \{ transition: border-color var\(--motion-fast\)/.test(css()), 'correction reads the fast token');
    });

    await t('opening a job grows it into place (context expansion); the class cleans itself up', async function(){
      showView('jobs'); await sleep(30); openJob(job.id);
      ok(main.classList.contains('om-expand') && anim(main).name === 'om-expand', 'expansion on open: ' + JSON.stringify(anim(main)));
      await sleep(500); ok(!main.classList.contains('om-expand'), 'removed after it ends');
    });

    await t('Back slides in from the left, Forward from the right (guided passage); a replay is not an expansion', async function(){
      history.back(); await sleep(20);
      ok(main.getAttribute('data-om-pass') === 'back' && anim(main).name === 'om-pass-back', 'back passage: ' + main.getAttribute('data-om-pass') + ' ' + anim(main).name);
      await sleep(450); ok(!main.hasAttribute('data-om-pass'), 'cleared');
      history.forward(); await sleep(20);
      ok(main.getAttribute('data-om-pass') === 'forward' && anim(main).name === 'om-pass-fwd', 'forward passage');
      ok(!main.classList.contains('om-expand'), 'the replayed job open did not also expand');
      await sleep(450);
    });

    await t('the Kairo panel slides in once when it opens; new messages no longer replay its entrance', async function(){
      if(kairoChatOpen) toggleKairoChat(); await sleep(20);
      toggleKairoChat(); await sleep(10);
      var p = q('#kairo-chat-panel'); ok(p && p.classList.contains('om-focus') && !p.classList.contains('fade-slide-enter'), 'focus shift on open');
      await sleep(450);
      var i = q('#kairo-chat-input'); i.value = 'show my interviews'; q('#kairo-chat-panel form').dispatchEvent(new Event('submit', { bubbles:true, cancelable:true })); await sleep(20);
      p = q('#kairo-chat-panel'); ok(p && !p.classList.contains('om-focus') && !p.classList.contains('fade-slide-enter') && anim(p).name === 'none', 'a redraw is still: ' + anim(p).name);
      await sleep(700); toggleKairoChat();
    });

    await t('a rapid second interaction restarts the family instead of queueing', async function(){
      var d = document.createElement('div'); document.body.appendChild(d);
      oMotion(d, 'om-complete'); oMotion(d, 'om-complete');
      ok(d.classList.contains('om-complete') && d.className.split(' ').filter(function(c){ return c === 'om-complete'; }).length === 1, 'one class, restarted');
      await sleep(400); ok(!d.classList.contains('om-complete'), 'cleaned up'); d.remove();
    });

    await t('reduced motion: every family drops to a short fade', async function(){
      ok(/prefers-reduced-motion: reduce[\s\S]*\.om-expand[\s\S]*om-fade/.test(css()), 'reduced-motion fade for the families');
    });

    pub();
  }, 300); });
})();
