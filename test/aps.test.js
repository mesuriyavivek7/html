/* Node test harness for the Oontu approval SLA engine. Run: node test/aps.test.js */
'use strict';
const assert = require('assert');
const path = require('path');

// ---- fake browser + app globals --------------------------------------------
const store = {};
global.localStorage = { getItem: (k) => store[k] || null, setItem: (k, v) => { store[k] = v; } };
const toasts = [], audits = [];
global.toast = (m) => toasts.push(m);
global.logAudit = (mod, action, detail) => audits.push(action + ' | ' + detail);
global.document = { getElementById: () => ({ classList: { contains: () => false } }) };
global.RECRUITER_ROSTER = [
  { id: 'RP-081', name: 'Divya Menon', assignedRoleId: 'role_recruiter' },
  { id: 'RP-092', name: 'Arjun Kapoor', assignedRoleId: 'role_recmgr' },
  { id: 'RP-001', name: 'Alex Morgan', assignedRoleId: 'role_founder' },
  { id: 'RP-050', name: 'Old Manager', assignedRoleId: 'role_recmgr', status: 'Inactive' }
];
let ME = global.RECRUITER_ROSTER[1];
global.currentActingUser = () => ME;
global.currentUserRoleId = () => ME.assignedRoleId;
global.hasOrgWideAuthority = () => ME.assignedRoleId === 'role_founder';
global.APPROVAL_REQUESTS = [];
global.SUBS = {};
global.subById = (id) => global.SUBS[id] || null;
global.byId = () => ({ name: 'Vikram Rao' });
global.jobById = () => ({ title: 'DevOps Lead', client: 'CloudNova' });

require(path.join(__dirname, '..', 'oontu-approval-sla-engine.js'));
const APS = global.APS;

// IST helper: build a UTC ms for an IST wall-clock time
const IST = (y, m, d, hh, mm) => Date.UTC(y, m - 1, d, hh, mm) - 330 * 60000;
const setNow = (ms) => { APS.clockOffsetMs = ms - Date.now(); };
let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log('  ✓ ' + name); };

console.log('Business hours');
t('4h from Tue 10:00 IST lands Tue 14:00', () => {
  assert.strictEqual(APS.addBusinessMinutes(IST(2026, 10, 27, 10, 0), 240), IST(2026, 10, 27, 14, 0));
});
t('4h from Tue 17:00 rolls to Wed 12:00', () => {
  assert.strictEqual(APS.addBusinessMinutes(IST(2026, 10, 27, 17, 0), 240), IST(2026, 10, 28, 12, 0));
});
t('Sat 18:00 + 2h skips Sunday to Mon 11:00', () => {
  assert.strictEqual(APS.addBusinessMinutes(IST(2026, 10, 31, 18, 0), 120), IST(2026, 11, 2, 11, 0));
});
t('Before opening starts at 09:30', () => {
  assert.strictEqual(APS.addBusinessMinutes(IST(2026, 10, 27, 7, 0), 60), IST(2026, 10, 27, 10, 30));
});
t('Holiday is skipped (25 Dec 2026, Friday)', () => {
  assert.strictEqual(APS.addBusinessMinutes(IST(2026, 12, 24, 18, 0), 60), IST(2026, 12, 26, 10, 0));
});
t('Business minutes across a weekend', () => {
  assert.strictEqual(APS.businessMinutesBetween(IST(2026, 10, 31, 17, 30), IST(2026, 11, 2, 10, 30)), 120);
});
t('Business minutes symmetric with addBusinessMinutes', () => {
  const a = IST(2026, 10, 29, 16, 15); const b = APS.addBusinessMinutes(a, 777);
  assert.strictEqual(Math.round(APS.businessMinutesBetween(a, b)), 777);
});

