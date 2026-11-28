// @o2-runner switches=0b,3a
/* O2 Step 3a: workspace lifecycle (§3.1) — every allowed and refused transition, second person, emergency path,
   archived read-only, retention and trial grace.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\o2-workspace-lifecycle.spec.js */
(function(){
  var results = [];
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e && e.message || e) }); } pub(); }
  function pub(){ var pre = document.getElementById('auth-test-results'); if(!pre){ pre = document.createElement('pre'); pre.id = 'auth-test-results'; document.body.appendChild(pre); } pre.textContent = JSON.stringify(results); }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function eq(a, b, m){ if(a !== b) throw new Error((m ? m + ': ' : '') + 'expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a)); }
  function as(id){ ACTIVE_PLATFORM_USER_ID = id; try { bosActAs(id); } catch(e){} }
  var DAY = 864e5, n = 0, WHY = 'Customer asked for this in writing.';
  var STATUS = { provisioning:'invited', trial:'trial', active:'active', suspended:'suspended', closed:'cancelled', archived:'archived' };
  function ws(life, subStatus){
    n++; var tn = { id:'org-lc' + n, name:'Lifecycle ' + n, status:STATUS[life], createdAt:new Date(bosNow() - 30 * DAY).toISOString(), internal:false };
    if(life !== STATUS[life] || life === 'closed') tn.lifecycleState = life; if(life === 'closed') tn.closedAt = new Date(bosNow() - 5 * DAY).toISOString();
    PLATFORM_TENANTS.push(tn);
    if(subStatus){ var s = { id:'sub-lc' + n, tenantId:tn.id, planId:'plan-floor', status:subStatus, startDate:'2026-10-01', renewalDate:new Date(bosNow() + 20 * DAY).toISOString().slice(0, 10), billingInterval:'monthly', price:2999, currency:'INR', seats:1, createdAt:new Date().toISOString() }; PLATFORM_SUBSCRIPTIONS.push(s); tn.subscriptionId = s.id; }
    return tn;
  }
  var approver = null;
  function decide(a){ as(approver); var r = bosDecide(a.id, true, 'Checked the evidence with the customer and the account owner; the change is justified.', 'Evidence checked and valid'); as('PU-001'); return r; }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    state.role = 'oontu'; as('PU-001'); var app = document.getElementById('app'); app.classList.remove('hidden'); app.classList.add('flex'); renderSidebar(); await sleep(30);
    /* only the Super Admin holds platform-tenant:activate in the seeds; give Ishaan the Platform Manager role as this spec's second person */
    var g = bosSetRoles('PU-110', ['tpl_plat_mgr']); if(!g.ok) results.push({ name:'setup: second person', pass:false, error:g.reason });
    approver = PLATFORM_USER_ROSTER.filter(function(u){ return u.id !== 'PU-001' && u.status === 'Active' && !u.system && bosCan('platform-tenant', 'activate', null, u); }).map(function(u){ return u.id; })[0];

    await t('approval types are registered while 3a is on; someone other than the requester can approve', async function(){
      ok(BOS_APPROVAL_TYPES['workspace-suspend'] && BOS_APPROVAL_TYPES['workspace-archive-early'] && BOS_APPROVAL_TYPES['workspace-close'], 'types'); ok(approver, 'a second person exists: ' + approver);
    });
    await t('acceptance 1a: every allowed transition in §3.1 works', async function(){
      var w = ws('provisioning'); var r = o2WorkspaceMove(w.id, 'trial', {}); ok(r.ok, 'provisioning → trial: ' + r.reason); eq(o2Lifecycle(w), 'trial'); eq(w.status, 'trial');
      w = ws('provisioning', 'active'); r = o2WorkspaceMove(w.id, 'active', {}); ok(r.ok, 'provisioning → active with a paid subscription: ' + r.reason);
      w = ws('provisioning'); ok(!o2WorkspaceMove(w.id, 'active', {}).ok, 'provisioning → active refused without a paid subscription');
      w = ws('trial', 'trial'); subscriptionForTenant(w.id).status = 'active'; o2LifecycleRun(); eq(o2Lifecycle(w), 'active', 'trial → active automatically on a paid subscription'); eq(w.lifecycle.slice(-1)[0].actorType, 'system'); ok(BOS.events.some(function(e){ return e.name === 'workspace.lifecycle-run' && e.actor === 'SYS-BILLING'; }), 'the scheduled run is one system command (O2 audit)');
      w = ws('trial', 'trial'); var s = subscriptionForTenant(w.id); s.renewalDate = new Date(bosNow() - (o2Policy('trialGraceDays') + 2) * DAY).toISOString().slice(0, 10); o2LifecycleRun(); eq(o2Lifecycle(w), 'closed', 'trial → closed after the grace days'); eq(w.status, 'cancelled', 'old status kept current');
      w = ws('trial', 'trial'); r = o2WorkspaceMove(w.id, 'suspended', { reason:WHY }); ok(r.ok && r.pending, 'trial → suspended asks a second person'); decide(r.approval); eq(o2Lifecycle(w), 'suspended');
      w = ws('active', 'active'); r = o2WorkspaceMove(w.id, 'closed', { reason:WHY }); ok(r.ok && !r.pending, 'active → closed: ' + r.reason); eq(o2Lifecycle(w), 'closed');
      w = ws('suspended', 'active'); r = o2WorkspaceMove(w.id, 'active', { reason:WHY }); ok(r.ok, 'suspended → active (restore): ' + r.reason);
      w = ws('suspended', 'active'); r = o2WorkspaceMove(w.id, 'closed', { reason:WHY }); ok(r.ok && r.pending, 'suspended → closed asks a second person'); decide(r.approval); eq(o2Lifecycle(w), 'closed');
      w = ws('closed', 'active'); r = o2WorkspaceMove(w.id, 'active', { reason:WHY }); ok(r.ok, 'closed → active within retention with an active subscription: ' + r.reason); eq(w.status, 'active');
      w = ws('closed'); r = o2WorkspaceMove(w.id, 'archived', { reason:WHY }); ok(r.ok && r.pending, 'early archive asks a second person'); decide(r.approval); eq(o2Lifecycle(w), 'archived');
    });
    await t('acceptance 1b: every other transition is refused with a reason', async function(){
      var states = ['provisioning', 'trial', 'active', 'suspended', 'closed', 'archived'], refused = 0;
      states.forEach(function(from){ states.forEach(function(to){ if(from === to || O2_LIFECYCLE[from].indexOf(to) > -1) return; var w = ws(from, 'active'); var r = o2WorkspaceMove(w.id, to, { reason:WHY }); ok(!r.ok && r.reason, from + ' → ' + to + ' should be refused'); eq(o2Lifecycle(w), from, 'unchanged'); refused++; }); });
      ok(refused >= 15, 'refused cases: ' + refused);
      var w = ws('active', 'active'); var r = o2WorkspaceMove(w.id, 'suspended', { reason:'x' }); ok(!r.ok && r.field === 'reason', 'a reason is required');
      w = ws('closed'); r = o2WorkspaceMove(w.id, 'active', { reason:WHY }); ok(!r.ok && /active subscription/.test(r.reason), 'restore needs an active subscription');
    });
    await t('acceptance 2: one person cannot suspend while suspendNeedsSecondPerson is true; the requester can’t approve', async function(){
      var w = ws('active', 'active'), r = o2WorkspaceMove(w.id, 'suspended', { reason:WHY }); ok(r.pending, 'sent for approval'); eq(o2Lifecycle(w), 'active', 'still active');
      ok(!bosCanDecide(r.approval, currentPlatformUser()).ok, 'the requester can’t decide'); ok(!o2WorkspaceMove(w.id, 'suspended', { reason:WHY }).ok, 'no duplicate request');
      var d = decide(r.approval); ok(d.ok, d.reason); eq(o2Lifecycle(w), 'suspended'); eq(w.lifecycle.slice(-1)[0].approvalId, r.approval.id, 'approval id on the event');
      PLATFORM_SETTINGS.policy.suspendNeedsSecondPerson = false; w = ws('active', 'active'); r = o2WorkspaceMove(w.id, 'suspended', { reason:WHY }); ok(r.ok && !r.pending, 'policy off: immediate'); PLATFORM_SETTINGS.policy.suspendNeedsSecondPerson = true;
    });
    await t('emergency path: a Security Administrator suspends alone and an integrity finding is raised', async function(){
      var w = ws('active', 'active'); as('PU-108'); var r = o2WorkspaceMove(w.id, 'suspended', { reason:'Credential stuffing seen from this workspace.', emergency:true }); as('PU-001');
      ok(r.ok && !r.pending, r.reason); eq(o2Lifecycle(w), 'suspended'); ok(w.lifecycle.slice(-1)[0].emergency, 'marked emergency');
      ok(BOS.exceptions.some(function(e){ return e.rule === 'emergency-suspension-review' && /Lifecycle/.test(e.title); }), 'finding raised');
      as('PU-101'); ok(!o2WorkspaceMove(ws('active', 'active').id, 'suspended', { reason:WHY, emergency:true }).ok, 'not for others'); as('PU-001');
    });
    await t('acceptance 3: each change writes a lifecycle event and an audit row', async function(){
      var w = ws('active', 'active'), before = AUDIT_LOG.length; o2WorkspaceMove(w.id, 'closed', { reason:WHY });
      eq(w.lifecycle.length, 1); var ev = w.lifecycle[0]; ok(ev.from === 'active' && ev.to === 'closed' && ev.by === 'PU-001' && ev.actorType === 'employee' && ev.reason === WHY && ev.at, JSON.stringify(ev));
      ok(AUDIT_LOG.length > before && AUDIT_LOG.some(function(e){ return e.action === 'Workspace closed' && e.detail.indexOf(w.name) > -1; }), 'audit row'); ok(BOS.events.some(function(e){ return e.name === 'workspace.close' && e.ref === w.id; }), 'domain event');
      eq(w.statusHistory.slice(-1)[0].to, 'cancelled', 'old history kept');
    });
    await t('archived is read-only with a tombstone; retention end archives automatically', async function(){
      var w = ws('closed'); w.closedAt = new Date(bosNow() - (o2Policy('closedRetentionDays') + 1) * DAY).toISOString();
      ok(!o2WorkspaceMove(w.id, 'active', { reason:WHY }).ok, 'restore refused after retention'); o2LifecycleRun(); eq(o2Lifecycle(w), 'archived');
      ok(w.tombstone && w.tombstone.id === w.id && w.tombstone.name === w.name && w.tombstone.archivedAt, 'tombstone'); ok(w.dataDeleted, 'data marked deleted');
      ['active', 'suspended', 'closed', 'trial'].forEach(function(to){ var r = o2WorkspaceMove(w.id, to, { reason:WHY }); ok(!r.ok && /archived/.test(r.reason), to + ' refused'); });
      ok(!activateTenant(w.id).ok, 'older commands refuse too'); eq(o2AccessLevel(w).level, 'blocked');
    });
    await t('the old tenant page’s actions call the new commands; switch off restores the old function', async function(){
      var w = ws('active', 'active'); var r = changeTenantStatus(w.id, 'suspended', { reason:WHY }); ok(!r.ok && r.pending && /second person/.test(r.reason), 'old action → approval');
      r = changeTenantStatus(w.id, 'cancelled', { reason:WHY }); ok(r.ok, r.reason); eq(o2Lifecycle(w), 'closed');
      o2SetSwitch('3a', false); w = ws('active', 'active'); r = changeTenantStatus(w.id, 'suspended', WHY); ok(r.ok, 'old behaviour: immediate'); eq(w.status, 'suspended'); ok(!w.lifecycle, 'no lifecycle written while off'); ok(!BOS_APPROVAL_TYPES['workspace-suspend'], 'types removed while off'); o2SetSwitch('3a', true);
    });
    pub();
  }, 300); });
})();
