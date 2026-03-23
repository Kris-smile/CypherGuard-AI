# CypherGuard AI 验证脚本
# 用于快速执行系统验证步骤

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "CypherGuard AI 系统验证向导" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查 Docker 是否运行
Write-Host "[1/5] 检查 Docker 状态..." -ForegroundColor Yellow
$dockerRunning = docker info 2>$null
if (-not $dockerRunning) {
    Write-Host "❌ Docker 未运行，请先启动 Docker Desktop" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Docker 正在运行" -ForegroundColor Green

# 检查容器状态
Write-Host ""
Write-Host "[2/5] 检查容器状态..." -ForegroundColor Yellow
docker compose ps

# 询问用户要执行的操作
Write-Host ""
Write-Host "请选择要执行的验证步骤:" -ForegroundColor Cyan
Write-Host "1. 快速健康检查（推荐首先执行）" -ForegroundColor White
Write-Host "2. 验证图片持久化功能（M13）" -ForegroundColor White
Write-Host "3. 生成测试文档（用于性能测试）" -ForegroundColor White
Write-Host "4. 批量上传测试文档" -ForegroundColor White
Write-Host "5. 查看服务日志" -ForegroundColor White
Write-Host "6. 重启所有服务" -ForegroundColor White
Write-Host "7. 查看数据库状态" -ForegroundColor White
Write-Host "0. 退出" -ForegroundColor White
Write-Host ""

$choice = Read-Host "请输入选项 (0-7)"

switch ($choice) {
    "1" {
        Write-Host ""
        Write-Host "[3/5] 执行健康检查..." -ForegroundColor Yellow
        python scripts/health_check.py
    }
    "2" {
        Write-Host ""
        Write-Host "[3/5] 验证图片持久化..." -ForegroundColor Yellow
        python scripts/test_image_persistence.py
    }
    "3" {
        Write-Host ""
        $count = Read-Host "请输入要生成的文档数量 (默认: 10)"
        if ([string]::IsNullOrWhiteSpace($count)) { $count = 10 }

        Write-Host "[3/5] 生成 $count 个测试文档..." -ForegroundColor Yellow
        python scripts/generate_test_docs.py --count $count --output test_data
    }
    "4" {
        Write-Host ""
        $kbId = Read-Host "请输入知识库 ID"
        if ([string]::IsNullOrWhiteSpace($kbId)) {
            Write-Host "❌ 知识库 ID 不能为空" -ForegroundColor Red
            exit 1
        }

        $autoLearn = Read-Host "是否自动触发学习? (y/n, 默认: n)"
        $learnFlag = if ($autoLearn -eq "y") { "--auto-learn" } else { "" }

        Write-Host "[3/5] 批量上传文档..." -ForegroundColor Yellow
        python scripts/bulk_upload.py --dir test_data --kb-id $kbId $learnFlag
    }
    "5" {
        Write-Host ""
        Write-Host "可用的服务:" -ForegroundColor Cyan
        Write-Host "  - auth-service" -ForegroundColor White
        Write-Host "  - kb-service" -ForegroundColor White
        Write-Host "  - chat-service" -ForegroundColor White
        Write-Host "  - model-gateway" -ForegroundColor White
        Write-Host "  - worker" -ForegroundColor White
        Write-Host "  - frontend" -ForegroundColor White
        Write-Host ""

        $service = Read-Host "请输入服务名称"
        if ([string]::IsNullOrWhiteSpace($service)) {
            Write-Host "❌ 服务名称不能为空" -ForegroundColor Red
            exit 1
        }

        Write-Host "[3/5] 查看 $service 日志..." -ForegroundColor Yellow
        docker compose logs -f $service
    }
    "6" {
        Write-Host ""
        Write-Host "[3/5] 重启所有服务..." -ForegroundColor Yellow
        docker compose restart

        Write-Host ""
        Write-Host "[4/5] 等待服务启动..." -ForegroundColor Yellow
        Start-Sleep -Seconds 10

        Write-Host ""
        Write-Host "[5/5] 检查服务状态..." -ForegroundColor Yellow
        docker compose ps
    }
    "7" {
        Write-Host ""
        Write-Host "[3/5] 连接到数据库..." -ForegroundColor Yellow
        Write-Host "提示: 使用 \dt 查看表，\d <table_name> 查看表结构，\q 退出" -ForegroundColor Cyan
        Write-Host ""
        docker exec -it cypherguard-postgres psql -U postgres -d cypherguard
    }
    "0" {
        Write-Host "退出" -ForegroundColor Yellow
        exit 0
    }
    default {
        Write-Host "❌ 无效的选项" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "操作完成" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📚 更多信息请查看: docs/verification-guide.md" -ForegroundColor White
Write-Host ""
