// @rx-runner switches=g3
/* RX G3: money at risk — one seeded case per rule (six agency, four corporate), plus the fixed, dismissed and
   self-closed paths, the screen, the Home card and the "Revenue Leak Detected" trigger.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\rx-g3-leaks.spec.js */
(function(){
  var results = [];
  var errs = [];
  window.__RX_NO_TIMER__ = true;
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e && e.message || e) }); } pub(); }
  function pub(){ var pre = document.getElementById('auth-test-results'); if(!pre){ pre = document.createElement('pre'); pre.id = 'auth-test-results'; document.body.appendChild(pre); } pre.textContent = JSON.stringify(results); }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function eq(a, b, m){ if(a !== b) throw new Error((m ? m + ': ' : '') + 'expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a)); }
  var D = 86400000;
  function now(){ return fmNow(); }
  function day(n){ return new Date(now() + n * D).toISOString().slice(0, 10); }
  function open(rule, ref){ return RX.leaks.find(function(f){ return f.rule === rule && f.status === 'open' && (!ref || f.recordRef === ref); }); }
  function as(role){ viewingAsFromManager = false; managerViewAsRecruiterId = null; previewAsRoleId = null; state.role = role; renderSidebar(); }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    var app = document.getElementById('app'); app.classList.remove('hidden'); app.classList.add('flex');
    as('admin');
    var rec = RECRUITER_ROSTER[0].name;
    /* agency seeds */
    var J1 = { id:9101, name:'Leak Joiner', role:'QA Engineer', company:'RetailX', client:'RetailX', jobId:'j2', recruiter:rec, doj:day(-10), joiningSalary:20, placementFee:2, invoiceStatus:'Not Raised', paymentStatus:'Pending', replacementDays:60, notes:[] };
    var J2 = { id:9102, name:'Late Payer', role:'QA Engineer', company:'RetailX', client:'RetailX', jobId:'j2', recruiter:rec, doj:day(-60), joiningSalary:20, placementFee:1.5, invoiceStatus:'Raised', paymentStatus:'Pending', replacementDays:60, notes:[],
      invoice:{ no:'INV-SPEC-1', state:'Raised', raisedAt:day(-50), dueAt:day(-20), payments:[], credits:[], reminders:[], taxSnapshot:{ total:177000 } }, invoiceNo:'INV-SPEC-1' };
    var J3 = { id:9103, name:'Early Leaver', role:'QA Engineer', company:'RetailX', client:'RetailX', jobId:'j2', recruiter:rec, doj:day(-30), joiningSalary:20, placementFee:1.2, invoiceStatus:'Paid', paymentStatus:'Received', replacementDays:60, notes:[], left:{ at:day(-3), reason:'Moved city', by:rec, inWindow:true } };
    PAYTRACK_JOINED.push(J1, J2, J3);

    await t('switch: G3 on by the runner, the 10 rules are defined, the trigger is listed', async function(){
      ok(rxOn('g3')); eq(RX_LEAK_RULES.length, 10);
      eq(RX_LEAK_RULES.map(function(r){ return r.id; }).join(), 'perm-not-invoiced,invoice-overdue,approved-time-not-invoiced,timesheet-missing,timesheet-awaiting-client,guarantee-left-no-replacement,req-idle,joining-at-risk,work-order-ending,duplicate-dispute-open');
      ok(WF_TRIGGERS.indexOf('Revenue Leak Detected') > -1, 'trigger'); eq(WSX.rx.invoiceGraceDays, 3); eq(WSX.rx.contractInvoiceDay, 3); eq(WSX.rx.reqIdleDays, 7);
    });
    await t('perm-not-invoiced: found with the fee; Raise invoice fixes it and counts as recovered', async function(){
      rxLeakSweep(); var f = open('perm-not-invoiced', 'pt:9101'); ok(f, 'finding'); eq(f.amount, 200000); eq(f.currency, 'INR'); ok(f.ownerId === RECRUITER_ROSTER[0].id, 'owner');
      var r = rxLeakFix(f.id); ok(r.ok, JSON.stringify(r)); ok(J1.invoiceStatus !== 'Not Raised', 'invoice raised: ' + J1.invoiceStatus);
      eq(f.status, 'fixed'); ok(f.recovered, 'recovered');
    });
    await t('invoice-overdue: found; the reminder keeps it open; dismissing needs a reason and never reopens', async function(){
      rxLeakSweep(); var f = open('invoice-overdue', 'pt:9102'); ok(f, 'finding'); ok(f.amount > 0, 'amount ' + f.amount);
      var n = PERSONAL_TASKS.length; ok(rxLeakFix(f.id).ok); eq(f.status, 'open', 'still unpaid'); ok(PERSONAL_TASKS.length === n + 1, 'a task');
      ok(!rxLeakDismiss(f.id, '').ok, 'reason required'); ok(rxLeakDismiss(f.id, 'Client paying by cheque this week').ok); eq(f.status, 'dismissed');
      rxLeakSweep(); ok(!open('invoice-overdue', 'pt:9102'), 'not reopened');
    });
    await t('guarantee-left-no-replacement: found; Open replacement job uses the existing flow', async function(){
      rxLeakSweep(); var f = open('guarantee-left-no-replacement', 'pt:9103'); ok(f, 'finding'); eq(f.amount, 120000);
      var jobs = JOBS.length; ok(rxLeakFix(f.id).ok); ok(JOBS.length === jobs + 1 && J3.replacementJobId, 'replacement job'); eq(f.status, 'fixed');
    });
    await t('contract rules: approved time not invoiced, timesheet missing, time awaiting the client', async function(){
      var a = ASSIGNMENTS.find(function(x){ return asRunning(x) && x.tracking !== 'attendance'; }); ok(a, 'a running assignment');
      /* time awaiting the client: a submitted sheet 6 days old */
      var wk = coMonday(now()) - 14 * D, sh = { id:'ts-spec-1', asId:a.id, week:wk, dates:asWeekDates(wk), hours:[8, 8, 8, 8, 8, 0, 0], status:'Submitted', submittedAt:now() - 6 * D };
      ASSIGNMENT_SHEETS.push(sh);
      /* timesheet missing: no sheet for last week */
      var lw = coMonday(now()) - 7 * D; for(var i = ASSIGNMENT_SHEETS.length - 1; i >= 0; i--){ if(ASSIGNMENT_SHEETS[i].asId === a.id && ASSIGNMENT_SHEETS[i].week === lw) ASSIGNMENT_SHEETS.splice(i, 1); }
      if(a.start > lw) a.start = lw - 7 * D;
      /* approved time last month */
      var m = asLastMonth(), b = asMonthBounds(m), wk2 = coMonday(b.f + 7 * D), sh2 = { id:'ts-spec-2', asId:a.id, week:wk2, dates:asWeekDates(wk2), hours:[8, 8, 8, 8, 8, 0, 0], status:'Approved', submittedAt:wk2 + 7 * D, decidedAt:wk2 + 8 * D };
      if(a.start > wk2) a.start = wk2;
      ASSIGNMENT_SHEETS.push(sh2);
      rxLeakSweep();
      var f1 = open('timesheet-awaiting-client', 'ts:ts-spec-1'); ok(f1 && f1.amount > 0, 'awaiting client ' + JSON.stringify(f1));
      var f2 = RX.leaks.find(function(f){ return f.rule === 'timesheet-missing' && f.status === 'open' && f.recordRef.indexOf('as:' + a.id + ':') === 0; }); ok(f2 && f2.estimate, 'missing, as an estimate');
      var f3 = new Date(now()).getDate() > 3 ? open('approved-time-not-invoiced', 'as:' + a.id + ':' + m) : true; ok(f3, 'approved time (day ' + new Date(now()).getDate() + ')');
      /* the fixes: reminders keep them open, an invoice closes the approved-time one */
      ok(rxLeakFix(f1.id).ok && sh.remindedAt, 'approver reminded'); ok(rxLeakFix(f2.id).ok, 'time link resent');
      if(f3 !== true){ var r = rxLeakFix(f3.id); ok(r.ok, JSON.stringify(r)); eq(f3.status, 'fixed', 'invoiced'); ok(f3.recovered); }
      /* self-closed: the client approves the week, the finding closes itself and counts as recovered */
      asDecideWeek(sh, true, '', 'Client'); rxLeakSweep(); eq(f1.status, 'fixed', 'closed itself'); ok(f1.recovered, 'recovered');
    });
    await t('Money at risk screen: grouped by rule with totals, owner, age and a fix button; the Home card', async function(){
      showView('rx-money-at-risk'); var root = document.getElementById('rx-leaks'); ok(root, 'screen');
      ok(root.querySelector('[data-rule="timesheet-missing"]'), 'grouped'); ok(/At risk now/.test(root.textContent) && /Recovered this month/.test(root.textContent), 'totals');
      var row = root.querySelector('[data-leak]'); ok(row && row.querySelectorAll('button').length >= 2 && /\d+ days?/.test(row.textContent), 'row parts');
      var tot = rxLeakTotals(); ok(tot.recovered >= 200000, 'recovered ' + tot.recovered);
      showView('admin-dashboard'); var c = document.getElementById('rx-leak-card'); ok(c && /₹[\d,]+ at risk · ₹[\d,]+ recovered this month/.test(c.textContent), c ? c.textContent : 'no card');
    });
    await t('who sees it: a role without billing view gets no card and a polite screen', async function(){
      var r = CUSTOM_ROLES.find(function(x){ return !roleHasPermission(x.id, 'billing', 'View') && roleHasPermission(x.id, 'candidates', 'View'); });
      previewAsRoleId = r.id; ok(!rxLeakCanSee()); ok(/isn’t part of your role/.test(rxMoneyAtRiskHTML())); previewAsRoleId = null;
    });
    await t('Revenue Leak Detected: a workflow with conditions runs once per finding', async function(){
      var wf = { id:'wf-rx-leak', name:'Leak alert', status:'Published', trigger:'Revenue Leak Detected', leakConditions:[{ field:'rule', value:'perm-not-invoiced' }, { field:'amount', op:'>=', value:'100000' }], steps:[] };
      WORKFLOWS.push(wf);
      function joiner(id, name, fee){ return { id:id, name:name, role:'QA Engineer', company:'RetailX', client:'RetailX', jobId:'j2', recruiter:rec, doj:day(-8), joiningSalary:20, placementFee:fee, invoiceStatus:'Not Raised', paymentStatus:'Pending', replacementDays:60, notes:[] }; }
      PAYTRACK_JOINED.push(joiner(9104, 'Second Joiner', 2));
      rxLeakSweep(); rxLeakSweep();
      eq(RX.leakRuns.filter(function(x){ return x.workflowId === wf.id; }).length, 1, 'once');
      PAYTRACK_JOINED.push(joiner(9105, 'Small Fee', 0.5)); ok(open('perm-not-invoiced', 'pt:9104'), 'the big one is a finding');
      rxLeakSweep(); eq(RX.leakRuns.filter(function(x){ return x.workflowId === wf.id; }).length, 1, 'amount condition not met');
    });
    await t('corporate: idle requisition, joining at risk, work order ending, duplicate dispute', async function(){
      coDemoOn(); ok(jsCorp(), 'corporate');
      var rq = { id:'rq-spec', title:'Spec Analyst', status:'Approved', headcount:1, ctcMax:13, history:[{ at:now() - 10 * D, what:'Approved · budget reserved' }], createdAt:now() - 12 * D, raisedBy:'Spec HM', skills:[] };
      CO.reqs.push(rq);
      var j = JOBS.find(function(x){ return x.corp; }); var c = CANDIDATES[0];
      var s = { id:'sub-spec-join', jobId:j.id, candidateId:c.id, stage:'Offer Accepted', status:'Active', createdAt:new Date(now() - 20 * D).toISOString(), updatedAt:new Date(now() - 9 * D).toISOString(), stageHistory:[{ stage:'Submitted', at:new Date(now() - 20 * D).toISOString() }], offer:{ ctc:12, status:'Accepted', acceptedAt:new Date(now() - 9 * D).toISOString(), doj:day(4) } };
      SUBMISSIONS.push(s);
      var wo = { id:'wo-spec', ref:'WO-SPEC', contractor:'Spec Contractor', role:'Analyst', start:now() - 80 * D, end:now() + 10 * D, rate:6000, unit:'day', hoursPerDay:8, status:'Active', extensions:[], createdBy:'Spec', converted:null };
      CO.contracts.push(wo);
      var da = { id:'da-spec', vendorId:(CO.vendors[0] || {}).id, jobId:j.id, cand:{ name:'Dup Person' }, status:'Open', at:now() - 4 * D, lastAt:now() - 4 * D, tries:1 };
      CO.dupAttempts.push(da);
      rxLeakSweep();
      var f1 = open('req-idle', 'rq:rq-spec'); ok(f1 && f1.estimate, 'idle req'); eq(f1.amount, Math.round(10 * 13 * 100000 / 260));
      var f2 = open('joining-at-risk', 'sub:sub-spec-join'); ok(f2 && /Joining/.test(f2.detail), 'joining at risk');
      var f3 = open('work-order-ending', 'wo:wo-spec'); ok(f3 && f3.perWeek && f3.amount === 30000, 'work order ' + JSON.stringify(f3));
      var f4 = open('duplicate-dispute-open', 'da:da-spec'); ok(f4, 'duplicate');
      ok(!RX.leaks.some(function(f){ return f.status === 'open' && f.side === 'corporate' && /^pt:/.test(f.recordRef); }), 'no agency rule in a company');
      /* self-close: a decision on the work order and the dispute settled */
      wo.endDecision = 'extend'; da.status = 'Closed'; rxLeakSweep(); eq(f3.status, 'fixed'); eq(f4.status, 'fixed'); ok(!f3.recovered && !f4.recovered, 'no money recovered');
      var n = PERSONAL_TASKS.length; ok(rxLeakFix(f2.id).ok && PERSONAL_TASKS.length === n + 1, 'call task');
      showView('rx-money-at-risk'); ok(document.querySelector('#rx-leaks [data-rule="req-idle"]'), 'corporate screen');
      coDemoOff();
    });
    await t('switch off: no findings, no screen, no card, no trigger', async function(){
      rxSetSwitch('g3', false); eq(rxLeakSweep().ran, false); ok(WF_TRIGGERS.indexOf('Revenue Leak Detected') < 0, 'trigger gone');
      showView('admin-dashboard'); ok(!document.getElementById('rx-leak-card')); showView('rx-money-at-risk'); ok(!document.getElementById('rx-leaks'), 'no screen');
      rxSetSwitch('g3', true);
    });
    pub();
  }, 300); });
})();
