// @cx-runner on
/* CX C8: migration — every old step has exactly one new owner and no message is sent twice, every hire stage has
   exactly one owner, old workflows still run on the new owners, six agents in order with no "Engagement" text,
   and CX off is exactly as before.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\cx-migration.spec.js */
(function(){
  var results = [], errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e && e.message || e) }); } pub(); }
  function pub(){ var pre = document.getElementById('auth-test-results'); if(!pre){ pre = document.createElement('pre'); pre.id = 'auth-test-results'; document.body.appendChild(pre); } pre.textContent = JSON.stringify(results); }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function eq(a, b, m){ if(a !== b) throw new Error((m ? m + ': ' : '') + 'expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a)); }
  function as(role){ viewingAsFromManager = false; managerViewAsRecruiterId = null; previewAsRoleId = null; state.role = role; renderSidebar(); }
  function q(s){ return document.querySelector(s); }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    var app = document.getElementById('app'); app.classList.remove('hidden'); app.classList.add('flex');
    as('admin');

    await t('every engagement, interviews and offers-joining step has exactly one new owner; no message is sent by two agents', async function(){
      ['engagement', 'interviews', 'offers-joining'].forEach(function(a){ CA_ACTIONS[a].forEach(function(s){ ok(CX_STEP_MAP[a + '.' + s.id], 'no owner for ' + a + '.' + s.id); }); });
      var targets = Object.keys(CX_STEP_MAP).map(function(k){ return CX_STEP_MAP[k]; }), seen = {}; targets.forEach(function(v){ ok(!seen[v], 'two old steps land on ' + v); seen[v] = 1; });
      ok(targets.every(function(v){ return CX_AGENTS.some(function(a){ return a[0] === v.split('.')[0]; }); }), 'only the six agents own steps'); ok(!targets.some(function(v){ return /^engagement\./.test(v); }), 'nothing left on Engagement');
      eq(cxAgentId('engagement'), 'outreach', 'alias'); eq(cxAgentId('offers-joining'), 'delivery-guardian', 'alias');
    });
    await t('ownership map: every hire stage has exactly one owner', async function(){
      var stages = ['intake', 'sourcing', 'first contact · email or WhatsApp', 'first contact · LinkedIn', 'reply', 'prospect', 'interview', 'submitted → feedback', 'offer', 'notice', 'joining', 'guarantee', 'assignment / billing'];
      stages.forEach(function(s){ var owners = CX_AGENTS.filter(function(a){ return CX_OWNERSHIP[s] === a[0]; }); eq(owners.length, 1, s); });
      eq(Object.keys(CX_OWNERSHIP).length, stages.length, 'no extra stages');
    });
    await t('old workflows still run: an Engagement workflow’s sends land on Outreach, logged once in the migration log', async function(){
      cxMigrateWorkflows(); var eng = WORKFLOWS.filter(function(w){ return (w.agentId || w.agentKey) === 'engagement'; }); ok(eng.length, 'seeded Engagement workflows');
      ok(CX_MIGRATION_LOG.some(function(l){ return l.from === 'engagement' && l.to === 'outreach'; }), 'logged'); var n = CX_MIGRATION_LOG.length; cxMigrateWorkflows(); eq(CX_MIGRATION_LOG.length, n, 'one time only');
      var e = cwLedger({ channel:'email', personKey:'c3', workflowId:eng[0].id, agentId:'engagement', status:'sent', action:'Follow-up' }); var row = CX_LEDGER.find(function(r){ return r.reservationId === e.cxReservationId; }); ok(row && row.agent === 'outreach', 'charged to Outreach');
    });
    await t('Cowork shows the six agents in order, each with what it does and “Uses credits from your wallet”; no “Engagement” text', async function(){
      showView('kairo-team'); CA.tab = 'agents'; caRefresh();
      var ids = [].map.call(document.querySelectorAll('#ca-cards [data-cx-agent]'), function(x){ return x.getAttribute('data-cx-agent'); }).join(); eq(ids, 'talent-discovery,outreach,linkedin,interviews,delivery-guardian,revenue-redeploy');
      [].forEach.call(document.querySelectorAll('#ca-cards [data-cx-agent]'), function(c){ ok(/Uses credits from your wallet/.test(c.textContent), 'credit line: ' + c.textContent.slice(0, 60)); });
      ok(!/\bEngagement\b/.test(document.getElementById('main-content').textContent), 'no Engagement on the agents page');
      caOpenAgent('engagement'); ok(!/\bEngagement\b/.test(document.getElementById('main-content').textContent), 'no Engagement on the Outreach page'); caCloseAgent();
      CA.tab = 'credits'; caRefresh(); ok(!/\bEngagement\b/.test(document.getElementById('main-content').textContent), 'no Engagement on Credits'); CA.tab = 'agents';
      ok(!/\bEngagement\b/.test(sec_kairoAgents(true)), 'no Engagement in Cowork settings');
    });
    await t('CX off: today’s five cards and names, exactly as before', async function(){
      cxSetSwitch(false); showView('kairo-team'); CA.tab = 'agents'; caRefresh();
      eq([].map.call(document.querySelectorAll('#ca-cards .ca-card'), function(x){ return x.getAttribute('data-agent'); }).join(), CW.order.join(), 'old order'); ok(/Engagement/.test(document.getElementById('main-content').textContent), 'Engagement back'); ok(!q('[data-cx-agent]'), 'no CX attributes');
      cxSetSwitch(true);
    });
    pub();
  }, 300); });
})();
