# 执行数据库迁移（知识库等）
# 用法: 确保 Docker 中 cypherguard-postgres 已启动，在项目根目录执行:
#   .\infra\db\run_migrate.ps1
# 或: cd "c:\Users\Kxhsy\Desktop\Code_Project\CypherGuard AI"; .\infra\db\run_migrate.ps1

$ScriptDir = $PSScriptRoot
$MigrateFile = Join-Path $ScriptDir "migrate.sql"

if (-not (Test-Path $MigrateFile)) {
    Write-Error "未找到 migrate.sql: $MigrateFile"
    exit 1
}

Write-Host "执行迁移: $MigrateFile" -ForegroundColor Cyan
Get-Content -Raw $MigrateFile | docker exec -i cypherguard-postgres psql -U postgres -d cypherguard -f -
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "迁移完成." -ForegroundColor Green
Write-Host "若仅需补跑知识库相关部分，可执行: Get-Content -Raw infra/db/migrate_kb_only.sql | docker exec -i cypherguard-postgres psql -U postgres -d cypherguard -f -" -ForegroundColor Gray
