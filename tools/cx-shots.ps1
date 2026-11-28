param([string]$Only, [switch]$Off)
# Screenshots of every CX screen at 1440x900 and 375x812 into cx-screens/ (headless Chrome; Playwright is not installed here).
$root = 'C:\Users\Uphire - Workstation\Downloads\OOntu Prototype HTML\html'
$out = Join-Path $root 'cx-screens'; New-Item -ItemType Directory -Force $out | Out-Null
$chrome = "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"; if(-not (Test-Path $chrome)){ $chrome = "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe" }
$utf8 = New-Object System.Text.UTF8Encoding($false)
$html = [IO.File]::ReadAllText((Join-Path $root 'recruitment-os-prototype.html'), $utf8)
$common = @'
window.__CX_SWITCH__ = CXFLAG; window.__O2_NO_PERSIST__ = true;
window.addEventListener('load', function(){ setTimeout(function(){
  var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden');
  var app = document.getElementById('app'); app.classList.remove('hidden'); app.classList.add('flex');
  state.role = 'admin'; renderSidebar();
  try { SHOT(); } catch(e){ document.body.insertAdjacentHTML('afterbegin', '<pre style="position:fixed;top:0;left:0;z-index:99999;background:#fee;padding:8px">' + e.message + '</pre>'); }
}, 400); });
'@
$shots = [ordered]@{
  'setup'      = "cxSetupNewTenant(); CA.tab='agents'; CA.agent=null; showView('kairo-team');"
  'email'      = "cxSetupNewTenant(); cxEmailConnect('RP-088','google'); CX_SETUP.email.bulk.subdomain='talent.northstartalent.com'; cxBulkCheck(); cxOpenChannel('email');"
  'whatsapp'   = "cxSetupNewTenant(); cxWaConnect({ phone:'+91 98200 11111', code:'123456', displayName:'Northstar' }); cxWaMetaDone(); cxWaSubmitStarter(); cxOpenChannel('whatsapp');"
  'linkedin'   = "cxOpenChannel('linkedin');"
  'calendar'   = "cxOpenChannel('calendar');"
  'credits'    = "CA.tab='credits'; CA.agent=null; showView('kairo-team');"
  'picks'      = "var j = JOBS.find(function(x){ return /Java/.test(x.title); }); cxIntake(j.id); cxConfirmCriteria(j.id); openJob(j.id); var m = document.getElementById('main-content'), s = document.getElementById('cx-td'); if(s){ m.scrollTop = s.getBoundingClientRect().top - m.getBoundingClientRect().top + m.scrollTop - 16; } else { document.body.insertAdjacentHTML('afterbegin', '<pre>no cx-td</pre>'); }"
  'campaign'   = "showView('kairo-team'); CA.tab='campaigns'; cxbNew('recommended'); CXB.d.audience.jobId = JOBS[0].id; cxbUseRecommended(); CXB.step = 2; caRefresh();"
  'li-queue'   = "var j = JOBS[0]; cxRank(j.id).picks.slice(0, 3).forEach(function(p){ cxLiPrepare(p.id, j.id); }); CXLQ.rid = 'LI-SURESH'; LI_TASKS.forEach(function(t){ t.recruiterId = 'LI-SURESH'; }); CA.tab='agents'; showView('kairo-team'); setTimeout(function(){ var s = document.getElementById('cx-li-queue'); if(s) s.scrollIntoView(); }, 50);"
  'needs-you'  = "var c = CANDIDATES[0]; cxSetWaConsent(c.id, 'form'); cxOnInbound({ id:'shot-1', candidateId:c.id, jobId:JOBS[0].id, channel:'whatsapp', text:'maybe, depends' }); CA.tab='agents'; showView('kairo-team'); setTimeout(function(){ var s = document.getElementById('cx-needs-you'); if(s) s.scrollIntoView(); }, 50);"
  'live-hires' = "cxGuardianSweep(); CA.tab='live'; showView('kairo-team');"
  'kairo'      = "var r = kairoRespond('whats stuck today'); showView('kairo-team'); var m = document.getElementById('main-content'); m.innerHTML = '<div class=\'content-shell o-page\'><header class=\'o-page-head\'><div><h1 class=\'o-page-head__title\'>Kairo</h1></div></header><section class=\'o-card\'><p class=\'o-card__sub\'>You: whats stuck today</p><p style=\'white-space:pre-line\'>' + oEsc(r.text) + '</p></section></div>';"
  'agents'     = "CA.tab='agents'; CA.agent=null; CX_SETUP.dismissed = true; showView('kairo-team');"
}
$sizes = @(@{ n='desktop'; w=1440; h=900 }, @{ n='mobile'; w=375; h=812 })
foreach($k in $shots.Keys){
  if($Only -and $k -ne $Only){ continue }
  $js = '<script>window.SHOT = function(){ ' + $shots[$k] + ' };' + "`n" + $common.Replace('CXFLAG', $(if($Off){ 'false' } else { 'true' })) + '</script>'
  $h = $html.IndexOf('<head>'); $page = $html.Substring(0, $h + 6) + $js + $html.Substring($h + 6)
  $tmp = Join-Path ([IO.Path]::GetTempPath()) ('cx-shot-' + [guid]::NewGuid().ToString('N')); New-Item -ItemType Directory $tmp | Out-Null
  $file = Join-Path $tmp 'page.html'; [IO.File]::WriteAllText($file, $page, $utf8); $url = ([Uri]$file).AbsoluteUri
  foreach($s in $sizes){
    $png = Join-Path $out ($k + '-' + $s.n + $(if($Off){ '-cxoff' } else { '' }) + '.png')
    Start-Process -FilePath $chrome -ArgumentList @('--headless=new', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files', ('"--user-data-dir=' + (Join-Path $tmp ('p' + $s.n)) + '"'), ('--window-size=' + $s.w + ',' + $s.h), '--virtual-time-budget=15000', ('"--screenshot=' + $png + '"'), $url) -Wait -NoNewWindow -RedirectStandardError (Join-Path $tmp 'err.txt') -RedirectStandardOutput (Join-Path $tmp 'out.txt')
    if(Test-Path $png){ "$k $($s.n) ok" } else { "$k $($s.n) MISSING" }
  }
  Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
}
