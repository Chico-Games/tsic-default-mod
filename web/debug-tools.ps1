# Serves the WebUI files on localhost and opens debug-tools.html in Chrome.
# Usage: powershell -File debug-tools.ps1 [-Port 8080]
param([int]$Port = 8080)

$root = $PSScriptRoot
if (-not $root) { $root = Split-Path -Parent $MyInvocation.MyCommand.Path }

$url = "http://localhost:$Port/debug-tools.html"

# Try to find Python 3
$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) { $python = Get-Command python3 -ErrorAction SilentlyContinue }

if ($python) {
    Write-Host "Serving $root on port $Port ..." -ForegroundColor Cyan
    Write-Host "Opening $url" -ForegroundColor Green
    Write-Host "Press Ctrl+C to stop." -ForegroundColor DarkGray
    Start-Process $url
    & $python.Source -m http.server $Port --directory $root
} else {
    Write-Host "Python not found. Install Python 3 or run manually:" -ForegroundColor Yellow
    Write-Host "  cd `"$root`"" -ForegroundColor White
    Write-Host "  npx serve -l $Port" -ForegroundColor White
    Write-Host "  # then open $url" -ForegroundColor White
}
