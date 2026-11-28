// @cx-runner on
/* QA fix A2: the CX-on side of the tests pinned to CX off. With Cowork v2 on, per-agent plans and trials are gone
   (no prices, no "Not in your plan", no Add or trial buttons), LinkedIn automation is refused (no invites are sent by
   the engine, every automation entry point refuses), and the LinkedIn infrastructure settings are hidden from the
   platform's settings. The CX-off behaviour stays proved by cowork-agents, cowork, settings and o2-nav-redirect.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\cx-retired.spec.js */
(function(){
  var results = [], errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e && e.message || e) }); } pub(); }
  function pub(){ var pre = document.getElementById('auth-test-results'); if(!pre){ pre = document.createElement('pre'); pre.id = 'auth-test-results'; document.body.appendChild(pre); } pre.textContent = JSON.stringify(results); }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function eq(a, b, m){ if(a !== b) throw new Error((m ? m + ': ' : '') + 'expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a)); }
  function as(role){ viewingAsFromManager = false; managerViewAsRecruiterId = null; previewAsRoleId = null; state.role = role; renderSidebar(); }
  function main(){ return document.getElementById('main-content').textContent; }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    var app = document.getElementById('app'); app.classList.remove('hidden'); app.classList.add('flex');
    as('admin');

    await t('per-agent plans are gone: every agent is open on every plan, no price, allowance, trial or Add on Cowork', async function(){
      var subs = TENANT_AGENT_SUBSCRIPTIONS[CURRENT_ORGANIZATION_ID]; subs.linkedin = { state:'none', usedThisMonth:0 }; subs.interviews = { state:'trial', usedThisMonth:0, trialEnds:new Date(Date.now() + 7 * 86400000).toISOString() };
      AGENT_CATALOG.forEach(function(a){ ok(agentEntitled(a.id), a.id + ' entitled'); var st = caStatus(a.id); ok(st.key !== 'plan' && st.key !== 'trial', a.id + ': ' + st.label); });
      showView('kairo-team'); CA.tab = 'agents'; CA.agent = null; caRefresh(); var m = main();
      ok(!/₹\s?[\d,]+\s*(per|\/)/.test(m), 'no per-agent price'); ok(!/Not in your plan|Start 14-day trial|Trial ·|Add for ₹/.test(m), 'no plan, trial or Add wording');
      ok(!/₹[\d,]+ per/.test(sec_kairoAgents(true)), 'no price in settings'); ok(/Uses credits from your wallet/.test(sUsage('talent-discovery')), 'no action allowance');
    });
    await t('LinkedIn automation is refused: the engine sends no invites and every entry point refuses', async function(){
      var n = (typeof CW_LI_INVITES !== 'undefined' ? CW_LI_INVITES.length : 0);
      try { cwEngineTick(6 * 3600000); cwRunEngine(); } catch(e){}
      eq(typeof CW_LI_INVITES !== 'undefined' ? CW_LI_INVITES.length : 0, n, 'no invites from the engine');
      ok(liSendConnectionRequests(WORKFLOWS[0], CANDIDATES.slice(0, 3), true, false).refused, 'connection requests refused');
      ok(cwLiCheck({}, {}, {}, {}).blocked, 'engine LinkedIn check blocks'); ok(cwLiOpenAdd().refused, 'no account added through GoLogin');
      eq(cxLiAutomationReachable().length, 0, 'nothing reachable');
    });
    await t('LinkedIn infrastructure settings are hidden from the platform settings; nothing shows the GoLogin token', async function(){
      eq(sSectionById('p-linkedin').can(), false);
      as('oontu'); var plat = SETTINGS_SECTIONS.filter(function(s){ return s.group === 'platform' && (!s.can || s.can()); }).map(function(s){ return s.label; });
      ok(plat.indexOf('LinkedIn infrastructure') < 0, 'not listed: ' + plat.join(', ')); ok(!/GoLogin|proxy/i.test(liSenderProfilesSettingsHTML()), 'no GoLogin or proxy words');
      as('admin');
    });
    pub();
  }, 300); });
})();