console.log('Lifecycle: submission review');
const T0 = IST(2026, 10, 27, 10, 0);
setNow(T0);
global.SUBS['S1'] = { id: 'S1', candidateId: 'C1', jobId: 'J1', stage: 'Pending Review' };
global.APPROVAL_REQUESTS.push({ id: 'appr-1', entityType: 'SubmissionReview', entityId: 'S1', status: 'Pending', createdAt: new Date(T0).toISOString(), approverRoleId: 'role_recmgr', approverUserId: 'RP-092', approverName: 'Arjun Kapoor', requestedByUserId: 'RP-081', requestedByName: 'Divya Menon', context: {} });
APS.tick();
let v = APS.view('req:appr-1');
t('starts in decision phase, owner Arjun, due 14:00', () => {
  assert.strictEqual(v.phase, 'decision'); assert.strictEqual(v.owner.name, 'Arjun Kapoor'); assert.strictEqual(v.dueAt, IST(2026, 10, 27, 14, 0)); assert.strictEqual(v.state, 'on_track');
});
setNow(IST(2026, 10, 27, 12, 1)); APS.tick();
t('50% reminder fires once and toasts the owner', () => {
  assert.ok(toasts.some((x) => /Due in/.test(x)), toasts.join('\n'));
  const n = toasts.length; APS.tick(); assert.strictEqual(toasts.length, n);
});
setNow(IST(2026, 10, 27, 13, 20)); APS.tick();
t('80% reminder → due soon state', () => { assert.strictEqual(APS.view('req:appr-1').state, 'due_soon'); });
setNow(IST(2026, 10, 27, 14, 5)); APS.tick();
v = APS.view('req:appr-1');
t('at TAT: breached, escalated to backup level 1, audit logged', () => {
  assert.strictEqual(v.state, 'escalated'); assert.strictEqual(v.level, 1);
  assert.ok(audits.some((a) => a.indexOf('TAT breached') === 0)); assert.ok(audits.some((a) => a.indexOf('Approval escalated') === 0));
});
setNow(IST(2026, 10, 28, 9, 45)); APS.tick();
v = APS.view('req:appr-1');
t('4 business hours past due (next morning) → owner level 2 co-owner', () => {
  assert.strictEqual(v.level, 2); assert.ok(v.coOwners.some((c) => c.name === 'Alex Morgan'));
});
t('Founder sees it in their queue and notifications', () => {
  ME = global.RECRUITER_ROSTER[2];
  assert.ok(APS.queueFor().some((q) => q.key === 'req:appr-1'));
  assert.ok(APS.notificationItems().some((n) => /Escalated to you/.test(n.text)));
  ME = global.RECRUITER_ROSTER[1];
});
t('needs justification before decision', () => { assert.strictEqual(APS.view('req:appr-1').needsJustification, true); });

let decided = 0;
global.decideApproval = function (id, decision) { const r = global.APPROVAL_REQUESTS.find((x) => x.id === id); r.status = decision; r.decidedAt = new Date(APS.now()).toISOString(); decided++; };
APS.openBreachModal = (key, done) => { APS.recordBreach(key, 'Queue too large today', 'Handled 40 reviews before this one'); done(); };
APS.wrapDecider('decideApproval', 'req', (args) => args[0]);
t('wrapped decider asks for justification then proceeds once', () => {
  global.decideApproval('appr-1', 'Approved');
  assert.strictEqual(decided, 1); assert.strictEqual(APS.state.breaches.length, 1);
  assert.strictEqual(APS.state.breaches[0].category, 'Queue too large today');
});
global.SUBS['S1'].stage = 'Ready to Send';
APS.tick();
v = APS.view('req:appr-1');
t('approval opens follow-through for requester: send to client in 2h', () => {
  assert.strictEqual(v.phase, 'followThrough'); assert.strictEqual(v.owner.name, 'Divya Menon'); assert.strictEqual(v.tatHours, 2);
});
global.SUBS['S1'].stage = 'Sent to Client';
setNow(IST(2026, 10, 28, 10, 30)); APS.tick();
t('sending to client closes follow-through', () => { assert.strictEqual(APS.view('req:appr-1').state, 'closed'); });
t('metrics count a late decision', () => { const m = APS.metrics(); assert.strictEqual(m.decided, 1); assert.strictEqual(m.onTimePct, 0); assert.strictEqual(m.breaches, 1); });

