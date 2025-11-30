# start-backend.ps1 - run the backend from repo root in PowerShell
# Usage: .\start-backend.ps1
$root = Split-Path -Parent $MyInvocation.MyCommand.Definition
Push-Location $root
try {
    python .\backend\run.py
} finally {
    Pop-Location
}