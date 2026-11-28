param([string]$Only, [string]$Side, [switch]$NoMobile)
# QA tour screenshots (Part B of OONTU-QA-TOUR-PROMPT). Reads qa-tour/items.json and writes qa-tour/img/<id>-before.png,
# -after.png (1440x900) and -before-m.png, -after-m.png (375x812) plus qa-tour/shots.json (what each shot showed).
# Before: the BASE worktree (..\oontu-before) or, for Part A items, the pre-fix worktree (..\oontu-before-a) with CX on.
# After: the current file with the item's switches on. A red box marks the changed element in the after image.
# Phone shots load the page in a 375 px frame (headless Chrome will not lay out a window narrower than ~500 px).
# Headless Chrome only (Playwright is not installed here). ASCII only in this file (Windows PowerShell 5.1).
$root = Split-Path -Parent $PSScriptRoot
$tour = Join-Path $root 'qa-tour'; $img = Join-Path $tour 'img'; New-Item -ItemType Directory -Force $img | Out-Null
$chrome = "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"; if(-not (Test-Path $chrome)){ $chrome = "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe" }
$utf8 = New-Object System.Text.UTF8Encoding($false)
$cfg = [IO.File]::ReadAllText((Join-Path $tour 'items.json'), $utf8) | ConvertFrom-Json
$src = @{ cur = (Join-Path $root 'recruitment-os-prototype.html'); base = (Join-Path (Split-Path -Parent $root) 'oontu-before\recruitment-os-prototype.html'); prea = (Join-Path (Split-Path -Parent $root) 'oontu-before-a\recruitment-os-prototype.html') }
$html = @{}; foreach($k in $src.Keys){ if(Test-Path $src[$k]){ $html[$k] = [IO.File]::ReadAllText($src[$k], $utf8) } }
$statusFile = Join-Path $tour 'shots.json'
$status = @{}; if(Test-Path $statusFile){ $prev = [IO.File]::ReadAllText($statusFile, $utf8) | ConvertFrom-Json; foreach($p in $prev.PSObject.Properties){ $status[$p.Name] = $p.Value } }

$harness = @'
window.QA = { marked:false, err:'' };
function qaVis(x){ var r = x.getBoundingClientRect(); return r.width > 4 && r.height > 4 && getComputedStyle(x).visibility !== 'hidden' && getComputedStyle(x).display !== 'none'; }
window.QA_MARK = function(m){
  if(!m) return false; var el = null;
  if(m.sel){ var parts = m.sel.split(','); for(var i = 0; i < parts.length && !el; i++){ try { el = [].filter.call(document.querySelectorAll(parts[i].trim()), qaVis)[0] || null; } catch(e){} } }
  if(!el && m.text){ var best = null;
    [].forEach.call(document.querySelectorAll('#app *, [role=dialog] *'), function(x){ if(best || !qaVis(x)) return; var t = x.textContent || ''; if(t.indexOf(m.text) < 0) return;
      if([].some.call(x.children, function(ch){ return (ch.textContent || '').indexOf(m.text) > -1 && qaVis(ch); })) return; best = x; });
    el = best; if(el){ var up = el.closest('section, article, .o-card, .s-card, [role=dialog], li, tr'); if(up && qaVis(up) && up.getBoundingClientRect().height < 520) el = up; } }
  if(!el) return false;
  var st = document.createElement('style'); st.textContent = '*{scroll-behavior:auto !important}'; document.head.appendChild(st);
  try { el.scrollIntoView({ block:'center' }); } catch(e){}
  QA.el = el; QA.marked = true; return true;
};
window.QA_BOX = function(){
  var el = QA.el; if(!el) return; var pad = 4, box = document.createElement('div');
  box.setAttribute('data-qa-mark', '1'); document.body.appendChild(box);
  var place = function(){ var r = el.getBoundingClientRect(), l = Math.max(2, r.left - pad), t = Math.max(2, r.top - pad);
    box.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483647;border:3px solid #e5484d;border-radius:10px;box-shadow:0 0 0 4px rgba(229,72,77,.22);' +
      'left:' + l + 'px;top:' + t + 'px;width:' + Math.max(8, Math.min(innerWidth - l - 4, r.width + 2 * pad)) + 'px;height:' + Math.max(8, Math.min(innerHeight - t - 4, r.height + 2 * pad)) + 'px';
    QA.marked = r.bottom > 0 && r.top < innerHeight && r.width > 0; };
  place(); var tick = function(){ place(); requestAnimationFrame(tick); }; requestAnimationFrame(tick); setInterval(place, 50);
};
window.addEventListener('load', function(){ setTimeout(function(){
  try { var ob = document.getElementById('onboarding'); if(ob) ob.classList.add('hidden'); var app = document.getElementById('app'); if(app){ app.classList.remove('hidden'); app.classList.add('flex'); }
    (function(){ ROLEJS })(); try { renderSidebar(); } catch(e){}
    (function(){ STEPJS })();
  } catch(e){ QA.err = String(e && e.message || e); }
  setTimeout(function(){ if(MARKON){ try { QA_MARK(MARKJSON); } catch(e){} }
    setTimeout(function(){ try { QA_BOX(); } catch(e){} }, 300);
    setTimeout(function(){ var t = 'QA:' + (QA.err ? 'ERR ' + QA.err : (QA.marked ? 'MARKED' : 'NOMARK')); document.title = t; try { if(window.parent !== window) window.parent.document.title = t; } catch(e){} }, 500); }, 900);
}, 450); });
'@

