/* Intelligence: organise the conversation list into sections (2026-11-24, from the user's screenshot of "Organize your sidebar").
   One-time tip (Later / New section), create and rename a section, move by menu, drag and drop, collapse, survive a reload,
   delete without losing conversations, flat results while searching or filtering, pinned stays on top.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\iq-sections.spec.js */
(function(){
  var results = [];
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var q = function(s, el){ return (el || document).querySelector(s); }, qa = function(s, el){ return [].slice.call((el || document).querySelectorAll(s)); };
  var errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e && e.message || e) }); } pub(); }
  function pub(){ var pre = document.getElementById('auth-test-results'); if(!pre){ pre = document.createElement('pre'); pre.id = 'auth-test-results'; document.body.appendChild(pre); } pre.textContent = JSON.stringify(results); }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function list(){ return q('#iq-list'); }
  function rowOf(id){ return q('.iq-conv[data-conv="' + id + '"]'); }
  function secEl(id){ return q('.iq-sec[data-iq-drop="' + id + '"]'); }
  function secOf(id){ var r = rowOf(id); var s = r && r.closest('.iq-sec'); return s ? s.getAttribute('data-iq-drop') : null; }
  function drag(fromEl, toEl){
    var dt = new DataTransfer();
    fromEl.dispatchEvent(new DragEvent('dragstart', { bubbles:true, cancelable:true, dataTransfer:dt }));
    toEl.dispatchEvent(new DragEvent('dragover', { bubbles:true, cancelable:true, dataTransfer:dt }));
    var over = toEl.classList.contains('is-drop');
    toEl.dispatchEvent(new DragEvent('drop', { bubbles:true, cancelable:true, dataTransfer:dt }));
    return over;
  }
  function openSide(){ IQ.sb = true; IQ.filter = 'all'; IQ.q = ''; iqRender(); }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    try { localStorage.clear(); } catch(e){}
    state.role = 'admin'; enterApp(); await sleep(100);
    showView('intelligence'); await sleep(40); iqPersist(); openSide(); await sleep(20);   // keep the two seeded conversations, so a reload of the store returns the same ids
    var convs = IQ.convs.slice(), A = convs[0].id, B = convs[1].id, SEC = null;

    await t('the tip shows once in All: Later hides it and it stays hidden after the list redraws and after a reload of the conversations', async function(){
      ok(q('.iq-orgtip', list()) && /Organise your conversations/.test(q('.iq-orgtip').textContent), 'tip shown while there are no sections');
      ok(/Later/.test(q('.iq-orgtip__later').textContent) && /New section/.test(q('.iq-orgtip__go').textContent), 'two actions, as in the reference');
      q('.iq-orgtip__later').click(); await sleep(10); ok(!q('.iq-orgtip'), 'Later hides it');
      iqRenderList(); ok(!q('.iq-orgtip'), 'still hidden'); IQ.loadedFor = null; iqLoad(); openSide(); ok(!q('.iq-orgtip'), 'remembered');
      try { localStorage.removeItem(IQ_TIP_KEY); } catch(e){} iqRenderList(); ok(q('.iq-orgtip'), 'back only if the memory is cleared (for the next test)');
    });

    await t('New section from the tip creates a section with its name ready to type; Enter saves it; the tip goes', async function(){
      q('.iq-orgtip__go').click(); await sleep(20);
      var inp = q('#iq-sec-rename'); ok(inp && document.activeElement === inp, 'the name field is focused');
      inp.value = '  Fintech Corp   hiring '; inp.dispatchEvent(new KeyboardEvent('keydown', { key:'Enter', bubbles:true })); await sleep(10);
      ok(IQ.sections.length === 1 && IQ.sections[0].name === 'Fintech Corp hiring', 'name trimmed and saved: ' + JSON.stringify(IQ.sections));
      SEC = IQ.sections[0].id; ok(secEl(SEC) && /Fintech Corp hiring/.test(secEl(SEC).textContent) && /Drag conversations here/.test(secEl(SEC).textContent), 'empty section invites a drag');
      ok(!q('.iq-orgtip'), 'the tip is gone once a section exists'); ok(q('.iq-secs__add'), 'a quiet + adds more sections');
    });

    await t('move by menu (keyboard and touch path): Move to puts the conversation in the section once, with a count', async function(){
      iqMenu(A); await sleep(10);
      var move = qa('.iq-menu [role=menuitem]').filter(function(b){ return /Move to Fintech Corp hiring/.test(b.textContent); })[0]; ok(move, 'Move to item in the menu');
      move.click(); await sleep(10);
      ok(secOf(A) === SEC, 'now inside the section'); ok(qa('.iq-conv[data-conv="' + A + '"]').length === 1, 'shown once');
      ok(q('.iq-sec__n', secEl(SEC)).textContent === '1', 'count 1'); ok(IQ.convs.find(function(c){ return c.id === A; }).sectionId === SEC, 'stored on the conversation');
      iqMenu(A); await sleep(10); ok(qa('.iq-menu [role=menuitem]').some(function(b){ return /Remove from section/.test(b.textContent); }), 'and it can be taken out again'); iqMenu(A);
    });

    await t('drag and drop: dropping a conversation on a section moves it there; dropping it on the dated list takes it out', async function(){
      var over = drag(rowOf(B), secEl(SEC)); await sleep(10);
      ok(over, 'the section highlights while a conversation is over it'); ok(secOf(B) === SEC, 'dropped into the section');
      ok(q('.iq-sec__n', secEl(SEC)).textContent === '2', 'count 2'); ok(!q('.is-drop') && !q('.is-dragging'), 'no highlight left behind');
      drag(rowOf(B), q('.iq-loose')); await sleep(10);
      ok(secOf(B) === null && rowOf(B), 'back under the dates'); ok(q('.iq-sec__n', secEl(SEC)).textContent === '1', 'count 1');
    });

    await t('collapse hides the rows; sections, names, collapse and membership survive a reload of the stored conversations', async function(){
      q('.iq-sec__t', secEl(SEC)).click(); await sleep(10);
      ok(!rowOf(A), 'collapsed hides its conversations'); ok(q('.iq-sec__t', secEl(SEC)).getAttribute('aria-expanded') === 'false', 'aria-expanded follows');
      IQ.convs = null; IQ.sections = []; IQ.loadedFor = null; iqLoad(); openSide(); await sleep(10);
      ok(IQ.sections.length === 1 && IQ.sections[0].name === 'Fintech Corp hiring' && IQ.sections[0].collapsed === true, 'section restored: ' + JSON.stringify(IQ.sections));
      ok(IQ.convs.find(function(c){ return c.id === A; }).sectionId === SEC, 'membership restored');
      q('.iq-sec__t', secEl(SEC)).click(); await sleep(10); ok(secOf(A) === SEC, 'expanded again');
    });

    await t('searching or filtering shows a flat result, including conversations inside sections', async function(){
      IQ.q = String(IQ.convs.find(function(c){ return c.id === A; }).title).slice(0, 12); iqRenderList();
      ok(!q('.iq-sec') && rowOf(A), 'flat while searching, the sectioned conversation is found');
      IQ.q = ''; IQ.filter = 'saved'; iqRenderList(); ok(!q('.iq-sec'), 'flat under Saved'); IQ.filter = 'all'; iqRenderList(); ok(secEl(SEC), 'sections back in All');
    });

    await t('a pinned conversation shows under Pinned only; moving it into a section unpins it so it shows once', async function(){
      iqPin(B); await sleep(10); var pg = qa('.iq-group').filter(function(g){ return /^Pinned/.test(g.textContent); })[0];
      ok(pg && pg.contains(rowOf(B)) && qa('.iq-conv[data-conv="' + B + '"]').length === 1, 'pinned on top, once');
      iqMoveTo(B, SEC); await sleep(10); var c = IQ.convs.find(function(x){ return x.id === B; });
      ok(!c.pinned && secOf(B) === SEC, 'moved and unpinned');
    });

    await t('rename and delete a section: deleting keeps every conversation, back under the dates, and says so', async function(){
      iqSectionMenu(SEC); await sleep(10); var rn = qa('.iq-menu [role=menuitem]').filter(function(b){ return /Rename section/.test(b.textContent); })[0]; ok(rn, 'rename in the section menu'); rn.click(); await sleep(10);
      var inp = q('#iq-sec-rename'); inp.value = 'Q4 review'; inp.dispatchEvent(new KeyboardEvent('keydown', { key:'Enter', bubbles:true })); await sleep(10);
      ok(IQ.sections[0].name === 'Q4 review', 'renamed'); var n = IQ.convs.length;
      iqSectionMenu(SEC); await sleep(10); qa('.iq-menu [role=menuitem]').filter(function(b){ return /Delete section/.test(b.textContent); })[0].click(); await sleep(20);
      ok(IQ.sections.length === 0 && IQ.convs.length === n, 'section gone, no conversation lost');
      ok(!IQ.convs.some(function(c){ return c.sectionId; }) && rowOf(A) && rowOf(B), 'both back under the dates');
      ok(/back under the dates/.test(document.getElementById('toast-container').textContent), 'the toast says where they went');
    });

    await t('New section with this, from a conversation menu, creates the section with that conversation inside', async function(){
      iqMenu(A); await sleep(10); qa('.iq-menu [role=menuitem]').filter(function(b){ return /New section with this/.test(b.textContent); })[0].click(); await sleep(20);
      var inp = q('#iq-sec-rename'); inp.value = 'Leadership hiring'; inp.dispatchEvent(new KeyboardEvent('keydown', { key:'Enter', bubbles:true })); await sleep(10);
      var s = IQ.sections[0]; ok(s && s.name === 'Leadership hiring' && secOf(A) === s.id, 'created with the conversation inside');
    });

    pub();
  }, 300); });
})();
