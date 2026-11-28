# Builds qa-tour/QA-TOUR.html (self-contained page + qa-tour/img) and qa-tour/QA-CHECKLIST.md from qa-tour/items.json.
# Run after tools/qa-shots.ps1. ASCII only in this file (Windows PowerShell 5.1).
$root = Split-Path -Parent $PSScriptRoot
$tour = Join-Path $root 'qa-tour'; $img = Join-Path $tour 'img'
$utf8 = New-Object System.Text.UTF8Encoding($false)
$cfg = [IO.File]::ReadAllText((Join-Path $tour 'items.json'), $utf8) | ConvertFrom-Json
$i = 0; foreach($it in $cfg.items){ $it | Add-Member -NotePropertyName '_i' -NotePropertyValue $i -Force; $i++ }
$shots = [ordered]@{}; Get-ChildItem $img -Filter *.png | ForEach-Object { $shots[$_.BaseName] = $true }
$branch = (& git -C $root rev-parse --abbrev-ref HEAD).Trim()
$data = [ordered]@{ branch = $branch; base = $cfg.base; preA = $cfg.preA; built = (Get-Date -Format 'yyyy-MM-dd HH:mm'); runs = $cfg.runs;
  run0 = 'Did not run. Its prompt (OONTU-AGENT-TRANSFORMATION-PROMPT.md) is in Downloads only; there is no AX_SWITCH in the code, no ax/ branch or tag, no docs/oontu-agent-transformation folder and no progress-page section. The Cowork v2 prompt replaced it.';
  items = $cfg.items; hood = $cfg.underTheHood; shots = $shots }
$json = ($data | ConvertTo-Json -Depth 8 -Compress).Replace('</', '<\/')
$tpl = [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'qa-tour-template.html'), $utf8)
[IO.File]::WriteAllText((Join-Path $tour 'QA-TOUR.html'), $tpl.Replace('/*DATA*/', $json), $utf8)

# printable checklist
$order = @{ 'Super Admin' = 0; 'Recruiter app' = 1; 'Cowork' = 2 }
$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine('# Oontu QA checklist')
[void]$sb.AppendLine('')
[void]$sb.AppendLine('Branch `' + $branch + '`. Before = `' + $cfg.base + '` (BASE) or `' + $cfg.preA + '` (before the QA fixes). Tick Pass or Fail for each item and write what you saw. The same items, with screenshots, are in `QA-TOUR.html`.')
[void]$sb.AppendLine('')
foreach($rn in ($cfg.runs.PSObject.Properties.Name | Sort-Object)){
  [void]$sb.AppendLine('## ' + $cfg.runs.$rn)
  [void]$sb.AppendLine('')
  if($rn -eq '0'){ [void]$sb.AppendLine($data.run0); [void]$sb.AppendLine(''); continue }
  $list = @($cfg.items | Where-Object { [string]$_.run -eq $rn } | Sort-Object @{ e = { $order[$_.screen] } }, @{ e = { $_._i } })
  foreach($it in $list){
    [void]$sb.AppendLine('### ' + $it.id + ' - ' + $it.title)
    [void]$sb.AppendLine('')
    [void]$sb.AppendLine('- Where: ' + $it.where)
    [void]$sb.AppendLine('- Switch: ' + $it.switch + ' - Log in as: ' + $it.roleName)
    [void]$sb.AppendLine('- What changed: ' + $it.changed)
    [void]$sb.AppendLine('')
    foreach($c in $it.checks){ [void]$sb.AppendLine('- [ ] ' + $c) }
    [void]$sb.AppendLine('')
    [void]$sb.AppendLine('Result: [ ] Pass  [ ] Fail    Note: ______________________________________________')
    [void]$sb.AppendLine('')
  }
  $hood = @($cfg.underTheHood | Where-Object { [string]$_.run -eq $rn })
  if($hood.Count){ [void]$sb.AppendLine('Under the hood (nothing to check on screen):'); [void]$sb.AppendLine(''); foreach($h in $hood){ [void]$sb.AppendLine('- ' + $h.text) }; [void]$sb.AppendLine('') }
}
[IO.File]::WriteAllText((Join-Path $tour 'QA-CHECKLIST.md'), $sb.ToString(), $utf8)
'built QA-TOUR.html (' + $cfg.items.Count + ' items, ' + $shots.Count + ' images) and QA-CHECKLIST.md'
