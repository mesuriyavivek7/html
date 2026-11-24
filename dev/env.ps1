# Dot-source in a PowerShell session to use the local, no-admin toolchain:  . .\dev\env.ps1
# Node.js and PostgreSQL live in %LOCALAPPDATA%\oontu-dev (installed 2026-11-24); nothing is added to the system PATH.
$OontuDev = Join-Path $env:LOCALAPPDATA 'oontu-dev'
$env:PATH = (Join-Path $OontuDev 'node') + ';' + (Join-Path $OontuDev 'pgsql\bin') + ';' + $env:PATH
$env:PGDATA = Join-Path $OontuDev 'pgdata'
