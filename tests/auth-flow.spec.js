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
    renderOnboardingScreen();
  }
  // Sign-in asks for the email first. Choosing the code path means Continue sends a code; sign-up always does.
  async function enterEmail(email){ authFlow.email = email; if(authFlow.intent!=='signup') authFlow.method = 'code'; authSubmitEmail(); await idle(); }
  // The first answer moves the screen on to the password question.
  async function toPasswordQuestion(email){ authFlow.email = email; authSubmitEmail(); await idle(); assert(document.getElementById('auth-password'), 'the password question appeared'); }
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

    await test('02 New user verifies email, then creates a workspace with a password and becomes owner', async function(){
      authSwitchIntent('signup');
      await signInWithCode('dana@startup.example');
      eq(authFlow.step, 'create');
      answerCreate('Dana Lee', 'Startup Talent');
      document.getElementById('auth-password').value = 'Harbor-Lights-42';
      authCreateWorkspace(); await idle();
      eq(obMode, 'setup', 'goes to workspace onboarding');
      eq(ob.companyName, 'Startup Talent');
      eq(state.role, 'admin');
      eq((await authApi.session()).workspaces[0].role, 'owner', 'server-assigned role');
      await authApi.signOut();
      eq((await authApi.passwordSignIn({ email:'dana@startup.example', password:'Harbor-Lights-42' })).ok, true, 'the password works later');
    });

    await test('02b Workspace creation needs a valid password', async function(){
      authSwitchIntent('signup');
      await signInWithCode('dana@startup.example');
      answerCreate('Dana Lee', 'Startup Talent');
      authCreateNext(); eq(authFlow.errorField, 'auth-password');
      document.getElementById('auth-password').value = 'short';
      authCreateNext(); assert(/at least 10/i.test(authFlow.error), 'length message');
      assert(!appVisible() && obMode==='signup', 'nothing created');
    });

    await test('03 Sign-up asks one question at a time: email, code, name, workspace, then password', async function(){
      const ids = function(){ return Array.from(document.querySelectorAll('.au-shell input')).map(function(i){ return i.id; }).join(','); };
      authSwitchIntent('signup');
      eq(ids(), 'auth-email', 'email question');
      await signInWithCode('min@data.example');
      eq(ids(), 'auth-name', 'name question');
      authCreateNext(); eq(authFlow.errorField, 'auth-name', 'an empty answer does not move on');
      authFlow.name = 'Min Park'; authCreateNext();
      eq(ids(), 'auth-workspace', 'workspace question');
      assert(/Min Park/.test(document.querySelector('.au-answer').textContent), 'the name stays visible as an answered row');
      authCreateNext(); eq(authFlow.errorField, 'auth-workspace');
      authFlow.workspaceName = 'Data Co'; authCreateNext();
      eq(ids(), 'auth-password', 'password question');
      eq(document.querySelectorAll('.au-answer').length, 2, 'both earlier answers are shown');
      authCreateEdit(0);
      eq(ids(), 'auth-name', 'an earlier answer can be changed'); eq(authFlow.name, 'Min Park');
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
      eq(document.activeElement.id, 'auth-email', 'cursor starts on the email question');
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
      const names = { 'Recruiter':'recruiter', 'Recruitment Manager':'manager', 'Admin':'admin' };
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
      eq(authFlow.step, 'email'); assert(document.getElementById('auth-email') && !document.getElementById('auth-password'), 'sign-in starts again at the email question');
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
      async function check(label){
        const shell = document.querySelector('.au-shell');
        eq(shell.querySelectorAll('h1').length, 1, label+' h1 count');
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
      reset(); authSwitchIntent('signup'); await check('sign-up');
      authGo('help'); await check('help');
      authGo('join'); await check('join');
      reset(); authSwitchIntent('signup'); await enterEmail('dana@startup.example'); await check('sign-up code');
      await enterCode(authApi._latestEmail('dana@startup.example').code); await check('create name');
      authFlow.name = 'Dana Lee'; authCreateNext(); await check('create workspace');
      authFlow.workspaceName = 'Startup Talent'; authCreateNext(); await check('create password');
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

    await test('21 Google and LinkedIn sign-in: existing user, new user, cancel', async function(){
      assert(document.querySelectorAll('.au-pair .au-btn').length===2, 'both buttons shown');
      authOAuth('google'); await idle();
      eq(authFlow.step, 'oauth-sim'); assert(/Google/.test(screenText()));
      authOAuthSim('approve'); await idle();
      assert(appVisible()); eq(state.role, 'admin');
      reset();
      authOAuth('linkedin'); await idle(); authOAuthSim('new'); await idle();
      eq(authFlow.step, 'create', 'a new person goes to workspace creation'); assert(!appVisible());
      reset();
      authOAuth('google'); await idle(); authOAuthSim('cancel'); await idle();
      eq(authFlow.step, 'email'); assert(/cancelled/i.test(authFlow.notice)); assert(!appVisible());
    });

    await test('22 Social buttons only appear for providers that are configured', async function(){
      eq(authResolveConfig({ mode:'live', apiBase:'https://x.example' }).oauth.length, 0);
      eq(authResolveConfig({ mode:'live', oauth:['google','facebook'] }).oauth.join(), 'google');
      eq(authResolveConfig({ mode:'prototype' }).oauth.join(), 'google,linkedin');
      authFlow.step = 'email'; authFlow.intent = 'signup'; renderOnboardingScreen();
      assert(document.querySelectorAll('.au-pair .au-btn').length===2, 'shown on sign-up too');
      eq((await authApi.oauthStart({ provider:'facebook' })).error, 'oauth_unavailable');
    });

    /* ---- the page itself ---- */
    await test('23 The sign-in page is the familiar one: email, password, forgot, remember me, no passkey', async function(){
      eq(document.querySelector('.au-h1').textContent, 'Sign in to Oontu');
      assert(document.getElementById('auth-email') && !document.getElementById('auth-password'), 'only the email is asked first');
      eq(document.querySelector('.au-btn--primary').textContent, 'Continue');
      assert(/Create an account/.test(screenText()), 'create account link');
      await toPasswordQuestion('alex@northstar.example');
      assert(!document.getElementById('auth-email') && /alex@northstar\.example/.test(document.querySelector('.au-answer').textContent), 'the email becomes an answered row');
      eq(document.activeElement.id, 'auth-password', 'cursor moves to the new question');
      assert(document.querySelector('.au-label-row button').textContent==='Forgot password?', 'forgot link beside the password label');
      assert(document.querySelector('.au-check input[type=checkbox]'), 'remember me');
      eq(document.querySelector('.au-btn--primary').textContent, 'Sign in');
      assert(/Use a one-time code instead/.test(screenText()), 'code alternative');
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
      await toPasswordQuestion('alex@northstar.example');
      const pw = document.getElementById('auth-password').closest('[data-rise]');
      assert(pw && !pw.classList.contains('au-seen'), 'the new question animates');
      assert(document.querySelector('.au-h1').classList.contains('au-seen'), 'the heading stays still');
      authChangeEmail();
      assert(!document.getElementById('auth-email').closest('[data-rise]').classList.contains('au-seen'), 'going back animates the email question again');
    });

    await test('24 A one-time code replaces the password field in place, with resend and expiry', async function(){
      await toPasswordQuestion('alex@northstar.example');
      authSetMethod('code'); await idle();
      assert(!document.getElementById('auth-password'), 'password field is gone');
      eq(authFlow.step, 'email', 'still the same screen');
      assert(document.getElementById('auth-code'), 'code field appeared');
      assert(!document.getElementById('auth-email') && document.querySelector('.au-answer'), 'email is locked while a code is pending');
      eq(authApi._outboxCount('alex@northstar.example'), 1, 'choosing the code sent exactly one');
      assert(/expires in 10 minutes/.test(screenText()), 'expiry is stated');
      assert(document.getElementById('auth-resend'), 'resend control');
      assert(/Use password instead/.test(screenText()), 'way back to the password');
      authSetMethod('password');
      assert(document.getElementById('auth-password') && !document.getElementById('auth-code'), 'back to the password field');
    });

    await test('25 Forgot password uses the one-time code, then Settings lets them set a new password', async function(){
      await toPasswordQuestion('alex@northstar.example');
      authForgot(); await idle();
      assert(authFlow.method==='code' && authFlow.forgot && authFlow.codePending, 'switched to the code path and sent a code');
      assert(/set a new password in Settings/.test(document.querySelector('.au-lede').textContent), 'explains what happens next');
      await signInWithCode('alex@northstar.example');
      assert(appVisible(), 'signed in');
      assert(document.getElementById('auth-pw-panel'), 'Settings opens on the password card');
      assert(!document.getElementById('auth-pw-current'), 'no current password is asked after a code sign-in');
      document.getElementById('auth-pw-new').value = 'Willow-Anchor-3318';
      authChangePassword(); await settle();
      assert(/has been updated/.test(document.getElementById('auth-pw-panel').textContent), 'confirmation shown');
      await authApi.signOut();
      eq((await authApi.passwordSignIn({ email:'alex@northstar.example', password:'Willow-Anchor-3318' })).ok, true, 'new password works');
      eq((await authApi.passwordSignIn({ email:'alex@northstar.example', password:SAMPLE_PW })).error, 'invalid_credentials', 'old password no longer works');
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
      try { renderOnboardingScreen(); assert(!/Create an account/.test(screenText()), 'hidden when switched off'); assert(/Trouble signing in/.test(screenText())); }
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
