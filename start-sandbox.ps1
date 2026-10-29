# ==============================================================================
# Script de Puesta en Marcha - RelicVault Checkout Sandbox (FastAPI + Next.js)
# ==============================================================================

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   🏛️ RelicVault - Entorno de Sandbox Local (FastAPI + React)" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$WorkspaceRoot = $PSScriptRoot

# 1. Asegurar archivo .env para backend
if (-not (Test-Path "$WorkspaceRoot\payments-api\.env")) {
    Write-Host "[1/4] Creando payments-api/.env desde plantilla..." -ForegroundColor Yellow
    Copy-Item "$WorkspaceRoot\payments-api\.env.example" "$WorkspaceRoot\payments-api\.env"
}

# 2. Asegurar archivo .env.local para frontend
if (-not (Test-Path "$WorkspaceRoot\frontend\.env.local")) {
    Write-Host "[2/4] Creando frontend/.env.local desde plantilla..." -ForegroundColor Yellow
    Copy-Item "$WorkspaceRoot\frontend\.env.example" "$WorkspaceRoot\frontend\.env.local"
}

Write-Host "[3/4] Levantando microservicio FastAPI en http://localhost:8000..." -ForegroundColor Green
$BackendJob = Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$WorkspaceRoot\payments-api'; python run.py" -PassThru

Write-Host "[4/4] Levantando frontend Next.js en http://localhost:3000..." -ForegroundColor Green
$FrontendJob = Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$WorkspaceRoot\frontend'; npm run dev" -PassThru

Write-Host ""
Write-Host "✅ Ambos servicios iniciados en terminales independientes:" -ForegroundColor Cyan
Write-Host "   - 📡 Microservicio FastAPI:   http://localhost:8000" -ForegroundColor White
Write-Host "   - 📖 Documentación Swagger:    http://localhost:8000/docs" -ForegroundColor White
Write-Host "   - 💻 Aplicación Web React:    http://localhost:3000" -ForegroundColor White
Write-Host "   - 🛒 Flujo Checkout Stepper:   http://localhost:3000/checkout?id=charizard-psa10" -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Cyan

