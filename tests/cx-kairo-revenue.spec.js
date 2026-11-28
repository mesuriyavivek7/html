// @cx-runner on
/* CX C7: Revenue & Redeploy and Kairo as the manager — each intent returns the right data, actions ask first, money at
   risk reconciles with the records and becomes "recovered" when resolved.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\cx-kairo-revenue.spec.js */
(function(){
  var results = [], errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e && e.message || e) }); } pub(); }
  function pub(){ var pre = document.getElementById('auth-test-results'); if(!pre){ pre = document.createElement('pre'); pre.id = 'auth-test-results'; document.body.appendChild(pre); } pre.textContent = JSON.stringify(results); }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function eq(a, b, m){ if(a !== b) throw new Error((m ? m + ': ' : '') + 'expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a)); }
  function as(role){ viewingAsFromManager = false; managerViewAsRecruiterId = null; previewAsRoleId = null; state.role = role; renderSidebar(); }
  var D = 86400000;

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    var app = document.getElementById('app'); app.classList.remove('hidden'); app.classList.add('flex');
    as('admin');
    var rec = RECRUITER_ROSTER[0].name, J = { id:9201, name:'Revenue Joiner', role:'QA', company:'RetailX', client:'RetailX', jobId:'j2', recruiter:rec, doj:new Date(cwNow() - 10 * D).toISOString().slice(0, 10), joiningSalary:20, placementFee:2, invoiceStatus:'Not Raised', paymentStatus:'Pending', replacementDays:60, notes:[] };
    PAYTRACK_JOINED.push(J);

    await t('money at risk: items from the G3 rules reconcile with the records', async function(){
      var items = cxRevenueItems(), mine = items.find(function(i){ return i.key === 'perm-not-invoiced|pt:9201'; }); ok(mine, 'the joined-not-invoiced placement'); eq(mine.amount, 200000, '₹2 L fee from the record');
      var sw = cxRevenueSweep(); eq(sw.atRisk, items.filter(function(i){ return i.kind !== 'redeploy'; }).reduce(function(s, i){ return s + i.amount; }, 0), 'totals reconcile');
    });
    await t('resolving the record counts as money recovered', async function(){
      var r0 = CX_REVENUE.recovered; J.invoiceStatus = 'Raised'; J.invoice = { no:'INV-R-1', state:'Raised', raisedAt:new Date(cwNow()).toISOString(), dueAt:new Date(cwNow() + 30 * D).toISOString(), payments:[], credits:[], reminders:[], taxSnapshot:{ total:236000 } };
      cxRevenueSweep(); eq(CX_REVENUE.recovered - r0, 200000, 'recovered'); ok(!CX_REVENUE.open['perm-not-invoiced|pt:9201'], 'closed');
    });
    await t('assignments ending in 30 days go to Talent Discovery as redeploy candidates with an extend / convert suggestion', async function(){
      var a = ASSIGNMENTS.find(function(x){ return /Active|Extended/.test(x.status || ''); }); var keep = a.end; a.end = cwNow() + 20 * D; cxRevenueSweep();
      var it = CX_REVENUE.open['redeploy|' + a.id]; ok(it && /extend or convert/.test(it.detail), JSON.stringify(it)); ok((window.CX_REDEPLOY_CANDIDATES || []).some(function(x){ return x.assignmentId === a.id; }), 'sent to Talent Discovery'); a.end = keep;
    });
    await t('Kairo: “what’s stuck today” lists Guardian and Revenue items by owner', async function(){
      var r = kairoRespond('what’s stuck today'); ok(r.cx && r.cx.intent === 'stuck' && /Money at risk: ₹/.test(r.text), r.text);
    });
    await t('Kairo: “start sourcing for job 42” asks first, then reads the job and ranks', async function(){
      var n = CX_LEDGER.length, r = kairoRespond('start sourcing for job 42'); ok(r.cx.needsConfirm && /Shall I go ahead/.test(r.text), r.text); eq(CX_LEDGER.length, n, 'nothing done before yes');
      var r2 = kairoRespond('yes, go ahead'); ok(r2.cx && r2.cx.intent === 'source' && /Criteria v1/.test(r2.text) && /picks pass the gate/.test(r2.text), r2.text); ok(CX_LEDGER.length > n, 'intake charged');
    });
    await t('Kairo: “why did Guardian flag <name>” gives the alert’s reason', async function(){
      var c = CANDIDATES[0]; CX_GUARD_ALERTS.push({ id:'GA-k', submissionId:'x', candidateId:c.id, jobId:'j1', kind:'offer-risk', why:'Offer risk High: notice over 60 days', owner:'RP-088', ownerWhy:'submission owner', status:'open' });
      var r = kairoRespond('why did Guardian flag ' + c.name.split(' ')[0]); ok(/notice over 60 days/.test(r.text) && r.cx.alert, r.text);
    });
    await t('Kairo: credits for job 42 and this month by agent match the ledger', async function(){
      var r = kairoRespond('credits for job 42'); ok(r.cx.intent === 'credits-job' && r.cx.credits >= 466, r.text);
      var r2 = kairoRespond('credits this month by agent'); var td = r2.cx.byAgent.find(function(a){ return a.id === 'talent-discovery'; }); eq(td.credits, cxSpent({ agent:'talent-discovery', from:new Date(new Date(cwNow()).getFullYear(), new Date(cwNow()).getMonth(), 1).getTime() }));
    });
    await t('Kairo: “pause campaign <name>” asks first; “no” leaves it running; “yes” pauses', async function(){
      cxbNew('blank'); CXB.d.name = 'Spring hiring'; CXB.d.audience = { type:'list', ids:[] }; cxbStart(); var d = CX_CAMPAIGNS[CX_CAMPAIGNS.length - 1]; eq(d.status, 'running');
      ok(kairoRespond('pause campaign spring hiring').cx.needsConfirm); kairoRespond('no'); eq(d.status, 'running', 'still running');
      kairoRespond('pause campaign spring hiring'); var r = kairoRespond('yes'); eq(d.status, 'paused'); ok(/Paused/.test(r.text));
    });
    await t('old Kairo intents still answer; CX off: none of the new intents', async function(){
      ok(/Kairo/.test(kairoRespond('hi').text), 'greeting'); cxSetSwitch(false); var r = kairoRespond('credits this month by agent'); ok(!r.cx, 'old behaviour'); cxSetSwitch(true);
    });
    pub();
  }, 300); });
})();