console.log('Send back → waiting on requester');
const T1 = IST(2026, 10, 28, 11, 0); setNow(T1);
global.SUBS['S2'] = { id: 'S2', stage: 'Pending Review' };
global.APPROVAL_REQUESTS.push({ id: 'appr-2', entityType: 'SubmissionReview', entityId: 'S2', status: 'Pending', createdAt: new Date(T1).toISOString(), approverRoleId: 'role_recmgr', approverUserId: 'RP-092', requestedByUserId: 'RP-081', requestedByName: 'Divya Menon', context: {} });
APS.tick();
global.decideApproval('appr-2', 'Rejected');
APS.tick();
t('on-time decision needs no justification', () => { assert.strictEqual(APS.state.breaches.length, 1); });
t('send-back starts a return phase owned by requester (1 working day)', () => { const x = APS.view('req:appr-2'); assert.strictEqual(x.phase, 'return'); assert.strictEqual(x.owner.name, 'Divya Menon'); });
setNow(IST(2026, 10, 28, 15, 0));
global.APPROVAL_REQUESTS.push({ id: 'appr-3', entityType: 'SubmissionReview', entityId: 'S2', status: 'Pending', createdAt: new Date(APS.now()).toISOString(), approverRoleId: 'role_recmgr', approverUserId: 'RP-092', requestedByUserId: 'RP-081', context: {} });
APS.tick();
t('resubmission closes the return phase and opens a new decision', () => { assert.strictEqual(APS.view('req:appr-2').state, 'closed'); assert.strictEqual(APS.view('req:appr-3').phase, 'decision'); });

console.log('Extensions, delegation, orphans');
t('extension before due moves the TAT once', () => {
  const r1 = APS.requestExtension('req:appr-3', 2, 'Waiting for client budget confirmation'); assert.ok(r1.ok);
  const r2 = APS.requestExtension('req:appr-3', 2, 'Another reason that is long enough'); assert.strictEqual(r2.ok, false);
});
t('short extension reason rejected', () => {
  global.APPROVAL_REQUESTS.push({ id: 'appr-4', entityType: 'Offer', entityId: 'O1', status: 'Pending', createdAt: new Date(APS.now()).toISOString(), approverRoleId: 'role_founder', context: {} });
  APS.tick(); assert.strictEqual(APS.requestExtension('req:appr-4', 2, 'busy').ok, false);
});
t('delegation routes to the delegate', () => {
  APS.config.delegations.push({ fromUserId: 'RP-092', toUserId: 'RP-001', from: new Date(APS.now() - 1000).toISOString(), to: new Date(APS.now() + 86400000).toISOString(), reason: 'On leave' });
  global.APPROVAL_REQUESTS.push({ id: 'appr-5', entityType: 'JobMappingRequest', entityId: 'J9', status: 'Pending', createdAt: new Date(APS.now()).toISOString(), approverUserId: 'RP-092', approverRoleId: 'role_recmgr', context: {} });
  APS.tick(); const x = APS.view('req:appr-5'); assert.strictEqual(x.owner.name, 'Alex Morgan'); assert.ok(/away/.test(x.routingNote));
});
t('inactive approver is routed to the owner', () => {
  global.APPROVAL_REQUESTS.push({ id: 'appr-6', entityType: 'JobApproval', entityId: 'J8', status: 'Pending', createdAt: new Date(APS.now()).toISOString(), approverUserId: 'RP-050', approverRoleId: 'role_recmgr', context: {} });
  APS.tick(); const x = APS.view('req:appr-6'); assert.strictEqual(x.owner.name, 'Alex Morgan'); assert.ok(/inactive/.test(x.routingNote));
});
t('no approver at all is routed to the owner role', () => {
  global.APPROVAL_REQUESTS.push({ id: 'appr-7', entityType: 'ClientApproval', entityId: 'CL1', status: 'Pending', createdAt: new Date(APS.now()).toISOString(), context: {} });
  APS.tick(); const x = APS.view('req:appr-7'); assert.strictEqual(x.owner.roleId, 'role_founder'); assert.ok(/No approver/.test(x.routingNote));
});
t('withdrawn request closes without breach', () => {
  global.APPROVAL_REQUESTS.find((r) => r.id === 'appr-5').status = 'Withdrawn'; APS.tick(); assert.strictEqual(APS.view('req:appr-5').state, 'closed');
});
t('legacy approved-but-not-sent item is picked up as follow-through', () => {
  global.SUBS['S9'] = { id: 'S9', stage: 'Ready to Send' };
  global.APPROVAL_REQUESTS.push({ id: 'appr-9', entityType: 'SubmissionReview', entityId: 'S9', status: 'Approved', createdAt: new Date(APS.now() - 86400000).toISOString(), decidedAt: new Date(APS.now() - 80000000).toISOString(), requestedByUserId: 'RP-081', requestedByName: 'Divya Menon', context: {} });
  APS.tick(); assert.strictEqual(APS.view('req:appr-9').phase, 'followThrough');
});
t('state persists to localStorage and reloads', () => {
  APS.save(); const before = Object.keys(APS.state.items).length; APS.state = { items: {}, breaches: [], extensions: [], outbox: [], fired: {} }; APS.load();
  assert.strictEqual(Object.keys(APS.state.items).length, before);
});
t('outbox holds email/WhatsApp messages for escalations', () => { assert.ok(APS.state.outbox.some((o) => o.channel === 'whatsapp' && o.kind === 'escalation')); });

