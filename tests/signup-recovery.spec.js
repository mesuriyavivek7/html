/* Sign-up recovery (flow map 00 and 01, approved as AR-1): every answered question is saved, a live domain offers "Request to join"
   and shows who to ask, anyone can escalate to Oontu, Oontu can resolve every case, and assisted set-up needs the customer's permission.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\signup-recovery.spec.js */
window.AUTH_SKIP_OTP = false;   /* the real code step is what these tests check */
(function(){
  'use strict';
  const results = [];
  const sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  async function idle(){ for(let i = 0; i < 400; i++){ await sleep(0); if(!authFlow.busy) break; } await sleep(0); }
  async function settle(){ await sleep(40); }
  function assert(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function eq(a, b, m){ if(a !== b) throw new Error((m ? m + ': ' : '') + 'expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a)); }
  const q = function(s, el){ return (el || document).querySelector(s); };
  const qa = function(s, el){ return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  function setv(sel, v){ const el = q(sel); if(!el) throw new Error('missing ' + sel); el.value = v; el.dispatchEvent(new Event('input', { bubbles:true })); }
  function submitForm(sel){ const f = q(sel); if(!f) throw new Error('missing ' + sel); f.dispatchEvent(new Event('submit', { bubbles:true, cancelable:true })); }
  async function click(sel){ const el = q(sel); if(!el) throw new Error('missing ' + sel); el.click(); await idle(); }
  const heading = function(){ const h = q('#oa-h'); return h ? h.textContent : ''; };
  const oaMsg = function(){ const m = q('#oa-body .oa-msg[role]') || q('#oa-body .oa-msg'); return m ? m.textContent : ''; };
  const SAMPLES = JSON.stringify(EXISTING_WORKSPACES);
  function reset(){
    authApi._reset(); authApi._latency = 0; try { localStorage.removeItem(AUTH_REMEMBER_KEY); } catch(e){}
    EXISTING_WORKSPACES = JSON.parse(SAMPLES); const app = document.getElementById('app'); app.classList.add('hidden'); app.classList.remove('flex'); document.getElementById('onboarding').classList.remove('hidden');
    state.role = 'recruiter'; obMode = 'signup'; obScreenIndex = 0; authAppSession = { method:'', email:'' }; authFlow = authInitialState(); authFocusNext = null; OA.resetSignIn(); OA.resetSignUp();
    suWiz = suWizInitial(); signupActiveLeadId = null; authSignupPwDraft = ''; wsSheet = null; wsSheetRender(); wsSetup = null; WS_SETUPS = {}; qzMoving = false; qzEnter = ''; qzShakeNext = false; suProgShown = 0;
    qzReduced = function(){ return true; }; ob.companyName = ''; ob.website = ''; ob.linkedin = ''; JN.leadId = null; JN.draft = null; JN.escalations = []; JN.perms = []; JN.mails = []; JN.ui = { tab:'open', sel:null }; jnModal(''); renderOnboardingScreen();
  }
  async function suText(v){ const f = q('form[data-form=su-text]'); assert(f, 'a text question is showing'); const inp = q('input.oa-input', f); inp.value = v; inp.dispatchEvent(new Event('input', { bubbles:true })); submitForm('form[data-form=su-text]'); await idle(); await sleep(10); }
  async function suPick(value){ const b = q('[data-act=su-pick][data-value="' + value + '"]'); assert(b, 'no choice ' + value); b.click(); await sleep(340); await idle(); }
  async function suSkip(){ click('[data-act=su-skip]'); await sleep(10); await idle(); }
  /* Create workspace in the reference order (2026-11-21): email, code, name, who you hire for, organisation, recruiters, location (creates it). */
  async function waitFor(cond, ms){ for(let i = 0; i < (ms || 4000) / 20; i++){ if(cond()) return true; await sleep(20); } return false; }
  async function suCode(email){ setv('.oa-otp__input', authApi._latestEmail(email).code); await idle(); await settle(); await waitFor(function(){ return !q('.oa-otp__input'); }, 3000); await sleep(20); }
  async function suName(v){ if(q('[data-act=su-name-yes]')){ if(heading() === 'Is it ' + v + '?'){ await click('[data-act=su-name-yes]'); await sleep(10); return; } await click('[data-act=su-name-edit]'); } await suText(v); }
  async function suOrg(v){ if(q('[data-act=su-org-yes]')){ if(heading().slice(-(v.length + 1)) === v + '?'){ await click('[data-act=su-org-yes]'); await sleep(10); return; } await click('[data-act=su-org-edit]'); } await suText(v); }
  async function signUpTo(stop, type, o){
    o = Object.assign({ name:'Dana', org:type === 'corporate' ? 'Startup Corp' : 'Startup Talent', size:type === 'corporate' ? '51–200' : '6–20', place:'IN', email:'dana@startup.example' }, o || {});
    if(authFlow.step !== 'signup') authSwitchIntent('signup'); await sleep(10);
    const order = ['email', 'code', 'name', 'type', 'org', 'size', 'place'];
    for(let i = 0; i < order.length; i++){ const k = order[i]; if(k === stop) return;
      if(k === 'email'){ if(q('#su-email')) await suText(o.email); } else if(k === 'code'){ if(q('.oa-otp__input')) await suCode(o.email); }
      else if(k === 'name') await suName(o.name); else if(k === 'type') await suPick(type); else if(k === 'org') await suOrg(o.org); else if(k === 'size') await suPick(o.size); else if(k === 'place') await suPick(o.place); }
  }
  async function test(name, fn){ reset(); try { await fn(); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e && e.message || e) }); } finally { EXISTING_WORKSPACES = JSON.parse(SAMPLES); state.role = 'recruiter'; } }
  function audit(re){ return (typeof AUDIT_LOG !== 'undefined' ? AUDIT_LOG : []).concat(typeof PLATFORM_AUDIT_LOG !== 'undefined' ? PLATFORM_AUDIT_LOG : []).some(function(a){ return re.test((a.action || '') + ' ' + (a.detail || '') + ' ' + (a.details || '')); }); }
  async function askToJoin(email, name){ await signUpTo('type', 'corporate', { email:email, name:name || 'Ravi' }); q('[data-act=su-pick][data-value=corporate]').click(); await sleep(340); await idle(); assert(q('[data-act=su-escalate]'), 'the join panel is showing'); }

  async function run(){
    await test('R1 every answered question is saved as a sign-up lead, with the answers to resume from', async function(){
      const before = SIGNUP_LEADS.length; authSwitchIntent('signup'); await sleep(10); await suText('ravi@newco.example');
      eq(SIGNUP_LEADS.length, before + 1, 'one lead once the email is given'); let l = signupLeadById(JN.leadId); eq(l.email, 'ravi@newco.example'); eq(l.stepReached, 'email');
      assert(followUpLeads().some(function(x){ return x.id === JN.leadId; }), 'on the follow-up list');
      await suCode('ravi@newco.example'); l = signupLeadById(JN.leadId); eq(l.stepReached, 'verified'); assert(l.emailVerified, 'verified');
      await suName('Ravi'); await suPick('corporate'); l = signupLeadById(JN.leadId); eq(l.name, 'Ravi'); eq(l.stepReached, 'type_chosen'); eq(l.workspaceType, 'Corporate'); assert(l.resume && l.resume.snap.type === 'corporate', 'resume answers kept');
      await suOrg('Newco Ltd'); await suPick('51–200'); l = signupLeadById(JN.leadId); eq(l.stepReached, 'team_size'); eq(l.companyName, 'Newco Ltd'); eq(l.teamSize, '51–200'); eq(SIGNUP_LEADS.length, before + 1, 'still one lead');
      assert(leadFollowUp(signupLeadById(JN.leadId)).key === 'fresh', 'a fresh lead is inside the first 24 hours');
    });
    await test('R2 a saved sign-up resumes: in a new browser the email is proven again first; in the same signed-in browser it goes to the first question without an answer; a closed one does not', async function(){
      await signUpTo('org', 'agency', { name:'Maya', email:'maya@zz.example' }); const l = signupLeadById(JN.leadId); eq(OA.snapshot().next, 'org');
      authSwitchIntent('signin'); OA.resetSignUp(); let r = joinResume(l.id); assert(r.ok, 'resumed'); await sleep(30); let s = OA.snapshot();
      eq(s.next, 'org', 'still signed in with the proven email: straight to the first open question'); eq(s.name, 'Maya'); eq(s.type, 'agency');
      assert(leadTimeline(l).some(function(e){ return /resume link/i.test(e.text); }), 'the timeline says so');
      await authApi.signOut(); authFlow.verified = false; authFlow.user = null;   // the link opened in another browser
      authSwitchIntent('signin'); OA.resetSignUp(); r = joinResume(l.id); assert(r.ok, 'resumed again'); await sleep(30); s = OA.snapshot();
      eq(s.next, 'email', 'the email question first'); eq(q('#su-email').value, 'maya@zz.example', 'filled in'); eq(s.name, 'Maya');
      l.status = 'not_interested'; assert(!joinResume(l.id).ok, 'a closed lead cannot be resumed'); assert(!joinResume('lead-none').ok, 'nor an unknown one');
    });
    await test('R3 a finished sign-up closes the lead into "In product"', async function(){
      await signUpTo(null, 'agency', { name:'Dana', email:'dana@fresh.example' }); const l = signupLeadById(JN.leadId);
      let n = 0; while(!q('[data-act=su-enter]') && n++ < 150) await sleep(20); assert(q('[data-act=su-enter]'), 'workspace ready'); eq(signupLeadById(l.id).status, 'in_product'); assert(signupLeadById(l.id).emailVerified, 'verified');
    });
    await test('R4 a live workspace on the domain: who to ask is shown, with Request to join and Ask Oontu; the old message still starts the sentence', async function(){
      await askToJoin('ravi@infosys.com'); eq(heading(), 'Who do you hire for?'); assert(/Infosys already has a workspace\. Ask Anita Rao to invite you/.test(oaMsg()), oaMsg());
      assert(/Owner: Anita Rao \(a•••@infosys\.com\)/.test(oaMsg()) && /Admins: Sunil Menon/.test(oaMsg()), 'owner and admins: ' + oaMsg()); assert(q('[data-act=su-join]') && /Request to join Infosys/.test(q('[data-act=su-join]').textContent), 'request button'); assert(q('[data-act=su-escalate]'), 'ask Oontu');
      eq(authApi._outboxCount('ravi@infosys.com'), 1, 'only the sign-up code: the email is proven before the company is picked');
    });
    await test('R5 an invite-only workspace offers no request, only Oontu; a closed workspace holds nothing; an agency is never blocked', async function(){
      await askToJoin('ravi@relianceretail.com'); assert(!q('[data-act=su-join]') && /only lets in people it invites/.test(oaMsg()) && q('[data-act=su-escalate]'), 'invite only: ' + oaMsg());
      reset(); await signUpTo('type', 'corporate', { email:'x@legacyfoods.example', name:'Xin' }); q('[data-act=su-pick][data-value=corporate]').click(); await sleep(340); await idle(); assert(!q('[data-act=su-escalate]') && heading() !== 'Who do you hire for?', 'an inactive workspace lets the next person start fresh: ' + heading());
      reset(); await signUpTo('type', 'agency', { email:'ravi@infosys.com', name:'Ravi' }); await suPick('agency'); assert(heading() !== 'Who do you hire for?' && !q('[data-act=su-join]'), 'an agency can use any email');
    });
    await test('R6 Request to join: the request reaches the owner, asking twice is the same request, the owner approves in Team members and the person gets an invitation', async function(){
      await askToJoin('ravi@infosys.com'); await click('[data-act=su-join]'); assert(q('#jn-modal-root .jn-panel'), 'the request form'); assert(/Anita Rao/.test(q('#jn-modal-root').textContent), 'says who sees it');
      q('#jn-email').value = 'ravi@gmail.com'; await joinRequestSend(); assert(/Use your infosys\.com email/.test(q('#jn-modal-root').textContent), 'must be a company email');
      q('#jn-name').value = 'Ravi Kumar'; q('#jn-email').value = 'ravi@infosys.com'; await joinRequestSend(); assert(/Request sent/.test(q('#jn-modal-root').textContent), 'confirmation'); assert(q('#jn-modal-root').textContent.indexOf('Ask Oontu') > -1, 'escalation offered right there');
      let list = authApi._joinRequests('infosys.com'); eq(list.length, 1); eq(list[0].status, 'pending'); const again = await authApi.requestToJoin({ domain:'infosys.com', name:'Ravi Kumar', email:'ravi@infosys.com' }); assert(again.existing && authApi._joinRequests('infosys.com').length === 1, 'asking twice is one request');
      assert(authApi._outboxCount('anita.rao@infosys.com') === 1, 'the owner is emailed');
      assert(leadEventsText(JN.leadId).indexOf('Asked to join Infosys') > -1, 'the lead remembers');
      jnModal(''); state.role = 'admin'; ORG_STRUCTURE.profile.domain = 'infosys.com'; showView('team-members'); assert(q('#jn-join-card') && /Ravi Kumar/.test(q('#jn-join-card').textContent), 'the owner sees it in Team members');
      state.role = 'recruiter'; showView('team-members'); assert(/You don’t have access to this/.test(q('#blocked-modal-root').textContent) && /Your role can’t open this page/.test(q('#blocked-modal-root').textContent), 'a recruiter can’t open Team members, so never sees the request'); closeBlockedState(); state.role = 'admin';
      assert(jnJoinApprove(list[0].id), 'approved'); eq(authApi._joinRequest(list[0].id).status, 'approved');
      /* since 2026-11-21 the email is proven before the company is picked, so Ravi already has a verified account: approving adds him at once (an invitation is only for someone without an account) */
      const ses = await authApi.session(); assert(authApi._inviteMail().some(function(m){ return m.to === 'ravi@infosys.com'; }) || (ses.user && ses.user.email === 'ravi@infosys.com' && ses.workspaces.some(function(w){ return /infosys/i.test(w.id + ' ' + (w.name || '')); })), 'the person is in: invited, or added to the workspace'); assert(audit(/Join request approved/), 'audited'); ORG_STRUCTURE.profile.domain = '';
    });
    await test('R7 the owner can decline with a reason; a join rule of "straight away" admits at once; "invite only" refuses a direct request; asking too often is stopped', async function(){
      state.role = 'admin'; ORG_STRUCTURE.profile.domain = 'infosys.com'; const r1 = await authApi.requestToJoin({ domain:'infosys.com', name:'Tan', email:'tan@infosys.com' }); const id = r1.request.id;
      assert(!jnJoinDecline(id, ''), 'a reason is needed'); assert(jnJoinDecline(id, 'Not on our team'), 'declined'); eq(authApi._joinRequest(id).status, 'declined'); assert(jnMailsTo(/not approved/).length === 1, 'they are told');
      authApi._setWorkspace('infosys.com', { policy:'auto' }); const r2 = await authApi.requestToJoin({ domain:'infosys.com', name:'Uma', email:'uma@infosys.com' }); assert(r2.ok && r2.auto && r2.inviteToken, 'straight in with an invitation'); eq(authApi._joinRequest(r2.request.id).status, 'approved');
      authApi._setWorkspace('infosys.com', { policy:'invite' }); const r3 = await authApi.requestToJoin({ domain:'infosys.com', name:'Vik', email:'vik@infosys.com' }); eq(r3.error, 'join_closed');
      authApi._setWorkspace('infosys.com', { policy:'request' }); await authApi.requestToJoin({ domain:'infosys.com', name:'Wen', email:'wen@infosys.com' }); const w1 = authApi._joinRequests('infosys.com').filter(function(x){ return x.email === 'wen@infosys.com'; })[0]; authApi._declineJoin(w1.id, 'x', 'x');
      await authApi.requestToJoin({ domain:'infosys.com', name:'Wen', email:'wen@infosys.com' }); const w2 = authApi._joinRequests('infosys.com').filter(function(x){ return x.email === 'wen@infosys.com' && x.status === 'pending'; })[0]; authApi._declineJoin(w2.id, 'x', 'x');
      await authApi.requestToJoin({ domain:'infosys.com', name:'Wen', email:'wen@infosys.com' }); const w3 = authApi._joinRequests('infosys.com').filter(function(x){ return x.email === 'wen@infosys.com' && x.status === 'pending'; })[0]; authApi._declineJoin(w3.id, 'x', 'x');
      eq((await authApi.requestToJoin({ domain:'infosys.com', name:'Wen', email:'wen@infosys.com' })).error, 'rate_limited', 'a fourth request in a day'); ORG_STRUCTURE.profile.domain = '';
    });
    await test('R8 Ask Oontu: the form is checked, one open case per person, the person and Oontu are both emailed, the lead remembers', async function(){
      await askToJoin('ravi@infosys.com'); await click('[data-act=su-escalate]'); assert(/Ask Oontu to help/.test(q('#jn-modal-root').textContent), 'form'); q('#jn-name').value = 'Ravi Kumar'; q('#jn-email').value = 'ravi@infosys.com'; joinEscalateSend(); assert(/Choose what is going on/.test(q('#jn-modal-root').textContent), 'reason needed');
      q('#jn-name').value = 'Ravi Kumar'; q('#jn-email').value = 'ravi@infosys.com'; q('#jn-reason').value = 'Something else'; q('#jn-note').value = 'ok'; joinEscalateSend(); assert(/Add a sentence/.test(q('#jn-modal-root').textContent), 'Something else needs words');
      q('#jn-name').value = 'Ravi Kumar'; q('#jn-email').value = 'ravi@infosys.com'; q('#jn-mobile').value = '98250 41207'; q('#jn-reason').value = 'The owner has left the company'; q('#jn-note').value = 'Anita left in March; nobody else is an admin.'; joinEscalateSend(); assert(/Sent to Oontu/.test(q('#jn-modal-root').textContent), 'sent');
      eq(JN.escalations.length, 1); const e = JN.escalations[0]; eq(e.status, 'open'); eq(e.domain, 'infosys.com'); assert(e.dueAt - e.createdAt === 24 * 3600000, 'one working day'); assert(jnMailsTo(/support@oontu/).length === 1 && jnMailsTo(/We have your request/).length === 1, 'both emailed');
      assert(joinEscalate({ name:'Ravi Kumar', email:'ravi@infosys.com', reason:'The owner has left the company', domain:'infosys.com' }).existing, 'one open case per person'); assert(leadEventsText(JN.leadId).indexOf('Asked Oontu for help') > -1, 'the lead remembers');
    });
    await test('R9 Oontu resolves it: only the Oontu team, a note every time, identity confirmed for the risky ones; approve, move ownership, free the domain, allow a separate workspace, decline, contact the owner', async function(){
      const mk = function(email, name){ return joinEscalate({ name:name || 'Ravi Kumar', email:email, reason:'The owner has left the company', domain:email.split('@')[1] }).escalation; };
      let e = mk('ravi@infosys.com'); assert(!jnApproveJoin(e.id, 'checked', true).ok, 'the platform team only'); state.role = 'oontu';
      assert(!jnApproveJoin(e.id, 'ok', true).ok && /note/.test(jnApproveJoin(e.id, 'ok', true).reason), 'a real note is needed'); assert(/checked who/.test(jnApproveJoin(e.id, 'Called him back on his work number', false).reason), 'identity must be confirmed');
      assert(jnContactOwner(e.id, 'Asked Anita to approve or hand over').ok && jnMailsTo(/needs access/).length === 1 && e.ownerContactedAt, 'owner contacted'); assert(jnAssign(e.id, 'Farhan Ali') && e.assignedTo === 'Farhan Ali', 'assigned');
      const ap = jnApproveJoin(e.id, 'Called him back on his work number', true); assert(ap.ok && ap.inviteToken && e.status === 'resolved', 'approved with an invitation'); assert(authApi._inviteMail().some(function(m){ return m.to === 'ravi@infosys.com'; }), 'invited'); assert(!jnResolve(e.id, 'again please').ok, 'a resolved case is closed');
      e = mk('lia@infosys.com', 'Lia'); const tr = jnTransferOwner(e.id, { name:'Lia Fernandes', email:'lia@infosys.com', note:'Owner left, HR confirmed by letter', verified:true }); assert(tr.ok && authApi._workspaceInfo('infosys.com').ownerName === 'Lia Fernandes', 'ownership moved'); assert(jnMailsTo(/now the owner/).length === 1 && jnMailsTo(/Ownership of Infosys moved/).length === 1, 'both owners told');
      authApi._setWorkspace('infosys.com', { ownerName:'Anita Rao', ownerEmail:'anita.rao@infosys.com' }); e = mk('zed@infosys.com', 'Zed'); assert(!jnTransferOwner(e.id, { name:'Zed', email:'zed@other.example', note:'wrong domain here', verified:true }).ok, 'the new owner must be on the domain');
      e = mk('mo@legacyfoods.example', 'Mo'); authApi._setWorkspace('legacyfoods.example', { status:'active' }); assert((await authApi.checkSignupEmail({ email:'mo@legacyfoods.example', type:'Corporate' })).error === 'domain_taken', 'held while live'); assert(jnFreeDomain(e.id, { note:'Company closed, MCA record checked', verified:true }).ok, 'freed'); assert((await authApi.checkSignupEmail({ email:'mo@legacyfoods.example', type:'Corporate' })).ok, 'free now');
      e = mk('sep@infosys.com', 'Sep'); assert((await authApi.checkSignupEmail({ email:'sep@infosys.com', type:'Corporate' })).error === 'domain_taken'); assert(jnAllowSeparate(e.id, { note:'Separate legal entity with a shared domain', verified:true }).ok, 'allowed'); assert((await authApi.checkSignupEmail({ email:'sep@infosys.com', type:'Corporate' })).ok, 'through for that person'); assert((await authApi.checkSignupEmail({ email:'other@infosys.com', type:'Corporate' })).error === 'domain_taken', 'but not for everyone');
      e = mk('no@infosys.com', 'No'); assert(jnDeclineJoin(e.id, 'Not a Infosys employee per HR').ok && e.status === 'resolved' && jnMailsTo(/About your request to join/).length >= 1, 'declined and told'); e = mk('fyi@infosys.com', 'Fyi'); assert(jnResolve(e.id, 'Spoke to the person; they will use an invite').ok, 'resolved');
      assert(audit(/Account help: join approved/) && audit(/ownership transferred/) && audit(/domain freed/), 'every action is in the platform audit log');
    });
    await test('R10 assisted set-up: only with the customer’s permission, only what they allowed, for 24 hours, logged on both sides, and they can turn it off', async function(){
      await signUpTo('place', 'agency', { name:'Dana', email:'dana@assist.example' }); const l = signupLeadById(JN.leadId); state.role = 'oontu';
      assert(!jnAssistDo('ap-nope', 'city', 'Pune').ok, 'no permission, no action'); const ask = jnAssistAsk({ leadId:l.id }); assert(ask.ok && ask.perm.status === 'asked', 'asked'); assert(jnMailsTo(/would like to help/).length === 1, 'the customer is emailed'); assert(!jnAssistDo(ask.perm.id, 'city', 'Pune').ok && /not allowed/.test(jnAssistDo(ask.perm.id, 'city', 'Pune').reason), 'not before they say yes');
      assert(jnAssistAsk({ leadId:l.id }).existing, 'one open request'); const noMail = { name:'X', email:'', id:'lead-x' }; assert(!jnAssistAsk({ leadId:'lead-none' }).ok, 'needs a real lead');
      location.hash = '#/assist/' + ask.perm.token; await sleep(30); assert(document.body.classList.contains('jn-on') && /What Oontu could do/.test(q('#jn-root').textContent), 'the customer’s page'); jnAssistPage(true); assert(/Oontu is helping you/.test(q('#jn-root').textContent), 'allowed'); eq(ask.perm.status, 'active');
      assert(jnAssistDo(ask.perm.id, 'companyName', 'Assist Talent').ok && l.companyName === 'Assist Talent', 'a company name'); assert(jnAssistDo(ask.perm.id, 'invite', 'teammate@assist.example').ok && l.assistInvites[0] === 'teammate@assist.example', 'a teammate invite'); assert(!jnAssistDo(ask.perm.id, 'invite', 'not-an-email').ok, 'checked'); assert(!jnAssistDo(ask.perm.id, 'password', 'hunter2').ok && /outside/.test(jnAssistDo(ask.perm.id, 'password', 'x').reason), 'a password is outside what they allowed');
      jnPgDraw(); assert(/Company name: Assist Talent/.test(q('#jn-root').textContent), 'the customer sees what was done'); assert(audit(/Assisted set-up change/), 'platform audit'); assert(leadTimeline(l).some(function(x){ return /Oontu set company profile/.test(x.text) || /Oontu set company name/.test(x.text); }), 'on the lead’s timeline');
      jnAssistPageOff(); eq(ask.perm.status, 'revoked'); assert(!jnAssistDo(ask.perm.id, 'city', 'Pune').ok, 'stopped at once'); jnPgBack();
      const ask2 = jnAssistAsk({ leadId:l.id }); jnAssistAnswer(ask2.perm.token, true); FM.offset = 25 * 3600000; assert(!jnAssistDo(ask2.perm.id, 'city', 'Pune').ok && ask2.perm.status === 'expired', 'ends after 24 hours'); FM.offset = 0;
      const ask3 = jnAssistAsk({ leadId:l.id }); assert(jnAssistAnswer(ask3.perm.token, false).declined, 'they can say no'); assert(!jnAssistAnswer(ask3.perm.token, true).ok, 'and it stays no'); state.role = 'recruiter'; assert(!jnAssistAsk({ leadId:l.id }).ok, 'only Oontu can ask');
    });
    await test('R11 Oontu console: Account help is in the sidebar, lists cases, opens one with the actions; the sign-up sheet shows the resume link', async function(){
      joinEscalate({ name:'Ravi Kumar', email:'ravi@infosys.com', reason:'The owner is not answering', domain:'infosys.com' }); await signUpTo('place', 'agency', { name:'Dana', email:'dana@sheet.example' });
      state.role = 'oontu'; renderSidebar(); assert((typeof o2On === 'function' && o2On('1a') ? /Workspaces/ : /Account help/).test(q('#sidebar-nav').textContent), 'in the sidebar');   /* O2 1a: Account help is Workspaces › Requests */ showView('oontu-help'); assert(/ESC-/.test(q('#main-content').textContent) && /Ravi Kumar/.test(q('#main-content').textContent), 'the case is listed'); jnSelect(JN.escalations[0].id); eq(leadStoppedAt(signupLeadById(JN.leadId)), 'Location', 'the lead shows where they stopped');
      const t = q('#jn-sheet').textContent; ['Contact the owner', 'Approve the join', 'Decline', 'Allow a separate workspace', 'Free the domain', 'Move ownership', 'Assisted set-up', 'Timeline'].forEach(function(w){ assert(t.indexOf(w) > -1, 'sheet has ' + w); });
      assert(!/Something went wrong/.test(q('#main-content').textContent), 'no error'); showView('oontu-signups'); openSignupSheet(JN.leadId); assert(/#\/resume\//.test(q('#signup-sheet-root').innerHTML) && /Ask permission to help set up/.test(q('#signup-sheet-root').textContent), 'resume link and assisted set-up on the lead'); closeSignupSheet();
    });
  }
  function leadEventsText(id){ const l = signupLeadById(id); return l && l.followUp ? (l.followUp.events || []).map(function(e){ return e.text; }).join(' | ') : ''; }
  window.addEventListener('load', function(){ setTimeout(function(){ run().catch(function(e){ results.push({ name:'Runner', pass:false, error:String(e && e.stack || e) }); }).then(function(){ const pre = document.createElement('pre'); pre.id = 'auth-test-results'; pre.textContent = JSON.stringify(results); document.body.appendChild(pre); }); }, 50); });
})();
