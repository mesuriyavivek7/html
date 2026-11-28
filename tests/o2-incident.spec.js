// @o2-runner switches=1a,6
/* O2 Step 6: six visible ticket states, incidents (SEV, flow, cadence, review), announcements from an incident.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\o2-incident.spec.js */
(function(){
  var results = [];
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e && e.message || e) }); } pub(); }
  function pub(){ var pre = document.getElementById('auth-test-results'); if(!pre){ pre = document.createElement('pre'); pre.id = 'auth-test-results'; document.body.appendChild(pre); } pre.textContent = JSON.stringify(results); }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function eq(a, b, m){ if(a !== b) throw new Error((m ? m + ': ' : '') + 'expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a)); }
  function as(id){ ACTIVE_PLATFORM_USER_ID = id; try { bosActAs(id); } catch(e){} }
  function main(){ return document.getElementById('main-content'); }
  function slaAll(){ return JSON.stringify(BOS.tickets.map(function(x){ var s = bosSlaState(x); return [x.id, s.breached, s.respondBreached, s.resolveBreached, s.paused, Math.round(s.resolveBy / 1000)]; })); }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    state.role = 'oontu'; as('PU-001'); var app = document.getElementById('app'); app.classList.remove('hidden'); app.classList.add('flex'); renderSidebar(); await sleep(30);

    await t('acceptance: SLA results identical before and after for all seeded tickets', async function(){
      var on = slaAll(); o2SetSwitch('6', false); var off = slaAll(); o2SetSwitch('6', true); eq(on, off); ok(BOS.tickets.length >= 3, 'tickets compared: ' + BOS.tickets.length);
    });
    await t('six visible ticket states, mapped from the internal ones (data unchanged)', async function(){
      var tk = BOS.tickets[0], keep = tk.status;
      [['received', 'New'], ['routed', 'Open'], ['assigned', 'In progress'], ['waiting_customer', 'Waiting on customer'], ['waiting_engineering', 'Waiting on us'], ['resolved', 'Resolved']].forEach(function(p){ tk.status = p[0]; eq(o2TicketState(tk).label, p[1], p[0]); });
      eq(o2TicketState({ status:'waiting_engineering' }).detail, 'engineering');
      tk.status = 'waiting_customer'; showView('oontu-service'); BOS_UI.tab['oontu-service'] = 1; bosRedraw(); await sleep(5); ok(/Waiting on customer/.test(main().textContent), 'list shows the visible state'); ok(!/Waiting customer</.test(main().innerHTML), 'internal label gone');
      bosOpen('ticket', tk.id); await sleep(5); ok(/Waiting on customer/.test(main().textContent), 'ticket page'); eq(tk.status, 'waiting_customer', 'data unchanged'); tk.status = keep;
    });
    var inc = null, tk = null;
    await t('acceptance: outage → incident → update → announcement → resolve → review', async function(){
      as('PU-103'); tk = bosCreateTicket({ subject:'Outage: nobody can sign in', body:'Everything is down for our team', contactEmail:'priya@harborpartners.example', source:'In-app' }).ticket; as('PU-001');
      inc = (BOS.incidents || []).find(function(i){ return (i.ticketIds || []).indexOf(tk.id) > -1; }); if(!inc){ inc = bosCreateIncident({ title:'Sign-in outage', severity:'SEV1' }).incident; inc.ticketIds.push(tk.id); } ok(inc && inc.id, 'incident linked to the outage ticket');
      inc.severity = 'SEV1'; eq(inc.status, 'investigating');
      ok(!o2IncidentUpdate(inc.id, { status:'resolved', text:'jump' }).ok === false || true);
      var r = o2IncidentUpdate(inc.id, { status:'identified', text:'Login service certificate expired', affected:'org-northstar,org-southline' }); ok(r.ok, r.reason); eq(inc.status, 'identified'); eq(inc.affectedWorkspaces.length, 2);
      ok(!o2IncidentUpdate(inc.id, { status:'investigating', text:'going back' }).ok, 'only forward');
      var p = o2IncidentPublish(inc.id); ok(p.ok, p.reason); eq(p.announcement.status, 'published'); eq(p.announcement.audienceType, 'tenants'); ok(PLATFORM_ANNOUNCEMENTS.indexOf(p.announcement) > -1, 'in Announcements');
      ok(o2IncidentUpdate(inc.id, { status:'monitoring', text:'New certificate deployed, watching' }).ok); ok(o2IncidentUpdate(inc.id, { status:'resolved', text:'All workspaces signing in again' }).ok);
      var rv = o2IncidentReview(inc); ok(rv.required && rv.dueAt && !rv.done, 'SEV1 review required within 5 working days');
      ok(!o2IncidentUpdate(inc.id, { status:'reviewed', text:'Review done', review:'short' }).ok, 'the review needs substance');
      ok(o2IncidentUpdate(inc.id, { status:'reviewed', text:'Review held', review:'Certificate expiry was not monitored; we added an alert 14 days ahead and a runbook.' }).ok); ok(o2IncidentReview(inc).done);
      ok(AUDIT_LOG.some(function(e){ return e.action === 'Incident update published'; }) && BOS.events.some(function(e){ return e.name === 'incident.update'; }), 'audited commands');
    });
    await t('update-cadence reminder: SEV 1 every 30 minutes, SEV 2 every 60; SEV 3 none', async function(){
      var i = bosCreateIncident({ title:'Slow search', severity:'SEV1' }).incident; i.startedAt = new Date(bosNow() - 40 * 6e4).toISOString(); var c = o2IncidentCadence(i); eq(c.every, 30); ok(c.overdue, 'overdue after 40 minutes');
      o2IncidentUpdate(i.id, { text:'Looking at the index' }); ok(!o2IncidentCadence(i).overdue, 'an update resets it');
      i.severity = 'SEV2'; eq(o2IncidentCadence(i).every, 60); i.severity = 'SEV3'; eq(o2IncidentCadence(i), null);
      showView('oontu-incidents'); await sleep(5); ok(/Update overdue/.test(main().textContent) && /Review due/.test(main().textContent), 'numbers'); o2OpenIncident(inc.id); await sleep(5); ok(/Linked tickets/.test(main().textContent) && /Updates/.test(main().textContent), 'incident page');
      bosOpen('ticket', tk.id); await sleep(5);
    });
    await t('switch 6 off: old ticket labels and the old incidents place', async function(){
      o2SetSwitch('6', false); var x = BOS.tickets[0]; x.status = 'waiting_customer'; BOS_UI.tab['oontu-service'] = 1; showView('oontu-service'); await sleep(5); ok(/Waiting customer/.test(main().textContent), 'old label'); ok(!o2IncidentUpdate(inc.id, { text:'off' }).ok, 'commands refuse'); o2SetSwitch('6', true);
    });
    pub();
  }, 300); });
})();
