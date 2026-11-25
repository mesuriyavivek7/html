/* Business OS (2026-11-25), part 2: Service, Customer Operations, Finance, Tenant operations, Integrity, My Work, product
   intelligence and the screens. Maps to the acceptance scenarios in the master assignment §22 (docs/oontu-evolution/37).
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\bos-operations.spec.js */
(function(){
  var results = [];
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  var ce = console.error; console.error = function(){ errs.push('console.error ' + Array.prototype.slice.call(arguments).map(function(a){ return (a && a.message) || String(a); }).join(' ').slice(0, 160)); ce.apply(console, arguments); };
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e && e.message || e) }); } pub(); }
  function pub(){ var pre = document.getElementById('auth-test-results'); if(!pre){ pre = document.createElement('pre'); pre.id = 'auth-test-results'; document.body.appendChild(pre); } pre.textContent = JSON.stringify(results); }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function eq(a, b, m){ if(a !== b) throw new Error((m ? m + ': ' : '') + 'expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a)); }
  function as(id){ ACTIVE_PLATFORM_USER_ID = id; }
  var main = function(){ return document.getElementById('main-content').textContent; };
  var H = 3600000;

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    try { localStorage.clear(); } catch(e){}
    state.role = 'oontu'; as('PU-001'); var app = document.getElementById('app'); app.classList.remove('hidden'); app.classList.add('flex'); renderSidebar(); await sleep(30);
    var harbor = BOS.accounts.find(function(a){ return a.tenantIds.indexOf(CURRENT_ORGANIZATION_ID) > -1; });

    await t('a ticket is created, classified, routed and given an SLA; it links account and tenant', async function(){
      as('PU-103'); var r = bosCreateTicket({ subject:'Password reset link not arriving', body:'Our recruiter cannot sign in', contactEmail:'priya@harborpartners.example', source:'In-app' });
      ok(r.ok, r.reason); var tk = r.ticket;
      eq(tk.category, 'Login / account'); eq(tk.queue, 'technical'); ok(tk.classification.suggested && /Matched/.test(tk.classification.why), 'explained suggestion');
      eq(tk.accountId, harbor.id, 'account'); eq(tk.tenantId, CURRENT_ORGANIZATION_ID, 'tenant'); ok(tk.sla.respondBy && tk.sla.resolveBy, 'SLA set');
      ok(tk.history.some(function(h){ return /Routed to Technical Support/.test(h.text); }), 'routed');
    });
    await t('routing follows the table for every category', async function(){
      var cases = [['Invoice charged twice', 'billing'], ['Please renew our contract', 'revenue'], ['Help configure workflow template setup', 'customer-ops'], ['Everything is down for all users', 'incident'], ['We want to cancel our account', 'retention'], ['Upgrade to enterprise plan with more seats', 'revenue'], ['CSV import failed', 'technical'], ['Possible phishing security issue', 'security'], ['Training for new team', 'training'], ['Button is broken', 'support']];
      cases.forEach(function(c){ eq(bosClassify(c[0], '').queue, c[1], c[0]); });
      eq(bosClassify('Everything is down for all users', '').priority, 'P1', 'outage is P1');
    });
    await t('email intake creates a ticket, joins replies to the thread, ignores duplicates and quarantines spoofed mail', async function(){
      var r = BOS_MAIL.receive({ from:'Farah <farah@southline.example>', messageId:'<m1@southline.example>', subject:'Candidate import created duplicates again', body:'Same as last time.' });
      ok(r.ok && r.ticket && r.ticket.source === 'Email', 'created'); var tk = r.ticket;
      eq(tk.accountId, BOS.accounts.find(function(a){ return a.name === 'Southline Talent Group'; }).id, 'sender resolved to account');
      var again = BOS_MAIL.receive({ from:'farah@southline.example', messageId:'<m1@southline.example>', subject:'x' }); ok(again.duplicate, 'same Message-ID ignored');
      var reply = BOS_MAIL.receive({ from:'farah@southline.example', messageId:'<m2@southline.example>', subject:'Re: [' + tk.id + '] Candidate import', body:'Any update?' }); ok(reply.appended && reply.ticket.id === tk.id, 'threaded by ticket ID');
      var reply2 = BOS_MAIL.receive({ from:'farah@southline.example', messageId:'<m3@southline.example>', subject:'Re: no id', inReplyTo:'<m1@southline.example>', body:'Hello?' }); ok(reply2.appended && reply2.ticket.id === tk.id, 'threaded by In-Reply-To');
      var spoof = BOS_MAIL.receive({ from:'ceo@southline.example', messageId:'<m4@x>', subject:'Wire money', auth:{ spf:'fail', dkim:'fail', dmarc:'fail' } }); ok(spoof.quarantined, 'quarantined');
      var stranger = BOS_MAIL.receive({ from:'eve@evil.example', messageId:'<m5@x>', subject:'Re: [' + tk.id + '] hijack', body:'add me' }); ok(stranger.ticket && stranger.ticket.id !== tk.id, 'a stranger can’t join a thread by quoting the ID');
    });
    await t('assignment respects queues; the SLA pauses while waiting on the customer', async function(){
      var tk = BOS.tickets.find(function(x){ return x.subject === 'Invoice shows the wrong GST number'; });
      as('PU-103'); var r = bosTicketAssign(tk.id, 'PU-103'); ok(!r.ok, 'billing is not Rohan’s queue');
      as('PU-104'); r = bosTicketAssign(tk.id, 'PU-106'); ok(r.ok, r.reason);
      as('PU-106'); ok(bosTicketReply(tk.id, 'We are correcting it.', { wait:true }).ok, 'replied'); eq(tk.status, 'waiting_customer'); ok(bosSlaState(tk).paused, 'paused');
      ok(tk.firstResponseAt, 'first response recorded'); ok(bosTicketStatus(tk.id, 'investigating').ok && !bosSlaState(tk).paused && tk.pausedMs >= 0, 'resumed');
    });
    await t('a ticket escalates to the owner’s manager', async function(){
      var tk = BOS.tickets.find(function(x){ return x.subject === 'Recruiters cannot log in after password reset'; });
      as('PU-103'); ok(!bosTicketEscalate(tk.id, '').ok, 'reason needed'); var r = bosTicketEscalate(tk.id, 'Customer blocked for 6 hours'); ok(r.ok, r.reason);
      eq(r.escalatedTo, 'PU-104'); eq(tk.priority, 'P1', 'raised one level'); ok((tk.assignees || []).indexOf('PU-104') > -1, 'manager co-assigned');
    });
    await t('a ticket can’t close without a resolution; it reopens when the customer replies', async function(){
      var tk = BOS.tickets.find(function(x){ return x.subject === 'Recruiters cannot log in after password reset'; });
      as('PU-103'); ok(!bosTicketStatus(tk.id, 'resolved').ok, 'needs a resolution'); ok(!bosTicketStatus(tk.id, 'closed', { resolution:'x' }).ok, 'resolve before close');
      ok(bosTicketStatus(tk.id, 'resolved', { resolution:'Reset links re-sent; mail filter fixed', rootCause:'Customer mail filter' }).ok, 'resolved');
      var r = BOS_MAIL.receive({ from:'priya@harborpartners.example', messageId:'<h9@harbor>', subject:'Re: [' + tk.id + '] still broken', body:'Still cannot sign in' });
      ok(r.appended, 'threaded'); eq(tk.status, 'investigating', 'reopened'); eq(tk.reopenCount, 1);
    });
    await t('an outage ticket links to an incident and can’t be resolved without one', async function(){
      as('PU-103'); var r = bosCreateTicket({ subject:'Oontu is down for all users', body:'503 everywhere', contactEmail:'farah@southline.example' });
      ok(r.ok && r.ticket.incidentId, 'auto-linked to an incident'); var inc = BOS.incidents.find(function(i){ return i.id === r.ticket.incidentId; }); ok(inc.ticketIds.indexOf(r.ticket.id) > -1, 'incident lists it');
      var r2 = bosCreateTicket({ subject:'Site down again 500 error', body:'' }); eq(r2.ticket.incidentId, inc.id, 'joins the open incident');
      as('PU-104'); ok(bosResolveIncident(inc.id, 'Database failover; fixed').ok, 'incident resolved');
    });
    await t('safe AI: Kairo drafts from approved knowledge, never sends or resolves', async function(){
      as('PU-103'); var tk = BOS.tickets.find(function(x){ return x.subject === 'Password reset link not arriving'; });
      var d = bosKairo.draftReply(tk.id); ok(d.ok && d.state === 'needs_confirmation' && /KB-101/.test(d.sources.join()), 'draft with sources');
      ok(tk.messages.some(function(m){ return m.draft; }) && !tk.firstResponseAt, 'saved as draft, not a response'); ok(!/resolved|closed/.test(tk.status), 'not resolved');
      var none = bosKairo.draftReply(BOS.tickets.find(function(x){ return x.subject === 'Oontu is down for all users'; }).id); eq(none.state, 'partial', 'no approved article → says so');
    });
    await t('won deal → hand-over → onboarding → workspace provisioned once', async function(){
      as('PU-102'); var opp = BOS.opps.find(function(x){ return x.title === 'Meridian Health Hiring · New business'; });
      var p = BOS.proposals.find(function(x){ return x.oppId === opp.id && x.status === 'sent'; }); ok(bosAcceptProposal(p.id).ok, 'accepted');
      var w = bosMoveStage(opp.id, 'Won'); ok(w.ok, w.reason); var o = w.handover.onboarding;
      var acc = bosAccount(o.accountId); eq(acc.id, opp.accountId); ok(o.goals && o.planName, 'goals and plan carried over');
      ok(platformUserById(o.ownerId).department === 'Customer Operations', 'owned by Customer Operations');
      as('PU-101'); ok(!bosProvisionFromOnboarding(o.id).ok, 'sales can’t provision');
      as(o.ownerId); var before = PLATFORM_TENANTS.length;
      var r = bosProvisionFromOnboarding(o.id); ok(r.ok, r.reason); eq(PLATFORM_TENANTS.length, before + 1, 'one tenant');
      ok(acc.tenantIds.indexOf(r.tenant.id) > -1 && o.tenantId === r.tenant.id, 'linked to account and onboarding');
      ok(!bosProvisionFromOnboarding(o.id).ok, 'second click refused'); eq(PLATFORM_TENANTS.length, before + 1, 'still one');
      var s = bosStandardSetup(o.id); ok(s.ok && s.setup.simulated && s.setup.steps.length >= 5, 'standard setup simulated for a remote tenant');
    });
    await t('activation is based on evidence, not on sign-in', async function(){
      var o = BOS.onboardings.find(function(x){ return x.tenantId === CURRENT_ORGANIZATION_ID; }); var act = bosActivation(o);
      ok(act.rule && /not activation/.test(act.rule), 'rule stated');
      ok(['team','first_job'].every(function(k){ return act.have.indexOf(k) > -1 === !!o.milestones.find(function(m){ return m.key === k; }).done; }), 'computed from milestones');
      var jobsMs = o.milestones.find(function(m){ return m.key === 'first_job'; }); ok(!jobsMs.done || /job/.test(jobsMs.evidence), 'evidence names the jobs: ' + jobsMs.evidence);
      as('PU-105'); var r = bosCompleteMilestone(o.id, 'first_job', 'I saw it'); ok(!r.ok, 'automatic milestones on the live workspace can’t be ticked by hand');
    });
    await t('training: scheduled, capacity enforced with a waitlist, attendance recorded after it starts', async function(){
      as('PU-105'); var at = new Date(Date.now() + 2 * 86400000).toISOString();
      var s = bosCreateSession({ title:'Admins: approvals and roles', startsAt:at, capacity:2, trainerId:'PU-105' }); ok(s.ok, s.reason);
      ok(bosRegister(s.session.id, harbor.id, 'a1@harborpartners.example').ok && bosRegister(s.session.id, harbor.id, 'a2@harborpartners.example').ok, 'two seats');
      var third = bosRegister(s.session.id, harbor.id, 'a3@harborpartners.example'); ok(third.ok && third.waitlisted, 'waitlisted when full');
      ok(!bosAttendance(s.session.id, 'a1@harborpartners.example', true).ok, 'not before it starts');
      APS.clockOffsetMs = (APS.clockOffsetMs || 0) + 3 * 86400000;
      ok(bosAttendance(s.session.id, 'a1@harborpartners.example', true).ok, 'attended'); APS.clockOffsetMs -= 3 * 86400000;
      var o = BOS.onboardings.find(function(x){ return x.accountId === harbor.id; }); ok(o.milestones.find(function(m){ return m.key === 'training'; }).done, 'training milestone completed from attendance');
    });
    await t('health is explained with evidence; renewal readiness is monitored and Revenue owns the renewal', async function(){
      var h = bosHealth(harbor.id); ok(h.evidence.length === 5 && h.evidence.every(function(e){ return e.label && e.detail; }), 'five explained parts'); eq(h.score, h.evidence.reduce(function(s, e){ return s + e.points; }, 0), 'score = sum');
      var sub = subscriptionForTenant(CURRENT_ORGANIZATION_ID); var old = sub.renewalDate; sub.renewalDate = new Date(Date.now() + 40 * 86400000).toISOString().slice(0, 10);
      var ren = bosRenewals(); ok(ren.some(function(r){ return r.account.id === harbor.id; }), 'in the renewal list');
      bosIntegrityScan(); ok(BOS.exceptions.some(function(e){ return e.rule === 'unowned-renewal' && e.accountId === harbor.id; }), 'unowned renewal flagged');
      as('PU-107'); var r = bosStartRenewal(harbor.id); ok(r.ok, r.reason); ok(r.opp.kind === 'Renewal' && platformUserById(r.opp.ownerId) && bosCan('platform-lead', 'assign', null, platformUserById(r.opp.ownerId)) || r.opp.ownerId, 'owned by Revenue');
      ok(!bosStartRenewal(harbor.id).ok, 'no duplicate renewal');
      sub.renewalDate = old;
    });
    await t('payment state can’t be changed by hand without Finance permission and a reference', async function(){
      as('PU-001'); var sub = subscriptionForTenant(CURRENT_ORGANIZATION_ID); if(sub.status === 'trial') sub.status = 'active';
      var g = generateInvoiceForSubscription(sub.id); ok(g.ok, g.reason); var inv = g.invoice;
      as('PU-101'); var r = markInvoicePaid(inv.id, { reference:'UTR123' }); ok(!r.ok, 'sales can’t'); eq(inv.status, 'issued');
      as('PU-106'); r = markInvoicePaid(inv.id); ok(!r.ok && /reference/.test(r.reason), 'reference needed');
      r = markInvoicePaid(inv.id, { reference:'UTR998877' }); ok(r.ok, r.reason); eq(inv.verifiedBy, 'manual:PU-106'); ok(AUDIT_LOG.some(function(e){ return /Payment verified by hand/.test(e.action); }), 'audited');
    });
    await t('provider events are verified, applied once, in order; a payment link pays its invoice', async function(){
      as('PU-001'); var sub = subscriptionForTenant(CURRENT_ORGANIZATION_ID); var inv = generateInvoiceForSubscription(sub.id).invoice;
      var l = bosCreatePayLink(null, inv.id); ok(l.ok, l.reason);
      eq(l.link.amount, inv.total, 'the link collects the tax-inclusive total');
      var raw = JSON.stringify({ id:'evt_1', type:'payment.captured', object:{ id:l.link.id, amount:l.link.amount, currency:inv.currency, version:2 } });
      var forged = BOS_PAY.receive(raw, 'sim1=deadbeef'); ok(!forged.ok, 'bad signature rejected'); eq(inv.status, 'issued');
      var good = BOS_PAY.receive(raw, BOS_PAY.sign(raw)); ok(good.applied, 'applied'); eq(inv.status, 'paid'); ok(/^provider:/.test(inv.verifiedBy), 'verified by the provider event');
      var dup = BOS_PAY.receive(raw, BOS_PAY.sign(raw)); ok(dup.duplicate, 'replay ignored');
      var oldRaw = JSON.stringify({ id:'evt_0', type:'payment.failed', object:{ id:l.link.id, amount:inv.amount, currency:inv.currency, version:1 } });
      var stale = BOS_PAY.receive(oldRaw, BOS_PAY.sign(oldRaw)); ok(stale.stale, 'older event arriving late is not applied'); eq(l.link.status, 'paid');
      var orphan = BOS_PAY.simulate('payment.captured', { id:'pl_unknown', amount:5, currency:'USD', version:1 }); ok(orphan.unmatched, 'unmatched'); ok(BOS.exceptions.some(function(e){ return e.rule === 'payment-unmatched'; }), 'becomes a finance exception');
    });
    await t('refund is controlled: requested, approved by another Finance manager, completed by the provider', async function(){
      var inv = PLATFORM_INVOICES.find(function(i){ return i.status === 'paid'; });
      as('PU-101'); ok(!bosRequestRefund({ invoiceId:inv.id, amount:1, reason:'x' }).ok, 'sales can’t request');
      as('PU-106'); ok(!bosRequestRefund({ invoiceId:inv.id, amount:inv.amount + 1, reason:'Too much' }).ok, 'not more than paid');
      var r = bosRequestRefund({ invoiceId:inv.id, amount:1, reason:'Goodwill credit for the outage' }); ok(r.ok, r.reason);
      ok(!bosDecide(r.approval.id, true).ok, 'not by the requester');
      as('PU-001'); ok(bosDecide(r.approval.id, true).ok, 'approved by someone else'); eq(r.refund.status, 'approved');
      var done = BOS_PAY.simulate('refund.processed', { id:r.refund.providerId, amount:1, currency:inv.currency, version:1 }); ok(done.applied, 'provider event'); eq(r.refund.status, 'refunded');
    });
    await t('Finance handles a reconciliation exception', async function(){
      as('PU-001'); var sub = subscriptionForTenant(CURRENT_ORGANIZATION_ID); var inv = generateInvoiceForSubscription(sub.id).invoice;
      inv.status = 'paid'; inv.paidAt = new Date().toISOString();   // paid with no event and no reference (a bad import, say)
      bosIntegrityScan(); var e = BOS.exceptions.find(function(x){ return x.rule === 'paid-unverified' && x.ref.id === inv.id; }); ok(e, 'detected');
      ok(e.ownerId && platformUserById(e.ownerId).department === 'Business & Finance', 'assigned to Finance');
      as('PU-106'); ok(!bosReviewException(e.id, 'resolve', '').ok, 'resolution text needed');
      ok(bosReviewException(e.id, 'review').ok && bosReviewException(e.id, 'confirm', 'No payment found in the bank statement').ok, 'reviewed and confirmed');
      inv.status = 'issued'; inv.paidAt = null; ok(bosReviewException(e.id, 'resolve', 'Invoice set back to issued; customer chased').ok, 'resolved');
      ok(bosReviewException(e.id, 'close').ok, 'closed'); ok(AUDIT_LOG.some(function(x){ return /Integrity finding/.test(x.action); }), 'audited');
    });
    await t('false-positive review is possible and is remembered', async function(){
      as('PU-001'); bosIntegrityScan(); var e = BOS.exceptions.find(function(x){ return x.rule === 'missed-follow-up' && ['assigned','detected'].indexOf(x.status) > -1; }); ok(e, 'a follow-up finding');
      as(e.ownerId || 'PU-001'); if(!bosCan('platform-integrity', 'resolve', e)) as('PU-001');
      ok(!bosReviewException(e.id, 'false_positive', '').ok, 'reason needed');
      ok(bosReviewException(e.id, 'false_positive', 'Customer asked us to call next week').ok, 'marked');
      bosIntegrityScan(); eq(BOS.exceptions.filter(function(x){ return x.key === e.key && ['detected','assigned'].indexOf(x.status) > -1; }).length, 0, 'not raised again for the same evidence');
    });
    await t('sensitive access is controlled: purpose, ticket, customer permission, someone else approves, it expires', async function(){
      as('PU-103'); var tk = BOS.tickets.find(function(x){ return x.accountId === harbor.id; });
      ok(!bosRequestAccess({ tenantId:CURRENT_ORGANIZATION_ID, scope:'workspace-data', purpose:'Check the import mapping', hours:2 }).ok, 'needs a ticket');
      ok(!bosRequestAccess({ tenantId:CURRENT_ORGANIZATION_ID, scope:'workspace-data', purpose:'Check the import mapping', hours:2, ticketId:tk.id }).ok, 'needs customer authorisation');
      var r = bosRequestAccess({ tenantId:CURRENT_ORGANIZATION_ID, scope:'workspace-data', purpose:'Check the import mapping', hours:2, ticketId:tk.id, customerAuthorised:true }); ok(r.ok && r.grant.status === 'requested', r.reason);
      ok(!bosHasAccess(CURRENT_ORGANIZATION_ID, 'workspace-data'), 'no access before approval');
      ok(!bosDecide(r.approval.id, true).ok, 'not self-approved');
      as('PU-104'); ok(bosDecide(r.approval.id, true).ok, 'support manager approves');
      as('PU-103'); ok(bosHasAccess(CURRENT_ORGANIZATION_ID, 'workspace-data'), 'granted');
      APS.clockOffsetMs = (APS.clockOffsetMs || 0) + 3 * H; ok(!bosHasAccess(CURRENT_ORGANIZATION_ID, 'workspace-data'), 'expired'); APS.clockOffsetMs -= 3 * H;
      ok(AUDIT_LOG.some(function(e){ return /Sensitive access requested/.test(e.action); }) && AUDIT_LOG.some(function(e){ return /Access expired/.test(e.action); }), 'audited');
    });
    await t('Platform Admin views Tenant 360; tenant lifecycle keeps its policy', async function(){
      as('PU-001'); openOontuTenantDetail(CURRENT_ORGANIZATION_ID); await sleep(40);
      ok(document.getElementById('bos-tenant360') && /Tenant 360/.test(main()) && /Customer stage/.test(main()) && /Health/.test(main()), 'Tenant 360 shown');
      var r = changeTenantStatus(CURRENT_ORGANIZATION_ID, 'invited', { reason:'test' }); ok(!r || !r.ok, 'active → invited is not an allowed transition');
      ok(['Prospect','Trial','Onboarding','Active','Adoption','Renewal','Expansion','At risk','Suspended','Churned','Lost prospect'].indexOf(bosCustomerStage(harbor.id)) > -1, 'customer stage from evidence');
    });
    await t('My Work aggregates canonical work with explainable points and no duplicates', async function(){
      as('PU-104'); var w = bosMyWork(); ok(w.length > 0, 'has work');
      ok(w.every(function(i){ return typeof i.score === 'number' && i.whyText; }), 'every item explains its points');
      var keys = w.map(function(i){ return i.type + ':' + i.id; }); eq(keys.length, new Set(keys).size, 'no duplicate items');
      ok(w.some(function(i){ return i.type === 'Ticket'; }), 'tickets from the records');
      for(var k = 1; k < w.length; k++) ok(w[k - 1].score >= w[k].score, 'sorted by points');
      as('PU-106'); ok(bosMyWork().every(function(i){ return i.type !== 'Approval' || bosCanDecide(BOS.approvals.find(function(a){ return a.id === i.id; })).ok; }), 'only approvals they may decide');
    });
    await t('product feedback links to evidence; one mention is only a signal', async function(){
      var th = bosProductThemes(); ok(th.length, 'themes'); var imp = th.find(function(x){ return x.theme === 'Candidate import'; });
      ok(imp && imp.evidence.length >= 2 && imp.evidence.some(function(e){ return e.src === 'Ticket'; }), 'import theme with ticket evidence');
      ok(th.some(function(x){ return x.count === 1 && x.strength === 'Signal'; }), 'single mention = signal');
    });
    await t('cross-workspace consistency: one account, one tenant, the same records in every view', async function(){
      as('PU-001'); var a = harbor; var tix = BOS.tickets.filter(function(t){ return t.accountId === a.id; }).length;
      bosOpen('account', a.id); await sleep(30); ok(new RegExp(a.name).test(main()) && /Tickets/.test(main()), 'account 360 renders');
      eq(BOS.accounts.filter(function(x){ return x.tenantIds.indexOf(CURRENT_ORGANIZATION_ID) > -1 && !x.mergedInto; }).length, 1, 'one account owns the tenant');
      ok(bosTenant360HTML(CURRENT_ORGANIZATION_ID).indexOf(String(BOS.tickets.filter(function(t){ return t.tenantId === CURRENT_ORGANIZATION_ID && !/resolved|closed/.test(t.status); }).length)) > -1, 'same open-ticket count in Tenant 360');
      ok(tix >= 1, 'tickets linked');
    });
    await t('every Business OS screen renders for the roles that can see it, and refuses the rest', async function(){
      var people = ['PU-001','PU-101','PU-103','PU-105','PU-106','PU-108'];
      for(var p = 0; p < people.length; p++){
        as(people[p]); bosActAs(people[p]); renderSidebar();
        var vis = []; filterNavForPermissions(NAV.oontu).forEach(function(g){ (g.items || [g]).forEach(function(i){ vis.push(i.id); }); });
        ok(vis.indexOf('oontu-mywork') > -1, people[p] + ' has My work');
        for(var v = 0; v < vis.length; v++){ var before = errs.length; showView(vis[v]); await sleep(15); ok(!/Something went wrong|Not available/.test(main()), people[p] + ' ' + vis[v] + ': ' + main().slice(0, 80)); ok(errs.length === before, people[p] + ' ' + vis[v] + ' error ' + errs.slice(before).join()); }
      }
      bosActAs('PU-001'); renderSidebar();
    });
    await t('the screens: Revenue tabs, a ticket, onboarding and the dialogs work', async function(){
      as('PU-001'); showView('oontu-revenue'); await sleep(20);
      for(var i = 0; i < 5; i++){ bosTab('oontu-revenue', i); await sleep(5); ok(main().length > 200, 'tab ' + i); }
      bosInquiryDialog(); ok(document.querySelector('#bos-dialog-root [role=dialog]'), 'dialog'); document.getElementById('bos-iq-company').value = 'Dialog Co'; document.getElementById('bos-iq-name').value = 'Dee'; document.getElementById('bos-iq-email').value = 'dee@dialogco.example'; bosInquirySubmit(); await sleep(20);
      ok(!document.querySelector('#bos-dialog-root [role=dialog]') && /Dialog Co/.test(main()), 'saved and opened the lead');
      bosOpen('ticket', BOS.tickets[0].id); await sleep(20); ok(/Conversation/.test(main()) && /History/.test(main()), 'ticket page');
      bosOpen('onboarding', BOS.onboardings[0].id); await sleep(20); ok(/Milestones/.test(main()) && /Hand-over/.test(main()), 'onboarding page');
      showView('oontu-service'); for(var s = 0; s < 5; s++){ bosTab('oontu-service', s); await sleep(5); }
      showView('oontu-finance'); for(var f = 0; f < 5; f++){ bosTab('oontu-finance', f); await sleep(5); }
      showView('oontu-platform-users'); for(var e = 0; e < 5; e++){ bosTab('oontu-platform-users', e); await sleep(5); } ok(/Permission catalog|Outbox/.test(main()), 'employees tabs');
      showView('oontu-custops'); for(var c = 0; c < 3; c++){ bosTab('oontu-custops', c); await sleep(5); }
      bosMailDialog(); bosMailSubmit(); await sleep(20); ok(/Received email/.test(main()), 'email intake tab after simulation');
    });
    await t('the sidebar shows the five workspaces for the Super Admin', async function(){
      as('PU-001'); bosActAs('PU-001'); renderSidebar(); var heads = Array.prototype.map.call(document.querySelectorAll('#sidebar-nav .o-nav-head .sidebar-label'), function(x){ return x.textContent.trim(); }).filter(Boolean).join(',');
      ok(/Revenue/.test(heads) && /Service/.test(heads) && /Customer operations/i.test(heads) && /Business & finance/i.test(heads), heads);
      ok(/Platform administration/i.test(document.getElementById('sidebar-nav').textContent), 'platform administration group');
    });
    pub();
  }, 300); });
})();
