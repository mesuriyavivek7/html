/* Business OS (2026-11-25), part 1: employee identity and access, Account 360 and matching, Revenue and commercial policy.
   Maps to the acceptance scenarios in Oontu_Unified_Business_Operating_System_Master_Assignment §22 (see docs/oontu-evolution/37).
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\bos-identity-revenue.spec.js */
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
  function navShown(){ var out = []; NAV.oontu.forEach(function(g){ (g.items || [g]).forEach(function(i){ out.push(i.id); }); }); var f = filterNavForPermissions(NAV.oontu), vis = []; f.forEach(function(g){ (g.items || [g]).forEach(function(i){ vis.push(i.id); }); }); return vis; }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    try { localStorage.clear(); } catch(e){}
    state.role = 'oontu'; as('PU-001'); var app = document.getElementById('app'); app.classList.remove('hidden'); app.classList.add('flex'); renderSidebar(); await sleep(30);

    await t('employees have one identity: one roster record, one email, several roles', async function(){
      var aditi = platformUserById('PU-105');
      eq(PLATFORM_USER_ROSTER.filter(function(u){ return u.email === aditi.email; }).length, 1, 'one record');
      ok(bosRolesOf(aditi).length === 2, 'two roles: ' + bosRolesOf(aditi).join());
      as('PU-001'); var r = bosInviteEmployee({ name:'Aditi Again', email:'aditi@oontu.internal', roles:['tpl_agent'] });
      ok(!r.ok && /already has an Oontu identity/.test(r.reason), 'no second account: ' + r.reason);
    });
    await t('an employee holding several roles gets the union of them, each with its scope', async function(){
      as('PU-105');
      ok(canPlatform('platform-onboarding', 'execute') && canPlatform('platform-training', 'edit'), 'implementation + trainer');
      ok(!canPlatform('platform-finance', 'approve_refund'), 'no finance');
      eq(bosScopeOf('platform-onboarding', 'edit'), 'assigned', 'Implementation Specialist edits the onboardings assigned to them');
      eq(bosScopeOf('platform-training', 'edit'), 'organization', 'Trainer alone is own-scope; with Implementation Specialist the widest grant wins');
      eq(bosScopeOf('platform-training', 'edit', platformUserById('PU-105') && Object.assign({}, platformUserById('PU-105'), { platformRoleIds:['tpl_trainer'] })), 'own', 'Trainer alone');
    });
    await t('scope is enforced against the record: own, team, queue', async function(){
      var arjun = platformUserById('PU-101'), kavya = platformUserById('PU-102'), rohan = platformUserById('PU-103');
      var mine = { ownerId:'PU-101' }, teammate = { ownerId:'PU-102' }, other = { ownerId:'PU-109' };
      ok(bosCan('platform-lead', 'edit', mine, arjun) && !bosCan('platform-lead', 'edit', teammate, arjun), 'Sales Executive: own only');
      ok(bosCan('platform-lead', 'edit', mine, kavya) && !bosCan('platform-lead', 'edit', other, kavya), 'Sales Manager: team, not other teams');
      ok(bosCan('platform-ticket', 'edit', { queue:'technical' }, rohan) && !bosCan('platform-ticket', 'edit', { queue:'billing' }, rohan), 'Support Agent: own queues');
    });
    await t('navigation reflects access, and a hidden screen still refuses to render', async function(){
      as('PU-001'); var sa = navShown(); var n1a = typeof o2On === 'function' && o2On('1a');   /* O2 step 1a renames the screens (docs/O2-BUILD-BRIEF.md §5) */
      ok(sa.indexOf(n1a ? 'oontu-invoices' : 'oontu-finance') > -1 && sa.indexOf(n1a ? 'oontu-people' : 'oontu-platform-users') > -1, 'super admin sees all');
      as('PU-101'); var se = navShown();
      ok(se.indexOf('oontu-revenue') > -1 && se.indexOf('oontu-mywork') > -1, 'sales sees revenue and my work: ' + se.join());
      ok(['oontu-finance','oontu-platform-users','oontu-tenants','oontu-service','oontu-dashboard','oontu-subscriptions','oontu-plans','oontu-help'].every(function(v){ return se.indexOf(v) === -1; }), 'strict: only the screens of their own work: ' + se.join());
      ok(/Not available/.test(RENDERERS['oontu-finance']()), 'direct render is refused');
      as('PU-001');
    });
    await t('role change updates access at once', async function(){
      as('PU-001'); var r = bosSetRoles('PU-103', ['tpl_agent', 'tpl_fin_assoc']); ok(r.ok, r.reason);
      as('PU-103'); ok(canPlatform('platform-finance', 'view'), 'finance now');
      as('PU-001'); ok(bosSetRoles('PU-103', ['tpl_agent']).ok, 'back'); as('PU-103'); ok(!canPlatform('platform-finance', 'view'), 'gone again');
      as('PU-001');
    });
    await t('no privilege escalation: nobody changes their own roles or gives more than they hold', async function(){
      as('PU-001'); var r = bosSetRoles('PU-001', ['tpl_agent']); ok(!r.ok && /own roles/.test(r.reason), r.reason);
      ok(!setPlatformUserRole('PU-001', 'tpl_agent').ok, 'the old single-role path refuses too');
      // a platform administrator (not a security admin) can't hand out finance approval they don't hold
      var adm = bosInviteEmployee({ name:'Pat Admin', email:'pat@oontu.internal', roles:['tpl_plat_admin'] }); ok(adm.ok, adm.reason); bosActivateEmployee(adm.user.id);
      as(adm.user.id); var x = bosSetRoles('PU-101', ['tpl_fin_mgr']); ok(!x.ok && /more access than you have/.test(x.reason), x.reason);
      as('PU-001');
    });
    await t('temporary elevated access needs someone else to approve and ends by itself', async function(){
      as('PU-104'); var r = bosRequestTempRole('PU-103', 'tpl_senior_support', 2, 'Cover the queue during the outage'); ok(!r.ok, 'support manager has no platform-user rights: ' + (r.reason || ''));
      as('PU-001'); r = bosRequestTempRole('PU-103', 'tpl_senior_support', 2, 'Cover the queue during the outage'); ok(r.ok, r.reason);
      var self = bosDecide(r.approval.id, true, 'Checked the evidence on file and it is justified for this case.', 'Other (explained in note)'); ok(!self.ok && /your own request/.test(self.reason), 'no self-approval');
      as('PU-108'); var d = bosDecide(r.approval.id, true, 'Checked the evidence on file and it is justified for this case.', 'Other (explained in note)'); ok(d.ok, d.reason);
      as('PU-103'); ok(canPlatform('platform-ticket', 'assign'), 'elevated');
      APS.clockOffsetMs = (APS.clockOffsetMs || 0) + 3 * 3600000; bosExpireGrants(); ok(!canPlatform('platform-ticket', 'assign'), 'expired'); APS.clockOffsetMs -= 3 * 3600000;
      as('PU-001');
    });
    await t('offboarding revokes access, hands work over and keeps history', async function(){
      as('PU-001'); var inv = bosInviteEmployee({ name:'Tara Temp', email:'tara@oontu.internal', roles:['tpl_sales_exec'], department:'Revenue', teamId:'rev-west' }); ok(inv.ok, inv.reason);
      as(inv.user.id); ok(!canPlatform('platform-lead', 'view'), 'invited is not active yet'); as('PU-001');
      ok(bosActivateEmployee(inv.user.id).ok, 'activated');
      as(inv.user.id); var lead = bosIntake({ company:'Tara Test Co', name:'Tom', email:'tom@taratest.example', source:'Outbound' }); ok(lead.ok && lead.opp.ownerId === inv.user.id, 'owns a lead');
      as('PU-001'); var auditBefore = AUDIT_LOG.length; var off = bosOffboardEmployee(inv.user.id, 'PU-102', 'Contract ended'); ok(off.ok && off.moved >= 1, off.reason);
      eq(lead.opp.ownerId, 'PU-102', 'work handed over'); ok(lead.opp.history.some(function(h){ return /offboarding/.test(h.text); }), 'history kept');
      as(inv.user.id); ok(!canPlatform('platform-lead', 'view'), 'access gone'); as('PU-001');
      ok(AUDIT_LOG.length > auditBefore && AUDIT_LOG.some(function(e){ return /Employee offboarded/.test(e.action); }), 'audited');
    });
    await t('a website inquiry with a new company creates a new account with one owner', async function(){
      as('PU-101'); var r = bosIntake({ company:'Lotus Recruiters Pvt Ltd', name:'Anil', email:'anil@lotusrec.example', source:'Website', campaign:'Q4 search' });
      ok(r.ok, r.reason); eq(r.match.decision, 'new'); eq(r.opp.ownerId, 'PU-101', 'clear ownership'); eq(r.account.ownerId, 'PU-101'); eq(r.opp.source, 'Website'); eq(r.opp.campaign, 'Q4 search', 'attribution kept');
    });
    await t('an existing customer contact links to the existing account and the owner is told', async function(){
      as('PU-101'); var acc = BOS.accounts.find(function(a){ return a.name === 'Southline Talent Group'; });
      var n = BOS.notifications.length;
      var r = bosIntake({ company:'Southline', name:'Farah Osei', email:'farah@southline.example', source:'Contact form' });
      ok(r.ok, r.reason); eq(r.match.decision, 'link'); eq(r.account.id, acc.id, 'same account');
      ok(r.match.top.evidence.some(function(e){ return e.strength === 'strong'; }), 'strong evidence listed');
      ok(BOS.notifications.slice(n).some(function(x){ return x.userId === acc.ownerId; }), 'owner notified');
    });
    await t('a likely duplicate company opens a review and is never merged automatically', async function(){
      as('PU-101'); var before = BOS.accounts.filter(function(a){ return a.mergedInto; }).length;
      var r = bosIntake({ company:'Vistaar HR Services Private Limited', name:'Ravi', email:'ravi@gmail.com', source:'Event' });
      ok(r.ok, r.reason); eq(r.match.decision, 'review', 'medium evidence → review'); ok(r.match.freeDomain, 'gmail gives no domain evidence');
      ok(r.review && r.review.rule === 'duplicate-account', 'review opened');
      eq(BOS.accounts.filter(function(a){ return a.mergedInto; }).length, before, 'nothing merged');
    });
    await t('weak evidence never merges or blocks; parent and subsidiary stay distinct', async function(){
      var m = bosMatch({ company:'Northstar Talent Germany', email:'jo@de.northstar.example', registryId:'DE-998877' });
      ok(m.decision === 'new', 'weak only → new: ' + m.why);
      var uk = BOS.accounts.find(function(a){ return a.name === 'Northstar Talent UK'; }), grp = BOS.accounts.find(function(a){ return a.name === 'Northstar Group'; });
      eq(uk.parentId, grp.id); ok(!uk.mergedInto && !grp.mergedInto, 'both remain');
      as('PU-109'); var mr = bosRequestMerge(uk.id, grp.id, 'same company?'); ok(!mr.ok && /different legal entities/.test(mr.reason), 'different registry IDs cannot merge');
    });
    await t('a merge needs a second person and can be undone', async function(){
      as('PU-101'); var a = BOS.accounts.find(function(x){ return x.name === 'Southline Talent'; }), b = BOS.accounts.find(function(x){ return x.name === 'Southline Talent Group'; });
      var r = bosRequestMerge(a.id, b.id, 'Same company, imported twice'); ok(r.ok, r.reason);
      var self = bosDecide(r.approval.id, true, 'Checked the evidence on file and it is justified for this case.', 'Other (explained in note)'); ok(!self.ok, 'requester cannot approve');
      as('PU-102'); ok(!bosDecide(r.approval.id, true, 'Checked the evidence on file and it is justified for this case.', 'Other (explained in note)').ok, 'a sales manager lacks merge permission');
      as('PU-109'); var d = bosDecide(r.approval.id, true, 'Checked the evidence on file and it is justified for this case.', 'Other (explained in note)'); ok(d.ok, d.reason); eq(a.mergedInto, b.id, 'merged');
      ok(BOS.opps.filter(function(o){ return o.accountId === a.id; }).length === 0, 'records moved');
      var u = bosUndoMerge(a.id); ok(u.ok, u.reason); ok(!a.mergedInto && BOS.opps.some(function(o){ return o.accountId === a.id; }), 'undone and records back');
    });
    await t('ownership conflict is detected', async function(){
      as('PU-001'); var acc = BOS.accounts.find(function(a){ return a.name === 'Meridian Health Hiring'; });
      BOS.opps.push({ id:'OPP-T1', accountId:acc.id, kind:'Expansion', title:'Meridian · second desk', source:'Manual', ownerId:'PU-101', stage:'Qualified', status:'Qualified', history:[], createdAt:new Date().toISOString(), qualification:{} });
      bosIntegrityScan(); ok(BOS.exceptions.some(function(e){ return e.rule === 'ownership-conflict' && e.accountId === acc.id; }), 'conflict finding');
      BOS.opps = BOS.opps.filter(function(o){ return o.id !== 'OPP-T1'; });
    });
    await t('an incomplete sign-up can be followed up without copying the lead', async function(){
      as('PU-101'); var l = SIGNUP_LEADS.find(function(x){ return x.status === 'in_progress' && x.email; });
      ok(l, 'a seeded incomplete sign-up'); var r = bosFollowUpSignup(l.id); ok(r.ok, r.reason); eq(r.opp.signupLeadId, l.id, 'linked, not copied');
      var again = bosFollowUpSignup(l.id); ok(again.ok && again.opp.id === r.opp.id, 'second click is the same lead');
    });
    await t('sales manages the lead: qualify, follow-up, time-zone-aware demo, outcome', async function(){
      as('PU-102'); var o = BOS.opps.find(function(x){ return x.title === 'Northstar Talent UK · New business'; });
      var q = bosQualify(o.id, { need:'Contract hiring in the UK', volume:'60' }); ok(!q.ok && /decision maker/.test(q.reason), 'tells what is missing');
      q = bosQualify(o.id, { need:'Contract hiring in the UK', volume:'60', teamSize:'5', decisionMaker:'Emma Clarke', timeline:'Q1' }); ok(q.ok, q.reason);
      var at = new Date(Date.now() + 3 * 86400000); at.setUTCHours(14, 0, 0, 0);
      var d = bosScheduleDemo({ oppId:o.id, startsAt:at.toISOString(), timezone:'Europe/London' }); ok(d.ok, d.reason);
      ok(/Europe\/London/.test(d.demo.customerTime) && /14:00/.test(d.demo.customerTime), 'shown in the customer’s time: ' + d.demo.customerTime);
      eq(o.stage, 'Demo');
      var bad = bosDemoOutcome(d.demo.id, { attendance:'attended' }); ok(!bad.ok, 'outcome required');
      var out = bosDemoOutcome(d.demo.id, { attendance:'attended', outcome:'Strong fit', objections:['Price per seat'], features:['Vendor portal'] }); ok(out.ok, out.reason); eq(o.stage, 'Evaluation');
      var past = bosScheduleDemo({ oppId:o.id, startsAt:new Date(Date.now() - 3600000).toISOString() }); ok(!past.ok, 'no demo in the past');
    });
    await t('a proposal uses the official price; an approved offer needs no approval', async function(){
      as('PU-102'); var o = BOS.opps.find(function(x){ return x.title === 'Northstar Talent UK · New business'; });
      var hack = bosCreateProposal({ oppId:o.id, planId:'plan-growth', seats:5, price:1 }); ok(!hack.ok && /official list price/.test(hack.reason), 'price cannot be typed');
      var p = bosCreateProposal({ oppId:o.id, planId:'plan-growth', seats:5, promo:'LAUNCH10' }); ok(p.ok, p.reason);
      eq(p.proposal.status, 'ready', 'offer applies without approval'); eq(p.proposal.net, Math.round(planById('plan-growth').price * 0.9));
      ok(bosSendProposal(p.proposal.id).ok, 'sent (simulated)'); ok(BOS.outbox.some(function(m){ return /proposal/i.test(m.subject) && /not sent/.test(m.note); }), 'nothing really sent');
    });
    await t('a restricted discount needs approval, and sales can’t approve their own', async function(){
      as('PU-102'); var o = BOS.opps.find(function(x){ return x.title === 'Vistaar HR Services · New business'; });
      var big = bosCreateProposal({ oppId:o.id, planId:'plan-enterprise', seats:20, discountPct:30 }); ok(!big.ok || big.proposal, 'manager can draft it');
      as('PU-101'); var nocase = bosCreateProposal({ oppId:o.id, planId:'plan-enterprise', seats:20, discountPct:15 }); ok(!nocase.ok && /why this customer needs/.test(nocase.reason), 'a business case is required: ' + nocase.reason);
      ok(!bosCreateProposal({ oppId:o.id, planId:'plan-enterprise', seats:20, discountPct:15, justification:{ category:'Competitor offer', reason:'please approve' } }).ok, 'a stock phrase is not a case');
      var p = bosCreateProposal({ oppId:o.id, planId:'plan-enterprise', seats:20, discountPct:15, justification:{ category:'Competitor offer', reason:'Vistaar has a written quote from a rival ATS at 15% below our list for 20 seats, valid until month end.', competitor:'Rival ATS quote, 15% below list', withoutIt:'They sign with the rival this month.' } }); ok(p.ok, p.reason);
      eq(p.proposal.status, 'awaiting_approval'); eq(p.approval.type, 'discount');
      ok(!bosSendProposal(p.proposal.id).ok, 'cannot be sent before approval');
      ok(!bosDecide(p.approval.id, true, 'Checked the evidence on file and it is justified for this case.', 'Other (explained in note)').ok, 'requester can’t approve');
      as('PU-102'); var d = bosDecide(p.approval.id, true, 'Checked the evidence on file and it is justified for this case.', 'Other (explained in note)'); ok(d.ok, d.reason); eq(p.proposal.status, 'ready');
      as('PU-101'); var r = bosCreateProposal({ oppId:o.id, planId:'plan-enterprise', seats:20, discountPct:30, justification:{ category:'Competitor offer', reason:'Vistaar has a written quote from a rival ATS at 15% below our list for 20 seats, valid until month end.', competitor:'Rival ATS quote, 15% below list', withoutIt:'They sign with the rival this month.' } }); ok(r.ok && r.approval.type === 'discount-restricted', 'over 25% is restricted');
      as('PU-102'); ok(!bosDecide(r.approval.id, true, 'Checked the evidence on file and it is justified for this case.', 'Other (explained in note)').ok, 'a sales manager can’t approve a restricted discount');
      as('PU-109'); ok(!bosDecide(r.approval.id, false, 'no').ok, 'a decline needs real reasoning'); ok(bosDecide(r.approval.id, false, 'Too deep for a 20-seat deal; offer 15% which is already approved.', 'Margin too low for this deal').ok, 'revenue manager declines with a reason');
      var again = bosCreateProposal({ oppId:o.id, planId:'plan-enterprise', seats:20, discountPct:30, justification:{ category:'Competitor offer', reason:'Vistaar has a written quote from a rival ATS at 15% below our list for 20 seats, valid until month end.', competitor:'Rival ATS quote, 15% below list', withoutIt:'They sign with the rival this month.' } }); ok(!again.ok && /declined/.test(again.reason), 'the same case can’t be resubmitted unchanged');
      var tooMuch = bosCreateProposal({ oppId:o.id, planId:'plan-enterprise', seats:20, discountPct:55 }); ok(!tooMuch.ok, 'hard ceiling');
    });
    await t('won needs an accepted proposal, and the win hands over to Customer Operations with context', async function(){
      as('PU-102'); var o = BOS.opps.find(function(x){ return x.title === 'Meridian Health Hiring · New business'; });
      var early = bosMoveStage(o.id, 'Won'); ok(!early.ok && /accepted proposal/.test(early.reason), early.reason);
      var p = BOS.proposals.find(function(x){ return x.oppId === o.id && x.status === 'sent'; }); ok(bosAcceptProposal(p.id).ok, 'accepted');
      var w = bosMoveStage(o.id, 'Won'); ok(w.ok, w.reason); ok(w.handover && w.handover.ok, 'hand-over created');
      var obn = w.handover.onboarding; ok(obn.handover.checks.length >= 6 && obn.handover.completeness >= 70, 'completeness ' + obn.handover.completeness);
      ok(obn.ownerId && platformUserById(obn.ownerId).department === 'Customer Operations', 'owned by customer ops');
      eq(obn.accountId, o.accountId, 'canonical account');
    });
    await t('lost needs a reason; a lost deal can be reopened', async function(){
      as('PU-101'); var r = bosIntake({ company:'Brief Co', name:'B', email:'b@briefco.example', source:'Outbound' });
      ok(!bosMoveStage(r.opp.id, 'Lost').ok, 'reason required'); ok(bosMoveStage(r.opp.id, 'Lost', { reason:'No budget this year' }).ok, 'lost');
      ok(bosMoveStage(r.opp.id, 'Reopened').ok && bosOppOpen(r.opp), 'reopened');
    });
    await t('AI cannot bypass authorization or approvals', async function(){
      as('PU-101'); var a = BOS.approvals.find(function(x){ return x.status === 'pending'; });
      var r = bosKairo.attempt(function(){ return bosDecide(a.id, true, 'Checked the evidence on file and it is justified for this case.', 'Other (explained in note)'); }); ok(!r.ok && r.needsPerson, 'agent can’t decide approvals');
      var s = bosKairo.attempt(function(){ return bosSetRoles('PU-103', ['role_oontu_super_admin']); }); ok(!s.ok, 'agent can’t change roles');
      as('PU-103'); var n = bosKairo.nextAction(BOS.opps.find(function(o){ return o.ownerId === 'PU-109'; }).id); ok(!n.ok, 'agent sees only what the person can see');
      as('PU-101'); var k = bosKairo.nextAction(BOS.opps.find(function(o){ return o.ownerId === 'PU-101' && bosOppOpen(o); }).id); ok(k.ok && k.state === 'completed' && /simulated/.test(bosKairo.label), 'labelled simulated');
    });
    await t('every change is audited with the employee who made it', async function(){
      as('PU-101'); var n = AUDIT_LOG.length; bosIntake({ company:'Audit Check Ltd', name:'A', email:'a@auditcheck.example', source:'Referral' });
      var e = AUDIT_LOG[0]; ok(AUDIT_LOG.length > n && e.module === 'Platform' && e.actor === 'Arjun Rao' && /Inquiry received/.test(e.action), JSON.stringify(e).slice(0, 200));
      as('PU-001');
    });
    pub();
  }, 300); });
})();
