// @cx-runner on
/* CX C1: one common credit wallet — the seeded example day, reserve / charge / release, idempotent settle, delivery
   receipts, budgets, the safety reserve, rate history, the Credits tab and job credits, and CX off = today's pricing.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\cx-credits.spec.js */
(function(){
  var results = [], errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e && e.message || e) }); } pub(); }
  function pub(){ var pre = document.getElementById('auth-test-results'); if(!pre){ pre = document.createElement('pre'); pre.id = 'auth-test-results'; document.body.appendChild(pre); } pre.textContent = JSON.stringify(results); }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function eq(a, b, m){ if(a !== b) throw new Error((m ? m + ': ' : '') + 'expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a)); }
  function sumLedger(){ return CX_LEDGER.reduce(function(s, r){ return s + r.credits; }, 0); }
  function as(role){ viewingAsFromManager = false; managerViewAsRecruiterId = null; previewAsRoleId = null; state.role = role; renderSidebar(); }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    var app = document.getElementById('app'); app.classList.remove('hidden'); app.classList.add('flex');
    as('admin');

    await t('switch: CX on for this spec (runner); off by default otherwise', async function(){
      ok(cxOn(), 'on'); eq(window.__CX_SWITCH__, true);
    });
    await t('seed: the example day — 17 rows, balance 19,534, by agent 393 / 62 / 8 / 2 / 1 / 0 = 466', async function(){
      eq(CX_LEDGER.length, 17, 'rows'); eq(cxBalance(), 19534, 'balance'); eq(CX_LEDGER[16].balanceAfter, 19534, 'last row');
      var by = {}; cxByAgent().forEach(function(a){ by[a.id] = a.credits; });
      eq(by['talent-discovery'], 393); eq(by['outreach'], 62); eq(by['linkedin'], 8); eq(by['interviews'], 2); eq(by['delivery-guardian'], 1); eq(by['revenue-redeploy'], 0);
      eq(cxSpent(), 466, 'total'); ok(CX_LEDGER.every(function(r){ return r.jobId === 'j42' || r.status === 'added'; }), 'job 42'); eq(CX_WA_BILLING.mode, 'oontu-resell', 'demo resells WhatsApp');
    });
    await t('balance always equals the sum of the ledger', async function(){ eq(cxBalance(), sumLedger()); });
    await t('reserve → charge; reserve → release; double settle is a no-op', async function(){
      var b0 = cxBalance(), r = cxReserve({ agent:'outreach', rateClass:'email', qty:1, jobId:'j42', action:'Email' }); ok(r.reservationId, JSON.stringify(r));
      eq(cxBalance(), b0 - 1, 'held'); eq(cxReservedNow(), 1); ok(cxSettle(r.reservationId, 'charged').ok); eq(cxBalance(), b0 - 1, 'charged'); eq(cxReservedNow(), 0);
      var n = CX_LEDGER.length; ok(!cxSettle(r.reservationId, 'charged').ok && !cxSettle(r.reservationId, 'released').ok, 'second settle refused'); eq(CX_LEDGER.length, n, 'nothing written'); eq(cxBalance(), b0 - 1);
      var r2 = cxReserve({ agent:'outreach', rateClass:'ai-medium', qty:2 }); eq(cxBalance(), b0 - 7); cxSettle(r2.reservationId, 'released'); eq(cxBalance(), b0 - 1, 'released back');
      eq(cxBalance(), sumLedger(), 'still the sum');
    });
    await t('an undelivered WhatsApp template is released; the same receipt twice changes nothing', async function(){
      var b0 = cxBalance(), r = cxReserve({ agent:'outreach', rateClass:'wa-template', qty:1 }); eq(cxBalance(), b0 - 2);
      ok(cxDeliveryReceipt('evt-1', r.reservationId, false).ok); eq(cxBalance(), b0, 'released'); ok(cxDeliveryReceipt('evt-1', r.reservationId, true).duplicate, 'duplicate event');
      eq(cxBalance(), b0);
    });
    await t('the send path: a sent Cowork message reserves and charges at its rate; append-only', async function(){
      var b0 = cxBalance(), rows = CX_LEDGER.slice(), e = cwLedger({ channel:'email', senderId:'RP-088', personKey:'c2', workflowId:null, agentId:'engagement', runId:'run-x', status:'sent', action:'First message' });
      ok(e.cxReservationId, 'reserved'); eq(cxBalance(), b0 - 1, 'email = 1 credit');
      var mine = CX_LEDGER.filter(function(r){ return r.reservationId === e.cxReservationId; }); eq(mine.map(function(r){ return r.status; }).join(), 'reserved,charged'); eq(mine[0].agent, 'outreach', 'engagement counts as Outreach');
      ok(rows.every(function(r, i){ return CX_LEDGER[i] === r; }), 'earlier rows untouched');
      var b1 = cxBalance(); cwLedger({ channel:'email', personKey:'c2', agentId:'engagement', status:'blocked', reason:'Quiet hours' }); eq(cxBalance(), b1, 'a blocked step costs nothing');
    });
    await t('budgets: alert at 80%, stop at 100% (non-safety steps)', async function(){
      var m0 = new Date(cwNow()); m0 = new Date(m0.getFullYear(), m0.getMonth(), 1).getTime();
      var used = cxSpent({ agent:'linkedin', from:m0 }); ok(cxSetBudget('agent', 'linkedin', used + 2).ok);
      var r1 = cxReserve({ agent:'linkedin', rateClass:'ai-small', qty:1 }); ok(r1.reservationId, 'room for one'); cxSettle(r1.reservationId, 'charged');
      ok(CX_ALERTS.some(function(a){ return /LinkedIn Outreach has used/.test(a.text); }), 'alert at 80%');
      cxReserve({ agent:'linkedin', rateClass:'ai-small', qty:1 }).reservationId && null;
      var r3 = cxReserve({ agent:'linkedin', rateClass:'li-task', qty:1 }); ok(r3.blocked && /Budget reached/.test(r3.blocked), JSON.stringify(r3));
      ok(cxReserve({ agent:'linkedin', rateClass:'wa-window', qty:1, safetyCritical:true }).reservationId, 'safety steps still run');
    });
    await t('the safety reserve: an interview reminder runs on a low balance, a normal action does not', async function(){
      var bal = cxBalance(), keep = cxSafetyReserve(); eq(keep, 300, '2% of 15,000');
      cxCharge({ agent:'talent-discovery', rateClass:'ai-small', qty:bal - keep - 1, action:'Drain for the test' });
      var normal = cxReserve({ agent:'outreach', rateClass:'wa-template', qty:1 }); ok(normal.blocked && /kept for interview reminders/.test(normal.blocked), JSON.stringify(normal));
      var rem = cxReserve({ agent:'interviews', rateClass:'wa-template', qty:1, safetyCritical:true, action:'Interview reminder' }); ok(rem.reservationId, 'reminder goes through');
      cxSettle(rem.reservationId, 'charged'); eq(cxBalance(), sumLedger());
      CX_LEDGER.push(Object.assign({}, CX_LEDGER[0], { id:'CXL-test-topup', ts:cwNow(), credits:20000, status:'added', action:'Test top-up', balanceAfter:sumLedger() + 20000 }));
    });
    await t('a rate change after an action does not alter past rows', async function(){
      var before = CX_LEDGER.map(function(r){ return r.credits; }).join();
      cxSetRate('email', 5, new Date(cwNow() - 1000).toISOString()); eq(cxRate('email'), 5, 'new rate'); eq(CX_RATES.filter(function(r){ return r.rateClass === 'email'; }).length, 2, 'old row kept');
      eq(CX_LEDGER.map(function(r){ return r.credits; }).join(), before, 'history unchanged');
      cxSetRate('email', 1, new Date(cwNow() - 500).toISOString());
    });
    await t('Cowork › Credits: balance, reserved, spent, days, by agent, impact, live ledger, budgets, CSV', async function(){
      showView('kairo-team'); CA.tab = 'credits'; caRefresh();
      var v = document.getElementById('cx-credits-view'); ok(v, 'Credits view'); ok(document.getElementById('ca-tab-credits').getAttribute('aria-selected') === 'true', 'tab on');
      ok(/credits/.test(document.getElementById('cx-balance').textContent) && document.getElementById('cx-head-balance'), 'balance shown in the header and the view');
      eq(v.querySelectorAll('.cx-bar').length, 6, 'six agents'); ok(document.getElementById('cx-impact') && /touched the candidate before the outcome/.test(document.getElementById('cx-impact').textContent), 'impact with definition');
      var rows = v.querySelectorAll('#cx-ledger tbody tr'); ok(rows.length >= 17, 'ledger rows'); ok(rows[0].getAttribute('data-cxl') === CX_LEDGER[CX_LEDGER.length - 1].id, 'newest first');
      v.querySelector('[data-cx-agent="linkedin"]').click(); ok([].every.call(document.querySelectorAll('#cx-ledger tbody tr td:nth-child(2)'), function(td){ return td.textContent === 'LinkedIn Outreach'; }), 'bar filters the ledger');
      cxSet('agent', ''); var csv = cxExportCsv(); ok(/^id,time,agent/.test(csv) && csv.split('\n').length === CX_LEDGER.length + 1, 'CSV');
      ok(document.getElementById('cx-budgets'), 'budgets');
    });
    await t('agents are included on every plan; prices and allowances hidden; plan shows monthly credits', async function(){
      ok(AGENT_CATALOG.every(function(a){ return agentEntitled(a.id); }), 'every agent open');
      var h = sec_kairoAgents(true); ok(!/₹[\d,]+ per/.test(h), 'no price'); ok(/Uses credits from your wallet/.test(sUsage('talent-discovery')), 'no action allowance'); var b = sec_billing(true); ok(/15,000 credits/.test(b) && /Every Cowork agent is included/.test(b), 'plan in credits');
      CA.tab = 'agents'; caRefresh(); ok(document.querySelector('[data-cx-included]'), 'cards say Included');
      ok(AGENT_CATALOG[0].price.amount === 4999, 'old fields kept');
    });
    await t('migration banner: monthly prices become credits; dismissible', async function(){
      var x = cxMigrationCredits(); if(x > 0){ CA.tab = 'agents'; caRefresh(); var bn = document.getElementById('cx-banner'); ok(bn && bn.textContent.indexOf(x.toLocaleString('en-IN') + ' credits') > -1, 'banner'); cxDismissBanner(); ok(!document.getElementById('cx-banner'), 'dismissed'); }
      else ok(true);
    });
    await t('job page: Credits section with per-outcome cost', async function(){
      var j = JOBS[0]; cxCharge({ agent:'talent-discovery', rateClass:'ai-strong', qty:1, jobId:j.id, action:'Intake' });
      openJob(j.id); var s = document.getElementById('cx-job-credits'); ok(s && /per prospect/.test(s.textContent) && s.querySelectorAll('#cx-ledger tbody tr').length >= 1, 'job credits');
    });
    await t('CX off: today’s pricing UI and Cowork exactly (no tab, no chip, no banner, prices back)', async function(){
      cxSetSwitch(false); ok(!cxOn());
      ok(/ of [\d,]+/.test(sUsage('talent-discovery')) && !/Uses credits/.test(sUsage('talent-discovery')), 'action allowance back: ' + sUsage('talent-discovery')); ok(!/Every Cowork agent is included/.test(sec_billing(true)), 'no credit plan card');
      CA.tab = 'agents'; showView('kairo-team'); ok(!document.getElementById('ca-tab-credits') && !document.getElementById('cx-head-balance') && !document.querySelector('[data-cx-included]'), 'Cowork as before');
      var n = CX_LEDGER.length; cwLedger({ channel:'email', personKey:'c3', agentId:'engagement', status:'sent', action:'x' }); eq(CX_LEDGER.length, n, 'no charge while off');
      cxSetSwitch(true);
    });
    pub();
  }, 300); });
})();