console.log('Bulk decisions');
t('bulk: one justification covers every overdue item, on-time items untouched', () => {
  const start = APS.now();
  ['b1', 'b2', 'b3'].forEach((id) => global.APPROVAL_REQUESTS.push({ id: id, entityType: 'SubmissionReview', entityId: 'S-' + id, status: 'Pending', createdAt: new Date(start).toISOString(), approverUserId: 'RP-092', approverRoleId: 'role_recmgr', requestedByUserId: 'RP-081', context: {} }));
  APS.tick();
  APS.fastForward(10);
  global.APPROVAL_REQUESTS.push({ id: 'b4', entityType: 'SubmissionReview', entityId: 'S-b4', status: 'Pending', createdAt: new Date(APS.now()).toISOString(), approverUserId: 'RP-092', approverRoleId: 'role_recmgr', context: {} });
  APS.tick();
  const before = APS.state.breaches.length; let ran = 0;
  APS.guardBulk('req', ['b1', 'b2', 'b3', 'b4'], () => { ['b1', 'b2', 'b3', 'b4'].forEach((id) => global.decideApproval(id, 'Approved')); ran++; });
  assert.strictEqual(ran, 1);
  assert.strictEqual(APS.state.breaches.length - before, 3);
  assert.deepStrictEqual(Object.keys(APS._bypass), []);
});
t('cancelled bulk modal leaves no bypass behind', () => {
  global.APPROVAL_REQUESTS.push({ id: 'b5', entityType: 'SubmissionReview', entityId: 'S-b5', status: 'Pending', createdAt: new Date(APS.now()).toISOString(), approverUserId: 'RP-092', approverRoleId: 'role_recmgr', context: {} });
  APS.tick(); APS.fastForward(10);
  const real = APS.openBreachModal; APS.openBreachModal = () => {}; // user cancels
  const ok = APS.guardBulk('req', ['b5'], () => { throw new Error('must not run'); });
  APS.openBreachModal = real;
  assert.strictEqual(ok, false); assert.ok(!APS._bypass['req:b5']);
});

console.log('\n' + passed + ' checks passed');
