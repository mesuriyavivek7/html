/* M9 step 2b · Contract and temporary staff: money (B7 · flow map 16).
   One full cycle across a month boundary with a mid-month rate change, a part payment and commission becoming payable;
   tax from the client location's rules with the TDS line per supply type; M8 numbering, holds and overdue; the gross-pay
   export; conversion to permanent (fee, waiver, Temporary); the Contracts view; permanent totals and corporate untouched.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\m09b-contract-money.spec.js */
(function(){
  var results = [];
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  var ce = console.error; console.error = function(){ errs.push('console.error ' + Array.prototype.slice.call(arguments).map(function(a){ return (a && a.stack) || (a && a.message) || String(a); }).join(' ').slice(0, 300)); };
  var T0 = 0, D = 86400000, OWNER = 'RP-088', seq = 0;
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e.stack || e.message).slice(0, 500) }); }
    finally { asOwner(); ORG_STRUCTURE.profile.orgType = 'Agency'; FM.offset = T0; fmModal(''); CO.pg = null; } }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function asOwner(){ viewingAsFromManager = false; managerViewAsRecruiterId = null; previewAsRoleId = null; state.role = 'admin'; }
  function actAs(id){ if(id === OWNER) return asOwner(); state.role = 'manager'; viewingAsFromManager = true; managerViewAsRecruiterId = id; previewAsRoleId = null; }
  function audit(re){ return AUDIT_LOG.some(function(a){ return re.test((a.action || '') + ' ' + (a.detail || '')); }); }
  function person(name, roleId){ seq++; var u = { id:'M9B-' + seq, name:name, email:'m9b.' + seq + '@northstartalent.com', assignedRoleId:roleId, reportingManagerId:OWNER, organizationId:CURRENT_ORGANIZATION_ID, userStatus:'Active' }; RECRUITER_ROSTER.push(u); return u; }
  function mkJob(type, client){ seq++; var cl = CLIENTS.find(function(x){ return x.name === (client || 'Fintech Corp'); });
    var j = { id:'m9bj' + seq, title:'Contract Money ' + seq, client:cl.name, clientId:cl.id, loc:'Pune, IN', locations:['Pune, IN'], status:'Active', priority:'Medium', recruiter:'Priya Sharma', recruiterId:null, hiringType:type || 'Contract', contractMonths:6,
      assignedRecruiters:[OWNER], skills:['Java'], positions:3, submitted:0, candidateIds:[], interested:[], recs:[], publishChannels:[], organizationId:CURRENT_ORGANIZATION_ID, salary:'₹10–20 LPA', workMode:'On-site', replacementDays:90,
      submissionRules:{ approvalBeforeClient:false, hideContacts:true, maxProfiles:5, required:[] } }; JOBS.push(j); return j; }
  function mkCand(){ seq++; var c = { id:99900 + seq, name:'Money Worker ' + seq, role:'Engineer', exp:'5 yrs', loc:'Pune, IN', skills:['Java'], email:'m9bc' + seq + '@example.com', phone:'+91 97900 ' + String(10000 + seq), salary:'₹10–12 LPA', notice:'15 Days', organizationId:CURRENT_ORGANIZATION_ID }; CANDIDATES.push(c); return c; }
  var iso = function(ms){ return ptLocalDay(new Date(ms)); };
  // An assignment through the real path: the sourcer adds the candidate, the closer owns the journey at Joined, the form starts it.
  function start(o){ o = o || {}; var j = o.job || mkJob(o.type, o.client), c = mkCand(); actAs(o.sourcer || OWNER); var sb = createSubmission(j.id, c.id, { source:'Sourced', recruiterId:o.sourcer || OWNER, stage:'Shortlisted', reason:'test' }); asOwner();
    if(o.closer && o.closer !== o.sourcer) setJourneyOwner(sb, o.closer, 'Hand-over'); sb.sent = { at:new Date(fmNow() - 90 * D).toISOString(), by:'Test' };
    ptCreateJoinedRecord(c.name, j.title, j.client, j.id, '', { submissionId:sb.id });
    Object.assign(asForm, { start:iso(o.start), end:iso(o.end || fmNow() + 60 * D), unit:o.unit || 'day', payRate:String(o.pay || 2000), markupPct:String(o.markup == null ? 25 : o.markup), billRate:'', tracking:o.tracking || 'days', approverName:'Ravi Menon' });
    asFormSave(); var a = asForJourney(sb); ok(a && a.status === 'Active', 'assignment started'); return { a:a, sb:sb, j:j, c:c }; }
  function week(a, mon, vals){ var r = asSubmitWeek(a, mon, vals || [1,1,1,1,1,0,0]); ok(r.ok, 'week ' + iso(mon) + ': ' + (r.reason || '')); ok(asDecideWeek(r.sheet, true, '', 'Ravi Menon').ok, 'approved'); return r.sheet; }
  function monthOf(ms){ return iso(ms).slice(0, 7); }
  var rec, rec2;

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    state.role = 'admin'; enterApp(); await sleep(100); FM.interactive = false; T0 = FM.offset;
    rec = person('Contract Sourcer', 'role_recruiter'); rec2 = person('Contract Closer', 'role_recruiter');

    await t('one full cycle: across a month boundary, a mid-month rate change, a part payment, commission becoming payable', async function(){
      var now = new Date(fmNow()), wp = wsParts(fmNow()), lm = wp.m === 1 ? [wp.y - 1, 12] : [wp.y, wp.m - 1], first = wsDayStart(wsYmd(lm[0], lm[1], 1)), M = monthOf(first), prev = monthOf(first - D), mid = wsDayStart(wsYmd(lm[0], lm[1], 15));   // workspace days, whatever the browser's zone
      var wA = coMonday(first), wB = coMonday(mid), permBefore = JSON.stringify(ptMoney(ptAllRecords()));
      var x = start({ start:wA - 7 * D, sourcer:rec.id, closer:rec2.id }), a = x.a;
      ok(asChangeRate(a.id, { from:iso(mid), payRate:2200, markupPct:25 }).ok && asRateOn(a, mid).bill === 2750 && asRateOn(a, mid - D).bill === 2500, 'rate from the 15th');
      week(a, wA); week(a, wB);
      // expected: Mon–Fri of both weeks, by calendar month and by the rate in force on each day
      var exp = {}; [wA, wB].forEach(function(w){ for(var i = 0; i < 5; i++){ var d = w + i * D, k = monthOf(d), old = d < mid; exp[k] = exp[k] || { bill:0, pay:0, days:0 }; exp[k].days++; exp[k].bill += old ? 2500 : 2750; exp[k].pay += old ? 2000 : 2200; } });
      ok(exp[prev] && exp[M], 'the first week crosses from ' + prev + ' into ' + M);
      var p1 = asBuildInvoice(a.id, prev), p2 = asBuildInvoice(a.id, M);
      ok(p1.ok && p1.invoice.feeAmount === exp[prev].bill && p1.invoice.lines.reduce(function(s, L){ return s + L.days; }, 0) === exp[prev].days, prev + ': ' + (p1.reason || p1.invoice.feeAmount + ' vs ' + exp[prev].bill));
      var h = p2.invoice; ok(p2.ok && h.feeAmount === exp[M].bill && h.payAmount === exp[M].pay && h.lines.length === 2 && h.lines[0].bill === 2500 && h.lines[1].bill === 2750, M + ': split at the rate change, ' + (p2.reason || h.feeAmount + ' vs ' + exp[M].bill + ' · ' + h.lines.length + ' lines'));
      ok(!asBuildInvoice(a.id, M).ok, 'the same days are never billed twice');
      var cl = clientById(a.clientId), loc = cl.locations.find(function(l){ return l.id === a.locationId; }), rule = clTaxFor(cl, loc, fmNow(), 'contract staffing'), snap = h.invoice.taxSnapshot;
      ok(snap.taxes.map(function(z){ return z.label + z.rate; }).join() === rule.taxes.map(function(z){ return z.label + z.rate; }).join() && snap.tax === Math.round(h.feeAmount * rule.taxes.reduce(function(s, z){ return s + z.rate; }, 0) / 100), 'tax from the client location’s rules: ' + rule.taxes.map(function(z){ return z.label + ' ' + z.rate + '%'; }).join(', '));
      ok(snap.sac === '998513' && snap.withholding && snap.withholding.missing && /contract staffing is not set in the rule pack/.test(snap.withholding.text) && /accountant/.test(snap.withholding.text), 'TDS per supply type: none invented, confirm with an accountant');
      ok(ptRaiseInvoice(h.id) && /^NST-\d\d-\d\d\/\d{4}$/.test(h.invoice.no), 'raised with the M8 numbering: ' + h.invoice.no);
      var total = ptInvoiceTotal(h); ok(ptRecordPayment(h.id, Math.round(total / 3)) && /^Part paid · /.test(ptInvoiceState(h)), 'part paid: ' + ptInvoiceState(h));
      fmSlaSweep(); ok(h.commission && h.commission.state === 'Expected' && h.commission.basis === 'monthly margin', 'not payable while part paid');
      ok(ptRecordPayment(h.id) && ptFullyPaid(h), 'paid in full'); fmSlaSweep(); var k = h.commission;
      ok(k.state === 'Payable' && k.total === Math.round((exp[M].bill - exp[M].pay) * WSX.commission.contractPct / 100), 'payable: ' + k.total + ' = ' + WSX.commission.contractPct + '% of the margin ' + (exp[M].bill - exp[M].pay));
      ok(k.lines.length === 2 && k.lines.find(function(l){ return l.part === 'Sourcer'; }).userId === rec.id && k.lines.find(function(l){ return l.part === 'Closer'; }).userId === rec2.id, 'the same sourcer/closer split');
      ok(ptApproveCommission(h.id) && ptPayCommission(h.id) && k.state === 'Paid', 'approved and paid');
      ok(JSON.stringify(ptMoney(ptAllRecords())) === permBefore, 'permanent placement totals unchanged');
      ok(ptMoney().billed >= ptMoney(ptAllRecords()).billed + h.feeAmount, 'the overall totals include the contract invoice');
    });

    await t('contract invoices use M8 holds and overdue; placement fees keep their TDS', async function(){
      var cl = clientById('c3'), was = clCommercial(cl).poRequired; clAddCommercial(cl, { poRequired:true });
      try {
        var w = coMonday(fmNow()) - 14 * D, x = start({ client:'CloudNova', start:w - 7 * D }); week(x.a, w); var h = asBuildInvoice(x.a.id, monthOf(w)).invoice;
        ok(!ptRaiseInvoice(h.id) && h.invoice.hold === 'Needs PO number', 'held: ' + h.invoice.hold); h.poNumber = 'PO-9'; ok(ptRaiseInvoice(h.id), 'raised once fixed');
        FM.offset = T0 + (ptTerms(h).paymentDays + 3) * D; fmSlaSweep(); ok(ptOverdue(h) && h.invoice.draftReminder, 'overdue, Kairo drafts a reminder');
      } finally { FM.offset = T0; clAddCommercial(cl, { poRequired:!!was }); }
      var fintech = clientById('c1'), fl = clBillingLocations(fintech)[0], fee = clTaxFor(fintech, fl, fmNow());
      ok(fee.withholding && fee.withholding.rate === clPack('IN-TDS').rules.rate && !fee.withholding.missing, 'placement fees: TDS as before (' + fee.withholding.rate + '%)');
    });

    await t('gross pay before deductions: approved time × pay rate per worker per month, with the out-of-scope note', async function(){
      var w = coMonday(fmNow()) - 21 * D, x = start({ start:w - 7 * D, pay:1800 }); week(x.a, w, [1,1,1,0,0,0,0]);
      var month = monthOf(w), csv = asPayrollCsv(month), lines = csv.split('\n');
      ok(/^Gross pay before deductions · /.test(lines[0]) && /PF, ESI, professional tax and TDS on salary are not worked out here/.test(lines[1]) && lines[2] === 'Worker,Client,Assignment,From,To,Quantity,Rate per,Pay rate,Gross pay', 'title and note');
      var row = lines.find(function(l){ return l.indexOf(x.a.workerName) === 0; }), days = [0,1,2].filter(function(i){ return monthOf(w + i * D) === month; }).length;
      ok(row && row.split(',').pop() === String(days * 1800), 'gross ' + (row || '').split(',').pop() + ' = ' + days + ' day(s) × 1800');
      var r = person('Pay Recruiter', 'role_recruiter'); actAs(r.id); ok(asPayrollCsv(month) === null, 'a Recruiter cannot export pay');
      asOwner(); ptTab = 'contracts'; var view = document.createElement('div'); view.innerHTML = ptScreenHTML(); ok(/Gross pay before deductions/.test(view.textContent) && /PF, ESI/.test(view.textContent) && view.textContent.indexOf(x.a.workerName) > -1 && /confirm the TDS rate/i.test(view.textContent), 'the Contracts view in PayTrack');
    });

    await t('convert to permanent: fee from the terms, waived after N months, a normal M8 placement linked both ways; Temporary has no fee unless the terms set one', async function(){
      var x = start({ start:fmNow() - 60 * D }), a = x.a, n = PAYTRACK_JOINED.length, cv = asConvert(a.id, { ctcLakh:18 });
      var r = cv.placement; ok(cv.ok && cv.fee > 0 && r && r.convertedFrom === a.id && a.convertedTo.placementId === r.id && a.status === 'Converted' && PAYTRACK_JOINED.length === n + 1, 'placement, linked both ways, fee ' + cv.fee);
      ok(r.m8 && r.invoice && r.invoice.state === 'Draft' && r.commission && r.replacementDays > 0 && ptWindowEnd(r), 'a normal M8 placement: invoice, commission, replacement window');
      CO.pg = { kind:'time', arg:a.token, draft:{}, result:null }; ok(/can no longer send time|has not started|has ended/.test(coTimePage()) || !asRunning(a), 'the worker link stops');
      var old = start({ start:fmNow() - 300 * D }), w = asConvert(old.a.id, { ctcLakh:18 }); ok(w.ok && w.waived && w.fee === 0 && w.placement.noFee && !w.placement.invoice, 'waived after 9 months');
      var tmp = start({ type:'Temporary', start:fmNow() - 30 * D }), tc = asConvert(tmp.a.id, { ctcLakh:12 }); ok(tc.ok && tc.fee === 0, 'Temporary: no conversion fee by default');
      var cl = clientById(tmp.a.clientId); clAddCommercial(cl, { conversionFeePct:5 });
      try { var tmp2 = start({ type:'Temporary', start:fmNow() - 30 * D }), tc2 = asConvert(tmp2.a.id, { ctcLakh:12 }); ok(tc2.ok && tc2.fee === 60000, 'Temporary with terms that set 5%: ₹60,000'); }
      finally { clAddCommercial(cl, { conversionFeePct:null }); }
    });

    await t('a company workspace: contract invoices as before', async function(){
      ORG_STRUCTURE.profile.orgType = 'Corporate'; coSeedCorp(true); asOwner();
      var wo = coWoCreate({ contractor:'Corp Money', email:'corp.money@x.example', role:'Data Analyst', approver:'Suresh Iyer', start:coIso(coNow() - 30 * D), end:coIso(coNow() + 30 * D), rate:1000, unit:'hour', sow:'Analysis' }).wo;
      var sh = coSheetSubmit(wo.id, coMonday(coNow()) - 7 * D, [8,8,8,8,8,0,0]).sheet; coSheetDecide(sh.id, true, '', 'Suresh Iyer');
      var inv = coInvoiceBuild(wo.id, coIso(coNow() - 30 * D), coIso(coNow())).invoice; ok(inv && inv.subtotal === 40000 && inv.gst === 7200 && inv.no === (coT('invoicePrefix', 'INV-') || 'INV-') + String(CO.invoices.length).padStart(4, '0'), 'flat 18% and the corporate numbering as before: ' + (inv && inv.no));
      ok(!asInvoiceHolders().some(function(h){ return h.asId === wo.id; }), 'separate from agency assignments');
    });

    var pre = document.createElement('pre'); pre.id = 'auth-test-results'; pre.textContent = JSON.stringify(results); document.body.appendChild(pre);
    document.title = 'M09B ' + results.filter(function(r){ return r.pass; }).length + '/' + results.length;
  }, 800); });
})();
