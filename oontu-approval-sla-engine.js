/* =============================================================================
   Oontu · Approval SLA engine  (APS)                                   v1.0
   -----------------------------------------------------------------------------
   One process layer over EVERY approval in Oontu, so nothing is ever missed.

   What it guarantees
   1. Every approval has an owner ("ball in court") and a due time in business
      hours (TAT). Nothing sits without someone accountable.
   2. Owners get reminded before the TAT runs out, at the TAT, and after it.
   3. Overdue items escalate up a ladder (backup approver, then the owner/founder)
      as co-approvers. The original approver keeps the item; nobody loses it.
   4. Deciding after the TAT requires a written justification (category + note),
      stored against the approver for reporting.
   5. Approvers can ask for ONE extension before the TAT, with a reason.
   6. "Waiting on others" is tracked too: after a send-back the requester owns a
      resubmission TAT; after an approval the requester owns a follow-through TAT
      (for example "send the approved profile to the client").
   7. Orphans (no resolvable approver, approver inactive or on leave) are routed
      to a delegate or the workspace owner instead of silently stalling.
   8. A morning digest, in-app notifications, toasts and an outbox for
      email / WhatsApp / push (delivery is a stub in the prototype).
   9. Metrics per approver and per approval type: on-time %, median TAT,
      breaches, justified breaches.

   How it plugs in (details in the Claude Code prompt that ships with this file)
   - Load after the app's main script. It reads the app's own data through the
     ADAPTER section below and never rewrites approval records it doesn't own;
     its SLA state lives in APS.state (persisted to localStorage).
   - Call APS.start() once the app has booted (it starts the ticker).
   - Guard every decide function with APS.guardDecision(...) or wrap it with
     APS.wrapDecider(...) so overdue decisions ask for a justification first.
   - Merge APS.notificationItems() into computeNotifications().
   - Read APS.view(item) / APS.queueFor(user) to show SLA chips in the UI.

   Time: all TAT maths uses Indian business hours (IST, UTC+05:30),
   Mon–Sat 09:30–18:30 by default, skipping configured holidays.
   ========================================================================== */
