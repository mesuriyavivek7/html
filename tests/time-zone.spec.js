/* Time zone · business days are computed in the workspace's time zone (ORG_STRUCTURE.profile.timezone), never in UTC and never
   in the browser's own zone. The main date rules run at 00:30 and 23:30 Asia/Kolkata, and with the workspace in Europe/London
   (including a clock change): replacement window end, invoice due date, invoice month split for a week crossing months, terms
   version on the offer date, timesheet day, SLA reassignment and approval business hours.
   Expected instants are written here from fixed offsets (IST +5:30, GMT +0, BST +1), not with the product's own helper.
   Run it with the browser in UTC and in Asia/Kolkata; every result must be the same.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\time-zone.spec.js */
(function(){
  var results = [];
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  var ce = console.error; console.error = function(){ errs.push('console.error ' + Array.prototype.slice.call(arguments).map(function(a){ return (a && a.stack) || (a && a.message) || String(a); }).join(' ').slice(0, 300)); };
  var TZ0 = '', H = 3600000, D = 86400000;
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e.stack || e.message).slice(0, 500) }); }
    finally { ORG_STRUCTURE.profile.timezone = TZ0; FM.offset = 0; state.role = 'admin'; viewingAsFromManager = false; managerViewAsRecruiterId = null; } }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  // Wall time → instant, from a fixed offset in minutes (written out here on purpose).
  function wall(y, m, d, hh, mm, offMin){ return Date.UTC(y, m - 1, d, hh, mm) - offMin * 60000; }
  var IST = 330, GMT = 0, BST = 60;
  function setNow(ms){ FM.offset = ms - Date.now(); }
  function london(){ ORG_STRUCTURE.profile.timezone = 'Europe/London (GMT, UTC+0)'; }
  function rec(dojIso, days){ return { doj:'', dojIso:dojIso, replacementDays:days }; }
  function raised(dueAt){ return { invoice:{ no:'TZ-1', state:'Raised', dueAt:dueAt, payments:[], credits:[], taxSnapshot:{ fee:100, total:118 } } }; }
  var seq = 0;
  function mkJob(){ seq++; var j = Object.assign(JSON.parse(JSON.stringify(jobById('j4'))), { id:'tzj' + seq, title:'TZ Role ' + seq, status:'Active', submitted:0, publicLinkCode:null,
    candidateIds:[], interested:[], recs:[], organizationId:CURRENT_ORGANIZATION_ID, assignedRecruiters:['RP-081','RP-071'], applicantRouting:'round_robin' }); JOBS.push(j); return j; }
  function apply(j){ seq++; var r = ingestApplicationEvent(j.id, { name:'TZ Applicant ' + seq, email:'tz' + seq + '@example.com', phone:'+91 94000 ' + String(10000 + seq), role:'Product Manager', skills:['Product'] }, { platform:'Careers Page' }); ok(r.ok, 'applied'); return r.submission; }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    state.role = 'admin'; enterApp(); await sleep(100); FM.interactive = false; TZ0 = ORG_STRUCTURE.profile.timezone;
    var browser = Intl.DateTimeFormat().resolvedOptions().timeZone;

    await t('the workspace zone is read from Settings; the day at 00:30 and 23:30 IST is the IST day (browser: ' + browser + ')', async function(){
      ok(wsTz() === 'Asia/Kolkata', 'demo workspace: ' + wsTz());
      ok(wsDay(wall(2026, 11, 2, 0, 30, IST)) === '2026-11-02' && wsDay(wall(2026, 11, 2, 23, 30, IST)) === '2026-11-02', '00:30 and 23:30 are both 2 Nov');
      ok(ptLocalDay(new Date(wall(2026, 11, 2, 0, 30, IST))) === '2026-11-02' && clIso(wall(2026, 11, 2, 0, 30, IST)) === '2026-11-02' && coIso(wall(2026, 11, 2, 0, 30, IST)) === '2026-11-02' && asIso(wall(2026, 11, 2, 0, 30, IST)) === '2026-11-02', 'the old helpers agree');
      ok(wsDayStart('2026-11-02') === wall(2026, 11, 2, 0, 0, IST) && coIsoMs('2026-11-02') === wall(2026, 11, 2, 0, 0, IST), '00:00 IST is the start of the day');
      london(); ok(wsTz() === 'Europe/London' && wsDay(wall(2026, 7, 14, 0, 30, BST)) === '2026-07-14' && wsDay(wall(2026, 7, 14, 23, 30, BST)) === '2026-07-14', 'London in summer (BST)');
    });

    await t('replacement window end: 90 calendar days from joining, passing at 00:00 in the workspace zone', async function(){
      var r = rec('2026-11-02', 90);   // ends 31 Jan 2027
      ok(wsDay(ptWindowEnd(r).getTime()) === '2027-01-31' && ptWindowEnd(r).getTime() === wall(2027, 1, 31, 0, 0, IST), 'ends 00:00 IST, 31 Jan');
      setNow(wall(2027, 1, 30, 23, 30, IST)); ok(!ptWindowPassed(r), '23:30 IST on 30 Jan: not passed');
      setNow(wall(2027, 1, 31, 0, 30, IST)); ok(ptWindowPassed(r), '00:30 IST on 31 Jan: passed');
      london(); var l = rec('2026-07-28', 90);   // ends 26 Oct 2026, the day after the clocks go back
      ok(ptWindowEnd(l).getTime() === wall(2026, 10, 26, 0, 0, GMT), 'London: ends 00:00 GMT on 26 Oct (not 23:00 the day before)');
      setNow(wall(2026, 10, 25, 23, 30, GMT)); ok(!ptWindowPassed(l), 'London 23:30 on 25 Oct: not passed');
      setNow(wall(2026, 10, 26, 0, 30, GMT)); ok(ptWindowPassed(l), 'London 00:30 on 26 Oct: passed');
    });

    await t('invoice due date: the day paymentDays after it was raised; overdue from the next day', async function(){
      [[0, 30], [23, 30]].forEach(function(x){ var at = wall(2026, 11, 2, x[0], x[1], IST), due = ptDueIso(new Date(at), 30);
        ok(wsDay(due) === '2026-12-02', 'raised ' + x.join(':') + ' IST on 2 Nov → due 2 Dec, got ' + wsDay(due)); });
      var r = raised(ptDueIso(new Date(wall(2026, 11, 2, 0, 30, IST)), 30));
      setNow(wall(2026, 12, 2, 23, 30, IST)); ok(!ptOverdue(r), '23:30 IST on the due day: not overdue');
      setNow(wall(2026, 12, 3, 0, 30, IST)); ok(ptOverdue(r), '00:30 IST the next day: overdue');
      london(); var l = raised(ptDueIso(new Date(wall(2026, 9, 30, 23, 30, BST)), 30)); ok(wsDay(l.invoice.dueAt) === '2026-10-30', 'London: raised 23:30 BST 30 Sep → due 30 Oct, got ' + wsDay(l.invoice.dueAt));
    });

    await t('invoice month split: a week crossing months splits at midnight in the workspace zone', async function(){
      var mon = coMonday(wall(2026, 12, 2, 0, 30, IST)), days = asWeekDates(mon);
      ok(days[0] === '2026-11-30' && days[1] === '2026-12-01' && days[6] === '2026-12-06', 'week of 30 Nov: ' + days.join());
      var nov = asMonthBounds('2026-11'), dec = asMonthBounds('2026-12'), inNov = days.filter(function(d){ var m = asMs(d); return m >= nov.f && m <= nov.t; }), inDec = days.filter(function(d){ var m = asMs(d); return m >= dec.f && m <= dec.t; });
      ok(inNov.join() === '2026-11-30' && inDec.length === 6, 'November gets 1 day, December 6: ' + inNov.join() + ' / ' + inDec.length);
      ok(nov.f === wall(2026, 11, 1, 0, 0, IST) && nov.t === wall(2026, 11, 30, 0, 0, IST), 'month bounds at 00:00 IST');
      london(); var lm = coMonday(wall(2026, 10, 26, 0, 30, GMT)); ok(asWeekDates(lm)[0] === '2026-10-26' && lm === wall(2026, 10, 26, 0, 0, GMT), 'London, the Monday after the clock change: ' + asWeekDates(lm)[0]);
      var sep = asWeekDates(coMonday(wall(2026, 10, 1, 0, 30, BST))); ok(sep[0] === '2026-09-28' && sep.filter(function(d){ return d.slice(0, 7) === '2026-09'; }).length === 3, 'London, the week of 28 Sep: 3 days in September');
    });

    await t('terms version on the offer date: the version in force on that workspace day', async function(){
      var c = JSON.parse(JSON.stringify(clientById('c1'))); c.id = 'tz-c'; c.commercials = [{ version:1, effectiveFrom:'2026-01-01', feeType:'percent', pct:8.33 }, { version:2, effectiveFrom:'2026-11-02', feeType:'percent', pct:10 }];
      ok(clCommercial(c, wall(2026, 11, 1, 23, 30, IST)).version === 1, '23:30 IST on 1 Nov: v1');
      ok(clCommercial(c, wall(2026, 11, 2, 0, 30, IST)).version === 2, '00:30 IST on 2 Nov: v2');
      london(); ok(clCommercial(c, wall(2026, 11, 1, 23, 30, GMT)).version === 1 && clCommercial(c, wall(2026, 11, 2, 0, 30, GMT)).version === 2, 'London: the same split at London midnight');
    });

    await t('timesheet day: the day and its week come from the workspace zone', async function(){
      var sun = wall(2026, 11, 8, 23, 30, IST), monAm = wall(2026, 11, 9, 0, 30, IST);
      ok(asIso(sun) === '2026-11-08' && wsDow(asIso(sun)) === 0 && asIso(coMonday(sun)) === '2026-11-02', '23:30 IST Sunday 8 Nov is Sunday, week of 2 Nov');
      ok(asIso(monAm) === '2026-11-09' && asIso(coMonday(monAm)) === '2026-11-09', '00:30 IST Monday 9 Nov starts the next week');
      london(); var ls = wall(2026, 10, 25, 23, 30, GMT); ok(asIso(ls) === '2026-10-25' && asIso(coMonday(ls)) === '2026-10-19', 'London: 23:30 on the clock-change Sunday still belongs to the week of 19 Oct');
    });

    await t('SLA reassignment: 24 hours after it arrived, whatever the hour or the zone', async function(){
      [wall(2026, 11, 2, 0, 30, IST), wall(2026, 11, 2, 23, 30, IST)].forEach(function(at){
        setNow(at); var j = mkJob(), a = apply(j); ok(a.recruiterId === 'RP-081', 'starts with Divya');
        setNow(at + 23 * H); fmSlaSweep(); ok(a.recruiterId === 'RP-081', 'after 23 hours: stays');
        setNow(at + 25 * H); fmSlaSweep(); ok(a.recruiterId === 'RP-071', 'after 25 hours: moved'); });
      london(); var at = wall(2026, 10, 24, 23, 30, BST); setNow(at); var j = mkJob(), a = apply(j);
      setNow(at + 23 * H); fmSlaSweep(); ok(a.recruiterId === 'RP-081', 'London, across the clock change: stays at 23 hours'); setNow(at + 25 * H); fmSlaSweep(); ok(a.recruiterId === 'RP-071', 'moved at 25 hours');
    });

    await t('approval business hours: 09:30–18:30 in the workspace zone, Monday to Saturday', async function(){
      ok(APS.addBusinessMinutes(wall(2026, 11, 3, 23, 30, IST), 60) === wall(2026, 11, 4, 10, 30, IST), '23:30 IST Tue + 1 hour → 10:30 IST Wed');
      ok(APS.addBusinessMinutes(wall(2026, 11, 4, 0, 30, IST), 60) === wall(2026, 11, 4, 10, 30, IST), '00:30 IST Wed + 1 hour → 10:30 IST Wed');
      london();
      ok(APS.addBusinessMinutes(wall(2026, 7, 14, 23, 30, BST), 60) === wall(2026, 7, 15, 10, 30, BST), 'London summer: 23:30 BST + 1 hour → 10:30 BST next day');
      ok(APS.addBusinessMinutes(wall(2026, 10, 24, 18, 0, BST), 60) === wall(2026, 10, 26, 10, 0, GMT), 'London: across the clock change → Monday 10:00 GMT');
    });

    await t('an interview booked from the client link shows the IST time, lands on the IST calendar day, and the .ics carries UTC', async function(){
      var c = { id:99960 + (++seq), name:'TZ Interviewee', role:'Product Manager', skills:['Product'], email:'tzi' + seq + '@example.com', organizationId:CURRENT_ORGANIZATION_ID }; CANDIDATES.push(c);
      var sb = createSubmission('j4', c.id, { source:'Manual', recruiterId:'RP-081', stage:'Submitted' }), l = slFor('client', 'TZ Client', 'tz.client@example.com', { submissionIds:[sb.id], jobId:'j4' }, 'HealthAI');
      var at = wall(2027, 1, 6, 10, 0, IST);   // Wednesday 6 Jan 2027, 10:00 IST = 04:30 UTC
      SL.token = l.token; SL.draft = { slot:at }; slBook(sb.id); var iv = hmInterviews.find(function(x){ return x.submissionId === sb.id; });
      ok(iv && iv.at === '2027-01-06T04:30:00.000Z', 'stored as the UTC instant: ' + (iv && iv.at));
      ok(/^Wed, Jan 6, 10:00 AM IST$/.test(iv.date), 'shown in IST with the zone named: ' + iv.date);
      ok(ivMid(ivStart(iv)) === wall(2027, 1, 6, 0, 0, IST) && wsDay(ivStart(iv)) === '2027-01-06', 'on the 6 Jan calendar day');
      var differs = new Date(at).getTimezoneOffset() !== -330, note = ivLocal(at); ok(differs ? note === ' (4:30 AM your time)' || /your time\)$/.test(note) : note === '', 'the viewer’s own time only when the browser is elsewhere: “' + note + '”');
      ok(/10:00 AM IST/.test(SL.done.body), 'the link says the same: ' + SL.done.body);
      var made = '', B = window.Blob; window.Blob = function(parts){ made = parts.join(''); return new B(parts); }; var ca = document.createElement; document.createElement = function(tag){ var e = ca.call(document, tag); if(tag === 'a') e.click = function(){}; return e; };
      try { slIcs(iv.id); } finally { window.Blob = B; document.createElement = ca; } ok(/DTSTART:20270106T043000Z/.test(made), '.ics DTSTART in UTC: ' + (made.match(/DTSTART:\S+/) || [''])[0]);
      SL.token = null;
    });

    await t('a campaign step doesn’t send at night in IST, even when the browser’s clock says it is daytime', async function(){
      var c = CAMPAIGNS.find(function(x){ return x.status === 'running' && cpPeopleOf(x).length; }) || CAMPAIGNS.find(function(x){ return cpPeopleOf(x).length; }), st0 = c.status, p = cpPeopleOf(c)[0], clk = CW.clock, hours = c.rules.hours, days = c.rules.days;
      c.status = 'running'; c.rules.hours = '09:00-19:00'; c.rules.days = [1,2,3,4,5,6];
      try {
        [[2, 0], [23, 30]].forEach(function(x){ var at = wall(2026, 11, 3, x[0], x[1], IST);   // Tue 3 Nov; 23:30 IST is 18:00 UTC, daytime for a UTC browser
          cwSetClock(at); var r = cpSendCheck(c, p, p.step); ok(r && /Outside send hours/.test(r.blocked || ''), x.join(':') + ' IST: held, ' + JSON.stringify(r)); ok(!cwInWindow(at, '09:00-19:00'), x.join(':') + ' IST: outside the Cowork window'); });
        var day = wall(2026, 11, 3, 11, 0, IST); cwSetClock(day); var r2 = cpSendCheck(c, p, p.step); ok(!(r2 && /Outside send hours/.test(r2.blocked || '')) && cwInWindow(day, '09:00-19:00'), '11:00 IST: inside the send hours');
        london(); var ln = wall(2026, 11, 3, 23, 30, GMT); cwSetClock(ln); ok(/Outside send hours/.test((cpSendCheck(c, p, p.step) || {}).blocked || ''), 'London 23:30: held');
      } finally { CW.clock = clk; c.status = st0; c.rules.hours = hours; c.rules.days = days; }
    });

    var pre = document.createElement('pre'); pre.id = 'auth-test-results'; pre.textContent = JSON.stringify(results); document.body.appendChild(pre);
    document.title = 'TZ ' + results.filter(function(r){ return r.pass; }).length + '/' + results.length;
  }, 800); });
})();
