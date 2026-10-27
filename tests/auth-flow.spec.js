/* Oontu authentication flow tests.
   Run with tests/run-auth-tests.ps1, which injects this file into a temporary copy of
   recruitment-os-prototype.html and runs it in headless Chrome.

   What these prove: the screens (sign in and create workspace are the .oa-* design), the state machine
   and the adapter contract behave correctly against the prototype simulator, which applies the rules the
   real auth API must enforce. They do NOT prove server-side security - that needs the same scenarios run
   against the real API (see docs/AUTH.md, "Server test plan"). */
(function(){
  'use strict';
  const results = [];
  const SAMPLE_PW = 'Prototype#2026';
  const sleep = function(ms){ return new Promise(function(r){ setTimeout(r, ms); }); };
  async function idle(){ for(let i=0;i<400;i++){ await sleep(0); if(!authFlow.busy) break; } await sleep(0); }
  async function settle(){ await sleep(40); }
  async function waitFor(cond, ms){ for(let i=0; i<(ms||4000)/20; i++){ if(cond()) return true; await sleep(20); } return false; }
  function assert(c, m){ if(!c) throw new Error(m || 'assertion failed'); }
  function eq(a, b, m){ if(a!==b) throw new Error((m ? m+': ' : '')+'expected '+JSON.stringify(b)+', got '+JSON.stringify(a)); }
  function appVisible(){ return !document.getElementById('app').classList.contains('hidden'); }
  function authVisible(){ return !document.getElementById('onboarding').classList.contains('hidden'); }
  function screenText(){ const el = document.querySelector('.oa-legacy'); return el ? el.textContent : ''; }   // the .au-* screens: invitation, recovery, help, workspace choice
  function wrongCode(code){ return String((parseInt(code,10)+1) % 1000000).padStart(code.length,'0'); }
  const move = function(){ return sleep(230); };   // a screen leaving and the next arriving
  const q = function(s, el){ return (el || document).querySelector(s); };
  const qa = function(s, el){ return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  function setv(sel, v){ const el = q(sel); if(!el) throw new Error('missing '+sel); el.value = v; el.dispatchEvent(new Event('input', { bubbles:true })); }
  function submitForm(sel){ const f = q(sel); if(!f) throw new Error('missing '+sel); f.dispatchEvent(new Event('submit', { bubbles:true, cancelable:true })); }
  async function click(sel){ const el = q(sel); if(!el) throw new Error('missing '+sel); el.click(); await idle(); }
  const qTitle = function(){ const t = q('.qz-title'); return t ? t.textContent : ''; };   // the owner's "Set your password" (the .qz-* shell)
  const qText = function(){ const el = q('.qz-main'); return el ? el.textContent : ''; };
  const heading = function(){ const h = q('#oa-h'); return h ? h.textContent : ''; };   // the heading of an .oa-* screen
  const oaText = function(){ const b = q('#oa-body'); return b ? b.textContent : ''; };
  const oaMsg = function(){ const m = q('#oa-body .oa-msg[role]') || q('#oa-body .oa-msg'); return m ? m.textContent : ''; };
  function reset(){
    authApi._reset(); authApi._latency = 0;
    try { localStorage.removeItem(AUTH_REMEMBER_KEY); } catch(e){}
    const app = document.getElementById('app');
    app.classList.add('hidden'); app.classList.remove('flex');
    document.getElementById('onboarding').classList.remove('hidden');
    state.role = 'recruiter'; obMode = 'signup'; obScreenIndex = 0;
    authAppSession = { method:'', email:'' };
    authFlow = authInitialState(); authFocusNext = null; OA.resetSignIn(); OA.resetSignUp();
    suWiz = suWizInitial(); signupActiveLeadId = null; authSignupPwDraft = '';
    wsSheet = null; wsSheetRender(); wsSetup = null; WS_SETUPS = {}; qzMoving = false; qzEnter = ''; qzShakeNext = false; suProgShown = 0;
    qzReduced = function(){ return true; };   // the shortest motion, so the tests run quickly
    ob.companyName = ''; ob.website = ''; ob.linkedin = '';
    EXISTING_WORKSPACES = EXISTING_WORKSPACES.filter(function(w){ return w.sample; });   // workspaces claimed by earlier tests
    renderOnboardingScreen();
  }
  /* ---- sign in ---- */
  async function openApp(){ if(q('[data-act=si-enter]')){ await click('[data-act=si-enter]'); await settle(); } }   // the "You're in" screen
  async function enterEmail(email){ if(authFlow.step!=='email') authGo('email'); setv('#si-email', email); submitForm('form[data-form=si-email]'); await idle(); }
  async function enterCode(code){ setv('.oa-otp__input', code); await idle(); await settle(); }
  async function signInWithCode(email){
    await enterEmail(email);
    assert(authFlow.codePending, 'a code was sent');
    await enterCode(authApi._latestEmail(email).code);
    await openApp();
  }
  async function toPasswordQuestion(email){
    authFlow.email = email; if(authFlow.step!=='email' || !q('[data-act=si-password]')) { authGo('email'); }
    await click('[data-act=si-password]');
    assert(q('#si-pw'), 'the password field is on the same form as the email');
  }
  async function signInWithPassword(email, password, remember){
    await toPasswordQuestion(email);
    q('input[name=remember]').checked = !!remember;
    setv('#si-pw', password);
    submitForm('form[data-form=si-password]'); await idle();
    await openApp();
  }
  async function apiSignIn(email){
    await authApi.sendCode({ email:email });
    return authApi.verifyCode({ email:email, code:authApi._latestEmail(email).code });
  }
  /* ---- create workspace ---- */
  const suTitle = heading;
  const suProgress = function(){ const l = q('.oa-progress__label'); return l ? l.textContent : ''; };
  async function suText(v){
    const f = q('form[data-form=su-text]'); assert(f, 'a text question is showing');
    const inp = q('input.oa-input', f); inp.value = v; inp.dispatchEvent(new Event('input', { bubbles:true }));
    submitForm('form[data-form=su-text]'); await idle(); await sleep(10);
  }
  async function suPick(value){ const b = q('[data-act=su-pick][data-value="'+value+'"]'); assert(b, 'no choice '+value); b.click(); await sleep(340); await idle(); }
  async function suSkip(){ click('[data-act=su-skip]'); await sleep(10); await idle(); }
  /* Answers the questions up to (not including) `stop`. type: 'agency' | 'corporate'. */
  async function signUpTo(stop, type, o){
    o = Object.assign({ name:'Dana', org:type==='corporate' ? 'Startup Corp' : 'Startup Talent', size:type==='corporate' ? '51–200' : '6–20', place:'IN', email:'dana@startup.example', mobile:'98250 41207' }, o || {});
    if(authFlow.step!=='signup') authSwitchIntent('signup');
    await sleep(10);
    const order = ['name','type','org','size', type==='corporate' ? 'partners' : 'focus','place','email','mobile'];
    for(let i=0;i<order.length;i++){
      const k = order[i]; if(k===stop) return;
      if(k==='name') await suText(o.name); else if(k==='type') await suPick(type); else if(k==='org') await suText(o.org);
      else if(k==='size') await suPick(o.size); else if(k==='focus' || k==='partners') await suSkip(); else if(k==='place') await suPick(o.place);
      else if(k==='email') await suText(o.email); else if(k==='mobile') await suText(o.mobile);
    }
  }
  /* The whole sign-up with a real code, into the product. type: 'Staffing agency' | 'Corporate'. */
  async function signUpAll(type, name, email, mobile, pw, size, org){
    const corp = type==='Corporate';
    email = email || 'dana@startup.example';
    const o = { name:(name || 'Dana Lee').split(' ')[0], email:email, mobile:mobile || '98250 41207' };
    if(size) o.size = size; if(org) o.org = org;
    await signUpTo('code', corp ? 'corporate' : 'agency', o);
    assert(q('.oa-otp__input'), 'the code question');
    await enterCode(authApi._latestEmail(email).code);
    assert(await waitFor(function(){ return !!q('[data-act=su-enter]'); }, 3000), 'the workspace is ready');
    await click('[data-act=su-enter]'); await settle();
    assert(appVisible(), 'opens the product');
  }
  /* An account made through the API's own sign-up, which still starts with an unverified email (the product shows the banner and locks). */
  async function signUpUnverified(email, name, type, size){
    type = type || 'Staffing agency';
    const r = await authApi.signUp({ name:name || 'Dana Lee', email:email, mobileCode:'+91', mobile:'9825041207', password:'Harbor-Lights-42', type:type });
    assert(r.ok, 'API sign-up');
    const done = await authApi.completeSetup(); assert(done.ok, 'setup complete');
    await authApi.sendVerificationEmail();
    suApplySetup({ type:type, team:[], teamSkipped:true });
    wsSetupStart(type, email, null, size || '6–20', { country:'IN', city:'Mumbai' });
    verifyNotice = { email:email, read:false, done:false }; verifyBannerResendAt = Date.now() + 30*1000;
    authEnter(done, 'onboarded'); await idle(); await settle();
  }
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
  function customRoleId(name){ const r = CUSTOM_ROLES.find(function(x){ return x.name===name; }); return r ? r.id : ''; }
  async function test(name, fn){
    reset();
    try { await fn(); results.push({ name:name, pass:true }); }
    catch(e){ results.push({ name:name, pass:false, error:String(e && e.message || e) }); }
  }

  async function run(){
    if(typeof authApi==='undefined' || !authApi || !authApi._reset || typeof OA==='undefined'){
      results.push({ name:'Page loads in prototype mode', pass:false, error:'authApi simulator or OA not available - did the page script fail?' });
      return;
    }

    /* ================= SIGN IN: email first, then a code (the default), a password, or company SSO ================= */
    await test('01 Existing user signs in with work email and password', async function(){
      await signInWithPassword('alex@northstar.example', SAMPLE_PW);
      assert(appVisible(), 'app should open');
      eq(state.role, 'admin', 'role view');
      eq(ROLE_META.admin.name, 'Alex Morgan', 'signed-in name');
      eq(authAppSession.method, 'password');
    });

    await test('01b Existing user signs in with a one-time code: email, six digits, "You’re in", Open my day', async function(){
      await enterEmail('alex@northstar.example');
      eq(heading(), 'Check your inbox.'); assert(/a•••@northstar\.example/.test(oaText()), 'the address is masked');
      eq(qa('.oa-otp__box').length, 6, 'six boxes');
      await enterCode(authApi._latestEmail('alex@northstar.example').code);
      eq(heading(), 'You’re in.', 'the tidy-up screen');
      assert(q('.oa-stage').classList.contains('is-done'), 'the scene tidies up');
      assert(!appVisible(), 'not until Open my day');
      await click('[data-act=si-enter]'); await settle();
      assert(appVisible()); eq(state.role, 'admin'); eq(authAppSession.method, 'email_code');
    });

    await test('04a Wrong code shows an error, clears the boxes and keeps the code step', async function(){
      await enterEmail('alex@northstar.example');
      await enterCode(wrongCode(authApi._latestEmail('alex@northstar.example').code));
      eq(heading(), 'Check your inbox.'); assert(authFlow.codePending);
      assert(/didn’t work/.test(oaMsg()), 'message');
      eq(q('.oa-otp__input').getAttribute('aria-invalid'), 'true'); eq(q('.oa-otp__input').value, '', 'boxes cleared');
      assert(q('.oa-otp').classList.contains('is-error'), 'red boxes');
      assert(!appVisible(), 'must not sign in');
    });

    await test('04b Expired code is rejected with a reason', async function(){
      await enterEmail('alex@northstar.example');
      const code = authApi._latestEmail('alex@northstar.example').code;
      authApi._expireCode('alex@northstar.example');
      await enterCode(code);
      assert(/expired/i.test(oaMsg()), 'expired message: '+oaMsg());
      assert(!appVisible());
    });

    await test('04f Sending a new code replaces the earlier one, after the wait', async function(){
      await enterEmail('alex@northstar.example');
      const firstCode = authApi._latestEmail('alex@northstar.example').code;
      const btn = q('[data-resend]');
      assert(btn.disabled && /^New code in 0:\d\d$/.test(btn.textContent), 'counting down: '+btn.textContent);
      authApi._advance(31000); authFlow.resendAt = 0;
      btn.disabled = false; btn.click(); await idle();
      assert(/New code sent/.test(oaMsg()), 'message');
      const second = authApi._latestEmail('alex@northstar.example').code;
      if(firstCode!==second) eq((await authApi.verifyCode({ email:'alex@northstar.example', code:firstCode })).ok, false, 'old code');
    });

    await test('04g Invalid email is caught before any request', async function(){
      await enterEmail('not-an-email');
      eq(heading(), 'Let’s get you in.'); assert(/Enter a valid work email/.test(oaMsg()), oaMsg());
      eq(q('#si-email').getAttribute('aria-invalid'), 'true');
      eq(authApi._outboxCount('not-an-email'), 0);
    });

    await test('05a A wrong password shows one generic message and does not sign in', async function(){
      await signInWithPassword('alex@northstar.example', 'not-the-password');
      eq(oaMsg(), 'Incorrect email or password.');
      eq(q('#si-pw').value, '', 'the field is cleared'); eq(q('#si-pw').getAttribute('aria-invalid'), 'true');
      assert(!appVisible());
    });

    await test('05d The password stays out of flow state, the URL and storage', async function(){
      const pw = 'Zebra-Lantern-9921';
      await toPasswordQuestion('alex@northstar.example'); q('input[name=remember]').checked = true; setv('#si-pw', pw);
      assert(JSON.stringify(authFlow).indexOf(pw)<0, 'flow state while typing');
      submitForm('form[data-form=si-password]'); await idle(); await openApp();
      assert(JSON.stringify(authFlow).indexOf(pw)<0, 'flow state');
      assert(window.location.href.indexOf(pw)<0, 'url');
      let stored = '';
      try { for(let i=0;i<localStorage.length;i++) stored += localStorage.getItem(localStorage.key(i)); } catch(e){}
      assert(stored.indexOf(pw)<0, 'storage');
    });

    await test('05e Keep me signed in remembers the email: "Welcome back", and unticking forgets it', async function(){
      await signInWithPassword('alex@northstar.example', SAMPLE_PW, true);
      eq(localStorage.getItem(AUTH_REMEMBER_KEY), 'alex@northstar.example');
      performLogout(); await idle();
      eq(authFlow.email, 'alex@northstar.example', 'email pre-filled after sign-out');
      eq(heading(), 'Welcome back.', 'the returning state'); assert(/Continue as Alex/.test(oaText()), 'with the account to continue as'); assert(/alex@northstar\.example/.test(oaText()));
      await click('[data-act=si-remembered-pw]');
      assert(q('input[name=remember]').checked, 'box ticked');
      assert(q('#si-pw-email').value==='alex@northstar.example', 'email filled');
      q('input[name=remember]').checked = false; setv('#si-pw', SAMPLE_PW);
      submitForm('form[data-form=si-password]'); await idle(); await openApp();
      assert(appVisible()); eq(localStorage.getItem(AUTH_REMEMBER_KEY), null, 'forgotten when unticked');
    });

    await test('05e2 "Welcome back" continues by emailing a code; "Not Alex?" starts over', async function(){
      localStorage.setItem(AUTH_REMEMBER_KEY, 'alex@northstar.example'); authFlow.email = 'alex@northstar.example'; OA.resetSignIn(); renderOnboardingScreen();
      eq(heading(), 'Welcome back.');
      await click('[data-act=si-continue]');
      eq(heading(), 'Check your inbox.'); eq(authApi._outboxCount('alex@northstar.example'), 1);
      await click('[data-act=si-change]');
      eq(heading(), 'Let’s get you in.', 'Back from the code goes to the email question'); eq(q('#si-email').value, 'alex@northstar.example');
      OA.resetSignIn(); renderOnboardingScreen(); await click('[data-act=si-other]');
      eq(heading(), 'Let’s get you in.'); eq(q('#si-email').value, '', 'a different person starts empty');
    });

    await test('05f The show/hide control reveals and re-hides the password', async function(){
      await toPasswordQuestion('alex@northstar.example');
      const input = q('#si-pw'), btn = q('[data-act=si-toggle-pw]');
      eq(input.type, 'password');
      btn.click(); eq(input.type, 'text'); eq(btn.getAttribute('aria-label'), 'Hide password'); eq(btn.textContent, 'Hide');
      btn.click(); eq(input.type, 'password'); eq(btn.getAttribute('aria-label'), 'Show password');
    });

    await test('05g Email and password are both required before any request', async function(){
      await toPasswordQuestion('');
      setv('#si-pw', 'x'); submitForm('form[data-form=si-password]'); await idle();
      eq(q('#si-pw-email').getAttribute('aria-invalid'), 'true'); assert(/Add your work email first|valid work email/.test(oaMsg()), oaMsg());
      setv('#si-pw-email', 'alex@northstar.example'); setv('#si-pw', ''); submitForm('form[data-form=si-password]'); await idle();
      eq(oaMsg(), 'Enter your password.'); eq(q('#si-pw').getAttribute('aria-invalid'), 'true');
    });

    /* ---- single sign-on and social ---- */
    await test('06a An SSO company: the SSO screen, Continue, the provider, then in', async function(){
      await enterEmail('lee@acme.example');
      eq(heading(), 'Acme Corp signs you in.'); assert(/Continue to Acme Corp/.test(oaText()));
      eq(authApi._outboxCount('lee@acme.example'), 0, 'no email code is sent for an SSO email');
      assert(!q('#si-pw'), 'no password question');
      await click('[data-act=si-sso]');
      eq(authFlow.step, 'sso-sim');
      authSsoSim('approve'); await idle(); await openApp();
      assert(appVisible()); eq(state.role, 'hm');
    });

    await test('06b SSO cancel and provider failure return to sign-in with the reason', async function(){
      await enterEmail('lee@acme.example'); await click('[data-act=si-sso]');
      authSsoSim('cancel'); await idle();
      eq(authFlow.step, 'email'); eq(heading(), 'Let’s get you in.'); assert(/cancelled/i.test(oaMsg()), oaMsg());
      await enterEmail('lee@acme.example'); await click('[data-act=si-sso]'); authSsoSim('fail'); await idle();
      assert(/didn’t complete/i.test(oaMsg()), oaMsg());
      assert(!appVisible());
    });

    await test('06c An email without SSO gets a code; sso: false never asks about SSO', async function(){
      await enterEmail('alex@northstar.example');
      eq(heading(), 'Check your inbox.');
      reset();
      AUTH_CONFIG.sso = false;
      try { await enterEmail('lee@acme.example'); eq(heading(), 'Check your inbox.', 'a code, because the SSO check is off'); }
      finally { AUTH_CONFIG.sso = true; }
    });

    await test('06d First SSO sign-in gets the organisation default role, not a chosen one', async function(){
      await enterEmail('newhire@acme.example'); await click('[data-act=si-sso]'); authSsoSim('approve'); await idle(); await openApp();
      eq(state.role, 'recruiter');
    });

    await test('06e An SSO organisation is sent to its provider before any password is checked', async function(){
      await toPasswordQuestion('lee@acme.example'); setv('#si-pw', SAMPLE_PW);
      submitForm('form[data-form=si-password]'); await idle();
      eq(heading(), 'Acme Corp signs you in.'); assert(!appVisible(), 'the password is not used');
    });

    await test('13 Double submission sends one request and disables the button', async function(){
      authApi._latency = 30;
      setv('#si-email', 'once@test.example');
      submitForm('form[data-form=si-email]'); submitForm('form[data-form=si-email]'); submitForm('form[data-form=si-email]');
      assert(q('form[data-form=si-email] button[type=submit]').disabled, 'busy state');
      await idle(); await sleep(60);
      eq(authApi._outboxCount('once@test.example'), 1);
    });

    await test('21 Google and Microsoft sign-in: existing user, new user, cancel', async function(){
      const btns = qa('[data-act=si-oauth]');
      eq(btns.map(function(b){ return b.textContent; }).join(), 'Google Workspace,Microsoft 365', 'both provider buttons shown');
      await click('[data-act=si-oauth][data-provider=google]');
      eq(authFlow.step, 'oauth-sim'); assert(/Google/.test(screenText()));
      authOAuthSim('approve'); await idle(); await openApp();
      assert(appVisible()); eq(state.role, 'admin');
      reset();
      await click('[data-act=si-oauth][data-provider=microsoft]'); assert(/Microsoft/.test(screenText())); authOAuthSim('new'); await idle();
      eq(authFlow.step, 'signup', 'a new person goes to create workspace'); eq(authFlow.intent, 'signup'); assert(!appVisible());
      eq(suTitle(), 'What should I call you?'); eq(q('#su-name').value, 'Taylor', 'the provider gave the first name');
      assert(/Email verified/.test(q('.oa-aside').textContent), 'and the email is already verified');
      await signUpTo('place', 'agency', { name:'Taylor' });
      eq(suTitle(), 'Where’s your team based?');
      await suPick('IN');
      eq(suTitle(), 'Your mobile number?', 'no email or code question: the provider proved the email');
      await suText('98250 41207');
      assert(await waitFor(function(){ return !!q('[data-act=su-enter]'); }, 3000), 'workspace created');
      await click('[data-act=su-enter]'); await settle();
      eq(state.role, 'admin', 'then the product');
      assert(!emailVerifyLocked() && !q('#verify-banner-root .vb'), 'no verification banner');
      reset();
      await click('[data-act=si-oauth][data-provider=google]'); authOAuthSim('cancel'); await idle();
      eq(authFlow.step, 'email'); assert(/cancelled/i.test(oaMsg()), oaMsg()); assert(!appVisible());
    });

    await test('22 Provider buttons only appear for providers that are configured', async function(){
      eq(authResolveConfig({ mode:'live', apiBase:'https://x.example' }).oauth.length, 0);
      eq(authResolveConfig({ mode:'live', oauth:['google','facebook'] }).oauth.join(), 'google');
      eq(authResolveConfig({ mode:'prototype' }).oauth.join(), 'google,microsoft');
      eq(authResolveConfig({ mode:'live', oauth:['microsoft','linkedin'] }).oauth.join(), 'microsoft', 'LinkedIn is no longer offered');
      AUTH_CONFIG.oauth = ['google'];
      try { OA.resetSignIn(); renderOnboardingScreen(); eq(qa('[data-act=si-oauth]').length, 1, 'only the configured one'); eq(q('[data-act=si-oauth]').textContent, 'Google Workspace'); }
      finally { AUTH_CONFIG.oauth = ['google','microsoft']; }
      AUTH_CONFIG.oauth = [];
      try { renderOnboardingScreen(); eq(qa('[data-act=si-oauth]').length, 0, 'none when none are listed'); }
      finally { AUTH_CONFIG.oauth = ['google','microsoft']; }
      eq((await authApi.oauthStart({ provider:'facebook' })).error, 'oauth_unavailable');
    });

    /* ---- the page itself ---- */
    await test('23 The sign-in page: email first, code by default, password and Google/Microsoft beside it, no passkey', async function(){
      eq(heading(), 'Let’s get you in.'); eq(q('.oa-sub').textContent, 'Your work email is all we need.');
      assert(q('#si-email') && !q('#si-pw'), 'email only on the first screen');
      assert(/We’ll email you a 6-digit code\./.test(oaMsg()), 'a code is the default');
      assert(q('[data-act=si-password]'), 'sign in with password'); assert(/Create a workspace/.test(q('.oa-top').textContent), 'create workspace link');
      assert(!/passkey/i.test(q('.oa-root').textContent), 'no passkey anywhere on the page');
      assert(/Help/.test(q('.oa-footer').textContent) && /Privacy/.test(q('.oa-footer').textContent) && /Terms/.test(q('.oa-footer').textContent), 'footer links');
      q('.oa-footer [data-act=help]').click(); eq(authFlow.step, 'help', 'Help opens Trouble signing in');
      await toPasswordQuestion('alex@northstar.example');
      assert(q('#si-pw-email').closest('form')===q('#si-pw').closest('form'), 'same form, so password managers fill both');
      eq(q('[data-act=si-forgot]').textContent, 'Forgot it?'); assert(q('input[name=remember]'), 'keep me signed in'); assert(/Email me a code instead/.test(oaText()));
    });

    await test('23b The experience panel keeps the approved copy and the scene tidies up once signed in', async function(){
      eq(q('.oa-aside__title').textContent, 'Hire in flow.');
      eq(q('.oa-aside__sub').textContent, 'Every candidate, client and decision, moving as one.');
      eq(qa('.oa-obj').length, 5, 'box, candidate, interview, Kairo, offer'); assert(!q('.oa-stage').classList.contains('is-done'));
      const rm = Array.from(document.styleSheets).reduce(function(all, s){ try { return all.concat(Array.from(s.cssRules)); } catch(e){ return all; } }, []).filter(function(r){ return r.media && /prefers-reduced-motion: reduce/.test(r.media.mediaText) && /\.oa-root/.test(r.cssText); });
      assert(rm.length, 'reduced motion switches the scene and the typing dots off');
    });

    await test('24 A one-time code: six boxes, one real field, paste, a new-code wait, a way to the password', async function(){
      await enterEmail('alex@northstar.example');
      eq(qa('.oa-otp__input').length, 1, 'one real input behind six boxes');
      eq(q('.oa-otp__input').getAttribute('autocomplete'), 'one-time-code'); eq(q('.oa-otp__input').getAttribute('inputmode'), 'numeric');
      assert(q('[data-resend]') && q('.oa-mailrow a'), 'resend control and mailbox shortcuts');
      eq(authApi._outboxCount('alex@northstar.example'), 1, 'choosing the code sent exactly one');
      setv('.oa-otp__input', '12'); eq(qa('.oa-otp__box').filter(function(b){ return b.classList.contains('is-filled'); }).length, 2, 'boxes fill as typed');
      setv('.oa-otp__input', 'ab12'); eq(q('.oa-otp__input').value, '12', 'digits only');
      await click('[data-act=si-password]');
      assert(q('#si-pw') && !q('.oa-otp'), 'the password question; the email is kept'); eq(q('#si-pw-email').value, 'alex@northstar.example');
      await click('[data-act=si-send-code]');
      eq(heading(), 'Check your inbox.', 'and back to the code');
    });

    await test('30 "Create a workspace" only appears where self-registration is allowed', async function(){
      assert(/Create a workspace/.test(q('.oa-top').textContent), 'shown by default');
      AUTH_CONFIG.selfRegister = false;
      try {
        OA.resetSignIn(); renderOnboardingScreen(); assert(!/Create a workspace/.test(q('.oa-top').textContent), 'hidden when switched off');
        authSwitchIntent('signup'); eq(authFlow.step, 'email', 'and the sign-up route is closed');
        eq(authSafeStep('signup'), 'email');
        authFlow.step = 'signup'; authFlow.intent = 'signin';
      }
      finally { AUTH_CONFIG.selfRegister = true; }
      eq(authSafeStep('signup'), 'signup');
    });

    await test('11 A member of two workspaces chooses one and lands in it', async function(){
      await signInWithPassword('sam@harbor.example', SAMPLE_PW);
      eq(authFlow.step, 'workspaces');
      const buttons = document.querySelectorAll('.au-ws');
      eq(buttons.length, 2);
      buttons[1].click(); await idle(); await openApp();
      assert(appVisible()); eq(state.role, 'manager');
      eq(ORG_STRUCTURE.profile.brandName, 'Harbor Recruiting');
    });

    await test('12 Sign-out and idle expiry end the session', async function(){
      await signInWithPassword('alex@northstar.example', SAMPLE_PW);
      assert(appVisible());
      performLogout(); await idle();
      assert(authVisible() && !appVisible(), 'back on sign-in');
      eq(authFlow.step, 'email'); assert(q('#si-email') && !q('#si-pw') || heading()==='Welcome back.', 'sign-in starts again on the email question');
      eq((await authApi.session()).authenticated, false, 'server session ended');
      await apiSignIn('alex@northstar.example');
      authApi._idleOutSession();
      eq((await authApi.session()).authenticated, false, 'idle expiry');
      eq((await authApi.selectWorkspace({ workspaceId:'ws_northstar' })).error, 'unauthenticated');
    });

    await test('14 Every auth screen has one heading, labelled fields and named buttons', async function(){
      function check(label, root){
        const shell = root || q('.oa-root, .wz');
        eq(qa(root ? 'h2' : 'h1', shell).length, 1, label+' heading count');   // a sheet inside the app is titled with an h2
        qa('input', shell).forEach(function(i){
          assert((i.id && q('label[for="'+i.id+'"]', shell)) || i.closest('label'), label+': no label for '+(i.id||i.type));
        });
        qa('button', shell).forEach(function(b){ assert((b.textContent||'').trim() || b.getAttribute('aria-label'), label+': unnamed button'); });
      }
      check('sign-in email');
      await toPasswordQuestion('alex@northstar.example'); check('sign-in password');
      reset(); await enterEmail('alex@northstar.example'); check('sign-in code');
      reset(); await enterEmail('lee@acme.example'); check('sign-in SSO');
      reset(); await signInWithPassword('alex@northstar.example', SAMPLE_PW); performLogout(); await idle();
      reset(); authSwitchIntent('signin'); await toPasswordQuestion('alex@northstar.example'); setv('#si-pw', SAMPLE_PW); submitForm('form[data-form=si-password]'); await idle(); check('signed in');
      reset(); authFlow.email = 'alex@northstar.example'; await toPasswordQuestion('alex@northstar.example'); await click('[data-act=si-forgot]'); check('forgot password');
      document.getElementById('auth-reset-email').value = 'alex@northstar.example'; authFlow.resetEmail = 'alex@northstar.example';
      authResetSend(); await idle(); check('reset link sent');
      authOpenReset(authApi._latestReset('alex@northstar.example').token); await idle(); check('set a new password');
      reset(); authSwitchIntent('signup'); check('sign-up name');
      await suText('Dana'); check('sign-up type');
      await suPick('corporate'); check('sign-up organisation');
      reset(); await signUpTo('code', 'agency'); check('sign-up code');
      await signUpUnverified('dana@startup.example'); vbChangeEmailOpen(); check('change email', q('#vb-dialog-root [role=dialog]')); vbChangeEmailClose(); wsOpenItem('agency-profile'); check('setup sheet', q('.ws-sheet')); wsCloseSheet();
      reset(); authGo('help'); check('help');
      reset(); authLoadInvite('inv-valid-3f9a2c7d'); await idle(); check('activate name');
      authFlow.name = 'Jordan Blake'; authInviteNext(); check('activate password');
      reset(); authLoadInvite('inv-existing-9c4d17b3'); await idle(); check('accept');
      reset(); authLoadInvite('inv-expired-81bd04e2'); await idle(); check('invite error');
      reset(); await enterEmail('bad');
      eq(q('#si-email-msg').getAttribute('role'), 'status'); assert(/si-email-msg/.test(q('#si-email').getAttribute('aria-describedby')||''), 'message linked to the field');
    });

    await test('15 Back/forward only restores steps the state supports', async function(){
      eq(authSafeStep('code'), 'email', 'the old code step is gone');
      eq(authSafeStep('create'), 'email');
      eq(authSafeStep('workspaces'), 'email');
      eq(authSafeStep('sso-sim'), 'email');
      eq(authSafeStep('bogus'), 'email');
      eq(authSafeStep('signup'), 'signup');
      window.dispatchEvent(new PopStateEvent('popstate', { state:{ oontuAuth:'email' } }));
      eq(authFlow.step, 'email');
      window.dispatchEvent(new PopStateEvent('popstate', { state:{ oontuAuth:'signup' } }));
      eq(authFlow.step, 'signup'); eq(suTitle(), 'What should I call you?');
      window.dispatchEvent(new PopStateEvent('popstate', { state:{ oontuAuth:'workspaces' } }));
      eq(authFlow.step, 'email', 'cannot jump to workspaces unverified');
    });

    await test('19 Codes never reach the URL, storage, or the screen outside the prototype inbox', async function(){
      await enterEmail('alex@northstar.example');
      const code = authApi._latestEmail('alex@northstar.example').code;
      assert(window.location.href.indexOf(code)<0, 'url');
      let stored = '';
      try { for(let i=0;i<localStorage.length;i++) stored += localStorage.getItem(localStorage.key(i)); } catch(e){}
      try { for(let i=0;i<sessionStorage.length;i++) stored += sessionStorage.getItem(sessionStorage.key(i)); } catch(e){}
      assert(stored.indexOf(code)<0, 'storage');
      assert(q('.oa-root').textContent.indexOf(code)<0, 'screen');
      assert(JSON.stringify(authFlow).indexOf(code)<0, 'flow state');
    });

    await test('25 Forgot password: reset link by email, set a new password, sign in with it', async function(){
      await toPasswordQuestion('alex@northstar.example');
      await click('[data-act=si-forgot]');
      eq(authFlow.step, 'forgot'); eq(q('.au-h1').textContent, 'Reset your password');
      eq(document.getElementById('auth-reset-email').value, 'alex@northstar.example', 'email carried over');
      authResetSend(); await idle();
      eq(q('.au-h1').textContent, 'Check your email');
      const tok = authApi._latestReset('alex@northstar.example').token;
      authOpenReset(tok); await idle();
      eq(q('.au-h1').textContent, 'Set a new password');
      document.getElementById('auth-reset-pw').value = 'Willow-Anchor-3318'; document.getElementById('auth-reset-confirm').value = 'Willow-Anchor-3319';
      authResetSubmit(); await idle();
      eq(authFlow.errorField, 'auth-reset-confirm', 'mismatch caught');
      document.getElementById('auth-reset-pw').value = 'Willow-Anchor-3318'; document.getElementById('auth-reset-confirm').value = 'Willow-Anchor-3318';
      authResetSubmit(); await idle();
      eq(q('.au-h1').textContent, 'Password updated');
      eq((await authApi.resetPassword({ token:tok, password:'Other-Anchor-4410' })).error, 'reset_invalid', 'the link works once');
      authResetBackToSignIn();
      eq(authFlow.step, 'email'); eq(heading(), 'Let’s get you in.', 'back on the new sign-in'); eq(q('#si-email').value, 'alex@northstar.example', 'email kept');
      eq((await authApi.passwordSignIn({ email:'alex@northstar.example', password:'Willow-Anchor-3318' })).ok, true, 'new password works');
      eq((await authApi.passwordSignIn({ email:'alex@northstar.example', password:SAMPLE_PW })).error, 'invalid_credentials', 'old password no longer works');
    });

    /* ================= CREATE WORKSPACE: nine short questions, a code, no password ================= */
    await test('02 Agency: nine questions, a code, then "You’re all set" and Home with the welcome line and the checklist', async function(){
      authSwitchIntent('signup');
      eq(authFlow.step, 'signup'); eq(location.hash, '#/sign-up'); eq(suTitle(), 'What should I call you?'); eq(suProgress(), '9 to go');
      assert(!q('.oa-iconbtn'), 'no Back on the first question');
      await suText('Dana');
      eq(suTitle(), 'How does your team hire?'); eq(qa('.oa-choice b').map(function(b){ return b.textContent; }).join('|'), 'We hire for clients|We hire for ourselves');
      await suPick('agency');
      eq(suTitle(), 'What’s your agency called?'); await suText('Startup Talent');
      eq(suTitle(), 'How many recruiters will use Oontu?'); eq(qa('.oa-chip').map(function(c){ return c.textContent; }).join('|'), 'Just me|2–5|6–20|21–50|50+');
      await suPick('21–50');
      eq(suTitle(), 'What do you place most?'); assert(qa('.oa-chip').length===8, 'eight industries');
      qa('.oa-chip')[0].click(); qa('.oa-chip')[1].click(); eq(q('[data-count]').textContent.trim(), 'Continue with 2'); await click('[data-act=su-next]');
      eq(suTitle(), 'Where’s your team based?'); await suPick('IN');
      eq(suTitle(), 'Your work email?'); eq(suProgress(), '3 to go'); await suText('dana@startup.example');
      eq(suTitle(), 'Your mobile number?'); assert(/Next, I’ll email you a code\./.test(oaText()));
      assert(/By continuing you agree to the terms and privacy notice\./.test(oaText()), 'terms and privacy');
      assert(!q('input[type=password]'), 'no password anywhere');
      eq(authApi._outboxCount('dana@startup.example'), 0, 'no code until the number is given');
      await suText('98250 41207');
      eq(suTitle(), 'Enter the code I sent.'); eq(suProgress(), 'last one'); eq(authApi._outboxCount('dana@startup.example'), 1);
      assert(!(await authApi.session()).authenticated, 'nothing is created until the code is right');
      await enterCode(authApi._latestEmail('dana@startup.example').code);
      assert(await waitFor(function(){ return !!q('[data-act=su-enter]'); }, 3000), 'the workspace is ready');
      eq(suTitle(), 'You’re all set, Dana.'); assert(/Startup Talent is live\./.test(oaText()));
      eq(qa('.oa-list li').length, 7, 'two done, five to do'); eq(qa('.oa-list li.is-done').length, 2);
      eq(qa('.oa-list li:not(.is-done) b').map(function(b){ return b.textContent; }).join('|'), 'Add your logo|Invite your recruiters|Add your first client|Open your first job|Connect email & WhatsApp');
      assert(!appVisible(), 'not until Open');
      const s = await authApi.session();
      eq(s.workspaces[0].role, 'owner', 'server-assigned role'); eq(s.user.setupPending, false, 'setup complete on the server'); eq(s.user.emailVerified, true, 'the code proved the email');
      eq((await authApi.passwordSignIn({ email:'dana@startup.example', password:'Harbor-Lights-42' })).error, 'invalid_credentials', 'no password was ever set');
      await click('[data-act=su-enter]'); await settle();
      assert(appVisible()); eq(state.role, 'admin', 'the owner'); eq(state.activeNav, 'admin-dashboard', 'Home');
      eq(document.querySelector('#main-content .o-page-head__title').textContent, 'Welcome to Oontu, Dana.', 'welcome line');
      assert(!emailVerifyLocked() && !q('#verify-banner-root .vb'), 'no verification banner: the code did it');
      eq(authApi._verifyMailCount('dana@startup.example'), 0, 'no verification link is needed');
      assert(document.getElementById('ws-card'), 'Complete your workspace card');
      eq(ORG_STRUCTURE.profile.brandName, 'Startup Talent'); eq(ORG_STRUCTURE.profile.orgType, 'Staffing agency');
      eq(ORG_STRUCTURE.profile.teamSize, '21–50', 'team size on the workspace'); eq(ORG_STRUCTURE.profile.country, 'India'); eq(ORG_STRUCTURE.profile.currency, 'INR (₹)');
      eq(wsSetup.agency.industries.join(), 'IT & tech,BFSI', 'what they place feeds the agency profile');
      eq(CUSTOM_ROLES.map(function(r){ return r.name; }).join(','), 'Owner,Recruiter Manager,Recruiter', 'starter roles for the type');
      showView('setup-hub'); assert(/Team size21–50Edit/.test(document.getElementById('ws-defaults').textContent), 'Settings > Workspace: Team size with Edit');
      wsOpenSheet('team-size'); document.getElementById('ws-size-4').click(); await saveSheet();
      eq(ORG_STRUCTURE.profile.teamSize, '200+');
      wsSessionSeq++; showView('admin-dashboard'); assert(/^Good /.test(document.querySelector('#main-content .o-page-head__title').textContent), 'the welcome line is for the first visit');
    });

    await test('02b Each question checks its answer: red field, message; nothing is created', async function(){
      await signUpTo('name', 'agency');
      await suText('   '); eq(oaMsg(), 'Just a first name will do.'); eq(q('#su-name').getAttribute('aria-invalid'), 'true'); eq(suTitle(), 'What should I call you?');
      setv('#su-name', 'Dana'); eq(q('#su-name').getAttribute('aria-invalid'), 'false', 'typing clears the red'); eq(oaMsg(), 'Press Enter to continue.');
      await signUpTo('org', 'agency'); await suText('x'); assert(/at least 2 characters/.test(oaMsg()), oaMsg());
      await suText('Startup Talent'); await suPick('6–20'); await suSkip(); await suPick('IN');
      await suText('not-an-email'); assert(/valid work email/.test(oaMsg()), 'invalid email: '+oaMsg()); eq(suTitle(), 'Your work email?');
      await suText('dana@gmail.com'); eq(suTitle(), 'Your mobile number?', 'an agency can use Gmail');
      await suText(''); eq(oaMsg(), AUTH_MESSAGES.mobile_required);
      await suText('12345 67890'); assert(/10-digit Indian/.test(oaMsg()), 'Indian number rule');
      await suText('98250 4120'); assert(/10-digit Indian/.test(oaMsg()), 'nine digits');
      assert(!(await authApi.session()).authenticated, 'nothing created');
      eq(authApi._outboxCount('dana@gmail.com'), 0, 'no code for a bad number');
      eq(authMobileProblem('+44', '7700 900123'), '', 'other countries: 6 to 15 digits');
      eq((await authApi.signUp({ name:'x', email:'x@y.example', mobileCode:'+91', mobile:'123', password:'Cedar-Harbor-77' })).error, 'mobile_invalid_in', 'the server checks too');
    });

    await test('02c Progress, the answers trail, Back and jumping to an earlier answer keep what was typed', async function(){
      await signUpTo('email', 'agency');
      eq(suProgress(), '3 to go');
      eq(qa('.oa-trail button').map(function(b){ return b.textContent; }).join('|'), 'Dana|Agency|Startup Talent|6–20|India');
      eq(q('[data-ws-name]').textContent, 'Startup Talent', 'the preview builds as you answer'); eq(q('[data-ws-url]').textContent, 'startup-talent.oontu.app');
      assert(/Staffing agency/.test(q('[data-ws-row=type]').textContent) && /6–20 recruiters/.test(q('[data-ws-row=team]').textContent) && /India/.test(q('[data-ws-row=place]').textContent), 'type, team and place in the preview');
      q('.oa-iconbtn').click(); eq(suTitle(), 'Where’s your team based?', 'Back');
      qa('.oa-trail button').filter(function(b){ return b.textContent==='Startup Talent'; })[0].click();
      eq(suTitle(), 'What’s your agency called?'); eq(q('#su-org').value, 'Startup Talent', 'the answer is kept');
      setv('#su-org', 'Brightpath Talent'); eq(q('[data-ws-url]').textContent, 'brightpath-talent.oontu.app', 'the address follows as you type'); eq(oaMsg(), 'Your address: brightpath-talent.oontu.app');
      await suText('Brightpath Talent'); eq(suTitle(), 'How many recruiters will use Oontu?');
      assert(qa('.oa-chip').some(function(c){ return c.getAttribute('aria-checked')==='true' && c.textContent==='6–20'; }), 'the size chip is kept');
      assert(/prefers-reduced-motion: reduce/.test(Array.from(document.styleSheets).map(function(s){ try { return Array.from(s.cssRules).map(function(r){ return r.cssText; }).join(''); } catch(e){ return ''; } }).join('')), 'reduced motion');
    });

    await test('02L Where the team is based sets the phone code and the workspace defaults', async function(){
      await signUpTo('place', 'agency');
      eq(suTitle(), 'Where’s your team based?'); eq(qa('.oa-place').length, 1); eq(q('.oa-place b').textContent, 'Yes, India');
      eq(qa('.oa-chip--sm').map(function(c){ return c.textContent; }).join('|'), 'UAE|United Kingdom|United States|Singapore');
      await suPick('GB');
      await suText('dana@startup.example');
      eq(q('[data-cc]').value, '+44', '+44 on the mobile question');
      await suText('98250 4120'); assert(/10-digit mobile number for the UK/.test(oaMsg()), 'the UK number length: '+oaMsg());
      await suText('7700 900123');
      await enterCode(authApi._latestEmail('dana@startup.example').code);
      assert(await waitFor(function(){ return !!q('[data-act=su-enter]'); }, 3000)); await click('[data-act=su-enter]'); await settle();
      const p = ORG_STRUCTURE.profile;
      eq(p.country, 'United Kingdom'); eq(p.currency, 'GBP (£)'); eq(p.timezone, 'Europe/London (GMT, UTC+0)');
      eq(p.dateFormat, 'DD MMM YYYY'); eq(p.dataRegion, 'EU'); eq(p.taxIdLabel, 'VAT number');
      wsOpenItem('agency-profile');
      eq(document.getElementById('su-ws-country').value, 'GB');
      eq(document.getElementById('su-tz').value, 'Europe/London'); eq(document.getElementById('su-currency').value, 'GBP');
      eq(document.querySelector('label[for="su-gst"]').textContent, 'VAT number', 'the tax ID label for the country');
      wsCloseSheet();
      wsOpenRegion('ws-reg-currency'); eq(document.activeElement.id, 'ws-reg-currency', 'Edit opens at that field');
      wsRegionCountry('US');
      eq(document.getElementById('ws-reg-currency').value, 'USD'); eq(document.getElementById('ws-reg-date').value, 'MMM DD, YYYY', 'US dates');
      wsRegionDraft.city = 'Austin'; await saveSheet();
      eq(p.country, 'United States'); eq(p.taxIdLabel, 'EIN'); eq(p.dataRegion, 'EU', 'the data region stays: contact us to change');
      // India by default: +91 and INR
      reset(); await signUpAll('Staffing agency', 'Dana Lee', 'dana@in-default.example');
      eq(ORG_STRUCTURE.profile.currency, 'INR (₹)'); eq(ORG_STRUCTURE.profile.taxIdLabel, 'GSTIN');
      // the number code chosen on the mobile question is kept when it differs from the place
      reset(); await signUpTo('mobile', 'agency'); q('[data-cc]').value = '+971'; q('[data-cc]').dispatchEvent(new Event('change', { bubbles:true }));
      await suText('50 123 4567'); eq(authApi._outboxCount('dana@startup.example'), 1, '+971 with 9 digits is accepted');
    });

    await test('02L2 Super Admin sign-ups list: country column and filter', async function(){
      SIGNUP_LEADS.length = 0; seedSignupLeads();
      state.role = 'oontu'; const app = document.getElementById('app'); app.classList.remove('hidden'); app.classList.add('flex'); document.getElementById('onboarding').classList.add('hidden');
      suLeadFilter = 'All'; suLeadCountry = ''; showView('oontu-signups'); await idle();
      assert(Array.from(document.querySelectorAll('#oontu-signups-table th')).some(function(th){ return th.textContent==='Country'; }), 'Country column');
      const sel = document.querySelector('select[aria-label="Country"]'); assert(sel && /India/.test(sel.textContent), 'country filter');
      suLeadCountry = 'India'; refreshOontuSignups();
      assert(oontuSignupsRows().length && oontuSignupsRows().every(function(x){ return x.country==='India'; }), 'filters by country');
      suLeadCountry = '';
    });

    await test('02v Verification inside the product (an account made through the API sign-up): Resend, Change email, I’ve verified, locks, bell, sign out and back', async function(){
      await signUpUnverified('dana@startup.example', 'Dana Lee');
      assert(/^Resend in \d+s$/.test(document.getElementById('verify-banner-resend').textContent), 'a link just went, so the 30 s wait shows');
      authApi._advance(31*1000); verifyBannerResendAt = 0; verifyBannerSentUntil = 0; renderVerifyBanner();
      document.getElementById('verify-banner-resend').click(); await settle();
      eq(document.getElementById('verify-banner-resend').textContent, 'Sent'); assert(document.getElementById('verify-banner-resend').disabled);
      eq(authApi._verifyMailCount('dana@startup.example'), 2, 'a new link');
      verifyBannerSentUntil = 0; renderVerifyBanner(); assert(/^Resend in \d+s$/.test(document.getElementById('verify-banner-resend').textContent), 'then the 30 s countdown');
      await verifyBannerResend(); eq(authApi._verifyMailCount('dana@startup.example'), 2, 'not during the cooldown');
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
      wsOpenItem('agency-team'); wsSetup.team[0].email = 'asha@startup-one.example'; await saveSheet();
      wsSetup.team[0].email = 'ravi@startup-one.example'; wsOpenItem('agency-team'); wsSetup.team[0].email = 'ravi@startup-one.example'; await saveSheet();
      showView('team-members'); await idle(); await settle();
      const inv = document.querySelector('button[onclick*="tmOpenInvite("]');
      assert(inv && inv.disabled, 'invite locked');
      assert(inv.parentElement.querySelector('.vlock-resend'), 'the reason line has Resend link');
      openNotifications(); assert(!document.querySelector('#quick-actions-bar .qa-dot'), 'read'); closeNotifications();
      backToSignIn(); await signInWithPassword('dana.lee@startup.example', 'Harbor-Lights-42');
      assert(appVisible() && document.querySelector('#verify-banner-root .vb'), 'banner again after signing in');
      await verifyBannerConfirm(); await idle(); await settle();
      assert(!emailVerifyLocked());
      assert(/Email verified\. Your 2 invites have been sent\./.test(document.querySelector('.app-toasts').textContent), 'toast counts the invites');
      await sleep(260); eq(document.getElementById('verify-banner-root').innerHTML, '', 'banner faded away');
      assert(!document.querySelector('[data-vlocked], [data-vlock-reason]'), 'locks removed');
      eq(authApi._inviteMail().filter(function(m){ return /startup-one\.example$/.test(m.to); }).length, 2, 'both queued invites sent');
    });

    await test('03b An email that already has an account offers sign-in on the email question', async function(){
      await signUpTo('email', 'agency');
      await suText('alex@northstar.example');
      eq(suTitle(), 'Your work email?'); assert(/already uses this email/.test(oaMsg()), oaMsg()); assert(q('#oa-body [data-act=su-signin]'), 'Sign in instead');
      q('[data-act=su-signin]').click(); await idle();
      eq(authFlow.step, 'email'); eq(q('#si-email').value, 'alex@northstar.example', 'the email carries over');
      eq((await authApi.passwordSignIn({ email:'alex@northstar.example', password:'Harbor-Lights-42' })).error, 'invalid_credentials', 'existing password untouched');
    });

    await test('03e Corporate needs a company email on the email question; an agency accepts any', async function(){
      await signUpTo('email', 'corporate');
      eq(suTitle(), 'Your work email?');
      await suText('dana@gmail.com'); eq(oaMsg(), AUTH_MESSAGES.personal_email); eq(suTitle(), 'Your work email?');
      eq((await authApi.signUp({ name:'Dana', email:'dana@yahoo.com', mobileCode:'+91', mobile:'9825041207', password:'Harbor-Lights-42', type:'Corporate' })).error, 'personal_email', 'the server checks too');
      eq((await authApi.checkSignupEmail({ email:'dana@gmail.com', type:'Corporate' })).error, 'personal_email', 'and the email check does');
      ['gmail.com','yahoo.com','outlook.com','hotmail.com','live.com','icloud.com','rediffmail.com','proton.me','protonmail.com','aol.com','zoho.com','yandex.com','gmx.com','mail.com'].forEach(function(d){ assert(isFreeEmailDomain(d), d); });
      await suText('dana@startup.example'); eq(suTitle(), 'Your mobile number?');
    });

    await test('03g Corporate on a domain that already has a workspace: ask the owner to invite you', async function(){
      await signUpTo('email', 'corporate');
      await suText('ravi@infosys.com');
      eq(suTitle(), 'Your work email?'); assert(/Infosys already has a workspace\. Ask Anita Rao to invite you/.test(oaMsg()), oaMsg());
      assert(!authApi._outboxCount('ravi@infosys.com'), 'no code, no account');
      eq((await authApi.checkSignupEmail({ email:'ravi@infosys.com', type:'Corporate' })).error, 'domain_taken', 'the server says so too');
    });

    await test('03h Corporate on a new domain: Unverified company, corporate roles; the next person from it is refused', async function(){
      await signUpAll('Corporate', 'Dana Lee', 'dana@startup.example');
      eq(ORG_STRUCTURE.profile.orgType, 'Corporate'); eq(ORG_STRUCTURE.profile.verification, 'unverified'); eq(ORG_STRUCTURE.profile.domain, 'startup.example');
      eq(CUSTOM_ROLES.map(function(r){ return r.name; }).join(','), 'Owner,TA Head,Recruiter,Hiring Manager,Interviewer,Approver');
      const pill = document.querySelector('#org-verify-slot .org-pill');
      assert(pill && /Unverified company/.test(pill.textContent), 'pill in the header');
      assert(!filterNavForOrgType([{id:'client-management'},{id:'jobs'}]).some(function(i){ return i.id==='client-management'; }), 'corporate hides Clients');
      eq(ORG_STRUCTURE.profile.teamSize, '51–200');
      backToSignIn();
      await signUpTo('email', 'corporate', { name:'Mira' }); await suText('mira@startup.example');
      assert(/Startup Corp already has a workspace\. Ask Dana to invite you/.test(oaMsg()), 'the next person from that domain: '+oaMsg());
      reset(); await signUpAll('Corporate', 'Kiran Rao', 'kiran@bigco.example', null, null, '5,000+');
      eq(ORG_STRUCTURE.profile.teamSize, '200+');
      wsOpenItem('corp-setup'); assert(document.getElementById('ws-struct-1').checked, '200+: Several entities or countries is pre-selected'); wsCloseSheet();
      eq(roleTemplatesForOrgType('Staffing agency').map(function(r){ return r.name; }).join(','), 'Owner,Recruiter Manager,Recruiter');
      assert(roleTemplatesForOrgType('Staffing agency')[0].protected, 'owner is locked');
    });

    await test('03i Wrong sign-up code is refused with the reason; an existing account is a sign-in, not a new workspace', async function(){
      await signUpTo('code', 'agency');
      await enterCode(wrongCode(authApi._latestEmail('dana@startup.example').code));
      eq(suTitle(), 'Enter the code I sent.'); assert(/didn’t work/.test(oaMsg()), oaMsg()); assert(!(await authApi.session()).authenticated);
      reset();
      await signUpTo('email', 'agency', { email:'sam@harbor.example' });
      await suText('sam@harbor.example');   // an account with a password is caught before any code goes out
      assert(/already uses this email/.test(oaMsg()), 'known with a password: '+oaMsg());
      // an account without a password (made through single sign-on) is caught when the code is entered
      reset(); await authApi.ssoStart({ email:'newhire@acme.example' }); await authApi.ssoComplete({ outcome:'approve' }); await authApi.signOut();
      await signUpTo('email', 'agency'); await suText('newhire@acme.example'); await suText('98250 41207');
      await enterCode(authApi._latestEmail('newhire@acme.example').code);
      assert(/already uses this email/.test(oaMsg()), 'known without a password: '+oaMsg()); assert((await authApi.session()).authenticated===false, 'signed out again');
      assert(!appVisible());
    });

    await test('03j A new person who signs in with a code gets create workspace, minus the email and code questions and with no password', async function(){
      await enterEmail('fresh.person@startup.example');
      await enterCode(authApi._latestEmail('fresh.person@startup.example').code);
      eq(authFlow.step, 'signup', 'an unknown email is offered a workspace'); eq(suTitle(), 'What should I call you?'); eq(authFlow.intent, 'signup');
      assert(/Email verified/.test(q('.oa-aside').textContent), 'the email is verified already');
      await suText('Fresh'); await suPick('agency'); await suText('Fresh Talent'); await suPick('Just me'); await suSkip(); await suPick('IN');
      eq(suTitle(), 'Your mobile number?', 'straight to the mobile number'); eq(suProgress(), 'last one');
      await suText('98250 41207');
      assert(await waitFor(function(){ return !!q('[data-act=su-enter]'); }, 3000), 'created'); await click('[data-act=su-enter]'); await settle();
      assert(appVisible()); eq(state.role, 'admin'); eq(authAppSession.method, 'email_code');
      eq((await authApi.passwordSignIn({ email:'fresh.person@startup.example', password:'Harbor-Lights-42' })).error, 'invalid_credentials', 'no password');
      eq(ORG_STRUCTURE.profile.teamSize, '1–5');
    });

    await test('03k Verified corporate sign-up: a personal email can only create an agency workspace', async function(){
      await enterEmail('taylor.p@gmail.com'); await enterCode(authApi._latestEmail('taylor.p@gmail.com').code);
      eq(authFlow.step, 'signup'); await suText('Taylor');
      q('[data-act=su-pick][data-value=corporate]').click(); await sleep(340); await idle();
      eq(suTitle(), 'How does your team hire?', 'stays on the question'); assert(/Use your company email/.test(q('.oa-ans').textContent), 'says why');
      assert(!qa('.oa-choice').some(function(c){ return c.getAttribute('aria-checked')==='true'; }), 'nothing stays selected');
      await suPick('agency'); eq(suTitle(), 'What’s your agency called?');
      reset(); await enterEmail('ravi.k@infosys.com'); await enterCode(authApi._latestEmail('ravi.k@infosys.com').code);
      await suText('Ravi'); q('[data-act=su-pick][data-value=corporate]').click(); await sleep(340); await idle();
      assert(/Infosys already has a workspace/.test(q('.oa-ans').textContent), 'a claimed domain: '+q('.oa-ans').textContent);
    });

    await test('05y Unverified (an API sign-up): banner with Resend and I’ve verified, locks in place; invites written now are queued and sent on verifying', async function(){
      await signUpUnverified('dana@startup.example', 'Dana Lee');
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

    await test('06d Restart onboarding closes the lead and opens create workspace at the first question', async function(){
      await signUpAll('Staffing agency', 'Dana Lee', 'dana@startup.example');
      await restartOnboarding(); await idle();
      eq(authFlow.step, 'signup'); eq(suTitle(), 'What should I call you?'); eq(q('#su-name').value, '', 'nothing carried over'); assert(!appVisible());
    });

    await test('06h A password question exists only where a password is set: the owner link from Create tenant', async function(){
      assert(!q('input[type=password]'), 'sign-in starts without one');
      await signUpTo('code', 'agency'); assert(!q('input[type=password]'), 'and create workspace never asks');
      const pw = document.createElement('input'); pw.id = 'auth-password'; document.body.appendChild(pw);
      const box = document.createElement('div'); box.id = 'auth-password-strength'; box.setAttribute('data-level', '0'); box.innerHTML = '<p class="su-pw__text"></p>'; document.body.appendChild(box);
      const lvl = function(v){ pw.value = v; authPwStrength(pw); return box.getAttribute('data-level')+' '+box.querySelector('.su-pw__text').textContent; };
      eq(lvl(''), '0 Use 10 or more characters'); eq(lvl('short'), '1 Use 10 or more characters'); eq(lvl('password123'), '1 Too easy to guess');
      eq(lvl('harborlights'), '3 Good'); eq(lvl('Harbor-Lights-42'), '4 Strong');
      pw.remove(); box.remove();
    });

    /* ================= invitations, tenants, workspaces, sessions and the rest (unchanged rules) ================= */
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

    await test('06g Recruiter Manager is the role name everywhere', async function(){
      const old = 'Recruitment'+' Manager';   // split so this test's own source doesn't match
      eq(document.getElementById('app').innerHTML.indexOf(old), -1, 'old name gone from the app shell');
      eq(document.querySelector('[onclick="switchRole(\'manager\')"]').firstChild.textContent.trim(), 'Recruiter Manager', 'role switcher');
      assert(roleTemplatesForOrgType('Staffing agency').some(function(r){ return r.name==='Recruiter Manager'; }));
      eq(ROLE_META.manager.label, 'Recruiter Manager');
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

    await test('05h Remember me gives a longer session on the server', async function(){
      await authApi.passwordSignIn({ email:'alex@northstar.example', password:SAMPLE_PW, remember:true });
      authApi._advance(9*3600*1000);
      eq((await authApi.session()).authenticated, true, 'still signed in after 9 hours');
      await authApi.passwordSignIn({ email:'alex@northstar.example', password:SAMPLE_PW, remember:false });
      authApi._advance(9*3600*1000);
      eq((await authApi.session()).authenticated, false, 'ordinary session ended');
    });

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

    await test('10 No access to another organisation without membership', async function(){
      await apiSignIn('alex@northstar.example');
      eq((await authApi.selectWorkspace({ workspaceId:'ws_harbor' })).error, 'forbidden');
      eq((await authApi.selectWorkspace({ workspaceId:'ws_acme' })).error, 'forbidden');
      await authApi.signOut();
      eq((await authApi.createWorkspace({ name:'x', workspaceName:'Sneaky', password:'Cedar-Harbor-77' })).error, 'unauthenticated');
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
      settingsSection = 'signin'; showView('settings');
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
      document.getElementById('su-company').value = ''; ob.companyName = ''; await saveSheet(); assert(document.getElementById('su-company-err'), 'agency name required'); assert(wsSheet, 'stays open');
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
      eq(newest('arun@talent-one.example').inviteState, 'sent', 'sent at once: the sign-up code already verified the email'); eq(tmManagerIdOf(newest('arun@talent-one.example')), newest('meena@talent-one.example').id, 'reports to Meena');
      assert(/5 of 7 done/.test(cardText()));
      wsSimulateDays();
      assert(/Kairo 2 setup items left\. Want to finish your first client now\?/.test(cardText()), 'the reminder after three days');
      wsHideForNow(); assert(!document.getElementById('ws-card'), 'Hide for now'); showView('admin-dashboard'); assert(!document.getElementById('ws-card'), 'for this session');
      showView('setup-hub'); assert(document.querySelector('#ws-setup-section #ws-card'), 'still in Settings > Workspace setup');
      const defs = document.getElementById('ws-defaults');
      eq(Array.from(defs.querySelectorAll('.ws-defs__row')).map(function(r){ return r.querySelector('dt').textContent+'='+r.querySelector('dd').textContent; }).join('|'),
        'Team size=6\u201320|Country=\ud83c\uddee\ud83c\uddf3 India|City (head office)=Not set|Currency=INR (\u20b9)|Timezone=Asia/Kolkata (IST, UTC+5:30)|Date format=DD MMM YYYY|Data region=India|Roles=Owner, Recruiter Manager, Recruiter|Approvals=Follow the reporting line|New applicants=Shared round-robin across the job team|Client duplicate window=90 days|Submission reply time=48 hours', 'Your defaults, read-only');
      eq(defs.querySelectorAll('button').length, 11, 'each with Edit or Change, except data region');
      assert(/Data regionIndiaContact us to change/.test(defs.textContent), 'data region needs Oontu');
      wsSessionSeq++; showView('admin-dashboard'); assert(document.getElementById('ws-card'), 'back next session');
      wsOpenItem('first-client'); await idle();
      eq(state.activeNav, 'client-management'); assert(document.getElementById('nc-display'), 'the full-page client form');
      ncForm.displayName = 'Zeta Fintech'; ncForm.companyName = 'Zeta Fintech Pvt Ltd'; ncForm.firstName = 'Rahul'; ncForm.lastName = 'Mehta'; ncForm.email = 'rahul@zetafin.example'; ncForm.treatment = 'business_none'; ncForm.place = 'Maharashtra'; ncSave('add');
      JOBS.push(Object.assign({}, JOBS[0], { id:'j-test-first', title:'Backend Engineer' }));   // the job form is long; a new job is what ticks the item
      showView('admin-dashboard');
      assert(/Your workspace is ready/.test(cardText()), 'all done');
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
      eq(wsSetup.vendorInvites[0].state, 'sent', 'sent at once: the sign-up code already verified the email');
      assert(/Your workspace is ready/.test(cardText()), 'seven of seven');
    });

    await test('06l Incomplete sign-ups: question names, Setup not finished, call outcomes, assigning and logging calls', async function(){
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
      suLeadSheet.call = { outcome:'will_finish', reason:'Too many steps', nextDate:'', note:'' }; logSignupCall(); eq(leadFollowUp(signupLeadById('lead-s3')).label, 'Will finish');
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