function Shot([string]$pageHtml, [string]$png, [int]$w, [int]$h, [bool]$mobile){
  $tmp = Join-Path ([IO.Path]::GetTempPath()) ('qa-shot-' + [guid]::NewGuid().ToString('N')); New-Item -ItemType Directory $tmp | Out-Null
  $file = Join-Path $tmp 'page.html'; [IO.File]::WriteAllText($file, $pageHtml, $utf8)
  $url = ([Uri]$file).AbsoluteUri
  if($mobile){
    $wrap = Join-Path $tmp 'wrap.html'
    [IO.File]::WriteAllText($wrap, '<!doctype html><html><head><meta charset="utf-8"><title>wrap</title><style>html,body{margin:0;background:#fff}iframe{border:0;display:block}</style></head><body><iframe src="page.html" width="375" height="812"></iframe></body></html>', $utf8)
    $url = ([Uri]$wrap).AbsoluteUri; $w = 375; $h = 812
  }
  $dom = Join-Path $tmp 'dom.txt'
  $args2 = @('--headless=new', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files', ('"--user-data-dir=' + (Join-Path $tmp 'prof') + '"'), ('--window-size=' + $w + ',' + $h), '--virtual-time-budget=12000', ('"--screenshot=' + $png + '"'), '--dump-dom', $url)
  Start-Process -FilePath $chrome -ArgumentList $args2 -Wait -NoNewWindow -RedirectStandardOutput $dom -RedirectStandardError (Join-Path $tmp 'err.txt')
  $t = ''; if(Test-Path $dom){ $m = [regex]::Match([IO.File]::ReadAllText($dom), '<title>(QA:[^<]*)</title>'); if($m.Success){ $t = $m.Groups[1].Value } }
  Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
  if(-not $t){ $t = 'QA:NOTITLE' }
  return $t
}
function Placeholder([string]$png, [int]$w, [int]$h, [string]$why){
  $page = '<!doctype html><html><head><meta charset="utf-8"><title>QA:PLACEHOLDER</title><style>html,body{margin:0;height:100%;background:#eef0f3;font-family:-apple-system,Segoe UI,Roboto,sans-serif}div{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#5b6472}b{font-size:28px;color:#3a414c}</style></head><body><div><b>New screen</b><p>' + $why + '</p></div></body></html>'
  $tmp = Join-Path ([IO.Path]::GetTempPath()) ('qa-ph-' + [guid]::NewGuid().ToString('N')); New-Item -ItemType Directory $tmp | Out-Null
  $file = Join-Path $tmp 'ph.html'; [IO.File]::WriteAllText($file, $page, $utf8)
  Start-Process -FilePath $chrome -ArgumentList @('--headless=new', '--disable-gpu', '--hide-scrollbars', ('"--user-data-dir=' + (Join-Path $tmp 'prof') + '"'), ('--window-size=' + $w + ',' + $h), ('"--screenshot=' + $png + '"'), ([Uri]$file).AbsoluteUri) -Wait -NoNewWindow -RedirectStandardOutput (Join-Path $tmp 'o.txt') -RedirectStandardError (Join-Path $tmp 'e.txt')
  Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
}
function Build([string]$baseHtml, [string]$roleJs, [string]$stepJs, $mark, [string]$o2, [string]$rx, [bool]$cx){
  $sw = 'window.__O2_NO_PERSIST__=true;'
  if($o2){ $sw += 'window.__O2_SWITCHES__={' + (($o2 -split ',' | Where-Object { $_ } | ForEach-Object { "'" + $_.Trim() + "':true" }) -join ',') + '};' }
  if($rx){ $sw += 'window.__RX_SWITCHES__={' + (($rx -split ',' | Where-Object { $_ } | ForEach-Object { "'" + $_.Trim() + "':true" }) -join ',') + '};' }
  $sw += 'window.__CX_SWITCH__=' + $(if($cx){ 'true' } else { 'false' }) + ';'
  $markOn = if($mark){ 'true' } else { 'false' }; $markJson = if($mark){ ($mark | ConvertTo-Json -Compress) } else { 'null' }
  $js = $harness.Replace('ROLEJS', $roleJs).Replace('STEPJS', $stepJs).Replace('MARKON', $markOn).Replace('MARKJSON', $markJson)
  $h = $baseHtml.IndexOf('<head>'); return $baseHtml.Substring(0, $h + 6) + '<script>' + $sw + "`n" + $js + '</script>' + $baseHtml.Substring($h + 6)
}

foreach($it in $cfg.items){
  if($Only -and ($Only -split ',') -notcontains $it.id){ continue }
  $roleJs = $cfg.roles.($it.role)
  $sizes = @(); if(-not $it.mobileOnly){ $sizes += @{ s=''; w=1440; h=900; m=$false } }; if($it.mobile -and -not $NoMobile){ $sizes += @{ s='-m'; w=375; h=812; m=$true } }
  foreach($sd in @('before', 'after')){
    if($Side -and $Side -ne $sd){ continue }
    foreach($z in $sizes){
      $png = Join-Path $img ($it.id + '-' + $sd + $z.s + '.png'); $key = $it.id + '-' + $sd + $z.s
      if($sd -eq 'after'){
        $a = $it.after; $page = Build $html.cur $roleJs $a.js $a.mark $a.o2 $a.rx ([bool]$a.cx)
        $t = Shot $page $png $z.w $z.h $z.m
      } else {
        $b = $it.before
        if($b.src -eq 'none' -or -not $html.ContainsKey($b.src)){ Placeholder $png $z.w $z.h 'Nothing here before this change'; $t = 'QA:PLACEHOLDER' }
        else {
          $cxb = if($b.src -eq 'prea'){ $true } else { [bool]$b.cx }
          $page = Build $html[$b.src] $roleJs $b.js $null $null $null $cxb
          $t = Shot $page $png $z.w $z.h $z.m
          if($t -like 'QA:ERR*'){ Placeholder $png $z.w $z.h 'This screen did not exist before'; $t = 'QA:PLACEHOLDER (' + $t + ')' }
        }
      }
      $status[$key] = $t; "{0}`t{1}" -f $key, $t
    }
  }
}
$o = [ordered]@{}; foreach($k in ($status.Keys | Sort-Object)){ $o[$k] = $status[$k] }
[IO.File]::WriteAllText($statusFile, ($o | ConvertTo-Json), $utf8)
