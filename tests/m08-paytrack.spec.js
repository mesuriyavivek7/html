/* M8 · PayTrack end to end (B9, B10, B13, B16 · flow map 15; decisions C2, C3, C4), agency workspaces.
   Joined → invoice drafted with a frozen tax snapshot → raised by an Accounts-type role → part paid → paid → window passes →
   commission payable → approved → paid (30/70, or 100% to one person). Holds, after-window invoicing, leaving in the window
   (free replacement or credit note), permissions and C2, one set of totals, invoice and credit-note numbers, one clock,
   part payments, legacy placements, and a company workspace left alone.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\m08-paytrack.spec.js */
(function(){
  var results = [];
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  var ce = console.error; console.error = function(){ errs.push('console.error ' + Array.prototype.slice.call(arguments).map(function(a){ return (a && a.stack) || (a && a.message) || String(a); }).join(' ').slice(0, 300)); };
  var toasts = [], t0 = window.toast; window.toast = function(m){ toasts.push(String(m)); return t0.apply(this, arguments); };
  var T0 = 0, D = 86400000, OWNER = 'RP-088', seq = 0;
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e.stack || e.message).slice(0, 500) }); }
    finally { asOwner(); ORG_STRUCTURE.profile.orgType = 'Agency'; FM.offset = T0; WSX.commission.showRecruiters = false; if(typeof closePayTrackDrawer === 'function') closePayTrackDrawer(); if(typeof pdClose === 'function') pdClose(); } }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function asOwner(){ viewingAsFromManager = false; managerViewAsRecruiterId = null; previewAsRoleId = null; state.role = 'admin'; }
  function actAs(id){ if(id === OWNER) return asOwner(); state.role = 'manager'; viewingAsFromManager = true; managerViewAsRecruiterId = id; previewAsRoleId = null; }
  function audit(re){ return AUDIT_LOG.some(function(a){ return re.test((a.action || '') + ' ' + (a.detail || '')); }); }
  function role(id, name, perms){ var r = { id:id, name:name, __v2:true, permissions:{}, scope:{ jobs:'all', journeys:'all', talentpool:'all', candidates:'all', clients:'all', interviews:'all', approvals:'all', reports:'all' }, approves:{} };
    PERMISSION_MODULES.forEach(function(m){ r.permissions[m.id] = []; }); Object.keys(perms).forEach(function(k){ r.permissions[k] = perms[k].slice(); }); CUSTOM_ROLES.push(r); return r; }
  function person(name, roleId){ seq++; var u = { id:'M8-' + seq, name:name, email:'m8.' + seq + '@northstartalent.com', assignedRoleId:roleId, reportingManagerId:OWNER, organizationId:CURRENT_ORGANIZATION_ID, userStatus:'Active' }; RECRUITER_ROSTER.push(u); return u; }
  function mkJob(client){ seq++; var cl = CLIENTS.find(function(x){ return x.name === client; }) || CLIENTS[0];
    var j = { id:'m8j' + seq, title:'Pay Role ' + seq, client:cl.name, clientId:cl.id, loc:'Pune, IN', locations:['Pune, IN'], status:'Active', priority:'Medium', recruiter:'Priya Sharma', recruiterId:null,
      assignedRecruiters:[OWNER], skills:['Java'], positions:2, submitted:0, candidateIds:[], interested:[], recs:[], publishChannels:[], organizationId:CURRENT_ORGANIZATION_ID, salary:'₹10–40 LPA', workMode:'Hybrid', replacementDays:90,
      submissionRules:{ approvalBeforeClient:false, hideContacts:true, maxProfiles:5, required:[] } }; JOBS.push(j); return j; }
  function mkCand(){ seq++; var c = { id:99700 + seq, name:'Placed Person ' + seq, role:'Engineer', exp:'5 yrs', loc:'Pune, IN', skills:['Java'], email:'m8c' + seq + '@example.com', phone:'+91 97700 ' + String(10000 + seq), salary:'₹18–22 LPA', notice:'30 Days', organizationId:CURRENT_ORGANIZATION_ID }; CANDIDATES.push(c); return c; }
  // A placement made the real way: journey (sourcer, then closer), accepted offer, joining.
  function place(job, sourcer, closer){
    var c = mkCand(); actAs(sourcer); var sb = createSubmission(job.id, c.id, { source:'Sourced', recruiterId:sourcer, stage:'Ready to Send', reason:'test' }); asOwner();   // the sourcer adds them (M8 follow-up)
    if(closer !== sourcer) setJourneyOwner(sb, closer, 'Hand-over for the test');
    return join(job, c, sb);
  }
  function join(job, c, sb){
    asOwner(); sb.sent = { at:new Date(fmNow() - 20 * D).toISOString(), by:'Test' }; moveSubmissionStage(sb.id, 'Shortlisted', 'test');
    var o = sb.offer ? { ok:true } : recordOffer(sb.id, { ctc:20, doj:ptLocalDay(new Date(fmNow())) }); ok(o.ok, 'offer ' + (o.reason || ''));   // local day, as the product records dates (UTC broke this between 00:00 and 05:30 IST)
    if(o.pending && o.approval){ decideApproval(o.approval.id, 'Approved'); }
    offerSetStatus(sb, 'Accepted', '', 'Offer accepted'); moveSubmissionStage(sb.id, 'Offer Accepted', 'accepted');
    var r = ptCreateJoinedRecord(c.name, job.title, job.client, job.id, ptFmtDate(ptToday()), { submissionId:sb.id, joinedIso:ptLocalDay(new Date(fmNow())) });
    ok(r && r.m8, 'placement created'); return r;
  }
  function past(r, days){ FM.offset = T0 + ((r.replacementDays || 90) + (days || 1)) * D; fmSlaSweep(); }
  function html(h){ var d = document.createElement('div'); d.innerHTML = h; return d.textContent; }
  var ACC, acc, rec, rec2;

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    state.role = 'admin'; enterApp(); await sleep(100); FM.interactive = false; T0 = FM.offset;
    ACC = role('role_m8_acc', 'Accounts', { billing:['View','Raise invoice','Record payment','Approve credit','Pay commission'] }); acc = person('Accounts Person', ACC.id);
    rec = person('Sourcing Recruiter', 'role_recruiter'); rec2 = person('Closing Recruiter', 'role_recruiter');

    await t('joined → draft with a tax snapshot → raised by an Accounts role → part paid → paid → window passes → commission payable → approved → paid, 30/70', async function(){
      var j = mkJob('Fintech Corp'), r = place(j, rec.id, rec2.id), i = r.invoice;
      ok(i && i.state === 'Draft' && !i.no && i.taxSnapshot.total > i.taxSnapshot.fee && r.taxSnapshot && audit(/Invoice drafted/), 'drafted at joining with a frozen snapshot');
      ok(effectiveRoleId() !== ACC.id, 'not yet acting as Accounts'); actAs(acc.id); ok(effectiveRoleId() === ACC.id, 'Accounts role');
      ok(ptRaiseInvoice(r.id) && /^NST-\d\d-\d\d\/\d{4}$/.test(i.no) && i.sentTo.length && audit(/Invoice raised .+by Accounts Person/), 'raised by Accounts: ' + i.no);
      ok(ptRecordPayment(r.id, Math.round(i.taxSnapshot.total / 2)) && /^Part paid · ₹/.test(ptInvoiceState(r)), 'part paid: ' + ptInvoiceState(r));
      ok(ptRecordPayment(r.id) && ptInvoiceState(r) === 'Paid' && r.paymentStatus === 'Received', 'paid');
      fmSlaSweep(); ok(r.commission.state === 'Expected', 'window not passed: still expected');
      past(r); ok(r.commission.state === 'Payable' && PAYTRACK_COMPLETED.indexOf(r) > -1, 'window passed: payable, placement secured');
      ok(ptApproveCommission(r.id) && r.commission.state === 'Approved' && ptPayCommission(r.id) && r.commission.state === 'Paid', 'approved, paid');
      var k = r.commission, s = k.lines.find(function(l){ return l.part === 'Sourcer'; }), c = k.lines.find(function(l){ return l.part === 'Closer'; });
      ok(k.total === Math.round(clRecFee(r) * 0.10) && s.userId === rec.id && c.userId === rec2.id && s.share === 30 && c.share === 70 && s.amount + c.amount === k.total && s.amount === Math.round(k.total * 0.3), 'split 30/70: ' + JSON.stringify(k.lines.map(function(l){ return [l.name, l.amount]; })));
      ok(audit(/Commission paid/), 'audited');
    });

    await t('sourcer and closer the same person: 100%', async function(){
      var r = place(mkJob('Fintech Corp'), rec.id, rec.id); ok(r.commission.lines.length === 1 && r.commission.lines[0].share === 100 && r.commission.lines[0].amount === r.commission.total && r.commission.lines[0].userId === rec.id, '100%');
    });

    await t('a held invoice shows its reason and cannot be raised until fixed', async function(){
      var r = place(mkJob('Fintech Corp'), rec.id, rec.id); r.poRequired = true;
      ok(!ptRaiseInvoice(r.id) && !r.invoice.no && r.invoice.hold === 'Needs PO number' && ptInvoiceState(r) === 'On hold · Needs PO number' && audit(/Invoice held .+Needs PO number/), 'held: ' + ptInvoiceState(r));
      ptTab = 'invoices'; ok(/On hold · Needs PO number/.test(html(ptScreenHTML())), 'shown on the Invoices tab');
      r.poNumber = 'PO-881'; ok(ptRaiseInvoice(r.id) && r.invoice.no, 'raised once fixed');
    });

    await t('"after the window" terms create no invoice until the window passes', async function(){
      var c = clientById('c3'), was = clCommercial(c).invoiceTiming || 'joining'; clAddCommercial(c, { invoiceTiming:'after-window' });
      try {
        var r = place(mkJob(c.name), rec.id, rec.id); ok(!r.invoice && ptInvoiceState(r) === 'Invoiced after the window', 'no invoice at joining');
        FM.offset = T0 + 30 * D; fmSlaSweep(); ok(!r.invoice, 'not inside the window'); past(r); ok(r.invoice && r.invoice.state === 'Draft' && audit(/Invoice drafted/), 'drafted after the window');
      } finally { FM.offset = T0; clAddCommercial(c, { invoiceTiming:was }); }
    });

    await t('left in the window with Free replacement: linked replacement job, no fee, commission cancelled; the journey and job page show it', async function(){
      var j = mkJob('Fintech Corp'), r = place(j, rec.id, rec2.id), sb = subById(r.submissionId), at = new Date(fmNow() + 10 * D).toISOString().slice(0, 10);
      var res = ptRecordLeft(r.id, at, 'Resigned for a counter-offer'); ok(res.ok && res.inWindow, 'recorded in the window');
      var nj = JOBS.find(function(x){ return x.replacementOf === j.id; }); ok(nj && nj.noFee && nj.client === j.client && nj.termsVersion === (j.termsVersion || r.termsVersion || null) && (j.replacementJobs || []).indexOf(nj.id) > -1, 'linked replacement job');
      ok(r.commission.state === 'Cancelled' && /Left inside the replacement window/.test(r.commission.reason) && ptPlacementLabel(r) === 'Left in window · replacement open', 'commission cancelled, label');
      ok(sb.stage === 'Withdrawn' && sb.left && /^Left on .+ · Resigned for a counter-offer$/.test(ptLeftLine(sb.left)), 'journey: ' + sb.stage);
      openPipelineDetail(sb.id); await sleep(10); ok(/Left on .+ · Resigned for a counter-offer/.test((document.getElementById('pd-left-line') || {}).textContent || ''), 'the journey shows it'); pdClose();
      ok(/Resigned for a counter-offer/.test(html(jobPipelineHealthStripHTML(j))) && /Replacement job opened/.test(html(jobPipelineHealthStripHTML(j))) && /Free replacement for/.test(html(jobPipelineHealthStripHTML(nj))), 'flagged on both jobs');
      var r2 = place(nj, rec2.id, rec2.id); ok(r2.noFee && r2.placementFee === 0 && !r2.invoice && !(r2.commission && r2.commission.total), 'filling the replacement: no new fee');
      var r3 = place(mkJob('Fintech Corp'), rec.id, rec.id); past(r3); var j3 = jobById(r3.jobId), before = JOBS.length;
      var late = ptRecordLeft(r3.id, new Date(fmNow()).toISOString().slice(0, 10), 'Moved abroad'); ok(late.ok && !late.inWindow && JOBS.length === before && r3.commission.state !== 'Cancelled' && subById(r3.submissionId).stage === 'Joined' && /Moved abroad/.test(html(jobPipelineHealthStripHTML(j3))), 'after the window: recorded only');
    });

    await t('left in the window with Credit: approval request, then a credit note against the invoice', async function(){
      var c = clientById('c4'), was = clCommercial(c).leavePolicy || 'replacement'; clAddCommercial(c, { leavePolicy:'credit' });
      try {
        var r = place(mkJob(c.name), rec.id, rec.id); ok(ptRaiseInvoice(r.id), 'raised');
        ptRecordLeft(r.id, new Date(fmNow() + 5 * D).toISOString().slice(0, 10), 'Did not clear probation');
        var req = APPROVAL_REQUESTS.find(function(x){ return x.entityType === 'CreditNote' && x.entityId === r.id; }); ok(req && req.status === 'Pending' && r.credit.state === 'Requested' && !JOBS.some(function(x){ return x.replacementOf === r.jobId; }), 'approval requested, no replacement');
        var admin = person('Admin Person', 'role_admin'); actAs(admin.id); decideApproval(req.id, 'Approved'); ok(req.status === 'Pending', 'Admin cannot approve credit');
        actAs(acc.id); decideApproval(req.id, 'Approved'); asOwner();
        var cn = r.invoice.credits[0]; ok(req.status === 'Approved' && cn && /^CN-NST-\d\d-\d\d\/\d{4}$/.test(cn.no) && cn.against === r.invoice.no && ptAmountDue(r) === 0 && audit(/Credit note issued/), 'credit note ' + (cn && cn.no) + ' against ' + r.invoice.no);
      } finally { clAddCommercial(c, { leavePolicy:was }); }
    });

    await t('a Recruiter cannot raise, record or see amounts; with C2 on they see only their own commission', async function(){
      var r = place(mkJob('Fintech Corp'), rec.id, rec2.id); actAs(rec.id);
      ok(!ptRaiseInvoice(r.id) && !r.invoice.no, 'cannot raise'); asOwner(); ptRaiseInvoice(r.id); actAs(rec.id); ok(!ptRecordPayment(r.id) && !ptPaidSum(r), 'cannot record');
      ok(!navAllowedForMe('admin-paytrack') && !/₹/.test(html(renderPayTrack())), 'no money screens, no amounts');
      WSX.commission.showRecruiters = true; var mine = html(renderPayTrack()), own = r.commission.lines.find(function(l){ return l.userId === rec.id; }), other = r.commission.lines.find(function(l){ return l.userId === rec2.id; });
      ok(mine.indexOf(ptRupees(own.amount)) > -1 && mine.indexOf(ptRupees(other.amount)) === -1 && /My commission/.test(mine), 'only their own: ' + ptRupees(own.amount));
    });

    await t('Billing, Revenue, Home cards and the client Billing tab show the same totals as PayTrack', async function(){
      var m = ptMoney(); showView('admin-paytrack'); var pt = document.getElementById('pt8-summary').textContent;
      ok(pt.indexOf(clShort(m.billed)) > -1 && pt.indexOf(clShort(m.outstanding)) > -1, 'PayTrack: ' + pt);
      showView('payroll-billing'); ok(state.activeNav === 'admin-paytrack' && document.getElementById('pt8-summary'), 'Billing opens PayTrack');
      showView('admin-revenue'); var rv = document.getElementById('main-content').textContent; ok(rv.indexOf(clShort(m.billed)) > -1 && rv.indexOf(clShort(m.collected)) > -1 && rv.indexOf(clShort(m.overdue)) > -1, 'Revenue');
      var h = odMoney(); ok(Math.round(h.toCollect * 100000) === m.outstanding && Math.round(h.earned * 100000) === m.earned, 'Home cards');
      var c1 = clientById('c1'), cm = clientMoney('c1'), own = ptMoney(clPayRecords(c1).filter(function(r){ var d = clRecDate(r); return !(d && d < CL_FY_START); }));
      ok(cm.billed === own.billed && cm.outstanding === own.outstanding && cm.collected === own.collected, 'client Billing tab');
      var all = CLIENTS.filter(clientVisibleTo).reduce(function(s, c){ return s + clientMoney(c.id).billed; }, 0); ok(all <= m.billed && all > 0, 'clients add up within PayTrack');
    });

    await t('a company workspace: nothing changes', async function(){
      ORG_STRUCTURE.profile.orgType = 'Corporate'; asOwner(); renderSidebar();
      ok(![].some.call(document.querySelectorAll('#sidebar-nav .nav-item'), function(b){ return /paytrack|payroll-billing/.test(b.getAttribute('data-nav') || ''); }), 'no PayTrack or Billing');
      ok(/MONTHLY REVENUE/.test(RENDERERS['admin-revenue']()), 'Revenue as before');
      var n = ptAllRecords().length, a = AUDIT_LOG.length; ptSweep(); ok(ptAllRecords().length === n && !AUDIT_LOG.slice(a).some(function(x){ return x.module === 'PayTrack'; }), 'the sweep does nothing');
      var j = mkJob('Fintech Corp'), c = mkCand(), sb = createSubmission(j.id, c.id, { source:'Sourced', recruiterId:OWNER, stage:'Shortlisted', reason:'test' });
      var r = ptCreateJoinedRecord(c.name, j.title, j.client, j.id, ptFmtDate(ptToday()), { submissionId:sb.id }); ok(!r || (!r.m8 && !r.invoice && !(r.commission && !r.commission.legacy)), 'no invoice or commission');
    });

    await t('invoice numbers: sequential per agency and year, never reused; credit notes have their own series and point to the invoice', async function(){
      var a = place(mkJob('Fintech Corp'), rec.id, rec.id), b = place(mkJob('Fintech Corp'), rec.id, rec.id), fy = ptFy(ptToday());
      ptRaiseInvoice(a.id); var na = Number(a.invoice.no.split('/').pop());
      ok(a.invoice.no.indexOf(ptPrefix() + '-' + fy + '/') === 0, 'prefix and year: ' + a.invoice.no);
      ptRequestCredit(a, 'Fee dispute settled'); var rq = APPROVAL_REQUESTS.find(function(x){ return x.entityType === 'CreditNote' && x.entityId === a.id; }); decideApproval(rq.id, 'Approved');
      ok(ptInvoiceState(a) === 'Credited' && a.invoice.credits[0].against === a.invoice.no && /^CN-/.test(a.invoice.credits[0].no), 'credited in full, credit note points to it');
      ptRaiseInvoice(b.id); ok(Number(b.invoice.no.split('/').pop()) === na + 1 && b.invoice.no !== a.invoice.no, 'next number, the credited one is never reused: ' + b.invoice.no);
      var seen = {}; ptAllRecords().forEach(function(r){ if(r.invoice && r.invoice.no){ ok(!seen[r.invoice.no], 'unique ' + r.invoice.no); seen[r.invoice.no] = 1; } });
    });

    await t('one clock: windows, overdue and commission move with the app clock; seeded dates stay readable and keep their age', async function(){
      ok(ptToday().toDateString() === new Date(fmNow()).toDateString(), 'PayTrack today is the app clock');
      var sneha = ptById(4), vikram = ptById(5); ok(/^[A-Z][a-z]{2} \d{1,2}$/.test(sneha.doj) && sneha.dojIso, 'readable: ' + sneha.doj);
      ok(ptReplacementInfo(sneha).remaining === 33 && ptReplacementInfo(vikram).remaining === 7, 'same ages as when seeded: ' + ptReplacementInfo(sneha).remaining + ', ' + ptReplacementInfo(vikram).remaining);
      FM.offset = T0 + 10 * D; ok(ptReplacementInfo(sneha).remaining === 23, 'moves with the clock');
      FM.offset = T0; var r = place(mkJob('Fintech Corp'), rec.id, rec.id); ptRaiseInvoice(r.id); ok(!ptOverdue(r), 'not overdue yet');
      FM.offset = T0 + (ptTerms(r).paymentDays + 2) * D; fmSlaSweep(); ok(ptOverdue(r) && r.invoice.draftReminder && audit(/Overdue reminder drafted by Kairo/), 'overdue on the same clock; Kairo drafted a reminder');
      ok(r.invoice.reminders.length === 0, 'a person sends it'); ok(ptSendReminder(r.id) && r.invoice.reminders.length === 1 && !r.invoice.draftReminder, 'sent by a person');
    });

    await t('part payments: commission payable only when paid in full (credit included) and the window has passed; "Part paid · ₹x of ₹y" on Collections and the client Billing tab', async function(){
      var r = place(mkJob('Fintech Corp'), rec.id, rec2.id); ptRaiseInvoice(r.id); var total = ptInvoiceTotal(r), half = Math.round(total / 2);
      ptRecordPayment(r.id, half); var label = 'Part paid · ' + ptRupees(half) + ' of ' + ptRupees(total);
      ptTab = 'collections'; ok(html(ptScreenHTML()).indexOf(label) > -1, 'Collections: ' + label);
      clientDetailState = clientDetailState || {}; ok(html(clBillingTab(clientById('c1'))).indexOf(label) > -1, 'client Billing tab');
      past(r); ok(r.commission.state === 'Expected', 'window passed but part paid: not payable');
      ptRequestCredit(r, 'Agreed discount'); decideApproval(APPROVAL_REQUESTS.find(function(x){ return x.entityType === 'CreditNote' && x.entityId === r.id; }).id, 'Approved');
      ok(ptFullyPaid(r), 'paid in full with the credit'); fmSlaSweep(); ok(r.commission.state === 'Payable', 'payable once paid in full (credit included)');
    });

    await t('the fee comes from the terms in force when the offer was recorded, shown on the offer and frozen on the placement', async function(){
      var cl = clientById('c1'), prev = Object.assign({}, clCommercial(cl)), j = mkJob(cl.name), c = mkCand(); actAs(rec.id); var sb = createSubmission(j.id, c.id, { source:'Sourced', recruiterId:rec.id, stage:'Shortlisted', reason:'test' }); asOwner();
      sb.sent = { at:new Date(fmNow() - 20 * D).toISOString(), by:'Test' }; var o = recordOffer(sb.id, { ctc:20, doj:ptLocalDay(new Date(fmNow())) }); if(o.pending && o.approval) decideApproval(o.approval.id, 'Approved');
      var fee = sb.offer.fee, v1 = fee.termsVersion; ok(fee && fee.amount > 0 && v1 && fee.recordedAt && audit(new RegExp('Offer recorded .+fee ' + fee.amount + ' from terms v' + v1)), 'the offer carries fee and version');
      openPipelineDetail(sb.id); await sleep(10); ok(new RegExp('Offer fee .+ · terms v' + v1).test((document.getElementById('pd-offer-fee') || {}).textContent || ''), 'shown on the offer'); pdClose();
      try {
        clAddCommercial(cl, { feeBasis:'pct', feeType:'percent', pct:(fee.amount / 2000000 * 100 > 15 ? 5 : 25), slabs:null }); var v2 = clCommercial(cl).version; ok(v2 !== v1, 'terms changed to v' + v2);
        var r = join(j, c, sb); ok(r.feeAmount === fee.amount && r.termsVersion === v1 && r.feeFromOffer && r.invoice.taxSnapshot.fee === fee.amount, 'frozen from the offer: ' + r.feeAmount + ' v' + r.termsVersion);
        payTrackDrawerKey = null; ok(html(payTrackDrawerHTML((PAYTRACK_JOINED.indexOf(r) > -1 ? 'joined-' : 'completed-') + r.id)).indexOf('Fee from terms v' + v1 + ' (in force when the offer was recorded)') > -1, 'the drawer says where the fee came from');
      } finally { var back = Object.assign({}, prev); delete back.version; delete back.effectiveFrom; clAddCommercial(cl, back); }
    });

    await t('the sourcer is the first person who acted on the journey, not the first owner; set once, audited', async function(){
      var j = mkJob('Fintech Corp'), c = mkCand(), A = person('Slow Owner', 'role_recruiter'), B = person('Opening Recruiter', 'role_recruiter'), C = person('Closing Owner', 'role_recruiter');
      asOwner(); var sb = createSubmission(j.id, c.id, { source:'Naukri', recruiterId:A.id, stage:'Applied Directly', reason:'Applied via Naukri' }); ok(!sb.sourcedBy, 'an applicant nobody has acted on has no sourcer');
      setJourneyOwner(sb, B.id, 'Not opened within the 24-hour SLA', 'SLA: next recruiter');
      actAs(B.id); openPipelineDetail(sb.id); await sleep(5); pdClose(); ok(sb.sourcedBy && sb.sourcedBy.id === B.id && sb.sourcedBy.how === 'opened', 'B opened it first: ' + JSON.stringify(sb.sourcedBy));
      setJourneyOwner(sb, C.id, 'Hand-over'); actAs(C.id); openPipelineDetail(sb.id); await sleep(5); pdClose(); ok(sb.sourcedBy.id === B.id, 'set once');
      ok(AUDIT_LOG.filter(function(a){ return a.action === 'Sourced by' && (a.detail || '').indexOf(c.name) === 0; }).length === 1, 'audited once');
      var r = join(j, c, sb), lines = r.commission.lines; ok(lines.length === 2 && lines.find(function(l){ return l.part === 'Sourcer'; }).userId === B.id && lines.find(function(l){ return l.part === 'Closer'; }).userId === C.id && !lines.some(function(l){ return l.userId === A.id; }), 'commission: B sourcer, C closer, never A');
    });

    await t('a legacy placement keeps its amount and label', async function(){
      var a = ptById(6); ok(a && a.commission.legacy && a.commission.amount === 26000 && /₹26,000 · Recorded before commission rules/.test(ptCommissionText(a)), ptCommissionText(a));
      FM.offset = T0 + 400 * D; fmSlaSweep(); ok(a.commission.amount === 26000 && a.commission.legacy && a.revenueEarned === 2.6, 'unchanged after sweeps');
      ok(ptMoney().commission.recorded >= 26000, 'counted in totals');
      ptTab = 'commission'; ok(/Recorded before commission rules/.test(html(ptScreenHTML())), 'labelled on the Commission tab');
    });

    var pre = document.createElement('pre'); pre.id = 'auth-test-results'; pre.textContent = JSON.stringify(results); document.body.appendChild(pre);
    document.title = 'M08 ' + results.filter(function(r){ return r.pass; }).length + '/' + results.length;
  }, 800); });
})();
