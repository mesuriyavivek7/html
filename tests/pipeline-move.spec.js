/* Pipeline moves (package 6, 2026-11-24): the corporate board's drag-and-drop has a keyboard equivalent (Alt+arrows on a
   focused card, a Move menu) with the same guards, and every move (drag, menu, keyboard) can be undone.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\pipeline-move.spec.js */
(function(){
  var results = [];
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var q = function(s, el){ return (el || document).querySelector(s); }, qa = function(s){ return [].slice.call(document.querySelectorAll(s)); };
  var errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e && e.message || e) }); } pub(); }
  function pub(){ var pre = document.getElementById('auth-test-results'); if(!pre){ pre = document.createElement('pre'); pre.id = 'auth-test-results'; document.body.appendChild(pre); } pre.textContent = JSON.stringify(results); }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function key(el, k, alt){ el.dispatchEvent(new KeyboardEvent('keydown', { key:k, altKey:!!alt, bubbles:true, cancelable:true })); }
  function subOf(card){ var id = card.getAttribute('data-lu-card'); return SUBMISSIONS.find(function(s){ return String(s.id) === id; }); }
  function board(){ lineupViewMode = 'board'; document.getElementById('main-content').innerHTML = '<div>' + lineupTableHTML() + '</div>'; }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    try { localStorage.clear(); } catch(e){}
    state.role = 'admin'; enterApp(); await sleep(120);
    ORG_STRUCTURE.profile.orgType = 'Corporate'; try { if(typeof coSeedCorp === 'function' && !CO.seeded) coSeedCorp(); } catch(e){}
    showView('talent-pool'); await sleep(40); board(); await sleep(20);

    await t('cards on drag stages are focusable, describe themselves and carry a Move button; guarded stages do not', async function(){
      ok(jsCorp(), 'corporate board'); var cards = qa('[data-lu-card]'); ok(cards.length >= 1, 'movable cards: ' + cards.length);
      var c = cards[0]; ok(c.getAttribute('tabindex') === '0' && /Alt and an arrow key/.test(c.getAttribute('aria-label')), 'focusable and described');
      ok(q('.lu-move', c) && /Move .+ to another stage/.test(q('.lu-move', c).getAttribute('aria-label')), 'Move button');
      ok(qa('[data-lu-card]').every(function(el){ return LINEUP_DRAGGABLE_STAGES.indexOf(subOf(el).stage) > -1; }), 'only drag-stage cards are movable');
    });

    await t('Alt+→ moves one stage through the real move; Undo moves it back; focus stays on the card', async function(){
      var c = qa('[data-lu-card]').find(function(el){ var i = LINEUP_DRAGGABLE_STAGES.indexOf(subOf(el).stage); return i > -1 && i < LINEUP_DRAGGABLE_STAGES.length - 1; });
      ok(c, 'a card that can move right'); var s = subOf(c), from = s.stage, to = LINEUP_DRAGGABLE_STAGES[LINEUP_DRAGGABLE_STAGES.indexOf(from) + 1];
      c.focus(); key(c, 'ArrowRight', true); await sleep(30);
      ok(s.stage === to, 'moved ' + from + ' → ' + to + ', got ' + s.stage);
      ok(document.activeElement && document.activeElement.getAttribute('data-lu-card') === String(s.id), 'focus is on the moved card');
      var undo = q('.app-toast__undo'); ok(undo && /Moved to/.test(q('#toast-container').textContent), 'toast with Undo');
      undo.click(); await sleep(30); ok(s.stage === from, 'Undo moved it back to ' + from + ', got ' + s.stage);
      ok(/Moved back to/.test(q('#toast-container').textContent), 'Undo confirms');
    });

    await t('the keyboard respects the same guards as drag: no move past the last drag stage, a plain arrow does nothing', async function(){
      var c = qa('[data-lu-card]')[0], s = subOf(c), before = s.stage;
      key(c, 'ArrowRight', false); await sleep(10); ok(s.stage === before, 'arrow without Alt does nothing');
      var last = LINEUP_DRAGGABLE_STAGES[LINEUP_DRAGGABLE_STAGES.length - 1];
      var lc = qa('[data-lu-card]').find(function(el){ return subOf(el).stage === last; });
      if(lc){ var ls = subOf(lc); key(lc, 'ArrowRight', true); await sleep(20); ok(ls.stage === last && /No further quick move/.test(q('#toast-container').textContent), 'stops at the last drag stage'); }
      ok(luMove(s.id, 'Interview').ok === false && s.stage === before, 'a guarded stage is refused through the same path');
    });

    await t('Move menu: lists the other drag stages, keyboard navigable, Escape returns focus, choosing moves with Undo', async function(){
      var c = qa('[data-lu-card]')[0], s = subOf(c), from = s.stage, btn = q('.lu-move', c);
      btn.click(); await sleep(20); var m = q('#lu-menu');
      ok(m && m.getAttribute('role') === 'menu' && qa('#lu-menu [role=menuitem]').length === LINEUP_DRAGGABLE_STAGES.length - 1, 'menu of the other stages');
      ok(document.activeElement && document.activeElement.getAttribute('role') === 'menuitem', 'first item focused');
      key(m, 'ArrowDown'); key(m, 'Escape'); await sleep(10); ok(!q('#lu-menu') && document.activeElement === btn, 'Escape closes and returns focus');
      btn = q('.lu-move', q('[data-lu-card="' + s.id + '"]')); btn.click(); await sleep(20);
      var item = qa('#lu-menu [role=menuitem]')[0], target = item.getAttribute('data-lu-to'); item.click(); await sleep(30);
      ok(s.stage === target && !q('#lu-menu'), 'moved to ' + target); q('.app-toast__undo').click(); await sleep(30); ok(s.stage === from, 'undone');
    });

    await t('drag-and-drop uses the same path and gets Undo too', async function(){
      var c = qa('[data-lu-card]').find(function(el){ return LINEUP_DRAGGABLE_STAGES.indexOf(subOf(el).stage) < LINEUP_DRAGGABLE_STAGES.length - 1; }), s = subOf(c), from = s.stage;
      var to = LINEUP_DRAGGABLE_STAGES[LINEUP_DRAGGABLE_STAGES.indexOf(from) + 1];
      lineupDragCandidateId = s.candidateId; lineupDragJobId = s.jobId;
      handleLineupDrop({ preventDefault:function(){} }, to); await sleep(30);
      ok(s.stage === to && q('.app-toast__undo'), 'dropped with Undo'); q('.app-toast__undo').click(); await sleep(30); ok(s.stage === from, 'undone');
    });

    pub();
  }, 300); });
})();
