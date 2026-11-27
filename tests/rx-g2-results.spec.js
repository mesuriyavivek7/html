// @rx-runner switches=g1,g2
/* RX G2: automation results — a touch 10 days before a submission credits the fee, a touch 45 days before does not,
   the most recent touch gets the credit ("also touched" for others), people without billing view see counts but no
   amounts, the Results tab and the Home card appear only with G2 on.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\rx-g2-results.spec.js */
(function(){
  var results = [];
  var errs = [];
  window.__RX_NO_TIMER__ = true;
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e && e.message || e) }); } pub(); }
  function pub(){ var pre = document.getElementById('auth-test-results'); if(!pre){ pre = document.createElement('pre'); pre.id = 'auth-test-results'; document.body.appendChild(pre); } pre.textContent = JSON.stringify(results); }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function eq(a, b, m){ if(a !== b) throw new Error((m ? m + ': ' : '') + 'expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a)); }
  var DAY = 86400000, NOW = Date.now();
  function iso(daysAgo){ return new Date(NOW - daysAgo * DAY).toISOString(); }
  function touch(wfId, cid, daysAgo){ RX.touches.push({ id:'TCH-spec-' + RX.touches.length, workflowId:wfId, candidateId:cid, channel:'whatsapp', action:'Message', at:iso(daysAgo), outcome:'Sent', event:'spec' }); }
  function as(role){ viewingAsFromManager = false; managerViewAsRecruiterId = null; previewAsRoleId = null; state.role = role; renderSidebar(); }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    var app = document.getElementById('app'); app.classList.remove('hidden'); app.classList.add('flex');
    as('admin');
    /* a perm placement with no contract assignment: its fee is the money */
    var pl = PLACEMENTS.find(function(p){ return p.feeAmount && !ASSIGNMENTS.some(function(a){ return a.candidateId === p.candidateId; }); });
    var W = WORKFLOWS[0], agent = cwNormalise(W).agentId;
    var W2 = { id:'wf-rx-late', name:'Late touch', status:'Published', trigger:'Stage Changed', steps:[] }; WORKFLOWS.push(W2);
    var W3 = { id:'wf-rx-older', name:'Older touch', status:'Published', trigger:'Stage Changed', steps:[] }; WORKFLOWS.push(W3);
    var other = CANDIDATES.find(function(c){ return c.id !== pl.candidateId && !SUBMISSIONS.some(function(s){ return s.candidateId === c.id; }); }) || CANDIDATES.find(function(c){ return c.id !== pl.candidateId; });
    /* submission 10 days ago, joined 2 days ago; W touched 20 days ago (10 before the submission), W3 25 days ago */
    var sub = { id:'sub-rx-g2', jobId:pl.jobId, candidateId:pl.candidateId, stage:'Joined', status:'Active', createdAt:iso(10), stageHistory:[{ stage:'Submitted', at:iso(10) }, { stage:'Client Interview', at:iso(7) }, { stage:'Joined', at:iso(2) }], offer:{ ctc:18, status:'Accepted', at:iso(4) } };
    var sub2 = { id:'sub-rx-g2b', jobId:pl.jobId, candidateId:other.id, stage:'Submitted', status:'Active', createdAt:iso(5), stageHistory:[{ stage:'Submitted', at:iso(5) }] };
    SUBMISSIONS.push(sub, sub2);
    touch(W.id, pl.candidateId, 20); touch(W3.id, pl.candidateId, 25); touch(W2.id, other.id, 50);

    await t('defaults: attribution window 30 days; vendor fee falls back to the 8.33% assumption', async function(){
      eq(WSX.rx.attributionDays, 30); var f = rxVendorFeePct(); eq(f.pct, 8.33); ok(f.assumed, 'shown as an assumption');
    });
    await t('a touch 10 days before the submission credits the workflow, the most recent touch wins, others are "also touched"', async function(){
      var a = rxAttribute({ candidateId:pl.candidateId, jobId:pl.jobId, at:iso(10) });
      ok(a, 'attributed'); eq(a.workflowId, W.id); eq(a.daysBefore, 10); eq(a.also.join(), W3.id);
    });
    await t('the perm fee from PLACEMENTS.feeAmount (rupees) is credited with the join', async function(){
      var r = rxResults({ days:90, workflowIds:[W.id] }).rows[0];
      ok(r && r.counts.joins >= 1 && r.counts.submissions >= 1 && r.counts.interviews >= 1 && r.counts.offers >= 1, JSON.stringify(r && r.counts));
      ok(r.records.joins.some(function(x){ return x.submissionId === sub.id && x.money && x.money.amount === pl.feeAmount && x.money.kind === 'fee'; }), 'fee on the join record');
      ok(r.money >= pl.feeAmount, 'money ' + r.money);
    });
    await t('a touch 45 days before does not count', async function(){
      eq(rxAttribute({ candidateId:other.id, at:iso(5) }), null);
      var r2 = rxResults({ days:365, workflowIds:[W2.id] }).rows[0] || { records:{ submissions:[] } };
      ok(!r2.records.submissions.some(function(x){ return x.submissionId === sub2.id; }), 'the submission 45 days after the touch is not credited');
    });
    await t('period filter: a 30-day window drops outcomes older than 30 days', async function(){
      var old = { id:'sub-rx-old', jobId:pl.jobId, candidateId:pl.candidateId, stage:'Submitted', createdAt:iso(60), stageHistory:[{ stage:'Submitted', at:iso(60) }] };
      SUBMISSIONS.push(old); touch(W.id, pl.candidateId, 70);
      var c30 = rxResults({ days:30, workflowIds:[W.id] }).rows[0].records.submissions.filter(function(x){ return x.submissionId === old.id; }).length;
      var c90 = rxResults({ days:90, workflowIds:[W.id] }).rows[0].records.submissions.filter(function(x){ return x.submissionId === old.id; }).length;
      eq(c30, 0); eq(c90, 1);
    });
    await t('Results tab on the agent page: funnel, money table, every number opens its records', async function(){
      showView('admin-dashboard'); document.querySelector('#rx-home-card .o-link').click();
      eq(state.activeNav, 'kairo-team'); var tab = document.getElementById('ca-tab-results'); ok(tab && tab.getAttribute('aria-selected') === 'true', 'Results tab on');
      ok(![].some.call(document.querySelectorAll('#ca-tabs [role=tab]'), function(b){ return b !== tab && b.getAttribute('aria-selected') === 'true'; }), 'only Results selected');
      var box = document.getElementById('rx-results'); ok(box, 'Results shown');
      ok(/Fees influenced/.test(box.textContent) && /₹/.test(box.textContent), 'amounts for the Owner');
      ok(document.querySelector('[data-rx-wf="' + W.id + '"]'), 'a row per workflow');
      var b = document.querySelector('[data-rx-drill="' + W.id + ':joins"]'); ok(b, 'joins drill'); b.click();
      var d = document.getElementById('rx-drill'); ok(d && d.textContent.indexOf(byId(pl.candidateId).name) > -1, 'records list the candidate');
      ok(/also touched: Older touch/.test(d.textContent), 'also touched shown');
      rxResultsSet('days', 30); ok(document.querySelector('#rx-days .is-on').textContent === '30 days', '30-day filter on');
      rxResultsSet('days', 90);
      rxResultsSet('wf', W.id); ok(/Showing/.test(document.getElementById('rx-results').textContent) && document.querySelectorAll('#rx-results-table tbody tr').length === 1, 'one workflow\'s results');
      rxResultsSet('wf', null);
    });
    await t('each agent page has a Results section for its own workflows', async function(){
      CA.tab = 'agents'; caOpenAgent(agent); var p = document.getElementById('ca-page'); ok(p, 'agent page');
      var box = p.querySelector('#rx-results'); ok(box && box.querySelector('[data-rx-wf="' + W.id + '"]'), 'this agent\'s workflow');
      var mine = cwWorkflowsFor(agent).map(function(w){ return w.id; });
      ok([].every.call(box.querySelectorAll('[data-rx-wf]'), function(tr){ return mine.indexOf(tr.getAttribute('data-rx-wf')) > -1; }), 'only this agent\'s workflows');
      var otherAgent = CW.order.find(function(a){ return a !== agent; }); W2.agentId = W2.agentKey = otherAgent; touch(W2.id, pl.candidateId, 11);
      ok(rxResultsHTML(otherAgent).indexOf('data-rx-wf="' + W2.id + '"') > -1 && rxResultsHTML(agent).indexOf('data-rx-wf="' + W2.id + '"') < 0, 'another agent\'s workflow stays on its own page');
      RX.touches.pop();
      caCloseAgent();
    });
    await t('company workspace Cowork (agent tabs with sections): a Results section tab', async function(){
      cwSub = 'results'; var h = cwAgentPage(agent);
      ok(/onclick="cwOpenSub\('results'\)">Results<\/button>/.test(h), 'Results button'); ok(h.indexOf('id="rx-results"') > -1, 'Results body');
      ok(!/aria-pressed="true"[^>]*>Overview/.test(h), 'Overview not marked on');
      cwSub = 'overview'; h = cwAgentPage(agent); ok(h.indexOf('id="rx-results"') < 0 && />Results<\/button>/.test(h), 'button only');
    });
    await t('Owner/Admin Home card: "Automation influenced ₹X fees / N hires (90 days)"', async function(){
      showView('admin-dashboard'); var c = document.getElementById('rx-home-card'); ok(c, 'card shown');
      ok(/Automation influenced ₹[\d.]+L fees \/ \d+ hires?/.test(c.textContent), c.textContent);
    });
    await t('without billing view: counts, no amounts', async function(){
      var r = CUSTOM_ROLES.find(function(x){ return !roleHasPermission(x.id, 'billing', 'View') && roleHasPermission(x.id, 'candidates', 'View'); });
      ok(r, 'a role without billing view'); previewAsRoleId = r.id;
      ok(!rxSeesMoney(), 'no money');
      var h = rxResultsHTML(agent); ok(!/₹/.test(h) && !/Fees influenced/.test(h), 'no amounts'); ok(/Joins influenced<\/p><p class="o-num__value">[1-9]/.test(h), 'counts still shown');
      var hc = rxHomeCardHTML(); ok(!/₹/.test(hc) && /\d+ hires?/.test(hc), hc);
      previewAsRoleId = null;
    });
    await t('switch off: no Results tab and no Home card (today\'s screens)', async function(){
      rxSetSwitch('g2', false);
      CA.tab = 'agents'; showView('kairo-team'); ok(!document.getElementById('ca-tab-results'), 'no Results tab'); ok(!document.getElementById('rx-results'));
      caOpenAgent(agent); ok(document.getElementById('ca-page') && !document.getElementById('rx-results'), 'no Results section'); caCloseAgent();
      showView('admin-dashboard'); ok(!document.getElementById('rx-home-card'), 'no Home card');
      rxSetSwitch('g2', true);
    });
    pub();
  }, 300); });
})();
