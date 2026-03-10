# 执行数据库迁移（知识库等）
# 用法: 确保 Docker 中 cypherguard-postgres 已启动，在项目根目录执行:
#   .\infra\db\run_migrate.ps1
# 若报错 lock timeout 或卡住：先停止占库服务再重试，例如:
#   docker compose stop kb-service chat-service worker

$ScriptDir = $PSScriptRoot
$MigrateFile = Join-Path $ScriptDir "migrate.sql"

if (-not (Test-Path $MigrateFile)) {
    Write-Error "未找到 migrate.sql: $MigrateFile"
    exit 1
}

Write-Host "执行迁移: $MigrateFile" -ForegroundColor Cyan
docker cp $MigrateFile cypherguard-postgres:/tmp/migrate.sql
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
docker exec cypherguard-postgres psql -U postgres -d cypherguard -v ON_ERROR_STOP=1 -f /tmp/migrate.sql
$exitCode = $LASTEXITCODE
docker exec cypherguard-postgres rm -f /tmp/migrate.sql 2>$null
if ($exitCode -ne 0) { exit $exitCode }
Write-Host "迁移完成." -ForegroundColor Green
