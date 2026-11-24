# Starts the local PostgreSQL (localhost only) without holding the console. Usage: & .\dev\pg-start.ps1
$D = Join-Path $env:LOCALAPPDATA 'oontu-dev'; $bin = Join-Path $D 'pgsql\bin'; $data = Join-Path $D 'pgdata'
$st = & (Join-Path $bin 'pg_ctl.exe') -D $data status 2>&1
if($LASTEXITCODE -eq 0){ Write-Output 'PostgreSQL is already running.'; exit 0 }
Start-Process -FilePath (Join-Path $bin 'pg_ctl.exe') -ArgumentList @('-D', ('"' + $data + '"'), '-l', ('"' + (Join-Path $D 'pg.log') + '"'), 'start') -WindowStyle Hidden
for($i = 0; $i -lt 60; $i++){ Start-Sleep -Milliseconds 500; & (Join-Path $bin 'pg_isready.exe') -h localhost -p 5432 -q; if($LASTEXITCODE -eq 0){ Write-Output 'PostgreSQL is accepting connections.'; exit 0 } }
Write-Output 'PostgreSQL did not start; see %LOCALAPPDATA%\oontu-dev\pg.log'; exit 1
