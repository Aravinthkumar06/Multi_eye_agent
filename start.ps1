$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition

Write-Host "=== MultiView Agent Startup ===" -ForegroundColor Cyan

# --- Kill anything already on ports 8000 / 3000 ---
foreach ($port in 8000, 3000) {
    $conn = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($conn) {
        Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
        Write-Host "Cleared port $port" -ForegroundColor Yellow
    }
}
Start-Sleep -Seconds 1

# --- Start Backend ---
Write-Host "Starting Backend on port 8000..." -ForegroundColor Green
$backendCmd = "Set-Location '$scriptDir\backend'; . '.\venv\Scripts\Activate.ps1'; python -m uvicorn app.main:app --host 0.0.0.0 --port 8000"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd

# Wait for backend to come up (poll health endpoint)
Write-Host "Waiting for backend to be ready..." -ForegroundColor Yellow
$maxWait = 30
$waited = 0
$ready = $false
do {
    Start-Sleep -Seconds 1
    $waited++
    try {
        $resp = Invoke-WebRequest -Uri "http://127.0.0.1:8000/health" -TimeoutSec 2 -UseBasicParsing -ErrorAction SilentlyContinue
        if ($resp.StatusCode -eq 200) {
            $ready = $true
            break
        }
    } catch { }
} while ($waited -lt $maxWait)

if ($ready) {
    Write-Host "Backend is READY!" -ForegroundColor Green
} else {
    Write-Host "WARNING: Backend did not respond after $maxWait seconds." -ForegroundColor Red
}

# --- Start Frontend ---
Write-Host "Starting Frontend on port 3000..." -ForegroundColor Green
$frontendCmd = "Set-Location '$scriptDir\frontend'; npm run dev -- --port 3000 --host"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCmd

Start-Sleep -Seconds 3
Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  MultiView Agent is running!" -ForegroundColor Green
Write-Host "  Open: http://localhost:3000" -ForegroundColor White
Write-Host "=====================================" -ForegroundColor Cyan
