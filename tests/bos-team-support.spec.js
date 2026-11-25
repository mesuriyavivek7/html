/* Role fixes, My team, and Help & support for customers (prototype, 2026-11-25).
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\bos-team-support.spec.js */
(function(){
  var results = [];
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e && e.message || e) }); } pub(); }
  function pub(){ var pre = document.getElementById('auth-test-results'); if(!pre){ pre = document.createElement('pre'); pre.id = 'auth-test-results'; document.body.appendChild(pre); } pre.textContent = JSON.stringify(results); }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function eq(a, b, m){ if(a !== b) throw new Error((m ? m + ': ' : '') + 'expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a)); }
  function as(id){ ACTIVE_PLATFORM_USER_ID = id; }
  var main = function(){ return document.getElementById('main-content').textContent; };
  function asTenant(role, corporate){ state.role = role || 'admin'; ORG_STRUCTURE.profile.orgType = corporate ? 'Corporate' : 'Staffing agency'; renderSidebar(); }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    try { localStorage.clear(); } catch(e){}
    var app = document.getElementById('app'); app.classList.remove('hidden'); app.classList.add('flex');
    state.role = 'oontu'; as('PU-001'); renderSidebar(); await sleep(30);

    await t('approvals lists show only what you asked for or may decide', async function(){
      as('PU-103'); var r = bosRequestAccess({ tenantId:CURRENT_ORGANIZATION_ID, scope:'workspace-data', purpose:'Check the import mapping', hours:2, ticketId:BOS.tickets[0].id, customerAuthorised:true }); ok(r.ok, r.reason);
      as('PU-106'); ok(!bosApprovalsVisible().some(function(a){ return a.type === 'access'; }), 'Finance doesn’t see security approvals');
      ok(bosApprovalsVisible().some(function(a){ return a.type === 'discount'; }), 'Finance sees discount approvals it may decide');
      as('PU-104'); ok(bosApprovalsVisible().some(function(a){ return a.type === 'access'; }), 'the support manager sees access approvals');
      as('PU-001');
    });
    await t('Insights shows only the departments you manage', async function(){
      as('PU-102'); ok(bosSeesDept('revenue') && !bosSeesDept('service') && !bosSeesDept('finance'), 'sales manager: revenue only');
      as('PU-104'); ok(bosSeesDept('service') && !bosSeesDept('revenue'), 'support manager: service only');
      as('PU-001'); ok(['revenue','service','custops','finance'].every(bosSeesDept), 'super admin: all');
      as('PU-102'); bosActAs('PU-102'); renderSidebar(); showView('oontu-insights'); await sleep(20); ok(/Revenue/.test(main()) && !/Resolved within SLA/.test(main()), 'screen follows the rule'); bosActAs('PU-001');
    });
    await t('My team: managers see their reports (direct and through someone), with explained numbers', async function(){
      as('PU-102'); var team = bosReportsOf('PU-102').map(function(u){ return u.id; }); eq(team.join(), 'PU-101', 'Kavya manages Arjun');
      as('PU-001'); ok(bosReportsOf('PU-001').length >= 9 && !bosReportsOf('PU-001').some(function(u){ return u.system; }), 'super admin: everyone through managers, never system identities');
      var m = bosPersonMetrics(platformUserById('PU-101'), 30); ok(m.metrics.some(function(x){ return x.label === 'Open pipeline'; }) && m.metrics.every(function(x){ return x.how; }), 'sales numbers with how they are worked out');
      var s = bosPersonMetrics(platformUserById('PU-103'), 30); ok(s.metrics.some(function(x){ return x.label === 'Tickets resolved'; }), 'support numbers');
      var c = bosPersonMetrics(platformUserById('PU-105'), 30); ok(c.metrics.some(function(x){ return x.label === 'Fully set up'; }), 'customer ops numbers');
      as('PU-101'); ok(!BOS_VIEW_ACCESS['oontu-team'](), 'no reports: no team screen');
      as('PU-102'); bosActAs('PU-102'); renderSidebar(); showView('oontu-team'); await sleep(20); ok(/Arjun Rao/.test(main()), 'name: ' + main().slice(150, 400)); ok(/Workload/.test(main()), 'workload'); ok(/not for ranking/.test(main()), 'lede'); bosActAs('PU-001');
    });
    await t('a manager hands work to a teammate; permissions still apply', async function(){
      as('PU-104'); var tk = BOS.tickets.find(function(x){ return x.ownerId === 'PU-103' && !/resolved|closed/.test(x.status); });
      var r = bosHandOver('PU-103', 'PU-104', ['Ticket:' + tk.id]); ok(r.ok && r.moved === 1, JSON.stringify(r)); eq(tk.ownerId, 'PU-104');
      as('PU-102'); var o = BOS.opps.find(function(x){ return x.ownerId === 'PU-101' && bosOppOpen(x); }); var r2 = bosHandOver('PU-101', 'PU-104', ['Opportunity:' + o.id]); ok(!r2.ok, 'can’t hand a deal to someone who doesn’t sell');
      as('PU-001');
    });
    await t('the billing scheduler is a system identity: no sign-in, no people lists', async function(){
      var x = await authApi.passwordSignIn({ email:'billing-scheduler@oontu.system', password:'demo1234' }); ok(!x.ok, 'cannot sign in');
      ok(!bosLogins().some(function(d){ return d.id === 'SYS-BILLING'; }), 'not in the login list');
      as('PU-001'); bosActAs('PU-001'); renderSidebar(); showView('oontu-platform-users'); await sleep(20); ok(!/Billing scheduler/.test(main()), 'not in the employee list');
    });

    // ---------- customers: Help & support in Settings ----------
    await t('every customer person (agency and corporate) has Help & support in Settings', async function(){
      ['admin','recruiter','manager'].forEach(function(r){ state.role = r; ok(sVisible().some(function(s){ return s.id === 'support'; }), r + ' sees it'); });
      asTenant('admin', true); ok(sVisible().some(function(s){ return s.id === 'support'; }), 'corporate too'); asTenant('admin', false);
      showView('settings'); openSettings('support'); await sleep(30); ok(/Knowledge centre/.test(main()) && /Ask in your own words/.test(main()), 'knowledge centre first');
    });
    await t('the knowledge centre answers questions in the person’s own words, with steps and the right screen', async function(){
      asTenant('admin', false);
      var r = helpSearch('how do I import candidates from excel'); eq(r.results[0].id, 'KB-130', 'import article'); ok(r.results[0].steps.length >= 3, 'a tutorial');
      eq(helpSearch('forgot my password, locked out').results[0].id, 'KB-102');
      eq(helpSearch('upgrade plan add seats coupon').results[0].id, 'KB-230');
      eq(helpSearch('gst wrong on invoice').results[0].id, 'KB-231');
      ok(helpSearch('where are templates').screens.some(function(s){ return /Templates/.test(s.title); }), 'finds the real settings section');
      ok(!helpArticlesForMe().some(function(a){ return a.aud === 'corporate'; }), 'agency sees no corporate-only articles');
      asTenant('admin', true); eq(helpSearch('raise a hiring requisition').results[0].id, 'KB-121', 'corporate article for corporates'); ok(!helpArticlesForMe().some(function(a){ return a.aud === 'agency'; }), 'corporates see no agency-only'); asTenant('admin', false);
      eq(helpSearch('zzqx flibber').results.length, 0, 'nonsense finds nothing');
    });
    await t('the screen: type, get the answer, say “No”, and raise a ticket from there', async function(){
      showView('settings'); openSettings('support'); await sleep(20);
      helpType('emails are not sending from my address'); await sleep(320); ok(/Emails are not being sent/.test(main()) && /Did this answer it/.test(main()), 'answer shown');
      helpFeedback('KB-221', false); await sleep(10); ok(/Still stuck/.test(main()) && /Raise a ticket/.test(main()), 'escalation offered');
      ok(BOS.feedback.some(function(f){ return f.source === 'Help centre'; }), 'a “didn’t help” feeds product feedback');
      supportTicketDialog(); ok(document.getElementById('hs-subj').value.length > 5, 'subject prefilled from the question');
      document.getElementById('hs-cat').value = 'bug'; document.getElementById('hs-det').value = 'Since this morning nothing goes out from my mailbox.'; supportSubmit('In-app'); await sleep(30);
      var tk = BOS.tickets[BOS.tickets.length - 1]; ok(tk.tenantId === CURRENT_ORGANIZATION_ID && /Articles tried: .*KB-221/.test(tk.messages[0].body) && tk.supportTier, 'ticket in the one system with the articles tried and the plan');
      ok(/Tickets/.test(main()) && new RegExp(tk.id).test(main()), 'the customer sees it');
    });
    await t('support follows the plan: tiers, urgent, chat and calls', async function(){
      var sub = subscriptionForTenant(CURRENT_ORGANIZATION_ID), keep = sub.planId, wp = wsPlanCurrent(), keepWp = wp && wp.planId;
      var setPlan = function(p){ sub.planId = p; if(wp) wp.planId = p; };
      setPlan('plan-desk'); var tr = supportTierFor(); eq(tr.id, 'essential'); ok(!tr.chat && !tr.call && !tr.urgentAllowed, 'Desk: essential');
      var u = supportRaise({ category:'question', subject:'Urgent question here', details:'Please help quickly with this.', urgency:'urgent' }); ok(!u.ok && /Priority support/.test(u.reason), 'no urgent on Essential');
      var o = supportRaise({ category:'outage', subject:'Nothing loads at all', details:'All recruiters see an error page.' }); ok(o.ok && o.ticket.priority === 'P1', 'outages are always urgent');
      setPlan('plan-floor'); eq(supportTierFor().id, 'priority'); var u2 = supportRaise({ category:'bug', subject:'Pipeline will not load', details:'Blocked on the pipeline board.', urgency:'urgent' }); ok(u2.ok && u2.ticket.priority === 'P2', 'urgent on Priority');
      ok(/Priority support/.test(u2.ticket.sla.policy) && /4 h/.test(u2.ticket.sla.policy), 'the plan’s response time on the ticket: ' + u2.ticket.sla.policy);
      setPlan('plan-network'); var p = supportTierFor(); ok(p.call && p.csm, 'Network: premium with calls and a success manager');
      setPlan('plan-group'); eq(supportTierFor().id, 'enterprise');
      sub.readOnly = true; var ro = supportRaise({ category:'bug', subject:'A bug report here', details:'Something broke in the jobs list.' }); ok(!ro.ok && /read-only/.test(ro.reason), 'read-only: billing and account only');
      ok(supportRaise({ category:'billing', subject:'Payment question', details:'How do I pay the overdue invoice?' }).ok, 'billing still allowed'); sub.readOnly = false;
      setPlan(keep); if(wp) wp.planId = keepWp;
    });
    await t('the customer and Oontu’s team talk on the same ticket', async function(){
      var tk = BOS.tickets.find(function(x){ return x.tenantId === CURRENT_ORGANIZATION_ID && /emails are not sending/i.test(x.subject); });
      state.role = 'oontu'; as('PU-103'); bosTicketAssign(tk.id, 'PU-103'); var r = bosTicketReply(tk.id, 'Please reconnect your mailbox in Settings › My connections.', { wait:true }); ok(r.ok, r.reason);
      ok(bosTicketReply(tk.id, 'Internal: check their DKIM.', { internal:true }).ok, 'internal note');
      asTenant('admin', false); supportOpen(tk.id); await sleep(20); ok(/reconnect your mailbox/.test(main()) && !/check their DKIM/.test(main()), 'customer sees the reply, never internal notes');
      ok(supportReply(tk.id, 'Done, it works now. Thanks!').ok, 'customer replies'); eq(tk.status, 'investigating', 'back with the team');
      state.role = 'oontu'; as('PU-103'); ok(bosTicketStatus(tk.id, 'resolved', { resolution:'Mailbox reconnected' }).ok, 'resolved');
      asTenant('admin', false); var c = supportConfirm(tk.id, 5); ok(c.ok && tk.status === 'closed' && tk.csat === 5, 'customer confirms and rates');
    });
    await t('a colleague’s ticket stays private unless you manage the workspace', async function(){
      var tk = BOS.tickets.find(function(x){ return x.tenantId === CURRENT_ORGANIZATION_ID; }); var keep = tk.contactEmail; tk.contactEmail = 'someone.else@harborpartners.example';
      asTenant('recruiter', false); ok(!supportMyTickets().some(function(x){ return x.id === tk.id; }), 'a recruiter sees only their own'); ok(!supportReply(tk.id, 'hi').ok, 'and can’t reply on it');
      asTenant('admin', false); ok(supportMyTickets().some(function(x){ return x.id === tk.id; }), 'the admin sees the workspace’s tickets'); tk.contactEmail = keep;
    });
    await t('Kairo’s support drafts use the same knowledge centre', async function(){
      ok(BOS_KB.length === HELP_ARTICLES.length, 'one list'); state.role = 'oontu'; as('PU-001');
      var tk = BOS.tickets.find(function(x){ return /password/i.test(x.subject); }); var d = bosKairo.draftReply(tk.id); ok(d.ok && /KB-102/.test(d.sources.join()), JSON.stringify(d.sources));
    });
    pub();
  }, 300); });
})();
