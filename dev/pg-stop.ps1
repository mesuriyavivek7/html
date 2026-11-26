# Stops the local PostgreSQL cleanly. Usage: & .\dev\pg-stop.ps1
$D = Join-Path $env:LOCALAPPDATA 'oontu-dev'
& (Join-Path $D 'pgsql\bin\pg_ctl.exe') -D (Join-Path $D 'pgdata') -m fast stop
