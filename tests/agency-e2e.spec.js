/* M12 · Agency end to end (flow map 01–17): the whole journey for each of the four agency shapes, on the real functions.
   Small: Owner → Recruiters · Classic: Owner → RM → Recruiters · Larger: Owner → Admin → RM → Recruiters · Mixed: one recruiter
   under an RM, one directly under the Owner. Each: sign-up with its team size → setup → invites with Reports to → client with
   terms → job → applicant by a personal link and by the sharing rule → screen → consent Yes → submit → review (if on) → send →
   the client books from the review link → two interview rounds (a hold with a check-back in round 1) → offer (fee from that
   terms version) → accepted → pre-joining → joined → invoice raised by an Accounts role → part paid → paid → window passes →
   commission payable → approved → paid. Every handover, permission, audit line and number on the way is checked.
   Once, on the Classic shape: a hire who leaves in the window (free replacement), a contract hire through one monthly
   invoice, a consent No, and a same-job duplicate with an override.
   Notes: sign-up runs the same functions the sign-up wizard calls when it enters the product (the wizard's screens are
   covered by auth-flow); an invite is accepted by marking the person Active (the accept screens are covered by auth-flow);
   a client is created from a copy of a seeded record, then given its terms through the real terms writer.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\agency-e2e.spec.js */
