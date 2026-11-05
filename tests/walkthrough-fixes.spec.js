/* Fixes from the demo-guide walk-through (K1–K15). Each test names its item.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\walkthrough-fixes.spec.js */
(function(){
  var results = [];
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  var ce = console.error; console.error = function(){ errs.push('console.error ' + Array.prototype.slice.call(arguments).map(function(a){ return (a && a.stack) || (a && a.message) || String(a); }).join(' ').slice(0, 300)); };
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e && e.stack || e).slice(0, 600) }); } }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function roleOf(u){ return (CUSTOM_ROLES.find(function(r){ return r.id === u.assignedRoleId; }) || {}).name; }
  function byName(n){ return RECRUITER_ROSTER.find(function(u){ return u.name === n; }); }
  function menu(){ NAV_GROUP_OPEN = { Insights:true }; sidebarMoreOpen = true; renderSidebar(); return [].map.call(document.querySelectorAll('#sidebar-nav .nav-item'), function(b){ return b.getAttribute('data-nav'); }); }
  function main(){ return document.getElementById('main-content').textContent.replace(/\s+/g, ' '); }
  function q(s){ return document.querySelector(s); }
  // K4: every invoice and credit note number in the workspace, and the prefix its Settings carry.
  function invoiceNos(){ var nos = []; ptMoneyRecords().forEach(function(r){ ptInvoicesOf(r).forEach(function(h){ var i = h.invoice || h; if(i && i.no) nos.push(i.no); ((i && i.credits) || []).forEach(function(c){ nos.push(c.no); }); }); }); return nos; }
  // K6: the seats shown come from the workspace's plan and fit its team; Enterprise has no cap.
  function checkSeats(label, plan, limit){
    var tn = tenantById(CURRENT_ORGANIZATION_ID), sub = ORG_STRUCTURE.subscription, n = RECRUITER_ROSTER.length;
    ok(tn.planId === plan && sub.seatsIncluded === limit, label + ': ' + tn.planId + ', seats ' + sub.seatsIncluded);
    ok(limit === null || n <= limit, label + ': team of ' + n + ' fits ' + limit + ' seats');
    demoAct(demoOwnerOf().id); showView(homeForMe()); var m = main().match(/(\d+) of (\d+) user seats/);
    ok(!m || +m[1] <= +m[2], label + ': Home says ' + (m && m[0]));
    if(limit === null) ok(!m, label + ': no seat alert on an unlimited plan');
  }
  // K7: Owner Home's Jobs at risk: days open from the created date, recruiter = lead or team, "late" only when a profile waits 5+ days.
  function checkRisk(label){
    demoAct(demoOwnerOf().id); showView(homeForMe());
    var rows = [].slice.call(document.querySelectorAll('tr[onclick^="openJob("]')).filter(function(tr){ return /Client feedback is late|No recruiter yet|No submissions yet|days with no interviews/.test(tr.textContent); });
    var open = JOBS.filter(function(j){ return j.status === 'Active'; }).length, late = 0;
    rows.forEach(function(tr){ var id = tr.getAttribute('onclick').match(/openJob\('([^']+)'/)[1], j = jobById(id), cells = tr.querySelectorAll('td'), txt = tr.textContent;
      var days = Math.floor((Date.now() - new Date(j.createdAt).getTime()) / 86400000);
      ok(j.createdAt && cells[3].textContent.trim() === days + ' d', label + ' ' + j.title + ': days open ' + cells[3].textContent + ' vs created ' + days + ' days ago');
      var people = jobPeopleIds(j).map(function(x){ var u = rosterById(x); return u && u.name; });
      ok(people.some(function(n){ return n && cells[2].textContent.indexOf(n) > -1; }), label + ' ' + j.title + ': recruiter ' + cells[2].textContent.trim() + ' is the lead or team');
      if(/Client feedback is late/.test(txt)){ late++;
        ok(submissionsForJob(j.id).some(function(sb){ var si = subSentInfo(sb); return subPhase(sb) === 'client' && !sb.hold && si && (Date.now() - new Date(si.lastChaseAt || si.at).getTime()) >= 5 * 86400000; }), label + ' ' + j.title + ': late, but no profile waits 5+ days'); } });
    ok(late < Math.max(2, open * 0.25), label + ': ' + late + ' of ' + open + ' open jobs "late" (only the really overdue)');
    return { rows:rows.length, late:late };
  }
  function checkPrefix(label, want){
    ok(String(WSX.terms.invoicePrefix).replace(/-$/, '') === want, label + ': Settings prefix ' + WSX.terms.invoicePrefix);
    var nos = invoiceNos(), bad = nos.filter(function(n){ return n.replace(/^CN-/, '').indexOf(want + '-') !== 0; });
    ok(nos.length > 0 && !bad.length, label + ': ' + nos.length + ' numbers, off-prefix ' + bad.slice(0, 5).join());
    var first = nos.filter(function(n){ return /^[A-Z]+-\d\d-\d\d\/0001$/.test(n); }); ok(first.length >= 1, label + ': numbering starts at 0001 for this workspace');
  }
  // Salary ranges and LPA figures are candidate pay, not company money.
  var SALARY = /₹\s?[0-9.,]+\s*(L|K)?\s*(–|-|to)\s*₹?\s?[0-9.,]+\s*(LPA|L|K)?|₹\s?[0-9.,]+\s*(L\s*)?LPA/g;
  // K2: no ₹ on Home for anyone without billing · View.
  function homeMoneyLeaks(){
    var bad = [];
    RECRUITER_ROSTER.forEach(function(u){ demoAct(u.id); if(canI('billing', 'View')) return;
      var home = homeForMe(); showView(home); var txt = main().replace(SALARY, ''), m = txt.match(/₹[^.]{0,40}/);
      if(m) bad.push(u.name + ' (' + roleOf(u) + ', ' + home + '): ' + m[0]); });
    return bad;
  }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var t0 = window.toast; window.toast = function(){};

    await t('K15: Schedule interview — Cancel, × and Escape each close the dialog', async function(){
      var sb = SUBMISSIONS.find(function(s){ return !s.closed && jobById(s.jobId) && byId(s.candidateId); }); ok(sb, 'a live journey');
      var open = function(){ pipeOpenSchedule(sb.id); ok(q('#iv-root') && q('#iv-root').innerHTML, 'dialog opens'); };
      var shut = function(how){ ok(!q('#iv-root').innerHTML && ivState === null, how + ' closes the dialog'); };
      open(); [].find.call(document.querySelectorAll('#iv-root button'), function(b){ return b.textContent.trim() === 'Cancel'; }).click(); shut('Cancel');
      open(); q('#iv-root button[aria-label="Close"]').click(); shut('×');
      open(); document.dispatchEvent(new KeyboardEvent('keydown', { key:'Escape', bubbles:true })); shut('Escape');
      ok(typeof ivClose === 'function' && /IV\.open/.test(String(ivClose)), 'the interview sheet keeps its own ivClose');
    });

    demoBuild('northstar');
    await t('K4: Northstar invoices are NST-', async function(){ checkPrefix('Northstar', 'NST'); });
    await t('K6: Northstar seats — Growth, 15', async function(){ checkSeats('Northstar', 'plan-growth', 15); });
    await t('K7: Northstar Jobs at risk follows the same rules', async function(){ checkRisk('Northstar'); });

    demoBuild('kesar');
    await t('K4: Kesar invoices are KSR-, numbered from its own 0001', async function(){ checkPrefix('Kesar', 'KSR');
      WSX.terms.invoicePrefix = 'KS2-'; ok(ptNextNo('INV').indexOf('KS2-') === 0, 'a changed prefix in Settings numbers the next invoice'); WSX.terms.invoicePrefix = 'KSR-'; });
    await t('K6: Kesar seats — Starter, 3', async function(){ checkSeats('Kesar', 'plan-starter', 3); });
    await t('K5: Kesar — careers-page applicant Nikhil Joshi is Raj’s (the job lead) and inside the applicant SLA', async function(){
      var c = CANDIDATES.find(function(x){ return x.name === 'Nikhil Joshi'; }), sb = SUBMISSIONS.find(function(x){ return x.candidateId === c.id; }), j = jobById(sb.jobId);
      ok(rosterById(j.jobLeadId).name === 'Raj Patel' && rosterById(sb.recruiterId).name === 'Raj Patel', 'owner ' + rosterById(sb.recruiterId).name + ', lead ' + rosterById(j.jobLeadId).name);
      ok(journeyStatus(sb).key === 'applied' && !sb.slaReassigned, 'still a new applicant, never moved by the SLA');
      FM.interactive = false; fmSlaSweep(); FM.interactive = true; ok(rosterById(sb.recruiterId).name === 'Raj Patel', 'a sweep leaves him with Raj');
    });
    // K17: everything that prints the agency's name uses this workspace's name
    var brandCheck = function(label, brand, legal){
      demoSignIn(demoOwnerOf().id); var bad = [];
      [['pipeAgency', pipeAgency()], ['agencyBranding', agencyBranding.name], ['signature', WSX.profile.signature], ['consent text', WSX.security.consentText], ['sidebar', document.getElementById('ws-name').textContent],
        ['menu title', (ROLE_META[state.role] || {}).title], ['legal entity', ORG_STRUCTURE.legalEntities.filter(function(l){ return l.primary; }).map(function(l){ return l.name; }).join()]]
        .forEach(function(x){ if(String(x[1]).indexOf(brand) < 0 && !(x[0] === 'legal entity' && x[1] === legal)) bad.push(x[0] + ': ' + x[1]); if(/Northstar/.test(x[1])) bad.push(x[0] + ' says Northstar'); });
      ok(!bad.length, label + ': ' + bad.join(' | '));
      var sb = SUBMISSIONS.find(function(x){ return subPhase(x) === 'ready' && consentOk(x) && canSendToClient(jobById(x.jobId)); }); openSendToClient([sb.id]);
      var pv = document.getElementById('cs-preview').textContent; csClose(); ok(pv.indexOf('Regards,') > -1 && pv.indexOf(brand) > -1 && !/Northstar/.test(pv), label + ': the email is signed ' + pv.split('Regards,')[1]);
      var k = SUBMISSIONS.find(function(x){ return x.consent && x.consent.token; }), page = consentPageHTML(k); ok(page.indexOf(brand) > -1 && !/Northstar/.test(page), label + ': the consent page');
      var msg = CANDIDATE_TOUCHES.filter(function(t){ return t.consentToken; }).pop(); ok(msg && msg.text.indexOf(brand) > -1 && !/Northstar/.test(msg.text), label + ': the WhatsApp and email to the candidate');
    };
    await t('K17: Kesar — the email signature, consent page, messages, menu and legal entity say Kesar Staffing, never Northstar', async function(){
      brandCheck('Kesar', 'Kesar Staffing', 'Kesar Staffing Services LLP');
      var raj = byName('Raj Patel'); demoSignIn(raj.id); var pfJob = JOBS.find(function(j){ return j.client === 'Patel Foods' && j.status === 'Active'; });
      var sb = SUBMISSIONS.find(function(x){ return x.jobId === pfJob.id && subPhase(x) === 'ready' && consentOk(x); });
      if(sb){ openSendToClient([sb.id]); var pv = document.getElementById('cs-preview').textContent; csClose(); ok(/Regards,\s*Raj Patel\s*Kesar Staffing/.test(pv), 'Raj to Patel Foods: ' + pv.split('Regards,')[1]); }
      ORG_STRUCTURE.profile.brandName = 'Kesar Talent'; ok(WSX.profile.signature.indexOf('Kesar Talent') > -1 && pipeAgency() === 'Kesar Talent' && ROLE_META[state.role].title === 'Kesar Talent', 'a rename in Settings follows everywhere');
      ORG_STRUCTURE.profile.brandName = 'Kesar Staffing';
    });

    // U1 (K16): the Applicants list and consent, as Raj on Patel Foods
    var btnIn = function(root, re){ return root ? [].find.call(root.querySelectorAll('button'), function(b){ return re.test(b.textContent.trim()); }) : null; };
    var rowOf = function(name){ return [].find.call(document.querySelectorAll('#job-cand-workspace li'), function(li){ return li.textContent.indexOf(name) > -1; }); };
    var raj = byName('Raj Patel'), pf = JOBS.find(function(j){ return j.client === 'Patel Foods' && j.status === 'Active'; });
    var freshApplicant = function(){ return SUBMISSIONS.filter(function(x){ return x.jobId === pf.id && x.recruiterId === raj.id && subPhase(x) === 'applied' && !x.consent; })[0]; };
    var openApplicants = function(){ openJob(pf.id); refreshJobWorkspace(pf.id, 'applicants'); };
    await t('U1: Shortlist from the Applicants list; the row says “Waiting for <name>’s yes”, with Record call and Open as', async function(){
      demoSignIn(raj.id); openApplicants(); var sb = freshApplicant(), c = byId(sb.candidateId), first = pipeFirst(c);
      var row = rowOf(c.name); ok(row && /Asks .+ to agree, then you can send/.test(row.textContent), 'the Shortlist hint');
      btnIn(row, /^Shortlist$/).click(); row = rowOf(c.name);
      ok(subPhase(sb) === 'ready' && sb.consent && sb.consent.state === 'pending', 'shortlisted, asked: ' + sb.stage + ' / ' + consentState(sb));
      ok(/Waiting for .+’s yes/.test(row.textContent) && !/Ready to send/.test(row.textContent), 'row: ' + row.textContent.replace(/\s+/g, ' ').slice(0, 200));
      ok(btnIn(row, /^Record call$/) && btnIn(row, new RegExp('^Open as ' + first + '$')), 'row buttons Record call and Open as ' + first);
      openSendToClient([sb.id]); var foot = document.getElementById('cs-foot');
      ok(document.getElementById('cs-send').getAttribute('aria-disabled') === 'true' && /hasn’t agreed yet/.test(foot.textContent) && btnIn(foot, new RegExp('^Open as ' + first + ' \\(demo\\)$')) && btnIn(foot, /^Record call$/), 'send dialog footer: ' + foot.textContent.replace(/\s+/g, ' '));
      csClose(); window.__u1 = sb.id;
    });
    await t('U1: Open as the candidate from the drawer, tap Yes, Back to app: the drawer says Agreed, the row says Ready to send with Send to client', async function(){
      var sb = subById(window.__u1), c = byId(sb.candidateId); openApplicants(); openPipelineDetail(sb.id);
      btnIn(document.getElementById('pd-consent'), /^Open as .+ \(demo\)$/).click(); await sleep(60);
      ok(location.hash === '#/consent/' + sb.consent.token && /Tap Yes to agree/.test(document.getElementById('co-root').textContent), 'the consent page opens: ' + location.hash);
      btnIn(document.getElementById('co-root'), /^Yes$/).click(); ok(sb.consent.state === 'given', 'agreed');
      btnIn(document.getElementById('co-root'), /^Back to app$/).click(); await sleep(60);
      ok(!location.hash && document.getElementById('pd-root').innerHTML && /Agreed on/.test(document.getElementById('pd-consent').textContent), 'back in the same drawer: ' + (document.getElementById('pd-consent') || {}).textContent);
      ok(jobWs.tab === 'applicants' && state.activeNav === 'jobs', 'back on the same job and tab');
      pdClose(); var row = rowOf(c.name); ok(/Ready to send/.test(row.textContent) && btnIn(row, /^Send to client$/), 'row: Ready to send · Send to client');
    });
    await t('U1: Record call while the link is pending; Send is enabled and the link page says Already answered', async function(){
      openApplicants(); var sb = freshApplicant(); btnIn(rowOf(byId(sb.candidateId).name), /^Shortlist$/).click(); ok(sb.consent.state === 'pending', 'pending');
      openSendToClient([sb.id]); btnIn(document.getElementById('cs-foot'), /^Record call$/).click();
      var inp = document.getElementById('cs-call-' + sb.id); ok(inp && document.activeElement === inp, 'Record call goes to the note');
      inp.value = 'Called on +91 98250 00000, agreed at 3 pm'; btnIn(inp.parentNode, /^Record call$/).click();
      ok(sb.consent.state === 'given' && sb.consent.how === 'call' && sb.consent.linkCancelledAt, 'given by call, link cancelled');
      ok(document.getElementById('cs-send').getAttribute('aria-disabled') !== 'true', 'Send enabled');
      var tok = sb.consent.token; csClose(); location.hash = '#/consent/' + tok; await sleep(60);
      ok(/Already answered/.test(document.getElementById('co-root').textContent), 'link page: Already answered'); coPgBack(); await sleep(30);
      window.__u1b = sb.id;
    });
    await t('U1: the client link on the send record opens the newest unexpired one; Activity shows the full message with a clickable link', async function(){
      var sb = subById(window.__u1b), c = byId(sb.candidateId); openSendToClient([sb.id]); csSend(); ok(journeySent(sb), 'sent');
      var cl = slClientLinkFor(sb); ok(cl, 'a client link');
      var old = slAdd({ kind:'client', personName:'Old Contact', email:'old@patelfoods.example', orgName:pf.client, scopes:{ interviewIds:[], submissionIds:[sb.id], jobId:pf.id }, createdAt:cl.createdAt - 86400000 });
      var gone = slAdd({ kind:'client', personName:'Expired Contact', email:'x@patelfoods.example', orgName:pf.client, scopes:{ interviewIds:[], submissionIds:[sb.id], jobId:pf.id }, createdAt:cl.createdAt + 1000 }); gone.expiresAt = ivNowMs() - 1;
      openPipelineDetail(sb.id); var links = document.getElementById('pd-links'); ok(links && /Client review link/.test(links.textContent), 'Links in the drawer');
      btnIn(links, /^Open as .+ \(demo\)$/).click(); await sleep(60);
      ok(location.hash === '#/l/' + cl.token && slValid(slFind(cl.token)), 'opens the newest valid link (' + cl.personName + '), not the older or the expired one: ' + location.hash);
      slBack(); await sleep(30); ok(document.getElementById('pd-root').innerHTML, 'back in the drawer'); pdClose();
      ts.qvTab = 'activity'; tsQuickView(c.id); await sleep(30);
      var a = [].find.call(document.querySelectorAll('a.o-link'), function(x){ return (x.getAttribute('href') || '').indexOf('#/consent/') > -1; });
      ok(a && /would like to put you forward/.test(a.parentNode.textContent), 'the WhatsApp/email text in full, with the consent link clickable');
      SECURE_LINKS.splice(SECURE_LINKS.indexOf(old), 1); SECURE_LINKS.splice(SECURE_LINKS.indexOf(gone), 1); if(typeof tsCloseQuickView === 'function') tsCloseQuickView(); else ts.qv = null;
    });
    await t('U1: labels everywhere — expired says “No answer · call them”, never asked says “Not asked yet”; Ready to send only once agreed', async function(){
      SUBMISSIONS.filter(function(x){ return subPhase(x) === 'ready'; }).forEach(function(x){ var st = consentState(x), l = journeyStatus(x).label;
        ok(st === 'given' ? l === 'Ready to send' : st === 'pending' ? /^Waiting for .+’s yes$/.test(l) : st === 'expired' ? l === 'No answer · call them' : !/Ready to send/.test(l), x.id + ' ' + st + ': ' + l);
        ok(pipeLabel(x).text === l, 'the pipeline label agrees'); });
    });
    await t('K2: Kesar — no ₹ on Home for any member without money permission (salary ranges aside)', async function(){
      var bad = homeMoneyLeaks(); ok(!bad.length, bad.join(' | '));
    });

    demoBuild('vistaar');
    await t('K4: Vistaar invoices are VHR-', async function(){ checkPrefix('Vistaar', 'VHR'); });
    await t('K7: Vistaar Jobs at risk — real days open, the lead as recruiter, late only when overdue', async function(){ var r = checkRisk('Vistaar'); ok(r.late >= 1, 'some Vistaar job is really late: ' + JSON.stringify(r)); });
    await t('K6: Vistaar seats — Enterprise, no cap', async function(){ checkSeats('Vistaar', 'plan-enterprise', null);
      showView('settings'); if(typeof sGo === 'function') sGo('overview'); var st = main(); ok(!/\d+ of 10\b/.test(st), 'Settings shows no “of 10” seats'); });
    await t('K1: Vistaar build leaves no dialog open', async function(){
      ['fm-modal-root', 'cs-root', 'pd-root', 'iv-root', 'blocked-modal-root'].forEach(function(id){ var r = document.getElementById(id); ok(!r || !r.innerHTML.trim(), '#' + id + ' is empty after the build'); });
      ok(asForm === null, 'no assignment form pending');
    });
    await t('K2: Vistaar — no ₹ on Home for any member without money permission; Owner still sees offer value', async function(){
      var bad = homeMoneyLeaks(); ok(!bad.length, bad.join(' | '));
      var rec = RECRUITER_ROSTER.find(function(u){ return roleOf(u) === 'Recruiter'; }); demoAct(rec.id);
      var b = computeTodaysBriefing(), w = (b.wins || []).map(function(x){ return x.text; }).join(' ');
      ok(!/₹/.test(w), 'a recruiter’s Kairo suggestions carry no ₹: ' + w);
    });
    await t('K3: Contract coordinator lands on PayTrack › Contracts, manages assignments, sees no placement-fee money', async function(){
      var cc = CUSTOM_ROLES.find(function(r){ return r.name === 'Contract coordinator'; });
      ok(cc.permissions.contracts.join() === 'View,Manage' && !(cc.permissions.billing || []).length, 'role: contracts View and Manage, no billing');
      ['Maya Thomas', 'Rakesh Yadav'].forEach(function(n){ var u = byName(n); demoAct(u.id); var m = menu();
        ok(homeForMe() === 'admin-paytrack' && m.indexOf('admin-paytrack') > -1, n + ': Home is PayTrack (' + homeForMe() + ')');
        ok(m.indexOf('admin-revenue') < 0 && m.indexOf('team-members') < 0, n + ': no Revenue, no Team'); });
      demoAct(byName('Maya Thomas').id); showView('admin-paytrack');
      var tabs = [].map.call(document.querySelectorAll('#pt8-root [role=tab]'), function(x){ return x.textContent.trim(); });
      ok(tabs.join() === 'Contracts', 'only the Contracts tab: ' + tabs.join());
      var rows = document.querySelectorAll('#pt8-root tbody tr'); ok(rows.length === ASSIGNMENTS.length && ASSIGNMENTS.length >= 20, 'every assignment listed: ' + rows.length + ' of ' + ASSIGNMENTS.length);
      ok(!/₹/.test(document.getElementById('pt8-root').textContent), 'no ₹ (no fees, bill rates or invoice totals) on the Contracts tab');
      var a = ASSIGNMENTS.find(function(x){ return asRunning(x); }); openPipelineDetail(a.journeyId);
      var pd = q('#pd-root').textContent; ok(/Assignment/.test(pd) && /Week of/.test(pd), 'the assignment opens with its weeks');
      ['Extend', 'Change rate', 'End', 'Import attendance'].forEach(function(l){ ok([].some.call(document.querySelectorAll('#pd-root button'), function(b){ return b.textContent.trim() === l; }), 'Manage action: ' + l); });
      ok(!/₹[^·]{0,25}fee|fee[^·]{0,25}₹/i.test(pd), 'no placement fee in the drawer');
      pdClose();
      var rec = RECRUITER_ROSTER.find(function(u){ return roleOf(u) === 'Recruiter'; }); demoAct(rec.id);
      ok(menu().indexOf('admin-paytrack') < 0, 'a Recruiter still has no PayTrack');
    });

    await t('K17: Vistaar — every place that prints the agency name says Vistaar HR Services', async function(){ brandCheck('Vistaar', 'Vistaar HR Services', 'Vistaar HR Services Pvt. Ltd.'); });
    await t('K14: each Vistaar Sourcer found 20–40 people, recruiters put some forward, and the sourcer/closer split shows', async function(){
      var ss = RECRUITER_ROSTER.filter(function(u){ return roleOf(u) === 'Sourcer'; }), recs = PAYTRACK_JOINED.concat(PAYTRACK_COMPLETED);
      ok(ss.length === 6, 'six Sourcers');
      ss.forEach(function(u){ var mine = CANDIDATES.filter(function(c){ return c.ownerId === u.id; }), fwd = mine.filter(function(c){ return SUBMISSIONS.some(function(sb){ return sb.candidateId === c.id; }); });
        ok(mine.length >= 20 && mine.length <= 40, u.name + ' found ' + mine.length);
        ok(fwd.length > 0 && fwd.length < mine.length, u.name + ': ' + fwd.length + ' of ' + mine.length + ' put forward');
        var theirs = SUBMISSIONS.filter(function(sb){ return sb.sourcedBy && sb.sourcedBy.id === u.id; });
        ok(theirs.length && theirs.every(function(sb){ var o = rosterById(sb.recruiterId); return o && o.id !== u.id && roleHasPermission(o.assignedRoleId, 'candidates', 'Submit to job'); }), u.name + ': each journey is run by a recruiter (the closer)'); });
      var split = recs.filter(function(r){ var x = ptSourcerCloser(r); return x.sourcer !== x.closer; });
      ok(split.length >= 12 && ss.every(function(u){ return split.some(function(r){ return ptSourcerCloser(r).sourcer === u.id; }); }), 'every Sourcer is the sourcer on a placement: ' + split.length);
      var r = split.find(function(x){ return x.commission && x.commission.lines && x.commission.lines.length === 2; });
      ok(r && r.commission.lines[0].part === 'Sourcer' && r.commission.lines[0].share === WSX.commission.sourcer && r.commission.lines[1].part === 'Closer', 'commission lines: ' + JSON.stringify(r && r.commission.lines));
    });
    await t('K14 rule: a recruiter putting forward someone a Sourcer found credits the Sourcer; their own find credits themselves', async function(){
      var src = RECRUITER_ROSTER.find(function(u){ return roleOf(u) === 'Sourcer'; }), job = JOBS.find(function(j){ return j.status === 'Active' && (j.assignedRecruiters || []).length; });
      var rec = (job.assignedRecruiters || []).map(rosterById).find(function(u){ return u && roleOf(u) === 'Recruiter'; }) || rosterById(job.assignedRecruiters[0]);
      demoAct(src.id); var c1 = demoPoolCandidate(demoPerson('Maharashtra', job.title, job.skills || []), src.id);
      demoAct(rec.id); var c2 = demoPoolCandidate(demoPerson('Maharashtra', job.title, job.skills || []), rec.id);
      var r1 = submitOneToJob(job, c1, 'Talent Pool'), r2 = submitOneToJob(job, c2, 'Talent Pool');
      ok(r1.ok && r1.sub.sourcedBy.id === src.id && r1.sub.recruiterId === rec.id, 'Sourcer credited: ' + JSON.stringify(r1.sub && r1.sub.sourcedBy));
      ok(r2.ok && r2.sub.sourcedBy.id === rec.id, 'own find: the recruiter is both');
      demoAct(demoOwnerOf().id);
    });
    await t('K11: Settings › Security & audit › Audit log ends with the fairness report', async function(){
      demoAct(demoOwnerOf().id); showView('settings'); sGo('audit'); await sleep(30);
      var mc = document.getElementById('main-content'), fr = mc.querySelector('#fairness-report'), log = [].find.call(mc.querySelectorAll('table'), function(tb){ return /Module/.test(tb.textContent) && /Action/.test(tb.textContent); });
      ok(fr && /FAIRNESS AND AI USE/.test(fr.textContent) && /BY CANDIDATE CITY/.test(fr.textContent), 'the fairness report is on the Audit log tab');
      ok(log && (log.compareDocumentPosition(fr) & Node.DOCUMENT_POSITION_FOLLOWING), 'it sits under the audit log');
      var rec = RECRUITER_ROSTER.find(function(u){ return roleOf(u) === 'Recruiter' && !roleHasPermission(u.assignedRoleId, 'security', 'View Audit Log'); });
      if(rec){ demoAct(rec.id); showView('settings'); sGo('audit'); await sleep(30); ok(!document.querySelector('#main-content #fairness-report'), 'not for someone without View Audit Log'); }
    });

    await t('K8: “Sign in as” clears the blocked box and any dialog left by the member before', async function(){
      var rec = RECRUITER_ROSTER.find(function(u){ return roleOf(u) === 'Recruiter'; });
      demoSignIn(rec.id); scopeBlocked('candidate’s pipeline'); ok(q('#blocked-modal-root').innerHTML.trim(), 'a blocked box is open');
      fmModal('<div class="p-4">Left open</div>'); var sb = SUBMISSIONS.find(function(x){ return !x.closed && jobById(x.jobId); }); pipeOpenSchedule(sb.id);
      demoSignIn(demoOwnerOf().id);
      ['blocked-modal-root', 'fm-modal-root', 'iv-root', 'pd-root', 'cs-root'].forEach(function(id){ var r = document.getElementById(id); ok(!r || !r.innerHTML.trim(), '#' + id + ' is cleared on switching member'); });
    });

    // K9 last: Vistaar again, this time the way the demo menu opens it (in the background)
    await t('K9: Vistaar opens in the background — Home within about a second, history fills in, a dialog pauses it, the viewer keeps their sign-in', async function(){
      var t0 = performance.now(), firstAt = null, atFirst = null, doneAt = null;
      demoBuildInBackground('vistaar', { first:function(){ firstAt = performance.now() - t0; showView(homeForMe()); atFirst = { j:SUBMISSIONS.length, home:state.activeNav, note:(q('#demo-loading') || {}).textContent || '' }; }, done:function(){ doneAt = performance.now() - t0; } });
      ok(firstAt !== null && firstAt < 1600, 'Home after ' + Math.round(firstAt) + ' ms');
      ok(atFirst.j < 4500 && atFirst.home === 'admin-dashboard' && /Loading history/.test(atFirst.note), 'Home shows while history loads: ' + JSON.stringify(atFirst));
      ok(!q('.demo-building'), 'no blocking cover');
      await sleep(400); fmModal('<div class="p-4">Viewer’s dialog</div>'); await sleep(50); var held = SUBMISSIONS.length; await sleep(600);
      ok(SUBMISSIONS.length === held && DEMO.loading, 'the build waits while a dialog is open (' + held + ' → ' + SUBMISSIONS.length + ')');
      ok(/Viewer’s dialog/.test(q('#fm-modal-root').textContent), 'the viewer’s dialog stays open');
      fmModal(''); var rec = RECRUITER_ROSTER.find(function(u){ return roleOf(u) === 'Recruiter'; }); demoSignIn(rec.id);
      for(var i = 0; i < 600 && DEMO.loading; i++) await sleep(100);
      ok(!DEMO.loading && doneAt, 'history finished after ' + Math.round(doneAt) + ' ms');
      ok(SUBMISSIONS.length === 4500 && CANDIDATES.length === 4000 && PAYTRACK_JOINED.length + PAYTRACK_COMPLETED.length === 300 && ASSIGNMENTS.length === 30, 'the guide’s counts: ' + [SUBMISSIONS.length, CANDIDATES.length, PAYTRACK_JOINED.length + PAYTRACK_COMPLETED.length, ASSIGNMENTS.length].join());
      ok(DEMO.as === rec.id && currentActingUser().id === rec.id, 'still signed in as ' + rec.name + ' (' + (currentActingUser() || {}).name + ')');
      ok(!q('#demo-loading'), 'the loading note is gone');
      ok(!demoUiBusy() && asForm === null, 'no dialog left open');
    });

    window.toast = t0;
    var pre = document.createElement('pre'); pre.id = 'auth-test-results'; pre.textContent = JSON.stringify(results); document.body.appendChild(pre);
    document.title = 'WALK ' + results.filter(function(r){ return r.pass; }).length + '/' + results.length;
  }, 800); });
})();
