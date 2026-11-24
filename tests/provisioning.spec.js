/* Shared provisioning engine (ADR-05; docs/oontu-evolution 21, 23 J2): Super Admin Create tenant and self-service Create workspace
   both go through provisionTenant(). Idempotent, resumable after a failed step, audited; a self-service customer appears in Tenants.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\provisioning.spec.js   (helpers copied from signup-recovery.spec.js) */
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

  function asOontu(){ state.role = 'oontu'; ACTIVE_PLATFORM_USER_ID = 'PU-001'; }
  function count(){ return { t:PLATFORM_TENANTS.length, a:PLATFORM_TENANT_ADMINS.length, s:PLATFORM_SUBSCRIPTIONS.length }; }
  function activePlan(){ return PLATFORM_PLANS.find(function(p){ return p.status === 'active'; }); }
  function sameCount(a, b, m){ eq(JSON.stringify(a), JSON.stringify(b), m); }

  async function run(){
    await test('P1 assisted creation goes through the engine: one tenant, owner invite, trial subscription, platform audit with the platform user as actor', async function(){
      asOontu(); const before = count(), plan = activePlan();
      const res = createInvitedTenant({ idempotencyKey:'t-p1', company:'Acme Hiring', ownerName:'Asha Rao', ownerEmail:'asha@acmehiring.example', mobileCode:'+91', mobile:'98250 41207', type:'Corporate', planId:plan.id, note:'from a won deal' });
      assert(res.ok, 'created: ' + res.reason); const t = res.tenant;
      eq(t.status, 'invited'); eq(t.channel, 'assisted'); eq(t.orgType, 'Corporate'); assert(t.inviteToken && t.workspaceId, 'owner invitation and workspace');
      eq(res.request.status, 'completed'); assert(res.request.steps.every(function(s){ return s.status === 'done'; }), 'every step done');
      const a = tenantAdminById(t.primaryAdminUserId); assert(a && a.status === 'Invited' && a.email === 'asha@acmehiring.example', 'owner record invited');
      const sub = subscriptionById(t.subscriptionId); assert(sub && sub.status === 'trial' && sub.planId === plan.id, 'trial subscription for the chosen plan');
      eq(count().t, before.t + 1, 'one tenant'); eq(count().s, before.s + 1, 'one subscription'); eq(count().a, before.a + 1, 'one owner');
      const entry = AUDIT_LOG.filter(function(x){ return x.action === 'Tenant created' && x.entityId === t.id; })[0];
      assert(entry && entry.actorPlatformUserId === 'PU-001', 'platform audit names the platform user: ' + JSON.stringify(entry && entry.actorPlatformUserId));
    });
    await test('P2 the same idempotency key replays the same tenant: a double submit creates nothing more', async function(){
      asOontu(); const plan = activePlan();
      const first = createInvitedTenant({ idempotencyKey:'t-p2', company:'Brightline', ownerName:'Ben Ali', ownerEmail:'ben@brightline.example', type:'Staffing agency', planId:plan.id });
      assert(first.ok, first.reason); const mid = count();
      const again = createInvitedTenant({ idempotencyKey:'t-p2', company:'Brightline', ownerName:'Ben Ali', ownerEmail:'ben@brightline.example', type:'Staffing agency', planId:plan.id });
      assert(again.ok && again.replayed, 'replayed'); eq(again.tenant.id, first.tenant.id, 'same tenant'); sameCount(count(), mid, 'nothing new');
    });
    await test('P3 a failed step leaves a retryable request; the retry resumes from that step without duplicating tenant, owner, invitation or subscription', async function(){
      asOontu(); const plan = activePlan(); const before = count();
      window.OONTU_PROVISION_FAIL_AT = 'subscription';
      const r1 = createInvitedTenant({ idempotencyKey:'t-p3', company:'Cobalt Works', ownerName:'Cora Lin', ownerEmail:'cora@cobalt.example', type:'Corporate', planId:plan.id });
      assert(!r1.ok && r1.retryable && r1.step === 'subscription', 'failed at subscription: ' + JSON.stringify(r1));
      eq(r1.request.status, 'failed'); eq(count().t, before.t + 1, 'tenant was made once'); eq(count().s, before.s, 'no subscription yet');
      const token = tenantById(r1.request.tenantId).inviteToken;
      const r2 = createInvitedTenant({ idempotencyKey:'t-p3', company:'Cobalt Works', ownerName:'Cora Lin', ownerEmail:'cora@cobalt.example', type:'Corporate', planId:plan.id });
      assert(r2.ok && !r2.replayed, 'completed on retry: ' + r2.reason); eq(r2.tenant.id, r1.request.tenantId, 'same tenant');
      eq(r2.tenant.inviteToken, token, 'same invitation, not a second one'); eq(count().t, before.t + 1); eq(count().a, before.a + 1); eq(count().s, before.s + 1, 'exactly one subscription');
      const sub = r2.request.steps.find(function(s){ return s.name === 'subscription'; }); eq(sub.attempts, 2, 'the failed step ran twice'); eq(r2.request.steps[0].attempts, 1, 'earlier steps did not rerun');
      assert(AUDIT_LOG.some(function(x){ return x.action === 'Provisioning step failed' && x.entityId === r1.request.tenantId; }), 'the failure is audited');
    });
    await test('P4 validation and permission: missing name, personal email or claimed domain is refused before anything exists; without platform permission nothing happens', async function(){
      asOontu(); const before = count();
      let r = createInvitedTenant({ idempotencyKey:'t-p4a', company:'', ownerName:'X', ownerEmail:'x@y.example', type:'Corporate' }); assert(!r.ok && r.field === 'company', 'name required');
      r = createInvitedTenant({ idempotencyKey:'t-p4b', company:'Gmail Co', ownerName:'G', ownerEmail:'g.someone@gmail.com', type:'Corporate' }); assert(!r.ok && r.field === 'email', 'personal email refused for a company: ' + r.reason);
      r = createInvitedTenant({ idempotencyKey:'t-p4c', company:'Infosys Again', ownerName:'I', ownerEmail:'new.person@infosys.com', type:'Corporate' }); assert(!r.ok && /already has an Oontu workspace/.test(r.reason), 'claimed domain refused: ' + r.reason);
      sameCount(count(), before, 'nothing was created by refused requests');
      state.role = 'recruiter'; ACTIVE_PLATFORM_USER_ID = null;
      r = provisionTenant({ channel:'assisted', idempotencyKey:'t-p4d', company:'Sneaky', ownerName:'S', ownerEmail:'s@sneaky.example', type:'Corporate' });
      assert(!r.ok && /platform permission/.test(r.reason), 'a tenant user cannot provision: ' + r.reason); sameCount(count(), before, 'still nothing');
      r = provisionTenant({ channel:'self_service', idempotencyKey:'t-p4e', company:'No Workspace', ownerName:'N', ownerEmail:'n@nows.example' });
      assert(!r.ok && r.field === 'workspaceId', 'self-service needs the workspace the signed-in owner created');
    });
    await test('P5 self-service Create workspace registers the tenant through the same engine: trial, active owner, visible to Super Admin, created once', async function(){
      const before = count();
      await signUpTo(null, 'corporate', { name:'Dana', email:'dana@newcorp.example', org:'Newcorp Industries' });
      assert(await waitFor(function(){ return PLATFORM_TENANTS.length > before.t; }, 4000), 'a platform tenant appeared');
      const t = PLATFORM_TENANTS.filter(function(x){ return x.channel === 'self_service' && x.ownerEmail === 'dana@newcorp.example'; });
      eq(t.length, 1, 'exactly one tenant for the sign-up'); const ten = t[0];
      eq(ten.status, 'trial'); eq(ten.orgType, 'Corporate'); eq(ten.name, 'Newcorp Industries'); assert(ten.workspaceId, 'linked to the workspace the owner created');
      const a = tenantAdminById(ten.primaryAdminUserId); assert(a && a.status === 'Active', 'the owner is already in, so the owner record is active');
      const req = provisioningRequestFor('self:' + ten.workspaceId); assert(req && req.status === 'completed', 'request completed');
      const replay = provisionTenant({ channel:'self_service', idempotencyKey:'self:' + ten.workspaceId, workspaceId:ten.workspaceId, company:ten.name, ownerName:'Dana', ownerEmail:'dana@newcorp.example', type:'Corporate' });
      assert(replay.ok && replay.replayed && replay.tenant.id === ten.id, 'a repeat of the step replays the same tenant'); eq(count().t, before.t + 1);
      assert(AUDIT_LOG.some(function(x){ return x.action === 'Tenant created' && x.entityId === ten.id && /self-service/.test(x.detail || ''); }), 'audited as self-service');
      asOontu(); showView('oontu-tenants'); await sleep(30); assert(/Newcorp Industries/.test(q('#main-content').textContent), 'listed in Super Admin › Tenants');
    });
    await test('P7 an existing request is never revealed without permission, and a key cannot be reused for a different owner', async function(){
      asOontu(); const done = createInvitedTenant({ idempotencyKey:'t-p7', company:'Delta Labs', ownerName:'Dev Rao', ownerEmail:'dev@deltalabs.example', type:'Corporate' }); assert(done.ok, done.reason);
      state.role = 'recruiter'; ACTIVE_PLATFORM_USER_ID = null;
      let r = provisionTenant({ channel:'assisted', idempotencyKey:'t-p7', company:'Delta Labs', ownerName:'Dev Rao', ownerEmail:'dev@deltalabs.example', type:'Corporate' });
      assert(!r.ok && !r.tenant && /platform permission/.test(r.reason), 'a tenant user gets no tenant record by replaying a key: ' + JSON.stringify(r).slice(0, 120));
      asOontu();
      r = createInvitedTenant({ idempotencyKey:'t-p7', company:'Delta Labs', ownerName:'Dev Rao', ownerEmail:'other@deltalabs.example', type:'Corporate' });
      assert(!r.ok && r.field === 'idempotencyKey', 'reusing a completed key for another owner is refused: ' + r.reason);
    });
    await test('P8 Super Admin sheet: a failed step pauses with a message; pressing Create again resumes the same tenant and closes the sheet', async function(){
      asOontu(); showView('oontu-tenants'); await sleep(20); const before = count(), plan = activePlan();
      openCreateTenantModal(); await sleep(10); assert(ctSheet && ctSheet.idemKey, 'the sheet carries one idempotency key');
      Object.assign(ctSheet, { company:'Echo Retail', name:'Eli Moss', email:'eli@echoretail.example', mobileCode:'+91', mobile:'98250 41207', type:'Corporate', planId:plan.id });
      window.OONTU_PROVISION_FAIL_AT = 'owner'; ctSubmit(); await sleep(20);
      assert(ctSheet, 'the sheet stays open after a paused step'); assert(/Setup paused at the owner step/.test(document.getElementById('toast-container').textContent), 'the pause is explained');
      eq(count().t, before.t + 1, 'the tenant was started once'); eq(count().a, before.a, 'no owner yet');
      ctSubmit(); await sleep(20);
      assert(!ctSheet, 'the sheet closed after the resumed run'); eq(count().t, before.t + 1, 'still one tenant'); eq(count().a, before.a + 1, 'one owner'); eq(count().s, before.s + 1, 'one subscription');
      const t = PLATFORM_TENANTS.find(function(x){ return x.ownerEmail === 'eli@echoretail.example'; }); assert(t && t.status === 'invited' && t.inviteToken, 'invited tenant with its single invitation');
    });
    await test('P9 Super Admin sheet: changing the owner email after a paused step is refused on the email field, nothing new is created, no script error', async function(){
      asOontu(); showView('oontu-tenants'); await sleep(20); const plan = activePlan();
      openCreateTenantModal(); await sleep(10);
      Object.assign(ctSheet, { company:'Foxtrot Foods', name:'Fay Ng', email:'fay@foxtrot.example', mobileCode:'+91', mobile:'98250 41207', type:'Staffing agency', planId:plan.id });
      window.OONTU_PROVISION_FAIL_AT = 'subscription'; ctSubmit(); await sleep(20); const mid = count();
      ctSheet.email = 'someone.else@foxtrot.example'; ctSubmit(); await sleep(20);
      assert(ctSheet && /started for another owner email/.test(ctSheet.errors.email || ''), 'explained on the email field: ' + JSON.stringify(ctSheet && ctSheet.errors));
      sameCount(count(), mid, 'nothing new was created');
    });
    await test('P10 platform roles: Support cannot provision, Operations can, a suspended platform user cannot even with a permitted role', async function(){
      const added = [{ id:'PU-T-SUP', name:'Sam Support', email:'sam@oontu.internal', platformRoleId:'role_oontu_support', status:'Active' },
                     { id:'PU-T-OPS', name:'Omar Ops', email:'omar@oontu.internal', platformRoleId:'role_oontu_operations', status:'Active' },
                     { id:'PU-T-OFF', name:'Opal Off', email:'opal@oontu.internal', platformRoleId:'role_oontu_operations', status:'Suspended' }];
      added.forEach(function(u){ PLATFORM_USER_ROSTER.push(u); });
      try {
        state.role = 'oontu'; const before = count();
        ACTIVE_PLATFORM_USER_ID = 'PU-T-SUP';
        let r = createInvitedTenant({ idempotencyKey:'t-p10a', company:'Golf Group', ownerName:'Gia', ownerEmail:'gia@golfgroup.example', type:'Corporate' });
        assert(!r.ok && /platform permission/.test(r.reason), 'Support is refused: ' + r.reason);
        ACTIVE_PLATFORM_USER_ID = 'PU-T-OFF';
        r = createInvitedTenant({ idempotencyKey:'t-p10b', company:'Golf Group', ownerName:'Gia', ownerEmail:'gia@golfgroup.example', type:'Corporate' });
        assert(!r.ok, 'a suspended Operations user is refused'); sameCount(count(), before, 'nothing created');
        ACTIVE_PLATFORM_USER_ID = 'PU-T-OPS';
        r = createInvitedTenant({ idempotencyKey:'t-p10c', company:'Golf Group', ownerName:'Gia', ownerEmail:'gia@golfgroup.example', type:'Corporate' });
        assert(r.ok, 'Operations may create tenants: ' + r.reason); eq(r.tenant.createdBy, 'Omar Ops', 'the actor is the Operations user');
      } finally {
        added.forEach(function(u){ const i = PLATFORM_USER_ROSTER.indexOf(u); if(i > -1) PLATFORM_USER_ROSTER.splice(i, 1); }); ACTIVE_PLATFORM_USER_ID = 'PU-001';
      }
    });
    await test('P6 the legacy createTenant has no path of its own: it delegates to the engine (validation and idempotency included)', async function(){
      asOontu(); const before = count();
      const r = createTenant({ idempotencyKey:'t-p6', name:'Legacy Path Ltd', adminName:'Lee', adminEmail:'lee@legacypath.example', type:'Staffing agency' });
      assert(r.ok && r.request && r.request.status === 'completed', 'created through the engine: ' + r.reason); eq(r.tenant.channel, 'assisted');
      const again = createTenant({ idempotencyKey:'t-p6', name:'Legacy Path Ltd', adminName:'Lee', adminEmail:'lee@legacypath.example' }); assert(again.replayed, 'idempotent'); eq(count().t, before.t + 1);
    });
  }
  window.addEventListener('load', function(){ setTimeout(function(){ run().catch(function(e){ results.push({ name:'Runner', pass:false, error:String(e && e.stack || e) }); }).then(function(){ const pre = document.createElement('pre'); pre.id = 'auth-test-results'; pre.textContent = JSON.stringify(results); document.body.appendChild(pre); }); }, 50); });
})();
