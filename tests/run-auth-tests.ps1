<#
  Runs tests/auth-flow.spec.js against recruitment-os-prototype.html in headless Chrome or Edge.
  Usage:  powershell -ExecutionPolicy Bypass -File tests\run-auth-tests.ps1 [-Browser <path to chrome.exe>]
  Exit code 0 = all passed, 1 = failures, 2 = the run itself failed.
#>
param([string]$Browser, [string]$Spec, [int]$Width = 1440, [int]$Height = 900, [int]$Budget = 200000)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$src  = Join-Path $root 'recruitment-os-prototype.html'
$spec = if($Spec){ (Resolve-Path $Spec).Path } else { Join-Path $PSScriptRoot 'auth-flow.spec.js' }

if(-not $Browser){
  $candidates = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
  )
  $Browser = $candidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
}
if(-not $Browser){ Write-Host 'No Chrome or Edge found. Pass -Browser <path>.'; exit 2 }

$tmp = Join-Path ([IO.Path]::GetTempPath()) ('oontu-auth-tests-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tmp | Out-Null
try {
  $utf8 = New-Object System.Text.UTF8Encoding($false)
  $html = [IO.File]::ReadAllText($src, $utf8)
  $idx = $html.LastIndexOf('</body>')
  if($idx -lt 0){ Write-Host 'Could not find </body> in the prototype.'; exit 2 }
  $html = $html.Substring(0, $idx) + "<script>`n" + [IO.File]::ReadAllText($spec, $utf8) + "`n</script>`n" + $html.Substring($idx)
  $page = Join-Path $tmp 'test.html'
  [IO.File]::WriteAllText($page, $html, $utf8)
  $url = ([Uri]$page).AbsoluteUri   # percent-encodes spaces in the temp path
  $dom = Join-Path $tmp 'dom.html'
  # Windows PowerShell does not quote ArgumentList items, so quote the profile path ourselves.
  Start-Process -FilePath $Browser -ArgumentList @('--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check',
    ('"--user-data-dir=' + (Join-Path $tmp 'profile') + '"'),('--window-size=' + $Width + ',' + $Height),('--virtual-time-budget=' + $Budget),'--dump-dom',$url) `
    -RedirectStandardOutput $dom -RedirectStandardError (Join-Path $tmp 'stderr.txt') -Wait -NoNewWindow

  $out = [IO.File]::ReadAllText($dom, $utf8)
  $m = [regex]::Match($out, '<pre id="auth-test-results">([\s\S]*?)</pre>')
  if(-not $m.Success){
    $title = [regex]::Match($out, '<title>([^<]*)</title>').Groups[1].Value
    Write-Host "No test results were produced (page title: '$title', DOM bytes: $($out.Length))."
    $errFile = Join-Path $tmp 'stderr.txt'
    if(Test-Path $errFile){ Get-Content $errFile -TotalCount 15 | ForEach-Object { Write-Host "  browser: $_" } }
    exit 2
  }
  $results = [System.Net.WebUtility]::HtmlDecode($m.Groups[1].Value) | ConvertFrom-Json
  $failed = 0
  foreach($r in $results){
    if($r.pass){ Write-Host ('PASS  ' + $r.name) }
    else { $failed++; Write-Host ('FAIL  ' + $r.name + '  --  ' + $r.error) }
  }
  Write-Host ''
  Write-Host ("{0} passed, {1} failed, {2} total" -f ($results.Count - $failed), $failed, $results.Count)
  if($failed -gt 0){ exit 1 } else { exit 0 }
}
finally {
  Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
}
