/* Agency shapes (flow map 05): the four team shapes end to end, on fresh people.
   Small: Owner → Recruiters · Classic: Owner → RM → Recruiters · Larger: Owner → Admin → RM → Recruiters · Mixed: one recruiter
   under an RM, one directly under the Owner. Each runs submit → review → send → offer exception → what each person sees →
   suspend one recruiter with hand-over. Plus a custom Account manager role.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\agency-shapes.spec.js */
(function(){
  var results = [];
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  var ce = console.error; console.error = function(){ errs.push('console.error ' + Array.prototype.slice.call(arguments).map(function(a){ return (a && a.stack) || (a && a.message) || String(a); }).join(' ').slice(0, 300)); };
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e.stack || e.message).slice(0, 500) }); } finally { asOwner(); if(typeof csClose === 'function') csClose(); } }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function asOwner(){ viewingAsFromManager = false; managerViewAsRecruiterId = null; previewAsRoleId = null; state.role = 'admin'; }
  function actAs(id){ if(id === OWNER) return asOwner(); state.role = 'manager'; viewingAsFromManager = true; managerViewAsRecruiterId = id; previewAsRoleId = null; }
  function audit(re){ return AUDIT_LOG.some(function(a){ return re.test((a.action || '') + ' ' + (a.detail || '')); }); }
  var OWNER = 'RP-088', seq = 0;
  function person(name, roleId, reportsTo){ seq++; var u = { id:'SH-' + seq, name:name, email:'sh.' + seq + '@northstartalent.com', assignedRoleId:roleId, reportingManagerId:reportsTo || null, organizationId:CURRENT_ORGANIZATION_ID, userStatus:'Active' }; RECRUITER_ROSTER.push(u); return u; }
  function mkJob(team){ seq++; var j = { id:'shj' + seq, title:'Shape Role ' + seq, client:'Fintech Corp', clientId:'c1', loc:'Pune, IN', locations:['Pune, IN'], status:'Active', priority:'Medium', recruiter:'', recruiterId:null,
    assignedRecruiters:team.map(function(u){ return u.id; }), skills:['Java'], positions:3, submitted:0, candidateIds:[], interested:[], recs:[], publishChannels:[], organizationId:CURRENT_ORGANIZATION_ID, salary:'₹10–20 LPA', workMode:'Hybrid',
    submissionRules:{ approvalBeforeClient:true, hideContacts:true, maxProfiles:5, required:[] } }; JOBS.push(j); return j; }
  function mkCand(){ seq++; var c = { id:98500 + seq, name:'Shape Candidate ' + seq, role:'Engineer', exp:'5 yrs', loc:'Pune, IN', skills:['Java'], email:'shc' + seq + '@example.com', phone:'+91 97000 ' + String(10000 + seq), salary:'₹14–16 LPA', notice:'30 Days', organizationId:CURRENT_ORGANIZATION_ID }; CANDIDATES.push(c); return c; }
  function menuOf(id){ actAs(id); renderSidebar(); var m = agencyNavFor(effectiveRoleId()).reduce(function(a, g){ return a.concat(g.items.map(function(i){ return i.id; })); }, []); return m; }

  /* One run per shape: submit → review (who) → send (who) → offer exception (who approves) → what each sees → hand-over. */
  function runShape(label, rec, expectReviewer, expectOfferApprover, others){
    var j = mkJob([rec].concat(others.filter(function(u){ return u.assignedRoleId !== 'role_founder'; }))), c = mkCand();
    actAs(rec.id); var r = submitOneToJob(j, c, 'Test'); ok(r.ok, label + ': submitted ' + (r.reason || ''));
    var rq = APPROVAL_REQUESTS.find(function(x){ return x.entityType === 'SubmissionReview' && x.entityId === r.sub.id; });
    ok(rq && rq.approverUserId === expectReviewer, label + ': review goes to ' + (rosterById(expectReviewer) || {}).name + ', got ' + (rq && rq.approverName));
    actAs(expectReviewer); decideApproval(rq.id, 'Approved'); ok(r.sub.stage === 'Ready to Send', label + ': approved by the reviewer');
    actAs(rec.id); openSendToClient([r.sub.id]); consentAnswer(r.sub.consent.token, true); csSend(); ok(r.sub.stage === 'Submitted' && r.sub.sent.by === rec.name, label + ': sent by the recruiter');
    actAs(rec.id); var o = recordOffer(r.sub.id, { ctc:40, doj:'2026-12-20' }); ok(o.ok && o.pending && o.approval && o.approval.approverUserId === expectOfferApprover, label + ': offer exception → ' + (rosterById(expectOfferApprover) || {}).name + ', got ' + (o.approval && o.approval.approverName));
    // what each person sees
    actAs(rec.id); ok(jobInScope(j) && journeyInScope(r.sub) && homeForMe() === 'dashboard', label + ': the recruiter sees the job, their journey, My day');
    var rm = others.find(function(u){ return u.assignedRoleId === 'role_recmgr'; });
    if(rm){ var mine = scopeTreeIds(rm).indexOf(rec.id) > -1; actAs(rm.id); ok(homeForMe() === 'manager-dashboard' && menuOf(rm.id).indexOf('approval-center') > -1, label + ': the RM has manager Home and Approvals');
      ok(journeyInScope(r.sub) === mine, label + ': the RM ' + (mine ? 'sees' : 'doesn’t see') + ' a journey ' + (mine ? 'in' : 'outside') + ' their tree'); }
    asOwner(); ok(jobInScope(j) && journeyInScope(r.sub) && homeForMe() === 'admin-dashboard', label + ': the Owner sees everything');
    // suspend the recruiter with the default hand-over (their Reports to manager)
    var to = handOverDefault(rec), res = handOverWork(rec, {});
    ok(res.ok && rec.userStatus === 'Suspended' && r.sub.recruiterId === to && r.sub.ownerHistory.slice(-1)[0].reason === 'Hand-over from ' + rec.name, label + ': journey handed to ' + (rosterById(to) || {}).name);
    ok(j.assignedRecruiters.indexOf(rec.id) < 0 && j.assignedRecruiters.indexOf(to) > -1, label + ': job handed over');
    ok(audit(new RegExp('Hand-over: candidate journeys they own ' + rec.name)) && audit(new RegExp('Member suspended after hand-over ' + rec.name)), label + ': audited');
    var left = handOverItems(rec); ok(Object.keys(left).every(function(k){ return !left[k].length; }), label + ': nothing left');
  }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    state.role = 'admin'; enterApp(); await sleep(100);

    await t('Small: Owner → Recruiters', async function(){
      var r1 = person('Small Recruiter One', 'role_recruiter', OWNER); person('Small Recruiter Two', 'role_recruiter', OWNER);
      runShape('Small', r1, OWNER, OWNER, [rosterById(OWNER)]);
    });

    await t('Classic: Owner → RM → Recruiters', async function(){
      var rm = person('Classic RM', 'role_recmgr', OWNER), r1 = person('Classic Recruiter', 'role_recruiter', rm.id); person('Classic Recruiter Two', 'role_recruiter', rm.id);
      runShape('Classic', r1, rm.id, rm.id, [rm]);
    });

    await t('Larger: Owner → Admin → RM → Recruiters', async function(){
      var ad = person('Larger Admin', 'role_admin', OWNER), rm = person('Larger RM', 'role_recmgr', ad.id), r1 = person('Larger Recruiter', 'role_recruiter', rm.id);
      runShape('Larger', r1, rm.id, rm.id, [rm]);
      actAs(ad.id); ok(homeForMe() === 'admin-dashboard' && menuOf(ad.id).indexOf('team-members') > -1, 'the Admin: Owner-style Home and Team');
    });

    await t('Mixed: one recruiter under the RM, one directly under the Owner', async function(){
      var rm = person('Mixed RM', 'role_recmgr', OWNER), underRm = person('Mixed Under RM', 'role_recruiter', rm.id), underOwner = person('Mixed Under Owner', 'role_recruiter', OWNER);
      runShape('Mixed / RM line', underRm, rm.id, rm.id, [rm]);
      runShape('Mixed / Owner line', underOwner, OWNER, OWNER, [rm]);
    });

    await t('a custom Account manager sees only what its permissions allow', async function(){
      var base = CUSTOM_ROLES.find(function(r){ return r.id === 'role_recruiter'; }); migrateRole(base);
      var perms = {}; PERMISSION_MODULES.forEach(function(m){ perms[m.id] = []; }); Object.assign(perms, { clients:['View','Create','Edit'], jobs:['View','Create','Edit'], interviews:['View','Schedule'], approvals:['Request','Approve','View'] });
      CUSTOM_ROLES.push({ id:'role_sh_am', name:'Account manager', __v2:true, permissions:perms, scope:Object.assign({}, base.scope, { clients:'own', jobs:'own', journeys:'assigned' }), approves:{} });
      var am = person('Shape Account Manager', 'role_sh_am', OWNER), cl = CLIENTS.find(function(c){ return c.name === 'HealthAI'; }), was = cl.ownerId; cl.ownerId = am.id;
      try {
        actAs(am.id); var m = menuOf(am.id); ok(m.join() === 'dashboard,approval-center,my-todo,jobs,interviews,client-management,settings', m.join());
        ok(CLIENTS.filter(clientVisibleTo).every(function(c){ return c === cl; }) && JOBS.filter(jobInScope).every(function(j){ return clientForJob(j) === cl; }), 'only their client and its jobs');
        ok(!clCanSeeMoney() && homeForMe() === 'dashboard', 'no money, My day');
      } finally { cl.ownerId = was; }
    });

    asOwner();
    var pre = document.createElement('pre'); pre.id = 'auth-test-results'; pre.textContent = JSON.stringify(results); document.body.appendChild(pre);
    document.title = 'AGENCY-SHAPES ' + results.filter(function(r){ return r.pass; }).length + '/' + results.length;
  }, 800); });
})();
