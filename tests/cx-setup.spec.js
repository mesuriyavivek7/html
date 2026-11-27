// @cx-runner on
/* CX C1b: Set up Cowork — checklist, Configure pages and back, agent readiness and fallbacks, WhatsApp setup with a
   rejected template and the payment step, webhook signatures, delivery receipts, the LinkedIn team page (no secrets),
   and WhatsApp billing (meta-direct 1 credit, the demo 2).
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\cx-setup.spec.js */
(function(){
  var results = [], errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e && e.message || e) }); } pub(); }
  function pub(){ var pre = document.getElementById('auth-test-results'); if(!pre){ pre = document.createElement('pre'); pre.id = 'auth-test-results'; document.body.appendChild(pre); } pre.textContent = JSON.stringify(results); }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function eq(a, b, m){ if(a !== b) throw new Error((m ? m + ': ' : '') + 'expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a)); }
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  function as(role){ viewingAsFromManager = false; managerViewAsRecruiterId = null; previewAsRoleId = null; state.role = role; renderSidebar(); }
  function row(id){ return document.querySelector('#cx-setup-card [data-setup="' + id + '"]'); }
  function status(id){ var r = row(id); return r ? r.querySelector('[data-status]').getAttribute('data-status') : null; }
  async function configure(id){ row(id).querySelector('button').click(); await sleep(20); }
  async function back(){ document.getElementById('cx-channel-back').click(); await sleep(20); }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    var app = document.getElementById('app'); app.classList.remove('hidden'); app.classList.add('flex');
    as('admin');

    await t('demo workspace: what it already has counts; the demo keeps 2 credits a WhatsApp template', async function(){
      ok(cxEmailReady(), 'email ready from connected mailboxes'); eq(CX_WA_BILLING.mode, 'oontu-resell'); eq(cxRate('wa-template'), 2);
    });
    await t('a new tenant sees the checklist with every item not set up (credits pre-filled)', async function(){
      cxSetupNewTenant(); eq(CX_WA_BILLING.mode, 'meta-direct'); eq(cxRate('wa-template'), 1, 'meta-direct = 1 credit');
      CA.tab = 'agents'; CA.agent = null; showView('kairo-team'); ok(document.getElementById('cx-setup-card'), 'checklist');
      eq(status('email'), 'Not set up'); eq(status('whatsapp'), 'Not set up'); eq(status('linkedin'), 'Not set up'); eq(status('calendar'), 'Not set up'); ok(/^Ready/.test(status('credits')), 'credits pre-filled'); eq(status('test'), 'Not done');
    });
    await t('agent cards say Ready or Needs: <channel> with a Configure button', async function(){
      var out = document.querySelector('[data-agent="engagement"] [data-ready]'); ok(out && out.getAttribute('data-ready') === 'false' && /Needs: Email/.test(out.textContent), out ? out.textContent : 'no chip');
      eq(cxAgentReadiness('talent-discovery').ready, true, 'Talent Discovery needs nothing'); eq(cxAgentReadiness('linkedin').ready, false, 'LinkedIn Outreach off with no active recruiter');
    });
    await t('Configure › email opens its page; connect, test; back to the checklist ticked', async function(){
      await configure('email'); eq(state.activeNav, 'cx-channel'); eq(document.getElementById('cx-channel').getAttribute('data-channel'), 'email'); ok(/#\/settings\/channels\/email\?return=cowork/.test(location.hash) || CXS.channel === 'email');
      ok(cxEmailConnect('RP-088', 'google').ok); ok(cxEmailTest().ok); showView('cx-channel'); ok(document.querySelector('#cx-channel [data-mailbox="RP-088"]'), 'mailbox listed');
      ok(/Back to Set up Cowork/.test(document.getElementById('cx-channel-back').textContent), 'ready: back button'); await back();
      eq(state.activeNav, 'kairo-team'); eq(status('email'), 'Ready');
    });
    await t('bulk domain: DNS records to copy, Check DNS shows a fix per record', async function(){
      CX_SETUP.email.bulk.subdomain = 'talent.youragency.com'; cxOpenChannel('email'); await sleep(20);
      eq(document.querySelectorAll('#cx-dns tbody tr').length, 5, 'SPF, 2 DKIM, DMARC, return-path'); ok(cxBulkCheck().ok); showView('cx-channel');
      ok(document.querySelector('[data-dns="dmarc"] [data-check="red"]') && /p=none/.test(document.querySelector('[data-dns="dmarc"]').textContent), 'DMARC missing with its fix');
      cxBulkCheck(); ok(Object.keys(CX_SETUP.email.bulk.checked).every(function(k){ return CX_SETUP.email.bulk.checked[k] === 'green'; }), 'all green after fixing');
      await back();
    });
    await t('Outreach falls back to email when WhatsApp is not ready, and says why in the run log', async function(){
      var c = CANDIDATES[0]; cxSetWaConsent(c.id, 'form');
      var r = cxSend({ agent:'outreach', channel:'whatsapp', candidateId:c.id, jobId:'j42', template:'First touch · Active', text:'Hi', action:'First message' });
      ok(r.ok && r.channel === 'email', JSON.stringify(r)); ok(CX_RUNLOG.some(function(l){ return /WhatsApp not connected, sent email/.test(l.text); }), 'logged');
    });
    await t('WhatsApp: waiting for Meta, then waiting for payment method; a rejected template shows its reason and can be resubmitted', async function(){
      ok(!cxWaConnect({ phone:'+91 98200 11111', code:'12' }).ok, 'code checked');
      ok(cxWaConnect({ phone:'+91 98200 11111', code:'123456', displayName:'New Agency' }).ok); eq(cxWaStatus(), 'Waiting for Meta');
      cxWaMetaDone(); eq(cxWaStatus(), 'Waiting for payment method', 'no payment method yet');
      ok(cxWaSubmitStarter().ok); ok(!cxWaTest().ok, 'test refused without payment'); eq(cxWaStatus(), 'Waiting for payment method');
      eq(CX_SETUP.whatsapp.templates.length, 21, '7 templates × English, Hindi, Gujarati');
      cxOpenChannel('whatsapp'); await sleep(20); var rej = document.querySelector('#cx-tpls tr[data-tpl] td:nth-child(3)'); var rr = [].find.call(document.querySelectorAll('#cx-tpls tr[data-tpl]'), function(tr){ return /Rejected/.test(tr.textContent); });
      ok(rr && /starts with a variable/.test(rr.textContent) && /Fix and resubmit/.test(rr.textContent), 'reason and button'); rr.querySelector('button').click(); await sleep(20);
      ok(CX_SETUP.whatsapp.templates.every(function(x){ return x.status === 'Approved'; }), 'resubmitted and approved');
      cxWaAddPayment(); ok(cxWaTest().ok); eq(cxWaStatus(), 'Ready'); showView('cx-channel'); await back(); eq(status('whatsapp'), 'Ready');
    });
    await t('webhooks: a bad signature is refused; a delivery receipt settles the reserved credits (1 credit, meta-direct)', async function(){
      var c = CANDIDATES[1]; cxSetWaConsent(c.id, 'verbal', 'Priya Sharma'); var b0 = cxBalance();
      var r = cxSend({ agent:'outreach', channel:'whatsapp', candidateId:c.id, template:'First touch · Active', action:'First message' }); ok(r.ok && r.channel === 'whatsapp', JSON.stringify(r)); eq(r.credits, 1);
      eq(cxBalance(), b0 - 1);
      var body = JSON.stringify({ id:'evt-in-1', type:'message', candidateId:c.id, text:'Yes interested' });
      eq(cxWebhook(body, 'sha256=bad').status, 401, 'bad signature'); ok(!cxInWaWindow(c.id), 'nothing processed');
      eq(cxWebhook(body, cxSign(body)).status, 200); ok(cxInWaWindow(c.id), '24-hour window open');
      var r2 = cxReserve({ agent:'outreach', rateClass:'wa-template', qty:1 }); var m = { id:'OUT-x' + Date.now(), reservationId:r2.reservationId }; CX_OUTBOX.push(m);
      var st = JSON.stringify({ id:'evt-st-1', type:'status', messageId:m.id, status:'delivered' }); ok(cxWebhook(st, cxSign(st)).ok, 'receipt'); ok(CX_LEDGER.some(function(x){ return x.reservationId === r2.reservationId && x.status === 'charged'; }), 'settled');
      eq(cxWebhook(st, cxSign(st)).duplicate, true, 'same event twice changes nothing');
    });
    await t('LinkedIn team page: one row per recruiter, suggested capacity by account type, no password, cookie or proxy fields', async function(){
      ok(cxLiSet('RP-088', { name:'Priya Sharma' }).ok); cxOpenChannel('linkedin'); await sleep(20);
      var page = document.getElementById('cx-channel'); ok(page.querySelector('[data-li="RP-088"]'), 'row');
      ok(!/password|cookie|session|proxy|token/i.test([].map.call(page.querySelectorAll('input,select,label,th'), function(x){ return (x.getAttribute('aria-label') || '') + ' ' + (x.placeholder || '') + ' ' + x.textContent; }).join(' ')), 'no secret fields');
      ok(!cxLiSet('RP-088', { url:'linkedin.com/x' }).ok, 'profile link checked'); ok(cxLiSet('RP-088', { url:'https://www.linkedin.com/in/priya-sharma', type:'Sales Navigator' }).ok); eq(CX_SETUP.linkedin.team['RP-088'].weekly, 60, 'Sales Navigator suggests 60');
      eq(cxAgentReadiness('linkedin').ready, false, 'not active yet'); cxLiSet('RP-088', { active:true }); eq(cxAgentReadiness('linkedin').ready, true, 'active with capacity');
      ok(cxLiVerify('RP-088').ok); showView('cx-channel'); await back(); ok(/^Ready \(1 recruiter\)/.test(status('linkedin')), status('linkedin'));
    });
    await t('calendar and the test to yourself complete the checklist', async function(){
      await configure('calendar'); ok(cxCalConnect('RP-088', 'microsoft').ok); showView('cx-channel'); await back(); eq(status('calendar'), 'Ready');
      await configure('test'); var tb = document.querySelector('#cx-channel .s-content .o-btn'); ok(tb, 'test page: nav=' + state.activeNav + ' ch=' + CXS.channel + ' ' + (document.getElementById('main-content') || {}).textContent.slice(0, 160)); tb.click(); await sleep(20); await back(); eq(status('test'), 'Done');
      ok(cxSetupDoneRequired(), 'required items done'); ok(cxAgentReadiness('interviews').ready && cxAgentReadiness('outreach').ready, 'agents ready');
    });
    await t('the run never starts a step on a channel that isn’t ready: no fallback means a task', async function(){
      cxSetupNewTenant(); var c = CANDIDATES[2]; var r = cxSend({ agent:'delivery-guardian', channel:'email', candidateId:c.id, action:'Profile is with the client' });
      ok(!r.ok && r.task && /Email not connected/.test(r.reason), JSON.stringify(r));
      cxSetupDemo();
    });
    await t('CX off: no checklist, no readiness chips, no channel pages', async function(){
      cxSetSwitch(false); CA.tab = 'agents'; showView('kairo-team'); ok(!document.getElementById('cx-setup-card') && !document.querySelector('[data-ready]'), 'Cowork as before');
      showView('cx-channel'); ok(!document.getElementById('cx-channel'), 'no page'); cxSetSwitch(true);
    });
    pub();
  }, 300); });
})();
