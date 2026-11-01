/* M7 · The candidate confirms right to represent (B8 · flow map 11), agency workspaces.
   Submitting asks the candidate once (WhatsApp and email link, 48 hours) while review carries on; nothing is sent without their yes
   or a recorded call; No closes the journey as Not interested and blocks nobody; no answer expires and tells the owner; consent is
   per client and job; a company workspace keeps its vendor consent.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\m07-consent.spec.js */
(function(){
  var results = [];
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  var ce = console.error; console.error = function(){ errs.push('console.error ' + Array.prototype.slice.call(arguments).map(function(a){ return (a && a.stack) || (a && a.message) || String(a); }).join(' ').slice(0, 300)); };
  var toasts = [], t0 = window.toast; window.toast = function(m){ toasts.push(String(m)); return t0.apply(this, arguments); };
  var T0 = 0, H = 3600000, OWNER = 'RP-088', seq = 0;
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e.stack || e.message).slice(0, 500) }); }
    finally { asOwner(); ORG_STRUCTURE.profile.orgType = 'Agency'; FM.offset = T0; if(typeof csClose === 'function') csClose(); if(typeof pdClose === 'function') pdClose(); } }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function asOwner(){ viewingAsFromManager = false; managerViewAsRecruiterId = null; previewAsRoleId = null; state.role = 'admin'; }
  function actAs(id){ if(id === OWNER) return asOwner(); state.role = 'manager'; viewingAsFromManager = true; managerViewAsRecruiterId = id; previewAsRoleId = null; }
  function audit(re){ return AUDIT_LOG.some(function(a){ return re.test((a.action || '') + ' ' + (a.detail || '')); }); }
  function person(name, roleId, reportsTo){ seq++; var u = { id:'M7-' + seq, name:name, email:'m7.' + seq + '@northstartalent.com', assignedRoleId:roleId, reportingManagerId:reportsTo || null, organizationId:CURRENT_ORGANIZATION_ID, userStatus:'Active' }; RECRUITER_ROSTER.push(u); return u; }
  function mkJob(team, client, rules){ seq++; var cl = CLIENTS.find(function(x){ return x.name === client; }) || CLIENTS[0];
    var j = { id:'m7j' + seq, title:'Consent Role ' + seq, client:cl.name, clientId:cl.id, loc:'Pune, IN', locations:['Pune, IN'], status:'Active', priority:'Medium', recruiter:'', recruiterId:null,
      assignedRecruiters:team.map(function(u){ return u.id; }), skills:['Java'], positions:3, submitted:0, candidateIds:[], interested:[], recs:[], publishChannels:[], organizationId:CURRENT_ORGANIZATION_ID, salary:'₹10–20 LPA', workMode:'Hybrid',
      submissionRules:Object.assign({ approvalBeforeClient:true, hideContacts:true, maxProfiles:5, required:[] }, rules || {}) }; JOBS.push(j); return j; }
  function mkCand(over){ seq++; var c = Object.assign({ id:99500 + seq, name:'Consent Person ' + seq, role:'Engineer', exp:'5 yrs', loc:'Pune, IN', skills:['Java'], email:'m7c' + seq + '@example.com', phone:'+91 97500 ' + String(10000 + seq), salary:'₹14–16 LPA', notice:'30 Days', organizationId:CURRENT_ORGANIZATION_ID }, over || {}); CANDIDATES.push(c); return c; }
  function touches(c){ return CANDIDATE_TOUCHES.filter(function(x){ return x.cid === c.id && x.consentToken; }); }
  function reviewOf(sb){ return APPROVAL_REQUESTS.find(function(r){ return r.entityType === 'SubmissionReview' && r.entityId === sb.id; }) || null; }
  function tap(sb, yes){ CO.pg = { kind:'consent', arg:sb.consent.token }; return coConsentDo(yes); }
  var rm, rec, rec2;
  // A submitted journey, approved by the reviewer, so it waits only on the send.
  function readyToSend(job, c){ actAs(rec.id); var r = submitOneToJob(job, c, 'Test'); ok(r.ok, 'submitted ' + (r.reason || '')); actAs(rm.id); decideApproval(reviewOf(r.sub).id, 'Approved'); asOwner(); ok(r.sub.stage === 'Ready to Send', 'approved'); return r.sub; }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    state.role = 'admin'; enterApp(); await sleep(100); FM.interactive = false; T0 = FM.offset;
    rm = person('Consent RM', 'role_recmgr', OWNER); rec = person('Consent Recruiter', 'role_recruiter', rm.id); rec2 = person('Consent Recruiter Two', 'role_recruiter', rm.id);

    await t('submitting a candidate with no consent sends the link once; review carries on', async function(){
      var j = mkJob([rec, rec2, rm]), c = mkCand(); actAs(rec.id); var r = submitOneToJob(j, c, 'Test'); asOwner();
      ok(r.ok && r.sub.stage === 'Pending Review' && reviewOf(r.sub) && reviewOf(r.sub).status === 'Pending', 'in review');
      var k = r.sub.consent; ok(k && k.state === 'pending' && k.token && Math.abs(k.dueAt - (fmNow() + 48 * H)) < 60000, 'pending, due in 48 hours');
      var ts = touches(c); ok(ts.length === 2 && ts.some(function(x){ return x.kind === 'WhatsApp'; }) && ts.some(function(x){ return x.kind === 'Email'; }) && ts.every(function(x){ return x.text.indexOf('#/consent/' + k.token) > -1; }), 'WhatsApp and email with the link');
      ok(ts[0].text.indexOf(ORG_STRUCTURE.profile.brandName + ' would like to put you forward to ' + j.client + ' for ' + j.title) > -1, 'the wording');
      ok(audit(new RegExp('Consent requested ' + c.name)), 'audited');
      actAs(rec.id); var again = submitOneToJob(j, c, 'Test'); asOwner(); ok(!again.ok && touches(c).length === 2, 'once: a second attempt sends nothing');
    });

    await t('Send is blocked without consent, in the dialog and in csSend', async function(){
      var j = mkJob([rec, rm]), c = mkCand(), sb = readyToSend(j, c);
      openSendToClient([sb.id]); var btn = document.getElementById('cs-send'), sum = document.getElementById('cs-consent-sum');
      ok(btn && btn.getAttribute('aria-disabled') === 'true', 'Send disabled'); ok(sum && /hasn’t agreed yet/.test(sum.textContent), 'says who has not agreed');
      ok(/Waiting for .+’s yes · link sent/.test(document.getElementById('cs-root').textContent), 'status per profile');
      ok(!document.querySelector('#cs-root input[type=checkbox][onchange*="rtr"]'), 'no tick box');
      csState.rtr = true; csSend(); ok(sb.stage === 'Ready to Send' && !sb.sent && /hasn’t agreed to be put forward/.test(toasts[toasts.length - 1]), 'csSend refuses');
    });

    await t('the candidate taps Yes → Send allowed; Ready shows when required fields are also complete', async function(){
      var j = mkJob([rec, rm]), c = mkCand(), sb = readyToSend(j, c);
      CO.pg = { kind:'consent', arg:sb.consent.token }; var page = coConsentPage();
      ok(page.indexOf(ORG_STRUCTURE.profile.brandName + ' would like to put you forward to <b>' + j.client + '</b> for <b>' + j.title + '</b>. Tap Yes to agree.') > -1 && /onclick="coConsentDo\(true\)">Yes</.test(page), 'the page: ' + page.slice(0, 200));
      ok(tap(sb, true).ok && sb.consent.state === 'given' && sb.consent.how === 'candidate' && audit(/Candidate agreed to be represented/), 'agreed, audited');
      ok(/You agreed/.test(coConsentPage()), 'the page says so'); ok(!tap(sb, false).ok && sb.consent.state === 'given', 'answers once');
      openSendToClient([sb.id]); ok(document.getElementById('cs-send').getAttribute('aria-disabled') !== 'true' && /Agreed on/.test(document.getElementById('cs-root').textContent), 'Send allowed');
      csSend(); ok(sb.stage === 'Submitted' && sb.sent, 'sent');
      // Ready: asked before submitting, from the pipeline drawer
      var jr = mkJob([rec, rm], null, { required:['Current CTC'] }), full = mkCand({ comp:{ currency:'INR', current:1800000, expected:2200000 } }), thin = mkCand();
      var a = createSubmission(jr.id, full.id, { source:'Sourced', recruiterId:OWNER, stage:'Recommended', reason:'test' }), b = createSubmission(jr.id, thin.id, { source:'Sourced', recruiterId:OWNER, stage:'Recommended', reason:'test' });
      openPipelineDetail(a.id); await sleep(10); var card = document.getElementById('pd-consent'); ok(card && new RegExp('Ask ' + pipeFirst(full) + ' to agree').test(card.textContent), 'drawer: Ask to agree');
      consentAskUI(a.id, 'pd'); ok(a.consent && a.consent.state === 'pending' && /Waiting for/.test(document.getElementById('pd-consent').textContent), 'asked from the drawer'); pdClose();
      ok(journeyStatus(a).key !== 'ready', 'not Ready while waiting'); tap(a, true); ok(journeyStatus(a).label === 'Ready', 'agreed + required complete → Ready');
      requestConsent(b); tap(b, true); ok(candidateRequiredCheck(jr, thin).missing.length && journeyStatus(b).key !== 'ready', 'agreed but a required field missing → not Ready');
    });

    await t('the candidate taps No → closed as Not interested with the reason; blocks nobody', async function(){
      var j = mkJob([rec, rec2, rm]), c = mkCand(); actAs(rec.id); var r = submitOneToJob(j, c, 'Test'); asOwner(); var sb = r.sub, rq = reviewOf(sb), n0 = FM.notices.length;
      ok(tap(sb, false).ok, 'answered');
      ok(sb.stage === 'Rejected' && journeyStatus(sb).key === 'not_interested' && sb.stageHistory.slice(-1)[0].reason === 'Candidate declined to be represented for ' + j.client, 'Not interested: ' + journeyStatus(sb).label);
      ok(rq.status === 'Cancelled', 'review closed'); ok(audit(/Candidate declined to be represented/), 'audited'); ok(FM.notices.slice(n0).some(function(n){ return n.to === rec.id && /said no/.test(n.text); }), 'owner told');
      ok(/You said no/.test(coConsentPage()), 'the page says so');
      actAs(rec2.id); var again = submitOneToJob(j, c, 'Test'); asOwner();
      ok(again.ok && again.sub === sb && sb.recruiterId === rec2.id && sb.consent.state === 'pending' && sb.consent.token !== CO.pg.arg, 'another recruiter starts fresh with a new link: ' + (again.reason || again.code));
    });

    await t('no answer in 48 hours → expired, owner told; a call with a note allows Send; without a note it is refused', async function(){
      var j = mkJob([rec, rm]), c = mkCand(), sb = readyToSend(j, c), n0 = FM.notices.length;
      FM.offset = T0 + 49 * H; fmSlaSweep(); ok(sb.consent.state === 'expired', 'expired');
      ok(FM.notices.slice(n0).some(function(n){ return n.to === rec.id && n.subId === sb.id && /didn’t answer/.test(n.text); }) && audit(/Consent request expired/), 'owner told, audited');
      CO.pg = { kind:'consent', arg:sb.consent.token }; ok(/This link has expired/.test(coConsentPage()) && !coConsentDo(true).ok, 'expired page');
      openSendToClient([sb.id]); ok(/No answer · call and record it/.test(document.getElementById('cs-root').textContent) && document.getElementById('cs-call-' + sb.id), 'the dialog offers to record a call');
      consentCallUI(sb.id, 'cs'); ok(sb.consent.state === 'expired' && /Add how it was confirmed/.test(toasts[toasts.length - 1]), 'no note: refused');
      ok(!recordConsentCall(sb, '  ').ok, 'blank refused');
      document.getElementById('cs-call-' + sb.id).value = 'Called on +91 97500 10001, agreed at 3 pm'; consentCallUI(sb.id, 'cs');
      ok(sb.consent.state === 'given' && sb.consent.how === 'call' && /agreed at 3 pm/.test(sb.consent.callNote) && audit(/Consent recorded from a call/), 'recorded');
      ok(/Agreed by call · Called on/.test(document.getElementById('cs-root').textContent), 'shown'); csSend(); ok(sb.stage === 'Submitted', 'sent');
      FM.offset = T0; var x = readyToSend(mkJob([rec, rm]), mkCand()); FM.offset = T0 + 49 * H; fmSlaSweep(); var tok = x.consent.token; requestConsent(x); ok(x.consent.state === 'pending' && x.consent.token !== tok, 'a fresh link after expiry');
    });

    await t('consent for one client and job does not count for another client or job', async function(){
      var c = mkCand(), jA = mkJob([rec, rm], 'Fintech Corp'), jB = mkJob([rec, rm], 'HealthAI'), jC = mkJob([rec, rm], 'Fintech Corp');
      var a = readyToSend(jA, c), b = readyToSend(jB, c), d = readyToSend(jC, c); tap(a, true);
      ok(consentOk(a) && !consentOk(b) && !consentOk(d), 'only the job it was given for');
      CO.pg = { kind:'consent', arg:a.consent.token }; ok(!coConsentDo(true).ok, 'the same link answers once');
      openSendToClient([b.id]); csSend(); ok(b.stage === 'Ready to Send', 'another client: still blocked'); csClose();
      openSendToClient([d.id]); csSend(); ok(d.stage === 'Ready to Send', 'another job at the same client: still blocked');
    });

    await t('a company workspace keeps its vendor consent', async function(){
      ORG_STRUCTURE.profile.orgType = 'Corporate'; coSeedCorp(true); asOwner();
      var j = jobById('nw1'); j.internalUntil = coNow() - 1; coAssign('nw1', 'vd-s1');
      var p = { name:'Vendor Person', email:'vendor.person@cand.example', phone:'9812345678', currentCompany:'Acme Care', exp:'4 yrs', loc:'Mumbai, IN', skills:'ICU care, BLS', currentCtc:'4', expectedCtc:'5', notice:'30 Days', resume:'cv.pdf', note:'' };
      var vs = coVendorSubmit('vd-s1', 'nw1', p); ok(vs.ok && vs.vs.consent.state === 'pending', 'vendor submission waits for consent: ' + (vs.reason || ''));
      ok(!consentFind(vs.vs.consent.token), 'not a journey token'); CO.pg = { kind:'consent', arg:vs.vs.consent.token };
      ok(/would like to put you forward for <b>/.test(coConsentPage()) && /I agree/.test(coConsentPage()), 'the vendor page, as before');
      var g = coConsentGive(vs.vs.consent.token, true); ok(g.ok && g.submission && !g.submission.consent, 'agreed: journey created, no agency consent record');
      openSendToClient([g.submission.id]); ok(!csState || !document.getElementById('cs-consent-sum'), 'no agency consent line in a company workspace');
    });

    var pre = document.createElement('pre'); pre.id = 'auth-test-results'; pre.textContent = JSON.stringify(results); document.body.appendChild(pre);
    document.title = 'M07 ' + results.filter(function(r){ return r.pass; }).length + '/' + results.length;
  }, 800); });
})();