(function(){
  var results = [];
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  var ce = console.error; console.error = function(){ errs.push('console.error ' + Array.prototype.slice.call(arguments).map(function(a){ return (a && a.stack) || (a && a.message) || String(a); }).join(' ').slice(0, 300)); };
  var toasts = [], t0 = window.toast; window.toast = function(m){ toasts.push(String(m)); return t0.apply(this, arguments); };
  var D = 86400000, OWNER = 'RP-088', seq = 0, T0 = 0;
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e.stack || e.message).slice(0, 600) }); }
    finally { asOwner(); ORG_STRUCTURE.profile.orgType = 'Agency'; if(typeof csClose === 'function') try { csClose(); } catch(e){} if(typeof pdClose === 'function') try { pdClose(); } catch(e){} CO.pg = null; SL.token = null; } }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function asOwner(){ viewingAsFromManager = false; managerViewAsRecruiterId = null; previewAsRoleId = null; state.role = 'admin'; }
  function actAs(id){ if(id === OWNER) return asOwner(); state.role = 'manager'; viewingAsFromManager = true; managerViewAsRecruiterId = id; previewAsRoleId = null; }
  function audit(re, from){ return AUDIT_LOG.slice(0, from == null ? AUDIT_LOG.length : AUDIT_LOG.length - from).some(function(a){ return re.test((a.action || '') + ' ' + (a.detail || '')); }); }
  function lastReason(sb){ return ((sb.ownerHistory || []).slice(-1)[0] || {}).reason || ''; }
  function reviewOf(sb){ return APPROVAL_REQUESTS.find(function(r){ return r.entityType === 'SubmissionReview' && r.entityId === sb.id && r.status === 'Pending'; }) || null; }
  function tap(sb, yes){ CO.pg = { kind:'consent', arg:sb.consent.token }; var r = coConsentDo(yes); CO.pg = null; return r; }
  function iso(ms){ return ptLocalDay(new Date(ms)); }

  /* ---- 01 · sign-up: the functions the wizard calls when it enters the product ---- */
  function signUp(company, teamSize){
    var a0 = AUDIT_LOG.length; ob.companyName = company;
    suApplySetup({ type:'Staffing agency', team:[], teamSkipped:true }); ORG_STRUCTURE.profile.teamSize = teamSize; applyTeamSizeDefaults(teamSize, 'Staffing agency');
    ok(CUSTOM_ROLES.map(function(r){ return r.name; }).join() === 'Owner,Recruiter Manager,Recruiter' && CUSTOM_ROLES[0].protected, company + ': seeded Owner (locked), Recruiter Manager, Recruiter');
    ok(roleHasPermission('role_recruiter', 'candidates', 'Submit to job') && roleHasPermission('role_recmgr', 'candidates', 'Submit to job'), company + ': the seeded roles can submit');
    var small = teamSize === '1–5'; ok(WSX.hiring.preApproval === !small && workspaceRouting() === (small ? 'manual' : 'round_robin'), company + ': starting rules from team size ' + teamSize);
    ok(audit(/Default roles seeded for org type/, a0) && audit(new RegExp('Starting rules set from team size ' + teamSize), a0), company + ': audited');
    var w = wsSetupStart('Staffing agency', 'owner.' + (++seq) + '@' + company.toLowerCase().replace(/\W+/g, '') + '.example', null, teamSize, { country:'IN', city:'' }); ok(w, company + ': setup checklist started');
    var box = document.createElement('div'); box.innerHTML = wsDefaultsHTML(); ok(new RegExp('Submission review' + (small ? 'Off for new jobs' : 'On for the Recruiter role')).test(box.textContent), company + ': defaults shown');
  }
  /* ---- 03 · invite with Reports to, through the Team members form ---- */
  function invite(name, roleId, managerId){
    seq++; var email = 'e2e.' + seq + '@northstartalent.com', a0 = AUDIT_LOG.length; asOwner();
    tmOpenInvite(); Object.assign(tmModal.form, { name:name, email:email, roleId:roleId, managerId:managerId || '', loc:'Pune', phone:'98' + String(10000000 + seq) }); tmSubmit();
    var u = RECRUITER_ROSTER.find(function(x){ return x.email === email; }); ok(u, name + ': invited (' + JSON.stringify(tmModal && tmModal.errors) + ')');
    ok(u.userStatus === 'Invited' && (tmManagerIdOf(u) || null) === (managerId || null), name + ': Invited, reports to ' + managerId);
    ok(AUDIT_LOG.slice(0, AUDIT_LOG.length - a0).some(function(a){ return a.module === 'User Management' && (a.detail || '').indexOf(name) > -1; }), name + ': invite audited');
    u.userStatus = 'Active'; return u;   // accepted (the accept screens are covered by auth-flow)
  }
  function fromTemplate(key, name){ asOwner(); openSettings('roles'); sStartRoleDraft(key); sRoleDraft.name = name; var r = sSaveRoleDraft(); ok(r, name + ': role saved from the ' + key + ' template'); return r; }
  /* ---- 06 · client with terms (versioned) ---- */
  function newClient(name){
    var c = JSON.parse(JSON.stringify(clientById('c1'))); seq++; c.id = 'e2e-c' + seq; c.name = name; c.legalName = name + ' Pvt. Ltd.'; c.ownerId = OWNER; c.commercials = []; c.activity = [];
    CLIENTS.push(c); clientEnsure(c);
    var v = clAddCommercial(c, { feeBasis:'pct', feeType:'percent', pct:10, slabs:null, replacementDays:90, paymentDays:30, invoiceTiming:'joining', leavePolicy:'replacement' });
    ok(v && v.version >= 1 && clCommercial(c).version === v.version, name + ': terms v' + v.version); return { c:c, v:v };
  }
  /* ---- 07 · job, published by the Owner, with two interview rounds and its team ---- */
  function newJob(cl, team, lead){
    asOwner(); seq++;
    jobDraft = Object.assign(jobCreateDefaults(), { title:'E2E Engineer ' + seq, client:cl.name, locations:['Pune, MH – IN'], roleSummary:new Array(30).join('Builds and runs services. '),
      responsibilities:new Array(25).join('Own delivery end to end. '), requiredSkills:['Java'], channels:{ career:true, linkedin:true, naukri:false, shine:false, internal:true, publicLink:true } });
    var n = JOBS.length; publishJob(); ok(JOBS.length === n + 1, 'job published: ' + toasts.slice(-1)[0]); var j = JOBS[JOBS.length - 1];
    j.clientId = cl.id; j.interviewWorkflow = ['Technical interview', 'Final interview', 'Offer', 'Joining']; j.submissionRules.required = [];
    team.forEach(function(u){ if((j.assignedRecruiters || []).indexOf(u.id) < 0) ok(assignRecruiterToJob(j.id, u.id).ok, 'assigned ' + u.name); });
    j.jobLeadId = lead.id; ok(j.status === 'Active' && audit(/Recruiter assigned to job/), j.title + ': live, team assigned, audited');
    return j;
  }
  function applicant(j, extra){ seq++; var p = Object.assign({ name:'E2E Applicant ' + seq, email:'e2e.app' + seq + '@example.com', phone:'+91 93000 ' + String(10000 + seq), role:'Engineer', skills:['Java'], notice:'30 Days', loc:'Pune' }, extra || {});
    var r = ingestApplicationEvent(j.id, p, { platform:'Careers Page' }); ok(r.ok && r.submission, 'applied: ' + JSON.stringify(r).slice(0, 160)); return r.submission; }

  /* The whole journey for one shape. who: { owner, recruiter (link), reviewer (or null), acc (Accounts person), team } */
  async function journey(label, cl, j, who){
    var money0 = ptMoney(), f0 = flowFunnel(SUBMISSIONS).map(function(r){ return r.n; }), q0 = computeRecruiterQualityFunnel(who.recruiter.name);
    // applicant by a personal link, and by the sharing rule
    var sb = applicant(j, { utm_content:who.recruiter.id.toLowerCase() }); ok(sb.recruiterId === who.recruiter.id && lastReason(sb) === 'Personal link', label + ': personal link → ' + who.recruiter.name);
    var other = applicant(j), rule = jobRoutingOf(j); ok(other.recruiterId && (rule === 'manual' ? other.recruiterId === j.jobLeadId : j.assignedRecruiters.indexOf(other.recruiterId) > -1), label + ': sharing rule (' + rule + ') → ' + (rosterById(other.recruiterId) || {}).name + ' · ' + lastReason(other));
    ok(sb.stage === 'Applied Directly' && !journeySent(sb) && sb.slaFrom, label + ': Applied, not counted as sent, SLA clock started');
    // screen: the owner opens it (sourcer), then shortlists it
    actAs(who.recruiter.id); openPipelineDetail(sb.id); await sleep(5); pdClose(); ok(sb.sourcedBy && sb.sourcedBy.id === who.recruiter.id, label + ': sourced by the recruiter who opened it');
    pipeShortlistApplicant(sb.id); try { csClose(); } catch(e){}
    if(who.reviewer){ ok(sb.stage === 'Pending Review' && reviewOf(sb) && reviewOf(sb).approverUserId === who.reviewer.id, label + ': review goes to ' + who.reviewer.name + ' (got ' + (reviewOf(sb) || {}).approverName + ')'); }
    else ok(sb.stage === 'Ready to Send' && !reviewOf(sb), label + ': no review for a team of 1–5');
    // consent: the link goes once; the candidate taps Yes
    ok(sb.consent, label + ': shortlisting the applicant asked for consent by itself');
    ok(sb.consent && sb.consent.state === 'pending' && sb.consent.token, label + ': consent link sent'); ok(tap(sb, true).ok && sb.consent.state === 'given' && audit(/Candidate agreed to be represented/), label + ': consent Yes, audited');
    // review, if on
    if(who.reviewer){ actAs(who.recruiter.id); ok(!canReviewSubmission(reviewOf(sb)), label + ': the recruiter cannot review their own'); actAs(who.reviewer.id); decideApproval(reviewOf(sb).id, 'Approved'); ok(sb.stage === 'Ready to Send' && audit(/Approved/), label + ': approved by ' + who.reviewer.name); }
    // send
    actAs(who.recruiter.id); openSendToClient([sb.id]); csSend(); ok(sb.stage === 'Submitted' && sb.sent && sb.sent.by === who.recruiter.name && journeySent(sb), label + ': sent by the recruiter');
    // the client books round 1 from the review link
    var poc = (cl.pocs || [])[0] || { name:'Client Person', email:'client@example.com' }, l = slFor('client', poc.name, poc.email, { submissionIds:[sb.id], jobId:j.id }, cl.name);
    ok(slValid(l) && slClientProfiles(l).some(function(x){ return x.id === sb.id; }), label + ': the client sees the profile on the link');
    SL.token = l.token; SL.draft = { slot:ivNowMs() + 2 * D }; slBook(sb.id); var iv1 = hmInterviews.find(function(x){ return x.submissionId === sb.id && x.roundNo === 1; });
    ok(iv1 && sb.stage === 'Interview Scheduled' && iv1.roundsTotal === 2, label + ': round 1 booked by the client (' + (iv1 && iv1.roundsTotal) + ' rounds)');
    // a hold in round 1, checked back after 7 days, cleared by the outcome
    setHold(sb, { reason:'Client waiting on budget sign-off', by:poc.name, source:'client feedback' }); ok(sb.hold && sb.hold.checkAt && sb.stage === 'Interview Scheduled', label + ': on hold, stage kept');
    var off = FM.offset; FM.offset = off + 8 * D; fmSlaSweep(); ok(sb.hold && sb.hold.checks === 1 && audit(new RegExp('checked back on a hold')), label + ': checked back after 7 days');
    clearHold(sb, 'Budget signed off', poc.name); ok(!sb.hold && audit(/Hold cleared|hold ended|Hold ended/i), label + ': hold cleared, audited');
    SL.draft = { choice:'cleared', next:true }; slOutcome(iv1.id); var iv2 = hmInterviews.find(function(x){ return x.submissionId === sb.id && x.roundNo === 2; });
    ok(iv1.outcome === 'cleared' && iv2, label + ': round 1 cleared from the link, round 2 created');
    actAs(who.recruiter.id); ok(ivOutcome(iv2.id, 'cleared', 'Strong final round', false, 'app').ok && iv2.outcome === 'cleared', label + ': round 2 cleared');
    // offer, from the terms version in force
    asOwner(); var o = recordOffer(sb.id, { ctc:18, doj:iso(fmNow()) }); ok(o.ok, label + ': offer recorded ' + (o.reason || ''));
    if(o.pending && o.approval) decideApproval(o.approval.id, 'Approved');
    ok(sb.offer.fee && sb.offer.fee.termsVersion === clCommercial(cl).version && sb.offer.fee.amount > 0, label + ': fee ' + sb.offer.fee.amount + ' from terms v' + sb.offer.fee.termsVersion);
    offerSetStatus(sb, 'Accepted', '', 'Offer accepted'); moveSubmissionStage(sb.id, 'Offer Accepted', 'accepted'); ok(sb.stage === 'Offer Accepted' && audit(/Offer accepted/), label + ': accepted');
    // pre-joining, then joined
    ok(typeof journeyStatus === 'function' && /joining|accepted/i.test(journeyStatus(sb).label + ' ' + journeyNextAction(sb)), label + ': pre-joining: ' + journeyStatus(sb).label + ' · ' + journeyNextAction(sb));
    var r = ptCreateJoinedRecord(byId(sb.candidateId).name, j.title, j.client, j.id, ptFmtDate(ptToday()), { submissionId:sb.id, joinedIso:iso(fmNow()) });
    ok(r && r.m8 && r.feeAmount === sb.offer.fee.amount && r.termsVersion === sb.offer.fee.termsVersion && r.invoice && r.invoice.state === 'Draft', label + ': joined, invoice drafted with the offer’s fee');
    // money: an Accounts person raises it; part paid; paid
    actAs(who.recruiter.id); ok(!ptRaiseInvoice(r.id) && !r.invoice.no, label + ': a recruiter cannot raise the invoice');
    actAs(who.acc.id); ok(ptRaiseInvoice(r.id) && /^NST-\d\d-\d\d\/\d{4}$/.test(r.invoice.no) && audit(new RegExp('Invoice raised .+by ' + who.acc.name)), label + ': raised by Accounts: ' + r.invoice.no);
    var total = ptInvoiceTotal(r); ok(ptRecordPayment(r.id, Math.round(total / 2)) && /^Part paid · /.test(ptInvoiceState(r)), label + ': part paid');
    ok(ptRecordPayment(r.id) && ptInvoiceState(r) === 'Paid', label + ': paid');
    // window passes → commission payable → approved → paid
    fmSlaSweep(); ok(r.commission.state === 'Expected', label + ': commission expected inside the window');
    FM.offset = FM.offset + ((r.replacementDays || 90) + 1) * D; fmSlaSweep(); ok(r.commission.state === 'Payable', label + ': payable after the window');
    actAs(who.recruiter.id); ok(!ptApproveCommission(r.id) && r.commission.state === 'Payable', label + ': a recruiter cannot approve commission');
    actAs(who.acc.id); ok(ptApproveCommission(r.id), label + ': commission approved by Accounts'); ok(r.commission.state === 'Approved', label + ': approved state');
    actAs(who.acc.id); ok(ptPayCommission(r.id) && r.commission.state === 'Paid' && audit(/Commission paid/), label + ': commission paid by Accounts');
    // numbers on the way
    var m = ptMoney(); ok(m.billed - money0.billed === r.invoice.taxSnapshot.fee || m.billed - money0.billed === r.feeAmount, label + ': billed +' + (m.billed - money0.billed));
    ok(m.collected >= money0.collected, label + ': collected grows');
    var f1 = flowFunnel(SUBMISSIONS).map(function(x){ return x.n; }); ok(f1[0] === f0[0] + 1 && f1[f1.length - 1] === f0[f0.length - 1] + 1, label + ': funnel sent +1, joined +1: ' + f0.join('/') + ' → ' + f1.join('/'));
    var q1 = computeRecruiterQualityFunnel(who.recruiter.name); ok(q1.submissions === q0.submissions + 1 && q1.accepted === q0.accepted + 1 && q1.joined === q0.joined + 1, label + ': the recruiter’s funnel');
    asOwner(); return { sb:sb, r:r, other:other };
  }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob0 = document.getElementById('onboarding'); if(ob0) ob0.classList.add('hidden');
    state.role = 'admin'; enterApp(); await sleep(100); FM.interactive = false; T0 = FM.offset;
    var tenant = typeof tenantById === 'function' ? tenantById(CURRENT_ORGANIZATION_ID) : null, plan = tenant && planById(tenant.planId); if(plan){ plan.userLimit = null; plan.jobLimit = null; }   // seats are not what this checks

    await t('Small: Owner → Recruiters (team of 1–5: no review, applicants to the job lead)', async function(){
      signUp('Small Shape Talent', '1–5');
      var r1 = invite('Small Rec One', 'role_recruiter', OWNER), r2 = invite('Small Rec Two', 'role_recruiter', OWNER);
      var ACC = fromTemplate('accounts', 'Accounts S'), acc = invite('Small Accounts', ACC.id, OWNER);
      var x = newClient('Small Client'), j = newJob(x.c, [r1, r2], r1);
      ok(j.submissionRules.approvalBeforeClient === false && j.applicantRouting === 'manual', 'the new job takes the team-size rules');
      await journey('Small', x.c, j, { recruiter:r2, reviewer:null, acc:acc });
    });

    var classic = {};
    await t('Classic: Owner → RM → Recruiters (review by the RM, round-robin)', async function(){
      signUp('Classic Shape Talent', '6–20');
      var rm = invite('Classic RM', 'role_recmgr', OWNER), r1 = invite('Classic Rec One', 'role_recruiter', rm.id), r2 = invite('Classic Rec Two', 'role_recruiter', rm.id);
      var ACC = fromTemplate('accounts', 'Accounts C'), acc = invite('Classic Accounts', ACC.id, OWNER);
      var x = newClient('Classic Client'), j = newJob(x.c, [rm, r1, r2], rm);
      ok(j.submissionRules.approvalBeforeClient === true && j.applicantRouting === 'round_robin', 'the new job takes the team-size rules');
      var out = await journey('Classic', x.c, j, { recruiter:r1, reviewer:rm, acc:acc });
      classic = { rm:rm, r1:r1, r2:r2, acc:acc, c:x.c, j:j, out:out };
    });

    await t('Classic, once: a hire who leaves in the window gets a free replacement; no fee, commission cancelled', async function(){
      ok(classic.j, 'the Classic shape ran');
      var j = newJob(classic.c, [classic.rm, classic.r1, classic.r2], classic.rm), c = { id:99800 + (++seq), name:'E2E Leaver', role:'Engineer', skills:['Java'], email:'leaver' + seq + '@example.com', organizationId:CURRENT_ORGANIZATION_ID }; CANDIDATES.push(c);
      actAs(classic.r1.id); var sb = createSubmission(j.id, c.id, { source:'Sourced', recruiterId:classic.r1.id, stage:'Ready to Send', reason:'test' }); asOwner();
      sb.sent = { at:new Date(fmNow() - 20 * D).toISOString(), by:classic.r1.name }; moveSubmissionStage(sb.id, 'Shortlisted', 'test');
      var o = recordOffer(sb.id, { ctc:18, doj:iso(fmNow()) }); if(o.pending && o.approval) decideApproval(o.approval.id, 'Approved'); offerSetStatus(sb, 'Accepted', '', 'Offer accepted'); moveSubmissionStage(sb.id, 'Offer Accepted', 'accepted');
      var r = ptCreateJoinedRecord(c.name, j.title, j.client, j.id, ptFmtDate(ptToday()), { submissionId:sb.id, joinedIso:iso(fmNow()) });
      var res = ptRecordLeft(r.id, iso(fmNow() + 10 * D), 'Resigned for a counter-offer'); ok(res.ok && res.inWindow, 'left inside the window');
      var nj = JOBS.find(function(x){ return x.replacementOf === j.id; }); ok(nj && nj.noFee && r.commission.state === 'Cancelled' && sb.stage === 'Withdrawn', 'free replacement job, commission cancelled, journey withdrawn');
      ok(audit(/Left|left/), 'audited');
    });

    await t('Classic, once: a contract hire through one monthly invoice (approved time → invoice → paid → commission on margin)', async function(){
      var j = newJob(classic.c, [classic.r1], classic.r1); j.hiringType = 'Contract'; j.contractMonths = 6;
      var c = { id:99850 + (++seq), name:'E2E Contractor', role:'Engineer', skills:['Java'], email:'contractor' + seq + '@example.com', phone:'+91 93100 ' + String(10000 + seq), organizationId:CURRENT_ORGANIZATION_ID }; CANDIDATES.push(c);
      actAs(classic.r1.id); var sb = createSubmission(j.id, c.id, { source:'Sourced', recruiterId:classic.r1.id, stage:'Shortlisted', reason:'test' }); asOwner(); sb.sent = { at:new Date(fmNow() - 90 * D).toISOString(), by:classic.r1.name };
      ptCreateJoinedRecord(c.name, j.title, j.client, j.id, '', { submissionId:sb.id });
      var now = new Date(fmNow()), first = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime(), w = coMonday(first) + 7 * D, M = iso(first).slice(0, 7);
      Object.assign(asForm, { start:iso(w - 7 * D), end:iso(fmNow() + 60 * D), unit:'day', payRate:'2000', markupPct:'25', billRate:'', tracking:'days', approverName:'Ravi Menon' }); asFormSave();
      var a = asForJourney(sb); ok(a && a.status === 'Active', 'assignment started');
      var s = asSubmitWeek(a, w, [1,1,1,1,1,0,0]); ok(s.ok && asDecideWeek(s.sheet, true, '', 'Ravi Menon').ok, 'a week submitted by the worker, approved by the client');
      var b = asBuildInvoice(a.id, M); ok(b.ok && b.invoice.feeAmount === 5 * 2500, 'monthly invoice from approved time: ' + (b.reason || b.invoice.feeAmount));
      actAs(classic.acc.id); ok(ptRaiseInvoice(b.invoice.id), 'raised by Accounts: ' + toasts.slice(-1)[0]); ok(ptRecordPayment(b.invoice.id) && ptFullyPaid(b.invoice), 'paid: ' + toasts.slice(-1)[0]);
      fmSlaSweep(); ok(b.invoice.commission && b.invoice.commission.basis === 'monthly margin' && ['Payable','Approved','Paid'].indexOf(b.invoice.commission.state) > -1, 'commission on the month’s margin: ' + (b.invoice.commission && b.invoice.commission.state));
    });

    await t('Classic, once: a consent No closes the journey as Not interested and blocks nobody', async function(){
      var j = newJob(classic.c, [classic.rm, classic.r1, classic.r2], classic.rm), c = { id:99870 + (++seq), name:'E2E Says No', role:'Engineer', skills:['Java'], email:'no' + seq + '@example.com', phone:'+91 93200 ' + String(10000 + seq), notice:'30 Days', organizationId:CURRENT_ORGANIZATION_ID }; CANDIDATES.push(c);
      actAs(classic.r2.id); var r = submitOneToJob(j, c, 'Talent Pool'); asOwner(); ok(r.ok && r.sub.consent && r.sub.consent.state === 'pending', 'submitted, consent asked: ' + (r.reason || r.code) + ' ' + JSON.stringify(r.sub && r.sub.consent));
      ok(tap(r.sub, false).ok && r.sub.stage === 'Rejected' && journeyStatus(r.sub).key === 'not_interested' && audit(/Candidate declined to be represented/), 'No → Not interested, audited');
      ok(!reviewOf(r.sub), 'the review closed');
      actAs(classic.r2.id); var full = submitOneToJob(classic.j, c, 'Talent Pool', { dryRun:true }); asOwner(); ok(!full.ok && /not open for submissions/.test(full.reason || ''), 'the filled Classic job takes no more submissions: ' + (full.reason || full.code));
    });

    await t('Classic, once: a same-job duplicate is blocked, then moved by an override with a reason and a deadline', async function(){
      var j = newJob(classic.c, [classic.rm, classic.r1, classic.r2], classic.rm), c = { id:99890 + (++seq), name:'E2E Duplicate', role:'Engineer', skills:['Java'], email:'dup' + seq + '@example.com', phone:'+91 93300 ' + String(10000 + seq), notice:'30 Days', organizationId:CURRENT_ORGANIZATION_ID }; CANDIDATES.push(c);
      actAs(classic.r1.id); var first = submitOneToJob(j, c, 'Talent Pool'); ok(first.ok, 'the first recruiter owns it: ' + (first.reason || first.code));
      actAs(classic.r2.id); var again = submitOneToJob(j, c, 'Talent Pool'); ok(!again.ok && again.code === 'journey_exists' && audit(/Submission blocked: journey exists/), 'the second is blocked, audited');
      var rq = fmOverrideRequest(first.sub.id, 'Owner is on leave and the client wants an answer today'); ok(rq.ok, 'the second recruiter asks');
      actAs(classic.rm.id); var g = fmOverrideGrant(first.sub.id, classic.r2.id, 'Rec One on leave until Monday; client waiting', 5, rq.request.id);
      ok(g.ok && first.sub.recruiterId === classic.r2.id && first.sub.override.until > fmNow() && audit(/Same-job override granted/), 'the RM moves it with a deadline, audited');
    });

    await t('Larger: Owner → Admin → RM → Recruiters (Admin from the template)', async function(){
      signUp('Larger Shape Talent', '21–50');
      var ADM = fromTemplate('admin', 'Admin'), ad = invite('Larger Admin', ADM.id, OWNER);
      ok(!roleHasPermission(ADM.id, 'billing', 'Manage plan & add-ons') && roleHasPermission(ADM.id, 'billing', 'Raise invoice') && roleHasPermission(ADM.id, 'candidates', 'Submit to job'), 'Admin template: no plan settings; can raise and submit');
      var rm = invite('Larger RM', 'role_recmgr', ad.id), r1 = invite('Larger Rec', 'role_recruiter', rm.id);
      var ACC = fromTemplate('accounts', 'Accounts L'), acc = invite('Larger Accounts', ACC.id, ad.id);
      var x = newClient('Larger Client'), j = newJob(x.c, [rm, r1], rm);
      await journey('Larger', x.c, j, { recruiter:r1, reviewer:rm, acc:acc });
      actAs(ad.id); ok(homeForMe() === 'admin-dashboard', 'the Admin lands on the Owner Home');
    });

    await t('Mixed: one recruiter under the RM, one directly under the Owner', async function(){
      signUp('Mixed Shape Talent', '6–20');
      var rm = invite('Mixed RM', 'role_recmgr', OWNER), underRm = invite('Mixed Under RM', 'role_recruiter', rm.id), underOwner = invite('Mixed Under Owner', 'role_recruiter', OWNER);
      var ACC = fromTemplate('accounts', 'Accounts M'), acc = invite('Mixed Accounts', ACC.id, OWNER);
      var x = newClient('Mixed Client'), j1 = newJob(x.c, [rm, underRm], rm), j2 = newJob(x.c, [underOwner], underOwner);
      await journey('Mixed / RM line', x.c, j1, { recruiter:underRm, reviewer:rm, acc:acc });
      await journey('Mixed / Owner line', x.c, j2, { recruiter:underOwner, reviewer:rosterById(OWNER), acc:acc });
    });

    var pre = document.createElement('pre'); pre.id = 'auth-test-results'; pre.textContent = JSON.stringify(results); document.body.appendChild(pre);
    document.title = 'E2E ' + results.filter(function(r){ return r.pass; }).length + '/' + results.length;
  }, 800); });
})();
