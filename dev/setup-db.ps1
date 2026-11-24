# One-time (and re-runnable) local database setup. Usage: & .\dev\setup-db.ps1
# Creates the roles oontu_owner (owns the schema, runs migrations) and oontu_app (the API: not the owner, NOBYPASSRLS),
# the databases oontu and oontu_test, and writes server/.env.local with generated passwords. Nothing secret is printed.
$ErrorActionPreference = 'Stop'
$D = Join-Path $env:LOCALAPPDATA 'oontu-dev'; $bin = Join-Path $D 'pgsql\bin'
$repo = Split-Path -Parent $PSScriptRoot; $envFile = Join-Path $repo 'server\.env.local'
function New-Secret { $b = New-Object byte[] 24; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); return (([Convert]::ToBase64String($b)) -replace '[+/=]', 'x') }
$env:PGPASSWORD = (Get-Content (Join-Path $D 'pg-superuser-password.txt') -Raw).Trim()
function Invoke-Sql([string]$db, [string]$sql){ & (Join-Path $bin 'psql.exe') -h localhost -U postgres -d $db -v ON_ERROR_STOP=1 -qtAc $sql; if($LASTEXITCODE -ne 0){ throw "psql failed" } }

$owner = New-Secret; $app = New-Secret
Invoke-Sql 'postgres' "DO `$`$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='oontu_owner') THEN CREATE ROLE oontu_owner LOGIN; END IF; IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='oontu_app') THEN CREATE ROLE oontu_app LOGIN; END IF; END `$`$;"
Invoke-Sql 'postgres' "ALTER ROLE oontu_owner WITH LOGIN NOSUPERUSER NOCREATEROLE NOBYPASSRLS PASSWORD '$owner'; ALTER ROLE oontu_app WITH LOGIN NOSUPERUSER NOCREATEROLE NOCREATEDB NOBYPASSRLS PASSWORD '$app';"
foreach($db in 'oontu','oontu_test'){
  $exists = Invoke-Sql 'postgres' "SELECT 1 FROM pg_database WHERE datname='$db'"
  if(-not $exists){ Invoke-Sql 'postgres' "CREATE DATABASE $db OWNER oontu_owner ENCODING 'UTF8' TEMPLATE template0" }
  Invoke-Sql $db "REVOKE ALL ON SCHEMA public FROM PUBLIC; GRANT USAGE ON SCHEMA public TO oontu_app; ALTER SCHEMA public OWNER TO oontu_owner; REVOKE CREATE ON DATABASE $db FROM PUBLIC; GRANT CONNECT ON DATABASE $db TO oontu_app;"
}
Remove-Item Env:PGPASSWORD
$lines = @(
  "# Written by dev/setup-db.ps1 on $(Get-Date -Format s). Local development only. Never commit.",
  "DATABASE_URL_OWNER=postgres://oontu_owner:$owner@localhost:5432/oontu",
  "DATABASE_URL_APP=postgres://oontu_app:$app@localhost:5432/oontu",
  "DATABASE_URL_TEST_OWNER=postgres://oontu_owner:$owner@localhost:5432/oontu_test",
  "DATABASE_URL_TEST_APP=postgres://oontu_app:$app@localhost:5432/oontu_test",
  "PORT=4000"
)
[IO.File]::WriteAllLines($envFile, $lines, (New-Object System.Text.UTF8Encoding($false)))
Write-Output "Databases oontu and oontu_test are ready; roles oontu_owner and oontu_app; server/.env.local written (not committed)."
