/* Cowork v3: campaign types, a joinings goal, quick start with fixes in place, Kairo's evaluation and bulk submit,
   the journey after the call (interview, offer, pre-joining, backups, joining), re-routing a miss, Your day, hand over and run again.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\cowork-journey.spec.js */
(function(){
  var results = [];
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var q = function(s){ return document.querySelector(s); };
  var errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  var ce = console.error; console.error = function(){ errs.push('console.error ' + Array.prototype.slice.call(arguments).map(function(a){ return (a && a.stack) || (a && a.message) || String(a); }).join(' ').slice(0, 300)); };
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e.stack || e.message).slice(0, 500) }); } }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function as(role){ state.role = role; previewAsRoleId = null; renderSidebar(); }
  function main(){ return q('#main-content'); }
  function modal(){ return (document.getElementById('cp-modal-root') || {}).textContent || ''; }
  function java(){ return CAMPAIGNS.find(function(c){ return c.jobId === 'j1'; }); }
  function who(c, name){ return cpPeopleOf(c).find(function(p){ return byId(p.candidateId).name === name; }); }
  function mkCand(id, name, o){ o = o || {}; var c = { id:id, name:name, role:o.role || 'Python Developer', exp:(o.exp || 4) + ' yrs', loc:'Pune, IN', avail:'Available', availScore:80, joinProb:80, respProb:80, bestTime:'7 PM', counterRisk:o.risk || 10, trust:90, intent:'High', skills:o.skills || ['Python','Django','PostgreSQL','AWS'], salary:'₹16–20 LPA', notice:'30 Days', preferredRoles:[], goals:'', market:'', comms:'', employmentType:'Full-time', industry:'Technology', domain:'Backend', email:name.toLowerCase().replace(/ /g, '.') + '@test.example', phone:'9' + (700000000 + id), company:'Acme Labs', currentCompany:'Acme Labs' }; CANDIDATES.push(c); CW_OPTINS[personKeyOf(c)] = { source:'test', date:'Oct 2026' }; return c; }
  function fresh(jobId){ var c = cpNewCampaign(jobId, {}); c.status = 'running'; c.startedAt = CP_NOW() - CP_DAY; c.rules.checkFirst = 0; c.review.approved = 0; return c; }
  var BANNED = /\bAI\b|magic|smart|intelligent|✨|funnel optimi[sz]ation|conversion/i;

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    state.role = 'admin'; enterApp(); await sleep(100); var T0 = CW.clock;

    await t('campaign types are picked from the job, with a reason, and set the whole campaign', async function(){
      ok(cpDetectPlaybook(jobById('j1')).key === 'standard', 'Java is standard'); var w = cpDetectPlaybook(jobById('j21')); ok(w.key === 'volume' && /pay up to|positions|frontline/.test(w.why), 'warehouse is volume: ' + JSON.stringify(w));
      ok(cpDetectPlaybook(jobById('j26')).key === 'niche', 'engineering manager is senior/niche'); ok(cpDetectPlaybook(CP_CORP_JOBS[0]).key === 'volume', 'staff nurses are volume');
      var j = jobById('j2'), d0 = j.daysOpen; j.daysOpen = 25; ok(cpDetectPlaybook(j).key === 'urgent', 'open 25 days is urgent'); j.daysOpen = d0;
      var v = cpBlank('j21'); cpApplyPlaybook(v, 'volume'); ok(v.message.steps.length === 2 && v.plays.li === false && v.prescreen.callMinutes === 10, 'volume: 2 steps, no LinkedIn, 10-minute call'); ok(v.prescreen.questions.some(function(x){ return /walk-in/.test(x.text); }), 'walk-in question');
      var n = cpBlank('j26'); cpApplyPlaybook(n, 'niche'); ok(n.message.steps.length === 4 && n.prescreen.callMinutes === 30, 'niche: 4 steps, 30-minute call');
      var u = cpBlank('j1'); cpApplyPlaybook(u, 'urgent'); ok(u.goal.by === CP_ISO(CP_NOW() + 7 * CP_DAY) && u.allAtOnce, 'urgent: 7 days, every source at once'); var pl = cpPlanFor(u); ok(Object.keys(pl.playUse).some(function(k){ return /from day one/.test(pl.playUse[k].label); }), 'spare sources used from day one');
      ok(cpPlanFor(u).reachAll > cpPlanFor(cpApplyPlaybook(cpBlank('j1'), 'standard')).reachAll, 'urgent reaches more people');
    });
    await t('a joinings goal works backwards: ready to call, submitted, interviewed, offers, joined, and a joining date', async function(){
      var h = cpHistory(jobById('j1')); ok(Math.abs(cpPerReady(h) - .5 * .7 * .6 * .85 * .9) < 1e-9, 'chain'); ok(cpReadyFor(jobById('j1'), 2) === 13, 'two joinings need 13 ready: ' + cpReadyFor(jobById('j1'), 2));
      as('admin'); CP.jobPick = 'j1'; cpNew(); await sleep(20); ok(CP.draft.goalType === 'join' && CP.draft.goal.join === 2, 'new drafts aim for joinings = positions'); ok(/Joinings/.test(main().textContent) && /expected around/.test(main().textContent), 'goal shows joinings');
      cpSetJoin(3); await sleep(10); ok(CP.draft.goal.ready === 19, '3 joinings → 19 ready: ' + CP.draft.goal.ready); ok(/Joinings expected/.test(q('#cp-plan').textContent), 'plan row'); var jp = cpJoinPlan(CP.draft); ok(jp.joins >= 2.9 && jp.joins <= 3.2, 'expected joins ' + jp.joins);
      cpSetGoalType('ready'); ok(CP.draft.goalType === 'ready' && !q('#cp-jv'), 'back to ready-to-call goal'); ok(/Campaign type/.test(main().textContent) && /suggested/.test(main().textContent), 'type chips with the suggestion');
      cpPickPlaybook('niche'); ok(CP.draft.message.steps.length === 4, 'picking a type resets the setup'); ok(/After the call/.test(main().textContent) && main().querySelectorAll('#cp-s8 select').length >= 2, 'after-the-call levels'); CP.draft = null;
    });
    await t('quick start: Kairo sets everything up; a missing pay range is fixed in place; three choices and one click', async function(){
      as('admin'); cpQuick('j26'); await sleep(20); var m = modal(); ok(/Start a campaign/.test(m) && /Senior and niche/.test(m) && /suggested/.test(m), 'type suggested: ' + m.slice(0, 200));
      ok(/no pay range/.test(m) && q('#cp-pay-lo'), 'pay range can be fixed here'); ok(q('#cp-quick .o-btn--primary').disabled, 'Start blocked');
      q('#cp-pay-lo').value = '45'; q('#cp-pay-hi').value = '60'; cpPayFix(); await sleep(10); ok(jobById('j26').salary === '₹45–60 LPA', 'saved to the job'); ok(!q('#cp-quick .o-btn--primary').disabled, 'Start enabled'); ok(/Pay range ₹45–60 LPA is in every first message/.test(modal()), 'check passes');
      cpSetJoin(2); ok(CP.q.goal.join === 2 && CP.q.goal.ready === cpReadyFor(jobById('j26'), 2), 'goal stepper'); ok(/as \w+ sees it/.test(modal()), 'first message preview');
      var n = CAMPAIGNS.length; cpQStart(); await sleep(30); var c = CAMPAIGNS[CAMPAIGNS.length - 1]; ok(CAMPAIGNS.length === n + 1 && c.jobId === 'j26' && c.playbook === 'niche' && c.goalType === 'join', 'created'); ok(c.status === 'review', 'first messages wait: ' + c.status); ok(q('#cp-detail-root'), 'opens the campaign');
      cpQuick('j26'); await sleep(10); ok(/already has a campaign/.test(modal()) && q('#cp-quick .o-btn--primary').disabled, 'one campaign per job'); cpModal('');
      TENANT_AGENT_CONFIG['engagement'].enabled = false; cpQuick('j27'); await sleep(10); ok(/Engage and pre-screen/.test(modal()) && q('#cp-quick .o-btn--primary').disabled, 'no engagement agent blocks'); TENANT_AGENT_CONFIG['engagement'].enabled = true; cpModal('');
      cpQuick('j27'); cpQCustomise(); await sleep(20); ok(q('#cp-editor-root') && CP.draft.jobId === 'j27', 'Customise everything opens the full page with the same setup'); CP.draft = null;
    });
    await t('Kairo evaluates every ready person and suggests Submit, Call first or Hold; you pick and send for review', async function(){
      cwSetClock(T0); as('admin'); var c = java(); var called = cpPeopleOf(c).find(function(p){ return p.state === 'ready' && p.called; }), other = cpPeopleOf(c).find(function(p){ return p.state === 'ready' && !p.called; });
      var e1 = cpEvaluate(c, other); ok(e1.rec === 'call' && /Talk to them/.test(e1.why), 'not called yet → call first: ' + e1.rec); ok(e1.fit.length >= 4 && e1.fit.some(function(f){ return f.k === 'Must-haves'; }), 'fit checks');
      var e2 = cpEvaluate(c, called); ok(e2.rec === 'submit', 'called and fits → submit: ' + JSON.stringify(e2));
      var hold = Object.assign({}, other, { answers:Object.assign({}, other.answers, { notice:'150 days' }) }); ok(cpEvaluate(c, hold).rec === 'hold', 'notice far over → hold');
      cpOpen(c.id, 'applicants'); await sleep(20); ok(/Kairo suggests/.test(main().textContent) && /Call first/.test(main().textContent), 'column'); ok(main().querySelectorAll('.cp-box input').length === 9, 'checkboxes on ready rows');
      cpPickSuggested(c.id); ok(CP.pick[called.id] && !CP.pick[other.id], 'picks Kairo’s Submit only'); var s0 = c.stats.submitted; cpSubmitPicked(c.id); ok(called.state === 'submitted' && c.stats.submitted === s0 + 1, 'sent for review');
      var sb = findSubmission('j1', called.candidateId); ok(sb && sb.stage === 'Pending Review', 'a person reviews it: ' + (sb && sb.stage));
      cpCallOpen(other.id); ok(/Kairo suggests: Call first/.test(modal()), 'call brief carries the evaluation'); cpModal('');
    });
    await t('the journey: interview, offer decided by a person, accepted, check-ins, risk keeps two backups warm, joining confirmed', async function(){
      cwSetClock(T0); as('admin'); var c = java(); cpOpen(c.id, 'journey'); await sleep(20); var tx = main().textContent;
      ok(main().querySelectorAll('.cp-stage').length === 5, 'five stages'); ok(/From first message to joining day/.test(tx) && /Goal: 2 joinings/.test(tx), 'journey header'); ok(/Arvind Rao/.test(tx) && /Drop-out risk 66%/.test(tx) && /Swati Kulkarni/.test(tx) && /Manish Tiwari/.test(tx), 'people at each stage');
      ok(/Backup, kept warm for Arvind Rao/.test(tx), 'two backups are warm'); var arv = who(c, 'Arvind Rao'); ok(arv.bench.length === 2, 'bench of two');
      /* a person decides the offer */
      var man = who(c, 'Manish Tiwari'); ok(cpStageLevel(c, 'offer') === 'ask', 'offer is never automatic'); cpSetStage(c.id, 'offer', 'auto'); ok(cpStageLevel(c, 'offer') === 'ask', 'auto offer is refused');
      cpOfferOpen(man.id); ok(/The terms are yours/.test(modal()), 'offer sheet'); ok(!cpMakeOffer(man.id, 0, CP_ISO(CP_NOW() + 30 * CP_DAY)), 'needs a CTC'); ok(cpMakeOffer(man.id, 30, CP_ISO(CP_NOW() + 30 * CP_DAY)), 'offer released'); ok(man.state === 'offer' && c.stats.offers === 2, 'state offer');
      cwEngineTick(CP_DAY + 3600000, { enrol:0 }); ok(man.nudged && /offer letter reached you/.test(man.chat[man.chat.length - 1].text), 'Kairo checked the offer was opened');
      cwEngineTick(2 * CP_DAY, { enrol:0 }); ok(['accepted','declined'].indexOf(man.state) > -1, 'answered: ' + man.state); if(man.state === 'declined'){ man.state = 'offer'; cpAcceptUI(man.id); }
      ok(man.state === 'accepted' && man.joinOn && man.checkins.length >= 2, 'accepted with check-ins'); var sb = findSubmission('j1', man.candidateId); ok(/Offer accepted/.test(sb.campaignStage), 'application follows: ' + sb.campaignStage);
      /* risk: an unanswered check-in raises it and two backups are kept warm */
      man.risk = 70; man.bench = []; cwEngineTick(3600000, { enrol:0 }); ok(man.bench.length >= 1, 'backups warm for a risky joiner: ' + man.bench.length);
      /* joining day */
      man.joinOn = CP_NOW() - 1000; cwEngineTick(3600000, { enrol:0 }); ok(man.state === 'joinDue', 'joining date reached: ' + man.state); ok(cpMyDay().some(function(x){ return /Confirm Manish Tiwari joined/.test(x.t); }), 'in Your day');
      var h0 = c.stats.hired; cpJoinedUI(man.id); ok(man.state === 'joined' && c.stats.hired === h0 + 1, 'joined'); ok(typeof ptIsTracked !== 'function' || ptIsTracked('Manish Tiwari', 'Senior Java Developer'), 'PayTrack has the joining');
      ok(!man.bench.length && cpPeopleOf(c).every(function(p){ return p.warmFor !== man.id; }), 'backups released');
    });
    await t('stage levels: “I do it” waits for the person, “asks me first” waits for approval, an agent that is off means you do it', async function(){
      as('admin'); var c = java(); var s = who(c, 'Deepa Nair'); s.state = 'submitted'; s.waiting = ''; s.bookOk = false; cpSetStage(c.id, 'interview', 'ask'); s.jAt = CP_NOW() - 2 * CP_DAY; cwEngineTick(3600000, { enrol:0 }); ok(s.state === 'submitted' && /Approve the booking/.test(s.waiting), 'waits for approval: ' + s.waiting);
      ok(cpMyDay().some(function(x){ return /Approve the booking/i.test(x.t); }), 'approval in Your day'); cpApproveBooking(s.id); ok(s.state === 'interview' && s.interviewAt > CP_NOW(), 'booked after approval');
      cpCleared(s.id); ok(s.state === 'offerDecision' && /Offer for Deepa Nair/.test(modal()), 'cleared → offer decision'); cpNotSelectedUI(s.id, 'Client chose another person'); ok(s.state === 'notSelected' && /will not go ahead/.test(s.chat[s.chat.length - 1].text), 'polite note');
      cpSetStage(c.id, 'interview', 'auto'); TENANT_AGENT_CONFIG['interviews'].enabled = false; ok(cpStageLevel(c, 'interview') === 'me' && /off/.test(cpStageWhyOff(CP_STAGES[2])), 'agent off → you do it'); TENANT_AGENT_CONFIG['interviews'].enabled = true;
      var edits = c.log.filter(function(l){ return /Client interview:/.test(l.text); }); ok(edits.length >= 1, 'level changes are logged');
    });
    await t('a drop-out: Kairo had backups warm; moving one forward submits them for review', async function(){
      as('admin'); var c = java(); var arv = who(c, 'Arvind Rao'); var bench = arv.bench.slice(); ok(bench.length === 2, 'two backups');
      cpDroppedUI(arv.id, 'Took a counter-offer'); ok(arv.state === 'dropped', 'dropped'); ok(cpMyDay().some(function(x){ return /Move a backup forward/.test(x.t); }), 'in Your day');
      cpOpen(c.id, 'journey'); await sleep(10); ok(/Move \w+ forward/.test(main().textContent), 'button on the journey'); cpPromote(bench[0]); ok(cpPerson(bench[0]).state === 'submitted', 'backup submitted'); ok(c.log.some(function(l){ return /Moved backup/.test(l.text); }), 'logged');
    });
    await t('a miss on one job is offered a better-fitting open job, honestly, inside that job’s campaign', async function(){
      cwSetClock(T0); as('admin'); var py = fresh('j5'); var c = java(); var cand = mkCand(951, 'Route Person'); var p = cpEnqueue(c, cand, 'pool'); ok(p, 'in the Java campaign'); p.state = 'contacted'; p.step = 1; p.channel = 'whatsapp';
      cpHandleReply(p, '1'); cpHandleReply(p, '200 days'); cpHandleReply(p, '18 now 22 expected'); cpHandleReply(p, 'yes'); cpHandleReply(p, '4 years'); ok(p.tag === 'clearMiss', 'clear miss on Java'); ok(p.alt && p.alt.jobId === 'j5', 'fits Python: ' + JSON.stringify(p.alt));
      ok(cpMyDay().some(function(x){ return /Route Person may fit Python Backend Developer/.test(x.t); }), 'in Your day');
      cpReroute(p.id); var q2 = cpPeopleOf(py).find(function(x){ return x.candidateId === 951; }); ok(q2 && q2.state === 'contacted', 'asked inside the Python campaign'); var msg = q2.chat[q2.chat.length - 1].text; ok(/Python Backend Developer/.test(msg) && /₹16–24 LPA/.test(msg) && /Reply 1/.test(msg), 'honest message: ' + msg);
      ok(cwHonestyCheck(msg, jobById('j5'), { stepIndex:1 }).length === 0, 'passes the guard'); ok(!p.alt && p.routed === py.id, 'recorded');
      ok(cpHandleReply(q2, '1') === 'screening', 'they can start the Python pre-screen');
    });
    await t('Your day: one list across campaigns, highest impact on joinings first, with minutes; on Cowork and on Home', async function(){
      cwSetClock(T0); as('admin'); CP.top = 'campaigns'; showView('kairo-team'); await sleep(20); var items = cpMyDay(); ok(items.length >= 4, 'items ' + items.length);
      for(var i = 1; i < items.length; i++) ok(items[i - 1].w >= items[i].w, 'sorted by impact'); ok(/Your day/.test(main().textContent) && /about \d/.test(q('.cp-day').textContent), 'card with minutes');
      ok(items[0].w >= 8, 'a joining-side decision is first: ' + items[0].t); ok(main().querySelectorAll('.cp-day .cp-need').length <= 5, 'top five'); CP.dayAll = true; cpRefresh(); ok(main().querySelectorAll('.cp-day .cp-need').length === items.length, 'show all'); CP.dayAll = false;
      as('recruiter'); showView('dashboard'); await sleep(30); ok(/hiring decision|Decide the offer|may not join|Confirm/.test(main().textContent), 'Home shows hiring decisions');
      as('admin');
    });
    await t('hand over moves the campaign and its sender; run again copies a finished setup with new dates', async function(){
      as('admin'); var c = java(); var was = c.ownerId; ok(cpHandover(c.id, 'RP-092'), 'handed over'); ok(c.ownerId === 'RP-092' && c.message.senderId === 'RP-092', 'owner and sender'); ok(c.log[0].text.indexOf('Handed over from Priya Sharma to Arjun Kapoor') > -1, 'logged');
      as('recruiter'); ok(!cpVisible(c), 'Priya (recruiter) no longer sees it'); as('admin'); cpHandover(c.id, was);
      var done = CAMPAIGNS.find(function(x){ return x.jobId === 'j25'; }); cpRunAgain(done.id); ok(!q('#cp-editor-root') || CP.draft === null || CP.draft.jobId !== 'j25', 'a closed job cannot run again');
      jobById('j25').status = 'Active'; cpRunAgain(done.id); await sleep(20); ok(q('#cp-editor-root') && CP.draft.runOf === done.id && CP.draft.goal.by > CP_ISO(CP_NOW()), 'editor with the old setup and a new date'); CP.draft = null; jobById('j25').status = 'Filled';
    });
    await t('Edit lists stage, type and joinings changes, and Publish keeps them', async function(){
      as('admin'); var c = java(); cpEdit(c.id); await sleep(20); cpDraftStage('join', 'me'); cpSetJoin(3); ok(cpChanges().some(function(x){ return /Joining: I do it/.test(x); }) && cpChanges().some(function(x){ return /Joinings 2 → 3/.test(x); }), 'changes: ' + cpChanges().join(' | '));
      cpPublish(); await sleep(20); ok(cpStageLevel(c, 'join') === 'me' && c.goal.join === 3, 'published'); cpSetStage(c.id, 'join', 'auto'); c.goal.join = 2;
    });
    await t('screens: Journey tab, Overview strip, Agents tab, quick start; every role; no banned wording, colour or weight', async function(){
      for(var role of ['admin','manager','recruiter']){
        as(role); var vis = CAMPAIGNS.filter(cpVisible); ok(vis.length, role); ['overview','journey','applicants'].forEach(function(tab){ cpOpen(vis[0].id, tab); ok(!BANNED.test(main().textContent), role + '/' + tab + ' wording'); });
        CP.top = 'agents'; showView('kairo-team'); ok(/How the agents work together/.test(main().textContent), role + ' agents tab'); CP.top = 'campaigns';
      }
      as('admin'); cpOpen(java().id, 'overview'); ok(main().querySelectorAll('.cp-jstrip__c').length === 5, 'journey strip'); cpQuick('j27'); await sleep(10); ok(!BANNED.test(modal()), 'quick start wording');
      var bad = []; ['#main-content','#cp-modal-root'].forEach(function(sel){ document.querySelectorAll(sel + ' *').forEach(function(el){ var cs = getComputedStyle(el); [cs.color, cs.backgroundColor].forEach(function(col){ var m = /rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?/.exec(col); if(!m || (m[4] !== undefined && +m[4] === 0)) return; var R = +m[1], G = +m[2], B = +m[3]; if(G > R + 24 && G > B + 24) bad.push('green ' + el.className); if(R > G + 60 && R > B + 60 && R > 170 && !(R > 200 && G > 120 && B < 80)) bad.push('red ' + el.className); }); if(+cs.fontWeight > 600) bad.push('weight ' + el.className); }); });
      cpModal(''); ok(!bad.length, bad.slice(0, 5).join(' | '));
      var orgType = ORG_STRUCTURE.profile.orgType; ORG_STRUCTURE.profile.orgType = 'Corporate'; try { var nc = CAMPAIGNS.find(function(x){ return x.jobId === 'nw1'; }); var cand = mkCand(961, 'Corp Person', { skills:['ICU care','BLS'], role:'Staff Nurse' }); var p = cpEnqueue(nc, cand, 'pool'); p.state = 'submitted'; p.jAt = CP_NOW(); cpApproveBooking(p.id); ok(/hiring manager would like to meet you/.test(p.chat[p.chat.length - 1].text), 'corporate wording: ' + p.chat[p.chat.length - 1].text); } finally { ORG_STRUCTURE.profile.orgType = orgType; }
    });

    var pre = document.createElement('pre'); pre.id = 'auth-test-results'; pre.textContent = JSON.stringify(results); document.body.appendChild(pre);
  }, 800); });
})();
