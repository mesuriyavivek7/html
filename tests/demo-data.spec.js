/* Demo data (demo guide, Demo data tab): three agencies built by the product's own functions.
   For each company: the guide's counts, the named story records, every member's menu and Home for their role, money that
   agrees across Home, Revenue, PayTrack and the client Billing tabs, and no Recruiter, Recruiter Manager, Trainee or Sourcer
   seeing agency money. Also: the demo clock moves every time rule together, and a simulated application from a recruiter's
   personal link is owned by that recruiter. Northstar grows today's seed, so it is built first on this fresh page.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\demo-data.spec.js */
(function(){
  var results = [];
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  var ce = console.error; console.error = function(){ errs.push('console.error ' + Array.prototype.slice.call(arguments).map(function(a){ return (a && a.stack) || (a && a.message) || String(a); }).join(' ').slice(0, 300)); };
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e.stack || e.message).slice(0, 600) }); } }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  var D = 86400000;
  function roleOf(u){ return (CUSTOM_ROLES.find(function(r){ return r.id === u.assignedRoleId; }) || {}).name; }
  function members(role){ return RECRUITER_ROSTER.filter(function(u){ return roleOf(u) === role; }); }
  function byName(n){ return RECRUITER_ROSTER.find(function(u){ return u.name === n; }); }
  function mgrName(u){ var m = rosterById(tmManagerIdOf(u)); return m ? m.name : null; }
  function menu(){ NAV_GROUP_OPEN = { Insights:true }; sidebarMoreOpen = true; renderSidebar(); return [].map.call(document.querySelectorAll('#sidebar-nav .nav-item'), function(b){ return b.getAttribute('data-nav'); }); }
  function main(){ return document.getElementById('main-content').textContent.replace(/\s+/g, ' '); }
  var MONEY = /(revenue|outstanding|overdue|margin|billed|collected|earned)[^.]{0,40}₹|₹[0-9.,]+\s*(L|Cr|K)?[^.]{0,30}(revenue|outstanding|overdue|margin|billed|collected|earned)|Revenue this year|Expected revenue|REVENUE INTELLIGENCE|Agency fees saved/i;
  function stageShare(){ var g = { applied:0, screening:0, client:0, interview:0, offer:0, joined:0, closed:0 }, n = SUBMISSIONS.length;
    SUBMISSIONS.forEach(function(s){ var k = journeyStatus(s).key; if(k === 'applied') g.applied++; else if(['ready_to_send','in_review','waiting_consent','consent_pending','needs_consent'].indexOf(k) > -1 || /review|consent|ready/.test(k)) g.screening++; else if(/with_client|shortlisted|rejected_client_hold|on_hold/.test(k)) g.client++; else if(/interview/.test(k)) g.interview++; else if(/offer/.test(k)) g.offer++; else if(k === 'joined') g.joined++; else g.closed++; });
    Object.keys(g).forEach(function(k){ g[k] = Math.round(g[k] * 100 / n); }); return g; }
  // Every member signs in: the menu and Home follow their role; the expectations per role are the guide's.
  function checkMembers(label){
    var bad = [];
    RECRUITER_ROSTER.forEach(function(u){ demoAct(u.id); var m = menu(), home = homeForMe(), r = roleOf(u), has = function(id){ return m.indexOf(id) > -1; };
      if(home !== homeFor(u.assignedRoleId)) bad.push(u.name + ': Home ' + home);
      m.forEach(function(id){ if(!navItemAllowed(CUSTOM_ROLES.find(function(x){ return x.id === u.assignedRoleId; }), id)) bad.push(u.name + ': ' + id + ' not allowed'); });
      var rule = { Owner:[home === 'admin-dashboard', has('team-members'), has('admin-paytrack')], Admin:[home === 'admin-dashboard', has('team-members')],
        'Recruiter Manager':[home === 'manager-dashboard', has('approval-center'), !has('admin-paytrack'), !has('admin-revenue')],
        Recruiter:[home === 'dashboard', !has('admin-paytrack'), !has('admin-revenue'), !has('team-members')], 'Trainee Recruiter':[home === 'dashboard', !has('admin-paytrack'), !has('team-members')],
        Accounts:[home === 'admin-paytrack', has('admin-paytrack'), !has('jobs'), !has('talent-pool')], 'Account manager':[has('client-management'), has('jobs'), !has('team-members'), !has('admin-paytrack')],
        Sourcer:[has('talent-pool'), !has('client-management'), !has('approval-center'), !has('admin-paytrack')], 'Contract coordinator':[home === 'admin-paytrack', has('admin-paytrack'), !has('admin-revenue'), !has('team-members')] }[r];
      if(!rule) bad.push(u.name + ': unexpected role ' + r); else if(rule.some(function(x){ return !x; })) bad.push(u.name + ' (' + r + '): menu ' + m.join(','));
    });
    demoAct(demoOwnerOf().id); ok(!bad.length, label + ': ' + bad.slice(0, 6).join(' | '));
  }
  // Money agrees: PayTrack's totals are what Home and Revenue show; each client's Billing tab adds up inside PayTrack.
  function checkMoney(label){
    demoAct(demoOwnerOf().id); var m = ptMoney(); showView('admin-revenue'); var rv = main();
    ok(rv.indexOf(clShort(m.billed)) > -1 && rv.indexOf(clShort(m.collected)) > -1, label + ': Revenue = PayTrack (' + clShort(m.billed) + ')');
    var h = odMoney(); ok(Math.round(h.toCollect * 100000) === m.outstanding, label + ': Home to collect = PayTrack outstanding');
    var sum = CLIENTS.filter(clientVisibleTo).reduce(function(s, c){ return s + clientMoney(c.id).billed; }, 0); ok(sum <= m.billed && sum > 0, label + ': client Billing tabs add up within PayTrack (' + sum + ' ≤ ' + m.billed + ')');
  }
  // No Recruiter, Recruiter Manager, Trainee or Sourcer sees agency money on any menu page or client page.
  function checkPrivacy(label){
    var found = [];
    ['Recruiter','Recruiter Manager','Trainee Recruiter','Sourcer'].forEach(function(r){ members(r).slice(0, 2).forEach(function(u){ demoAct(u.id);
      menu().forEach(function(id){ try { showView(id); } catch(e){ found.push(u.name + ' ' + id + ': ' + e.message); return; } var x = main().match(MONEY); if(x) found.push(u.name + ' ' + id + ': …' + x[0]); });
      CLIENTS.filter(clientVisibleTo).slice(0, 2).forEach(function(c){ openClientDetail(c.id, 'overview'); clTabs().forEach(function(tb){ if(tb[0] === 'terms') return; clSetTab(tb[0]); var x = main().match(MONEY); if(x) found.push(u.name + ' ' + c.name + ' › ' + tb[0] + ': …' + x[0]); }); }); }); });
    demoAct(demoOwnerOf().id); ok(!found.length, label + ': money shown: ' + found.slice(0, 5).join(' | '));
  }
  function spreadOk(label){ var g = stageShare(); ok(g.applied >= 34 && g.applied <= 46 && g.screening >= 14 && g.screening <= 26 && g.joined >= 4 && g.joined <= 9 && g.interview >= 6 && g.interview <= 14, label + ': stage spread ' + JSON.stringify(g)); }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    state.role = 'admin'; enterApp(); await sleep(100); var t0 = window.toast; window.toast = function(){};

    await t('Northstar: 15 people as the guide, 12 clients, 25 open + 15 closed jobs, 600 candidates, 700 journeys, 40 placements, 2 contract workers, about 20 approvals', async function(){
      demoBuild('northstar');
      ok(RECRUITER_ROSTER.length === 15 && CLIENTS.length === 12 && JOBS.filter(function(j){ return j.status === 'Active'; }).length === 25 && JOBS.filter(function(j){ return j.status === 'Closed'; }).length === 15, 'people, clients, jobs');
      ok(CANDIDATES.length === 600 && SUBMISSIONS.length === 700 && PAYTRACK_JOINED.length + PAYTRACK_COMPLETED.length === 40 && ASSIGNMENTS.length === 2, 'pool, journeys, placements, contracts: ' + [CANDIDATES.length, SUBMISSIONS.length, PAYTRACK_JOINED.length + PAYTRACK_COMPLETED.length, ASSIGNMENTS.length].join('/'));
      var waiting = APPROVAL_REQUESTS.filter(function(r){ return r.status === 'Pending'; }).length; ok(waiting >= 15 && waiting <= 25, 'approvals waiting: ' + waiting);
      ok(roleOf(byName('Priya Sharma')) === 'Owner' && roleOf(byName('Rohan Mehta')) === 'Admin' && roleOf(byName('Kavya Rao')) === 'Accounts' && roleOf(byName('Arjun Kapoor')) === 'Recruiter Manager' && roleOf(byName('Divya Menon')) === 'Recruiter Manager', 'the named people and roles');
      ok(RECRUITER_ROSTER.filter(function(u){ return mgrName(u) === 'Arjun Kapoor'; }).length === 5 && RECRUITER_ROSTER.filter(function(u){ return mgrName(u) === 'Divya Menon'; }).length === 5 && members('Trainee Recruiter').length === 1, '5 recruiters each, a Trainee Recruiter');
      var fc = clientById('c1'), j1 = jobById('j1'); ok(fc.name === 'Fintech Corp' && fc.pocs[0].name === 'Meera Joshi' && j1.title === 'Senior Java Developer' && j1.client === 'Fintech Corp', 'story: Fintech Corp Senior Java Developer, contact Meera Joshi');
      ok(CANDIDATES.some(function(c){ return c.name === 'Aditya Kulkarni'; }), 'story: Aditya Kulkarni in the pool');
      ok(['1–5','6–20'].indexOf(ORG_STRUCTURE.profile.teamSize) > -1 && WSX.hiring.preApproval !== false, 'review on for recruiters');
      spreadOk('Northstar');
    });
    await t('Northstar: every member’s menu and Home follow their role; money agrees; no recruiter, manager or trainee sees agency money', async function(){ checkMembers('Northstar'); checkMoney('Northstar'); checkPrivacy('Northstar'); });

    await t('Kesar: 3 people, 4 clients, 6 open + 3 closed jobs, 60 candidates, 70 journeys, 5 placements (2 secured and paid, 2 in the window, 1 overdue), team size 1–5', async function(){
      demoBuild('kesar');
      ok(RECRUITER_ROSTER.map(function(u){ return u.name + ':' + roleOf(u) + '>' + mgrName(u); }).join() === 'Meera Shah:Owner>null,Raj Patel:Recruiter>Meera Shah,Tanvi Desai:Recruiter>Meera Shah', 'people: ' + RECRUITER_ROSTER.map(function(u){ return u.name; }).join());
      ok(byName('Meera Shah').email === 'meera.kesar@gmail.com' && ORG_STRUCTURE.profile.brandName === 'Kesar Staffing' && ORG_STRUCTURE.profile.city === 'Ahmedabad', 'owner and workspace');
      ok(CLIENTS.map(function(c){ return c.name; }).join() === 'Patel Foods,Narmada Motors,Shreeji Pharma Distributors,Riverfront Retail', 'clients');
      CLIENTS.forEach(function(c){ var k = clCommercial(c); ok(k.pct === 8.33 && k.replacementDays === 90 && k.paymentDays === 30, c.name + ': 8.33%, 90 days, Net 30: ' + JSON.stringify([k.pct, k.replacementDays, k.paymentDays])); });
      ok(JOBS.filter(function(j){ return j.status === 'Active'; }).length === 6 && JOBS.filter(function(j){ return j.status === 'Closed'; }).length === 3 && CANDIDATES.length === 60 && SUBMISSIONS.length === 70, 'jobs, pool, journeys');
      var recs = PAYTRACK_JOINED.concat(PAYTRACK_COMPLETED); ok(recs.length === 5, 'five placements');
      var secured = recs.filter(function(r){ return ptWindowPassed(r) && ptFullyPaid(r); }).length, inWin = recs.filter(function(r){ return !ptWindowPassed(r) && !ptOverdue(r); }).length, overdue = recs.filter(ptOverdue).length;
      ok(secured === 2 && inWin === 2 && overdue === 1, 'secured+paid / in window / overdue: ' + [secured, inWin, overdue].join('/'));
      ok(WSX.hiring.preApproval === false && APPROVAL_REQUESTS.filter(function(r){ return r.status === 'Pending'; }).length === 0, 'no review, no approvals (team of 1–5)');
      var pf = CLIENTS[0]; ok(pf.pocs[0].name === 'Hiren Patel', 'story: Patel Foods, contact Hiren Patel');
      ok(CANDIDATES.some(function(c){ return c.name === 'Nikhil Joshi'; }) && CANDIDATES.some(function(c){ return c.name === 'Kiran Solanki'; }), 'story: Nikhil Joshi and Kiran Solanki');
      ok(CLIENTS.every(function(c){ return /^24/.test(clientEnsure(c).locations[0].taxId || c.tax.taxId || '24') && gstinChecksumOk(c.tax.taxId || c.locations[0].taxId); }), 'Gujarat GSTINs with valid checksums');
      spreadOk('Kesar');
    });
    await t('Kesar: menus, money and privacy', async function(){ checkMembers('Kesar'); checkMoney('Kesar'); checkPrivacy('Kesar'); });

    await t('the demo clock moves every time rule together, and back to today', async function(){
      demoAct(demoOwnerOf().id); var f0 = fmNow(), a0 = APS.now(), c0 = CW.clock;
      var job = JOBS.find(function(j){ return j.status === 'Active' && (j.assignedRecruiters || []).length >= 2; }); job.applicantRouting = 'round_robin';
      var sim = demoSimulateApplication(job.id, { source:'Careers Page', name:'Clock Tester' }), sb = sim.submission, owner0 = sb.recruiterId;
      var pend = SUBMISSIONS.find(function(s){ return s.consent && s.consent.state === 'pending'; });
      var rec = PAYTRACK_JOINED.concat(PAYTRACK_COMPLETED).find(function(r){ return !ptWindowPassed(r); }), hold = SUBMISSIONS.find(function(s){ return journeySent(s) && !s.hold && ['Rejected','Withdrawn','Joined'].indexOf(s.stage) < 0; });
      setHold(hold, { reason:'Client budget review', by:'Test', source:'client feedback' });
      demoClock(1); ok(fmNow() - f0 >= D - 1000 && APS.now() - a0 >= D - 1000 && CW.clock - c0 === D, 'one day: app clock, approvals clock and send clock move together');
      ok(sb.recruiterId !== owner0, 'SLA: the unopened applicant moved to the next recruiter');
      demoClock(1); ok(!pend || consentState(pend) === 'expired', 'consent: expired after 48 hours');
      demoClock(7); ok(hold.hold && hold.hold.checks >= 1, 'hold: checked back after 7 days');
      demoClock(90); ok(!rec || ptWindowPassed(rec), 'window: passed after 90 days');
      ok(ptAllRecords().some(ptOverdue), 'overdue invoices follow the same clock');
      demoClock(null); ok(Math.abs(fmNow() - Date.now()) < 5000 && DEMO.clockDays === 0, 'back to today');
    });
    await t('a simulated application from a recruiter’s personal link is owned by that recruiter, through intake', async function(){
      var job = JOBS.find(function(j){ return j.status === 'Active' && (j.assignedRecruiters || []).length >= 2; }), r = rosterById(job.assignedRecruiters[1]);
      var n0 = APPLICATION_EVENTS.length, res = demoSimulateApplication(job.id, { source:'link', recruiterId:r.id, name:'Link Applicant', cv:'link-applicant.pdf' });
      ok(res.ok && res.submission.recruiterId === r.id && APPLICATION_EVENTS.length === n0 + 1 && /Personal link/.test((res.submission.ownerHistory.slice(-1)[0] || {}).reason || ''), 'owned by ' + r.name + ': ' + JSON.stringify(res.submission && res.submission.ownerHistory));
      openJob(job.id); await sleep(10); ok(typeof demoSimOpen === 'function', 'the Applicants tab offers Simulate application');
    });

    await t('Vistaar: 65 people, 40 clients across four states, 120 open + 80 closed jobs, 4,000 candidates, 4,500 journeys, 300 placements, 240 invoices, 30 assignments with 8 weeks of time, 6 campaigns, about 60 approvals', async function(){
      demoBuild('vistaar');
      var roles = {}; RECRUITER_ROSTER.forEach(function(u){ var r = roleOf(u); roles[r] = (roles[r] || 0) + 1; });
      ok(RECRUITER_ROSTER.length === 65 && roles.Owner === 1 && roles.Admin === 1 && roles['Recruiter Manager'] === 5 && roles.Recruiter === 40 && roles['Account manager'] === 6 && roles.Sourcer === 6 && roles.Accounts === 4 && roles['Contract coordinator'] === 2, 'roles: ' + JSON.stringify(roles));
      members('Recruiter Manager').forEach(function(m){ ok(RECRUITER_ROSTER.filter(function(u){ return mgrName(u) === m.name && roleOf(u) === 'Recruiter'; }).length === 8, m.name + ': 8 recruiters'); });
      var cc = CUSTOM_ROLES.find(function(r){ return r.name === 'Contract coordinator'; }); ok(cc.permissions.contracts.join() === 'View,Manage' && cc.permissions.candidates.join() === 'View' && !(cc.permissions.billing || []).length, 'Contract coordinator: contracts View and Manage, candidates View, no billing');
      var states = {}; CLIENTS.forEach(function(c){ states[clientEnsure(c).locations[0].state] = 1; }); ok(CLIENTS.length === 40 && Object.keys(states).sort().join() === 'Delhi,Karnataka,Maharashtra,Tamil Nadu', 'clients: ' + Object.keys(states).join());
      var code = { Maharashtra:'27', Delhi:'07', 'Tamil Nadu':'33', Karnataka:'29' };
      ok(CLIENTS.every(function(c){ var g = c.tax.taxId || c.locations[0].taxId; return g && g.slice(0, 2) === code[c.locations[0].state] && gstinChecksumOk(g); }), 'client GSTINs: right state code, valid checksum');
      ok((ORG_STRUCTURE.branches || []).length === 4 && ORG_STRUCTURE.branches.every(function(b){ return gstinChecksumOk(b.gstin) && b.gstin.slice(0, 2) === code[b.state]; }), 'branches Pune, Delhi, Chennai, Bengaluru, each with its own GSTIN');
      ok(JOBS.filter(function(j){ return j.status === 'Active'; }).length === 120 && JOBS.filter(function(j){ return j.status === 'Closed'; }).length === 80 && CANDIDATES.length === 4000 && SUBMISSIONS.length === 4500, 'jobs, pool, journeys');
      var perm = PAYTRACK_JOINED.concat(PAYTRACK_COMPLETED); ok(perm.length === 300 && perm.filter(function(r){ return r.invoice && r.invoice.no; }).length === 240, 'placements and raised invoices: ' + perm.length + '/' + perm.filter(function(r){ return r.invoice && r.invoice.no; }).length);
      ok(ASSIGNMENTS.length === 30 && ASSIGNMENTS.every(function(a){ return ASSIGNMENT_SHEETS.filter(function(s){ return s.asId === a.id && s.status === 'Approved'; }).length === 8; }), '30 assignments, 8 approved weeks each');
      ok(CAMPAIGNS.length === 6, 'six campaigns'); var waiting = APPROVAL_REQUESTS.filter(function(r){ return r.status === 'Pending'; }).length; ok(waiting >= 50 && waiting <= 70, 'approvals waiting: ' + waiting);
      var now = Date.now(), soon = hmInterviews.filter(function(iv){ var x = Date.parse(iv.at); return x > now && x < now + 14 * D && iv.status !== 'Cancelled'; }).length; ok(soon > 50, 'interviews spread over the next 2 weeks: ' + soon);
      spreadOk('Vistaar');
    });
    await t('Vistaar: the story records exist exactly', async function(){
      var shop = CLIENTS.find(function(c){ return c.name === 'ShopKart Retail'; }), sm = JOBS.find(function(j){ return j.client === 'ShopKart Retail' && j.title === 'Store Manager'; });
      ok(shop && rosterById(shop.ownerId).name === 'Leena Fernandes' && roleOf(byName('Leena Fernandes')) === 'Account manager' && sm, 'ShopKart Retail · Store Manager · Account manager Leena Fernandes');
      ok(roleOf(byName('Arif Khan')) === 'Sourcer' && roleOf(byName('Maya Thomas')) === 'Contract coordinator' && roleOf(byName('Suresh Pillai')) === 'Accounts' && roleOf(byName('Anil Desai')) === 'Owner' && roleOf(byName('Farhana Qureshi')) === 'Admin', 'Arif Khan, Maya Thomas, Suresh Pillai, Anil Desai, Farhana Qureshi');
      var sw = CLIENTS.find(function(c){ return c.name === 'SwiftMove Logistics'; }), ga = ASSIGNMENTS.find(function(a){ return a.workerName === 'Ganesh More'; });
      ok(sw && sw.locations[0].city === 'Chennai' && ga && ga.clientId === sw.id && ga.approver.name === 'Prakash R', 'SwiftMove Logistics (Chennai), approver Prakash R, worker Ganesh More');
    });
    await t('Vistaar: menus, money and privacy', async function(){ checkMembers('Vistaar'); checkMoney('Vistaar'); checkPrivacy('Vistaar'); });

    window.toast = t0;
    var pre = document.createElement('pre'); pre.id = 'auth-test-results'; pre.textContent = JSON.stringify(results); document.body.appendChild(pre);
    document.title = 'DEMO ' + results.filter(function(r){ return r.pass; }).length + '/' + results.length;
  }, 800); });
})();
