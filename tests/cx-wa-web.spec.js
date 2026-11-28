// @cx-runner on
/* QA fix A7: under CX the WhatsApp Web (linked-device) lane is hidden from setup and the Inbox by default; the workspace
   setting "Allow personal WhatsApp Web inbox" (off by default, with a warning) brings it back for people's own chats;
   agents never use it; a person's own reply goes through click-to-chat (wa.me) or the Cloud API.
   Run: & .\tests\run-auth-tests.ps1 -Spec tests\cx-wa-web.spec.js */
(function(){
  var results = [], errs = [];
  window.addEventListener('error', function(e){ errs.push('ERR ' + e.message); });
  async function t(name, fn){ var before = errs.length; try { await fn(); if(errs.length > before) throw new Error(errs.slice(before).join(' | ')); results.push({ name:name, pass:true }); } catch(e){ results.push({ name:name, pass:false, error:String(e && e.message || e) }); } pub(); }
  function pub(){ var pre = document.getElementById('auth-test-results'); if(!pre){ pre = document.createElement('pre'); pre.id = 'auth-test-results'; document.body.appendChild(pre); } pre.textContent = JSON.stringify(results); }
  function ok(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function eq(a, b, m){ if(a !== b) throw new Error((m ? m + ': ' : '') + 'expected ' + JSON.stringify(b) + ', got ' + JSON.stringify(a)); }
  function as(role){ viewingAsFromManager = false; managerViewAsRecruiterId = null; previewAsRoleId = null; state.role = role; renderSidebar(); }

  window.addEventListener('load', function(){ setTimeout(async function(){
    var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
    var app = document.getElementById('app'); app.classList.remove('hidden'); app.classList.add('flex');
    as('admin');
    var uid = ibMeId(); var L = ibLinks(uid);
    if(!L.whatsapp || L.whatsapp.status !== 'linked') L.whatsapp = { status:'linked', route:'web', phone:'+91 98000 11111', device:'Oontu · Chrome on Windows', region:'India (Mumbai)', at:Date.now() };
    var opened = []; window.open = function(u){ opened.push(u); return null; };

    await t('off by default: the setting is off and the personal WhatsApp lane is hidden', async function(){
      ok(!(window.CX_SETUP && CX_SETUP.allowWaWebInbox), 'off by default'); eq(cxWaWebAllowed(), false);
      eq(ibLinked('whatsapp', uid), false, 'not linked for the Inbox, even with a linked device');
      var mine = ibConvsFor(uid); ok(!mine.some(function(c){ return c.ch === 'whatsapp' && !c.campaign; }), 'no personal WhatsApp chats in the Inbox');
    });
    await t('setup: My connections, the Inbox card and Kairo say it is off; no QR, no Link it', async function(){
      var h = ibSecLinkit(); ok(/data-wa-web-off/.test(h) && h.indexOf(CX_WA_WEB_TEXT.off) > -1, 'off line in My connections'); ok(!/Scan a QR code like WhatsApp Desktop/.test(h) && !/ibLinkStart\('whatsapp'\)/.test(h), 'no QR or Link it');
      var card = ibConnectCardHTML('whatsapp'); ok(/data-wa-web-off/.test(card) && !/ibLinkStart/.test(card), 'Inbox card');
      IBL = null; var r = ibLinkStart('whatsapp'); ok(r && r.refused && !IBL, 'link refused');
      IBV.ch = 'all'; var list = ibListHTML('page'); ok(!/Link WhatsApp/.test(list), 'All does not offer WhatsApp');
      var plan = iqPlanChannel('link my whatsapp', { perms:{ settings:true } }); ok(plan && /off in this workspace/.test(JSON.stringify(plan.blocks)), 'Kairo explains: ' + JSON.stringify(plan).slice(0, 160));
      var camp = iqPlanChannel('set up the whatsapp business api for campaigns', { perms:{ settings:true } }); ok(!/off in this workspace/.test(JSON.stringify(camp.blocks || [])), 'the business number setup is unchanged');
    });
    await t('the setting: Settings › Cowork › Cowork v2 has the switch with the not-official warning', async function(){
      var tab = sSectionById('cowork').tabs.find(function(x){ return x.id === 'cx'; }); var h = tab.render();
      ok(/Allow personal WhatsApp Web inbox/.test(h) && /not the official WhatsApp API/.test(h) && /id="cx-wa-web"[^>]*aria-checked="false"/.test(h), 'switch, off, with the warning');
    });
    await t('allowed: the lane comes back for people’s own chats', async function(){
      ok(cxSetWaWebInbox(true).ok); eq(cxWaWebAllowed(), true); eq(ibLinked('whatsapp', uid), true, 'linked again'); ok(!/data-wa-web-off/.test(ibSecLinkit()), 'My connections shows the link');
    });
    await t('agents never use it, whatever the setting: Cloud API only, the personal link is never read', async function(){
      [true, false].forEach(function(on){
        cxSetWaWebInbox(on); var c = CANDIDATES.find(function(x){ return !cxOptedOut(x.id); }); cxSetWaConsent(c.id, 'form');
        var reads = 0, real = window.ibLinks; window.ibLinks = function(){ reads++; return real.apply(this, arguments); };
        try { cxOnInbound({ candidateId:c.id, channel:'whatsapp', text:'hi', id:'wa-web-' + on }); var r = cxSend({ agent:'outreach', channel:'whatsapp', candidateId:c.id, text:'Agent check ' + on }); if(r.ok){ eq(r.message.via, 'cloud-api', 'via'); } }
        finally { window.ibLinks = real; }
        eq(reads, 0, 'the personal link was read by the agent path (setting ' + on + ')');
      });
    });
    await t('a person’s own reply with the lane off: click-to-chat, or the Cloud API inside the 24-hour window', async function(){
      cxSetWaWebInbox(false);
      var conv = { id:'c-wa-test', ch:'whatsapp', peer:{ name:'Test Person', phone:'+91 98111 22222' }, msgs:[], unread:{}, members:[uid] };
      ibState().convs.push(conv); IBV.drafts[conv.id] = 'Hello from me'; var n = opened.length; var r = ibSend(conv.id);
      ok(r && r.via === 'wa.me' && opened.length === n + 1 && /^https:\/\/wa\.me\/919811122222\?text=Hello/.test(opened[n]), 'wa.me opened: ' + opened[n]);
      ok(conv.msgs.some(function(m){ return m.via === 'wa.me'; }), 'kept in the conversation');
      var c = CANDIDATES.find(function(x){ return !cxOptedOut(x.id); }); cxOnInbound({ candidateId:c.id, channel:'whatsapp', text:'yes', id:'wa-web-win' });
      var conv2 = { id:'c-wa-test2', ch:'whatsapp', candidateId:c.id, peer:{ name:c.name, phone:c.phone || '9800000000' }, msgs:[], unread:{}, members:[uid] }; ibState().convs.push(conv2);
      if(cxChannelReady('whatsapp')){ IBV.drafts[conv2.id] = 'Thanks!'; var b0 = cxBalance(), r2 = ibSend(conv2.id); ok(r2 && r2.via === 'cloud-api', 'Cloud API inside the window: ' + JSON.stringify(r2)); eq(cxBalance(), b0 - cxRate('wa-window'), 'one wa-window credit'); }
      else results.push({ name:'NOTE business number not connected in the seed; Cloud API path not exercised', pass:true });
    });
    await t('CX off: the lane is exactly as before', async function(){
      cxSetSwitch(false); try { eq(cxWaWebAllowed(), true); eq(ibLinked('whatsapp', uid), true); ok(!/data-wa-web-off/.test(ibSecLinkit())); } finally { cxSetSwitch(true); }
    });
    pub();
  }, 300); });
})();
