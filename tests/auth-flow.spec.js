/* Oontu authentication flow tests.
   Run with tests/run-auth-tests.ps1, which injects this file into a temporary copy of
   recruitment-os-prototype.html and runs it in headless Chrome.

   What these prove: the screens, state machine and adapter contract behave correctly
   against the prototype simulator, which applies the rules the real auth API must
   enforce. They do NOT prove server-side security - that needs the same scenarios run
   against the real API (see docs/AUTH.md, "Server test plan"). */
(function(){
  'use strict';
  const results = [];
  const SAMPLE_PW = 'Prototype#2026';
  const sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  async function idle(){ for(let i=0;i<400;i++){ await sleep(0); if(!authFlow.busy) break; } await sleep(0); }
  async function settle(){ await sleep(40); }
  function assert(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function eq(a, b, m){ if(a!==b) throw new Error((m ? m+': ' : '')+'expected '+JSON.stringify(b)+', got '+JSON.stringify(a)); }
  function appVisible(){ return !document.getElementById('app').classList.contains('hidden'); }
  function authVisible(){ return !document.getElementById('onboarding').classList.contains('hidden'); }
  function screenText(){ const el = document.querySelector('.au-form-wrap'); return el ? el.textContent : ''; }
  function wrongCode(code){ return String((parseInt(code,10)+1) % 1000000).padStart(code.length,'0'); }
  function reset(){
    authApi._reset(); authApi._latency = 0;
    try { localStorage.removeItem(AUTH_REMEMBER_KEY); } catch(e){}
    const app = document.getElementById('app');
    app.classList.add('hidden'); app.classList.remove('flex');
    document.getElementById('onboarding').classList.remove('hidden');
    state.role = 'recruiter'; obMode = 'signup'; obScreenIndex = 0;
    authAppSession = { method:'', email:'' };
    authFlow = authInitialState(); authFocusNext = null;
    suWiz = suWizInitial(); signupActiveLeadId = null; authSignupPwDraft = '';
    wsSheet = null; wsSheetRender(); wsSetup = null; WS_SETUPS = {}; qzMoving = false; qzEnter = ''; qzShakeNext = false; suProgShown = 0;
    qzReduced = function(){ return true; };   // the shortest motion, so the tests run quickly
    ob.companyName = ''; ob.website = ''; ob.linkedin = '';
    EXISTING_WORKSPACES = EXISTING_WORKSPACES.filter(function(w){ return w.sample; });   // workspaces claimed by earlier tests
    renderOnboardingScreen();
  }
  // Sign-in asks for the email first. Choosing the code path means Continue sends a code; sign-up always does.
  async function enterEmail(email){ authFlow.email = email; if(authFlow.intent!=='signup') authFlow.method = 'code'; authSubmitEmail(); await idle(); }
  // Email and password share one form: fill in the email; the password field is already beside it.
  async function toPasswordQuestion(email){
    authFlow.email = email; authFlow.method = 'password'; authFlow.stage = 'email'; renderOnboardingScreen();
    document.getElementById('auth-email').value = email;
    assert(document.getElementById('auth-password'), 'the password field is on the same form');
  }
  // Create-workspace asks name, then workspace, then password.
  function answerCreate(name, ws){ authFlow.name = name; authCreateNext(); authFlow.workspaceName = ws; authCreateNext(); }
  async function enterCode(code){ const el = document.getElementById('auth-code'); el.value = code; authCodeInput(el); await idle(); }
  async function signInWithCode(email){
    await enterEmail(email);
    assert(authFlow.codePending, 'a code was sent');
    await enterCode(authApi._latestEmail(email).code);
  }
  async function signInWithPassword(email, password, remember){
    authFlow.remember = !!remember;
    await toPasswordQuestion(email);
    if(authFlow.step!=='email') return;   // for example an SSO organisation was sent to its provider
    document.getElementById('auth-password').value = password;
    authSubmitPassword(); await idle();
  }
  async function apiSignIn(email){
    await authApi.sendCode({ email:email });
    return authApi.verifyCode({ email:email, code:authApi._latestEmail(email).code });
  }
  function customRoleId(name){ const r = CUSTOM_ROLES.find(function(x){ return x.name===name; }); return r ? r.id : ''; }
  async function test(name, fn){
    reset();
    try { await fn(); results.push({ name:name, pass:true }); }
    catch(e){ results.push({ name:name, pass:false, error:String(e && e.message || e) }); }
  }

  async function run(){
    if(typeof authApi==='undefined' || !authApi || !authApi._reset){
      results.push({ name:'Page loads in prototype mode', pass:false, error:'authApi simulator not available - did the page script fail?' });
      return;
    }

    /* ---- sign in: password ---- */
    await test('01 Existing user signs in with work email and password', async function(){
      await signInWithPassword('alex@northstar.example', SAMPLE_PW);
      assert(appVisible(), 'app should open');
      eq(state.role, 'admin', 'role view');
      eq(ROLE_META.admin.name, 'Alex Morgan', 'signed-in name');
      eq(authAppSession.method, 'password');
    });

    await test('01b Existing user signs in with a one-time code on the same screen', async function(){
      await signInWithCode('alex@northstar.example');
      assert(appVisible()); eq(state.role, 'admin'); eq(authAppSession.method, 'email_code');
    });

    /* ---- sign-up: five short questions, one per screen, then straight into the product ---- */
    const move = function(){ return sleep(230); };   // a question leaving and the next arriving (tests run with reduced motion: 150 ms)
    async function waitFor(cond, ms){ for(let i=0; i<(ms||4000)/20; i++){ if(cond()) return true; await sleep(20); } return false; }
    async function pickTypeOnly(type){ if(authFlow.step!=='su-type') authSwitchIntent('signup'); suTypeChoose(type); await sleep(330); await idle(); await move(); await idle(); }
    async function answerSize(size){ suSizeChoose(size); await sleep(150); await idle(); await move(); await idle(); }
    async function answerLocation(iso, city){ if(iso) suCountryPick(iso, true); suWiz.city = city || 'Mumbai'; suLocationSubmit(); await move(); await idle(); }
    async function pickType(type, size, iso, city){ await pickTypeOnly(type); await answerSize(size || '6\u201320'); await answerLocation(iso, city); }   // the first three questions
    async function answerName(name){ authFlow.name = name; suNameSubmit(); await move(); await idle(); }
    async function answerEmail(email){ authFlow.email = email; suEmailSubmit(); await idle(); await move(); await idle(); }
    async function answerMobile(mobile){ authFlow.mobile = mobile; suMobileSubmit(); await move(); await idle(); }
    async function answerPassword(pw){ document.getElementById('auth-password').value = pw; suPasswordSubmit(); await move(); }
    async function intoProduct(){ assert(await waitFor(appVisible, 4000), 'opens the product after the last answer'); await idle(); await settle(); }
    async function signUpAll(type, name, email, mobile, pw, size){
      await pickType(type || 'Staffing agency', size); await answerName(name || 'Dana Lee'); await answerEmail(email || 'dana@startup.example');
      await answerMobile(mobile || '98250 41207'); await answerPassword(pw || 'Harbor-Lights-42'); await intoProduct();
    }
    async function googleUp(type, outcome){
      await pickType(type || 'Staffing agency'); authFlow.name = 'Taylor Kim';
      suOAuthStart('google'); await idle(); await move();
      suOAuthPick(outcome || 'new'); await idle(); await move(); await idle();
    }
    function qTitle(){ return document.querySelector('.qz-title').textContent; }
    function qCount(){ const c = document.querySelector('.qz-count'); return c ? c.textContent : ''; }
    function qText(){ const el = document.querySelector('.qz-main'); return el ? el.textContent : ''; }
    function roleOptions(id){ return Array.from(document.getElementById(id).options).map(function(o){ return o.text; }).join(','); }
    function sheetTitle(){ const h = document.getElementById('ws-sheet-h'); return h ? h.textContent : ''; }
    async function saveSheet(){ wsSaveSheet(); await idle(); await settle(); await sleep(20); }
    function cardText(){ const c = document.getElementById('ws-card'); return c ? c.textContent : ''; }
    function backToSignIn(){
      authResetForSignOut(); obMode = 'signup'; obScreenIndex = 0;
      const app = document.getElementById('app'); app.classList.add('hidden'); app.classList.remove('flex');
      document.getElementById('onboarding').classList.remove('hidden');
      renderOnboardingScreen();
    }

    await test('02 Agency sign-up: six questions, then straight to Home with the welcome line, banner, bell and checklist', async function(){
      authSwitchIntent('signup');
      eq(qTitle(), 'How will you use Oontu?'); eq(qCount(), '1 of 7');
      await pickTypeOnly('Staffing agency');
      eq(authFlow.step, 'su-size'); eq(qTitle(), 'How many people will use Oontu?'); eq(qCount(), '2 of 7');
      assert(/Recruiters and managers in your agency\./.test(qText()), 'agency hint');
      eq(Array.from(document.querySelectorAll('.qz-size')).map(function(e){ return e.textContent; }).join('|'), '1–5|6–20|21–50|51–200|200+');
      eq(getComputedStyle(document.querySelector('.qz-size')).height, '56px'); eq(getComputedStyle(document.querySelector('.qz-size')).borderRadius, '12px');
      await answerSize('21–50');
      eq(authFlow.step, 'su-location'); eq(qTitle(), 'Where is your company based?'); eq(qCount(), '3 of 7');
      eq(document.getElementById('su-country').value, 'India', 'India by default'); assert(document.querySelector('.qz-primary').disabled, 'OK waits for the city');
      await answerLocation('', 'Pune');
      eq(authFlow.step, 'su-name'); eq(qTitle(), 'What’s your name?'); eq(qCount(), '4 of 7');
      await answerName('Dana Lee');
      eq(qTitle(), 'What’s your email?'); eq(qCount(), '5 of 7');
      await answerEmail('dana@startup.example');
      eq(qTitle(), 'What’s your mobile number?'); eq(qCount(), '6 of 7');
      await answerMobile('98250 41207');
      eq(qTitle(), 'Create a password.'); eq(qCount(), '7 of 7');
      eq(authApi._verifyMailCount('dana@startup.example'), 0, 'nothing is created until the last answer');
      document.getElementById('auth-password').value = 'Harbor-Lights-42'; suPasswordSubmit();
      eq(authFlow.step, 'su-password', 'no screen in between: the OK button shows the wait');
      assert(/Creating your workspace/.test(document.querySelector('.qz-primary').textContent));
      await intoProduct();
      eq(state.role, 'admin', 'the owner'); eq(state.activeNav, 'admin-dashboard', 'Home');
      eq(document.querySelector('#main-content .sec-title').textContent, 'Welcome to Oontu, Dana.', 'welcome line');
      eq(authApi._verifyMailCount('dana@startup.example'), 1, 'the verification link went out');
      assert(emailVerifyLocked(), 'unverified until the link is opened');
      const vb = document.querySelector('#verify-banner-root .vb');
      eq(vb.querySelector('.vb__text').textContent, 'We sent a verification link to dana@startup.example. Verify it to invite people, publish jobs and send to clients.');
      eq(vb.offsetHeight, 44, 'one slim line'); assert(vb.querySelector('.vb__icon svg'), 'mail icon');
      assert(/^Resend in \d+s\|Change email\|I’ve verified$/.test(Array.from(vb.querySelectorAll('button')).map(function(b){ return b.textContent; }).join('|')), 'Resend (counting down: a link just went), Change email, I’ve verified');
      assert(!/close|dismiss/i.test(vb.innerHTML), 'cannot be closed');
      const top = document.getElementById('topbar'); assert(top.compareDocumentPosition(document.getElementById('verify-banner-root')) & Node.DOCUMENT_POSITION_FOLLOWING, 'under the top bar');
      assert(document.querySelector('#quick-actions-bar .qa-dot'), 'unread dot on the bell');
      assert(computeNotifications().some(function(n){ return n.text==='Verification email sent to dana@startup.example'; }), 'bell notification');
      assert(document.getElementById('ws-card'), 'Complete your workspace card');
      eq(ORG_STRUCTURE.profile.teamSize, '21–50', 'team size on the workspace');
      const s = await authApi.session();
      eq(s.workspaces[0].role, 'owner', 'server-assigned role'); eq(s.user.setupPending, false, 'setup complete on the server');
      eq(CUSTOM_ROLES.map(function(r){ return r.name; }).join(','), 'Owner,Recruiter Manager,Recruiter', 'starter roles for the type');
      showView('setup-hub'); assert(/Team size21–50Edit/.test(document.getElementById('ws-defaults').textContent), 'Settings > Workspace: Team size with Edit');
      wsOpenSheet('team-size'); document.getElementById('ws-size-4').click(); await saveSheet();
      eq(ORG_STRUCTURE.profile.teamSize, '200+'); eq(SIGNUP_LEADS[SIGNUP_LEADS.length-1].teamSize, '200+', 'and on the lead');
      wsSessionSeq++; showView('admin-dashboard'); assert(/^Good /.test(document.querySelector('#main-content .sec-title').textContent), 'the welcome line is for the first visit');
      await authApi.signOut();
      eq((await authApi.passwordSignIn({ email:'dana@startup.example', password:'Harbor-Lights-42' })).ok, true, 'the password works later');
    });

    await test('02v Verification inside the product: Resend, Change email, I’ve verified, locks, bell, sign out and back', async function(){
      await signUpAll('Staffing agency', 'Dana Lee', 'dana@startup.example');
      assert(/^Resend in \d+s$/.test(document.getElementById('verify-banner-resend').textContent), 'a link just went, so the 30 s wait shows');
      authApi._advance(31*1000); verifyBannerResendAt = 0; verifyBannerSentUntil = 0; renderVerifyBanner();
      document.getElementById('verify-banner-resend').click(); await settle();
      eq(document.getElementById('verify-banner-resend').textContent, 'Sent'); assert(document.getElementById('verify-banner-resend').disabled);
      eq(authApi._verifyMailCount('dana@startup.example'), 2, 'a new link');
      verifyBannerSentUntil = 0; renderVerifyBanner(); assert(/^Resend in \d+s$/.test(document.getElementById('verify-banner-resend').textContent), 'then the 30 s countdown');
      await verifyBannerResend(); eq(authApi._verifyMailCount('dana@startup.example'), 2, 'not during the cooldown');
      // Change email
      Array.from(document.querySelectorAll('.vb__btn')).find(function(b){ return b.textContent==='Change email'; }).click();
      assert(document.getElementById('vb-email') && document.getElementById('vb-dialog-h'), 'a small dialog');
      vbDialog.value = 'alex@northstar.example'; await vbChangeEmailSave(); await settle();
      assert(/already uses this email/.test(document.getElementById('vb-email-err').textContent), 'an address in use is refused');
      vbDialog.value = 'dana.lee@startup.example'; await vbChangeEmailSave(); await settle();
      assert(!document.getElementById('vb-email'), 'closed');
      eq(authAppSession.email, 'dana.lee@startup.example');
      assert(/dana\.lee@startup\.example/.test(document.querySelector('.vb__text').textContent), 'the banner shows the new address');
      eq(authApi._verifyMailCount('dana.lee@startup.example'), 1, 'a link to the new address');
      assert(WS_SETUPS['dana.lee@startup.example'] && wsSetup.email==='dana.lee@startup.example', 'the checklist follows');
      // locks keep the reason, with Resend link
      wsOpenItem('agency-team'); wsSetup.team[0].email = 'asha@startup-one.example'; await saveSheet();
      wsSetup.team[0].email = 'ravi@startup-one.example'; wsOpenItem('agency-team'); wsSetup.team[0].email = 'ravi@startup-one.example'; await saveSheet();
      showView('team-members'); await idle(); await settle();
      const inv = document.querySelector('button[onclick*="tmOpenInvite("]');
      assert(inv && inv.disabled, 'invite locked');
      assert(inv.parentElement.querySelector('.vlock-resend'), 'the reason line has Resend link');
      // bell: reading clears the dot
      openNotifications(); assert(!document.querySelector('#quick-actions-bar .qa-dot'), 'read'); closeNotifications();
      // sign out and back in before verifying: the banner comes back
      backToSignIn(); await signInWithPassword('dana.lee@startup.example', 'Harbor-Lights-42');
      assert(appVisible() && document.querySelector('#verify-banner-root .vb'), 'banner again after signing in');
      // verify
      await verifyBannerConfirm(); await idle(); await settle();
      assert(!emailVerifyLocked());
      assert(/Email verified\. Your 2 invites have been sent\./.test(document.querySelector('.app-toasts').textContent), 'toast counts the invites');
      await sleep(260); eq(document.getElementById('verify-banner-root').innerHTML, '', 'banner faded away');
      assert(!document.querySelector('[data-vlocked], [data-vlock-reason]'), 'locks removed');
      assert(computeNotifications().some(function(n){ return n.text==='Email verified: dana.lee@startup.example'; }), 'bell notification marked done');
      eq(authApi._inviteMail().filter(function(m){ return /startup-one\.example$/.test(m.to); }).length, 2, 'both queued invites sent');
    });

    await test('02L Where is your company based: country picker, city, and the defaults it drives', async function(){
      SIGNUP_LEADS.length = 0;
      await pickTypeOnly('Staffing agency'); await answerSize('6–20');
      eq(qTitle(), 'Where is your company based?'); eq(qCount(), '3 of 7');
      assert(/We use this for your currency, timezone and phone code\. You can change it later\./.test(qText()));
      const input = document.getElementById('su-country');
      eq(input.value, 'India'); eq(document.getElementById('su-country-flag').textContent, '🇮🇳', 'with the flag');
      eq(input.getAttribute('role'), 'combobox');
      suCountryOpen();
      const optNames = function(){ return Array.from(document.querySelectorAll('#su-country-list [role=option]')).map(function(o){ return o.lastChild.textContent; }); };
      const names = optNames();
      eq(names.slice(0, 8).join('|'), 'India|United States|United Kingdom|United Arab Emirates|Singapore|Australia|Canada|Germany', 'the common countries first');
      const rest = names.slice(8); eq(rest.join('|'), rest.slice().sort().join('|'), 'then A to Z');
      assert(/All countries/.test(document.getElementById('su-country-list').textContent));
      input.value = 'king'; suCountryInput(input);
      eq(optNames().join(), 'United Kingdom', 'type to filter');
      eq(document.querySelector('.qz-primary').disabled, true, 'OK waits for both answers');
      input.dispatchEvent(new KeyboardEvent('keydown', { key:'Enter', bubbles:true, cancelable:true }));
      eq(suWiz.country, 'GB'); eq(input.value, 'United Kingdom'); eq(authFlow.mobileCode, '+44', 'the phone code follows');
      eq(document.activeElement.id, 'su-city', 'then the city');
      eq(Array.from(document.querySelectorAll('#su-city-list option')).map(function(o){ return o.value; }).slice(0, 2).join(), 'London,Manchester', 'suggestions for the country');
      const city = document.getElementById('su-city'); city.value = 'Leeds'; city.dispatchEvent(new Event('input'));
      eq(document.querySelector('.qz-primary').disabled, false, 'enabled once both are filled');
      suWiz.city = ''; suLocationSubmit(); eq(authFlow.errorField, 'su-city', 'city required');
      suWiz.city = 'Leeds'; renderOnboardingScreen(); document.getElementById('wz-form').requestSubmit(); await move(); await idle();
      eq(authFlow.step, 'su-name', 'Enter moves on');
      const l = SIGNUP_LEADS[0]; eq(l.stepReached, 'location'); eq(l.country, 'United Kingdom'); eq(l.city, 'Leeds');
      await answerName('Sam Patel'); await answerEmail('sam@talentuk.example');
      eq(document.getElementById('auth-mobile-code').value, '+44', '+44 on the mobile question');
      await answerMobile('98250 4120'); eq(authFlow.errorField, 'auth-mobile'); assert(/10-digit mobile number for the UK/.test(authFlow.error), 'the UK number length');
      await answerMobile('7700 900123'); eq(authFlow.step, 'su-password');
      await answerPassword('Harbor-Lights-42'); await intoProduct();
      const p = ORG_STRUCTURE.profile;
      eq(p.country, 'United Kingdom'); eq(p.city, 'Leeds'); eq(p.currency, 'GBP (£)'); eq(p.timezone, 'Europe/London (GMT, UTC+0)');
      eq(p.dateFormat, 'DD MMM YYYY'); eq(p.dataRegion, 'EU'); eq(p.taxIdLabel, 'VAT number');
      wsOpenItem('agency-profile');
      eq(document.getElementById('su-ws-country').value, 'GB'); eq(document.getElementById('su-ws-city').value, 'Leeds');
      eq(document.getElementById('su-tz').value, 'Europe/London'); eq(document.getElementById('su-currency').value, 'GBP');
      eq(document.querySelector('label[for="su-gst"]').textContent, 'VAT number', 'the tax ID label for the country');
      wsCloseSheet();
      wsOpenRegion('ws-reg-currency'); eq(document.activeElement.id, 'ws-reg-currency', 'Edit opens at that field');
      wsRegionCountry('US');
      eq(document.getElementById('ws-reg-currency').value, 'USD'); eq(document.getElementById('ws-reg-date').value, 'MMM DD, YYYY', 'US dates');
      wsRegionDraft.city = 'Austin'; await saveSheet();
      eq(p.country, 'United States'); eq(p.taxIdLabel, 'EIN'); eq(p.dataRegion, 'EU', 'the data region stays: contact us to change');
      // India by default: +91 and INR
      reset(); await pickType('Staffing agency'); eq(authFlow.mobileCode, '+91');
      await answerName('Dana Lee'); await answerEmail('dana@in-default.example'); await answerMobile('98250 41207'); await answerPassword('Harbor-Lights-42'); await intoProduct();
      eq(ORG_STRUCTURE.profile.currency, 'INR (₹)'); eq(ORG_STRUCTURE.profile.taxIdLabel, 'GSTIN');
      // a phone code chosen on the mobile question is kept when the country changes later
      reset(); await pickTypeOnly('Staffing agency'); await answerSize('1–5'); authFlow.mobileCodeTouched = true; authFlow.mobileCode = '+971';
      suCountryPick('SG', true); eq(authFlow.mobileCode, '+971', 'not overwritten');
      // Super Admin: country column and filter
      SIGNUP_LEADS.length = 0; seedSignupLeads();
      state.role = 'oontu'; const app = document.getElementById('app'); app.classList.remove('hidden'); app.classList.add('flex'); document.getElementById('onboarding').classList.add('hidden');
      suLeadFilter = 'All'; suLeadCountry = ''; showView('oontu-signups'); await idle();
      assert(Array.from(document.querySelectorAll('#oontu-signups-table th')).some(function(th){ return th.textContent==='Country'; }), 'Country column');
      const sel = document.querySelector('select[aria-label="Country"]'); assert(sel && /India/.test(sel.textContent), 'country filter');
      suLeadCountry = 'India'; refreshOontuSignups();
      assert(oontuSignupsRows().length && oontuSignupsRows().every(function(x){ return x.country==='India'; }), 'filters by country');
      suLeadCountry = '';
    });

    await test('02a The lead moves with every answer: type_chosen, name, email, mobile, password, in_product', async function(){
      SIGNUP_LEADS.length = 0;
      await pickTypeOnly('Staffing agency');
      const l = SIGNUP_LEADS[0];
      eq(SIGNUP_LEADS.length, 1); eq(l.stepReached, 'type_chosen'); eq(l.email, '', 'no contact details yet'); eq(l.workspaceType, 'Staffing agency');
      await answerSize('51\u2013200'); eq(l.stepReached, 'team_size'); eq(l.teamSize, '51\u2013200');
      await answerName('Dana Lee'); eq(l.stepReached, 'name'); eq(l.name, 'Dana Lee');
      await answerEmail('bad'); eq(l.stepReached, 'name', 'not while the answer is invalid');
      await answerEmail('dana@startup.example'); eq(l.stepReached, 'email'); eq(l.email, 'dana@startup.example'); eq(l.method, 'email'); eq(l.emailVerified, false);
      await answerMobile('9825041207'); eq(l.stepReached, 'mobile'); eq(l.mobile, '+91 98250 41207', 'stored in Indian format');
      suQBack(); await move(); eq(authFlow.step, 'su-mobile', 'Back');
      await answerMobile('9825041207'); eq(l.stepReached, 'mobile', 'going back never moves the lead back');
      eq(l.currentStep, 'su-password', 'the question on screen is on the lead');
      await answerPassword('Harbor-Lights-42'); await intoProduct();
      eq(SIGNUP_LEADS.length, 1, 'the same lead throughout');
      eq(l.stepReached, 'in_product'); eq(l.status, 'in_product'); eq(l.resume, null, 'nothing left to resume');
      assert(l.stepTimes.type_chosen && l.stepTimes.team_size && l.stepTimes.name && l.stepTimes.email && l.stepTimes.mobile && l.stepTimes.password && l.stepTimes.in_product, 'a time for each');
      eq(SIGNUP_STEPS_REACHED.join(), 'type_chosen,team_size,location,name,email,mobile,password,in_product,verified');
    });

    await test('02b Each question checks its answer: red field, message, shake; nothing is created', async function(){
      await pickType('Staffing agency');
      qzReduced = function(){ return false; };
      try { suNameSubmit(); } finally { qzReduced = function(){ return true; }; }
      eq(authFlow.errorField, 'auth-name'); eq(authFlow.error, 'Enter your full name.');
      eq(document.getElementById('auth-name').getAttribute('aria-invalid'), 'true', 'red field');
      assert(document.querySelector('.qz-fields .qz-shake'), 'the field shakes (not with reduced motion)');
      await answerName('Dana Lee');
      await answerEmail('not-an-email'); eq(authFlow.errorField, 'auth-email'); eq(authFlow.step, 'su-email');
      await answerEmail('dana@gmail.com'); eq(authFlow.step, 'su-mobile', 'an agency can use Gmail');
      await answerMobile(''); eq(authFlow.errorField, 'auth-mobile');
      await answerMobile('12345 67890'); assert(/10-digit Indian/.test(authFlow.error), 'Indian number rule');
      await answerMobile('98250 4120'); eq(authFlow.errorField, 'auth-mobile', 'nine digits');
      await answerMobile('Harbor'); eq(authFlow.errorField, 'auth-mobile', 'letters');
      eq(authMobileProblem('+44', '7700 900123'), '', 'other countries: 6 to 15 digits');
      await answerMobile('98250 41207'); eq(authFlow.step, 'su-password');
      document.getElementById('auth-password').value = 'short'; suPasswordSubmit();
      eq(authFlow.errorField, 'auth-password'); assert(/at least 10/i.test(authFlow.error), 'length message'); eq(authFlow.step, 'su-password');
      eq(document.getElementById('auth-password').value, 'short', 'the typed password survives the error');
      assert(!appVisible() && !(await authApi.session()).authenticated, 'nothing created');
      eq((await authApi.signUp({ name:'x', email:'x@y.example', mobileCode:'+91', mobile:'123', password:'Cedar-Harbor-77' })).error, 'mobile_invalid_in', 'the server checks too');
    });

    await test('02c One question per screen: header, progress parts, counter, Back, big title, OK and press Enter', async function(){
      authSwitchIntent('signup');
      assert(document.querySelector('.wz-top .wz-logo') && document.querySelector('.wz-top .wz-exit'), 'logo left, Save and exit right');
      eq(document.querySelectorAll('.qz-prog .qz-seg').length, 7, 'a thin line in seven equal parts');
      assert(!document.querySelector('.wz-steps, .wz-step'), 'no step labels');
      assert(!document.querySelector('button.qz-back'), 'no Back on the first question');
      eq(document.querySelectorAll('.qz-choice').length, 2);
      eq(Array.from(document.querySelectorAll('.wz-choice__title')).map(function(e){ return e.textContent; }).join('|'), 'Staffing agency|Corporate');
      eq(document.querySelectorAll('.qz-choice input[type=radio][name="su-type"]').length, 2, 'one radio group, so the arrow keys move between cards');
      assert(!document.querySelector('.qz-primary'), 'choosing a card moves on by itself');
      await pickTypeOnly('Corporate');
      assert(/Your TA team, hiring managers and interviewers\./.test(qText()), 'corporate hint on team size');
      await answerSize('6\u201320'); await answerLocation('', 'Pune');
      eq(document.querySelector('.qz-prog').getAttribute('aria-valuenow'), '4');
      assert(document.querySelector('button.qz-back'), 'Back from the second question');
      eq(getComputedStyle(document.querySelector('.qz-title')).fontSize, '32px', 'title 32px');
      eq(getComputedStyle(document.getElementById('auth-name')).height, '52px', 'field 52px');
      eq(getComputedStyle(document.getElementById('auth-name')).fontSize, '17px');
      eq(document.querySelector('.qz-primary').textContent, 'OK'); assert(/press Enter/.test(document.querySelector('.qz-enter').textContent));
      assert(document.querySelector('label[for="auth-name"]').classList.contains('sr-only'), 'the title asks the question; the label is for screen readers');
      eq(document.getElementById('auth-name').getAttribute('autocomplete'), 'name');
      eq(Array.from(document.querySelectorAll('.qz-alt .qz-textbtn')).map(function(b){ return b.textContent; }).join(), 'Google,Microsoft', 'or sign up with Google / Microsoft');
      await answerName('Mira Shah');
      eq(qTitle(), 'What’s your work email?'); assert(/Use your company email\./.test(qText()), 'corporate hint');
      eq(document.getElementById('auth-email').placeholder, 'you@company.com');
      await answerEmail('mira@startup.example');
      eq(document.getElementById('auth-mobile-code').value, '+91', '+91 by default');
      assert(/We’ll only call if you get stuck while setting up\./.test(qText()));
      await answerMobile('98250 41207');
      assert(document.querySelector('.au-trail') && document.getElementById('auth-password-strength'), 'show/hide and the strength bar');
      assert(/By continuing you agree to the terms and privacy notice\./.test(qText()));
      eq(document.getElementById('auth-password').getAttribute('autocomplete'), 'new-password');
      reset(); await pickType('Staffing agency'); await answerName('Dana Lee');
      eq(qTitle(), 'What’s your email?'); assert(/A personal email works for agencies\./.test(qText()), 'agency hint');
      authSwitchIntent('signin'); eq(document.querySelector('.au-h1').textContent, 'Welcome', 'sign-in is unchanged');
    });

    await test('02d Motion: up and out, in from below, focus after; Back reverses; Shift+Tab and Enter; the arrow keys only move', async function(){
      authSwitchIntent('signup');
      const r = document.getElementById('su-type-1');
      r.checked = true; r.dispatchEvent(new Event('change', { bubbles:true }));
      await sleep(400); eq(authFlow.step, 'su-type', 'an arrow key changes the choice without moving on');
      assert(document.querySelectorAll('.qz-choice')[1].classList.contains('is-on'), 'highlighted');
      r.dispatchEvent(new KeyboardEvent('keydown', { key:'Enter', bubbles:true }));
      assert(document.querySelectorAll('.qz-choice')[1].classList.contains('is-picked'), 'a short highlight first');
      eq(authFlow.step, 'su-type', 'then it moves, 300 ms later');
      await sleep(330);
      assert(document.getElementById('qz-step').classList.contains('qz-out'), 'the question leaves upward');
      await move();
      eq(authFlow.step, 'su-size'); assert(document.getElementById('qz-step').classList.contains('qz-in'), 'the next one rises in');
      await sleep(200); eq(document.activeElement.id, 'su-size-0', 'focus once it has arrived');
      const c = document.getElementById('su-size-2');
      c.checked = true; c.dispatchEvent(new Event('change', { bubbles:true }));
      await sleep(200); eq(authFlow.step, 'su-size', 'arrow keys move between chips without moving on');
      c.dispatchEvent(new KeyboardEvent('keydown', { key:'Enter', bubbles:true }));
      assert(document.querySelectorAll('.qz-size')[2].classList.contains('is-picked'), '120 ms highlight');
      await sleep(140); await move();
      eq(authFlow.step, 'su-location'); eq(suWiz.teamSize, '21\u201350');
      await answerLocation('', 'Pune');
      eq(authFlow.step, 'su-name');
      await sleep(200); eq(document.activeElement.id, 'auth-name');
      authFlow.name = 'Dana Lee'; document.getElementById('wz-form').requestSubmit();
      assert(document.getElementById('qz-step').classList.contains('qz-out'), 'Enter is OK'); await move();
      eq(authFlow.step, 'su-email');
      document.getElementById('auth-email').dispatchEvent(new KeyboardEvent('keydown', { key:'Tab', shiftKey:true, bubbles:true, cancelable:true }));
      assert(document.getElementById('qz-step').classList.contains('qz-out-back'), 'Shift+Tab from the field goes back, downward');
      await move();
      eq(authFlow.step, 'su-name'); assert(document.getElementById('qz-step').classList.contains('qz-in-back'), 'in from above');
      eq(document.getElementById('auth-name').value, 'Dana Lee', 'answers kept');
      document.querySelector('button.qz-back').click(); await move();
      eq(authFlow.step, 'su-location'); eq(document.getElementById('su-city').value, 'Pune', 'the city kept');
      document.querySelector('button.qz-back').click(); await move();
      eq(authFlow.step, 'su-size'); assert(document.getElementById('su-size-2').checked, 'the chip kept');
      document.querySelector('button.qz-back').click(); await move();
      eq(authFlow.step, 'su-type'); assert(document.getElementById('su-type-1').checked, 'the choice kept');
      assert(/prefers-reduced-motion: reduce\)\{[^}]*\.qz-in, \.qz-in-back \{ animation:qzFade \.15s/.test(document.querySelector('style').textContent.replace(/\n\s*/g,'')), 'reduced motion: a 150 ms cross-fade');
    });

    await test('03b An email that already has an account offers sign-in on the email question', async function(){
      await pickType('Staffing agency'); await answerName('Alex M');
      await answerEmail('alex@northstar.example');
      eq(authFlow.step, 'su-email'); eq(authFlow.errorField, 'auth-email'); assert(/already uses this email/.test(authFlow.error));
      eq((await authApi.passwordSignIn({ email:'alex@northstar.example', password:'Harbor-Lights-42' })).error, 'invalid_credentials', 'existing password untouched');
    });

    await test('03d Google: four questions, the provider gives the email and no password is asked', async function(){
      SIGNUP_LEADS.length = 0;
      await pickType('Staffing agency'); authFlow.name = 'Taylor Kim';
      suOAuthStart('google'); await idle(); await move();
      eq(authFlow.step, 'oauth-sim'); eq(qCount(), '4 of 5', 'the chooser belongs to the name question'); eq(document.querySelectorAll('.qz-seg').length, 5, 'five questions: type, team size, location, name, mobile');
      suOAuthPick('new'); await idle(); await move(); await idle();
      eq(authFlow.step, 'su-mobile'); eq(qCount(), '5 of 5');
      assert(/Signed up with Google as taylor\.kim@gmail\.com/.test(qText()));
      await sleep(200); eq(document.activeElement.id, 'auth-mobile');
      suQBack(); await move(); eq(authFlow.step, 'su-name', 'Back goes to the name'); await answerName('Taylor Kim'); eq(authFlow.step, 'su-mobile', 'and forward skips the email');
      authFlow.mobile = '98250 41207'; suMobileSubmit();
      assert(/Creating your workspace/.test(document.querySelector('.qz-primary').textContent), 'the mobile number is the last question');
      await intoProduct();
      assert(!emailVerifyLocked() && !document.querySelector('#verify-banner-root .vb'), 'the provider verified the email');
      eq(authApi._verifyMailCount('taylor.kim@gmail.com'), 0, 'no link needed');
      const l = SIGNUP_LEADS[0];
      eq(l.method, 'google'); eq(l.emailVerified, true); eq(l.email, 'taylor.kim@gmail.com'); eq(l.stepReached, 'in_product');
      reset(); await pickType('Staffing agency'); authFlow.name = 'Alex';
      suOAuthStart('google'); await idle(); await move(); suOAuthPick('approve'); await idle(); await settle();
      assert(appVisible(), 'someone already on Oontu is signed in, not signed up');
      reset(); await pickType('Staffing agency');
      suOAuthStart('microsoft'); await idle(); await move(); suOAuthPick('cancel'); await idle(); await move();
      eq(authFlow.step, 'su-name'); assert(/cancelled/i.test(authFlow.notice));
    });

    await test('03e Corporate needs a company email on the email question; an agency accepts any', async function(){
      await pickType('Corporate'); await answerName('Dana Lee');
      await answerEmail('dana@gmail.com');
      eq(authFlow.errorField, 'auth-email'); eq(authFlow.error, 'Use your company email. Gmail and other personal addresses can’t create a company workspace.');
      eq(authFlow.step, 'su-email');
      eq((await authApi.signUp({ name:'Dana', email:'dana@yahoo.com', mobileCode:'+91', mobile:'9825041207', password:'Harbor-Lights-42', type:'Corporate' })).error, 'personal_email', 'the server checks too');
      ['gmail.com','yahoo.com','outlook.com','hotmail.com','live.com','icloud.com','rediffmail.com','proton.me','protonmail.com','aol.com','zoho.com','yandex.com','gmx.com','mail.com'].forEach(function(d){ assert(isFreeEmailDomain(d), d); });
    });

    await test('03f Corporate with a personal Google account goes to the email question; a work account continues', async function(){
      await googleUp('Corporate', 'new');
      eq(authFlow.step, 'su-email'); assert(/Use your company email/.test(authFlow.error), 'the same message');
      eq((await authApi.session()).authenticated, false, 'the personal account is signed out');
      reset(); await googleUp('Corporate', 'new_work');
      eq(authFlow.step, 'su-mobile');
      await answerMobile('98250 41207'); await intoProduct();
      eq(ORG_STRUCTURE.profile.orgType, 'Corporate'); eq(ORG_STRUCTURE.profile.verification, 'unverified'); eq(ORG_STRUCTURE.profile.domain, 'brightpath.in');
    });

    await test('03g Corporate on a domain that already has a workspace: Request to join, in the same layout', async function(){
      SIGNUP_LEADS.length = 0;
      await pickType('Corporate'); await answerName('Ravi Iyer');
      await answerEmail('ravi@infosys.com');
      eq(authFlow.step, 'su-join'); eq(qTitle(), 'Join Infosys?'); eq(qCount(), '5 of 7', 'in place of the email question');
      assert(/Infosys already has an Oontu workspace\. Ask its owner, Anita Rao, to let you in\./.test(qText()));
      assert(document.querySelector('.qz-prog') && document.querySelector('.wz-exit') && document.querySelector('button.qz-back'), 'same header, line and Back');
      eq(document.querySelector('.qz-primary').textContent, 'Request to join');
      suJoinBack(); await move(); eq(authFlow.step, 'su-email'); eq(document.getElementById('auth-email').value, 'ravi@infosys.com', 'Back keeps the email');
      await answerEmail('ravi@infosys.com');
      suJoinRequest(); await idle();
      assert(/We sent your request to Anita Rao\./.test(qText()));
      eq(SIGNUP_LEADS[0].stepReached, 'join_requested');
      suJoinApprove(); await idle();
      eq(authFlow.step, 'invite', 'the approval emails an invitation'); eq(authFlow.invite.orgName, 'Infosys');
      authFlow.name = 'Ravi Iyer'; authInviteNext(); document.getElementById('auth-password').value = 'Harbor-Lights-42'; authInviteNext(); await idle();
      assert(appVisible(), 'in the company workspace'); eq(state.role, 'recruiter');
    });

    await test('03h Corporate on a new domain: Unverified company, corporate roles; the next person from it is asked to join', async function(){
      await signUpAll('Corporate', 'Dana Lee', 'dana@startup.example');
      eq(ORG_STRUCTURE.profile.orgType, 'Corporate'); eq(ORG_STRUCTURE.profile.verification, 'unverified'); eq(ORG_STRUCTURE.profile.domain, 'startup.example');
      eq(CUSTOM_ROLES.map(function(r){ return r.name; }).join(','), 'Owner,TA Head,Recruiter,Hiring Manager,Interviewer,Approver');
      const pill = document.querySelector('#org-verify-slot .org-pill');
      assert(pill && /Unverified company/.test(pill.textContent), 'pill in the header');
      assert(!filterNavForOrgType([{id:'client-management'},{id:'jobs'}]).some(function(i){ return i.id==='client-management'; }), 'corporate hides Clients');
      backToSignIn();
      await pickType('Corporate'); await answerName('Mira Shah'); await answerEmail('mira@startup.example');
      eq(authFlow.step, 'su-join', 'the next person from that domain is asked to join');
      reset(); await signUpAll('Corporate', 'Kiran Rao', 'kiran@bigco.example', null, null, '200+');
      wsOpenItem('corp-setup'); assert(document.getElementById('ws-struct-1').checked, '200+: Several entities or countries is pre-selected'); wsCloseSheet();
      eq(roleTemplatesForOrgType('Staffing agency').map(function(r){ return r.name; }).join(','), 'Owner,Recruiter Manager,Recruiter');
      assert(roleTemplatesForOrgType('Staffing agency')[0].protected, 'owner is locked');
    });

    await test('05y Unverified: banner with Resend and I’ve verified, locks in place; invites written now are queued and sent on verifying', async function(){
      await signUpAll();
      assert(emailVerifyLocked());
      const banner = document.querySelector('#verify-banner-root .vb');
      assert(/Resend/.test(banner.textContent) && /Change email/.test(banner.textContent) && /I’ve verified/.test(banner.textContent));
      wsOpenItem('agency-team');
      eq(sheetTitle(), 'Invite your team'); assert(/We’ll send the invites once you verify your email\./.test(document.querySelector('.ws-sheet').textContent));
      eq(roleOptions('su-inv-role-0'), 'Recruiter Manager,Recruiter', 'agency roles');
      wsSetup.team[0].email = 'priya@startup.example'; await saveSheet();
      const r = RECRUITER_ROSTER.filter(function(x){ return x.email==='priya@startup.example'; }).pop();
      eq(r.inviteState, 'queued'); eq(authApi._inviteMail().length, 0, 'nothing sent while unverified');
      assert(/1 queued/.test(cardText()), 'shown as queued on the card');
      showView('team-members'); await idle();
      const inv = document.querySelector('button[onclick*="tmOpenInvite("]');
      assert(inv && inv.disabled && inv.classList.contains('vlock'), 'the usual invite stays locked');
      const jobs = JOBS.length; publishJob(); eq(JOBS.length, jobs, 'no job published');
      await verifyBannerConfirm(); await idle(); await settle();
      assert(!emailVerifyLocked()); await sleep(260); eq(document.getElementById('verify-banner-root').innerHTML, '', 'banner gone');
      eq(r.inviteState, 'sent'); eq(authApi._inviteMail().filter(function(m){ return m.to==='priya@startup.example'; }).length, 1, 'the queued invite goes out');
      verifyBannerResendAt = 0;
      backToSignIn(); await signInWithPassword('dana@startup.example', 'Harbor-Lights-42');
      assert(appVisible() && !emailVerifyLocked(), 'verified for good');
    });

    await test('06d Save and exit reopens the exact question with the answers filled in', async function(){
      await pickType('Staffing agency'); await answerName('Riya Sen'); await answerEmail('riya@hirefast.in');
      authFlow.mobile = '98111 22233'; renderOnboardingScreen();
      document.querySelector('.wz-exit').click(); await idle();
      eq(authFlow.intent, 'signin'); eq(document.querySelector('.au-h1').textContent, 'Welcome', 'back on sign-in');
      assert(/Your progress is saved\. Sign in to pick up where you left off\./.test(screenText()));
      eq(document.getElementById('auth-email').value, 'riya@hirefast.in');
      document.getElementById('auth-password').value = 'anything-at-all'; authSubmitPassword(); await idle(); await move();
      eq(authFlow.step, 'su-mobile', 'the same question'); eq(qCount(), '6 of 7');
      eq(document.getElementById('auth-mobile').value, '98111 22233', 'answer kept');
      eq(authFlow.name, 'Riya Sen'); eq(suWiz.type, 'Staffing agency');
      // the reminder email's resume link
      document.querySelector('.wz-exit').click(); await idle();
      const link = Array.from(document.querySelectorAll('.au-proto-link button')).find(function(b){ return /open resume link/.test(b.textContent); });
      link.click(); await idle(); await move(); eq(authFlow.step, 'su-mobile');
      // someone who left at the first question comes back through Create an account
      reset(); SIGNUP_LEADS.length = 0;
      await pickType('Corporate'); suSaveAndExit(); await idle();
      authSwitchIntent('signup'); await idle(); await move();
      eq(authFlow.step, 'su-name'); eq(suWiz.type, 'Corporate');
      // Restart onboarding closes the lead and starts at the first question
      await restartOnboarding(); await idle();
      eq(authFlow.step, 'su-type'); eq(SIGNUP_LEADS[0].status, 'restarted'); eq(suUnfinishedLead(''), null, 'nothing left to resume');
    });

    await test('06k Oontu team creates a tenant; the owner sets a password and lands in the product with the checklist', async function(){
      const start = PLATFORM_TENANTS.length;
      state.role = 'oontu'; const app = document.getElementById('app'); app.classList.remove('hidden'); app.classList.add('flex'); document.getElementById('onboarding').classList.add('hidden');
      showView('oontu-tenants'); await idle();
      const btn = Array.from(document.querySelectorAll('#main-content button')).find(function(b){ return b.textContent.trim()==='Create tenant'; });
      btn.click();
      ctSheet.company = 'Kite Hiring'; ctSheet.name = 'Ravi Menon'; ctSheet.email = 'ravi@gmail.com'; ctSheet.mobile = '98250 41207'; ctPickType('Corporate');
      ctSubmit(); eq(document.getElementById('ct-email-err').textContent, AUTH_MESSAGES.personal_email, 'corporate work-email rule'); eq(PLATFORM_TENANTS.length, start);
      ctPickType('Staffing agency'); ctSheet.email = 'ravi@kitehiring.example';
      ctSubmit(); await idle();
      const tn = PLATFORM_TENANTS[PLATFORM_TENANTS.length-1];
      eq(tn.status, 'invited');
      document.getElementById('create-tenant-modal-root').querySelector('.ct-primary').click(); await idle(); await move();
      eq(authFlow.step, 'su-owner'); eq(qTitle(), 'Set your password');
      assert(/The Oontu team has set up Kite Hiring for you\./.test(qText()));
      assert(!document.querySelector('.qz-count') && !document.querySelector('.qz-prog'), 'one question: no counter or line');
      document.getElementById('auth-password').value = 'Harbor-Lights-42'; document.getElementById('auth-password-confirm').value = 'Harbor-Lights-4';
      suOwnerSetPassword(); assert(document.getElementById('auth-password-confirm-err'), 'passwords must match');
      document.getElementById('auth-password-confirm').value = 'Harbor-Lights-42'; suOwnerSetPassword(); await idle(); await settle();
      assert(appVisible(), 'straight into the product'); eq(state.role, 'admin'); assert(!emailVerifyLocked(), 'the invite link proved the email');
      assert(/Complete your workspace/.test(cardText()), 'the same checklist card');
      eq(tn.status, 'active', 'tenant is Active');
      wsOpenItem('agency-profile'); eq(document.getElementById('su-company').value, 'Kite Hiring', 'the company name carries over'); wsCloseSheet();
      eq((await authApi.acceptOwnerInvite({ token:tn.inviteToken, password:'Other-Pass-9876' })).error, 'invite_used', 'the link works once');
    });

    await test('06l Incomplete sign-ups: question names, Setup not finished, call outcomes, assisted sign-up with permission and audit', async function(){
      state.role = 'oontu'; const app = document.getElementById('app'); app.classList.remove('hidden'); app.classList.add('flex'); document.getElementById('onboarding').classList.add('hidden');
      SIGNUP_LEADS.length = 0; seedSignupLeads();
      renderSidebar(); suLeadFilter = 'All'; suLeadSearch = ''; suLeadShowClosed = false;
      showView('oontu-signups'); await idle();
      const rows = function(){ return Array.from(document.querySelectorAll('#oontu-signups-table tbody tr')); };
      eq(rows().length, 7, 'seven sign-ups still answering questions');
      eq(LEAD_STOP_STEPS.join('|'), 'Workspace type|Team size|Location|Name|Email|Mobile|Password');
      assert(Array.from(document.querySelectorAll('#oontu-signups-table th')).some(function(th){ return th.textContent==='Team size'; }), 'Team size column');
      const calls = oontuSignupsRows().filter(leadNeedsCall).map(function(l){ return teamSizeRank(l.teamSize); });
      assert(calls.length>1 && calls.every(function(r, i){ return i===0 || r<=calls[i-1]; }), 'leads that need a call: bigger teams first');
      assert(oontuSignupsRows().slice(0, calls.length).every(leadNeedsCall), 'and they come first');
      assert(/Bigger teams are called first\./.test(document.getElementById('main-content').textContent));
      eq(leadStoppedAt(signupLeadById('lead-s1')), 'Password'); eq(leadStoppedAt(signupLeadById('lead-s2')), 'Mobile'); eq(leadStoppedAt(signupLeadById('lead-s7')), 'Workspace type');
      const stops = document.getElementById('oontu-signups-stops').textContent;
      assert(/Workspace type/.test(stops) && /Name/.test(stops) && /Mobile/.test(stops) && /Password/.test(stops) && !/Workspace setup|Verify email/.test(stops), 'Where people stop uses the question names');
      assert(Array.from(document.querySelectorAll('[data-lead-filter]')).some(function(b){ return b.textContent==='Setup not finished'; }), 'separate filter');
      setSignupFilter('Setup not finished');
      eq(rows().length, 2); assert(rows().every(function(r){ return /Setup \d of \d/.test(r.textContent) && /In product/.test(r.textContent); }), 'owners in the product, with checklist progress');
      setSignupFilter('Corporate'); assert(rows().every(function(r){ return /Corporate/.test(r.textContent); }), 'Corporate filter');
      setSignupFilter('All');
      openSignupSheet('lead-s3'); assignSignupLead('Farhan Ali'); eq(leadFollowUp(signupLeadById('lead-s3')).label, 'Assigned');
      suLeadSheet.call = { outcome:'will_finish', reason:'Too many steps', nextDate:'', note:'' }; logSignupCall(); eq(leadFollowUp(signupLeadById('lead-s3')).label, 'Resume link sent');
      openSignupSheet('lead-s6'); suLeadSheet.call = { outcome:'needs_help', reason:'Too many steps', nextDate:'', note:'' }; logSignupCall();
      assert(document.getElementById('lead-assist').disabled, 'needs permission first');
      document.getElementById('lead-permission').click();
      await startAssistedSetup('lead-s6'); await idle(); await move();
      eq(authFlow.step, 'su-mobile', 'opens at the question where they stopped');
      assert(/You’re setting this up for Kavya Reddy, with their permission/.test(document.querySelector('.wz-assist').textContent), 'banner');
      eq(qCount(), '6 of 6', 'the customer sets their own password later');
      await answerMobile('90000 52413');
      assert(await waitFor(function(){ return state.activeNav==='oontu-signups' && appVisible(); }, 4000), 'back on Incomplete sign-ups');
      const l = signupLeadById('lead-s6');
      eq(l.status, 'in_product'); eq(leadFollowUp(l).label, 'In product');
      assert(authApi._latestReset && authApi._latestReset('kavya@brightminds.in'), 'a set-password email went to the customer');
      const audit = AUDIT_LOG.filter(function(a){ return a.action==='Assisted setup by Meera Krishnan for Kavya Reddy'; });
      assert(audit.some(function(a){ return /permission/.test(a.detail); }) && audit.some(function(a){ return /Finished sign-up/.test(a.detail); }), 'every action audited');
    });

    await test('06i Agency checklist: seven items in side sheets, Kairo, Hide for now, reminder, ready for one session, Settings', async function(){
      SIGNUP_LEADS.length = 0;
      await signUpAll('Staffing agency', 'Dana Lee', 'dana@startup.example');
      const items = function(){ return Array.from(document.querySelectorAll('#ws-card .ws-item__title')).map(function(e){ return e.textContent; }).join('|'); };
      eq(items(), 'Agency profile|Connect your tools|Invite your team|Marketplace listing|Oontu jobs website|Add your first client|Open your first job');
      assert(/0 of 7 done/.test(cardText()));
      assert(/Kairo Start with your agency profile\. It takes a minute\./.test(cardText()), 'Kairo suggests the next item');
      eq(document.querySelectorAll('#ws-card .first-run__check').length, 7, 'a circle for each');
      document.querySelector('#ws-card .ws-item').click();
      eq(sheetTitle(), 'Agency profile');
      assert(document.querySelector('.app-sheet.ws-sheet .app-sheet__foot'), 'side sheet with the footer');
      eq(getComputedStyle(document.querySelector('.ws-sheet')).maxWidth, '560px');
      assert(!document.querySelector('label[for="su-company"]').classList.contains('sr-only'), 'labels above the fields');
      eq(Array.from(document.querySelectorAll('.ws-sheet .app-sheet__foot button')).map(function(b){ return b.textContent; }).join('|'), 'Cancel|Save');
      await saveSheet(); assert(document.getElementById('su-company-err'), 'agency name required'); assert(wsSheet, 'stays open');
      document.getElementById('su-company').value = 'Startup Talent'; ob.companyName = 'Startup Talent';
      const gst = document.getElementById('su-gst'); gst.value = '24AAACC1206'; suAgency().gst = gst.value; suGstBlur(gst);
      eq(document.getElementById('su-gst-err').textContent, 'Check your GST number. It should be 15 characters, like 24AAACC1206D1ZM.', 'checked on blur');
      const g2 = document.getElementById('su-gst'); g2.value = '24aaacc1206d1zm'; g2.dispatchEvent(new Event('input'));
      const br = document.getElementById('su-chips-branches');
      br.value = 'Pune'; br.dispatchEvent(new KeyboardEvent('keydown', { key:'Enter', bubbles:true }));
      const br2 = document.getElementById('su-chips-branches'); br2.value = 'Mumbai, Delhi'; br2.dispatchEvent(new KeyboardEvent('keydown', { key:',', bubbles:true }));
      eq(suAgency().branches.join(), 'Pune,Mumbai,Delhi', 'Enter and comma make chips');
      await saveSheet();
      assert(!wsSheet, 'closed'); eq(ORG_STRUCTURE.profile.brandName, 'Startup Talent'); eq(ORG_STRUCTURE.profile.gstin, '24AAACC1206D1ZM');
      eq((await authApi.session()).workspaces[0].name, 'Startup Talent', 'renamed on the server');
      assert(/1 of 7 done/.test(cardText()) && document.querySelector('#ws-card .ws-item.is-done'), 'ticked');
      assert(/Agency profile saved/.test(document.querySelector('.app-toasts').textContent), 'toast');
      wsOpenItem('agency-tools'); suConnect('calendar'); await sleep(600);
      assert(/Connected/.test(document.querySelector('.ws-sheet').textContent)); await saveSheet();
      wsOpenItem('agency-marketplace'); document.getElementById('su-market').click();
      assert(document.getElementById('su-chips-specialisations'), 'chips once listed'); suAgency().specialisations.push('Fintech hiring'); await saveSheet();
      eq(ORG_STRUCTURE.profile.marketplaceListed, true); eq(ORG_STRUCTURE.profile.marketplaceSpecialisations.join(), 'Fintech hiring');
      wsOpenItem('jobs-site'); eq(document.getElementById('su-jobsite').getAttribute('aria-checked'), 'false', 'off by default'); await saveSheet();
      eq(ORG_STRUCTURE.profile.jobsWebsiteAllowed, false);
      wsOpenItem('agency-team'); await saveSheet(); eq(document.getElementById('su-inv-email-0-err').textContent, 'Add at least one email to invite.');
      wsSetup.team[0].email = 'dana@startup.example'; await saveSheet(); assert(/your own email/.test(document.getElementById('su-inv-email-0-err').textContent));
      wsSetup.team[0].email = 'meena@talent-one.example'; wsSetup.team[0].roleId = 'role_recmgr'; suTeamAdd();
      eq(roleOptions('su-inv-rep-1'), 'You,meena@talent-one.example', 'a Recruiter Manager can be reported to');
      wsSetup.team[1].email = 'arun@talent-one.example'; wsSetup.team[1].reportsTo = 'meena@talent-one.example'; await saveSheet();
      const newest = function(email){ return RECRUITER_ROSTER.filter(function(x){ return x.email===email; }).pop(); };
      eq(newest('arun@talent-one.example').inviteState, 'queued'); eq(tmManagerIdOf(newest('arun@talent-one.example')), newest('meena@talent-one.example').id, 'reports to Meena');
      assert(/5 of 7 done/.test(cardText()));
      wsSimulateDays();
      assert(/Kairo 2 setup items left\. Want to finish your first client now\?/.test(cardText()), 'the reminder after three days');
      wsHideForNow(); assert(!document.getElementById('ws-card'), 'Hide for now'); showView('admin-dashboard'); assert(!document.getElementById('ws-card'), 'for this session');
      showView('setup-hub'); assert(document.querySelector('#ws-setup-section #ws-card'), 'still in Settings > Workspace setup');
      const defs = document.getElementById('ws-defaults');
      eq(Array.from(defs.querySelectorAll('.ws-defs__row')).map(function(r){ return r.querySelector('dt').textContent+'='+r.querySelector('dd').textContent; }).join('|'),
        'Team size=6\u201320|Country=\ud83c\uddee\ud83c\uddf3 India|City (head office)=Mumbai|Currency=INR (\u20b9)|Timezone=Asia/Kolkata (IST, UTC+5:30)|Date format=DD MMM YYYY|Data region=India|Roles=Owner, Recruiter Manager, Recruiter|Approvals=Follow the reporting line|New applicants=Shared round-robin across the job team|Client duplicate window=90 days|Submission reply time=48 hours', 'Your defaults, read-only');
      eq(defs.querySelectorAll('button').length, 11, 'each with Edit or Change, except data region');
      assert(/Data regionIndiaContact us to change/.test(defs.textContent), 'data region needs Oontu');
      wsSessionSeq++; showView('admin-dashboard'); assert(document.getElementById('ws-card'), 'back next session');
      wsOpenItem('first-client'); await idle();
      eq(state.activeNav, 'client-management'); assert(document.getElementById('nc-display'), 'the full-page client form');
      ncForm.displayName = 'Zeta Fintech'; ncForm.companyName = 'Zeta Fintech Pvt Ltd'; ncForm.firstName = 'Rahul'; ncForm.lastName = 'Mehta'; ncForm.email = 'rahul@zetafin.example'; ncForm.treatment = 'business_none'; ncForm.place = 'Maharashtra'; ncSave('add');
      JOBS.push(Object.assign({}, JOBS[0], { id:'j-test-first', title:'Backend Engineer' }));   // the job form is long; a new job is what ticks the item
      showView('admin-dashboard');
      assert(/Your workspace is ready/.test(cardText()), 'all done');
      eq(SIGNUP_LEADS[0].status, 'completed', 'the Super Admin list stops counting it');
      wsSessionSeq++; showView('admin-dashboard'); assert(!document.getElementById('ws-card'), 'gone after one session');
      JOBS.pop();
    });

    await test('06m Corporate checklist: company setup, entities only for a group, how people join, careers page, vendors', async function(){
      await signUpAll('Corporate', 'Neha Rao', 'neha@acmeworks.example');
      const items = function(){ return wsItems().map(function(k){ return WS_ITEMS[k].title; }).join('|'); };
      eq(items(), 'Company setup|Company profile|How people join|Careers page|Oontu jobs website|Vendor agencies');
      assert(/0 of 6 done/.test(cardText()));
      wsOpenItem('corp-setup');
      assert(document.getElementById('ws-struct-0').checked, 'team size 6\u201320: One company is pre-selected');
      eq(document.querySelector('label[for="ws-struct-1"] .wz-choice__title').textContent, 'Several entities or countries');
      document.getElementById('ws-struct-1').click(); await saveSheet();
      eq(items(), 'Company setup|Company profile|Entities and salary bands|How people join|Careers page|Oontu jobs website|Vendor agencies', 'a group adds entities');
      assert(/1 of 7 done/.test(cardText()));
      wsOpenItem('org-basics'); document.getElementById('su-company').value = 'Acme Works'; ob.companyName = 'Acme Works'; await saveSheet();
      eq(ORG_STRUCTURE.profile.brandName, 'Acme Works');
      wsOpenItem('corp-entities'); await saveSheet(); eq(document.getElementById('su-chips-entities-err').textContent, 'Add at least one entity.');
      suAgency().entities.push('Acme Works India'); wsSetup.corp.bands[0] = { name:'L1', min:'10', max:'6' }; await saveSheet();
      assert(/can’t be lower/.test(document.getElementById('ws-band-max-0-err').textContent), 'band range');
      wsSetup.corp.bands[0].max = '14'; await saveSheet(); eq(ORG_STRUCTURE.profile.salaryBands[0].max, 14);
      wsOpenItem('corp-join'); assert(/@acmeworks\.example/.test(document.querySelector('.ws-sheet').textContent), 'the company domain');
      document.getElementById('ws-join-1').click(); await saveSheet(); eq(ORG_STRUCTURE.profile.joinPolicy, 'auto');
      wsOpenItem('corp-careers'); document.getElementById('ws-careers').click();
      eq(document.getElementById('ws-careers-slug').value, 'acme-works', 'address from the company name');
      wsSetup.corp.careersSlug = 'Bad Slug!'; await saveSheet(); assert(document.getElementById('ws-careers-slug-err'), 'address checked');
      wsSetup.corp.careersSlug = 'acme-works'; await saveSheet(); eq(ORG_STRUCTURE.profile.careersPage.slug, 'acme-works');
      wsOpenItem('jobs-site'); assert(/Oontu will verify your company/.test(document.querySelector('.ws-sheet').textContent), 'unverified company note'); await saveSheet();
      wsOpenItem('corp-vendors'); suAgency().vendors.push('not-an-email'); await saveSheet(); assert(document.getElementById('su-chips-vendors-err'), 'emails checked');
      suAgency().vendors = ['hello@talentbridge.example']; await saveSheet();
      eq(wsSetup.vendorInvites[0].state, 'queued', 'queued until verified');
      assert(/Your workspace is ready/.test(cardText()), 'seven of seven');
    });

    await test('06h Password helper on the password question', async function(){
      await pickType('Staffing agency'); await answerName('Dana Lee'); await answerEmail('dana@startup.example'); await answerMobile('98250 41207');
      const pw = document.getElementById('auth-password'), box = document.getElementById('auth-password-strength');
      const lvl = function(v){ pw.value = v; authPwStrength(pw); return box.getAttribute('data-level')+' '+box.querySelector('.su-pw__text').textContent; };
      eq(lvl(''), '0 Use 10 or more characters');
      eq(lvl('short'), '1 Use 10 or more characters');
      eq(lvl('password123'), '1 Too easy to guess');
      eq(lvl('harborlights'), '3 Good');
      eq(lvl('Harbor-Lights-42'), '4 Strong');
    });

    await test('06g Recruiter Manager is the role name everywhere', async function(){
      const old = 'Recruitment'+' Manager';   // split so this test's own source doesn't match
      eq(document.getElementById('app').innerHTML.indexOf(old), -1, 'old name gone from the app shell');
      eq(document.querySelector('[onclick="switchRole(\'manager\')"]').firstChild.textContent.trim(), 'Recruiter Manager', 'role switcher');
      assert(roleTemplatesForOrgType('Staffing agency').some(function(r){ return r.name==='Recruiter Manager'; }));
      eq(ROLE_META.manager.label, 'Recruiter Manager');
    });

    /* ---- one-time codes ---- */
    await test('04a Wrong code shows an error and keeps the code field in place', async function(){
      await enterEmail('alex@northstar.example');
      await enterCode(wrongCode(authApi._latestEmail('alex@northstar.example').code));
      eq(authFlow.step, 'email'); assert(authFlow.codePending);
      eq(authFlow.errorField, 'auth-code');
      eq(document.getElementById('auth-code').getAttribute('aria-invalid'), 'true');
      assert(!appVisible(), 'must not sign in');
    });

    await test('04b Expired code is rejected and locks verification until a new code is sent', async function(){
      await enterEmail('alex@northstar.example');
      const code = authApi._latestEmail('alex@northstar.example').code;
      authApi._expireCode('alex@northstar.example');
      await enterCode(code);
      assert(/expired/i.test(authFlow.error), 'expired message');
      assert(authFlow.codeLocked, 'locked');
      assert(document.querySelector('.au-btn--primary').disabled, 'verify disabled');
      assert(!appVisible());
    });

    await test('04c A used code cannot be replayed', async function(){
      await authApi.sendCode({ email:'alex@northstar.example' });
      const code = authApi._latestEmail('alex@northstar.example').code;
      eq((await authApi.verifyCode({ email:'alex@northstar.example', code:code })).ok, true);
      eq((await authApi.verifyCode({ email:'alex@northstar.example', code:code })).error, 'invalid_code');
    });

    await test('04d Five wrong attempts burn the code, even the right one afterwards', async function(){
      await authApi.sendCode({ email:'alex@northstar.example' });
      const code = authApi._latestEmail('alex@northstar.example').code;
      let last;
      for(let i=0;i<5;i++) last = await authApi.verifyCode({ email:'alex@northstar.example', code:wrongCode(code) });
      eq(last.error, 'too_many_attempts');
      eq((await authApi.verifyCode({ email:'alex@northstar.example', code:code })).ok, false);
    });

    await test('04e Resend cooldown and send rate limit are enforced', async function(){
      const e = 'rate@test.example';
      eq((await authApi.sendCode({ email:e })).ok, true);
      eq((await authApi.sendCode({ email:e })).error, 'resend_cooldown');
      for(let i=0;i<4;i++){ authApi._advance(31000); eq((await authApi.sendCode({ email:e })).ok, true, 'send '+(i+2)); }
      authApi._advance(31000);
      const r = await authApi.sendCode({ email:e });
      eq(r.error, 'rate_limited');
      assert(r.retryAfterSec>0, 'retry-after given');
    });

    await test('04f Resending replaces the earlier code', async function(){
      await enterEmail('alex@northstar.example');
      const first = authApi._latestEmail('alex@northstar.example').code;
      authApi._advance(31000); authFlow.resendAt = 0;
      authResend(); await idle();
      assert(/new code/i.test(authFlow.notice), 'notice shown');
      const second = authApi._latestEmail('alex@northstar.example').code;
      if(first!==second) eq((await authApi.verifyCode({ email:'alex@northstar.example', code:first })).ok, false, 'old code');
    });

    await test('04g Invalid email is caught before any request', async function(){
      await enterEmail('not-an-email');
      eq(authFlow.step, 'email'); eq(authFlow.errorField, 'auth-email');
      eq(authApi._outboxCount('not-an-email'), 0);
    });

    /* ---- password sign-in ---- */
    await test('05a A wrong password shows one generic message and does not sign in', async function(){
      await signInWithPassword('alex@northstar.example', 'not-the-password');
      eq(authFlow.errorField, 'auth-password');
      eq(authFlow.error, 'Incorrect email or password.');
      eq(document.getElementById('auth-password').value, '', 'the field is cleared');
      assert(!appVisible());
    });

    await test('05b An unknown account gets exactly the same answer', async function(){
      const a = await authApi.passwordSignIn({ email:'alex@northstar.example', password:'wrong-password-1' });
      const b = await authApi.passwordSignIn({ email:'nobody@nowhere.example', password:'wrong-password-1' });
      eq(JSON.stringify(a), JSON.stringify(b));
    });

    await test('05c Five wrong passwords lock password sign-in for a while; a code still works', async function(){
      for(let i=0;i<5;i++) await authApi.passwordSignIn({ email:'alex@northstar.example', password:'wrong-password-'+i });
      const locked = await authApi.passwordSignIn({ email:'alex@northstar.example', password:SAMPLE_PW });
      eq(locked.error, 'signin_locked'); assert(locked.retryAfterSec>0, 'retry-after given');
      eq((await apiSignIn('alex@northstar.example')).ok, true, 'one-time code still available');
      authApi._advance(16*60*1000);
      eq((await authApi.passwordSignIn({ email:'alex@northstar.example', password:SAMPLE_PW })).ok, true, 'works after the lockout');
    });

    await test('05d The password stays out of flow state, the URL and storage', async function(){
      const pw = 'Zebra-Lantern-9921';
      await signInWithPassword('alex@northstar.example', pw, true);
      assert(JSON.stringify(authFlow).indexOf(pw)<0, 'flow state');
      assert(window.location.href.indexOf(pw)<0, 'url');
      let stored = '';
      try { for(let i=0;i<localStorage.length;i++) stored += localStorage.getItem(localStorage.key(i)); } catch(e){}
      assert(stored.indexOf(pw)<0, 'storage');
    });

    await test('05e Remember me keeps the email for next time, and unticking forgets it', async function(){
      await signInWithPassword('alex@northstar.example', SAMPLE_PW, true);
      eq(localStorage.getItem(AUTH_REMEMBER_KEY), 'alex@northstar.example');
      performLogout(); await idle();
      eq(authFlow.email, 'alex@northstar.example', 'email pre-filled after sign-out');
      eq(document.activeElement.id, 'auth-password', 'a remembered email puts the cursor on the password');
      await toPasswordQuestion('alex@northstar.example');
      assert(document.querySelector('.au-check input').checked, 'box ticked');
      await signInWithPassword('alex@northstar.example', SAMPLE_PW, false);
      eq(localStorage.getItem(AUTH_REMEMBER_KEY), null, 'forgotten when unticked');
    });

    await test('05f The show/hide control reveals and re-hides the password', async function(){
      await toPasswordQuestion('alex@northstar.example');
      const input = document.getElementById('auth-password'), btn = document.querySelector('.au-trail');
      eq(input.type, 'password');
      btn.click(); eq(input.type, 'text'); eq(btn.getAttribute('aria-label'), 'Hide password'); eq(btn.getAttribute('aria-pressed'), 'true');
      btn.click(); eq(input.type, 'password'); eq(btn.getAttribute('aria-label'), 'Show password');
    });

    await test('05g Email and password are both required before any request', async function(){
      authFlow.email = ''; authSubmitPassword(); eq(authFlow.errorField, 'auth-email');
      authFlow.email = 'alex@northstar.example'; renderOnboardingScreen(); authSubmitPassword();
      eq(authFlow.errorField, 'auth-password'); eq(authFlow.error, 'Enter your password.');
    });

    await test('05h Remember me gives a longer session on the server', async function(){
      await authApi.passwordSignIn({ email:'alex@northstar.example', password:SAMPLE_PW, remember:true });
      authApi._advance(9*3600*1000);
      eq((await authApi.session()).authenticated, true, 'still signed in after 9 hours');
      await authApi.passwordSignIn({ email:'alex@northstar.example', password:SAMPLE_PW, remember:false });
      authApi._advance(9*3600*1000);
      eq((await authApi.session()).authenticated, false, 'ordinary session ended');
    });

    /* ---- single sign-on and social ---- */
    await test('06a SSO succeeds and opens the organisation workspace', async function(){
      authFlow.email = 'lee@acme.example'; authSso(); await idle();
      eq(authFlow.step, 'sso-sim');
      authSsoSim('approve'); await idle();
      assert(appVisible()); eq(state.role, 'hm');
    });

    await test('06b SSO cancel and provider failure return to sign-in', async function(){
      authFlow.email = 'lee@acme.example'; authSso(); await idle();
      authSsoSim('cancel'); await idle();
      eq(authFlow.step, 'email'); assert(/cancelled/i.test(authFlow.notice));
      authSso(); await idle(); authSsoSim('fail'); await idle();
      eq(authFlow.step, 'email'); assert(/didn’t complete/i.test(authFlow.error));
      assert(!appVisible());
    });

    await test('06c SSO needs an email, and is refused for domains without it', async function(){
      authFlow.email = ''; authSso(); eq(authFlow.errorField, 'auth-email');
      authFlow.email = 'alex@northstar.example'; authSso(); await idle();
      assert(/isn’t available/i.test(authFlow.error)); eq(authFlow.step, 'email');
    });

    await test('06d First SSO sign-in gets the organisation default role, not a chosen one', async function(){
      authFlow.email = 'newhire@acme.example'; authSso(); await idle(); authSsoSim('approve'); await idle();
      eq(state.role, 'recruiter');
    });

    await test('06e An SSO organisation is sent to its provider before any password is asked', async function(){
      authFlow.email = 'lee@acme.example'; authSubmitEmail(); await idle();
      eq(authFlow.step, 'sso-sim'); assert(!appVisible()); assert(!document.getElementById('auth-password'), 'no password question');
    });

    /* ---- invitation activation ---- */
    await test('07 The invitation link verifies the email; setting a password activates the account', async function(){
      authLoadInvite('inv-valid-3f9a2c7d'); await idle();
      eq(authFlow.step, 'invite');
      assert(/Northstar Talent Partners/.test(screenText()) && /Recruiter/.test(screenText()) && /jordan@northstar\.example/.test(screenText()), 'invite details');
      assert(!document.getElementById('auth-email'), 'no email/login field on the activation screen');
      assert(document.getElementById('auth-name') && !document.getElementById('auth-password'), 'asks for the name first');
      authInviteNext(); eq(authFlow.errorField, 'auth-name'); assert(!appVisible());
      authFlow.name = 'Jordan Blake'; authInviteNext();
      assert(document.getElementById('auth-password') && !document.getElementById('auth-name'), 'then the password');
      assert(/Jordan Blake/.test(document.querySelector('.au-answer').textContent), 'the name stays as an answered row');
      authAcceptInvite(); eq(authFlow.errorField, 'auth-password');
      document.getElementById('auth-password').value = 'short';
      authAcceptInvite(); assert(/at least 10/i.test(authFlow.error), 'weak password is explained'); assert(!appVisible());
      document.getElementById('auth-password').value = 'Cedar-Harbor-77';
      authAcceptInvite(); await idle();
      assert(appVisible()); eq(state.role, 'recruiter');
      eq(ORG_STRUCTURE.profile.brandName, 'Northstar Talent Partners');
      eq(authApi._outboxCount('jordan@northstar.example'), 0, 'no verification code was needed');
      eq((await authApi.getInvitation({ token:'inv-valid-3f9a2c7d' })).error, 'invite_used', 'single use');
      performLogout(); await idle();
      await signInWithPassword('jordan@northstar.example', 'Cedar-Harbor-77');
      assert(appVisible(), 'afterwards they sign in normally with the password they set');
    });

    await test('07c An existing user accepting an invitation sets nothing and keeps their password', async function(){
      authLoadInvite('inv-existing-9c4d17b3'); await idle();
      eq(authFlow.step, 'invite');
      assert(!document.getElementById('auth-name') && !document.getElementById('auth-password') && !document.getElementById('auth-email'), 'no fields at all');
      authAcceptInvite(); await idle();
      assert(appVisible()); eq(state.role, 'manager');
      eq(ORG_STRUCTURE.profile.brandName, 'Acme Corp');
      eq(authApi._outboxCount('sam@harbor.example'), 0, 'no code sent');
      eq((await authApi.passwordSignIn({ email:'sam@harbor.example', password:SAMPLE_PW })).ok, true, 'old password unchanged');
    });

    await test('07b Invitation links open from the URL', async function(){
      const before = window.location.hash;
      history.replaceState(null, '', '#/invite/inv-valid-3f9a2c7d');
      const p = authParseHash();
      history.replaceState(null, '', before || window.location.pathname);
      eq(p.route, 'invite'); eq(p.token, 'inv-valid-3f9a2c7d');
    });

    await test('08 Expired, revoked and malformed invitations cannot be used', async function(){
      authLoadInvite('inv-expired-81bd04e2'); await idle();
      eq(authFlow.step, 'invite-error'); assert(/expired/i.test(screenText()));
      reset(); authLoadInvite('inv-revoked-5e77109a'); await idle();
      eq(authFlow.step, 'invite-error'); assert(/no longer valid/i.test(screenText()));
      reset(); authLoadInvite('<script>'); await idle();
      eq(authFlow.step, 'invite-error');
      reset(); authFlow.inviteLink = 'https://example.com/whatever'; authOpenInviteLink();
      eq(authFlow.errorField, 'auth-invite-link');
    });

    await test('09a Role, workspace and email sent by the client are ignored', async function(){
      const r = await authApi.acceptInvitation({ token:'inv-valid-3f9a2c7d', role:'owner', workspaceId:'ws_harbor', email:'alex@northstar.example', name:'J', password:'Cedar-Harbor-77' });
      eq(r.ok, true); eq(r.role, 'recruiter'); eq(r.workspace.id, 'ws_northstar');
      eq(r.user.email, 'jordan@northstar.example', 'identity comes from the invitation');
    });

    await test('09b Guessed tokens fail; a missing name or weak password does not spend the invitation', async function(){
      eq((await authApi.acceptInvitation({ token:'inv-guess-00000000', name:'X', password:'Cedar-Harbor-77' })).error, 'invite_invalid');
      eq((await authApi.acceptInvitation({ token:'inv-valid-3f9a2c7d', password:'Cedar-Harbor-77' })).error, 'name_required');
      eq((await authApi.acceptInvitation({ token:'inv-valid-3f9a2c7d', name:'J' })).error, 'password_short');
      eq((await authApi.acceptInvitation({ token:'inv-valid-3f9a2c7d', name:'J', password:'jordan-northstar-1' })).error, 'password_email');
      eq((await authApi.getInvitation({ token:'inv-valid-3f9a2c7d' })).ok, true, 'still pending');
    });

    await test('09c Expired and revoked invitations cannot be accepted even by calling the API directly', async function(){
      eq((await authApi.acceptInvitation({ token:'inv-expired-81bd04e2', name:'X', password:'Cedar-Harbor-77' })).error, 'invite_expired');
      eq((await authApi.acceptInvitation({ token:'inv-revoked-5e77109a', name:'X', password:'Cedar-Harbor-77' })).error, 'invite_revoked');
    });

    /* ---- tenant admin invites ---- */
    await test('27 An admin invites someone from Team members, and they can activate from that email', async function(){
      await signInWithPassword('alex@northstar.example', SAMPLE_PW);
      const roleId = customRoleId('Recruiter');
      assert(roleId, 'the workspace has a Recruiter role');
      eq(authRoleForCustomRole(roleId), 'recruiter');
      await authSendInvitation({ email:'New.Hire@Northstar.example', name:'New Hire', assignedRoleId:roleId }, 'sent');
      const mail = authApi._inviteMail();
      eq(mail.length, 1); eq(mail[0].to, 'new.hire@northstar.example');
      const inv = await authApi.getInvitation({ token:mail[0].token });
      eq(inv.ok, true); eq(inv.invitation.isNewUser, true); eq(inv.invitation.roleLabel, 'Recruiter'); eq(inv.invitation.inviterName, 'Alex Morgan');
      performLogout(); await idle();
      authFreshFlow(); authLoadInvite(mail[0].token); await idle();
      authFlow.name = 'New Hire'; authInviteNext(); document.getElementById('auth-password').value = 'Maple-Quay-5530';
      authAcceptInvite(); await idle();
      assert(appVisible()); eq(state.role, 'recruiter');
    });

    await test('27b Re-sending an invitation withdraws the earlier link', async function(){
      await apiSignIn('alex@northstar.example'); await authApi.selectWorkspace({ workspaceId:'ws_northstar' });
      await authApi.createInvitation({ email:'x.person@northstar.example', role:'recruiter' });
      await authApi.createInvitation({ email:'x.person@northstar.example', role:'manager' });
      const mail = authApi._inviteMail();
      eq(mail.length, 2);
      eq((await authApi.getInvitation({ token:mail[0].token })).error, 'invite_revoked', 'first link withdrawn');
      eq((await authApi.getInvitation({ token:mail[1].token })).invitation.role, 'manager');
    });

    await test('27c Only an admin of the workspace can invite, and the role must be valid', async function(){
      await apiSignIn('sam@harbor.example'); await authApi.selectWorkspace({ workspaceId:'ws_northstar' }); // Sam is a recruiter there
      eq((await authApi.createInvitation({ email:'a.b@northstar.example', role:'recruiter' })).error, 'forbidden');
      await authApi.signOut();
      eq((await authApi.createInvitation({ email:'a.b@northstar.example', role:'recruiter' })).error, 'unauthenticated');
      await apiSignIn('alex@northstar.example'); await authApi.selectWorkspace({ workspaceId:'ws_northstar' });
      eq((await authApi.createInvitation({ email:'a.b@northstar.example', role:'owner' })).error, 'invalid_input', 'nobody is invited as owner');
      eq((await authApi.createInvitation({ email:'nonsense', role:'recruiter' })).error, 'invalid_email');
    });

    await test('28 Workspace roles map to account roles', async function(){
      const names = { 'Recruiter':'recruiter', 'Recruiter Manager':'manager', 'Admin':'admin' };
      Object.keys(names).forEach(function(n){
        const id = customRoleId(n);
        if(id) eq(authRoleForCustomRole(id), names[n], n);
      });
    });

    /* ---- workspaces, sessions, access ---- */
    await test('10 No access to another organisation without membership', async function(){
      await apiSignIn('alex@northstar.example');
      eq((await authApi.selectWorkspace({ workspaceId:'ws_harbor' })).error, 'forbidden');
      eq((await authApi.selectWorkspace({ workspaceId:'ws_acme' })).error, 'forbidden');
      await authApi.signOut();
      eq((await authApi.createWorkspace({ name:'x', workspaceName:'Sneaky', password:'Cedar-Harbor-77' })).error, 'unauthenticated');
    });

    await test('11 A member of two workspaces chooses one and lands in it', async function(){
      await signInWithPassword('sam@harbor.example', SAMPLE_PW);
      eq(authFlow.step, 'workspaces');
      const buttons = document.querySelectorAll('.au-ws');
      eq(buttons.length, 2);
      buttons[1].click(); await idle();
      assert(appVisible()); eq(state.role, 'manager');
      eq(ORG_STRUCTURE.profile.brandName, 'Harbor Recruiting');
    });

    await test('12 Sign-out and idle expiry end the session', async function(){
      await signInWithPassword('alex@northstar.example', SAMPLE_PW);
      assert(appVisible());
      performLogout(); await idle();
      assert(authVisible() && !appVisible(), 'back on sign-in');
      eq(authFlow.step, 'email'); assert(document.getElementById('auth-email') && document.getElementById('auth-password'), 'sign-in starts again on the email and password form');
      eq((await authApi.session()).authenticated, false, 'server session ended');
      await apiSignIn('alex@northstar.example');
      authApi._idleOutSession();
      eq((await authApi.session()).authenticated, false, 'idle expiry');
      eq((await authApi.selectWorkspace({ workspaceId:'ws_northstar' })).error, 'unauthenticated');
    });

    await test('13 Double submission sends one request and disables the button', async function(){
      authApi._latency = 30;
      authFlow.email = 'once@test.example'; authFlow.method = 'code';
      authSubmitEmail(); authSubmitEmail(); authSubmitEmail();
      const btn = document.querySelector('.au-btn--primary');
      assert(btn.disabled && btn.getAttribute('aria-busy')==='true', 'busy state');
      await idle();
      eq(authApi._outboxCount('once@test.example'), 1);
    });

    await test('14 Every auth screen has one heading, labelled fields, named buttons and no long dashes', async function(){
      async function check(label, root){
        const shell = root || document.querySelector('.au-shell, .wz');
        eq(shell.querySelectorAll(root ? 'h2' : 'h1').length, 1, label+' heading count');   // a sheet inside the app is titled with an h2
        shell.querySelectorAll('input').forEach(function(i){
          assert((i.id && shell.querySelector('label[for="'+i.id+'"]')) || i.closest('label'), label+': no label for '+(i.id||i.type));
        });
        shell.querySelectorAll('button').forEach(function(b){ assert((b.textContent||'').trim() || b.getAttribute('aria-label'), label+': unnamed button'); });
        assert(shell.textContent.indexOf('—')<0, label+': contains an em dash');
      }
      await check('sign-in email');
      await toPasswordQuestion('alex@northstar.example'); await check('sign-in password');
      authSetMethod('code'); await idle(); await check('sign-in with code');
      authSetMethod('password'); authForgot(); await idle(); await check('forgot password');
      document.getElementById('auth-reset-email').value = 'alex@northstar.example'; authFlow.resetEmail = 'alex@northstar.example';
      authResetSend(); await idle(); await check('reset link sent');
      authOpenReset(authApi._latestReset('alex@northstar.example').token); await idle(); await check('set a new password');
      reset(); authSwitchIntent('signup'); await check('workspace type');
      await pickTypeOnly('Corporate'); await check('team size');
      await answerSize('200+'); await check('location');
      await answerLocation('', 'Pune'); await check('name');
      await answerName('Ravi Iyer'); await check('work email');
      await answerEmail('ravi@infosys.com'); await check('request to join');
      reset(); await pickType('Staffing agency'); await answerName('Dana Lee'); await answerEmail('dana@startup.example'); await check('mobile');
      await answerMobile('98250 41207'); await check('password');
      document.getElementById('auth-password').value = 'Harbor-Lights-42'; suPasswordSubmit();
      await intoProduct(); vbChangeEmailOpen(); await check('change email', document.querySelector('#vb-dialog-root [role=dialog]')); vbChangeEmailClose(); wsOpenItem('agency-profile'); await check('setup sheet', document.querySelector('.ws-sheet')); wsCloseSheet();
      reset(); await pickType('Staffing agency'); authFlow.name = 'Taylor'; suOAuthStart('microsoft'); await idle(); await move(); await check('provider');
      suOAuthPick('new'); await idle(); await move(); await check('add mobile');
      reset(); authGo('help'); await check('help');
      authGo('join'); await check('join');
      reset(); authLoadInvite('inv-valid-3f9a2c7d'); await idle(); await check('activate name');
      authFlow.name = 'Jordan Blake'; authInviteNext(); await check('activate password');
      reset(); authLoadInvite('inv-existing-9c4d17b3'); await idle(); await check('accept');
      reset(); authLoadInvite('inv-expired-81bd04e2'); await idle(); await check('invite error');
      reset(); await enterEmail('bad');
      const input = document.getElementById('auth-email');
      assert(/auth-error/.test(input.getAttribute('aria-describedby')||''), 'error linked to field');
      eq(document.getElementById('auth-error').getAttribute('role'), 'alert');
    });

    await test('15 Back/forward only restores steps the state supports', async function(){
      eq(authSafeStep('code'), 'email');
      eq(authSafeStep('create'), 'email');
      eq(authSafeStep('workspaces'), 'email');
      eq(authSafeStep('sso-sim'), 'email');
      eq(authSafeStep('bogus'), 'email');
      await enterEmail('alex@northstar.example');
      window.dispatchEvent(new PopStateEvent('popstate', { state:{ oontuAuth:'email' } }));
      eq(authFlow.step, 'email');
      window.dispatchEvent(new PopStateEvent('popstate', { state:{ oontuAuth:'code' } }));
      eq(authFlow.step, 'code', 'forward to a pending code is allowed');
      window.dispatchEvent(new PopStateEvent('popstate', { state:{ oontuAuth:'create' } }));
      eq(authFlow.step, 'email', 'cannot jump to create unverified');
    });

    await test('16 Live mode without a configured API refuses to run', async function(){
      eq(authResolveAdapter(authResolveConfig({ mode:'live' })), null);
      eq(authResolveAdapter(authResolveConfig({ mode:'live', apiBase:'http://insecure.example' })), null);
      assert(typeof authResolveAdapter(authResolveConfig({ mode:'live', apiBase:'https://api.example.com' })).passwordSignIn==='function');
      authFlow.step = 'config'; renderOnboardingScreen();
      assert(/isn’t available/.test(screenText()));
    });

    await test('17 Return destinations and redirects are validated', async function(){
      eq(authValidReturnTo('jobs'), 'jobs');
      eq(authValidReturnTo('https://evil.example'), '');
      eq(authValidReturnTo('//evil.example'), '');
      eq(authValidReturnTo('admin-dashboard'), '');
      eq(authSafeRedirect('javascript:alert(1)'), '');
      eq(authSafeRedirect('http://evil.example/'), '');
      eq(authSafeRedirect('https://idp.example/authorize'), 'https://idp.example/authorize');
    });

    await test('18 Code requests look the same for known and unknown emails', async function(){
      const a = await authApi.sendCode({ email:'alex@northstar.example' });
      const b = await authApi.sendCode({ email:'nobody@nowhere.example' });
      eq(JSON.stringify(a), JSON.stringify(b));
    });

    await test('19 Codes never reach the URL, storage, or the screen outside the prototype inbox', async function(){
      await enterEmail('alex@northstar.example');
      const code = authApi._latestEmail('alex@northstar.example').code;
      assert(window.location.href.indexOf(code)<0, 'url');
      let stored = '';
      try { for(let i=0;i<localStorage.length;i++) stored += localStorage.getItem(localStorage.key(i)); } catch(e){}
      try { for(let i=0;i<sessionStorage.length;i++) stored += sessionStorage.getItem(sessionStorage.key(i)); } catch(e){}
      assert(stored.indexOf(code)<0, 'storage');
      assert(document.querySelector('.au-shell').textContent.indexOf(code)<0, 'screen');
    });

    await test('20 Continue checks for single sign-on first; other emails get a code', async function(){
      await enterEmail('lee@acme.example');
      eq(authFlow.step, 'sso-sim', 'SSO organisation is taken to its provider');
      eq(authApi._outboxCount('lee@acme.example'), 0, 'no email code is sent for an SSO email');
      reset();
      await enterEmail('alex@northstar.example');
      assert(authFlow.codePending && authFlow.step==='email', 'non-SSO email gets a code on the same screen');
    });

    await test('21 Google and Microsoft sign-in: existing user, new user, cancel', async function(){
      const btns = Array.from(document.querySelectorAll('.au-social__btn'));
      eq(btns.map(function(b){ return b.getAttribute('aria-label'); }).join(), 'Continue with Google,Continue with Microsoft', 'both round buttons shown');
      assert(btns.every(function(b){ return !b.textContent.trim() && b.getAttribute('title'); }), 'icon only, named by aria-label and title');
      authOAuth('google'); await idle();
      eq(authFlow.step, 'oauth-sim'); assert(/Google/.test(screenText()));
      authOAuthSim('approve'); await idle();
      assert(appVisible()); eq(state.role, 'admin');
      reset(); SIGNUP_LEADS.length = 0;   // an unfinished sign-up for this email would (rightly) be resumed instead
      authOAuth('microsoft'); await idle(); assert(/Microsoft/.test(screenText())); authOAuthSim('new'); await idle();
      eq(authFlow.step, 'su-type', 'a new person starts sign-up at the first question'); eq(authFlow.intent, 'signup'); assert(!appVisible());
      suTypeChoose('Staffing agency'); await sleep(330); await idle(); await move(); await idle();
      eq(authFlow.step, 'su-size', 'then team size');
      await answerSize('1\u20135'); await answerLocation('', 'Pune');
      eq(authFlow.step, 'su-mobile', 'the provider gave the name and email, so the mobile number is next');
      await answerMobile('98250 41207'); await intoProduct();
      eq(state.role, 'admin', 'then the product');
      reset();
      authOAuth('google'); await idle(); authOAuthSim('cancel'); await idle();
      eq(authFlow.step, 'email'); assert(/cancelled/i.test(authFlow.notice)); assert(!appVisible());
    });

    await test('22 Social buttons only appear for providers that are configured', async function(){
      eq(authResolveConfig({ mode:'live', apiBase:'https://x.example' }).oauth.length, 0);
      eq(authResolveConfig({ mode:'live', oauth:['google','facebook'] }).oauth.join(), 'google');
      eq(authResolveConfig({ mode:'prototype' }).oauth.join(), 'google,microsoft');
      eq(authResolveConfig({ mode:'live', oauth:['microsoft','linkedin'] }).oauth.join(), 'microsoft', 'LinkedIn is no longer offered');
      authSwitchIntent('signup'); suWiz.type = 'Staffing agency'; suWiz.done.type = true; authGo('su-name');
      eq(document.querySelectorAll('.qz-alt .qz-textbtn').length, 2, 'shown on sign-up too');
      AUTH_CONFIG.oauth = ['google'];
      try { renderOnboardingScreen(); eq(document.querySelectorAll('.qz-alt .qz-textbtn').length, 1, 'only the configured ones'); }
      finally { AUTH_CONFIG.oauth = ['google','microsoft']; }
      eq((await authApi.oauthStart({ provider:'facebook' })).error, 'oauth_unavailable');
    });

    /* ---- the page itself ---- */
    await test('23 The sign-in page is the familiar one: email, password, forgot, remember me, no passkey', async function(){
      eq(document.querySelector('.au-h1').textContent, 'Welcome');
      assert(document.getElementById('auth-email') && document.getElementById('auth-password'), 'email and password on one form');
      assert(document.getElementById('auth-email').closest('form')===document.getElementById('auth-password').closest('form'), 'same form, so password managers fill both');
      assert(/Create an account/.test(screenText()), 'create account link');
      assert(/Forgot password\?/.test(screenText()), 'forgot link on the first screen');
      assert(!/Trouble signing in/.test(screenText()) && /Trouble signing in/.test(document.querySelector('.au-main__foot').textContent), 'help link sits in the footer, not the form');
      assert(document.querySelector('.au-label-row button').textContent==='Forgot password?', 'forgot link beside the password label');
      assert(document.querySelector('.au-check input[type=checkbox]'), 'remember me');
      eq(document.querySelector('.au-btn--primary').textContent, 'Sign in');
      assert(/Email me a code/.test(document.querySelector('.au-check-row').textContent), 'code alternative sits beside Remember me');
      assert(!/passkey/i.test(document.querySelector('.au-shell').textContent), 'no passkey anywhere on the page');
      assert(/English \(UK\)/.test(document.querySelector('.au-main__foot').textContent), 'language footer');
    });

    await test('23b The side panel keeps the approved copy without a long dash', async function(){
      eq(document.querySelector('.au-aside__title').textContent, 'From hiring activity to hiring outcomes.');
      eq(document.querySelector('.au-aside__lede').textContent, 'Oontu brings your jobs, talent, teams and hiring decisions together, so you can move faster, with confidence.');
      eq(document.querySelector('.au-aside__foot').textContent.trim(), 'Recruitment, in sync.');
      assert(document.querySelector('.au-aside').textContent.indexOf('—')<0, 'no em dash');
    });

    await test('23c Each new question animates in once, and repaints do not replay it', async function(){
      const rise = function(){ return Array.from(document.querySelectorAll('.au-form-wrap [data-rise]')); };
      assert(rise().length>0 && rise().every(function(n){ return !n.classList.contains('au-seen'); }), 'first paint animates');
      renderOnboardingScreen();
      assert(rise().every(function(n){ return n.classList.contains('au-seen'); }), 'a repaint does not replay it');
      authFlow.email = 'alex@northstar.example'; authSetMethod('code'); await idle(); authSubmitEmail(true); await idle();
      const code = document.getElementById('auth-code').closest('[data-rise]');
      assert(code && !code.classList.contains('au-seen'), 'the new question animates');
      assert(document.querySelector('.au-h1').classList.contains('au-seen'), 'the heading stays still');
      authChangeEmail();
      assert(!document.getElementById('auth-email').closest('[data-rise]').classList.contains('au-seen'), 'going back animates the email question again');
    });

    await test('24 A one-time code replaces the password field in place, with resend and expiry', async function(){
      await toPasswordQuestion('alex@northstar.example');
      authSetMethod('code'); await idle();
      assert(!document.getElementById('auth-password'), 'password field is gone');
      eq(authFlow.step, 'email', 'still the same screen');
      eq(document.querySelector('.au-btn--primary').textContent, 'Send code');
      eq(authApi._outboxCount('alex@northstar.example'), 0, 'nothing sent until they ask');
      authSubmitEmail(true); await idle();
      assert(document.getElementById('auth-code'), 'code field appeared');
      assert(!document.getElementById('auth-email') && document.querySelector('.au-answer'), 'email is locked while a code is pending');
      eq(authApi._outboxCount('alex@northstar.example'), 1, 'choosing the code sent exactly one');
      assert(/expires in 10 minutes/.test(screenText()), 'expiry is stated');
      assert(document.getElementById('auth-resend'), 'resend control');
      assert(/Use password instead/.test(screenText()), 'way back to the password');
      authSetMethod('password');
      assert(document.getElementById('auth-password') && !document.getElementById('auth-code'), 'back to the password field');
    });

    await test('25 Forgot password: reset link by email, set a new password, sign in with it', async function(){
      await toPasswordQuestion('alex@northstar.example');
      authForgot(); await idle();
      eq(authFlow.step, 'forgot'); eq(document.querySelector('.au-h1').textContent, 'Reset your password');
      eq(document.getElementById('auth-reset-email').value, 'alex@northstar.example', 'email carried over');
      authResetSend(); await idle();
      eq(document.querySelector('.au-h1').textContent, 'Check your email');
      const tok = authApi._latestReset('alex@northstar.example').token;
      authOpenReset(tok); await idle();
      eq(document.querySelector('.au-h1').textContent, 'Set a new password');
      document.getElementById('auth-reset-pw').value = 'Willow-Anchor-3318'; document.getElementById('auth-reset-confirm').value = 'Willow-Anchor-3319';
      authResetSubmit(); await idle();
      eq(authFlow.errorField, 'auth-reset-confirm', 'mismatch caught');
      document.getElementById('auth-reset-pw').value = 'Willow-Anchor-3318'; document.getElementById('auth-reset-confirm').value = 'Willow-Anchor-3318';
      authResetSubmit(); await idle();
      eq(document.querySelector('.au-h1').textContent, 'Password updated');
      eq((await authApi.resetPassword({ token:tok, password:'Other-Anchor-4410' })).error, 'reset_invalid', 'the link works once');
      authResetBackToSignIn();
      assert(document.getElementById('auth-password'), 'back on the password question for the same email');
      eq((await authApi.passwordSignIn({ email:'alex@northstar.example', password:'Willow-Anchor-3318' })).ok, true, 'new password works');
      eq((await authApi.passwordSignIn({ email:'alex@northstar.example', password:SAMPLE_PW })).error, 'invalid_credentials', 'old password no longer works');
    });

    await test('25b Reset requests do not reveal accounts; expired links are refused', async function(){
      const known = await authApi.requestPasswordReset({ email:'alex@northstar.example' });
      const unknown = await authApi.requestPasswordReset({ email:'nobody@nowhere.example' });
      eq(JSON.stringify(known), JSON.stringify(unknown), 'same reply either way');
      eq(authApi._latestReset('nobody@nowhere.example'), null, 'no email for an unknown address');
      eq((await authApi.requestPasswordReset({ email:'alex@northstar.example' })).error, 'resend_cooldown');
      const tok = authApi._latestReset('alex@northstar.example').token;
      authApi._expireReset(tok);
      authOpenReset(tok); await idle();
      eq(authFlow.fstage, 'request'); assert(/expired/.test(authFlow.error), 'explains the link expired');
    });

    await test('26 After a password sign-in, changing the password needs the current one', async function(){
      await signInWithPassword('alex@northstar.example', SAMPLE_PW);
      showView('settings');
      assert(document.getElementById('auth-pw-current'), 'current password is asked for');
      document.getElementById('auth-pw-current').value = 'wrong-current-pw';
      document.getElementById('auth-pw-new').value = 'Willow-Anchor-3318';
      authChangePassword(); await settle();
      assert(/current password isn’t right/.test(document.getElementById('auth-pw-panel').textContent), 'wrong current password refused');
      document.getElementById('auth-pw-current').value = SAMPLE_PW;
      document.getElementById('auth-pw-new').value = 'password123';
      authChangePassword(); await settle();
      assert(/too common/.test(document.getElementById('auth-pw-panel').textContent), 'common password refused');
      document.getElementById('auth-pw-current').value = SAMPLE_PW;
      document.getElementById('auth-pw-new').value = 'Willow-Anchor-3318';
      authChangePassword(); await settle();
      assert(/has been updated/.test(document.getElementById('auth-pw-panel').textContent), 'changed');
    });

    await test('29 Password rules', async function(){
      eq(authPasswordProblem('short', 'a@b.example'), 'password_short');
      eq(authPasswordProblem('x'.repeat(129), 'a@b.example'), 'password_long');
      eq(authPasswordProblem('password123', 'a@b.example'), 'password_common');
      eq(authPasswordProblem('aaaaaaaaaaaa', 'a@b.example'), 'password_common');
      eq(authPasswordProblem('my-jordan-secret-1', 'jordan@northstar.example'), 'password_email');
      eq(authPasswordProblem('Maple-Quay-5530', 'jordan@northstar.example'), '');
      eq(authPasswordProblem('a long passphrase with spaces', 'jordan@northstar.example'), '');
    });

    await test('30 "Create an account" only appears where self-registration is allowed', async function(){
      assert(/Create an account/.test(screenText()), 'shown by default');
      AUTH_CONFIG.selfRegister = false;
      try { renderOnboardingScreen(); assert(!/Create an account/.test(screenText()), 'hidden when switched off'); assert(/Trouble signing in/.test(document.querySelector('.au-main__foot').textContent)); }
      finally { AUTH_CONFIG.selfRegister = true; }
    });
  }

  window.addEventListener('load', function(){
    setTimeout(function(){
      run().catch(function(e){ results.push({ name:'Runner', pass:false, error:String(e) }); }).then(function(){
        const failed = results.filter(function(r){ return !r.pass; }).length;
        const pre = document.createElement('pre');
        pre.id = 'auth-test-results';
        pre.textContent = JSON.stringify(results);
        document.body.appendChild(pre);
        document.title = 'AUTH-TESTS '+(results.length-failed)+'/'+results.length;
      });
    }, 50);
  });
})();
