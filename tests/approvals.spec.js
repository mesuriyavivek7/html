/* Approvals: the process (TAT, reminders, escalation, late reasons, waiting on others) and the screen.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\approvals.spec.js        (the engine itself: & .\test\run-aps-tests.ps1) */
(function(){
  var results = [];
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var q = function(s){ return document.querySelector(s); };
  var errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  var ce = console.error; console.error = function(){ errs.push('console.error ' + Array.prototype.slice.call(arguments).map(function(a){ return (a && a.stack) || (a && a.message) || String(a); }).join(' ').slice(0, 300)); };
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length>before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e.stack||e.message).slice(0, 500) }); } }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function as(role){ state.role = role; previewAsRoleId = null; renderSidebar(); }
  var toasts = []; var realToast = window.toast; window.toast = function(m){ toasts.push(String(m)); try { return realToast.apply(this, arguments); } catch(e){} };
  var template = null, seq = 0;
  /** a brand-new submission waiting for review, created right now */
  function freshSub(extra){
    template = template || SUBMISSIONS.find(function(s){ return s.stage === 'Pending Review'; });
    var c = CANDIDATES[(seq++) % CANDIDATES.length], j = JOBS.find(function(x){ return x.status === 'Active'; });
    var sb = JSON.parse(JSON.stringify(template)); sb.id = 'sub-t-' + seq; sb.candidateId = c.id; sb.jobId = j.id; var at = new Date(APS.now()).toISOString(); sb.createdAt = at; SUBMISSIONS.push(sb);
    var req = { id:'appr-t' + seq, chainId:null, entityType:'SubmissionReview', entityId:sb.id, organizationId:CURRENT_ORGANIZATION_ID, requestedByRole:'role_recruiter', requestedByUserId:'RP-081', requestedByName:'Divya Menon', approverRoleId:'role_recmgr', approverUserId:'RP-092', approverName:'Arjun Kapoor', status:'Pending', context:{ submissionId:sb.id, candidateId:c.id, jobId:j.id }, createdAt:at, decidedAt:null, decidedByName:null, decisionReason:null };
    APPROVAL_REQUESTS.push(Object.assign(req, extra || {})); APS.tick(); return req;
  }
  function reset(){ APS.clockOffsetMs = 0; AP.focus = null; AP.sel = {}; AP.undo = null; AP.back = null; AP.view = 'needs'; AP.lane = ''; AP.type = 'all'; AP.q = ''; document.querySelectorAll('[role=dialog]').forEach(function(d){ d.remove(); }); }
  function modal(){ return document.querySelector('[role=dialog][aria-label="Explain the delay"]'); }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    state.role = 'admin'; enterApp(); await sleep(150);

    await t('the engine is loaded once and every decide function is guarded', async function(){
      ok(typeof APS === 'object' && APS._timer, 'APS started'); ['decideApproval','decideApprovalFromUI','apprSubmission','decideApprovalFromLineup','decideClientApproval','submitDecideJobMappingRequest','cwApprove'].forEach(function(f){ ok(window[f] && window[f].__aps, f + ' is guarded'); });
      ok(APS.config.ladder.backup.roleId === 'role_recmgr', 'backup is the Recruiter Manager'); ok(Object.keys(APS.config.policies).every(function(k){ return APS.config.policies[k].autoDecide === false; }), 'nothing decides on its own');
      ok(APPROVAL_REQUESTS.every(function(r){ return r.createdAt && r.requestedByName && (r.approverUserId || r.approverRoleId); }), 'every record has who and when');
    });

    await t('a new review shows its business-hours due time at once; a reminder toast comes at 50%, a red chip and an audit line at the TAT', async function(){
      reset(); as('manager'); var r = freshSub(); var v = APS.view('req:' + r.id);
      ok(v && v.state === 'on_track' && /^Due /.test(v.chip), 'due chip: ' + (v && v.chip)); ok(Math.abs(v.dueAt - APS.addBusinessMinutes(Date.parse(r.createdAt), 240)) < 1000, 'due = created + 4 business hours');
      toasts = []; APS.fastForward(2.1); ok(toasts.some(function(x){ return /Due in|need your attention/.test(x); }), 'reminder toast: ' + toasts.join('|'));
      var before = AUDIT_LOG.length; APS.fastForward(2.5); v = APS.view('req:' + r.id);
      ok((v.state === 'overdue' || v.state === 'escalated') && v.tone === 'red', 'red chip: ' + v.state + ' ' + v.chip); ok(AUDIT_LOG.slice(0, AUDIT_LOG.length - before + 3).some(function(a){ return /TAT breached/.test(a.action); }), 'audit: TAT breached');
      ok(v.coOwners.length === 0 || v.level >= 1, 'escalation level set'); ok(APS.queueFor().some(function(x){ return x.key === 'req:' + r.id; }), 'it stays in the owner’s queue');
      var ntf = APS.notificationItems().filter(function(n){ return n.id.indexOf('req:' + r.id) > -1; }); ok(ntf.length && ntf[0].category === 'Approvals', 'notification in the Approvals category');
      APS.fastForward(5); v = APS.view('req:' + r.id); as('admin'); ok(v.level === 2 || APS.view('req:' + r.id).coOwners.some(function(c){ return c.roleId === APS.config.ladder.owner.roleId; }), 'the Owner is added after the second step'); ok(APS.queueFor().some(function(x){ return x.key === 'req:' + r.id; }), 'the Owner sees it, with the escalation banner'); reset();
    });

    await t('deciding an overdue item asks for a reason; Cancel leaves it pending; saving it completes the decision; on-time decisions never ask', async function(){
      reset(); as('admin'); var r = freshSub(); APS.fastForward(5); ok(APS.view('req:' + r.id).needsJustification, 'late');
      decideApproval(r.id, 'Approved'); await sleep(20); ok(modal(), 'the late-decision modal opens'); ok(/Explain the delay before you decide/.test(modal().textContent), 'its title');
      Array.prototype.find.call(modal().querySelectorAll('button'), function(b){ return b.textContent === 'Cancel'; }).click(); ok(!modal() && apReqById(r.id).status === 'Pending', 'Cancel leaves it pending');
      decideApproval(r.id, 'Approved'); await sleep(20); modal().querySelector('[role=radio]').click(); var go = Array.prototype.find.call(modal().querySelectorAll('button'), function(b){ return /Save reason/.test(b.textContent); }); go.click(); ok(modal(), 'a note is needed'); modal().querySelector('textarea').value = 'Waited for the client to confirm the budget band.'; go.click(); await sleep(20);
      ok(!modal() && apReqById(r.id).status === 'Approved', 'saved and decided'); var b = APS.state.breaches[APS.state.breaches.length - 1]; ok(b.key === 'req:' + r.id && b.note, 'the reason is kept');
      ok(/Waited for the client/.test(sec_approvalRules(true)), 'it shows under Settings › Approval rules › Performance');
      reset(); var r2 = freshSub(); decideApproval(r2.id, 'Approved'); await sleep(20); ok(!modal() && apReqById(r2.id).status === 'Approved', 'on time: no question');
    });

    await t('bulk: one reason covers every overdue item, and on-time items are never asked about', async function(){
      reset(); as('admin'); var a = freshSub(), b = freshSub(); APS.fastForward(5); var c = freshSub(); var n0 = APS.state.breaches.length; var done = 0;
      APS.guardBulk('req', [a.id, b.id, c.id], function(){ [a, b, c].forEach(function(x){ decideApproval(x.id, 'Approved', 'in bulk'); }); done++; }); await sleep(20); ok(modal() && !done, 'one modal first');
      modal().querySelector('[role=radio]').click(); modal().querySelector('textarea').value = 'The queue was too large this morning.'; Array.prototype.find.call(modal().querySelectorAll('button'), function(x){ return /Save reason/.test(x.textContent); }).click(); await sleep(20);
      ok(done === 1 && [a, b, c].every(function(x){ return apReqById(x.id).status === 'Approved'; }), 'all decided once'); ok(APS.state.breaches.length - n0 === 2, 'two late items, one breach each: ' + (APS.state.breaches.length - n0)); reset();
    });

    await t('send back: the requester owes "Resubmit or withdraw" for a day; resubmitting closes it. Approve: the requester owes "Send to client" in 2h; sending closes it', async function(){
      reset(); as('admin'); var r = freshSub(); decideApproval(r.id, 'Rejected', 'Fit is too low'); APS.tick(); var v = APS.view('req:' + r.id);
      ok(v.phase === 'return' && v.phaseLabel === 'Resubmit or withdraw' && v.tatHours === 9 && v.owner.name === 'Divya Menon', 'return phase: ' + JSON.stringify([v.phase, v.phaseLabel, v.tatHours, v.owner && v.owner.name]));
      APPROVAL_REQUESTS.push(Object.assign({}, r, { id:r.id + 'b', status:'Pending', createdAt:new Date(APS.now() + 60000).toISOString(), decidedAt:null })); APS.fastForward(0.05); ok(APS.view('req:' + r.id).state === 'closed', 'resubmitting closes the return item');
      var r2 = freshSub(); decideApproval(r2.id, 'Approved'); APS.tick(); var v2 = APS.view('req:' + r2.id); ok(v2.phase === 'followThrough' && v2.phaseLabel === 'Send to client' && v2.tatHours === 2, 'follow-through: ' + JSON.stringify([v2.phase, v2.phaseLabel, v2.tatHours]));
      var sb = subById(r2.entityId); sb.stage = 'Submitted'; APS.tick(); ok(APS.view('req:' + r2.id).state === 'closed', 'sending to the client closes it'); reset();
    });

    await t('"Ask for more time" works once, needs a reason and moves the due time; a second try is refused', async function(){
      reset(); as('manager'); var r = freshSub(), due = APS.view('req:' + r.id).dueAt;
      ok(!APS.requestExtension('req:' + r.id, 2, 'busy').ok, 'a short reason is refused'); var e1 = APS.requestExtension('req:' + r.id, 2, 'Waiting for the client to confirm the budget band.'); ok(e1.ok && e1.dueAt > due, 'moved');
      ok(!APS.requestExtension('req:' + r.id, 2, 'Another reason that is long enough.').ok, 'only once'); ok(APS.view('req:' + r.id).extensionsLeft === 0, 'none left'); reset();
    });

    await t('a delegation routes new items to the cover with a grey note; an inactive approver goes to the owner', async function(){
      reset(); as('admin'); APS.config.delegations.push({ fromUserId:'RP-092', toUserId:'RP-088', from:new Date(APS.now() - 1000).toISOString(), to:new Date(APS.now() + 86400000).toISOString(), reason:'On leave' });
      var r = freshSub(), v = APS.view('req:' + r.id); ok(v.owner.userId === 'RP-088' && /away/.test(v.routingNote), 'routed: ' + JSON.stringify(v.owner)); APS.config.delegations.length = 0; reset();
    });

    await t('every kind of approval is tracked: jobs, access, clients and Kairo messages carry a chip too', async function(){
      reset(); as('admin'); var now = new Date(APS.now()).toISOString(), j = JOBS[0];
      var mk = function(type, id, extra){ var r = Object.assign({ id:id, chainId:null, entityType:type, entityId:j.id, organizationId:CURRENT_ORGANIZATION_ID, requestedByRole:'role_recruiter', requestedByUserId:'RP-081', requestedByName:'Divya Menon', approverRoleId:'role_recmgr', approverUserId:'RP-092', approverName:'Arjun Kapoor', status:'Pending', context:{ jobId:j.id }, createdAt:now, decidedAt:null, decidedByName:null, decisionReason:null }, extra || {}); APPROVAL_REQUESTS.push(r); return r; };
      var ja = mk('JobApproval', 'appr-ja1'), jm = mk('JobMappingRequest', 'appr-jm1'), cl = mk('ClientApproval', 'appr-cl1', { entityId:CLIENTS[0].id, context:{ clientId:CLIENTS[0].id } });
      CW_APPROVALS.push({ id:'ap-t1', runId:'run-x', pc:0, wfId:'x', personKey:'c1', name:'Rahul Shah', channel:'email', text:'Hi', createdAt:now, status:'pending', ownerId:'RP-088' }); APS.tick();
      ['req:appr-ja1', 'req:appr-jm1', 'req:appr-cl1', 'cw:ap-t1'].forEach(function(k){ var v = APS.view(k); ok(v && v.chip && v.state !== 'closed', k + ' has a chip: ' + JSON.stringify(v && v.chip)); });
      var types = {}; apNeedsRows().forEach(function(row){ types[row.type] = 1; }); ok(types.job && types.access && types.client && types.kairo && types.submission, 'the screen lists every type: ' + Object.keys(types));
      var tj = APS.config.policies.JobApproval.tatHours, ta = APS.config.policies.JobMappingRequest.tatHours; ok(tj === 9 && ta === 4 && APS.config.policies.ClientApproval.tatHours === 9 && APS.config.policies.AgentMessage.tatHours === 2 && APS.config.policies.Offer.tatHours === 4, 'the default policy table holds');
      cwApprove('ap-t1', true); ok(CW_APPROVALS.find(function(a){ return a.id === 'ap-t1'; }).decidedAt, 'Kairo decisions stamp decidedAt'); reset();
    });

    await t('reloading keeps every timer, reminder and justification', async function(){
      reset(); as('manager'); var r = freshSub(); APS.fastForward(2.1); APS.save(); var saved = JSON.stringify(APS.state); APS.state = { items:{}, breaches:[], extensions:[], outbox:[], fired:{}, digestDay:null }; APS.load();
      ok(JSON.stringify(APS.state) === saved, 'identical after load'); ok(APS.state.breaches.length >= 1 && Object.keys(APS.state.fired).length > 0, 'justifications and reminders kept'); var raw = localStorage.getItem('oontu.aps.v1'); ok(raw && raw.length > 100, 'stored'); reset();
    });

    await t('the Approvals screen: header numbers, three views, Kairo lanes, queue, panel, selection and undo', async function(){
      reset(); as('admin'); showView('approval-center'); await sleep(60);
      ok(/Approvals/.test(q('.ap-head__title').textContent) && q('.ap-nums') && q('.ap-nums').children.length === 5, 'five numbers'); ok(document.querySelectorAll('#ap-seg .seg__btn').length === 3, 'three views'); ok(document.querySelectorAll('.ap-lane').length === 3, 'three lanes');
      var rows = apNeedsRows(); ok(rows.length >= 8, 'queue ' + rows.length); ['ready', 'review', 'back'].forEach(function(l){ ok(rows.some(function(x){ return x.lane === l; }), 'lane ' + l + ' is used'); });
      ok(document.querySelectorAll('.ap-row[data-key]').length === Math.min(25, rows.length), 'rows drawn'); var sorted = apFiltered(rows).map(apDue); ok(sorted.slice(0, 3).every(function(d, i, a){ return i === 0 || a[i - 1] <= d || apLateState(rows[0]) }), 'most urgent first');
      var sub = rows.find(function(x){ return x.type === 'submission' && apSeed(x.c) }); apFocus(sub.key); await sleep(20);
      ['overview', 'experience', 'screening', 'checks'].forEach(function(tab){ AP.tab = tab; apDrawPanel(); var txt = q('#ap-panel').textContent; ok(txt.length > 300, tab + ' has content'); });
      AP.tab = 'overview'; apDrawPanel(); ok(/Kairo’s read/.test(q('#ap-panel').textContent) && /Against the brief, with evidence/.test(q('#ap-panel').textContent), 'read and evidence'); ok(q('#ap-tabs').children.length === 4, 'four tabs'); AP.expanded = true; apRefresh(); ok(q('.ap-page.is-expanded'), 'expanded'); AP.expanded = false; apRefresh();
      var subs = apNeedsRows().filter(function(x){ return x.type === 'submission'; }); AP.sel = {}; AP.sel[subs[0].key] = 1; AP.sel[subs[1].key] = 1; apDraw(); await sleep(20); ok(/2 submissions selected/.test(q('#ap-panel').textContent) && q('#ap-bar .ap-bar__btn--p'), 'bulk summary and bar');
      var notReady = subs.slice(0, 2).some(function(x){ return x.lane !== 'ready'; }); ok(!notReady || /Keep only the/.test(q('#ap-panel').textContent), '"Keep only the ready"');
      AP.sel = {}; var r = freshSub(); var row = apNeedsRows().find(function(x){ return x.id === r.id; }); apFocus(row.key); apDecide(row.key, 'back', 'Fit is too low'); await sleep(30); ok(AP.undo && /Sent back/.test(AP.undo.label), 'undo strip'); apUndo(AP.undo.snaps, AP.undo.label); ok(apReqById(r.id).status === 'Pending', 'undone'); reset();
    });

    await t('send back needs a reason: chips, an inline error, then the decision', async function(){
      reset(); as('admin'); showView('approval-center'); var r = freshSub(); var row = apNeedsRows().find(function(x){ return x.id === r.id; }); apFocus(row.key); apStartBack(row.key); await sleep(20); ok(q('.ap-back'), 'the flow opens'); apBackSubmit(); ok(/Pick at least one reason/.test(q('#ap-panel').textContent), 'inline error'); apBackToggle(0); apBackSubmit(); await sleep(20);
      ok(apReqById(r.id).status === 'Rejected' && /Fit is too low/.test(apReqById(r.id).decisionReason), 'sent back with the reason'); reset();
    });

    await t('approve by rule: only the Owner turns it on, only ready on-time items, shown as "Approved by rule", undo works', async function(){
      reset(); as('manager'); apRuleSwitch(); ok(!APS.config.approvalRule.readyAuto, 'a manager cannot turn it on'); as('admin');
      var ready = apNeedsRows().filter(function(x){ return x.type === 'submission' && x.lane === 'ready' && !apLateState(x); }); ok(ready.length, 'there are ready items'); var ids = ready.map(function(x){ return x.id; });
      APS.config.approvalRule.readyAuto = true; var n = apRunRule(); ok(n === ids.length, 'approved ' + n + ' of ' + ids.length); ok(ids.every(function(id){ var q2 = apReqById(id); return q2.status === 'Approved' && q2.decidedByName === 'Approved by rule'; }), 'attributed to the rule'); ok(AUDIT_LOG.some(function(a){ return a.action === 'Approved by rule'; }), 'audited');
      ok(apNeedsRows().filter(function(x){ return x.type === 'submission' && x.lane === 'review' || x.lane === 'back'; }).length >= 1, 'judgement and send-back items are left to people'); apUndo(AP_RULE_LAST.snaps, 'Approved by rule'); ok(ids.every(function(id){ return apReqById(id).status === 'Pending'; }), 'undone'); APS.config.approvalRule.readyAuto = false; reset();
    });

    await t('Settings › Approval rules: owner edits save and apply; sections exist; a Recruiter Manager does not see it', async function(){
      reset(); as('admin'); settingsSection = 'approvals'; settingsTabs.approvals = 'rules'; showView('settings'); await sleep(40); var txt = q('#settings-content').textContent;
      ['Working hours', 'Rules per approval type', 'Approve by rule', 'Out of office', 'Performance', 'Sent reminders'].forEach(function(s){ ok(txt.indexOf(s) > -1, 'has ' + s); });
      var before = APS.config.policies.SubmissionReview.tatHours; apPolicySet('SubmissionReview', 'tat', '6'); ok(APS.config.policies.SubmissionReview.tatHours === 6 && JSON.parse(localStorage.getItem('oontu.aps.config')).policies.SubmissionReview.tatHours === 6, 'saved to storage'); apPolicySet('SubmissionReview', 'tat', String(before));
      ok(APS.config.policies.SubmissionReview.autoDecide === false, 'autoDecide stays off'); apPolicySet('SubmissionReview', 'remind', '25, 75'); ok(APS.config.policies.SubmissionReview.remindAt.join() === '0.25,0.75', 'reminders'); apPolicySet('SubmissionReview', 'remind', '50, 80');
      as('manager'); settingsSection = 'approvals'; showView('settings'); ok(sTabsFor(SETTINGS_SECTIONS.find(function(s){ return s.id === 'approvals'; })).every(function(x){ return x.id !== 'rules'; }), 'hidden for a manager'); as('admin');
    });

    await t('the prototype clock, Home, the sidebar badge and notifications read the same queue', async function(){
      reset(); as('admin'); ok(document.querySelectorAll('#role-menu button[onclick^="apClock"]').length === 3, 'three clock buttons'); var n0 = AUDIT_LOG.length; apClock(1); ok(APS.clockOffsetMs > 0, 'moved'); apClock(0); ok(APS.clockOffsetMs === 0, 'reset');
      as('manager'); showView('manager-dashboard'); await sleep(60); ok(/approvals? need you/.test(q('#main-content').textContent), 'Home says how many need you'); ok(/overdue/.test(q('#main-content').textContent), 'and how many are overdue');
      var item = NAV.manager.reduce(function(a, g){ return a.concat(g.items || [g]); }, []).find(function(i){ return i.id === 'approval-center'; }); ok(item.count() === apNeedsRows().length && !item.urgent, 'sidebar badge counts the queue, amber not red'); ok(computeNotifications().some(function(x){ return x.category === 'Approvals'; }), 'notifications carry Approvals'); reset();
    });

    var pre = document.createElement('pre'); pre.id = 'auth-test-results'; pre.textContent = JSON.stringify(results); document.body.appendChild(pre);
  }, 900); });
})();
