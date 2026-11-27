// @o2-runner switches=7a,7b
/* O2 Step 7b: second sign-in step for Oontu employees; step-up for high-risk commands after policy.stepUpMinutes.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\o2-mfa.spec.js */
(function(){
  var results = [];
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e && e.message || e) }); } pub(); }
  function pub(){ var pre = document.getElementById('auth-test-results'); if(!pre){ pre = document.createElement('pre'); pre.id = 'auth-test-results'; document.body.appendChild(pre); } pre.textContent = JSON.stringify(results); }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function eq(a, b, m){ if(a !== b) throw new Error((m ? m + ': ' : '') + 'expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a)); }
  async function firstStep(email){ var r = await authApi.passwordSignIn({ email:email, password:'demo1234' }); ok(r.ok, r.reason); var s = await authApi.selectWorkspace({ workspaceId:r.workspaces[0].id }); var e = authEnter(s, 'signin'); await sleep(40); return e; }

  window.addEventListener('load', function(){ setTimeout(async function(){
    try { localStorage.removeItem('oontu.o2.switches.v1'); } catch(e){}

    await t('the password alone does not enter the platform; the second step does', async function(){
      var e = await firstStep('meera@oontu.internal'); ok(e && e.pendingMfa, 'second step asked'); ok(o2MfaPending()); ok(/Confirm it’s you/.test(document.getElementById('bos-dialog-root').textContent), 'dialog');
      ok(state.role !== 'oontu' || state.activeNav !== 'oontu-dashboard', 'not in yet');
      var bad = o2MfaSubmit('111111'); ok(!bad.ok, 'wrong code refused'); ok(AUDIT_LOG.some(function(x){ return x.action === 'Sign-in failed' && /second step/.test(x.detail); }), 'wrong code logged'); ok(!AUDIT_LOG.some(function(x){ return /111111/.test(JSON.stringify(x)); }), 'code not stored');
      var good = o2MfaSubmit(o2MfaCode()); ok(good.ok); await sleep(40); eq(state.role, 'oontu'); eq(ACTIVE_PLATFORM_USER_ID, 'PU-001'); ok(O2_SESSION.mfaAt, 'mfaAt on the session');
    });
    await t('the email code alone no longer signs in either', async function(){
      if(typeof authApi.sendCode !== 'function' || typeof authApi.verifyCode !== 'function'){ ok(true); return; }
      await authApi.sendCode({ email:'kavya@oontu.internal' }); var mail = authApi._latestEmail('kavya@oontu.internal'); var v = await authApi.verifyCode({ email:'kavya@oontu.internal', code:mail ? mail.code : '123456' });
      if(v && v.ok && v.workspaces){ var s = await authApi.selectWorkspace({ workspaceId:v.workspaces[0].id }); var e = authEnter(s, 'code'); ok(e && e.pendingMfa, 'second step after the email code'); ok(o2MfaSubmit(o2MfaCode()).ok); }
      else ok(true, 'code sign-in returned ' + JSON.stringify(v).slice(0, 80));
    });
    await t('high-risk commands ask again after stepUpMinutes; confirming lets them run', async function(){
      var e = await firstStep('vikram@oontu.internal'); ok(e.pendingMfa); o2MfaSubmit(o2MfaCode()); await sleep(20); eq(ACTIVE_PLATFORM_USER_ID, 'PU-106');
      var g = generateInvoiceForSubscription(subscriptionForTenant('org-northstar').id); ok(g.ok, g.reason);
      ok(!o2NeedsStepUp('payment.verify'), 'fresh: no step-up'); ok(!o2NeedsStepUp('ticket.create'), 'ordinary commands never');
      O2_SESSION.mfaAt = new Date(bosNow() - (o2Policy('stepUpMinutes') + 1) * 6e4).toISOString();
      ok(o2NeedsStepUp('payment.verify') && o2NeedsStepUp('export.audit') && o2NeedsStepUp('workspace.suspend') && o2NeedsStepUp('payment.allocate'), 'the listed commands need it');
      var r = bosRun('approval.decide', null, function(){ return { ok:true }; }); ok(!r.ok && r.needsStepUp, 'refused until confirmed'); bosDialogClose();
      ok(!o2StepUp('000000').ok, 'wrong code'); ok(o2StepUp(o2MfaCode()).ok); r = bosRun('approval.decide', null, function(){ return { ok:true }; }); ok(r.ok, 'runs after the step-up');
    });
    await t('agents stay refused outright; the prototype tools show the code', async function(){
      var a = bosAsAgent(function(){ return bosRun('refund.approve', null, function(){ return { ok:true }; }); }); ok(!a.ok, 'agent refused');
      ok(/246810/.test(bosDevLoginsHTML()), 'code shown in the tools');
    });
    await t('switch 7b off: the first step enters directly again', async function(){
      o2SetSwitch('7b', false); var e = await firstStep('arjun@oontu.internal'); ok(!(e && e.pendingMfa), 'no second step'); eq(ACTIVE_PLATFORM_USER_ID, 'PU-101'); o2SetSwitch('7b', true);
    });
    pub();
  }, 300); });
})();
