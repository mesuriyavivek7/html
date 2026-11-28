// @cx-runner on
/* QA fix A6: the live ledger scrolls virtually. 10,000 seeded rows; only the rows in view are in the DOM (< 100);
   scrolling draws the right slice; filters and the CSV export still cover every row; re-rendering keeps the place.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\cx-ledger-vscroll.spec.js */
(function(){
  var results = [], errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e && e.message || e) }); } pub(); }
  function pub(){ var pre = document.getElementById('auth-test-results'); if(!pre){ pre = document.createElement('pre'); pre.id = 'auth-test-results'; document.body.appendChild(pre); } pre.textContent = JSON.stringify(results); }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function eq(a, b, m){ if(a !== b) throw new Error((m ? m + ': ' : '') + 'expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a)); }
  function as(role){ viewingAsFromManager = false; managerViewAsRecruiterId = null; previewAsRoleId = null; state.role = role; renderSidebar(); }
  function q(s){ return document.querySelector(s); }
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  function rowsInDom(){ return document.querySelectorAll('#cx-ledger tbody tr').length; }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    var app = document.getElementById('app'); app.classList.remove('hidden'); app.classList.add('flex');
    as('admin');

    var seedMs = 0;
    await t('seed: 10,000 more ledger rows (5,000 reserve → charge pairs, appended as the ledger would)', async function(){
      var t0 = performance.now(), n0 = CX_LEDGER.length, ts = Date.now() - 20000, bal = cxBalance();
      for(var i = 0; i < 5000; i++){ var ag = i % 2 ? 'outreach' : 'talent-discovery', rid = 'CXR-LOAD-' + i;
        CX_LEDGER.push({ id:'CXL-LOAD-' + (2 * i), ts:ts + 2 * i, workspaceId:'load', agent:ag, jobId:null, action:'Load check ' + i, rateClass:'rules', credits:0, status:'reserved', reservationId:rid, triggeredBy:ag, balanceAfter:bal, qty:1 });
        CX_LEDGER.push({ id:'CXL-LOAD-' + (2 * i + 1), ts:ts + 2 * i + 1, workspaceId:'load', agent:ag, jobId:null, action:'Load check ' + i, rateClass:'rules', credits:0, status:'charged', reservationId:rid, triggeredBy:ag, balanceAfter:bal, qty:1 }); }
      eq(cxBalance(), bal, 'the balance index rebuilds and is unchanged');
      seedMs = Math.round(performance.now() - t0); ok(CX_LEDGER.length - n0 >= 10000, 'rows: ' + (CX_LEDGER.length - n0));
    });
    results.push({ name:'RESULT seeding 10,000 rows took ' + seedMs + ' ms (the headless runner uses a virtual clock)', pass:true });
    var renderMs = 0;
    await t('only the rows in view are in the DOM (< 100), with the full count and a scroll box', async function(){
      showView('kairo-team'); CA.agent = null; CA.tab = 'credits'; CXU.f = { agent:'', job:'', status:'', from:'', to:'' };
      var t0 = performance.now(); caRefresh(); renderMs = Math.round(performance.now() - t0);
      var box = q('#cx-ledger-scroll'); ok(box, 'scroll box'); eq(+box.getAttribute('data-total'), CX_LEDGER.length, 'total covers every row');
      ok(rowsInDom() < 100, 'DOM rows ' + rowsInDom()); ok(rowsInDom() >= 17, 'enough rows to fill the view');
      eq(q('#cx-ledger tbody tr').getAttribute('data-cxl'), CX_LEDGER[CX_LEDGER.length - 1].id, 'newest first');
      ok(/10,\d{3} rows|1\d,\d{3} rows/.test(q('#cx-ledger-count').textContent), q('#cx-ledger-count').textContent); ok(!/Show \d+ more/.test(q('#cx-credits-view').textContent), 'no Show more paging');
      ok(renderMs < 1500, 'render ' + renderMs + ' ms');
    });
    results.push({ name:'RESULT Credits tab render with ' + CX_LEDGER.length + ' rows: ' + renderMs + ' ms (virtual clock), ' + rowsInDom() + ' rows in the DOM', pass:true });
    await t('scrolling draws the slice in view; the DOM stays under 100 rows', async function(){
      var box = q('#cx-ledger-scroll'), all = cxLedgerRows(), rh = CX_VSCROLL.rowH;
      box.scrollTop = 5000 * rh; cxLedgerScroll(box); var first = q('#cx-ledger tbody tr').getAttribute('data-cxl'), idx = all.findIndex(function(r){ return r.id === first; });
      rh = CX_VSCROLL.rowH; ok(idx >= 0 && Math.abs(idx - (Math.floor(box.scrollTop / rh) - CX_VSCROLL.over)) <= 1, 'first drawn row matches the scroll position: ' + idx + ' at ' + box.scrollTop);
      ok(rowsInDom() < 100, 'DOM rows ' + rowsInDom());
      box.scrollTop = box.scrollHeight; cxLedgerScroll(box); var rows = document.querySelectorAll('#cx-ledger tbody tr'); eq(rows[rows.length - 1].getAttribute('data-cxl'), all[all.length - 1].id, 'the bottom shows the oldest row'); ok(rowsInDom() < 100);
      var pad = q('#cx-ledger-pad'); ok(parseFloat(pad.style.paddingTop) > 0, 'space above stands in for rows not drawn');
    });
    await t('a re-render (live update) keeps the place', async function(){
      var box = q('#cx-ledger-scroll'); box.scrollTop = 3000 * CX_VSCROLL.rowH; cxLedgerScroll(box); var before = box.scrollTop;
      caRefresh(); await sleep(20); var nb = q('#cx-ledger-scroll'); ok(Math.abs(nb.scrollTop - before) < CX_VSCROLL.rowH * 2, 'scroll kept: ' + nb.scrollTop + ' vs ' + before); ok(+nb.getAttribute('data-start') > 0, 'slice kept');
    });
    await t('filters cover every row, and start from the top', async function(){
      cxSet('agent', 'outreach'); var box = q('#cx-ledger-scroll'), want = cxLedgerRows().length; eq(+box.getAttribute('data-total'), want, 'filtered total'); ok(want >= 5000, 'outreach rows ' + want); eq(+box.getAttribute('data-start'), 0);
      ok([].every.call(document.querySelectorAll('#cx-ledger tbody tr td:nth-child(2)'), function(td){ return td.textContent === cxAgentName('outreach'); }), 'only that agent'); ok(rowsInDom() < 100);
      cxSet('agent', '');
    });
    await t('the CSV export has every row', async function(){
      var blob = null, real = URL.createObjectURL; URL.createObjectURL = function(b){ blob = b; return real.call(URL, b); };
      try { cxExportCsv(); } finally { URL.createObjectURL = real; }
      ok(blob, 'a file'); var text = await blob.text(); eq(text.split('\n').length - 1, cxLedgerRows().length, 'CSV lines (minus the header)');
    });
    await t('the job page’s short list is unchanged (explicit limit, no scroll box)', async function(){
      var h = cxLedgerTableHTML(cxLedgerRows(), 50); ok(!/cx-ledger-scroll/.test(h) && (h.match(/<tr data-cxl/g) || []).length === 50, 'plain table of 50');
    });
    pub();
  }, 300); });
})();
