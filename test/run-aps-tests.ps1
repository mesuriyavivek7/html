<#
  Runs test/aps.test.js without Node, in a headless-browser Web Worker (same JavaScript engine, same globals).
  Usage:  & .\test\run-aps-tests.ps1        Exit code 0 = all checks passed.
#>
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$u = New-Object System.Text.UTF8Encoding($false)
$engine = [IO.File]::ReadAllText((Join-Path $root 'oontu-approval-sla-engine.js'), $u)
$test = [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'aps.test.js'), $u)
$browser = @("$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
if(-not $browser){ Write-Host 'No Chrome or Edge found.'; exit 2 }
$shim = @'
var global = self, out = [], failed = null;
console.log = function(){ out.push(Array.prototype.slice.call(arguments).join(' ')); };
var assert = (function(){
  function fail(m){ throw new Error(m || 'assertion failed'); }
  var a = { ok:function(v, m){ if(!v) fail(m); }, strictEqual:function(x, y, m){ if(x !== y) fail((m || '') + ' expected ' + JSON.stringify(y) + ' but got ' + JSON.stringify(x)); },
    deepStrictEqual:function(x, y, m){ if(JSON.stringify(x) !== JSON.stringify(y)) fail((m || '') + ' expected ' + JSON.stringify(y) + ' but got ' + JSON.stringify(x)); } };
  return a;
})();
var __dirname = '/t';
function require(n){ if(n === 'assert') return assert; if(n === 'path') return { join:function(){ return 'engine'; } }; return undefined; }
var module = {};
'@
$body = $shim + "`n" + $engine + "`n" + "try {`n" + $test.Replace("const path = require('path');", "const path = require('path');") + "`n} catch(e){ failed = String(e && e.stack || e); }`n postMessage({ out:out, failed:failed });"
$worker = $body.Replace('</script>', '<\/script>')
$html = "<!doctype html><meta charset=utf-8><pre id=r>running</pre><script>var src = " + ($worker | ConvertTo-Json -Compress) + "; var w = new Worker(URL.createObjectURL(new Blob([src], { type:'text/javascript' }))); w.onmessage = function(e){ document.getElementById('r').textContent = JSON.stringify(e.data); }; w.onerror = function(e){ document.getElementById('r').textContent = JSON.stringify({ out:[], failed:'worker error: ' + e.message }); };</script>"
$tmp = Join-Path ([IO.Path]::GetTempPath()) ('aps-' + [guid]::NewGuid().ToString('N')); New-Item -ItemType Directory -Path $tmp | Out-Null
try {
  $page = Join-Path $tmp 'run.html'; [IO.File]::WriteAllText($page, $html, $u)
  $dom = Join-Path $tmp 'dom.html'
  Start-Process -FilePath $browser -ArgumentList @('--headless=new','--disable-gpu','--no-first-run',('"--user-data-dir=' + (Join-Path $tmp 'p') + '"'),'--virtual-time-budget=20000','--dump-dom',([Uri]$page).AbsoluteUri) -RedirectStandardOutput $dom -RedirectStandardError (Join-Path $tmp 'err.txt') -Wait -NoNewWindow
  $o = [IO.File]::ReadAllText($dom, $u)
  $m = [regex]::Match($o, '<pre id="r">([\s\S]*?)</pre>')
  if(-not $m.Success){ Write-Host 'No output from the test run.'; exit 2 }
  $json = [System.Net.WebUtility]::HtmlDecode($m.Groups[1].Value)
  if($json -eq 'running'){ Write-Host 'The test worker did not finish.'; exit 2 }
  $r = $json | ConvertFrom-Json
  foreach($l in $r.out){ Write-Host $l }
  if($r.failed){ Write-Host ''; Write-Host ('FAILED: ' + $r.failed); exit 1 }
  exit 0
} finally { Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue }
