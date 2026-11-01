/* M11 · Names, role templates and team-size defaults (B12, C5 · flow map 01, 03, 04).
   Inside a workspace the top role is "Owner" (agency and corporate); "Oontu Super Admin" is only on Oontu's own screens and
   saved records keep their old label, shown as Owner. Create role offers Admin, Account manager, Accounts and Sourcer (never
   seeded); each fills the editor and nothing is created until Save. "Submit to job" is a new permission every pre-M11
   submitting role keeps. The team size at sign-up sets submission review and applicant sharing once.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\m11-names-templates.spec.js */
(function(){
  var results = [];
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var q = function(s){ return document.querySelector(s); };
  var errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  var ce = console.error; console.error = function(){ errs.push('console.error ' + Array.prototype.slice.call(arguments).map(function(a){ return (a && a.stack) || (a && a.message) || String(a); }).join(' ').slice(0, 300)); };
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e.stack || e.message).slice(0, 500) }); } finally { reset(); } }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function reset(){ viewingAsFromManager = false; managerViewAsRecruiterId = null; previewAsRoleId = null; state.role = 'admin'; ORG_STRUCTURE.profile.orgType = 'Agency'; sRoleDraft = null; sRolePicking = false; renderSidebar(); }
  function as(role){ viewingAsFromManager = false; managerViewAsRecruiterId = null; previewAsRoleId = null; state.role = role; renderSidebar(); }
  function actAs(id){ state.role = 'manager'; viewingAsFromManager = true; managerViewAsRecruiterId = id; previewAsRoleId = null; renderSidebar(); }
  function shown(){ NAV_GROUP_OPEN = { Insights:true }; sidebarMoreOpen = true; renderSidebar(); return [].map.call(document.querySelectorAll('#sidebar-nav .nav-item'), function(b){ return b.getAttribute('data-nav'); }).join(','); }
  var toasts = [], t0 = window.toast; window.toast = function(m){ toasts.push(String(m)); return t0.apply(this, arguments); };
  // "Oontu Super Admin" is the platform role and allowed.
  function bad(text){ return String(text || '').replace(/Oontu Super Admin/g, '').match(/Super Admin|Tenant Admin/); }
  var seq = 0;
  function person(name, roleId){ seq++; var u = { id:'M11-' + seq, name:name, email:'m11.' + seq + '@northstartalent.com', assignedRoleId:roleId, reportingManagerId:'RP-088', organizationId:CURRENT_ORGANIZATION_ID, userStatus:'Active' }; RECRUITER_ROSTER.push(u); return u; }
  function main(){ var m = q('#main-content'); return m ? m.textContent : ''; }
  function fromTemplate(key, name){ as('admin'); openSettings('roles'); sStartRoleDraft(key); if(name) sRoleDraft.name = name; return sSaveRoleDraft(); }
  var auditStart = 0;

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    state.role = 'admin'; enterApp(); await sleep(100); auditStart = AUDIT_LOG.length;

    await t('no tenant screen, Settings section, toast or audit line says “Super Admin” or “Tenant Admin”; Oontu’s own screens keep “Oontu Super Admin”', async function(){
      ok(CUSTOM_ROLES[0].id === 'role_founder' && CUSTOM_ROLES[0].name === 'Owner', 'the top role is Owner, the id is unchanged');
      var views = ['admin-dashboard','jobs','talent-pool','approval-center','team-members','client-management','admin-paytrack','reports','recruiter-analytics','interviews','all-tasks','manager-team','dashboard'];
      [['admin','Agency'], ['manager','Agency'], ['recruiter','Agency'], ['admin','Corporate']].forEach(function(x){
        as(x[0]); ORG_STRUCTURE.profile.orgType = x[1];
        views.forEach(function(v){ if(!RENDERERS[v]) return; try { showView(v); } catch(e){ return; } var b = bad(main()); ok(!b, x.join('/') + ' · ' + v + ': ' + (b && main().slice(Math.max(0, main().indexOf(b[0]) - 60), main().indexOf(b[0]) + 40))); });
        SETTINGS_SECTIONS.filter(function(s){ return /tenant/.test(s.for || '') && (!s.can || s.can()); }).forEach(function(s){ openSettings(s.id); var b = bad(main()); ok(!b, x.join('/') + ' · Settings › ' + s.id + ': ' + (b && main().slice(Math.max(0, main().indexOf(b[0]) - 60), main().indexOf(b[0]) + 40))); });
        var sb = q('#sidebar'); ok(!bad(sb ? sb.textContent : ''), x.join('/') + ': menu');
      });
      ORG_STRUCTURE.profile.orgType = 'Agency'; as('admin');
      var owner = superAdminUser(); ok(/only active Owner/.test(tmSuspendBlocker(owner)) || /your own account/.test(tmSuspendBlocker(owner)), 'team change blocker: ' + tmSuspendBlocker(owner));
      as('manager'); toasts = []; setJobsNeedApproval(true); ok(toasts.some(function(m){ return /Only the Owner can change this/.test(m); }), 'toast: ' + toasts.join(' | '));
      var j = JOBS.find(function(x){ return x.status === 'Active'; }); ok(!bad(tsReviewRoute(j).text), 'review route: ' + tsReviewRoute(j).text);
      as('admin'); ok(!bad(jobPolicyPanelHTML().replace(/<[^>]+>/g, ' ')), 'job approval settings: reviewer option is Owner'); ok(/>Owner</.test(jobPolicyPanelHTML()), 'the reviewer list says Owner');
      var made = AUDIT_LOG.slice(0, AUDIT_LOG.length - auditStart); made.forEach(function(a){ ok(!bad(a.action + ' ' + a.detail), 'audit: ' + a.action + ' · ' + a.detail); });
      toasts.forEach(function(m){ ok(!bad(m), 'toast: ' + m); });
      switchRole('oontu'); showView('oontu-tenants'); ok(/Oontu Super Admin/.test(main()), 'the platform role keeps its name on Oontu’s screens');
    });

    await t('records saved with the old label are not rewritten; they are shown as Owner', async function(){
      var req = { id:'appr-m11-old', entityType:'JobApproval', entityId:'j1', status:'Approved', approverName:'Tenant Admin', decidedByName:'Tenant Admin', decisionReason:'Created by the Tenant Admin, the approver under this policy', createdAt:nowTimestamp(), decidedAt:nowTimestamp(), context:{} };
      APPROVAL_REQUESTS.push(req); AUDIT_LOG.unshift({ module:'Jobs', action:'Job submitted for approval', detail:'Old job · reviewer: Tenant Admin', actor:'Priya Sharma', time:'Earlier' });
      try {
        ok(shownRoleName('Tenant Admin') === 'Owner' && shownRoleName('Super Admin') === 'Owner' && shownRoleName('Oontu Super Admin') === 'Oontu Super Admin', 'the display mapping');
        var au = sec_audit().replace(/<[^>]+>/g, ' '); ok(/reviewer: Owner/.test(au) && !/Tenant Admin/.test(au), 'the audit log shows Owner');
        ok(AUDIT_LOG[0].detail === 'Old job · reviewer: Tenant Admin' && req.approverName === 'Tenant Admin' && req.decidedByName === 'Tenant Admin', 'saved history is never edited');
      } finally { APPROVAL_REQUESTS.splice(APPROVAL_REQUESTS.indexOf(req), 1); AUDIT_LOG.shift(); }
    });

    await t('“Submit to job”: every role that could submit keeps it (one update at load, one audit line per role); a role without it can’t submit (agency); corporate unchanged', async function(){
      ['role_founder','role_admin','role_recmgr','role_recruiter'].forEach(function(id){ ok(roleHasPermission(id, 'candidates', 'Submit to job'), id + ' keeps submitting'); });
      ['Owner','Admin','Recruiter Manager','Recruiter'].forEach(function(n){ ok(AUDIT_LOG.filter(function(a){ return a.action === 'Permission added' && a.detail.indexOf(n + ': Submit to job') === 0; }).length === 1, 'one audit line for ' + n); });
      var later = { id:'role_m11_later', name:'Made later', __v2:true, permissions:{ talentpool:['View','Recommend'] }, scope:{}, approves:{} }; CUSTOM_ROLES.push(later); later.__submitToJob = true;
      ok(!roleHasPermission(later.id, 'candidates', 'Submit to job'), 'a role made after M11 does not get it by being used');
      var custom = { id:'role_m11_custom', name:'Old custom', __v2:true, permissions:{ talentpool:['View','Recommend'] }, scope:{}, approves:{} }; CUSTOM_ROLES.push(custom);   // as if it existed before M11
      var a0 = AUDIT_LOG.length; ok(submitToJobUpdate().join() === 'Old custom' && roleHasPermission(custom.id, 'candidates', 'Submit to job') && AUDIT_LOG.length === a0 + 1, 'the load update gives a pre-M11 role with Recommend the permission, with one audit line');
      ok(submitToJobUpdate().length === 0 && AUDIT_LOG.length === a0 + 1, 'it never runs twice');
      var u = person('Old Custom Person', custom.id), j = JOBS.find(function(x){ return x.status === 'Active'; }); (j.assignedRecruiters = j.assignedRecruiters || []).push(u.id);
      actAs(u.id); ok(canSubmitToJobs() && jobWsCanSubmit(j), 'and can submit as before');
      custom.permissions.candidates.splice(custom.permissions.candidates.indexOf('Submit to job'), 1); custom.permissions.talentpool.push('Add');
      ok(!canSubmitToJobs() && !jobWsCanSubmit(j), 'taken away: no submit, even with talent pool Add');
      var c = CANDIDATES.find(function(x){ return !findSubmission(j.id, x.id); }), r = submitOneToJob(j, c, 'Test', { dryRun:true });
      ok(!r.ok && r.code === 'no_permission', 'submitOneToJob refuses: ' + JSON.stringify(r));
      toasts = []; openSubmitPicker(j.id); ok(!q('#sp-modal') && toasts.some(function(m){ return /can’t submit/.test(m); }), 'the send dialog does not open');
      ORG_STRUCTURE.profile.orgType = 'Corporate'; ok(canSubmitToJobs(), 'corporate keeps talent pool Add'); ORG_STRUCTURE.profile.orgType = 'Agency';
      as('admin'); settingsRoleId = 'role_recruiter'; openSettings('roles'); ok(/Submit to job/.test(main()), 'agency editor shows it');
      ORG_STRUCTURE.profile.orgType = 'Corporate'; openSettings('roles'); ok(!/Submit to job/.test(main()), 'corporate editor unchanged'); ORG_STRUCTURE.profile.orgType = 'Agency';
    });

    await t('Create role: four templates (not seeded); each fills the editor and nothing is created until Save role', async function(){
      as('admin'); openSettings('roles'); sRolePicking = true; settingsRefresh();
      var picks = [].map.call(document.querySelectorAll('#role-templates [data-template]'), function(b){ return b.getAttribute('data-template'); }).join(',');
      ok(picks === 'admin,account,accounts,sourcer,blank', 'templates: ' + picks);
      ok(roleTemplatesForOrgType('Staffing agency').map(function(r){ return r.name; }).join(',') === 'Owner,Recruiter Manager,Recruiter', 'sign-up still seeds three');
      var n = CUSTOM_ROLES.length, audits = AUDIT_LOG.length;
      sStartRoleDraft('sourcer'); ok(CUSTOM_ROLES.length === n && AUDIT_LOG.length === audits, 'opening a template creates nothing');
      ok(/Sourcer · not saved/.test(main()) && /Save role/.test(main()), 'the editor shows the draft');
      sTogglePerm('__draft', 'reports', 'View'); sRoleScope('__draft', 'jobs', 'all'); ok(sRoleDraft.permissions.reports.indexOf('View') > -1 && sRoleDraft.scope.jobs === 'all' && CUSTOM_ROLES.length === n, 'changed before saving, still not created');
      sDiscardRoleDraft(); ok(!sRoleDraft && CUSTOM_ROLES.length === n, 'discard: nothing created');
      var r = fromTemplate('sourcer', 'Sourcer M11'); ok(r && CUSTOM_ROLES.length === n + 1 && AUDIT_LOG[0].action === 'Role created' && /Sourcer M11 · from the Sourcer template/.test(AUDIT_LOG[0].detail), 'saved with an audit line');
      ok(!fromTemplate('admin'), 'a name already in use is refused (the demo has an Admin)'); ok(toasts.some(function(m){ return /already exists/.test(m); }), 'and says so');
      ORG_STRUCTURE.profile.orgType = 'Corporate'; openSettings('roles'); ok(!q('#role-templates') && !/Create role/.test(main()), 'corporate: no templates'); ORG_STRUCTURE.profile.orgType = 'Agency';
    });

    await t('Clone copies the source’s ticks; the editor shows “Submit to job” ticked before Save', async function(){
      as('admin'); var n = CUSTOM_ROLES.length, a0 = AUDIT_LOG.length; settingsRoleId = 'role_recruiter'; openSettings('roles'); sCloneRole('role_recruiter');
      ok(sRoleDraft && sRoleDraft.cloneOf === 'Recruiter' && CUSTOM_ROLES.length === n && AUDIT_LOG.length === a0, 'a draft, nothing created yet');
      var box = q('#main-content'), chk = [].find.call(box.querySelectorAll('label.s-chk'), function(l){ return /Submit to job/.test(l.textContent); });
      ok(chk && chk.querySelector('input').checked, 'Submit to job is shown ticked before Save'); ok(/A copy of Recruiter, with the same ticks, including Submit to job/.test(box.textContent), 'and the editor says so');
      sRoleDraft.name = 'Recruiter clone M11'; var r = sSaveRoleDraft(); ok(r && CUSTOM_ROLES.length === n + 1 && roleHasPermission(r.id, 'candidates', 'Submit to job') && AUDIT_LOG[0].action === 'Role cloned' && /Recruiter → Recruiter clone M11/.test(AUDIT_LOG[0].detail), 'saved with the same ticks, audited');
      ORG_STRUCTURE.profile.orgType = 'Corporate'; var m = CUSTOM_ROLES.length; sCloneRole('role_recruiter'); ok(CUSTOM_ROLES.length === m + 1 && !sRoleDraft, 'corporate: clone as before'); CUSTOM_ROLES.pop(); ORG_STRUCTURE.profile.orgType = 'Agency';
    });

    await t('each template’s menu and Home follow from its permissions', async function(){
      var A = fromTemplate('admin', 'Admin M11'), AM = fromTemplate('account', 'Account manager M11'), ACC = fromTemplate('accounts', 'Accounts M11'), SRC = fromTemplate('sourcer', 'Sourcer M11b');
      ok(homeFor(A.id) === 'admin-dashboard' && homeFor(AM.id) === 'dashboard' && homeFor(ACC.id) === 'admin-paytrack' && homeFor(SRC.id) === 'dashboard', 'Homes: ' + [A, AM, ACC, SRC].map(function(r){ return homeFor(r.id); }).join());
      ok(!roleHasPermission(A.id, 'billing', 'Manage plan & add-ons') && !roleHasPermission(A.id, 'billing', 'Approve credit') && roleHasPermission(A.id, 'billing', 'Raise invoice') && roleHasPermission(A.id, 'billing', 'Record payment') && roleHasPermission(A.id, 'contracts', 'Manage') && !roleHasPermission(A.id, 'contracts', 'Approve rates'), 'Admin: no plan or billing settings; invoices, payments, contracts');
      actAs(person('Admin M11 Person', A.id).id); var m = shown(); ok(/admin-paytrack/.test(m) && /team-members/.test(m) && /settings/.test(m), 'Admin menu: ' + m); ok(!SETTINGS_SECTIONS.find(function(s){ return s.id === 'danger'; }).can(), 'no danger zone');
      actAs(person('AM M11 Person', AM.id).id); m = shown(); ok(/client-management/.test(m) && /jobs/.test(m) && /approval-center/.test(m) && !/team-members|manager-team|admin-paytrack|paytrack|talent-pool/.test(m), 'Account manager menu: ' + m);
      ok(canI('candidates', 'Send to Client') && !canI('candidates', 'Submit to job') && scopeOf('clients') === 'own' && scopeOf('jobs') === 'own', 'Account manager: send to client, own clients');
      actAs(person('ACC M11 Person', ACC.id).id); m = shown(); ok(/admin-paytrack/.test(m) && !/(^|,)jobs|talent-pool|kairo-team|interviews/.test(m), 'Accounts menu: ' + m);
      ok(['Raise invoice','Record payment','Approve credit','Pay commission'].every(function(a){ return canI('billing', a); }) && canI('contracts', 'View') && canI('clients', 'View Contracts') && !canI('jobs', 'View') && !canI('candidates', 'View') && !canI('kairo', 'Use agents'), 'Accounts: all four billing permissions, no jobs, candidates or Cowork');
      actAs(person('SRC M11 Person', SRC.id).id); m = shown(); ok(/talent-pool/.test(m) && /jobs/.test(m) && !/client-management|approval-center|paytrack/.test(m) && (/kairo-team/.test(m) || !oAgentsOn()), 'Sourcer menu: ' + m);
      ok(!canSubmitToJobs() && !canI('candidates', 'Send to Client') && scopeOf('talentpool') === 'all' && scopeOf('jobs') === 'assigned' && scopeOf('kairo') === 'own', 'Sourcer: no submit, no send; talent pool all; jobs assigned; Cowork own');
      var me = currentActingUser(), mine = { id:'wf-m11-mine', ownerId:me.id, agentId:'sourcing', name:'Mine' }, other = { id:'wf-m11-other', ownerId:'RP-092', agentId:'sourcing', name:'Other' };
      ok(cwWfVisible(mine) && !cwWfVisible(other), 'Cowork: their own workflows, not another person’s');
    });

    await t('a Sourcer saved from the template adds a candidate and opens a job, but still can’t submit, after a reload and a second use too', async function(){
      var SRC = fromTemplate('sourcer', 'Sourcer M12'); ok(SRC && SRC.permissions.candidates.indexOf('Submit to job') < 0, 'saved without Submit to job');
      var u = person('Sourcer M12 Person', SRC.id), j = JOBS.find(function(x){ return x.status === 'Active'; }); (j.assignedRecruiters = j.assignedRecruiters || []).push(u.id);
      for(var use = 1; use <= 2; use++){
        actAs(u.id);
        ok(canPerformAction('CreateManualCandidate', {}).allowed, 'use ' + use + ': can add a candidate');
        var c = { id:nextCandidateId(), name:'Sourced Person ' + use, role:'Engineer', email:'sourced' + use + '@example.com', skills:['—'], organizationId:CURRENT_ORGANIZATION_ID, ownerId:u.id }; CANDIDATES.push(c);
        var box = document.createElement('div'); box.innerHTML = acfJobsHTML(); ok(/doesn’t submit candidates to jobs/.test(box.textContent), 'the add form offers no jobs');
        openJob(j.id); await sleep(10); ok(!jobWsCanSubmit(j), 'use ' + use + ': the job opens, no submit');
        var r = submitOneToJob(j, c, 'Talent Pool', { dryRun:true }); ok(!r.ok && r.code === 'no_permission', 'use ' + use + ': submit refused: ' + r.code);
        submitToJobUpdate();   // what a reload runs
        ok(!roleHasPermission(SRC.id, 'candidates', 'Submit to job'), 'use ' + use + ': still no Submit to job after the load update');
      }
    });

    await t('shared workflows: a Sourcer sees and uses them, but can’t edit, pause or delete them, and a copy never sends as another person', async function(){
      var SRC = CUSTOM_ROLES.find(function(r){ return r.name === 'Sourcer M12'; }) || fromTemplate('sourcer', 'Sourcer M12'), u = person('Sourcer Shared', SRC.id);
      var wf = WORKFLOWS.find(function(w){ cwNormalise(w); return w.ownerId === 'RP-092' && w.agentId === 'linkedin' && (w.limits.senders || []).length; }) || WORKFLOWS.find(function(w){ return w.ownerId !== u.id && w.shared; });
      ok(wf && wf.shared, 'a shared workflow made by someone else');
      actAs(u.id); var st = wf.status, n = WORKFLOWS.length, sendersBefore = JSON.stringify(wf.limits.senders);
      ok(cwWfVisible(wf), 'they see it'); ok(!cwCanEditWf(wf), 'they can’t edit it');
      toasts = []; cwWorkflowToggle(wf.id, st === 'Live' ? 'Paused' : 'Live'); ok(wf.status === st && toasts.some(function(m){ return /Only the owner/.test(m); }), 'can’t pause or resume it');
      cwDelete(wf.id); ok(WORKFLOWS.indexOf(wf) > -1, 'can’t delete it');
      cwDuplicate(wf.id); var copy = WORKFLOWS[0]; ok(WORKFLOWS.length === n + 1 && copy.ownerId === u.id && copy.status === 'Draft', 'use it: their own draft copy');
      var mine = cwLiMine().map(function(a){ return a.id; }); ok(copy.limits.sender !== 'rotate' && (copy.limits.senders || []).every(function(x){ return mine.indexOf(x) > -1; }), 'the copy sends only from their own accounts: ' + JSON.stringify(copy.limits));
      ok(JSON.stringify(wf.limits.senders) === sendersBefore, 'the original is unchanged'); ok(/sending from Sourcer Shared’s own accounts/.test(AUDIT_LOG[0].detail), 'audited: ' + AUDIT_LOG[0].detail);
      WORKFLOWS.splice(0, 1);
    });

    await t('owning the client counts as being on the job for submission approvals; the reporting line still decides', async function(){
      var AM = CUSTOM_ROLES.find(function(r){ return r.name === 'Account manager M11'; }) || fromTemplate('account', 'Account manager M11');
      var am = person('Client Owner AM', AM.id), rec = person('Rec Under AM', 'role_recruiter'); rec.reportingManagerId = am.id;
      var j = JOBS.find(function(x){ return x.status === 'Active' && clientForJob(x); }), cl = clientForJob(j), was = cl.ownerId; cl.ownerId = am.id;
      var rules = j.submissionRules; j.submissionRules = Object.assign({}, rules || {}, { approvalBeforeClient:true });
      try {
        ok(jobPeopleIds(j).indexOf(am.id) < 0 && canSeeApprovalWork(am, { jobId:j.id }), 'not on the job, owns the client: counts');
        ok((submissionReviewerFor(rec, j) || {}).id === am.id, 'the recruiter’s manager who owns the client reviews');
        var other = person('Rec Elsewhere', 'role_recruiter'); ok((submissionReviewerFor(other, j) || {}).id !== am.id, 'a recruiter outside their line does not go to them');
        actAs(am.id); var sb = submissionsForJob(j.id)[0]; ok(!sb || journeyInScope(sb), 'they see the journeys on their client’s jobs');
      } finally { cl.ownerId = was; j.submissionRules = rules; }
    });

    await t('team size 3 vs 12: starting rules set once at sign-up; a later change touches neither Settings nor jobs', async function(){
      var h = WSX.hiring, keep = { preApproval:h.preApproval, distribute:h.distribute, size:ORG_STRUCTURE.profile.teamSize };
      try {
        applyTeamSizeDefaults('1–5', 'Staffing agency'); ORG_STRUCTURE.profile.teamSize = '1–5';
        ok(h.preApproval === false && workspaceRouting() === 'manual', 'team of 3: review off, applicants to the job lead');
        var d = jobCreateDefaults(); ok(d.rules.approvalBeforeClient === false && d.applicantRouting === 'manual', 'a new job takes them');
        as('admin'); var box = document.createElement('div'); box.innerHTML = wsDefaultsHTML(); var defs = box.textContent; ok(/Submission reviewOff for new jobsChange/.test(defs) && /New applicantsGo to the job leadChange/.test(defs), 'shown with Change: ' + defs);
        ok(AUDIT_LOG[0].action === 'Starting rules set from team size' || AUDIT_LOG.some(function(a){ return a.action === 'Starting rules set from team size' && /^1–5/.test(a.detail); }), 'audited');
        var job = JOBS.find(function(x){ return x.status === 'Active'; }), saved = JSON.stringify([job.submissionRules, job.applicantRouting]);
        applyTeamSizeDefaults('6–20', 'Staffing agency'); ORG_STRUCTURE.profile.teamSize = '6–20';
        ok(h.preApproval === true && workspaceRouting() === 'round_robin', 'team of 12: review on, round-robin');
        box.innerHTML = wsDefaultsHTML(); defs = box.textContent; ok(/Submission reviewOn for the Recruiter roleChange/.test(defs) && /New applicantsShared round-robin across the job teamChange/.test(defs), 'shown: ' + defs);
        // later: the Team size sheet only changes the answer
        var sheet = SU_WORKSPACE_SCREENS['team-size']; wsTeamSizeDraft = '1–5'; sheet.save();
        ok(ORG_STRUCTURE.profile.teamSize === '1–5' && h.preApproval === true && workspaceRouting() === 'round_robin', 'a later team-size change never touches Settings');
        ok(JSON.stringify([job.submissionRules, job.applicantRouting]) === saved, 'or existing jobs');
        var corp = { preApproval:h.preApproval, distribute:h.distribute }; ok(applyTeamSizeDefaults('1–5', 'Corporate') === null && h.preApproval === corp.preApproval && h.distribute === corp.distribute, 'corporate: unchanged');
      } finally { h.preApproval = keep.preApproval; h.distribute = keep.distribute; ORG_STRUCTURE.profile.teamSize = keep.size; }
    });

    var pre = document.createElement('pre'); pre.id = 'auth-test-results'; pre.textContent = JSON.stringify(results); document.body.appendChild(pre);
    document.title = 'M11 ' + results.filter(function(r){ return r.pass; }).length + '/' + results.length;
  }, 800); });
})();
