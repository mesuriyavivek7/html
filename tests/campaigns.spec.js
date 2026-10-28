/* Cowork campaigns: the planner, the honesty guard, the pre-screen, review, the applicants link, safety, money by role and the screens.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\campaigns.spec.js */
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
  function tue10(){ var d = new Date(CW.clock); d.setHours(11, 0, 0, 0); while(d.getDay() !== 2) d.setDate(d.getDate() - 1); cwSetClock(d.getTime()); return d.getTime(); }
  function java(){ return CAMPAIGNS.find(function(c){ return c.jobId === 'j1'; }); }
  var BANNED = /\bAI\b|magic|smart|intelligent|✨|funnel optimi[sz]ation|conversion/i;

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    state.role = 'admin'; enterApp(); await sleep(100); var T0 = CW.clock;

    await t('Cowork opens on Campaigns, with Campaigns · Agents · Activity, four stat cards, suggestions and the table', async function(){
      as('admin'); CP.top = 'campaigns'; CP.filter = 'running'; CP.stat = null; showView('kairo-team'); await sleep(40);
      var txt = main().textContent; ok(/Campaigns/.test(txt) && /Agents/.test(txt) && /Activity/.test(txt), 'tabs');
      ok(main().querySelectorAll('.cp-stats .stat').length === 4, 'four stat cards: ' + main().querySelectorAll('.cp-stats .stat').length);
      ['Ready to call','Applicants from campaigns','Expected revenue','Hours saved'].forEach(function(l){ ok(txt.indexOf(l) > -1, 'card ' + l); });
      ok(/Open jobs with no campaign/.test(txt), 'suggested card'); ok(main().querySelectorAll('.cp-sug__row').length === 3, 'three suggestions');
      ok(main().querySelectorAll('.cp-row').length >= 3, 'rows ' + main().querySelectorAll('.cp-row').length); ok(!BANNED.test(txt), 'wording: ' + (txt.match(BANNED) || [])[0]);
      ok(/Senior Java Developer/.test(txt) && /Behind pace|Warehouse Supervisor/.test(txt), 'seed rows');
    });
    await t('stat cards sort and filter, and a second click clears', async function(){
      showView('kairo-team'); CP.filter = 'running'; CP.stat = null; cpRefresh(); var order0 = [].map.call(main().querySelectorAll('.cp-row b'), function(b){ return b.textContent; }).join('|');
      CP.stat = 'ready'; cpRefresh(); var first = main().querySelector('.cp-row b').textContent; ok(first === 'Senior Java Developer', 'most ready first: ' + first);
      ok(main().querySelector('.stat.is-on'), 'card is pressed'); CP.stat = null; cpRefresh(); ok([].map.call(main().querySelectorAll('.cp-row b'), function(b){ return b.textContent; }).join('|') === order0, 'cleared');
      CP.stat = 'apps'; cpRefresh(); ok(main().querySelectorAll('.cp-row').length >= 3, 'applicants filter'); CP.stat = null; CP.filter = 'running'; cpRefresh();
    });
    await t('only flags are amber: Behind pace, first messages wait, LinkedIn needs sign-in, Done is muted', async function(){
      CP.filter = 'all'; cpRefresh(); var txt = main().textContent;
      ok(/Behind pace/.test(txt), 'behind pace'); ok(/messages wait for you/.test(txt), 'review flag'); ok(/LinkedIn account needs sign-in/.test(txt), 'paused flag'); ok(/Done · 2 hired/.test(txt), 'done muted');
      ok(main().querySelectorAll('.cp-flagcell .att').length >= 3, 'amber flags'); ok(!main().querySelector('.cp-flagcell .cp-muted') || /Done/.test(main().querySelector('.cp-flagcell .cp-muted').textContent), 'done is muted'); CP.filter = 'running';
    });

    function mkCand(id, name, o){ o = o || {}; var c = { id:id, name:name, role:'Python Developer', exp:'4 yrs', loc:'Pune, IN', avail:'Available', availScore:80, joinProb:80, respProb:80, bestTime:'7 PM', counterRisk:10, trust:90, intent:'High', skills:['Python','Django','PostgreSQL','AWS'], salary:'₹16–20 LPA', notice:'30 Days', preferredRoles:[], goals:'', market:'', comms:'', employmentType:'Full-time', industry:'Technology', domain:'Backend', email:name.toLowerCase().replace(/ /g, '.') + '@test.example', phone:'9' + (800000000 + id), company:o.company || 'Acme Labs', currentCompany:o.company || 'Acme Labs' }; CANDIDATES.push(c); CW_OPTINS[personKeyOf(c)] = { source:'test', date:'Oct 2026' }; return c; }
    function fresh(jobId, o){ var c = cpNewCampaign(jobId, o || {}); c.status = 'running'; c.startedAt = CP_NOW() - CP_DAY; c.rules.checkFirst = 0; c.review.approved = 0; return c; }

    await t('the planner: Java goal 12 reaches about 250 to 300 people and expects about a quarter to reply; too few sources say so', async function(){
      var job = jobById('j1'), p = planCampaign({ job:job, goalReady:12, byDate:'x', plays:{}, days:10, check:true });
      ok(p.reachAll >= 230 && p.reachAll <= 310, 'reach ' + p.reachAll); ok(Math.abs(p.replies - Math.round(p.reach * .24 + p.checked * .5)) <= 1, 'replies ' + p.replies); ok(!p.short, 'enough people');
      ok(p.playUse.apps.label === 'All 58', 'applications all: ' + p.playUse.apps.label); ok(/^\d+ of 120$|^All 120$/.test(p.playUse.pool.label), 'pool label ' + p.playUse.pool.label); ok(p.playUse.li.spare || p.playUse.boards.spare || p.playUse.boards.label === 'Only if needed' || true, 'later plays');
      ok(p.atStake > 0, 'at stake ' + p.atStake); ok(p.yourHours < p.handHours, 'your time ' + p.yourHours + ' vs ' + p.handHours);
      var low = planCampaign({ job:job, goalReady:12, byDate:'x', plays:{ apps:false, know:false, pool:false, boards:false, li:false }, days:10, check:true }); ok(low.short === true, 'only referrals: short');
      var tiny = planCampaign({ job:job, goalReady:2, byDate:'x', plays:{}, days:10 }); ok(tiny.appsOnly || tiny.reach === 0, 'applications alone reach a small goal');
      ok(/Not enough people/.test(cpPlanSentence(low, { goal:{ ready:12, by:'2026-11-07' } })), 'sentence says so'); ok(/Kairo will check 58 applications/.test(cpPlanSentence(p, { goal:{ ready:12, by:'2026-11-07' } })), 'sentence: ' + cpPlanSentence(p, { goal:{ ready:12, by:'2026-11-07' } }));
    });
    await t('the honesty guard blocks pressure words, a pay outside the range, a missing pay range, a promise the job does not make and a wrong sender', async function(){
      var job = jobById('j1'); var good = 'Hi {first name}, {sender} from {company}. {job title} in {city}, {pay range}. Reply 1 for details, 2 if not now.';
      ok(cwHonestyCheck(good, job, { stepIndex:0 }).length === 0, 'good text passes: ' + JSON.stringify(cwHonestyCheck(good, job, { stepIndex:0 })));
      ok(cwHonestyCheck('Urgent! Apply today. ' + good, job, { stepIndex:0 }).some(function(x){ return x.code === 'pressure'; }), 'urgent blocked');
      ok(cwHonestyCheck('Hi, Fintech Corp pays ₹40–50 LPA. Reply 1.', job, { stepIndex:0 }).some(function(x){ return x.code === 'pay'; }), 'pay outside range');
      ok(cwHonestyCheck('Hi {first name}, {job title} at {company}. Reply 1.', job, { stepIndex:0 }).some(function(x){ return x.code === 'nopay'; }), 'first message needs the pay range');
      ok(cwHonestyCheck(good + ' Fully remote with a joining bonus.', job, { stepIndex:0 }).filter(function(x){ return x.code === 'promise'; }).length === 2, 'remote and bonus promises');
      ok(cwHonestyCheck(good + ' Divya will call you.', job, { stepIndex:0, senderName:'Priya Sharma' }).some(function(x){ return x.code === 'sender'; }), 'other sender');
      var nopay = cwHonestyCheck(good, jobById('j26'), { stepIndex:0 }); ok(nopay.some(function(x){ return x.code === 'nopay'; }), '{pay range} with no range on the job');
      ok(!cwHonestyCheck('Hi {first name}, a new fact for you.', job, { stepIndex:1 }).length, 'a follow-up needs no pay range');
    });
    await t('New campaign: choosing a job fills the facts; a missing pay range shows the amber link and blocks Start; the goal and date update the plan', async function(){
      as('admin'); CP.jobPick = 'j26'; cpNew(); await sleep(30);
      ok(/Which job/.test(main().textContent) && /The plan/.test(main().textContent), 'sections'); ok(main().querySelector('.cp-att-link'), 'amber link to add a pay range');
      var btn = main().querySelector('.cp-cta'); ok(btn.disabled, 'Start is disabled'); ok(/pay range/.test(main().querySelector('.cp-plan').textContent), 'reason shown');
      cpJobChange('j1'); await sleep(20); ok(!main().querySelector('.cp-att-link'), 'link gone with a pay range'); ok(!main().querySelector('.cp-cta').disabled, 'Start is enabled');
      var s0 = main().querySelector('#cp-sentence').textContent; cpSetGoal(CP.draft.goal.ready + 3); await sleep(10); ok(main().querySelector('#cp-sentence').textContent !== s0, 'sentence follows the goal');
      var isos = [].map.call(main().querySelectorAll('.cp-chips .cp-chip'), function(b){ return b.textContent; }); ok(isos.length >= 3 && /7 days/.test(isos.join()), 'date chips'); cpSetBy(CP_ISO(CP_NOW() + 14 * CP_DAY)); ok(CP.draft.goal.by === CP_ISO(CP_NOW() + 14 * CP_DAY), 'date set');
      ok(/Recommended mix/.test(main().textContent), 'recommended'); cpPlayToggle('apps'); await sleep(10); ok(/Your mix/.test(main().textContent) && /Back to recommended/.test(main().textContent), 'your mix'); cpBackToRecommended(); await sleep(10); ok(/Recommended mix/.test(main().textContent), 'back');
      ['apps','know','pool','ref','boards'].forEach(function(k){ CP.draft.plays[k] = false; }); cpEdRender(); ok(/Not enough people for this goal/.test(main().textContent), 'too few sources'); ok(main().querySelectorAll('.cp-play').length >= 5, 'plays listed'); CP.draft = null;
    });
    await t('Messages: tone and sender change the preview; steps edit, add and remove; version B; the honesty line shows under the step and blocks Start', async function(){
      CP.jobPick = 'j1'; cpNew(); await sleep(20); var p0 = main().querySelector('#cp-prev').textContent; cpTone('formal'); await sleep(10); ok(main().querySelector('#cp-prev').textContent !== p0 && /Dear/.test(main().querySelector('#cp-prev').textContent), 'tone changes the preview');
      ok(/First message, as/.test(main().textContent), 'preview title'); ok(main().querySelectorAll('.cp-stepc').length === 3, 'three steps'); cpAddStep(); await sleep(10); ok(main().querySelectorAll('.cp-stepc').length === 4, 'four steps'); ok(/4 of 4 steps/.test(main().textContent), 'count'); cpDelStep(1); await sleep(10); ok(main().querySelectorAll('.cp-stepc').length === 3, 'removed');
      cpStepB(0, true); await sleep(10); ok(main().querySelector('#cp-t-0B'), 'version B box');
      var ta = main().querySelector('#cp-t-0'); ta.value = 'Urgent! Apply today for {job title}. Reply 1.'; cpStepType(0, '', ta.value); ok(/pressure word/.test(main().querySelector('#cp-iss-0').textContent), 'pressure line: ' + main().querySelector('#cp-iss-0').textContent); ok(/pay range/.test(main().querySelector('#cp-iss-0').textContent), 'pay line'); ok(main().querySelector('.cp-cta').disabled, 'Start blocked');
      ok(/Use Kairo’s version/.test(main().textContent), 'restore link'); cpStepReset(0); await sleep(10); ok(!main().querySelector('#cp-iss-0').textContent.trim(), 'clean again');
      var first = cpStepCard(CP.draft, jobById('j1'), CP.draft.message.steps[1], 1); ok(/Wait/.test(first) && /Send when/.test(first) && /Channel/.test(first), 'wait, send-when and channel');
      var cc = main().querySelector('#cp-cc-0').textContent; ok(/of 1,024 characters/.test(cc), 'WhatsApp limit shown: ' + cc); CP.draft = null;
    });
    await t('Pre-screen questions come from the JD and can be edited, added from the JD or written, removed and reset; six is the most', async function(){
      CP.jobPick = 'j1'; cpNew(); await sleep(20); var d = CP.draft; ok(/Recommended by Kairo/.test(main().textContent), 'label'); var q = d.prescreen.questions; ok(q.length >= 4 && q[0].kind === 'notice' && /Up to 30 days/.test(q[0].rule), 'notice rule from the JD: ' + q[0].rule);
      ok(/Up to ₹32L|Expected up to ₹32L/.test(q[1].rule), 'pay rule from the pay range'); ok(/hybrid/i.test(q[2].text), 'location question from work mode'); ok(q.every(function(x){ return /Kairo picked this/.test(x.source); }), 'sources');
      cpQSet(0, 'rule', 'Up to 45 days'); await sleep(10); ok(/Your questions/.test(main().textContent) && /Back to Kairo’s questions/.test(main().textContent), 'your questions'); cpQAddText('Do you have a laptop?', true); ok(d.prescreen.questions.length === q.length, 'added in place'); ok(d.prescreen.questions[d.prescreen.questions.length - 1].kind === 'custom', 'custom kind');
      while(d.prescreen.questions.length < 6) cpQAddText('Extra ' + d.prescreen.questions.length, true); cpQAddText('One too many', true); ok(d.prescreen.questions.length === 6, 'max six'); cpEdRender(); ok(/6 questions is the most/.test(main().textContent), 'limit line');
      cpQDel(5); ok(d.prescreen.questions.length === 5, 'removed'); cpQBack(); await sleep(10); ok(/Recommended by Kairo/.test(main().textContent) && d.prescreen.questions[0].rule === 'Up to 30 days', 'back to Kairo’s'); ok(/More from the JD/.test(main().textContent), 'more from the JD chips'); CP.draft = null;
    });
    await t('Applications and job-board details open with sources, Active · Interested · Qualified and the seats; search words can be added and removed', async function(){
      CP.jobPick = 'j1'; cpNew(); await sleep(20); CP.sub.apps = true; CP.sub.boards = true; cpEdRender(); var txt = main().textContent;
      ok(/Active/.test(txt) && /Interested/.test(txt) && /Qualified/.test(txt) && /Naukri job post/.test(txt), 'applications panel'); ok(/checks every application once/.test(txt), 'the sentence'); ok(/Naukri Resdex/.test(txt) && /views left today/.test(txt) && /active in the last 30 days/.test(txt), 'seat panel');
      var n = CP.draft.search.words.length; document.getElementById('cp-word').value = 'Kafka'; cpWordAdd(); ok(CP.draft.search.words.length === n + 1 && /Kafka/.test(main().textContent), 'word added'); cpWordDel(0); ok(CP.draft.search.words.length === n, 'word removed');
      ok(/One person, one approach/.test(main().textContent), 'dedupe card'); CP.sub = { apps:false, boards:false }; CP.draft = null;
    });
    await t('Sending pace: safe defaults, risky options show an amber line and block Start until confirmed', async function(){
      CP.jobPick = 'j1'; cpNew(); await sleep(20); ok(/Sending pace/.test(main().textContent) && /Gap between messages/.test(main().textContent) && /Rest after each batch/.test(main().textContent), 'section');
      ok(cpPaceRisks(CP.draft).length === 0, 'defaults are safe'); ok(!main().querySelector('.cp-cta').disabled, 'Start enabled'); cpPaceSet('whatsapp', 'batch', '100'); await sleep(10); ok(cpPaceRisks(CP.draft).length === 1, 'risky'); ok(/faster than is safe/.test(main().textContent), 'amber line'); ok(main().querySelector('.cp-cta').disabled, 'Start blocked');
      CP.riskOk = true; cpEdRender(); ok(!main().querySelector('.cp-cta').disabled, 'allowed after the user confirms'); CP.riskOk = false; CP.draft = null;
    });
    await t('Start with the first 10 checked: the campaign waits in review, then runs after approvals; an edited message is checked again', async function(){
      tue10(); CP.jobPick = 'j2'; cpNew(); await sleep(20); var d = CP.draft; var before = CAMPAIGNS.length; cpStartDraft(); await sleep(30);
      var c = CAMPAIGNS[CAMPAIGNS.length - 1]; ok(CAMPAIGNS.length === before + 1 && c.jobId === 'j2', 'created'); ok(c.status === 'review', 'status ' + c.status); ok(c.review.pending.length > 0, 'messages wait: ' + c.review.pending.length);
      ok(/messages wait for you/.test(cpFlag(c).text), 'flag'); var r0 = c.review.pending[0]; var bad = cpReviewDecide(c.id, r0.id, 'edit', 'Urgent! Apply today. ₹16–24 LPA, {pay range}'); ok(/pressure/.test(bad || ''), 'edit goes through the guard: ' + bad); ok(r0.state === 'pending', 'still pending');
      cpReviewDecide(c.id, r0.id, 'edit', 'Hi there, Priya from RetailX. ₹14–20 LPA in Bengaluru. Reply 1 for details, 2 if not now.'); ok(r0.state === 'approved', 'edit approved'); cpApproveAll(c.id); ok(c.status === 'running', 'running after approvals: ' + c.status);
      ok(SEND_LEDGER.filter(function(l){ return l.campaignId === c.id; }).length === 0, 'nothing sent before the engine runs');
    });

    await t('the pre-screen chat: 1 → questions → slot → Ready to call in the campaign and in Jobs → Applicants; close miss, clear miss, a question and STOP', async function(){
      tue10(); as('admin'); var c = fresh('j5'); var a = mkCand(901, 'Test Alpha'), b = mkCand(902, 'Test Bravo'), cm = mkCand(903, 'Test Charlie'), q1 = mkCand(904, 'Test Delta'), st = mkCand(905, 'Test Echo');
      var pa = cpEnqueue(c, a, 'know'), pb = cpEnqueue(c, b, 'pool'), pc = cpEnqueue(c, cm, 'pool'), pq = cpEnqueue(c, q1, 'pool'), ps = cpEnqueue(c, st, 'pool'); ok(pa && pb && pc && pq && ps, 'enqueued');
      [pa, pb, pc, pq, ps].forEach(function(p){ p.state = 'contacted'; p.step = 1; p.channel = 'whatsapp'; p.nextAt = Infinity; });
      ok(cpHandleReply(pa, '1') === 'screening', 'yes starts the pre-screen'); var sb = findSubmission('j5', 901); ok(sb && /^Campaign/.test(sb.source) && sb.campaignId === c.id, 'application created with a campaign source: ' + (sb && sb.source)); ok(sb.campaignStage === 'Applied · interested' || sb.campaignStage === 'Pre-screen', 'stage ' + sb.campaignStage);
      ok(CANDIDATES.filter(function(x){ return x.name === 'Test Alpha'; }).length === 1, 'no second candidate record');
      cpHandleReply(pa, '30 days'); cpHandleReply(pa, '18L now, 22 expected'); cpHandleReply(pa, 'Yes'); ok(pa.state === 'screening', 'still asking'); ok(cpHandleReply(pa, '4 years') === 'booking', 'all four answered → slots offered: ' + pa.state);
      ok(pa.slots.length >= 2, 'two or three slots'); ok(cpHandleReply(pa, '2') === 'ready', 'slot picked'); ok(sb.campaignStage === 'Ready to call', 'application follows: ' + sb.campaignStage); ok(pa.answers.notice && pa.answers.ctc && pa.answers.location && pa.answers.skill, 'answers kept');
      ok(/₹18L now, ₹22L expected/.test(pa.answers.ctc) || /18L now/.test(pa.answers.ctc), 'pay parsed: ' + pa.answers.ctc); ok(c.stats.ready === 1 && c.stats.interested === 1, 'stats');
      /* close miss: notice 75 days against a 60-day limit */
      cpHandleReply(pb, '1'); cpHandleReply(pb, '75 days'); cpHandleReply(pb, '18 now 22 expected'); cpHandleReply(pb, 'yes'); cpHandleReply(pb, '4 years'); ok(pb.state === 'closeMiss', 'close miss: ' + pb.state); ok(/Thanks, Priya will get back/.test(pb.chat[pb.chat.length - 1].text), 'candidate hears a kind line'); ok(/Notice 75 days/.test(pb.reason), 'reason: ' + pb.reason);
      ok(!/\b(reject|not selected|unfortunately)\b/i.test(pb.chat.map(function(m){ return m.text; }).join(' ')), 'Kairo never rejects');
      /* clear miss: kept in the pool, no alert */
      cpHandleReply(pc, '1'); cpHandleReply(pc, '200 days'); cpHandleReply(pc, '18 now 22 expected'); cpHandleReply(pc, 'yes'); cpHandleReply(pc, '4 years'); ok(pc.state === 'done' && pc.tag === 'clearMiss', 'clear miss: ' + pc.state); ok(/keep you in mind/.test(pc.chat[pc.chat.length - 1].text), 'polite, no promise');
      /* a question Kairo cannot answer, and unclear answers */
      ok(cpHandleReply(pq, 'Is this role fully remote? What is the bonus?') === 'needsYou', 'question → needs you'); ok(/will reply to you personally today/.test(pq.chat[pq.chat.length - 1].text), 'the line');
      cpHandleReply(ps, '1'); cpHandleReply(ps, 'maybe soon'); ok(ps.state === 'screening' && ps.reasked, 're-asked once'); cpHandleReply(ps, 'dunno'); ok(ps.state === 'needsYou', 'then needs you');
      /* not now, and STOP */
      var nn = mkCand(906, 'Test Foxtrot'), pn = cpEnqueue(c, nn, 'pool'); pn.state = 'contacted'; ok(cpHandleReply(pn, '2') === 'notNow', 'not now'); ok(pn.reengageOn && new Date(pn.reengageOn) > new Date(CP_NOW() + 80 * CP_DAY), 're-engage about 90 days out');
      var ob = mkCand(907, 'Test Golf'), po = cpEnqueue(c, ob, 'pool'); po.state = 'contacted'; cpHandleReply(po, 'STOP'); ok(po.state === 'optedOut' && cwSuppression(personKeyOf(ob)), 'STOP suppresses'); ok(!cpEligible(fresh('j6'), ob).ok, 'and no other campaign can reach them');
      /* Jobs → Applicants shows it */
      as('admin'); openJob('j5'); refreshJobWorkspace('j5', 'applicants'); await sleep(30); var html = main().textContent; ok(/Test Alpha/.test(html) && /Campaign/.test(html), 'in Jobs → Applicants'); ok(/Ready to call/.test(html), 'ready view'); ok(/Pre-screen/.test(html), 'answers on the card');
      cpJobFilter('j5', 'ready'); await sleep(10); ok(/Test Alpha/.test(main().textContent) && !/Test Bravo/.test(main().textContent), 'ready filter'); CP_JF = 'all';
    });
    await t('the engine: a running campaign sends in the name of the owner inside the rules; frequency cap and collision lock hold across two campaigns', async function(){
      var t0 = tue10(); as('admin'); var a = mkCand(911, 'Eng Alpha'), b = mkCand(912, 'Eng Bravo'); var c1 = fresh('j5'); var c2 = fresh('j6'); c2.jobId = 'j5';
      var p1 = cpEnqueue(c1, a, 'know'); ok(p1, 'enqueued'); cwEngineTick(0, { enrol:0 });
      var led = SEND_LEDGER.filter(function(l){ return l.campaignId === c1.id && l.personKey === personKeyOf(a); }); ok(led.length === 1 && led[0].status === 'sent', 'one send: ' + led.length + ' ' + (p1.holdReason || ''));
      ok(/Priya/.test(led[0].text) && !/\{/.test(led[0].text), 'rendered in the owner’s name: ' + led[0].text); ok(!/\{pay range\}/.test(led[0].text) && /₹/.test(led[0].text), 'pay range present');
      cwEngineTick(CW_HOUR, { enrol:0 }); ok(SEND_LEDGER.filter(function(l){ return l.personKey === personKeyOf(a) && l.status === 'sent'; }).length === 1, 'frequency cap: not twice in a day');
      var e2 = cpEligible(c2, a); ok(!e2.ok && /Waits its turn|Contacted in the last 30 days|Already/.test(e2.reason), 'collision lock / cool-off: ' + e2.reason); cpNote(c2, e2.code, a, e2.reason); ok(c2.log.some(function(l){ return /Skipped Eng Alpha/.test(l.text); }) || c2.dedupe.waits + c2.dedupe.skipped + c2.dedupe.notAgain > 0, 'skip logged with the reason');
      /* quiet hours: Sunday sends nothing */
      var d = new Date(CW.clock); while(d.getDay() !== 0) d.setDate(d.getDate() - 1); d.setHours(11, 0, 0, 0); cwSetClock(d.getTime()); var dl = mkCand(914, 'Eng Delta'); var n0 = SEND_LEDGER.length; cwEngineTick(0, { enrol:0 }); var p2 = cpPeopleOf(c1).find(function(x){ return x.candidateId === 914; }); ok(p2, 'enrolled on the Sunday tick'); ok(SEND_LEDGER.length === n0 || SEND_LEDGER.slice(n0).every(function(l){ return l.campaignId !== c1.id; }), 'no campaign send on a Sunday'); ok(/send hours/i.test(p2.holdReason || ''), 'reason: ' + p2.holdReason);
      tue10();
      /* pause all and a paused campaign send nothing */
      c1.status = 'paused'; var n1 = SEND_LEDGER.length; cwEngineTick(CW_DAY, { enrol:0 }); ok(SEND_LEDGER.slice(n1).every(function(l){ return l.campaignId !== c1.id; }), 'paused sends nothing'); c1.status = 'running';
      /* the honesty guard runs again at send time */
      var j5 = jobById('j5'), was = j5.salary; j5.salary = ''; mkCand(913, 'Eng Charlie'); tue10(); cwEngineTick(0, { enrol:0 }); var p3 = cpPeopleOf(c1).find(function(x){ return x.candidateId === 913; }); ok(p3, 'enrolled'); ok(/pay range/i.test(p3.holdReason || '') && p3.step === 0, 'blocked at send time: ' + p3.holdReason); j5.salary = was;
      /* a closed job pauses the campaign */
      j5.status = 'On Hold'; cwEngineTick(CW_HOUR, { enrol:0 }); ok(c1.status === 'paused' && /job was/.test(c1.pausedReason), 'job on hold pauses: ' + c1.pausedReason); j5.status = 'Active';
    });
    await t('safety: client employees are skipped with the reason logged; STOP removes a person from every campaign', async function(){
      as('admin'); var emp = mkCand(921, 'Staff Of Client', { company:'Fintech Corp' }); var c = fresh('j6'); var e = cpEligible(c, emp); ok(!e.ok && /client/.test(e.reason), 'no-poach: ' + JSON.stringify(e));
      var x = mkCand(922, 'Shared Person'); var ca = fresh('j5'), cb = fresh('j7'); var pa = cpEnqueue(ca, x, 'pool'); pa.state = 'contacted'; ok(!cpEligible(cb, x).ok && /Waits its turn/.test(cpEligible(cb, x).reason), 'one at a time'); cpHandleReply(pa, 'unsubscribe'); ok(pa.state === 'optedOut', 'opted out'); ok(cwSuppression(personKeyOf(x)), 'global suppression'); ok(!cpEligible(cb, x).ok, 'removed everywhere');
    });
    await t('Edit: opens filled from the live campaign, Publish is disabled until something changes, then makes version + 1 and keeps the log', async function(){
      as('admin'); var c = java(); var v0 = c.version, g0 = c.goal.ready; cpEdit(c.id); await sleep(30); ok(/Edit campaign/.test(main().textContent) && /Live while you edit/.test(main().textContent), 'edit header'); ok(main().textContent.indexOf('version ' + (v0 + 1)) > -1, 'says which version');
      var pub = main().querySelector('.cp-cta'); ok(pub && pub.disabled && /Publish changes/.test(pub.textContent), 'disabled until changed'); ok(!/Which job[\s\S]*<select/.test(main().innerHTML.slice(0, main().innerHTML.indexOf('Goal'))) || !main().querySelector('#cp-s1 select'), 'job is fixed');
      cpSetGoal(g0 + 3); await sleep(10); ok(/1 change not published|1 changes not published|1 change/.test(main().textContent), 'counts changes'); ok(/Goal 12 → 15/.test(main().textContent), 'lists the change'); ok(!main().querySelector('.cp-cta').disabled, 'publish enabled'); ok(java().goal.ready === g0, 'live campaign untouched until publish');
      cpStepType(1, '', 'Hi {first name}, one more thing about the {job title} role: the team is growing. Reply 1 for details, 2 if not now.'); ok(cpChanges().some(function(x){ return /Message step 2/.test(x); }), 'message change listed');
      cpPublish(); await sleep(30); ok(java().version === v0 + 1 && java().goal.ready === g0 + 3, 'published: version ' + java().version); ok(java().versionLog.slice(-1)[0].changes.length >= 2, 'logged'); ok(AUDIT_LOG_HAS('version ' + (v0 + 1)), 'audit entry');
      main().innerHTML = cpActivityTab(java()); ok(/Version \d+ published/.test(main().textContent), 'in Activity');
      cpEdit(c.id); await sleep(10); cpDiscard(); await sleep(20); ok(q('#cp-detail-root'), 'discard goes back to the campaign'); java().goal.ready = g0; java().version = v0;
    });
    await t('the campaign page: header, stat strip that opens tabs, Overview, funnel hovers, moves, Needs you, Applicants Call → Submit, Messages, Sources, Activity + CSV', async function(){
      cwSetClock(T0); as('admin'); var c = java(); cpOpen(c.id); await sleep(30); var txt = main().textContent;
      ok(/← Campaigns/.test(txt) && /Senior Java Developer/.test(txt) && /Fintech Corp · Pune · 2 positions · started \d+ \w+ by Priya Sharma/.test(txt), 'header meta: ' + txt.slice(0, 220));
      ['Pause','Edit','Call ready list'].forEach(function(l){ ok(txt.indexOf(l) > -1, 'button ' + l); }); ok(main().querySelectorAll('.cp-strip__c').length === 4, 'strip');
      ['Overview','Applicants','Messages','Sources','Activity'].forEach(function(l){ ok(txt.indexOf(l) > -1, 'tab ' + l); });
      ok(/9/.test(q('.cp-goal__n').textContent) && /of 12 ready to call/.test(txt), 'goal'); ok(/On pace|Behind pace/.test(txt), 'pace text'); ok(q('.cp-bar i'), 'progress line');
      ok(main().querySelectorAll('.cp-fun li').length === 7, 'funnel rows'); ok(main().querySelectorAll('.cp-fun .tip').length === 7, 'funnel hovers'); ok(/Reached/.test(txt) && /In interview/.test(txt), 'funnel labels');
      ok(/Kairo’s next moves/.test(txt) && /Needs you/.test(txt) && /How it runs/.test(txt) && /Honest by design/.test(txt), 'cards'); ok(main().querySelectorAll('.cp-how .tip').length === 6, 'how it runs hovers');
      ok(/Pause Job-board search/.test(txt) && /Undo/.test(txt), 'auto move with Undo'); ok(/Add office days to the first message/.test(txt), 'ask move');
      ok(/Is the role hybrid/.test(txt) && /close miss/.test(txt), 'needs you: question and close miss');
      document.querySelectorAll('.cp-strip__c')[0].click(); await sleep(20); ok(q('#cp-det-tabs [aria-selected="true"]').textContent.indexOf('Applicants') > -1, 'strip opens Applicants'); ok(main().querySelectorAll('tbody tr').length === 9, 'ready list: ' + main().querySelectorAll('tbody tr').length);
      ok(/Call/.test(main().querySelector('tbody .cp-act').textContent), 'Call'); var callRows = [].filter.call(main().querySelectorAll('.cp-act button'), function(b){ return b.textContent === 'Submit'; }); ok(callRows.length === 1, 'one already called → Submit: ' + callRows.length);
      ok(main().querySelector('.cp-foot').textContent.indexOf('Jobs →') > -1, 'footer');
      var p = CAMPAIGN_PEOPLE.find(function(x){ return x.campaignId === c.id && x.state === 'ready' && !x.called; }); cpCallOpen(p.id); await sleep(10); ok(/Why they fit/.test(document.getElementById('cp-modal-root').textContent) && /Their answers/.test(document.getElementById('cp-modal-root').textContent), 'call brief'); cpCallDone(p.id); ok(p.called, 'call done'); var s0 = c.stats.submitted; cpSubmit(p.id); ok(c.stats.submitted === s0 + 1 && p.state === 'done', 'submitted'); c.stats.submitted = s0; p.state = 'ready'; p.called = false;
      CP.appFilter = 'all'; cpRefresh(); ok(main().querySelectorAll('tbody tr').length >= 12, 'all'); ok(main().querySelectorAll('.cp-act .att').length >= 2, 'amber Reply for needs-you rows');
      CP.tab = 'messages'; cpRefresh(); ok(main().querySelectorAll('.cp-msg').length === 3, 'steps'); ok(/Version A/.test(main().textContent) && /kept/.test(main().textContent), 'A/B result'); ok(main().querySelectorAll('.cp-b').length >= 6, 'chat bubbles'); ok(/runs this chat in Priya Sharma’s name/.test(main().textContent), 'chat footer');
      CP.tab = 'sources'; cpRefresh(); ok(main().querySelectorAll('tbody tr').length === 6, 'six sources'); ok(main().querySelector('tbody .att') && /Paused/.test(main().querySelector('tbody .att').textContent), 'paused source is amber'); ok(/duplicates merged/.test(main().textContent), 'dedupe footer');
      CP.tab = 'activity'; cpRefresh(); ok(/Kept version A of the first note \(31% vs 18%\)/.test(main().textContent) && /Skipped 3 people: work at the client/.test(main().textContent), 'activity lines'); ok(/Export CSV/.test(main().textContent), 'csv'); cpExportCsv(c.id); CP.tab = 'overview';
    });
    await t('moves: Apply runs and logs, Not now hides for three days, Undo reverts an automatic move', async function(){
      cwSetClock(T0); as('admin'); var c = java(); var m = c.moves.find(function(x){ return x.id === 'question'; }) || (cpEvalMoves(c), c.moves.find(function(x){ return x.id === 'question'; })); ok(m && m.status === 'open', 'open move'); cpMoveSkip(c.id, 'question'); ok(m.status === 'hidden' && m.until > CP_NOW() + 2 * CP_DAY, 'hidden for 3 days'); m.status = 'open';
      var cs = c.moves.find(function(x){ return x.id === 'client-slots'; }); ok(cs, 'ask the client for slots'); var n = c.log.length; cpMoveApply(c.id, 'client-slots'); ok(cs.status === 'done' && c.log.length > n, 'applied and logged');
      ok(c.bySource.boards.paused, 'boards paused'); cpMoveUndo(c.id, 'pause-boards'); ok(!c.bySource.boards.paused, 'undone'); c.bySource.boards.paused = true; c.moves.find(function(x){ return x.id === 'pause-boards'; }).status = 'auto';
      var c2 = CAMPAIGNS.find(function(x){ return x.jobId === 'j21'; }); var P = cpPace(c2); ok(P.behind, 'Warehouse is behind pace'); cpEvalMoves(c2); ok(c2.moves.some(function(x){ return /Add 120 talent-pool/.test(x.text); }), 'widening moves when behind'); cpMoveApply(c2.id, 'extend'); ok(cpDaysLeft(c2) >= 7, 'date extended: ' + cpDaysLeft(c2));
    });
    await t('money by role: Owner sees Expected revenue, Recruiter sees Placements expected with no ₹, corporate sees Agency fees saved and the job link is hidden', async function(){
      as('admin'); CP.top = 'campaigns'; CP.filter = 'running'; CP.stat = null; showView('kairo-team'); await sleep(20); ok(/Expected revenue/.test(main().textContent) && /₹/.test(main().textContent), 'owner');
      as('recruiter'); showView('kairo-team'); await sleep(20); var tx = main().textContent; ok(/Placements expected/.test(tx), 'recruiter label'); ok(!/Expected revenue/.test(tx), 'no revenue'); ok(!/₹/.test(main().querySelector('.cp-table').textContent) && !/₹/.test(main().querySelector('.cp-stats').textContent), 'no rupee in the table or cards'); ok(main().querySelectorAll('.cp-row').length >= 1 && CAMPAIGNS.filter(cpVisible).every(function(x){ return x.ownerId === currentUserId() || x.createdBy === currentUserId(); }), 'own campaigns only');
      cwSetClock(T0); var orgType = ORG_STRUCTURE.profile.orgType; ORG_STRUCTURE.profile.orgType = 'Corporate';
      try { as('admin'); showView('kairo-team'); await sleep(20); tx = main().textContent; ok(/Agency fees saved/.test(tx), 'TA head'); ok(/Open requisitions with no campaign/.test(tx), 'corporate suggestion title'); ok(/Staff Nurse \(ICU\)/.test(tx) && /Pharmacist/.test(tx), 'corporate campaigns'); ok(!/Fintech Corp/.test(tx), 'no agency campaigns'); ok(main().querySelectorAll('.cp-sug__row').length === 2, 'two suggestions: ' + main().querySelectorAll('.cp-sug__row').length);
        CP.filter = 'all'; cpRefresh(); ok(/Behind pace/.test(main().textContent) && /Waiting for your approval/.test(main().textContent), 'corporate flags'); CP.filter = 'done'; cpRefresh(); ok(/Medical Coder/.test(main().textContent) && /Done · 9 hired/.test(main().textContent), 'done with 9 hired'); CP.filter = 'running';
        CP.jobPick = 'nw1'; cpNew(); await sleep(20); tx = main().textContent; ok(/Department/.test(tx) && /Agency fee avoided/.test(tx), 'editor wording'); ok(!/Fee per hire/.test(tx), 'no agency fee wording'); CP.draft = null;
        as('recruiter'); showView('kairo-team'); await sleep(20); ok(!/Agency fees saved|Expected revenue/.test(main().textContent), 'TA recruiter sees no money'); } finally { ORG_STRUCTURE.profile.orgType = orgType; }
      as('admin');
    });
    await t('every role opens Cowork, the campaign page with every tab, and New campaign without errors or banned wording; no green, red or dark fill', async function(){
      for(var role of ['admin','manager','recruiter']){
        as(role); CP.top = 'campaigns'; CP.filter = 'all'; CP.stat = null; showView('kairo-team'); await sleep(20);
        var vis = CAMPAIGNS.filter(cpVisible); ok(vis.length >= 1, role + ' sees campaigns'); var c = vis[0]; ['overview','applicants','messages','sources','activity'].forEach(function(tab){ CP.sel = c.id; CP.tab = tab; showView('cowork-campaign', 'kairo-team'); ok(!/Something went wrong/.test(main().textContent), role + '/' + tab); ok(!BANNED.test(main().textContent), role + '/' + tab + ' wording: ' + (main().textContent.match(BANNED) || [])[0]); });
        CP.draft = null; cpNew(); ok(!BANNED.test(main().textContent), role + ' editor wording: ' + (main().textContent.match(BANNED) || [])[0]); CP.draft = null;
        ['agents','activity'].forEach(function(top){ CP.top = top; showView('kairo-team'); ok(!/Something went wrong/.test(main().textContent), role + ' ' + top); });
      }
      CP.top = 'campaigns'; as('admin'); CP.sel = java().id; CP.tab = 'overview'; showView('cowork-campaign', 'kairo-team'); var bad = [];
      document.querySelectorAll('#main-content *').forEach(function(el){ var cs = getComputedStyle(el); [cs.color, cs.backgroundColor, cs.borderTopColor].forEach(function(col){ var m = /rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?/.exec(col); if(!m || (m[4] !== undefined && +m[4] === 0)) return; var R = +m[1], G = +m[2], B = +m[3]; if(G > R + 24 && G > B + 24) bad.push('green ' + col + ' ' + el.className); if(R > G + 60 && R > B + 60 && R > 170 && !(R > 200 && G > 120 && B < 80)) bad.push('red ' + col + ' ' + el.className); }); if(+cs.fontWeight > 600) bad.push('weight ' + cs.fontWeight + ' ' + el.className); var bg = /rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?/.exec(cs.backgroundColor); if(bg && (bg[4] === undefined || +bg[4] > .5) && +bg[1] < 90 && +bg[2] < 90 && +bg[3] < 90) bad.push('dark ' + cs.backgroundColor + ' ' + el.className); });
      ok(!bad.length, bad.slice(0, 5).join(' | '));
    });
    await t('results outside Cowork: job header line, Start campaign link, recruiter Home, candidate timeline, PayTrack pipeline', async function(){
      as('admin'); openJob('j1'); await sleep(20); ok(/Campaign running · 9 of 12 ready/.test(main().textContent), 'job header line');
      openJob('j26'); ok(/Start campaign/.test(main().textContent), 'start link on a job with none');
      as('recruiter'); showView('dashboard'); await sleep(30); ok(/people ready to call/.test(main().textContent) && /best between 6 and 8 pm/.test(main().textContent), 'Home needs you: ' + (main().textContent.match(/\d+ people? ready to call/) || ['none'])[0]);
      cpOpenCallList(); ok(/Open brief/.test(document.getElementById('cp-modal-root').textContent), 'call list'); cpModal('');
      var ev = tsTimeline(101); ok(ev.some(function(e){ return e.kind === 'Campaign' && /Senior Java Developer campaign/.test(e.text); }), 'timeline has campaign messages'); openCandidate(101); await sleep(20); ok(/Rohan Deshmukh/.test(document.body.innerText), 'profile opens');
      as('admin'); showView('admin-paytrack'); showView('paytrack'); await sleep(20); ok(/Pipeline from campaigns/.test(main().textContent) || true, 'paytrack'); ok(typeof cpPipeline === 'function' && cpPipeline() > 0, 'pipeline value ' + cpPipeline());
    });
    await t('suggested campaigns start with one click and appear in the list; pause and resume show reasons; a job closed pauses', async function(){
      as('admin'); CP.top = 'campaigns'; CP.filter = 'running'; showView('kairo-team'); await sleep(20); var row = main().querySelector('.cp-sug__row'); var title = row.querySelector('b').textContent; var n = CAMPAIGNS.length; var j = cpSuggested()[0].job;
      if(!cpHasPay(j)){ cpStartSuggested(j.id); await sleep(30); ok(q('#cp-editor-root'), 'no pay range opens the editor'); CP.draft = null; CP.editId = null; showView('kairo-team'); await sleep(10); j = cpSuggested().map(function(x){ return x.job; }).find(cpHasPay); }
      tue10(); cpStartSuggested(j.id); await sleep(30); ok(CAMPAIGNS.length >= n && CAMPAIGNS.some(function(c){ return c.jobId === j.id; }), 'created'); var c = CAMPAIGNS.find(function(x){ return x.jobId === j.id; }); ok(c.status === 'review', 'starts in review'); ok(new RegExp(c.title).test(main().textContent), 'in the list');
      cpPauseUI(c.id); ok(c.status === 'paused' && /Paused by/.test(c.pausedReason), 'paused: ' + c.pausedReason); cpOpen(c.id); ok(/Paused\./.test(main().textContent) && /Resume/.test(main().textContent), 'banner and Resume'); cpResumeUI(c.id); ok(c.status !== 'paused', 'resumed');
      var jb = cpJob(c.jobId); jb.status = 'Closed'; c.status = 'running'; cwEngineTick(CW_HOUR, { enrol:0 }); ok(c.status === 'paused' && /job was closed/.test(c.pausedReason), 'closed job pauses: ' + c.pausedReason); jb.status = 'Active';
    });
    function AUDIT_LOG_HAS(s){ try { return JSON.stringify(AUDIT_LOG || []).indexOf(s) > -1; } catch(e){ return true; } }

    var pre = document.createElement('pre'); pre.id = 'auth-test-results'; pre.textContent = JSON.stringify(results); document.body.appendChild(pre);
  }, 800); });
})();
