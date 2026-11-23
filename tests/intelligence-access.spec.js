/* Ask Kairo by role (2026-11-21): on for every role by default; the Owner or an Admin can switch it off per role.
   A switched-off role keeps Intelligence in its menu, with a lock, and sees a locked page that can ask for it back.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\intelligence-access.spec.js */
(function(){
  var results = [];
  var sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  var q = function(s){ return document.querySelector(s); };
  var errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e && e.message || e) }); } }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function as(role){ state.role = role; previewAsRoleId = null; renderSidebar(); IQ.convs = null; showView('intelligence'); }
  function navItem(){ return q('#sidebar .nav-item[data-nav="intelligence"]'); }
  function settingsAsOwner(){ as('admin'); openSettings('intelligence'); }
  function sw(roleId){ return q('[data-iq-role="' + roleId + '"]'); }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    try { localStorage.clear(); } catch(e){}
    state.role = 'admin'; enterApp(); await sleep(100);
    IQ_ADAPTER.pace = { think:20, step:20, beforeWrite:10, words:30, tick:2, afterText:5, block:5 };

    await t('default: every role has Intelligence and can Ask Kairo, the Hiring Manager included', async function(){
      ['admin', 'manager', 'recruiter', 'hm'].forEach(function(r){
        as(r); ok(navItem(), r + ': Intelligence in the menu'); ok(!iqLocked(), r + ': not locked');
        ok(q('#iq-input') && !q('.iq-lock'), r + ': the composer is there');
      });
    });

    await t('Settings › Intelligence is for the Owner and Admins: every role listed, Owner and Admin always on', async function(){
      settingsAsOwner();
      ok(sVisible().some(function(s){ return s.id === 'intelligence'; }), 'section listed for the Owner');
      ok(/Ask Kairo by role/.test(q('#main-content').textContent), 'card shown');
      ok(sw('role_recruiter') && sw('role_recmgr') && sw('role_hiring_manager'), 'switches for the other roles');
      ok(!sw('role_founder') && !sw('role_admin'), 'no switch for Owner or Admin');
      ok(sw('role_recruiter').getAttribute('aria-checked') === 'true', 'on by default');
      as('recruiter'); ok(!sVisible().some(function(s){ return s.id === 'intelligence'; }), 'a recruiter does not see the section');
      iqAccessSet('role_recmgr', false); ok(!iqOffFor('role_recmgr'), 'a recruiter cannot switch a role off');
    });

    await t('Owner switches Recruiters off: their Intelligence shows locked, nothing can be asked, other roles unaffected', async function(){
      settingsAsOwner(); sw('role_recruiter').click();
      ok(iqOffFor('role_recruiter') && sw('role_recruiter').getAttribute('aria-checked') === 'false', 'switched off');
      ok(/Off since .* by /.test(q('#main-content').textContent), 'who and when shown');
      ok(AUDIT_LOG.some(function(a){ return /Ask Kairo turned off for Recruiter/.test(a.action); }), 'audited');
      as('recruiter');
      var n = navItem(); ok(n && n.classList.contains('is-iq-locked') && n.querySelector('.nav-lock'), 'menu item kept, with a lock');
      ok(/off for your role/.test(n.getAttribute('aria-label')), 'aria says so');
      ok(q('.iq-lock') && /Ask Kairo is off for your role/.test(q('.iq-lock h1').textContent), 'locked page');
      ok(/turned it off for Recruiters on/.test(q('.iq-lock .iq-hero p').textContent), 'who turned it off: ' + q('.iq-lock .iq-hero p').textContent);
      ok(!q('#iq-input'), 'no composer');
      var before = (IQ.convs || []).length; iqAsk('How many interviews do I have this week?'); await sleep(200);
      ok((IQ.convs || []).length === before && q('.iq-lock'), 'iqSend refused');
      var tb = q('#topbar-kairo'); if(tb) ok(tb.classList.contains('is-locked') && /off for your role/.test(tb.getAttribute('aria-label')), 'top-bar icon locked');
      showView('jobs'); ok(!q('#ai-fab-container button'), 'floating Ask Kairo pill steps aside');
      as('manager'); ok(!iqLocked() && q('#iq-input'), 'manager still on');
    });

    await t('a locked recruiter asks for it back; the Owner sees the ask; turning it on clears it and opens Ask Kairo', async function(){
      as('recruiter'); var b = Array.from(document.querySelectorAll('.iq-lock button')).find(function(x){ return /Ask to turn it on/.test(x.textContent); });
      ok(b, 'ask button'); b.click();
      ok(q('.iq-lock__sent') && /Asked on/.test(q('.iq-lock__sent').textContent), 'asked state');
      ok(iqAccess().asks.length === 1, 'one ask stored'); iqAccessAsk(); ok(iqAccess().asks.length === 1, 'no duplicate ask');
      settingsAsOwner(); ok(/asked to turn it on/.test(q('#main-content').textContent), 'the Owner sees the ask');
      sw('role_recruiter').click(); ok(!iqOffFor('role_recruiter') && !iqAccess().asks.length, 'on again, ask cleared');
      as('recruiter'); ok(!q('.iq-lock') && q('#iq-input') && !navItem().classList.contains('is-iq-locked'), 'Ask Kairo is back');
      renderAiFab(); ok(q('#ai-fab-container button'), 'pill back for the recruiter');
    });

    await t('Owner and Admin can never be locked; the Hiring Manager can', async function(){
      as('admin'); iqAccessSet('role_founder', false); iqAccessSet('role_admin', false);
      ok(!iqOffFor('role_founder') && !iqOffFor('role_admin') && !iqLocked(), 'Owner and Admin stay on');
      iqAccessSet('role_hiring_manager', false);
      as('hm'); ok(iqLocked() && q('.iq-lock') && navItem().classList.contains('is-iq-locked'), 'HM locked');
      as('admin'); iqAccessSet('role_hiring_manager', true); as('hm'); ok(!iqLocked() && q('#iq-input'), 'HM back on');
    });

    await t('the switch is kept per workspace in this browser and survives a reload of the setting', async function(){
      as('admin'); iqAccessSet('role_recmgr', false);
      IQ_ACCESS = null; ok(iqOffFor('role_recmgr'), 'read back from storage');
      as('manager'); ok(q('.iq-lock'), 'manager locked after reload');
      as('admin'); iqAccessSet('role_recmgr', true); ok(!iqOffFor('role_recmgr'), 'back on');
    });

    var pre = document.createElement('pre'); pre.id = 'auth-test-results'; pre.textContent = JSON.stringify(results); document.body.appendChild(pre);
  }, 400); });
})();