(function (global) {
  'use strict';

  var APS = global.APS || {};
  global.APS = APS;
  APS.version = '1.0.0';

  /* --------------------------------------------------------------------------
     1. CONFIGURATION  (edited from Settings › Approval rules)
     ------------------------------------------------------------------------ */
  APS.config = APS.config || {
    utcOffsetMinutes: 330,               // IST
    workweek: [1, 2, 3, 4, 5, 6],        // 0 = Sunday … 6 = Saturday
    dayStart: '09:30',
    dayEnd: '18:30',
    holidays: ['2026-01-26', '2026-08-15', '2026-10-02', '2026-12-25'], // YYYY-MM-DD, IST
    tickMs: 60 * 1000,
    digestAt: '09:30',                   // morning summary, business days only
    storageKey: 'oontu.aps.v1',

    /* Who an escalation goes to. Map to the app's real role ids. */
    ladder: {
      backup: { roleId: 'role_recmgr', label: 'Backup approver' },
      owner:  { roleId: 'role_founder', label: 'Workspace owner' }
    },

    /* Out of office / delegation. Engine routes the owner's items to the delegate
       while the window is active. Dates are ISO strings. */
    delegations: [
      // { fromUserId: 'RP-092', toUserId: 'RP-001', from: '2026-10-27T00:00:00Z', to: '2026-10-30T00:00:00Z', reason: 'On leave' }
    ],

    /* Breach justification categories shown in the modal. */
    breachReasons: [
      'Needed more information',
      'Waiting on client or candidate',
      'On leave or out of office',
      'Queue too large today',
      'Unclear policy or ownership',
      'System or access issue',
      'Other'
    ],
    breachNoteMinChars: 15,

    /* Channel ladder: which channels fire at each moment. */
    channels: {
      reminder:   ['inapp', 'push'],
      due:        ['inapp', 'push', 'email'],
      escalation: ['inapp', 'push', 'email', 'whatsapp'],
      digest:     ['inapp', 'email']
    },

    /* ---- Policy per approval type ------------------------------------------
       tatHours        business hours to decide
       remindAt        fractions of TAT where the owner is nudged
       escalate        steps after the due time (business hours after due) → ladder key
       justifyBreach   approver must justify a decision made after the due time
       extension       { maxHours, times } one-off extension before due, with reason
       onReturn        what the requester owes after a send-back / decline
       afterApprove    follow-through the requester owes after approval
       autoDecide      ALWAYS false. The engine never approves or rejects for anyone.
       -------------------------------------------------------------------- */
    policies: {
      SubmissionReview: {
        label: 'Submission review', tatHours: 4, remindAt: [0.5, 0.8],
        escalate: [{ afterDueHours: 0, to: 'backup' }, { afterDueHours: 4, to: 'owner' }],
        justifyBreach: true, extension: { maxHours: 4, times: 1 },
        onReturn: { label: 'Resubmit or withdraw', tatHours: 9, remindAt: [0.5], escalate: [{ afterDueHours: 9, to: 'backup' }] },
        afterApprove: { label: 'Send to client', tatHours: 2, remindAt: [0.5], escalate: [{ afterDueHours: 2, to: 'backup' }] },
        autoDecide: false
      },
      Offer: {
        label: 'Offer approval', tatHours: 4, remindAt: [0.25, 0.5, 0.8],
        escalate: [{ afterDueHours: 0, to: 'owner' }],
        justifyBreach: true, extension: { maxHours: 2, times: 1 },
        onReturn: { label: 'Revise the offer', tatHours: 9, remindAt: [0.5], escalate: [{ afterDueHours: 9, to: 'backup' }] },
        afterApprove: { label: 'Release the offer', tatHours: 2, remindAt: [0.5], escalate: [{ afterDueHours: 2, to: 'owner' }] },
        autoDecide: false
      },
      JobApproval: {
        label: 'New job approval', tatHours: 9, remindAt: [0.5, 0.8],
        escalate: [{ afterDueHours: 0, to: 'owner' }],
        justifyBreach: true, extension: { maxHours: 9, times: 1 },
        onReturn: { label: 'Fix and resubmit the job', tatHours: 18, remindAt: [0.5], escalate: [] },
        autoDecide: false
      },
      Job: {                                   // chain: publish job above a salary threshold
        label: 'Job above salary threshold', tatHours: 9, remindAt: [0.5, 0.8],
        escalate: [{ afterDueHours: 0, to: 'owner' }],
        justifyBreach: true, extension: { maxHours: 9, times: 1 },
        onReturn: { label: 'Fix and resubmit the job', tatHours: 18, remindAt: [0.5], escalate: [] },
        autoDecide: false
      },
      JobMappingRequest: {
        label: 'Recruiter access request', tatHours: 4, remindAt: [0.5],
        escalate: [{ afterDueHours: 0, to: 'backup' }, { afterDueHours: 9, to: 'owner' }],
        justifyBreach: true, extension: { maxHours: 4, times: 1 },
        autoDecide: false
      },
      ClientApproval: {
        label: 'Client approval', tatHours: 9, remindAt: [0.5, 0.8],
        escalate: [{ afterDueHours: 0, to: 'owner' }],
        justifyBreach: true, extension: { maxHours: 9, times: 1 },
        autoDecide: false
      },
      AgentMessage: {                          // Kairo agent message waiting for a human
        label: 'Kairo message approval', tatHours: 2, remindAt: [0.5],
        escalate: [{ afterDueHours: 0, to: 'backup' }, { afterDueHours: 2, to: 'owner' }],
        justifyBreach: true, extension: { maxHours: 2, times: 1 },
        autoDecide: false
      },
      TeamJoin: {
        label: 'Team join request', tatHours: 9, remindAt: [0.5],
        escalate: [{ afterDueHours: 0, to: 'owner' }],
        justifyBreach: false, extension: { maxHours: 9, times: 1 },
        autoDecide: false
      },
      _default: {
        label: 'Approval', tatHours: 9, remindAt: [0.5, 0.8],
        escalate: [{ afterDueHours: 0, to: 'backup' }, { afterDueHours: 9, to: 'owner' }],
        justifyBreach: true, extension: { maxHours: 4, times: 1 },
        autoDecide: false
      }
    }
  };

  /* --------------------------------------------------------------------------
     2. ADAPTER  — the only place that touches the app's own globals.
        Each read is guarded so the engine never crashes the app.
     ------------------------------------------------------------------------ */
  function safe(fn, fallback) { try { var v = fn(); return v === undefined ? fallback : v; } catch (e) { return fallback; } }
  /* App data lives in top-level let/const bindings, which are NOT window properties.
     A separate classic script can still read them by bare name, so each one is read
     through an explicit typeof-guarded getter. Add new stores here. */
  var LEX = {
    APPROVAL_REQUESTS: function () { return typeof APPROVAL_REQUESTS !== 'undefined' ? APPROVAL_REQUESTS : undefined; },
    CW_APPROVALS: function () { return typeof CW_APPROVALS !== 'undefined' ? CW_APPROVALS : undefined; },
    RECRUITER_ROSTER: function () { return typeof RECRUITER_ROSTER !== 'undefined' ? RECRUITER_ROSTER : undefined; },
    SUBMISSIONS: function () { return typeof SUBMISSIONS !== 'undefined' ? SUBMISSIONS : undefined; },
    OFFERED_CANDIDATES: function () { return typeof OFFERED_CANDIDATES !== 'undefined' ? OFFERED_CANDIDATES : undefined; },
    db: function () { return typeof db !== 'undefined' ? db : undefined; }
  };
  function g(name) {
    return safe(function () { var v = LEX[name] ? LEX[name]() : undefined; return v !== undefined ? v : global[name]; }, undefined);
  }
  function call(name) { var f = g(name); if (typeof f !== 'function') return undefined; var args = Array.prototype.slice.call(arguments, 1); return safe(function () { return f.apply(global, args); }, undefined); }

  function findSubmission(id) {
    var s = call('subById', id) || call('submissionById', id);
    if (s) return s;
    var list = g('SUBMISSIONS') || [];
    return list.find ? (list.find(function (x) { return x.id === id; }) || null) : null;
  }

  APS.adapter = APS.adapter || {
    me: function () { return call('currentActingUser') || null; },
    myRoleId: function () { return call('currentUserRoleId') || null; },
    hasOrgWide: function () { return !!call('hasOrgWideAuthority'); },
    roleCan: function (roleId, area, action) { return !!call('roleHasPermission', roleId, area, action); },
    /* Return the team as [{ id, name, roleId, active }]. Map to the app's team store. */
    team: function () {
      var t = g('RECRUITER_ROSTER') || [];
      return Array.isArray(t) ? t.filter(function (u) { return u && u.id; }).map(function (u) { return { id: u.id, name: u.name, roleId: u.assignedRoleId || u.roleId || u.role, active: u.active !== false && u.status !== 'Inactive' && u.status !== 'Deactivated' }; }) : [];
    },
    roleName: function (roleId) { return ({ role_recruiter: 'Recruiter', role_recmgr: 'Recruiter manager', role_founder: 'Owner', role_hm: 'Hiring manager' })[roleId] || roleId || 'Approver'; },
    toast: function (msg) { call('toast', msg); },
    audit: function (action, detail, meta) { call('logAudit', 'Approvals', action, detail, meta || {}); },
    refresh: function () { call('refreshNotifications'); if (call('isViewActive', 'approval-center')) call('renderApprovalCenter'); call('refreshApprovalSurfaces'); },
    appVisible: function () { var el = safe(function () { return global.document.getElementById('app'); }, null); return !!el && !el.classList.contains('hidden'); },
    openItem: function (item) { return "showView('approval-center')"; },

    /* Human description of an item: who / what / for whom. */
    describe: function (src, r) {
      var c = (r && r.context) || {};
      var cand = c.candidateId ? safe(function () { return (call('byId', c.candidateId) || {}).name; }, '') : '';
      var job = c.jobId ? safe(function () { return call('jobById', c.jobId) || null; }, null) : null;
      if (!cand && r && r.entityType === 'SubmissionReview') {
        var sub = findSubmission(r.entityId);
        if (sub) { cand = safe(function () { return (call('byId', sub.candidateId) || {}).name; }, '') || sub.candidateName || ''; job = job || safe(function () { return call('jobById', sub.jobId); }, null); }
      }
      if (!job && r && (r.entityType === 'JobApproval' || r.entityType === 'Job' || r.entityType === 'JobMappingRequest')) job = safe(function () { return call('jobById', r.entityId) || call('jobById', c.jobId); }, null);
      var parts = [];
      if (cand) parts.push(cand);
      if (job) parts.push(job.title + (job.client ? ' · ' + job.client : ''));
      if (!parts.length && r && r.entityType === 'ClientApproval') { var cl = safe(function () { return call('clientById', r.entityId); }, null); if (cl) parts.push(cl.name); }
      return parts.join(' → ') || (r && (r.entityType + ' ' + r.entityId)) || 'Request';
    },

    /* Is the follow-through after approval done? Return true when nothing is owed. */
    followThroughDone: function (src, r) {
      if (src !== 'req') return true;
      if (r.entityType === 'SubmissionReview') {
        var s = findSubmission(r.entityId);
        return !s || (s.stage !== 'Ready to Send' && s.status !== 'ready_to_send');
      }
      if (r.entityType === 'Offer') {
        var list = g('OFFERED_CANDIDATES') || [];
        var o = list.find ? list.find(function (x) { return x.id === r.entityId; }) : null;
        return !o || o.status === 'Offer Extended' || o.status === 'Accepted' || o.status === 'Declined' || o.status === 'Withdrawn';
      }
      return true;
    },

    /* Sources: every place in the app where something waits for a decision. */
    sources: [
      {
        key: 'req',
        list: function () { return g('APPROVAL_REQUESTS') || []; },
        id: function (r) { return r.id; },
        type: function (r) { return r.entityType; },
        entityId: function (r) { return r.entityId; },
        status: function (r) { return r.status; },
        createdAt: function (r) { return r.createdAt; },
        decidedAt: function (r) { return r.decidedAt; },
        decidedBy: function (r) { return r.decidedByName; },
        approver: function (r) { return { userId: r.approverUserId || null, roleId: r.approverRoleId || null, name: r.approverName || null }; },
        requester: function (r) { return { userId: r.requestedByUserId || null, roleId: r.requestedByRole || null, name: r.requestedByName || null }; }
      },
      {
        key: 'cw',
        list: function () { return g('CW_APPROVALS') || []; },
        id: function (a) { return a.id; },
        type: function () { return 'AgentMessage'; },
        entityId: function (a) { return a.runId || a.id; },
        status: function (a) { return a.status; },
        createdAt: function (a) { return a.createdAt || a.at || null; },
        decidedAt: function (a) { return a.decidedAt; },
        decidedBy: function (a) { return a.decidedByName; },
        approver: function (a) { return { userId: a.approverUserId || null, roleId: a.approverRoleId || 'role_recmgr', name: a.approverName || null }; },
        requester: function (a) { return { userId: null, roleId: null, name: 'Kairo' }; }
      },
      {
        key: 'join',
        list: function () { var db = g('db'); var jr = db && db.joinRequests; return jr ? Object.keys(jr).map(function (k) { var r = jr[k]; if (!r.id) r.id = k; return r; }) : []; },
        id: function (r) { return r.id; },
        type: function () { return 'TeamJoin'; },
        entityId: function (r) { return r.email || r.id; },
        status: function (r) { return r.status; },
        createdAt: function (r) { return r.createdAt || r.at; },
        decidedAt: function (r) { return r.decidedAt; },
        decidedBy: function (r) { return r.decidedByName; },
        approver: function () { return { userId: null, roleId: 'role_founder', name: null }; },
        requester: function (r) { return { userId: null, roleId: null, name: r.name || r.email || 'Applicant' }; }
      }
    ]
  };

  /* --------------------------------------------------------------------------
     3. CLOCK + BUSINESS HOURS
     ------------------------------------------------------------------------ */
  APS.clockOffsetMs = APS.clockOffsetMs || 0;
  APS.now = function () { return Date.now() + APS.clockOffsetMs; };
  /** Prototype/demo helper: move the engine clock forward by BUSINESS hours and run a tick. */
  APS.fastForward = function (businessHours) {
    var now = APS.now();
    var target = APS.addBusinessMinutes(now, Math.round(businessHours * 60));
    APS.clockOffsetMs += Math.max(0, target - now);
    APS.tick();
  };

  function hm(s) { var p = String(s).split(':'); return (+p[0]) * 60 + (+p[1] || 0); }
  function ist(ms) { var d = new Date(ms + APS.config.utcOffsetMinutes * 60000); return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(), dow: d.getUTCDay(), min: d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60 }; }
  function fromIst(y, m, d, minOfDay) { return Date.UTC(y, m, d) + minOfDay * 60000 - APS.config.utcOffsetMinutes * 60000; }
  function ymd(y, m, d) { return y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0'); }
  function isWorkday(y, m, d) {
    var dow = new Date(Date.UTC(y, m, d)).getUTCDay();
    return APS.config.workweek.indexOf(dow) >= 0 && APS.config.holidays.indexOf(ymd(y, m, d)) < 0;
  }
  function nextWorkdayStart(y, m, d) {
    var start = hm(APS.config.dayStart);
    for (var i = 1; i < 30; i++) {
      var dt = new Date(Date.UTC(y, m, d + i));
      if (isWorkday(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate())) return fromIst(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate(), start);
    }
    return fromIst(y, m, d + 1, start);
  }
  /** Add business minutes to a timestamp (ms). */
  APS.addBusinessMinutes = function (ms, minutes) {
    var start = hm(APS.config.dayStart), end = hm(APS.config.dayEnd), t = ms, left = minutes;
    for (var guard = 0; guard < 2000; guard++) {
      var p = ist(t);
      if (!isWorkday(p.y, p.m, p.d) || p.min >= end) { t = nextWorkdayStart(p.y, p.m, p.d); continue; }
      if (p.min < start) { t = fromIst(p.y, p.m, p.d, start); continue; }
      var avail = end - p.min;
      if (left <= avail) return t + left * 60000;
      left -= avail;
      t = nextWorkdayStart(p.y, p.m, p.d);
    }
    return t;
  };
  /** Business minutes between two timestamps (0 if b <= a). */
  APS.businessMinutesBetween = function (a, b) {
    if (b <= a) return 0;
    var start = hm(APS.config.dayStart), end = hm(APS.config.dayEnd), total = 0, t = a;
    for (var guard = 0; guard < 2000 && t < b; guard++) {
      var p = ist(t);
      var dayEndMs = fromIst(p.y, p.m, p.d, end);
      if (isWorkday(p.y, p.m, p.d)) {
        var from = Math.max(t, fromIst(p.y, p.m, p.d, start));
        var to = Math.min(b, dayEndMs);
        if (to > from) total += (to - from) / 60000;
      }
      t = fromIst(p.y, p.m, p.d, 24 * 60);   // next IST midnight
    }
    return total;
  };
  APS.formatDuration = function (minutes) {
    var m = Math.max(0, Math.round(minutes));
    if (m < 60) return m + 'm';
    var dayLen = hm(APS.config.dayEnd) - hm(APS.config.dayStart);
    if (m < dayLen) { var h = Math.floor(m / 60), r = m % 60; return h + 'h' + (r ? ' ' + r + 'm' : ''); }
    var d = Math.floor(m / dayLen), hh = Math.round((m % dayLen) / 60);
    return d + (d === 1 ? ' working day' : ' working days') + (hh ? ' ' + hh + 'h' : '');
  };
  APS.formatClock = function (ms) {
    var p = ist(ms), h = Math.floor(p.min / 60), mi = Math.floor(p.min % 60);
    var today = ist(APS.now());
    var day = (p.y === today.y && p.m === today.m && p.d === today.d) ? 'today' : new Date(Date.UTC(p.y, p.m, p.d)).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
    return day + ', ' + ((h % 12) || 12) + ':' + String(mi).padStart(2, '0') + (h < 12 ? ' AM' : ' PM');
  };

  /* --------------------------------------------------------------------------
     4. STATE  (persisted; keyed by "<source>:<id>")
     ------------------------------------------------------------------------ */
  APS.state = APS.state || { items: {}, breaches: [], extensions: [], outbox: [], fired: {}, digestDay: null };
  APS.load = function () {
    var raw = safe(function () { return global.localStorage.getItem(APS.config.storageKey); }, null);
    if (!raw) return;
    var s = safe(function () { return JSON.parse(raw); }, null);
    if (s && s.items) APS.state = Object.assign({ items: {}, breaches: [], extensions: [], outbox: [], fired: {}, digestDay: null }, s);
  };
  APS.save = function () {
    if (APS.state.outbox.length > 500) APS.state.outbox = APS.state.outbox.slice(-500);
    safe(function () { global.localStorage.setItem(APS.config.storageKey, JSON.stringify(APS.state)); }, null);
  };

  function policyFor(type) { var p = APS.config.policies; return p[type] || p._default; }
  function phasePolicy(st) {
    var p = policyFor(st.type);
    if (st.phase === 'return') return p.onReturn || null;
    if (st.phase === 'followThrough') return p.afterApprove || null;
    return p;
  }
  function normStatus(s) {
    s = String(s || '').toLowerCase();
    if (s === 'pending' || s === 'pending approval' || s === 'open' || s === 'waiting') return 'pending';
    if (s === 'approved' || s === 'granted' || s === 'accepted') return 'approved';
    if (s === 'rejected' || s === 'declined' || s === 'sent back' || s === 'returned' || s === 'denied') return 'returned';
    if (s === 'withdrawn' || s === 'cancelled' || s === 'canceled' || s === 'expired' || s === 'superseded') return 'withdrawn';
    return s || 'pending';
  }
  function toMs(v) { if (!v) return null; var t = typeof v === 'number' ? v : Date.parse(v); return isNaN(t) ? null : t; }

  /* --------------------------------------------------------------------------
     5. COLLECT — one normalised list across every source
     ------------------------------------------------------------------------ */
  APS.collect = function () {
    var out = [];
    APS.adapter.sources.forEach(function (s) {
      var list = safe(s.list, []) || [];
      for (var i = 0; i < list.length; i++) {
        var r = list[i]; if (!r) continue;
        var id = safe(function () { return s.id(r); }, null); if (!id) continue;
        out.push({
          key: s.key + ':' + id, source: s.key, raw: r, id: id,
          type: safe(function () { return s.type(r); }, '_default') || '_default',
          entityId: safe(function () { return s.entityId(r); }, null),
          status: normStatus(safe(function () { return s.status(r); }, 'pending')),
          createdAt: toMs(safe(function () { return s.createdAt(r); }, null)),
          decidedAt: toMs(safe(function () { return s.decidedAt(r); }, null)),
          decidedBy: safe(function () { return s.decidedBy(r); }, null),
          approver: safe(function () { return s.approver(r); }, {}) || {},
          requester: safe(function () { return s.requester(r); }, {}) || {}
        });
      }
    });
    return out;
  };

  /* --------------------------------------------------------------------------
     6. OWNERSHIP — who must act now, with delegation and orphan routing
     ------------------------------------------------------------------------ */
  function teamById(id) { var t = APS.adapter.team(); for (var i = 0; i < t.length; i++) if (t[i].id === id) return t[i]; return null; }
  function firstActiveInRole(roleId) { var t = APS.adapter.team(); for (var i = 0; i < t.length; i++) if (t[i].roleId === roleId && t[i].active) return t[i]; return null; }
  function activeDelegation(userId, now) {
    var ds = APS.config.delegations || [];
    for (var i = 0; i < ds.length; i++) { var d = ds[i]; if (d.fromUserId === userId && toMs(d.from) <= now && now < toMs(d.to)) return d; }
    return null;
  }
  /** Resolve a party ({userId, roleId, name}) to an accountable owner, applying delegation and orphan rules. */
  APS.resolveOwner = function (party, now) {
    party = party || {};
    var note = null, userId = party.userId || null, roleId = party.roleId || null, name = party.name || null;
    if (userId) {
      var del = activeDelegation(userId, now);
      if (del) { var to = teamById(del.toUserId); note = (name || 'Approver') + ' is away' + (del.reason ? ' (' + del.reason + ')' : '') + '. Routed to ' + (to ? to.name : 'delegate') + '.'; userId = del.toUserId; name = to ? to.name : name; }
      var u = teamById(userId);
      if (u && !u.active) { var fb = firstActiveInRole(APS.config.ladder.owner.roleId); note = (u.name || 'Approver') + ' is inactive. Routed to ' + (fb ? fb.name : 'the workspace owner') + '.'; userId = fb ? fb.id : null; roleId = APS.config.ladder.owner.roleId; name = fb ? fb.name : null; }
      if (u && !name) name = u.name;
    }
    if (!userId && !roleId) { roleId = APS.config.ladder.owner.roleId; note = 'No approver was assigned. Routed to the workspace owner.'; }
    if (!name) name = roleId ? APS.adapter.roleName(roleId) : 'Approver';
    return { userId: userId, roleId: roleId, name: name, routingNote: note };
  };
  function ladderParty(key) { var L = APS.config.ladder[key]; if (!L) return null; var u = firstActiveInRole(L.roleId); return { userId: u ? u.id : null, roleId: L.roleId, name: u ? u.name : L.label }; }

  /** Is this owner (or co-owner list) the current user? */
  APS.isMine = function (owners) {
    var me = APS.adapter.me(), myRole = APS.adapter.myRoleId();
    owners = Array.isArray(owners) ? owners : [owners];
    for (var i = 0; i < owners.length; i++) {
      var o = owners[i]; if (!o) continue;
      if (o.userId && me && o.userId === me.id) return true;
      if (!o.userId && o.roleId && o.roleId === myRole) return true;
    }
    return false;
  };

  /* --------------------------------------------------------------------------
     7. RECONCILE — the state machine, run for every item on every tick
        phases: decision → (approved) followThrough → closed
                         → (returned) return → closed (on resubmission / withdraw)
                         → (withdrawn) closed
     ------------------------------------------------------------------------ */
  function startPhase(st, phase, owner, startMs) {
    var pp = phase === 'decision' ? policyFor(st.type) : phase === 'return' ? (policyFor(st.type).onReturn) : (policyFor(st.type).afterApprove);
    st.phase = phase;
    st.owner = owner;
    st.coOwners = [];
    st.level = 0;
    st.startedAt = startMs;
    st.dueAt = APS.addBusinessMinutes(startMs, Math.round(pp.tatHours * 60));
    st.originalDueAt = st.dueAt;
    st.reminded = {};
    st.breached = false;
    st.extensionsUsed = 0;
    st.justified = false;
    st.history.push({ at: startMs, event: 'phase', phase: phase, owner: owner && owner.name, dueAt: st.dueAt });
  }
  function closePhase(st, now, outcome) {
    var onTime = now <= st.dueAt;
    st.history.push({ at: now, event: 'closed', phase: st.phase, outcome: outcome, onTime: onTime, businessMinutes: APS.businessMinutesBetween(st.startedAt, now) });
    st.lastClosed = { phase: st.phase, at: now, onTime: onTime, businessMinutes: APS.businessMinutesBetween(st.startedAt, now), owner: st.owner, outcome: outcome };
    st.phase = 'closed';
    st.closedAt = now;
  }
  function fireOnce(key) { if (APS.state.fired[key]) return false; APS.state.fired[key] = APS.now(); return true; }

  function notify(kind, st, item, recipients, text) {
    var chans = APS.config.channels[kind] || ['inapp'];
    var at = APS.now();
    recipients.forEach(function (r) {
      if (!r) return;
      chans.forEach(function (ch) {
        if (ch === 'inapp') return; // in-app comes from APS.notificationItems()
        APS.state.outbox.push({ at: at, channel: ch, kind: kind, to: { userId: r.userId, roleId: r.roleId, name: r.name }, itemKey: item.key, text: text, delivered: false });
      });
    });
    if (APS.isMine(recipients)) (APS._toasts = APS._toasts || []).push(text);
  }
  /* One tick never floods the screen: 1 toast as-is, 2+ become a single summary. */
  function flushToasts() {
    var q = APS._toasts || []; APS._toasts = [];
    if (!q.length || !APS.adapter.appVisible()) return;
    APS.adapter.toast(q.length === 1 ? q[0] : q.length + ' approvals need your attention. Open Approvals to see them.');
  }

  APS.reconcile = function (item, now, all) {
    var S = APS.state.items;
    var st = S[item.key];
    var P = policyFor(item.type);
    var created = item.createdAt || now;

    if (!st) {
      st = S[item.key] = { key: item.key, type: item.type, entityId: item.entityId, lastStatus: null, history: [], phase: null };
      if (item.status === 'pending') {
        startPhase(st, 'decision', APS.resolveOwner(item.approver, now), created);
      } else {
        // Decided before the engine first saw it. Close the decision quietly, but still
        // pick up anything owed afterwards so an approved-but-never-sent item is not lost.
        st.phase = 'closed'; st.closedAt = item.decidedAt || created; st.legacy = true;
        var since = item.decidedAt || created;
        if (item.status === 'approved' && P.afterApprove && !APS.adapter.followThroughDone(item.source, item.raw)) startPhase(st, 'followThrough', APS.resolveOwner(item.requester, now), since);
        else if (item.status === 'returned' && P.onReturn && !all.some(function (o) { return o.key !== item.key && o.type === item.type && o.entityId === item.entityId && (o.createdAt || 0) > since; })) startPhase(st, 'return', APS.resolveOwner(item.requester, now), since);
      }
      st.lastStatus = item.status;
    }

    var events = [];

    // ---- status transitions coming from the app's own decide functions
    if (item.status !== st.lastStatus) {
      var prev = st.lastStatus; st.lastStatus = item.status;
      if (st.phase === 'decision') {
        if (item.status === 'approved') {
          closePhase(st, item.decidedAt || now, 'approved');
          if (P.afterApprove && !APS.adapter.followThroughDone(item.source, item.raw)) {
            startPhase(st, 'followThrough', APS.resolveOwner(item.requester, now), item.decidedAt || now);
            events.push(['phase', 'followThrough']);
          }
        } else if (item.status === 'returned') {
          closePhase(st, item.decidedAt || now, 'returned');
          if (P.onReturn) { startPhase(st, 'return', APS.resolveOwner(item.requester, now), item.decidedAt || now); events.push(['phase', 'return']); }
        } else if (item.status === 'withdrawn') {
          closePhase(st, now, 'withdrawn');
        } else if (item.status === 'pending' && prev && prev !== 'pending') {
          startPhase(st, 'decision', APS.resolveOwner(item.approver, now), now);
        }
      } else if (item.status === 'pending' && st.phase === 'closed') {
        // reopened by the app
        startPhase(st, 'decision', APS.resolveOwner(item.approver, now), now);
      } else if (item.status === 'withdrawn' && st.phase !== 'closed') {
        closePhase(st, now, 'withdrawn');
      }
    }

    // ---- waiting-on-others phases close themselves when the owed work is done
    if (st.phase === 'followThrough' && APS.adapter.followThroughDone(item.source, item.raw)) closePhase(st, now, 'done');
    if (st.phase === 'return') {
      var resubmitted = all.some(function (o) { return o.key !== item.key && o.type === item.type && o.entityId === item.entityId && (o.createdAt || 0) > (st.startedAt || 0); });
      if (resubmitted) closePhase(st, now, 'resubmitted');
    }

    if (st.phase === 'closed' || !st.phase) return { st: st, events: events };

    // ---- the clock: reminders, due, escalations
    var pp = phasePolicy(st) || P;
    var total = Math.max(1, APS.businessMinutesBetween(st.startedAt, st.dueAt));
    var used = APS.businessMinutesBetween(st.startedAt, now);
    var frac = used / total;
    var label = APS.adapter.describe(item.source, item.raw);
    var what = (st.phase === 'decision' ? pp.label : pp.label) + ': ' + label;

    (pp.remindAt || []).forEach(function (r) {
      var k = item.key + '|' + st.phase + '|' + st.startedAt + '|r' + r;
      if (frac >= r && now < st.dueAt && fireOnce(k)) {
        st.reminded['r' + r] = now;
        var leftMin = APS.businessMinutesBetween(now, st.dueAt);
        notify('reminder', st, item, [st.owner].concat(st.coOwners), 'Due in ' + APS.formatDuration(leftMin) + ' · ' + what);
        events.push(['reminder', r]);
      }
    });

    if (now >= st.dueAt && !st.breached) {
      st.breached = true;
      if (fireOnce(item.key + '|' + st.phase + '|' + st.startedAt + '|due')) {
        notify('due', st, item, [st.owner].concat(st.coOwners), 'TAT reached · ' + what);
        APS.adapter.audit('TAT breached', what, { entityType: 'Approval', entityId: item.id, phase: st.phase, owner: st.owner && st.owner.name });
        st.history.push({ at: now, event: 'breached' });
        events.push(['due']);
      }
    }

    if (now >= st.dueAt) {
      var overMin = APS.businessMinutesBetween(st.dueAt, now);
      (pp.escalate || []).forEach(function (step, idx) {
        if (st.level >= idx + 1) return;
        if (overMin < step.afterDueHours * 60) return;
        var party = ladderParty(step.to);
        st.level = idx + 1;
        if (party && !st.coOwners.some(function (c) { return (c.userId && c.userId === party.userId) || (!c.userId && c.roleId === party.roleId); }) && !(st.owner && ((st.owner.userId && st.owner.userId === party.userId) || (!st.owner.userId && !party.userId && st.owner.roleId === party.roleId)))) {
          st.coOwners.push({ userId: party.userId, roleId: party.roleId, name: party.name, level: idx + 1, since: now });
        }
        var txt = 'Escalated to ' + (party ? party.name : 'owner') + ' · overdue ' + APS.formatDuration(overMin) + ' · ' + what;
        notify('escalation', st, item, [st.owner, party], txt);
        APS.adapter.audit('Approval escalated', txt, { entityType: 'Approval', entityId: item.id, level: idx + 1, to: party && party.name });
        st.history.push({ at: now, event: 'escalated', level: idx + 1, to: party && party.name });
        events.push(['escalated', idx + 1]);
      });
    }
    return { st: st, events: events };
  };

  /* --------------------------------------------------------------------------
     8. TICK + DIGEST
     ------------------------------------------------------------------------ */
  APS.tick = function () {
    var now = APS.now();
    var all = APS.collect();
    var any = false;
    all.forEach(function (it) { var r = APS.reconcile(it, now, all); if (r.events.length) any = true; });
    if (APS.runDigest(now, all)) any = true;
    flushToasts();
    APS.save();
    if (any) APS.adapter.refresh();
    return any;
  };

  APS.runDigest = function (now, all) {
    var p = ist(now);
    if (!isWorkday(p.y, p.m, p.d) || p.min < hm(APS.config.digestAt)) return false;
    var day = ymd(p.y, p.m, p.d);
    if (APS.state.digestDay === day) return false;
    APS.state.digestDay = day;
    var mine = APS.queueFor(null, all);
    if (!mine.length) return true;
    var overdue = mine.filter(function (v) { return v.state === 'overdue'; }).length;
    var today = mine.filter(function (v) { return v.state !== 'overdue' && ist(v.dueAt).d === p.d; }).length;
    var txt = 'Good morning. ' + mine.length + ' approvals need you' + (overdue ? ', ' + overdue + ' overdue' : '') + (today ? ', ' + today + ' due today' : '') + '.';
    APS.state.outbox.push({ at: now, channel: 'email', kind: 'digest', to: { self: true }, text: txt, delivered: false });
    if (APS.adapter.appVisible()) APS.adapter.toast(txt);
    return true;
  };

  APS.start = function () {
    if (APS._timer) return;
    APS.load();
    APS.tick();
    APS._timer = setInterval(APS.tick, APS.config.tickMs);
  };
  APS.stop = function () { if (APS._timer) clearInterval(APS._timer); APS._timer = null; };

  /* --------------------------------------------------------------------------
     9. VIEW — what the UI shows for an item (chips, queue, owner, due)
        state: on_track | due_soon | overdue | escalated | waiting_on_requester | closed
     ------------------------------------------------------------------------ */
  APS.view = function (key) {
    var st = APS.state.items[key];
    if (!st || st.phase === 'closed' || !st.phase) return st ? { key: key, state: 'closed', phase: 'closed', last: st.lastClosed || null } : null;
    var now = APS.now();
    var left = APS.businessMinutesBetween(now, st.dueAt);
    var over = APS.businessMinutesBetween(st.dueAt, now);
    var total = Math.max(1, APS.businessMinutesBetween(st.startedAt, st.dueAt));
    var state = now >= st.dueAt ? (st.level > 0 ? 'escalated' : 'overdue') : (left <= total * 0.2 ? 'due_soon' : 'on_track');
    if (st.phase !== 'decision' && state === 'on_track') state = 'waiting_on_requester';
    var pp = phasePolicy(st) || policyFor(st.type);
    var tone = state === 'overdue' || state === 'escalated' ? 'red' : state === 'due_soon' ? 'amber' : 'neutral';
    var chip = state === 'overdue' ? 'Overdue ' + APS.formatDuration(over)
      : state === 'escalated' ? 'Escalated · ' + APS.formatDuration(over) + ' over'
      : state === 'due_soon' ? 'Due in ' + APS.formatDuration(left)
      : 'Due ' + APS.formatClock(st.dueAt);
    return {
      key: key, type: st.type, phase: st.phase, phaseLabel: st.phase === 'decision' ? 'Decision' : pp.label,
      state: state, tone: tone, chip: chip,
      owner: st.owner, coOwners: st.coOwners.slice(), level: st.level,
      dueAt: st.dueAt, startedAt: st.startedAt, leftMinutes: left, overMinutes: over,
      tatHours: pp.tatHours, extensionsLeft: Math.max(0, ((pp.extension && pp.extension.times) || 0) - (st.extensionsUsed || 0)),
      needsJustification: st.phase === 'decision' && now >= st.dueAt && !!policyFor(st.type).justifyBreach && !st.justified,
      routingNote: st.owner && st.owner.routingNote, history: st.history.slice()
    };
  };
  APS.viewFor = function (source, id) { return APS.view(source + ':' + id); };

  /** Items the current user must act on (as owner or escalated co-owner), most urgent first. */
  APS.queueFor = function (_user, collected) {
    var out = [];
    Object.keys(APS.state.items).forEach(function (k) {
      var st = APS.state.items[k];
      if (!st.phase || st.phase === 'closed') return;
      if (!APS.isMine([st.owner].concat(st.coOwners)) && !(APS.adapter.hasOrgWide() && st.level > 0)) return;
      var v = APS.view(k); if (v) out.push(v);
    });
    return out.sort(function (a, b) { return a.dueAt - b.dueAt; });
  };
  /** Items the current user raised and is waiting on someone else for. */
  APS.waitingOnOthers = function () {
    var me = APS.adapter.me(); if (!me) return [];
    var all = APS.collect(), out = [];
    all.forEach(function (it) {
      if (!it.requester || it.requester.userId !== me.id) return;
      var st = APS.state.items[it.key]; if (!st || st.phase !== 'decision') return;
      out.push(Object.assign({ label: APS.adapter.describe(it.source, it.raw) }, APS.view(it.key)));
    });
    return out;
  };

  /* --------------------------------------------------------------------------
     10. NOTIFICATIONS  (merge into computeNotifications())
         shape matches the app: { id, category, icon, tone, text, onclick }
     ------------------------------------------------------------------------ */
  APS.notificationItems = function () {
    var all = APS.collect(), byKey = {};
    all.forEach(function (it) { byKey[it.key] = it; });
    var items = [];
    APS.queueFor().forEach(function (v) {
      if (v.state === 'on_track') return;
      var it = byKey[v.key]; if (!it) return;
      var mineAsEscalation = !APS.isMine(v.owner);
      var label = APS.adapter.describe(it.source, it.raw);
      var pp = policyFor(v.type);
      var text = (v.state === 'due_soon' ? 'Due in ' + APS.formatDuration(v.leftMinutes) + ': ' : mineAsEscalation ? 'Escalated to you: ' : 'Overdue ' + APS.formatDuration(v.overMinutes) + ': ')
        + (v.phase === 'decision' ? pp.label : v.phaseLabel) + ' — ' + label + (mineAsEscalation && v.owner ? ' (with ' + v.owner.name + ')' : '');
      items.push({ id: 'aps-' + v.key + '-' + v.state + '-' + v.level, category: 'Approvals', icon: v.state === 'due_soon' ? 'clock' : 'alert', tone: v.state === 'due_soon' ? 'gold' : 'terracotta', text: text, onclick: 'closeNotifications(); ' + APS.adapter.openItem(it) });
    });
    APS.waitingOnOthers().forEach(function (v) {
      if (v.state !== 'overdue' && v.state !== 'escalated') return;
      items.push({ id: 'aps-w-' + v.key + '-' + v.level, category: 'Approvals', icon: 'clock', tone: 'gold', text: 'Waiting on ' + (v.owner ? v.owner.name : 'approver') + ' for ' + APS.formatDuration(v.overMinutes) + ' past TAT — ' + v.label + (v.level ? '. Escalated.' : '. We’ve reminded them.'), onclick: 'closeNotifications(); ' + APS.adapter.openItem() });
    });
    return items;
  };

  /* --------------------------------------------------------------------------
     11. BREACH JUSTIFICATION — required before an overdue decision
     ------------------------------------------------------------------------ */
  APS._bypass = {};
  /**
   * Call at the top of every decide function.
   *   if (!APS.guardDecision('req', reqId, function(){ decideApproval(reqId, decision, reason); })) return;
   * Returns true when the decision may go ahead now. Returns false when a
   * justification is needed; the modal then re-runs `proceed` after it is given.
   */
  APS.guardDecision = function (source, id, proceed) {
    var key = source + ':' + id;
    if (APS._bypass[key]) { delete APS._bypass[key]; return true; }
    APS.tick();
    var v = APS.view(key);
    if (!v || !v.needsJustification) return true;
    APS.openBreachModal(key, function () { APS._bypass[key] = true; try { proceed(); } finally { delete APS._bypass[key]; } });
    return false;
  };
  /**
   * Bulk version: asks ONE justification for all overdue items in the selection,
   * records one breach per overdue item, then runs `proceed` (which should decide all ids).
   */
  APS.guardBulk = function (source, ids, proceed) {
    APS.tick();
    var keys = ids.map(function (id) { return source + ':' + id; });
    var late = keys.filter(function (k) { var v = APS.view(k); return v && v.needsJustification; });
    var arm = function () { keys.forEach(function (k) { APS._bypass[k] = true; }); };
    if (!late.length) { arm(); try { proceed(); } finally { keys.forEach(function (k) { delete APS._bypass[k]; }); } return true; }
    APS.openBreachModal(late[0], function () {
      var first = APS.state.breaches[APS.state.breaches.length - 1];
      late.slice(1).forEach(function (k) { APS.recordBreach(k, first.category, first.note + ' (bulk decision of ' + ids.length + ')'); });
      arm();
      try { proceed(); } finally { keys.forEach(function (k) { delete APS._bypass[k]; }); }
    });
    return false;
  };
  /** Wrap an existing global decide function in place. getId(args) returns the request id. */
  APS.wrapDecider = function (fnName, source, getId) {
    var orig = global[fnName];
    if (typeof orig !== 'function' || orig.__aps) return false;
    var wrapped = function () {
      var self = this, args = arguments, id = getId(args);
      if (!APS.guardDecision(source, id, function () { orig.apply(self, args); })) return undefined;
      return orig.apply(self, args);
    };
    wrapped.__aps = true; wrapped.__orig = orig;
    global[fnName] = wrapped;
    return true;
  };
  APS.recordBreach = function (key, category, note) {
    var st = APS.state.items[key]; if (!st) return null;
    var now = APS.now(), me = APS.adapter.me();
    var rec = { key: key, type: st.type, approverId: me ? me.id : null, approverName: me ? me.name : 'Approver', owner: st.owner && st.owner.name,
      dueAt: st.dueAt, decidedAt: now, overMinutes: APS.businessMinutesBetween(st.dueAt, now), level: st.level, category: category, note: note };
    APS.state.breaches.push(rec);
    st.justified = true;
    st.history.push({ at: now, event: 'justified', category: category, note: note, by: rec.approverName });
    APS.adapter.audit('Late decision justified', policyFor(st.type).label + ' · ' + APS.formatDuration(rec.overMinutes) + ' over TAT · ' + category + (note ? ' — ' + note : ''), { entityType: 'Approval', entityId: key.split(':')[1], category: category });
    APS.save();
    return rec;
  };

  /* --------------------------------------------------------------------------
     12. EXTENSION — one request, before the TAT, with a reason
     ------------------------------------------------------------------------ */
  APS.requestExtension = function (key, hours, reason) {
    var st = APS.state.items[key]; if (!st || st.phase === 'closed') return { ok: false, reason: 'This request is already closed.' };
    var pp = phasePolicy(st) || policyFor(st.type), ext = pp.extension || { maxHours: 0, times: 0 };
    var now = APS.now();
    if (now >= st.dueAt) return { ok: false, reason: 'The TAT has already passed. Decide now and give a reason.' };
    if ((st.extensionsUsed || 0) >= ext.times) return { ok: false, reason: 'The extension for this request has already been used.' };
    if (!reason || String(reason).trim().length < APS.config.breachNoteMinChars) return { ok: false, reason: 'Add a reason of at least ' + APS.config.breachNoteMinChars + ' characters.' };
    var h = Math.min(hours, ext.maxHours);
    var oldDue = st.dueAt;
    st.dueAt = APS.addBusinessMinutes(st.dueAt, Math.round(h * 60));
    st.extensionsUsed = (st.extensionsUsed || 0) + 1;
    var me = APS.adapter.me();
    var rec = { key: key, by: me ? me.name : 'Approver', hours: h, reason: reason, from: oldDue, to: st.dueAt, at: now };
    APS.state.extensions.push(rec);
    st.history.push({ at: now, event: 'extended', hours: h, reason: reason, by: rec.by });
    APS.adapter.audit('Approval TAT extended', policyFor(st.type).label + ' · +' + h + 'h · ' + reason, { entityType: 'Approval', entityId: key.split(':')[1] });
    var mgr = ladderParty('backup');
    APS.state.outbox.push({ at: now, channel: 'email', kind: 'extension', to: mgr, itemKey: key, text: rec.by + ' extended a ' + policyFor(st.type).label.toLowerCase() + ' by ' + h + 'h: ' + reason, delivered: false });
    APS.save(); APS.adapter.refresh();
    return { ok: true, dueAt: st.dueAt };
  };

  /** Manually send a nudge (for "Waiting on others" rows). Rate-limited to once per hour per item. */
  APS.nudge = function (key) {
    var st = APS.state.items[key]; if (!st || st.phase === 'closed') return { ok: false, reason: 'Nothing to nudge.' };
    var now = APS.now(), last = st.lastNudgeAt || 0;
    if (now - last < 3600000) return { ok: false, reason: 'Already nudged in the last hour.' };
    st.lastNudgeAt = now;
    APS.state.outbox.push({ at: now, channel: 'push', kind: 'nudge', to: st.owner, itemKey: key, text: 'Reminder: ' + policyFor(st.type).label + ' is waiting on you.', delivered: false });
    st.history.push({ at: now, event: 'nudged', by: (APS.adapter.me() || {}).name });
    APS.save();
    return { ok: true };
  };

  /* --------------------------------------------------------------------------
     13. METRICS  (Team / Approver performance, Settings › Approval rules)
     ------------------------------------------------------------------------ */
  APS.metrics = function (filter) {
    filter = filter || {};
    var rows = [];
    Object.keys(APS.state.items).forEach(function (k) {
      var st = APS.state.items[k];
      st.history.forEach(function (h) {
        if (h.event !== 'closed' || h.phase !== 'decision' || h.outcome === 'withdrawn') return;
        if (filter.type && st.type !== filter.type) return;
        rows.push({ type: st.type, onTime: h.onTime, minutes: h.businessMinutes, at: h.at });
      });
    });
    var mins = rows.map(function (r) { return r.minutes; }).sort(function (a, b) { return a - b; });
    var breaches = APS.state.breaches.filter(function (b) { return (!filter.type || b.type === filter.type) && (!filter.approverId || b.approverId === filter.approverId); });
    var byType = {};
    rows.forEach(function (r) { var t = byType[r.type] = byType[r.type] || { decided: 0, onTime: 0 }; t.decided++; if (r.onTime) t.onTime++; });
    return {
      decided: rows.length,
      onTimePct: rows.length ? Math.round(rows.filter(function (r) { return r.onTime; }).length / rows.length * 100) : null,
      medianMinutes: mins.length ? mins[Math.floor(mins.length / 2)] : null,
      breaches: breaches.length,
      byReason: breaches.reduce(function (a, b) { a[b.category] = (a[b.category] || 0) + 1; return a; }, {}),
      byType: byType,
      openOverdue: Object.keys(APS.state.items).map(APS.view).filter(function (v) { return v && (v.state === 'overdue' || v.state === 'escalated'); }).length
    };
  };

  /* --------------------------------------------------------------------------
     14. UI — breach justification + extension modals (vanilla DOM, Oontu tokens)
     ------------------------------------------------------------------------ */
  function el(tag, attrs, kids) {
    var e = global.document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { if (k === 'style') e.style.cssText = attrs[k]; else if (k === 'text') e.textContent = attrs[k]; else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), attrs[k]); else e.setAttribute(k, attrs[k]); });
    (kids || []).forEach(function (c) { if (c) e.appendChild(typeof c === 'string' ? global.document.createTextNode(c) : c); });
    return e;
  }
  var T = { ink: '#2F313F', ink2: '#565A66', ink3: '#6E717C', line: '#E7E6E1', line2: '#D9D8D2', sunk: '#F8F8F6', redBg: '#FCEFEE', redFg: '#A93226' };
  function modalShell(titleText, bodyKids, onClose) {
    var overlay = el('div', { role: 'dialog', 'aria-modal': 'true', 'aria-label': titleText, style: 'position:fixed;inset:0;z-index:9999;background:rgba(26,27,35,.45);display:flex;align-items:center;justify-content:center;padding:16px;font-family:inherit;' });
    var card = el('div', { style: 'width:100%;max-width:480px;background:#FFFFFF;border-radius:18px;box-shadow:0 24px 64px -24px rgba(26,27,35,.45);padding:22px;display:flex;flex-direction:column;gap:14px;color:' + T.ink + ';' }, bodyKids);
    overlay.appendChild(card);
    overlay.addEventListener('keydown', function (e) { if (e.key === 'Escape') { close(); } });
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    function close() { overlay.remove(); if (onClose) onClose(); }
    global.document.body.appendChild(overlay);
    return { overlay: overlay, card: card, close: close };
  }
  function btn(label, primary, onclick) {
    return el('button', { type: 'button', onclick: onclick, style: 'font:inherit;font-size:14px;font-weight:' + (primary ? '600' : '500') + ';padding:10px 16px;border-radius:11px;cursor:pointer;border:1px solid ' + (primary ? T.ink : T.line2) + ';background:' + (primary ? T.ink : '#FFFFFF') + ';color:' + (primary ? '#FFFFFF' : T.ink) + ';' }, [label]);
  }

  APS.openBreachModal = function (key, onJustified) {
    var v = APS.view(key); if (!v) { onJustified(); return; }
    var pol = policyFor(v.type);
    var chosen = null;
    var chips = el('div', { role: 'radiogroup', 'aria-label': 'Reason', style: 'display:flex;flex-wrap:wrap;gap:6px;' });
    var err = el('p', { style: 'margin:0;font-size:13px;color:' + T.redFg + ';display:none;' });
    APS.config.breachReasons.forEach(function (r) {
      var b = el('button', { type: 'button', role: 'radio', 'aria-checked': 'false', style: 'font:inherit;font-size:13px;font-weight:500;padding:7px 11px;border-radius:999px;cursor:pointer;border:1px solid ' + T.line2 + ';background:#FFFFFF;color:' + T.ink + ';' }, [r]);
      b.addEventListener('click', function () {
        chosen = r;
        Array.prototype.forEach.call(chips.children, function (c) { var on = c === b; c.setAttribute('aria-checked', on ? 'true' : 'false'); c.style.background = on ? T.ink : '#FFFFFF'; c.style.color = on ? '#FFFFFF' : T.ink; c.style.borderColor = on ? T.ink : T.line2; });
        err.style.display = 'none';
      });
      chips.appendChild(b);
    });
    var note = el('textarea', { rows: '3', placeholder: 'What held this up, and what will stop it happening again?', style: 'font:inherit;font-size:14px;color:' + T.ink + ';border:1px solid ' + T.line2 + ';border-radius:10px;padding:10px 12px;resize:vertical;outline:none;' });
    note.addEventListener('input', function () { err.style.display = 'none'; });
    var m = modalShell('Explain the delay', [
      el('span', { style: 'align-self:flex-start;font-size:12px;font-weight:600;padding:4px 10px;border-radius:999px;background:' + T.redBg + ';color:' + T.redFg + ';' }, ['Overdue ' + APS.formatDuration(v.overMinutes) + ' · TAT was ' + v.tatHours + 'h']),
      el('h2', { style: 'margin:0;font-size:20px;font-weight:700;letter-spacing:-0.02em;' }, ['Explain the delay before you decide']),
      el('p', { style: 'margin:0;font-size:14px;line-height:1.55;color:' + T.ink2 + ';' }, [pol.label + ' was due ' + APS.formatClock(v.dueAt) + '. Your reason goes to the audit log and your manager’s approval report.' + (v.level ? ' It was escalated, so ' + (v.coOwners.map(function (c) { return c.name; }).join(', ') || 'your manager') + ' can see it too.' : '')]),
      el('span', { style: 'font-size:13px;font-weight:600;' }, ['Main reason']),
      chips,
      el('label', { style: 'display:flex;flex-direction:column;gap:6px;font-size:13px;color:' + T.ink2 + ';' }, ['Note', note]),
      err,
      el('div', { style: 'display:flex;justify-content:flex-end;gap:8px;' }, [
        btn('Cancel', false, function () { m.close(); }),
        btn('Save reason and decide', true, function () {
          var txt = note.value.trim();
          if (!chosen) { err.textContent = 'Pick the main reason.'; err.style.display = 'block'; return; }
          if (txt.length < APS.config.breachNoteMinChars) { err.textContent = 'Add a note of at least ' + APS.config.breachNoteMinChars + ' characters.'; err.style.display = 'block'; note.focus(); return; }
          APS.recordBreach(key, chosen, txt);
          m.close();
          onJustified();
        })
      ])
    ]);
    setTimeout(function () { var first = chips.firstChild; if (first) first.focus(); }, 0);
  };

  APS.openExtensionModal = function (key) {
    var v = APS.view(key); if (!v) return;
    var pol = policyFor(v.type), ext = (pol.extension || { maxHours: 0 });
    var opts = [1, 2, 4, 9].filter(function (h) { return h <= ext.maxHours; });
    var pick = opts[0];
    var row = el('div', { role: 'radiogroup', 'aria-label': 'Extra time', style: 'display:flex;flex-wrap:wrap;gap:6px;' });
    opts.forEach(function (h, i) {
      var b = el('button', { type: 'button', role: 'radio', 'aria-checked': i === 0 ? 'true' : 'false', style: 'font:inherit;font-size:13px;font-weight:500;padding:7px 12px;border-radius:999px;cursor:pointer;border:1px solid ' + (i === 0 ? T.ink : T.line2) + ';background:' + (i === 0 ? T.ink : '#FFFFFF') + ';color:' + (i === 0 ? '#FFFFFF' : T.ink) + ';' }, [h === 9 ? '+1 working day' : '+' + h + 'h']);
      b.addEventListener('click', function () { pick = h; Array.prototype.forEach.call(row.children, function (c) { var on = c === b; c.setAttribute('aria-checked', on ? 'true' : 'false'); c.style.background = on ? T.ink : '#FFFFFF'; c.style.color = on ? '#FFFFFF' : T.ink; c.style.borderColor = on ? T.ink : T.line2; }); });
      row.appendChild(b);
    });
    var reason = el('textarea', { rows: '2', placeholder: 'Waiting for the client to confirm the budget band.', style: 'font:inherit;font-size:14px;border:1px solid ' + T.line2 + ';border-radius:10px;padding:10px 12px;resize:vertical;outline:none;color:' + T.ink + ';' });
    var err = el('p', { style: 'margin:0;font-size:13px;color:' + T.redFg + ';display:none;' });
    var m = modalShell('Ask for more time', [
      el('h2', { style: 'margin:0;font-size:20px;font-weight:700;letter-spacing:-0.02em;' }, ['Need more time?']),
      el('p', { style: 'margin:0;font-size:14px;line-height:1.55;color:' + T.ink2 + ';' }, ['Due ' + APS.formatClock(v.dueAt) + '. You can extend once. Your manager and the requester will see why.']),
      row,
      el('label', { style: 'display:flex;flex-direction:column;gap:6px;font-size:13px;color:' + T.ink2 + ';' }, ['Reason', reason]),
      err,
      el('div', { style: 'display:flex;justify-content:flex-end;gap:8px;' }, [
        btn('Cancel', false, function () { m.close(); }),
        btn('Extend', true, function () {
          var r = APS.requestExtension(key, pick, reason.value.trim());
          if (!r.ok) { err.textContent = r.reason; err.style.display = 'block'; return; }
          m.close(); APS.adapter.toast('Extended. New due time ' + APS.formatClock(r.dueAt) + '.');
        })
      ])
    ]);
  };

  /* --------------------------------------------------------------------------
     15. CHIP HTML helper for string-template UIs (matches the redesign colours)
     ------------------------------------------------------------------------ */
  APS.chipHTML = function (source, id) {
    var v = APS.viewFor(source, id); if (!v || v.state === 'closed') return '';
    var c = v.tone === 'red' ? ['#FCEFEE', '#A93226', '#D9534A'] : v.tone === 'amber' ? ['#FDF5E6', '#8F5A0B', '#E0A030'] : ['#F1F1EE', '#565A66', '#9A9CA5'];
    var esc = function (s) { return String(s).replace(/[&<>"]/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]; }); };
    return '<span class="aps-chip" title="' + esc(v.phaseLabel + ' · owner ' + (v.owner ? v.owner.name : '—')) + '" style="display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:500;padding:3px 9px;border-radius:999px;white-space:nowrap;background:' + c[0] + ';color:' + c[1] + ';"><span style="width:6px;height:6px;border-radius:50%;background:' + c[2] + ';"></span>' + esc(v.chip) + '</span>';
  };

})(typeof window !== 'undefined' ? window : globalThis);
