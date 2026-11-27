// @rx-runner switches=g1,g6
/* RX G6: interview self-booking — a booked interview is identical to one scheduled by hand, a taken slot disappears
   for others, a reschedule after the cutoff is refused with a message; plus slots, cancel, the event and the action.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\rx-g6-booking.spec.js */
(function(){
  var results = [];
  var errs = [];
  window.__RX_NO_TIMER__ = true;
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e && e.message || e) }); } pub(); }
  function pub(){ var pre = document.getElementById('auth-test-results'); if(!pre){ pre = document.createElement('pre'); pre.id = 'auth-test-results'; document.body.appendChild(pre); } pre.textContent = JSON.stringify(results); }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function eq(a, b, m){ if(a !== b) throw new Error((m ? m + ': ' : '') + 'expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a)); }
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var H = 3600000;
  function as(role){ viewingAsFromManager = false; managerViewAsRecruiterId = null; previewAsRoleId = null; state.role = role; renderSidebar(); }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    var app = document.getElementById('app'); app.classList.remove('hidden'); app.classList.add('flex');
    as('admin');
    var subs = SUBMISSIONS.filter(function(s){ return subPhase(s) === 'process' && !hmInterviews.some(function(iv){ return iv.submissionId === s.id && iv.status !== 'Cancelled'; }); });
    var s1 = subs[0], s2 = subs.find(function(s){ return s.jobId === s1.jobId && s !== s1; }) || subs[1], s3 = subs.find(function(s){ return s !== s1 && s !== s2; });
    var who = clientContacts(jobById(s1.jobId).client)[0].name;

    await t('setup: three profiles in the client process; G6 on with defaults', async function(){
      ok(s1 && s2 && s3, 'submissions: ' + subs.length); ok(rxOn('g6')); eq(WSX.rx.bookingSlots, 6); eq(WSX.rx.rescheduleCutoffHours, 12);
    });
    var tk1, slots1, iv1;
    await t('the link page shows up to 6 free slots over the next 5 working days', async function(){
      var r = rxBookLink(s1.id, who); ok(r.ok, JSON.stringify(r)); tk1 = r.token;
      location.hash = '#/book/' + tk1; await sleep(30);
      var btns = document.querySelectorAll('#rx-book-root [data-slot]'); ok(btns.length > 0 && btns.length <= 6, 'slots ' + btns.length);
      slots1 = rxFreeSlots(who, tk1); var last = slots1[slots1.length - 1]; ok(last - Date.now() < 9 * 86400000, 'within the next working days');
    });
    await t('booking goes through the hand path: interview saved, stage moved, Interview Scheduled emitted', async function(){
      var n = hmInterviews.length; document.querySelector('#rx-book-root [data-slot="' + slots1[0] + '"]').click();
      eq(hmInterviews.length, n + 1, 'one interview'); iv1 = hmInterviews[0]; eq(iv1.submissionId, s1.id); eq(Date.parse(iv1.at), slots1[0]); eq(iv1.interviewerName, who);
      eq(subById(s1.id).stage, 'Interview Scheduled'); ok(RX.events.some(function(e){ return e.event === 'Interview Scheduled' && e.submissionId === s1.id; }), 'event');
      ok(/Booked/.test(document.getElementById('rx-book-root').textContent), 'page says booked');
      ok(RX.g6.sent.some(function(x){ return x.kind === 'booking confirmation' && x.to === who; }), 'confirmation (simulated)');
    });
    await t('a booked interview is identical to one scheduled by hand', async function(){
      var slot = rxFreeSlots(who)[2], d = new Date(slot);
      pipeOpenSchedule(s2.id); ivState.date = fuLocalDateValue(d); ivState.time = fuLocalTimeValue(d); ivState.interviewer = who; ivSave();
      var iv2 = hmInterviews[0]; eq(iv2.submissionId, s2.id);
      var k1 = Object.keys(iv1).sort().join(), k2 = Object.keys(iv2).sort().join(); eq(k1, k2, 'same fields');
      ['mode', 'status', 'duration', 'meetingLink', 'meetProvider', 'calendarEvent', 'venue', 'interviewerName', 'candidateConfirmed', 'interviewerConfirmed'].forEach(function(f){ eq(JSON.stringify(iv1[f]), JSON.stringify(iv2[f]), f); });
    });
    await t('a taken slot disappears for others and cannot be booked', async function(){
      var r = rxBookLink(s3.id, who); ok(r.ok); var free = rxFreeSlots(who, r.token);
      ok(free.indexOf(slots1[0]) < 0, 'taken slot gone'); ok(!rxBook(r.token, slots1[0]).ok, 'refused');
      ok(/just taken/.test(rxBook(r.token, slots1[0]).reason));
    });
    await t('reschedule before the cutoff moves the same interview; after the cutoff it is refused with a message', async function(){
      var to = rxFreeSlots(who, tk1).find(function(x){ return x !== slots1[0]; }); var r = rxBook(tk1, to); ok(r.ok && r.rescheduled, JSON.stringify(r));
      eq(hmInterviews.filter(function(x){ return x.submissionId === s1.id && x.status !== 'Cancelled'; }).length, 1, 'same interview'); ok((iv1.rescheduleHistory || []).length === 1, 'history'); eq(Date.parse(iv1.at), to);
      var l = RX.g6.links[tk1]; l.slot = Date.now() + 5 * H; iv1.at = new Date(l.slot).toISOString();
      var other = rxFreeSlots(who, tk1)[0], before = iv1.at, r2 = rxBook(tk1, other); ok(!r2.ok && /contact/.test(r2.reason), JSON.stringify(r2)); eq(iv1.at, before, 'unchanged');
      ok(!rxBookCancel(tk1).ok, 'cancel refused too');
      location.hash = '#/book/' + tk1; await sleep(30); rxBookDraw(); ok(/too close/.test(document.getElementById('rx-book-root').textContent), 'the page says so');
    });
    await t('cancel before the cutoff uses ivCancel', async function(){
      var r = rxBookLink(s3.id, who), sl = rxFreeSlots(who, r.token)[0]; ok(rxBook(r.token, sl).ok); var iv = hmInterviews.find(function(x){ return x.id === RX.g6.links[r.token].ivId; });
      ok(rxBookCancel(r.token).ok); eq(iv.status, 'Cancelled'); eq(RX.g6.links[r.token].status, 'cancelled');
      ok(rxFreeSlots(who).indexOf(sl) > -1, 'slot free again');
    });
    await t('interviewer free hours: the schedule dialog offers the link and the hours limit the slots', async function(){
      location.hash = ''; await sleep(30);
      var s4 = SUBMISSIONS.find(function(s){ return subPhase(s) === 'process' && s !== s1 && s !== s2 && s !== s3; }) || s2;
      pipeOpenSchedule(s4.id); ok(document.getElementById('rx-book-panel'), 'panel on the dialog'); ivScheduleClose();
      ok(!rxSetAvailability('Spec Panel', { days:[], from:'10:00', to:'12:00' }).ok, 'needs a day');
      ok(rxSetAvailability('Spec Panel', { days:[2], from:'10:00', to:'12:00', tz:'Asia/Kolkata' }).ok);
      var sl = rxFreeSlots('Spec Panel'); ok(sl.length > 0 && sl.length <= 2, 'only Tuesday 10–12: ' + sl.length);
      sl.forEach(function(x){ var d = new Date(x + 330 * 60000); ok(d.getUTCDay() === 2 && d.getUTCHours() >= 10 && d.getUTCHours() < 12, 'in hours'); });
    });
    await t('workflow action Send booking link; median days from shortlist to booked', async function(){
      var wf = { id:'wf-rx-book', name:'Booking', status:'Published', templateStatus:'Approved', trigger:'Manual Trigger', agentKey:'interviews', conditions:[], conditionLogic:'AND', steps:[{ kind:'do', type:'rxBookingLink' }] };
      WORKFLOWS.push(wf); var c = byId(s2.candidateId); c.consent = { given:true };
      var r = rxRunWorkflow(wf, { event:'Manual Trigger', candidateId:c.id, submissionId:s2.id, eventId:'spec-book' }); ok(r.ok, JSON.stringify(r));
      ok(RX.touches.some(function(x){ return x.workflowId === wf.id && /booking link/.test(x.outcome); }), 'link sent');
      var m = rxBookingMedianDays(s1.jobId); ok(m === null || m >= 0, 'median ' + m);
      openJob(s1.jobId); ok(document.getElementById('rx-book-metric'), 'on the job');
    });
    await t('switch off: no page, no panel, no metric', async function(){
      rxSetSwitch('g6', false); location.hash = '#/book/' + tk1; await sleep(30); eq(document.getElementById('rx-book-root').innerHTML, '');
      location.hash = ''; await sleep(20); openJob(s1.jobId); ok(!document.getElementById('rx-book-metric'));
      rxSetSwitch('g6', true);
    });
    pub();
  }, 300); });
})();
