$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path

Set-Location $Root

Write-Host ""
Write-Host "JA-TUI"
Write-Host ""

if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
    Write-Host "Bun is not installed or not in PATH."
    exit 1
}

if (-not (Test-Path ".\src\main.ts")) {
    Write-Host "src\main.ts was not found."
    exit 1
}

if (-not (Test-Path ".\assets\ja-tui.ico")) {
    Write-Host "assets\ja-tui.ico was not found."
    exit 1
}

if (-not (Test-Path ".\scripts\build.ts")) {
    Write-Host "scripts\build.ts was not found."
    exit 1
}

Write-Host "Building JA-TUI..."
Write-Host ""

bun run .\scripts\build.ts

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Build failed."
    exit $LASTEXITCODE
}

Write-Host ""
Write-Host "Build finished."
Write-Host ""

$Exe = Join-Path $Root "release\JA-TUI.exe"

if (Test-Path $Exe) {
    Write-Host "Executable:"
    Write-Host $Exe
}

Write-Host ""