/* M9 step 2a · Contract and temporary staff for agencies (B7 · flow map 16): assignment and time, no money yet.
   Joined on a Contract/Temporary job → the assignment form → an assignment linked to journey, job, client, location and terms;
   the minimum-margin rate approval; the worker's link (own weeks only, revocable, stops at the end); the client approver's link;
   Kairo's flags (holidays, overtime, overlaps, missing days); reminders; CSV import; lifecycle; permissions; corporate untouched.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\m09a-assignments.spec.js */
(function(){
  var results = [];
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  var ce = console.error; console.error = function(){ errs.push('console.error ' + Array.prototype.slice.call(arguments).map(function(a){ return (a && a.stack) || (a && a.message) || String(a); }).join(' ').slice(0, 300)); };
  var toasts = [], t0 = window.toast; window.toast = function(m){ toasts.push(String(m)); return t0.apply(this, arguments); };
  var T0 = 0, D = 86400000, OWNER = 'RP-088', seq = 0;
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e.stack || e.message).slice(0, 500) }); }
    finally { asOwner(); ORG_STRUCTURE.profile.orgType = 'Agency'; FM.offset = T0; fmModal(''); if(typeof pdClose === 'function') pdClose(); CO.pg = null; } }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function asOwner(){ viewingAsFromManager = false; managerViewAsRecruiterId = null; previewAsRoleId = null; state.role = 'admin'; }
  function actAs(id){ if(id === OWNER) return asOwner(); state.role = 'manager'; viewingAsFromManager = true; managerViewAsRecruiterId = id; previewAsRoleId = null; }
  function audit(re){ return AUDIT_LOG.some(function(a){ return re.test((a.action || '') + ' ' + (a.detail || '')); }); }
  function person(name, roleId){ seq++; var u = { id:'M9-' + seq, name:name, email:'m9.' + seq + '@northstartalent.com', assignedRoleId:roleId, reportingManagerId:OWNER, organizationId:CURRENT_ORGANIZATION_ID, userStatus:'Active' }; RECRUITER_ROSTER.push(u); return u; }
  function mkJob(type, client){ seq++; var cl = CLIENTS.find(function(x){ return x.name === (client || 'Fintech Corp'); });
    var j = { id:'m9j' + seq, title:'Contract Role ' + seq, client:cl.name, clientId:cl.id, loc:'Pune, IN', locations:['Pune, IN'], status:'Active', priority:'Medium', recruiter:'Priya Sharma', recruiterId:null, hiringType:type || 'Contract', contractMonths:6,
      assignedRecruiters:[OWNER], skills:['Java'], positions:3, submitted:0, candidateIds:[], interested:[], recs:[], publishChannels:[], organizationId:CURRENT_ORGANIZATION_ID, salary:'₹10–20 LPA', workMode:'On-site', replacementDays:90,
      submissionRules:{ approvalBeforeClient:false, hideContacts:true, maxProfiles:5, required:[] } }; JOBS.push(j); return j; }
  function mkCand(name){ seq++; var c = { id:99800 + seq, name:name || ('Contract Worker ' + seq), role:'Engineer', exp:'5 yrs', loc:'Pune, IN', skills:['Java'], email:'m9c' + seq + '@example.com', phone:'+91 97800 ' + String(10000 + seq), salary:'₹10–12 LPA', notice:'15 Days', organizationId:CURRENT_ORGANIZATION_ID }; CANDIDATES.push(c); return c; }
  function journey(j, c){ var sb = createSubmission(j.id, c.id, { source:'Sourced', recruiterId:OWNER, stage:'Shortlisted', reason:'test' }); sb.sent = { at:new Date(fmNow() - 30 * D).toISOString(), by:'Test' }; return sb; }
  var iso = function(ms){ return ptLocalDay(new Date(ms)); };
  // An assignment started 60 days ago for 120 days, through the real form.
  function start(o){ o = o || {}; var j = o.job || mkJob(o.type), c = o.cand || mkCand(), sb = journey(j, c);
    ptCreateJoinedRecord(c.name, j.title, j.client, j.id, '', { submissionId:sb.id, joinedIso:iso(fmNow()) });
    Object.assign(asForm, { start:iso(o.start || fmNow() - 60 * D), end:iso(o.end || fmNow() + 60 * D), unit:'day', payRate:o.pay || '2000', markupPct:o.markup == null ? '25' : o.markup, billRate:o.bill || '', tracking:o.tracking || asForm.tracking, approverName:'Ravi Menon', approverEmail:'ravi@fintech.example' });
    asFormSave(); var a = asForJourney(sb); ok(a, 'assignment created ' + (document.getElementById('fm-modal-root') || {}).textContent); return { a:a, sb:sb, j:j, c:c }; }
  function wk(n){ return coMonday(fmNow()) - n * 7 * D; }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    state.role = 'admin'; enterApp(); await sleep(100); FM.interactive = false; T0 = FM.offset;

    await t('Joined on a Contract job opens the assignment form; the assignment links journey, job, client, location and terms; no placement', async function(){
      var j = mkJob('Contract'), c = mkCand(), sb = journey(j, c), n = ptAllRecords().length;
      var r = ptCreateJoinedRecord(c.name, j.title, j.client, j.id, '', { submissionId:sb.id, joinedIso:iso(fmNow()) });
      ok(r === null && /starts on assignment/.test(document.getElementById('fm-modal-root').textContent) && asForm && asForm.subId === sb.id, 'the form opens instead of a placement');
      Object.assign(asForm, { payRate:'2000', markupPct:'20', unit:'day', approverName:'Ravi Menon' }); asFormSave();
      var a = asForJourney(sb), cl = clientById(j.clientId); ok(a && a.status === 'Active' && a.kind === 'Contract' && a.jobId === j.id && a.clientId === cl.id && a.locationId === clBillingLocations(cl)[0].id && a.termsVersion === clCommercial(cl).version, 'linked');
      ok(a.rates[0].pay === 2000 && a.rates[0].bill === 2400 && a.rates[0].markupPct === 20, 'bill = pay × 1.2');
      ok(sb.stage === 'Joined' && ptAllRecords().length === n && !ptForJourney(sb), 'journey Joined, no placement');
      ok(audit(/Assignment created/) && a.token && a.tracking === 'hours', 'audited, worker link');
      var tmp = start({ type:'Temporary' }).a; ok(tmp.kind === 'Temporary' && tmp.tracking === 'days', 'Temporary tracks days by default');
      var typed = start({ markup:'', bill:'2600' }).a; ok(typed.rates[0].bill === 2600 && typed.rates[0].markupPct === null, 'a typed bill rate');
    });

    await t('a margin below the client’s minimum goes through the approval engine (contracts · Approve rates)', async function(){
      var x = start({ markup:'5' }), a = x.a, req = APPROVAL_REQUESTS.find(function(r){ return r.entityType === 'AssignmentRate' && r.entityId === a.id; });
      ok(a.status === 'Pending approval' && req && req.status === 'Pending' && a.rates[0].status === 'Pending approval', 'waiting: margin ' + req.context.margin + '% below ' + req.context.min + '%');
      var admin = person('Admin For Rates', 'role_admin'); actAs(admin.id); ok(canI('contracts', 'Manage') && !canI('contracts', 'Approve rates'), 'Admin: View and Manage only'); decideApproval(req.id, 'Approved'); ok(req.status === 'Pending', 'Admin cannot approve');
      asOwner(); decideApproval(req.id, 'Approved'); ok(req.status === 'Approved' && a.status === 'Active' && a.rates[0].status === 'Active' && audit(/Rate approved/), 'approved by the Owner');
      var ok2 = start({ markup:'15' }).a; ok(ok2.status === 'Active', '15% markup is a 13% margin, above 10%: no approval');
    });

    await t('the worker link: own weeks only, time per day with real dates, revocable, stops at the end', async function(){
      var x = start(), a = x.a, other = start().a; asSubmitWeek(other, wk(2), [8,8,8,8,8,0,0]);
      CO.pg = { kind:'time', arg:a.token, draft:{}, result:null }; var page = coTimePage();
      ok(page.indexOf(a.workerName.split(' ')[0]) > -1 && page.indexOf(other.workerName) === -1 && page.indexOf(a.ref) > -1, 'their page');
      CO.pg.draft = { week:String(wk(1)), h0:'8', h1:'8', h2:'8', h3:'8', h4:'8', h5:'0', h6:'0' }; var r = asTimeDo(); var sh = r.sheet;
      ok(r.ok && sh.dates.length === 7 && sh.dates[0] === iso(wk(1)) && sh.dates[6] === iso(wk(1) + 6 * D) && sh.total === 40 && sh.status === 'Submitted', 'per day with real dates');
      ok(!/week of/.test(asTimePage(a)) || asTimePage(a).indexOf(asFmt(wk(2))) === -1 || !asSheetFor(a, wk(2)), 'only their weeks');
      var old = a.token, fresh = asReissueToken(a.id); CO.pg = { kind:'time', arg:old, draft:{}, result:null }; ok(/This link does not work/.test(coTimePage()), 'the old link stops');
      CO.pg = { kind:'time', arg:fresh, draft:{}, result:null }; ok(/Hi /.test(coTimePage()), 'the new one works');
      asEnd(a.id, 'Project closed', {}); FM.offset = T0 + 70 * D; fmSlaSweep(); ok(a.status === 'Ended' || a.status === 'Terminated', 'ended: ' + a.status);
      CO.pg = { kind:'time', arg:fresh, draft:{}, result:null }; ok(/can no longer send time/.test(coTimePage()), 'stops at the end');
    });

    await t('the client approver’s one-tap link: approve, or send back with a comment', async function(){
      var a = start().a, r = asSubmitWeek(a, wk(1), [8,8,8,8,8,0,0]), sh = r.sheet; ok(sh.okToken && audit(/Approval link sent .+Ravi Menon/), 'link sent to the approver');
      CO.pg = { kind:'timeok', arg:sh.okToken, draft:{}, result:null }; ok(asOpensOutside(CO.pg) && /Approve/.test(asApprovePage()) && asApprovePage().indexOf(a.workerName) > -1, 'the page, no login');
      var no = asApproveDo(false); ok(!no.ok && /Say what to correct/.test(no.reason) && sh.status === 'Submitted', 'a comment is needed to send back');
      coPgDraw(); var box = document.querySelector('#co-root [data-d="note"]'); if(box) box.value = 'Friday was a half day'; else CO.pg.draft = { note:'Friday was a half day' }; ok(asApproveDo(false).ok && sh.status === 'Rejected' && audit(/Time sent back .+Friday was a half day/), 'sent back');
      var again = asSubmitWeek(a, wk(1), [8,8,8,8,4,0,0]); ok(again.ok && again.sheet === sh && sh.status === 'Submitted', 'the worker sends it again');
      CO.pg = { kind:'timeok', arg:sh.okToken, draft:{}, result:null }; ok(asApproveDo(true).ok && sh.status === 'Approved' && sh.decidedBy === 'Ravi Menon', 'approved');
      ok(/Approved/.test(asApprovePage()), 'the link then shows the decision');
    });

    await t('Kairo flags holidays (workspace and location), overtime 9 h / 48 h, overlaps and missing days, and never blocks', async function(){
      var x = start(), a = x.a, w = wk(2), wed = iso(w + 2 * D); asAddLocationHoliday(a.clientId, a.locationId, wed);
      var r = asSubmitWeek(a, w, [10,10,8,10,12,0,0]), f = r.sheet.flags.map(function(z){ return z.kind + ':' + z.text; }).join(' | ');
      ok(r.ok && /holiday/.test(f) && /overtime:Over 9 hours on/.test(f) && /Over 48 hours this week \(50\)/.test(f), 'holiday and overtime: ' + f);
      ok(asHolidays(a).indexOf('2026-12-25') > -1, 'the workspace list is included');
      var b = start({ cand:x.c, job:mkJob('Contract') }).a, r2 = asSubmitWeek(b, w, [8,0,0,0,0,0,0]); ok(r2.ok && r2.sheet.flags.some(function(z){ return z.kind === 'overlap'; }) && r2.sheet.flags.some(function(z){ return z.kind === 'missing'; }), 'overlap and missing days: ' + r2.sheet.flags.map(function(z){ return z.text; }).join('; '));
    });

    await t('reminders when time or an approval is late', async function(){
      var a = start().a, w = asSubmitWeek(a, wk(2), [8,8,8,8,8,0,0]).sheet;
      FM.offset = T0 + 3 * D; if(fmNow() - coMonday(fmNow()) <= 2 * D) FM.offset += 2 * D;   // past the week's 2 days' grace, whichever weekday the suite runs on
      fmSlaSweep(); ok(audit(new RegExp('Time reminder sent to the worker .+' )) && a.alerts.time, 'the worker is reminded');
      ok(w.remindedAt && audit(/Approval reminder sent to the client .+Ravi Menon/), 'the approver is reminded');
    });

    await t('attendance import: checked row by row before anything is imported; imported days go through the same checks and approval', async function(){
      var x = start({ tracking:'attendance' }), a = x.a, month = iso(wk(2)).slice(0, 7), d1 = iso(wk(2)), d2 = iso(wk(2) + D), n = ASSIGNMENT_SHEETS.length;
      var bad = asImport(a.clientId, month, 'worker,date,hours\n' + a.workerName + ',' + d1 + ',8\nNobody Here,' + d1 + ',8\n' + a.workerName + ',2026-13-40,8\n' + a.workerName + ',' + d2 + ',30');
      ok(!bad.ok && bad.errors.length === 3 && ASSIGNMENT_SHEETS.length === n && /No running assignment/.test(bad.errors[0].reason) && /YYYY-MM-DD/.test(bad.errors[1].reason) && /0 to 16/.test(bad.errors[2].reason), 'errors before import: ' + JSON.stringify(bad.errors.map(function(e){ return e.row + ' ' + e.reason; })));
      var good = asImport(a.clientId, month, a.workerName + ',' + d1 + ',8\n' + a.workerName + ',' + d2 + ',11'); var sh = asSheetFor(a, coMonday(asMs(d1)));
      ok(good.ok && sh && sh.source === 'import' && sh.imported[0] && sh.imported[1] && sh.status === 'Submitted' && sh.flags.some(function(f){ return f.kind === 'overtime'; }), 'imported, flagged: ' + JSON.stringify({ good:good, sh:sh && { source:sh.source, imp:sh.imported, status:sh.status, flags:sh.flags } }));
      CO.pg = { kind:'timeok', arg:sh.okToken, draft:{}, result:null }; ok(/Imported/.test(asApprovePage()), 'the approver sees “Imported”');
    });

    await t('lifecycle: 30-day alert, extend, a rate change from a date (approval when below the minimum), early end with notice; “On assignment until”', async function(){
      var x = start({ end:fmNow() + 20 * D }), a = x.a; fmSlaSweep(); ok(a.alerts.end && audit(/Kairo: 30 days before the end/), 'alert');
      ok(asExtend(a.id, iso(fmNow() + 100 * D), 'Client extended the project').ok && a.status === 'Extended' && a.end === asMs(iso(fmNow() + 100 * D)), 'extended');
      var ch = asChangeRate(a.id, { from:iso(fmNow() + 5 * D), payRate:2200, markupPct:5 }); ok(ch.ok && ch.needsApproval && ch.rate.status === 'Pending approval', 'below the minimum: waits');
      decideApproval(APPROVAL_REQUESTS.filter(function(r){ return r.entityType === 'AssignmentRate' && r.entityId === a.id; }).pop().id, 'Approved');
      ok(asRateOn(a, fmNow()).pay === 2000 && asRateOn(a, fmNow() + 6 * D).pay === 2200, 'applies from its date');
      ok(/On assignment until/.test(document.createElement('div').textContent = jobPipelineHealthStripHTML(x.j)) && candidatePipelineEntries(x.c).some(function(e){ return /^On assignment until /.test(e.nextAction || ''); }), 'job page and candidate');
      var e = asEnd(a.id, 'Client cut the budget', {}); ok(e.ok && e.early && a.status === 'Extended', 'notice running: still on assignment until ' + asFmt(e.lastDay));
      FM.offset = T0 + (a.noticeDays + 2) * D; fmSlaSweep(); ok(a.status === 'Terminated' && audit(/Assignment terminated/), 'terminated after the notice');
    });

    await t('permissions: defaults; recruiters see the pay rate only; a company workspace is untouched', async function(){
      var x = start(), a = x.a, rec = person('Pay Only Recruiter', 'role_recruiter'), rm = person('Contracts RM', 'role_recmgr');
      actAs(rec.id); ok(canI('contracts', 'View') && !canI('contracts', 'Manage') && !canI('contracts', 'Approve rates'), 'Recruiter: View'); var p = asPanelHTML(a);
      ok(/Pay rate/.test(p) && !/Bill rate|Margin/.test(p), 'pay only'); ok(!createAssignment(x.sb, {}).ok, 'cannot set up');
      actAs(rm.id); ok(canI('contracts', 'View') && !canI('contracts', 'Manage'), 'Recruiter Manager: View');
      asOwner(); ok(canI('contracts', 'Approve rates') && /Bill rate/.test(asPanelHTML(a)) && /Margin/.test(asPanelHTML(a)), 'Owner: everything, money shown');
      ORG_STRUCTURE.profile.orgType = 'Corporate'; ok(!sModulesForOrg().some(function(m){ return m.id === 'contracts'; }) && !relevantModulesForOrgType('Corporate').some(function(m){ return m.id === 'contracts'; }), 'not a corporate module');
      coSeedCorp(true); var wo = coWoCreate({ contractor:'Corp Person', email:'corp.person@x.example', role:'Data Analyst', approver:'Suresh Iyer', start:coIso(coNow() - 20 * D), end:coIso(coNow() + 40 * D), rate:900, unit:'hour', sow:'Analysis' });
      ok(wo.ok && coSheetSubmit(wo.wo.id, coMonday(coNow()) - 7 * D, [8,8,8,8,8,0,0]).ok && !ASSIGNMENTS.some(function(z){ return z.token === wo.wo.token; }), 'corporate work orders as before');
      CO.pg = { kind:'time', arg:wo.wo.token, draft:{}, result:null }; ok(/Hours for a week/.test(coTimePage()), 'the corporate time page as before');
    });

    await t('rate privacy on every page: approver link, worker link, Recruiter and Recruiter Manager screens, Approvals, notices, audit; team and own scope', async function(){
      var rm = person('Privacy RM', 'role_recmgr'), r1 = person('Privacy Recruiter One', 'role_recruiter'), r2 = person('Privacy Recruiter Two', 'role_recruiter'); r1.reportingManagerId = rm.id;
      var j = mkJob('Contract'); j.assignedRecruiters = [OWNER, rm.id, r1.id, r2.id];
      var mk = function(owner, markup){ var c = mkCand(), sb = createSubmission(j.id, c.id, { source:'Sourced', recruiterId:owner, stage:'Shortlisted', reason:'test' }); sb.sent = { at:new Date(fmNow() - 30 * D).toISOString(), by:'Test' };
        ptCreateJoinedRecord(c.name, j.title, j.client, j.id, '', { submissionId:sb.id }); Object.assign(asForm, { start:iso(fmNow() - 60 * D), end:iso(fmNow() + 60 * D), unit:'day', payRate:'1234', markupPct:markup, billRate:'', approverName:'Ravi Menon' }); asFormSave(); return { sb:sb, c:c, a:asForJourney(sb) }; };
      var mine = mk(r1.id, '25'), theirs = mk(r2.id, '5'), bill = String(mine.a.rates[0].bill), billLow = String(theirs.a.rates[0].bill);   // 1542.5 and 1295.7
      var sh = asSubmitWeek(mine.a, wk(1), [10,8,8,8,8,0,0]).sheet;
      var money = function(s){ return s.indexOf(bill) > -1 || s.indexOf(billLow) > -1 || /margin[^a-z]*\d|bill rate|\d+(\.\d+)?% margin/i.test(s); };
      var text = function(h){ var d = document.createElement('div'); d.innerHTML = h; return d.textContent; };
      CO.pg = { kind:'timeok', arg:sh.okToken, draft:{}, result:null }; var ap = text(asApprovePage()); ok(!money(ap) && ap.indexOf('1234') === -1 && /Kairo noted/.test(ap), 'approver page: time, dates and flags only');
      CO.pg = { kind:'time', arg:mine.a.token, draft:{}, result:null }; var wp = text(coTimePage()); ok(!money(wp), 'worker page: no bill rate or margin');
      [r1, rm].forEach(function(u){ actAs(u.id);
        var strip = text(jobPipelineHealthStripHTML(j)), cand = JSON.stringify(candidatePipelineEntries(mine.c)), panel = text(asPanelHTML(mine.a));
        ok(!money(strip) && !money(cand) && !money(panel) && /Pay rate/.test(panel), u.name + ': job page, candidate, drawer: pay only');
        openPipelineDetail(mine.sb.id); var dr = (document.getElementById('pd-panel') || {}).textContent || ''; pdClose(); ok(!money(dr), u.name + ': the journey drawer');
        var rows = apNeedsRows().concat(apWaitingRows(), apDecidedRows()).map(function(r){ return (r.name || '') + ' ' + (r.line || ''); }).join(' | '); ok(!money(rows), u.name + ': Approvals: ' + rows.slice(0, 200));
        ok(!FM.notices.some(function(n){ return money(n.text); }), u.name + ': notifications');
        ok(!AUDIT_LOG.some(function(a){ return money((a.action || '') + ' ' + (a.detail || '')); }), u.name + ': audit log text');
        ok(strip.indexOf(mine.c.name) > -1 && strip.indexOf(theirs.c.name) === -1, u.name + ': only ' + (u === rm ? 'their team’s' : 'their own') + ' assignments on the job page');
        ok(!candidatePipelineEntries(theirs.c).some(function(e){ return e.assignmentId; }), u.name + ': not someone else’s on the candidate'); });
      asOwner(); var own = apNeedsRows().find(function(r){ return r.req && r.req.entityType === 'AssignmentRate' && r.req.entityId === theirs.a.id; });
      ok(own && money(own.line) && own.line.indexOf(billLow) > -1, 'the Owner sees the rate request in Approvals, with the money: ' + (own && own.line));
    });

    await t('converted, ended or terminated: the approver’s link stops, except for a week still waiting, which can still be decided', async function(){
      ['convert', 'end', 'terminate'].forEach(function(how){
        var a = start().a, done = asSubmitWeek(a, wk(2), [8,8,8,8,8,0,0]).sheet, waiting = asSubmitWeek(a, wk(1), [8,8,8,8,8,0,0]).sheet; asDecideWeek(done, true, '', 'Ravi Menon');
        if(how === 'convert') ok(asConvert(a.id, { ctcLakh:12 }).ok, 'converted'); else { asEnd(a.id, 'Done', how === 'end' ? { lastDay:iso(a.end) } : {}); a.end = Math.min(a.end, fmNow() - D); if(a.ending) a.ending.lastDay = Math.min(a.ending.lastDay, fmNow() - D); fmSlaSweep(); }
        ok(['Converted','Ended','Terminated'].indexOf(a.status) > -1, how + ': ' + a.status);
        CO.pg = { kind:'timeok', arg:done.okToken, draft:{}, result:null }; ok(/This link no longer works/.test(asApprovePage()), how + ': a decided week’s link stops');
        CO.pg = { kind:'timeok', arg:waiting.okToken, draft:{}, result:null }; ok(/Approve/.test(asApprovePage()) && asApproveDo(true).ok && waiting.status === 'Approved', how + ': the waiting week can still be decided');
      });
    });

    var pre = document.createElement('pre'); pre.id = 'auth-test-results'; pre.textContent = JSON.stringify(results); document.body.appendChild(pre);
    document.title = 'M09A ' + results.filter(function(r){ return r.pass; }).length + '/' + results.length;
  }, 800); });
})();
