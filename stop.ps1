Write-Host "Stopping MultiView Agent services..."

# Kill processes on port 8000
$backendProcess = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue
if ($backendProcess) {
    $backendProcess | ForEach-Object { 
        Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
    }
    Write-Host "Backend stopped."
} else {
    Write-Host "Backend is not running."
}

# Kill processes on port 3000
$frontendProcess = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
if ($frontendProcess) {
    $frontendProcess | ForEach-Object { 
        Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
    }
    Write-Host "Frontend stopped."
} else {
    Write-Host "Frontend is not running."
}

Write-Host "All services stopped."
