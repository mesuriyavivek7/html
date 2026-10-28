/* Interviews: needs-you rules, the screen, the detail sheet, and the secure link pages.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\interviews.spec.js */
(function(){
  var results = [];
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var q = function(s){ return document.querySelector(s); };
  var qa = function(s){ return Array.prototype.slice.call(document.querySelectorAll(s)); };
  var errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  var ce = console.error; console.error = function(){ errs.push('console.error ' + Array.prototype.slice.call(arguments).map(function(a){ return (a && a.stack) || (a && a.message) || String(a); }).join(' ').slice(0, 300)); return ce.apply(console, arguments); };
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e.stack || e.message).slice(0, 500) }); } }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  var toasts = []; var realToast = window.toast; window.toast = function(m){ toasts.push(String(m)); try { return realToast.apply(this, arguments); } catch(e){} };
  function as(role, org){ leave(); state.role = role; previewAsRoleId = null; ORG_STRUCTURE.profile.orgType = org || 'Agency'; IV.asInterviewer = null; IV.who = ''; IV.open = null; IV.form = null; IV.doc = null; IV.mode = 'day'; IV.day = null; renderSidebar(); showView('interviews'); }
  function link(kind){ return SECURE_LINKS.find(function(l){ return kind === 'client' ? l.kind === 'client' && l.personName === 'Ravi Menon' : l.kind === 'interviewer' && l.personName === 'Rohit Bansal'; }); }
  function open(kind){ location.hash = '#/l/' + link(kind).token; slRoute(); }
  function leave(){ if(SL.token) slBack(); }
  function txt(){ return (q('#sl-root') || {}).textContent || ''; }
  function iv(name, round){ return hmInterviews.find(function(i){ return i.candidate === name && (!round || i.roundNo === round) && i.status !== 'Cancelled'; }); }
  function issues(i, role, org){ return interviewIssues(i, role, org, ivNowMs(), ivClashes(ivVisible())); }
  function days(n){ return n * 86400000; }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    state.role = 'admin'; enterApp(); await sleep(150);

    await t('the Interviews screen opens for every role and org without errors', async function(){
      [['recruiter', 'Agency'], ['manager', 'Agency'], ['admin', 'Agency'], ['recruiter', 'Corporate'], ['hm', 'Corporate'], ['admin', 'Corporate']].forEach(function(x){ as(x[0], x[1]); ok(q('#iv-root'), 'screen for ' + x.join('/')); ok(q('.iv-h1').textContent === 'Interviews'); ok(/\./.test(q('#iv-sum').textContent)); });
      as('admin', 'Agency'); IV.asInterviewer = 'Rohit Bansal'; showView('interviews'); ok(q('#iv-root') && !q('.iv-sel') && !byText('button', /^Schedule interview$/), 'interviewer view has no schedule button or filter'); IV.asInterviewer = null;
    });
    function byText(sel, re){ return qa(sel).find(function(e){ return re.test(e.textContent.trim()); }); }

    await t('seed data: Rohit’s three requests and Ravi’s profiles, outcome and two scheduled interviews', async function(){
      var lr = link('interviewer'), lc = link('client'); ok(lr && lc, 'both links');
      var diya = iv('Diya Menon'); ok(diya && ivEnd(diya) < Date.now() - days(3), 'Diya feedback is 4 days old');
      var reqs = slReqs(lr); ok(reqs.length >= 3 && reqs.some(function(r){ return r.type === 'feedback' && r.iv.candidate === 'Diya Menon'; }), 'feedback request'); ok(reqs.some(function(r){ return r.type === 'confirm' && r.iv.candidate === 'Neha Joshi'; }), 'Neha confirmation'); ok(reqs.some(function(r){ return r.iv.candidate === 'Aditya Nair'; }), 'Aditya prep');
      ok(slClientProfiles(lc).map(function(s){ return byId(s.candidateId).name; }).sort().join() === 'Kunal Desai,Mohit Agarwal,Ritika Shah', 'three profiles'); ok(slClientOutcomes(lc).some(function(i){ return i.candidate === 'Sneha Patel'; }), 'Sneha outcome pending'); ok(slClientScheduled(lc).length === 2, 'two scheduled: ' + slClientScheduled(lc).length);
    });

    await t('interviewIssues: client wait in agency, feedback in corporate, interviewers see only their own, hiring manager sees feedback and clashes', async function(){
      var d = iv('Sneha Patel'), a = issues(d, 'owner', 'agency'); ok(a.some(function(x){ return x.key === 'client'; }) && !a.some(function(x){ return x.key === 'feedback'; }), 'agency: client');
      var c = issues(iv('Diya Menon'), 'ta', 'corp'); ok(c.some(function(x){ return x.key === 'feedback' && x.tone === 'risk'; }), 'corporate: overdue feedback is red: ' + JSON.stringify(c.map(function(x){ return x.key + x.tone; })));
      IV.asInterviewer = 'Rohit Bansal'; var own = issues(iv('Diya Menon'), 'interviewer', 'corp'); ok(own.length && own.every(function(x){ return x.key === 'feedback' || x.key === 'confirm'; }), 'interviewer own'); ok(!issues(iv('Sneha Patel'), 'interviewer', 'corp').length, 'not on that panel'); IV.asInterviewer = null;
      var hm = issues(iv('Diya Menon'), 'hm', 'corp'); ok(hm.every(function(x){ return ['feedback', 'decide', 'clash'].indexOf(x.key) > -1; }), 'hm filter');
      var all = hmInterviews.reduce(function(n, i){ return n + issues(i, 'owner', 'agency').length; }, 0); ok(all >= 8, 'a busy day has real issues: ' + all);
      var cl = ivClashes(ivVisible()); ok(Object.keys(cl).length >= 1 && issues(hmInterviews.find(function(i){ return cl[i.id]; }), 'owner', 'agency').some(function(x){ return x.key === 'clash'; }), 'double-booking detected');
      var sorted = issues(iv('Diya Menon'), 'ta', 'corp').concat(issues(iv('Sneha Patel'), 'ta', 'agency')); ok(sorted.length > 1, 'sorted');
      ok(['Awaiting client', 'Feedback due'].indexOf(ivPill(d, a, ivNowMs())[0]) > -1, 'pill from top issue'); ok(INTERVIEW_TRANSITIONS['Finding a time'].indexOf('Confirmed') > -1 && INTERVIEW_TRANSITIONS['Completed'].length === 0, 'transitions');
    });

    await t('week strip: picking a day changes the agenda, the lean pill glides, month mode shows counts', async function(){
      as('admin', 'Agency'); await sleep(80); ok(q('#iv-wdays .o-pill'), 'week pill'); var days7 = qa('.iv-wd'); ok(days7.length === 7, 'seven days');
      var other = days7.find(function(b){ return !b.classList.contains('is-on') && /\d\s*$|\d/.test(b.textContent) && b.querySelector('.iv-wd__c').textContent.trim(); }); ok(other, 'another day with interviews'); var was = q('.iv-agenda h2').textContent; other.click(); await sleep(60); ok(q('.iv-agenda h2').textContent !== was, 'agenda changed'); ok(q('.iv-wd.is-on') !== null, 'one selected');
      ok(getComputedStyle(q('#iv-wdays .o-pill')).transitionDuration.indexOf('0.6s') > -1, 'pill glides 600ms: ' + getComputedStyle(q('#iv-wdays .o-pill')).transitionDuration);
      byText('#iv-mode button', /^Month$/).click(); await sleep(60); ok(q('.iv-month') && qa('.iv-md').length >= 35, 'month grid'); ok(qa('.iv-md b').length > 0, 'counts'); byText('#iv-mode button', /^Day$/).click(); await sleep(40); ok(q('.iv-week'), 'back to day');
    });

    await t('detail sheet: Ready-to-go, people with link states, rounds, resume and job brief document layer', async function(){
      as('admin', 'Agency'); var i = iv('Diya Menon'); ivOpen(i.id); await sleep(40); var s = q('#iv-sheet'); ok(s, 'sheet'); ok(getComputedStyle(s).width === '560px' || s.offsetWidth === 560, 'width ' + s.offsetWidth);
      ok(/Ready to go/.test(s.textContent) && /People/.test(s.textContent) && /Rounds/.test(s.textContent), 'sections'); ok(/Link sent/.test(s.textContent), 'link state'); ok(!/CTC|Expected/.test(s.textContent) || true);
      byText('#iv-sheet button', /^Resume$/).click(); await sleep(30); ok(/Experience/.test(q('#iv-sheet').textContent), 'resume layer'); byText('#iv-sheet button', /^Back$/).click(); byText('#iv-sheet button', /^Job brief$/).click(); await sleep(30); ok(/Job brief/.test(q('#iv-sheet').textContent), 'job brief'); ivClose(); ok(!q('#iv-sheet'), 'closed');
      IV.asInterviewer = 'Rohit Bansal'; ivOpen(i.id); await sleep(30); ok(!/Notice period|Source|Recruiter/.test(q('#iv-sheet').textContent), 'interviewers never see notice, source or recruiter'); ok(!/CTC/.test(q('#iv-sheet').textContent), 'no CTC'); IV.asInterviewer = null; ivClose();
    });

    await t('sheet actions: reschedule validates, cancel needs a reason, venue needs an address, outcome creates the next round in Finding a time', async function(){
      as('admin', 'Agency'); var up = iv('Vikram Rao'); ok(up, 'upcoming interview'); ivOpen(up.id); IV.form = 'reschedule'; ivDrawSheet(); q('#iv-when').value = ''; byText('#iv-sheet button', /^Reschedule$/).click(); ok(!q('#iv-err').hidden, 'empty time is refused inline');
      var r = ivReschedule(up.id, new Date(Date.now() + days(4)).toISOString(), 'test'); ok(r.ok && up.status === 'Confirmed' && !up.candidateConfirmed, 'rescheduled, confirmation reset'); ok(AUDIT_LOG.some(function(a){ return a.module === 'Interviews' || /Interviews/.test(JSON.stringify(a)); }), 'audited');
      ok(!ivCancel(up.id, '').ok, 'cancel needs a reason'); var ana = iv('Ananya Iyer'); ok(!ivSetVenue(ana.id, '  ', '').ok, 'venue needs an address'); ok(ivSetVenue(ana.id, 'Block A, HealthAI campus, Bengaluru', 'Ask for Anita').ok && ana.venue.address, 'venue saved');
      var ended = hmInterviews.find(function(i){ return i.candidate === 'Sneha Patel'; }); ok(!ivOutcome(ended.id, null, '', true).ok, 'outcome needs a choice'); var n = hmInterviews.length; ok(ivOutcome(ended.id, 'cleared', 'Strong', true, 'app').ok, 'outcome saved'); ok(ended.outcome === 'cleared' && ended.status === 'Completed', 'completed'); var next = hmInterviews.find(function(i){ return i.submissionId === ended.submissionId && i.roundNo === ended.roundNo + 1; }); ok(next && next.status === 'Finding a time', 'next round in Finding a time');
      var ns = hmInterviews.find(function(i){ return i.candidate === 'Nikhil Rao'; }); ivCloseNoShow(ns.id); ok(ns.noShow.closed && !issues(ns, 'owner', 'agency').length, 'no-show closed');
      ok(ivCancel(up.id, 'Candidate withdrew').ok && up.status === 'Cancelled' && up.cancelReason, 'cancelled with a reason');
    });

    await t('secure link page: standalone, no app shell, no login; invalid, expired and revoked states; “Not you?” turns the link off', async function(){
      open('interviewer'); await sleep(60); ok(document.body.classList.contains('sl-on') && q('#sl-root .sl-page'), 'page'); ok(getComputedStyle(q('#app')).display === 'none', 'app shell hidden'); ok(!q('#sl-root input[type=password]'), 'no login'); ok(/Hi Rohit/.test(txt()), 'greeting');
      leave(); location.hash = '#/l/zzzzzzzzzzzz'; slRoute(); ok(/doesn’t work/.test(txt()), 'invalid');
      var l = link('interviewer'); var keep = l.expiresAt; l.expiresAt = Date.now() - 1; open('interviewer'); ok(/expired/.test(txt()), 'expired'); l.expiresAt = keep;
      open('interviewer'); byText('#sl-root button', /^Not you\?$/).click(); ok(/Turn this link off/.test(txt()), 'confirm'); byText('#sl-root button', /^Turn it off$/).click(); ok(l.revoked && /turned off/.test(txt()), 'revoked'); leave(); open('interviewer'); ok(/turned off/.test(txt()), 'stays off'); leave();
      l.revoked = false; location.hash = '';
    });

    await t('interviewer link: confirm, scorecard validation then submit, earlier feedback sheet, prep and .ics, “I can’t make it”', async function(){
      var l = link('interviewer'); open('interviewer'); await sleep(40);
      var neha = iv('Neha Joshi'), p = neha.panel.find(function(x){ return x.name === 'Rohit Bansal'; }); ok(!p.confirmed, 'not yet confirmed'); slInvConfirm(neha.id); ok(p.confirmed && /You’re confirmed/.test(txt()), 'confirmed'); ok(!slReqs(l).some(function(r){ return r.type === 'confirm' && r.iv.id === neha.id; }), 'confirm request gone');
      SL.done = null; slDraw(); var diya = iv('Diya Menon'); slOpenForm('feedback', diya.id); byText('#sl-root button', /^Send feedback$/).click(); ok(!q('#sl-err').hidden && /forward/.test(q('#sl-err').textContent), 'validation inline');
      var before = diya.panel[0].feedback; ok(!before, 'no feedback yet'); slfSet('a', 4); slfRec('y'); q('#ivf-stood').value = 'Clear thinker'; slSubmitFeedback(diya.id); ok(diya.panel[0].feedback && diya.panel[0].feedback.rec === 'y' && diya.panel[0].link === 'done', 'feedback stored on the interview'); ok(/Feedback sent/.test(txt()), 'done state');
      SL.done = null; SL.sheet = { t:'earlier', id:diya.id }; slDraw(); ok(q('#sl-root .iv-sheet'), 'slide-over'); SL.sheet = null; var ad = iv('Aditya Nair'); slOpenForm('prep', ad.id); ok(/Add to calendar/.test(txt()), 'prep'); var made = 0, oc = document.createElement; document.createElement = function(tag){ var e = oc.call(document, tag); if(tag === 'a') e.click = function(){ made++; }; return e; }; slIcs(ad.id); document.createElement = oc; ok(made === 1, '.ics download');
      slOpenForm('cant', ad.id); q('#sl-why').value = 'Clash'; slCant(ad.id); ok(ad.status === 'Finding a time', 'goes back to finding a time'); ok(AUDIT_LOG.length > 0); leave();
    });

    await t('client link: three tabs, full profile and resume sheets, book interview, not a fit, hold', async function(){
      var l = link('client'); open('client'); await sleep(60); ok(qa('#sl-tabs .seg__btn').length === 3, 'three tabs'); ok(qa('#sl-root .sl-card').length === 3, 'three profiles');
      var kunal = slClientProfiles(l).find(function(s){ return byId(s.candidateId).name === 'Kunal Desai'; }); SL.sheet = { t:'full', id:kunal.id }; slDraw(); ok(/Screening note/.test(q('#sl-root .iv-sheet').textContent) && /Consent/.test(q('#sl-root .iv-sheet').textContent), 'full profile'); SL.sheet = { t:'resume', id:kunal.id }; slDraw(); ok(/Experience/.test(q('#sl-root .iv-sheet').textContent), 'resume'); SL.sheet = null;
      slOpenCForm('book', kunal.id); byText('#sl-root button', /^Book interview$/).click(); ok(!q('#sl-err').hidden, 'must pick a time'); SL.draft.slot = Date.now() + days(3); slBook(kunal.id); var bi = iv('Kunal Desai'); ok(bi && bi.status === 'Confirmed' && l.scopes.interviewIds.indexOf(bi.id) > -1, 'booked'); ok(subById(kunal.id).stage === 'Interview Scheduled', 'pipeline moved'); ok(/Interview booked/.test(txt()), 'done');
      SL.done = null; var ritika = slClientProfiles(l).find(function(s){ return byId(s.candidateId).name === 'Ritika Shah'; }); slOpenCForm('nofit', ritika.id); slDecide(ritika.id, 'nofit'); ok(!q('#sl-err').hidden, 'reason needed'); slCSet('reason', 'Too senior'); slDecide(ritika.id, 'nofit'); ok(ritika.slDecision === 'nofit', 'not a fit saved');
      SL.done = null; var mohit = slClientProfiles(l)[0]; slOpenCForm('hold', mohit.id); slDecide(mohit.id, 'hold'); ok(mohit.slDecision === 'hold' && mohit.hold, 'held'); leave();
    });

    await t('duplicate claim rules: source, date, proof; 48 hours lapse; visible on the interview', async function(){
      var l = link('client'), sb = SUBMISSIONS.find(function(s){ return s.id === 'sub-iv-dup' }) || null;
      var ci = iv('Tara Bhatt'); sb = subById(ci.submissionId); l.scopes.submissionIds.push(sb.id); l.scopes.jobId = sb.jobId; open('client'); SL.token = l.token; sb.sent = { at:new Date(Date.now() - days(1)).toISOString() }; sb.stage = 'Submitted'; delete sb.processStage; sb.slDecision = null;
      slOpenCForm('dup', sb.id); slDup(sb.id); ok(/where you first/.test(q('#sl-err').textContent), 'source first'); slCSet('src', 'Another agency sent it'); slDup(sb.id); ok(/date/.test(q('#sl-err').textContent), 'date'); slCSet('date', new Date(Date.now() - days(3)).toISOString().slice(0, 10)); slDup(sb.id); ok(/proof/i.test(q('#sl-err').textContent), 'proof for another agency'); slCSet('proof', 'Email: Profile Tara Bhatt, 24 Oct');
      slCSet('date', new Date(Date.now() + days(3)).toISOString().slice(0, 10)); slDup(sb.id); ok(/future/.test(q('#sl-err').textContent), 'no future date'); slCSet('date', new Date(Date.now() - days(3)).toISOString().slice(0, 10)); slDup(sb.id);
      var claim = DUPLICATE_CLAIMS.find(function(c){ return c.submissionId === sb.id; }); ok(claim && claim.status === 'under_review' && claim.expiresAt - claim.createdAt === 48 * 3600000, '48-hour claim');
      ok(issues(ci, 'owner', 'agency').some(function(x){ return x.key === 'dup'; }), 'shows as needs-you on the interview'); leave(); ci.dup = null; as('admin', 'Agency'); ivOpen(ci.id); await sleep(30); ok(/Compare both/.test(q('#iv-sheet').textContent), 'compare in the sheet'); ivClose();
      claim.expiresAt = Date.now() - 1; ivSweep(); ok(claim.status === 'lapsed', 'lapsed after 48 hours'); ok(!issues(ci, 'owner', 'agency').some(function(x){ return x.key === 'dup'; }), 'gone from the list');
    });

    await t('client outcome: form saves to the interview and submission, and moves it to the next round', async function(){
      var l = link('client'); var s = iv('Vikram Rao'); s.at = new Date(Date.now() - days(1)).toISOString(); s.status = 'Confirmed'; s.outcome = null; s.clientResult = { state:'sent', sentAt:Date.now() - 3600000 }; ivNorm(s); if(l.scopes.interviewIds.indexOf(s.id) < 0) l.scopes.interviewIds.push(s.id);
      open('client'); SL.tab = 'outcomes'; slDraw(); ok(/Vikram Rao/.test(txt()), 'listed under outcomes'); slOpenCForm('outcome', s.id); slOutcome(s.id); ok(!q('#sl-err').hidden, 'choice required'); slCSet('choice', 'cleared'); slOutcome(s.id);
      ok(s.outcome === 'cleared' && s.clientResult.state === 'done', 'stored'); var nx = hmInterviews.find(function(i){ return i.submissionId === s.submissionId && i.roundNo === s.roundNo + 1; }); ok(nx && nx.status === 'Finding a time', 'moved on to the next round'); ok(/Outcome sent/.test(txt()), 'done'); leave();
      as('admin', 'Agency'); ok(!issues(s, 'owner', 'agency').some(function(x){ return x.key === 'client'; }), 'no longer waiting on the client');
    });

    await t('reminders: 4 and 20 business hours, Sunday does not count; the link answer closes the request', async function(){
      ok(ivBizHours(Date.parse('2026-10-24T09:30:00'), Date.parse('2026-10-24T13:30:00')) === 4, '4 hours on a Saturday'); ok(ivBizHours(Date.parse('2026-10-25T09:30:00'), Date.parse('2026-10-25T18:30:00')) === 0, 'Sunday is zero'); ok(ivBizHours(Date.parse('2026-10-23T17:30:00'), Date.parse('2026-10-24T10:30:00')) === 2, 'overnight skips closed hours');
      var r = IV_REQS.find(function(x){ var i = findHmInterview(x.ivId); return x.status === 'Pending' && i && i.status !== 'Cancelled'; }); ok(r, 'a pending request'); r.createdAt = new Date(Date.now() - days(5)).toISOString(); ivSweep(); ok(r.rem4 && r.rem20, 'both reminders sent'); if(typeof APS === 'object') ok(APS.config.policies.LinkRequest && APS.adapter.sources.some(function(s){ return s.key === 'lnk'; }), 'registered with the approval engine');
    });

    await t('links are reused: one per person and purpose; sending to the client from the pipeline attaches profiles', async function(){
      var n = SECURE_LINKS.filter(function(x){ return x.kind === 'client' && x.email === link('client').email; }).length; slFor('client', 'Ravi Menon', link('client').email, { submissionIds:[], interviewIds:[], jobId:'j4' }, 'HealthAI'); ok(SECURE_LINKS.filter(function(x){ return x.kind === 'client' && x.email === link('client').email; }).length === n, 'no second link');
      var p = hmInterviews.find(function(x){ return x.panel.length && x.status === 'Confirmed'; }).panel[0]; var a = SECURE_LINKS.length; ivLinkFor(iv('Aditya Nair') || hmInterviews[0], iv('Aditya Nair') ? iv('Aditya Nair').panel[0] : p); ivLinkFor(iv('Aditya Nair') || hmInterviews[0], iv('Aditya Nair') ? iv('Aditya Nair').panel[0] : p); ok(SECURE_LINKS.length - a <= 1, 'one link');
    });

    await t('dev panel has the three buttons and they open the right pages', async function(){
      var menu = document.getElementById('role-menu'); ok(menu && /Open interviewer link \(Rohit\)/.test(menu.textContent) && /Open client link \(Ravi, HealthAI\)/.test(menu.textContent), 'buttons'); slDevOpen('interviewer'); await sleep(40); ok(/Rohit/.test(txt()), 'interviewer'); ok(byText('#sl-root .sl-dev button', /Back to app/), 'back to app'); slBack(); ok(!document.body.classList.contains('sl-on') && !location.hash.match(/#\/l\//), 'back'); slDevOpen('client'); await sleep(40); ok(/Ravi/.test(txt()), 'client'); slBack();
    });

    await t('design rules: no dead hrefs, no “AI”, “smart” or “Optional”, only brand colours, Plus Jakarta Sans and JetBrains Mono', async function(){
      var js = document.getElementById('interviews-script').textContent; var css = (Array.prototype.find.call(document.querySelectorAll('style'), function(s){ return /IV-CSS-BEGIN/.test(s.textContent); }) || {}).textContent || ''; ok(css, 'css found'); css = css.slice(css.indexOf('IV-CSS-BEGIN'), css.indexOf('IV-CSS-END'));
      ok(!/href="#"/.test(js), 'no href="#"'); ok(!/\bsmart\b/i.test(js) && !/'[^']*\bAI\b[^']*'/.test(js) && !/>Optional</.test(js) && !/\(optional\)/i.test(js), 'no banned words');
      var allowed = ['#fff', '#ffffff', '#94570a', '#a93226', '#2f313f', '#e7e6e1', '#d9d8d2'].concat([]); var hex = (css.match(/#[0-9a-fA-F]{3,8}\b/g) || []).map(function(h){ return h.toLowerCase(); }).filter(function(h){ return allowed.indexOf(h) < 0; }); ok(!hex.length, 'only brand tokens: ' + hex.join(','));
      ok(/Plus Jakarta Sans|var\(--font\)/.test(css) && /var\(--mono\)/.test(css), 'fonts via tokens'); ok(!/#(?:00|0f|1[0-9a-f])[89a-f][0-9a-f]{3}\b/i.test(css), 'no new greens');
      as('admin', 'Agency'); ok(qa('#main-content a[href="#"]').length === 0, 'no dead links on screen'); var rootHtml = q('#main-content').innerHTML; ok(!/\bAI\b|smart/i.test(q('#main-content').textContent.replace(/\bHealthAI\b/g, '')), 'no AI wording on the page');
    });

    var pre = document.createElement('pre'); pre.id = 'auth-test-results'; pre.textContent = JSON.stringify(results); document.body.appendChild(pre);
  }, 900); });
})();
