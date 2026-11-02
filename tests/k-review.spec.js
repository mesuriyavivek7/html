/* Final review K1–K8: money only for money roles, no typed-in figures shown as facts, the corporate demo menu without a
   page error, one source for the agency jobs website and marketplace, the phone note bar, and Account wording.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\k-review.spec.js */
(function(){
  var results = [];
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var q = function(s){ return document.querySelector(s); };
  var errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  var ce = console.error; console.error = function(){ errs.push('console.error ' + Array.prototype.slice.call(arguments).map(function(a){ return (a && a.stack) || (a && a.message) || String(a); }).join(' ').slice(0, 300)); };
  var OWNER = 'RP-088', seq = 0, D = 86400000;
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e.stack || e.message).slice(0, 500) }); }
    finally { asOwner(); ORG_STRUCTURE.profile.orgType = 'Agency'; WSX.commission.showRecruiters = false; CO.pg = null; } }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function asOwner(){ viewingAsFromManager = false; managerViewAsRecruiterId = null; previewAsRoleId = null; state.role = 'admin'; }
  function actAs(id){ if(id === OWNER) return asOwner(); state.role = 'manager'; viewingAsFromManager = true; managerViewAsRecruiterId = id; previewAsRoleId = null; }
  function as(role){ viewingAsFromManager = false; managerViewAsRecruiterId = null; previewAsRoleId = null; state.role = role; }
  function main(){ return q('#main-content').textContent.replace(/\s+/g, ' '); }
  function menu(){ NAV_GROUP_OPEN = { Insights:true }; sidebarMoreOpen = true; renderSidebar(); return [].map.call(document.querySelectorAll('#sidebar-nav .nav-item'), function(b){ return b.getAttribute('data-nav'); }); }
  // Agency money a Recruiter or Recruiter Manager must not see: revenue, outstanding, overdue, margin, billed, collected, expected revenue.
  var MONEY = /(revenue|outstanding|overdue|margin|billed|collected|earned)[^.]{0,40}₹|₹[0-9.,]+\s*(L|Cr|K)?[^.]{0,30}(revenue|outstanding|overdue|margin|billed|collected|earned)|Revenue this year|Expected revenue|REVENUE INTELLIGENCE|Agency fees saved/i;
  function person(name, roleId){ seq++; var u = { id:'KR-' + seq, name:name, email:'kr.' + seq + '@northstartalent.com', assignedRoleId:roleId, reportingManagerId:OWNER, organizationId:CURRENT_ORGANIZATION_ID, userStatus:'Active' }; RECRUITER_ROSTER.push(u); return u; }
  function mkJob(){ seq++; var cl = CLIENTS.find(function(x){ return x.name === 'Fintech Corp'; });
    var j = { id:'krj' + seq, title:'Review Role ' + seq, client:cl.name, clientId:cl.id, loc:'Pune, IN', locations:['Pune, IN'], status:'Active', priority:'Medium', recruiter:'Priya Sharma', recruiterId:null,
      assignedRecruiters:[OWNER], skills:['Java'], positions:2, submitted:0, candidateIds:[], interested:[], recs:[], publishChannels:[], organizationId:CURRENT_ORGANIZATION_ID, salary:'₹10–40 LPA', workMode:'Hybrid', replacementDays:90,
      submissionRules:{ approvalBeforeClient:false, hideContacts:true, maxProfiles:5, required:[] } }; JOBS.push(j); return j; }
  // A placement made the real way (as in m08): the sourcer adds the candidate, the closer owns the journey at joining.
  function place(sourcer, closer){
    var j = mkJob(); seq++; var c = { id:99600 + seq, name:'Review Placed ' + seq, role:'Engineer', skills:['Java'], email:'kr' + seq + '@example.com', organizationId:CURRENT_ORGANIZATION_ID }; CANDIDATES.push(c);
    actAs(sourcer); var sb = createSubmission(j.id, c.id, { source:'Sourced', recruiterId:sourcer, stage:'Ready to Send', reason:'test' }); asOwner(); if(closer !== sourcer) setJourneyOwner(sb, closer, 'Hand-over for the test');
    sb.sent = { at:new Date(fmNow() - 20 * D).toISOString(), by:'Test' }; moveSubmissionStage(sb.id, 'Shortlisted', 'test');
    var o = recordOffer(sb.id, { ctc:20, doj:ptLocalDay(new Date(fmNow())) }); if(o.pending && o.approval) decideApproval(o.approval.id, 'Approved');
    offerSetStatus(sb, 'Accepted', '', 'Offer accepted'); moveSubmissionStage(sb.id, 'Offer Accepted', 'accepted');
    return ptCreateJoinedRecord(c.name, j.title, j.client, j.id, ptFmtDate(ptToday()), { submissionId:sb.id, joinedIso:ptLocalDay(new Date(fmNow())) });
  }
  function recHome(){ showView('dashboard'); var nums = [].map.call(document.querySelectorAll('#main-content .o-num'), function(n){ return n.textContent; }).join(' | '); var m = q('#rec-month-h'); return nums + ' || ' + (m ? m.closest('section').textContent : ''); }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    state.role = 'admin'; enterApp(); await sleep(100); FM.interactive = false;

    await t('K1 recruiter Home: no ₹ unless “Show recruiters their own commission” is on, and then only their own commission this month', async function(){
      var a = person('Review Sourcer', 'role_recruiter'), b = person('Review Closer', 'role_recruiter'), r = place(a.id, b.id);
      var mine = r.commission.lines.find(function(l){ return l.userId === b.id; }), theirs = r.commission.lines.find(function(l){ return l.userId === a.id; });
      actAs(b.id); WSX.commission.showRecruiters = false; var off = recHome(); ok(!/₹/.test(off) && /Placements/.test(off) && !/Commission/.test(off), 'off: placements, no ₹: ' + off.slice(0, 300));
      WSX.commission.showRecruiters = true; var on = recHome();
      ok(on.indexOf(ptRupees(mine.amount).replace('₹', '')) > -1 && /My commission/.test(on), 'on: their own commission ' + ptRupees(mine.amount) + ': ' + on.slice(0, 300));
      ok(on.indexOf(formatINR(clRecFee(r))) === -1 && (theirs.amount === mine.amount || on.indexOf(ptRupees(theirs.amount).replace('₹', '')) === -1), 'not the fee, not the other person’s share');
    });

    await t('K2 Intelligence: the revenue ₹ only with billing · View; others see placement counts', async function(){
      as('recruiter'); showView('intelligence'); var r = main(); ok(!/REVENUE INTELLIGENCE/.test(r) && /PLACEMENTS/.test(r), 'recruiter: counts only');
      as('manager'); showView('intelligence'); ok(!/REVENUE INTELLIGENCE/.test(main()), 'manager: counts only');
      asOwner(); showView('intelligence'); ok(/REVENUE INTELLIGENCE/.test(main()) && /₹/.test(main()), 'Owner: revenue');
    });

    await t('K3 privacy sweep: every menu page, and every client page and tab, as Recruiter and Recruiter Manager shows no agency revenue, outstanding or margin', async function(){
      var found = [];
      ['recruiter', 'manager'].forEach(function(role){
        as(role); menu().forEach(function(id){ try { showView(id); } catch(e){ found.push(role + ' ' + id + ': ' + e.message); return; } var m = main().match(MONEY); if(m) found.push(role + ' ' + id + ': …' + m[0]); });
        CLIENTS.filter(clientVisibleTo).slice(0, 4).forEach(function(c){ openClientDetail(c.id, 'overview'); clTabs().forEach(function(tb){ clSetTab(tb[0]); if(tb[0] === 'terms') return; var m = main().match(MONEY); if(m) found.push(role + ' ' + c.name + ' › ' + tb[0] + ': …' + m[0]); }); });
      });
      ok(!found.length, 'money shown: ' + found.join(' | '));
      as('manager'); var tabs = clTabs().map(function(x){ return x[0]; }); ok(tabs.indexOf('terms') > -1 && tabs.indexOf('billing') < 0, 'the RM keeps fee terms (View Contracts), not the Billing tab: ' + tabs.join());
      ok(cpMoneyMode() === 'placements', 'Cowork campaigns: placements, not expected revenue');
      asOwner(); ok(clCanSeeAccountMoney() && cpMoneyMode() === 'revenue' && clTabs().some(function(x){ return x[0] === 'billing'; }), 'the Owner still sees money');
    });

    await t('K4 no typed-in figures shown as facts: Org productivity is computed; probabilities are marked indicative', async function(){
      ok(typeof RECRUITERS === 'undefined', 'the seed is gone'); asOwner(); showView('admin-recruiters'); var h = main();
      ok(!/Efficiency|Avg Fill/.test(h), 'no efficiency or average-fill column');
      var rows = orgProductivityRows(), priya = rows.find(function(r){ return r.name === 'Priya Sharma'; }), few = rows.find(function(r){ return r.sent < 5; });
      ok(priya && priya.sent === computeRecruiterScore('Priya Sharma').sentCount && priya.placements === PAYTRACK_JOINED.concat(PAYTRACK_COMPLETED).filter(function(r){ return !r.reason && (r.recruiterId === priya.id || (!r.recruiterId && r.recruiter === priya.name)); }).length, 'Priya: computed from journeys and PayTrack');
      ok(few && h.indexOf(recruiterTooFewText(few.sent)) > -1, 'under 5 sent: ' + recruiterTooFewText(few.sent));
      as('manager'); var mm = renderAdminRecruiters(); ok(!/Fees/.test(mm), 'no fees without billing · View');
      asOwner(); showView('all-tasks'); var tk = main(); ok(!/Join Probability|Response Probability|Counter Offer Risk/.test(tk) && (tk.indexOf('(indicative)') > -1 || !ACTIONS.length), 'All tasks: probabilities marked indicative');
      ok(ACTIONS.every(function(a){ return a.stats.every(function(s){ return !/probability|risk/i.test(s[0]) || /\(indicative\)/.test(s[0]); }); }), 'every task stat that is a guess is marked');
      ['Response Probability (%) · indicative, typed in', 'Counter-Offer Risk (%) · indicative, typed in'].forEach(function(l){ ok(WF_CONDITION_FIELDS.some(function(f){ return f.label === l; }), 'workflow field: ' + l); });
    });

    await t('K5 the corporate demo menu loads without a page error and offers the corporate demo workspace', async function(){
      ok(!(window.__bootErrors || []).some(function(e){ return /insertBefore/.test(e); }), 'no insertBefore error at load: ' + (window.__bootErrors || []).join(' | '));
      var m = document.getElementById('co-menu-demo'); ok(m && /Try other journeys/.test(m.textContent) && /Corporate demo workspace/.test(m.textContent), 'the menu has “Try other journeys” › Corporate demo workspace');
    });

    await t('K6 one source: sign-up answers write the Settings switches; the old profile fields are gone', async function(){
      var was = { site:WSX.careers.jobsWebsite, mkt:WSX.careers.market.listed };
      try {
        suAgency().jobsSite = true; SU_WORKSPACE_SCREENS['jobs-site'].save(); ok(WSX.careers.jobsWebsite === true && !('jobsWebsiteAllowed' in ORG_STRUCTURE.profile), 'jobs website: the Settings switch');
        suAgency().marketplace = false; SU_WORKSPACE_SCREENS['agency-marketplace'].save(); ok(WSX.careers.market.listed === false && !('marketplaceListed' in ORG_STRUCTURE.profile), 'marketplace: the Settings switch');
        suAgency().jobsSite = false; SU_WORKSPACE_SCREENS['jobs-site'].save(); ok(WSX.careers.jobsWebsite === false, 'and off again');
        ok(AUDIT_LOG.some(function(a){ return /Oontu jobs website set at sign-up/.test(a.action); }) && AUDIT_LOG.some(function(a){ return /Marketplace listing set at sign-up/.test(a.action); }), 'audited');
      } finally { WSX.careers.jobsWebsite = was.site; WSX.careers.market.listed = was.mkt; }
    });

    await t('K6 the jobs website lists agency jobs when the agency allows it; an opted-out job and hidden client names stay hidden; applications come in as “Oontu jobs”', async function(){
      var was = { site:WSX.careers.jobsWebsite, hide:WSX.careers.hideClient };
      try {
        WSX.careers.jobsWebsite = false; ok(coSiteJobs().length === 0, 'off: nothing listed');
        WSX.careers.jobsWebsite = true; var j = mkJob(), out = mkJob(); out.onJobSite = false; var list = coSiteJobs();
        ok(list.some(function(x){ return x.id === j.id; }) && !list.some(function(x){ return x.id === out.id; }) && !list.some(function(x){ return x.corp; }), 'the agency’s live jobs, not the opted-out one');
        WSX.careers.hideClient = true; var cards = coJobCards([j]); ok(/Confidential client/.test(cards) && cards.indexOf(j.client) === -1, 'client name hidden');
        WSX.careers.hideClient = false; ok(coJobCards([j]).indexOf(j.client) > -1, 'shown when allowed');
        seq++; var r = coSiteApply(j.id, { name:'Site Applicant ' + seq, email:'site' + seq + '@example.com', phone:'98200 ' + String(10000 + seq) }); ok(r.ok, 'applied: ' + JSON.stringify(r));
        var sb = SUBMISSIONS.filter(function(s){ return s.jobId === j.id; }).pop(); ok(sb && sb.source === 'Oontu jobs' && sb.stage === 'Applied Directly' && sb.recruiterId && isInboundSource(sb.source), 'through intake as “Oontu jobs”, owned, Applied: ' + (sb && sb.source));
        ORG_STRUCTURE.profile.orgType = 'Corporate'; ok(!coSiteJobs().some(function(x){ return !x.corp; }), 'a company workspace lists only its own jobs');
      } finally { WSX.careers.jobsWebsite = was.site; WSX.careers.hideClient = was.hide; }
    });

    await t('K7 on a phone the note is a full-width bottom bar and the page makes room for it', async function(){
      var rules = []; [].forEach.call(document.styleSheets, function(sh){ try { [].forEach.call(sh.cssRules, function(r){ if(r.media && /max-width:\s*639px/.test(r.media.mediaText)) rules.push(r.cssText); }); } catch(e){} });
      var css = rules.join(' '); ok(/\.app-toasts[^}]*left:\s*0/.test(css) && /bottom:\s*0/.test(css) && /\.app-toast[^}]*width:\s*100%/.test(css), 'full-width bottom bar under 640 px');
      ok(/#toast-container \.app-toast\)\s*#main-content[^}]*margin-bottom/.test(css), 'the main content makes room while it shows');
    });

    await t('K8 Settings › Account says “the Owner or an Admin”', async function(){
      as('recruiter'); openSettings('account'); var h = main(); ok(/the Owner or an Admin/.test(h) && !/your Admin/i.test(h), 'Account: ' + (h.match(/Only [^.]{0,40}change this|Ask [^.]{0,40}change it/g) || []).join(' | '));
    });

    var pre = document.createElement('pre'); pre.id = 'auth-test-results'; pre.textContent = JSON.stringify(results); document.body.appendChild(pre);
    document.title = 'K ' + results.filter(function(r){ return r.pass; }).length + '/' + results.length;
  }, 800); });
})();
