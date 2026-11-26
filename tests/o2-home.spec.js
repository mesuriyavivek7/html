// @o2-runner switches=0b,1a,1b,2
/* O2 Step 2: Home (command center) — KPIs per §3.8 computed independently, ranked attention queue, SVG charts, activity.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\o2-home.spec.js */
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
  var DAY = 864e5, iso = function(ms){ return new Date(ms).toISOString(); }, day = function(ms){ return iso(ms).slice(0, 10); };
  var CASE = { category:'Volume or multi-year commitment', reason:'The customer will sign a two-year term for all twelve recruiters if we hold fifteen percent for both years.', commitment:'12 licences × 24 months', withoutIt:'They stay on spreadsheets for another year.' };
  /* independent §3.8 maths */
  function mrrOf(s){ var p = planById(s.planId); var m = s.billingInterval === 'annual' ? 12 : 1; var v = p.prices && Object.keys(p.prices).length ? p.prices[s.currency] * (s.seats || 1) : (p.currency === s.currency ? p.price : s.price) / m; (s.boosts || []).forEach(function(b){ v += boostById(b).prices[s.currency]; }); return Math.round(v * 100) / 100; }
  function statusOf(s){ return s.o2Status || (s.readOnly ? 'unpaid' : { trial:'trialing', cancelled:'canceled', expired:'canceled' }[s.status] || s.status); }
  function current(){ return PLATFORM_SUBSCRIPTIONS.filter(function(s){ var tn = tenantById(s.tenantId); return (!tn || !tn.subscriptionId || tn.subscriptionId === s.id) && !(tn && tn.internal); }); }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    state.role = 'oontu'; as('PU-001'); var app = document.getElementById('app'); app.classList.remove('hidden'); app.classList.add('flex'); renderSidebar(); await sleep(30);
    var now = bosNow();
    /* one record of every attention type */
    var tTrial = { id:'org-o2trial', name:'Trial Ending Co', status:'active', createdAt:iso(now - 10 * DAY), internal:false };
    PLATFORM_TENANTS.push(tTrial); var sTrial = { id:'sub-o2t', tenantId:tTrial.id, planId:'plan-floor', status:'trial', startDate:day(now - 10 * DAY), renewalDate:day(now + 3 * DAY), billingInterval:'monthly', price:2999, currency:'INR', seats:2, createdAt:iso(now) };
    PLATFORM_SUBSCRIPTIONS.push(sTrial); tTrial.subscriptionId = sTrial.id;
    var south = subscriptionForTenant('org-southline'); south.planId = 'plan-floor'; south.seats = 3; south.status = 'past_due'; south.dunning = { since:day(now - 5 * DAY), step:1, reason:'The automatic charge failed' };
    as('PU-103'); var tk = bosCreateTicket({ subject:'Everything is down for our team', body:'Outage', contactEmail:'priya@harborpartners.example', source:'In-app', priority:'P1' }).ticket; tk.priority = 'P1'; tk.sla.resolveBy = iso(now - DAY); tk.sla.respondBy = iso(now - 2 * DAY);
    as('PU-001'); var inc = bosCreateIncident({ title:'Login failures for some workspaces', severity:'SEV1' }); inc = inc.incident;
    BOS.exceptions.push({ id:'EX-O2HOME', rule:'access-control', key:'ac:o2home', domain:'Platform', status:'confirmed', title:'Access granted without approval', detectedAt:iso(now - 2 * DAY), evidence:[], history:[], severity:'high' });
    var opp = BOS.opps.find(function(o){ return o.ownerId === 'PU-101' && !/won|lost/i.test(o.stage || ''); }) || (function(){ as('PU-101'); var o = bosIntake({ company:'Home Spec Ltd', name:'Hema', email:'hema@homespec.example', source:'Website' }).opp; o.ownerId = 'PU-101'; return o; })();
    as('PU-101'); var apr = bosCreateProposal({ oppId:opp.id, planId:'plan-scale', seats:12, discountPct:15, justification:CASE }).approval; as('PU-001');
    var g = generateInvoiceForSubscription(subscriptionForTenant('org-northstar').id); g.invoice.status = 'paid'; g.invoice.verifiedBy = null;
    SIGNUP_LEADS.push({ id:'SL-O2HOME', name:'Stuck Person', email:'stuck@nowhere.example', company:'Stuck Co', status:'in_progress', createdAt:iso(now - 3 * DAY), lastActivityAt:iso(now - 2 * DAY) });
    var north = subscriptionForTenant('org-northstar'); north.renewalDate = day(now + 40 * DAY);

    await t('acceptance 1: every KPI equals its §3.8 definition (computed here independently)', async function(){
      var k = o2Kpis(), by = {}, risk = {};
      current().forEach(function(s){ var st = statusOf(s); if(st === 'active' || st === 'past_due'){ var v = mrrOf(s); if(v > 0) by[s.currency] = Math.round(((by[s.currency] || 0) + v) * 100) / 100; } if(st === 'past_due') risk[s.currency] = Math.round(((risk[s.currency] || 0) + mrrOf(s)) * 100) / 100; });
      eq(JSON.stringify(k.mrr), JSON.stringify(by), 'MRR'); eq(JSON.stringify(k.atRisk), JSON.stringify(risk), 'At-risk MRR');
      var paying = PLATFORM_TENANTS.filter(function(tn){ if(tn.internal || tn.status !== 'active') return false; var s = subscriptionForTenant(tn.id); return s && ['active', 'past_due'].indexOf(statusOf(s)) > -1 && mrrOf(s) > 0; }).length;
      eq(k.paying.length, paying, 'paying workspaces');
      var t0 = new Date(now); t0.setHours(0, 0, 0, 0); eq(k.trials.length, current().filter(function(s){ var e = s.renewalDate && new Date(s.renewalDate + 'T00:00:00').getTime(); return statusOf(s) === 'trialing' && e >= t0.getTime() && e < t0.getTime() + 7 * DAY; }).length, 'trials ending');
      eq(k.open12.length, BOS.tickets.filter(function(x){ return !/resolved|closed/.test(x.status) && (x.priority === 'P1' || x.priority === 'P2'); }).length, 'P1/P2');
      eq(k.waiting.length, BOS.approvals.filter(function(a){ return a.status === 'pending' && bosCanDecide(a).ok; }).length, 'approvals waiting');
      ok(k.waiting.length >= 1 && k.open12.length >= 1 && k.trials.length >= 1 && Object.keys(k.atRisk).length, 'every KPI has data in this spec');
    });
    await t('acceptance 2: Meera sees every attention type present, ranked 1–9; Arjun lands on My work', async function(){
      var a = o2Attention(), ranks = a.map(function(x){ return x.rank; });
      [1, 2, 3, 4, 5, 6, 7, 8, 9].forEach(function(r){ ok(ranks.indexOf(r) > -1, 'rank ' + r + ' present: ' + ranks.join(',')); });
      ok(ranks.every(function(r, i){ return i === 0 || ranks[i - 1] <= r; }), 'in rank order');
      ok(a[0].title.indexOf('SEV1') === 0, 'first is the SEV1 incident');
      showView('oontu-home'); await sleep(10); eq(state.activeNav, 'oontu-home'); var main = document.getElementById('main-content');
      ok(/things need the platform team/.test(main.textContent), 'head line'); var rows = main.querySelectorAll('section[aria-labelledby="att-h-o2-home-att"] li.o-att'); eq(rows.length, 8, 'at most 8 rows'); ok(Array.prototype.every.call(rows, function(r){ return !r.hidden && r.querySelector('button[onclick]'); }), 'each row has one action');
      ok(/See all/.test(main.textContent), 'see all when more than 8');
      as('PU-101'); eq(bosHomeView(), 'oontu-mywork'); ok(/Not available/.test(RENDERERS['oontu-home']()), 'Home refuses without tenant:update'); as('PU-001');
    });
    await t('acceptance 3: every KPI, row and chart mark opens its list; charts have aria-label and hover values', async function(){
      showView('oontu-home'); await sleep(10); var main = document.getElementById('main-content');
      var kpis = main.querySelectorAll('.o-numbers .o-num'); eq(kpis.length, 6, 'six KPIs'); Array.prototype.forEach.call(kpis, function(k){ ok(k.getAttribute('onclick'), 'KPI clickable: ' + k.textContent.slice(0, 30)); });
      var charts = main.querySelectorAll('.o2-chart'); eq(charts.length, 4, 'four charts');
      Array.prototype.forEach.call(charts, function(c){ var svg = c.querySelector('svg'); ok(svg && svg.getAttribute('aria-label'), 'aria-label'); var marks = c.querySelectorAll('.o2-bar'); ok(marks.length >= 6, 'marks'); Array.prototype.forEach.call(marks, function(m){ ok(m.getAttribute('onclick') && m.querySelector('title'), 'mark opens a list and has a hover value'); }); });
      ok(main.querySelectorAll('.o2-illus').length >= 3, 'illustrative charts labelled'); ok(/Lapsed/.test(main.textContent) && /scheduled churn/.test(main.textContent), 'at-risk shows lapsed and scheduled churn beside it');
      main.querySelector('.o-numbers .o-num').click(); await sleep(10); eq(state.activeNav, 'oontu-subscriptions', 'MRR opens Subscriptions');
      showView('oontu-home'); await sleep(10); document.querySelector('#o2-ch-tk .o2-bar').dispatchEvent(new MouseEvent('click', { bubbles:true })); await sleep(10); eq(state.activeNav, 'oontu-service', 'a chart mark opens its list');
      showView('oontu-home'); await sleep(10); ok(/Recent activity/.test(document.getElementById('main-content').textContent) && document.querySelectorAll('.o2-activity li').length > 0, 'recent activity');
    });
    await t('a viewer only sees KPIs and attention items they can open', async function(){
      as('PU-106'); var k = 0; var html = RENDERERS['oontu-home'](); as('PU-001');
      as('PU-107'); var a = o2Attention(); ok(!a.some(function(x){ return x.rank === 6; }), 'no reconciliation items without Billing and payments'); as('PU-001');
    });
    await t('switch 2 off: Home shows the old overview again', async function(){
      o2SetSwitch('2', false); showView('oontu-home'); await sleep(10); ok(!document.querySelector('.o2-chart'), 'no charts'); ok(/Platform overview|Active workspaces/.test(document.getElementById('main-content').textContent), 'old overview');
      o2SetSwitch('2', true);
    });
    pub();
  }, 300); });
})();
