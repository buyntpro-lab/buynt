# Quick Start Script for Dual Evidence Testing (PowerShell)
# Run from project root: .\docs\test-dual-evidence.ps1

Write-Host "🚀 Starting Buynt Development Server for Dual Evidence Testing" -ForegroundColor Cyan
Write-Host "==============================================================" -ForegroundColor Cyan
Write-Host ""

# Check if in correct directory
if (-Not (Test-Path "package.json")) {
    Write-Host "❌ Error: package.json not found. Run this from project root:" -ForegroundColor Red
    Write-Host "   cd c:\Users\Testing\Desktop\buynt" -ForegroundColor Yellow
    Write-Host "   .\docs\test-dual-evidence.ps1" -ForegroundColor Yellow
    exit 1
}

# Check if node_modules exists
if (-Not (Test-Path "node_modules")) {
    Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
    npm install
    Write-Host ""
}

# TypeScript check
Write-Host "🔍 Checking TypeScript compilation..." -ForegroundColor Cyan
npx tsc --noEmit
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ TypeScript errors found. Fix before testing." -ForegroundColor Red
    exit 1
}
Write-Host "✅ TypeScript OK (0 errors)" -ForegroundColor Green
Write-Host ""

# Start dev server
Write-Host "🌐 Starting dev server at http://localhost:5173" -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 Test Plan: docs/dual_evidence_test_plan.md" -ForegroundColor White
Write-Host "Priority Cases: 1-3, 5, 12-13" -ForegroundColor White
Write-Host ""
Write-Host "Test Accounts Needed:" -ForegroundColor Yellow
Write-Host "  • Owner account (e.g., owner@test.com)" -ForegroundColor White
Write-Host "  • Renter account (e.g., renter@test.com)" -ForegroundColor White
Write-Host "  • Non-participant (e.g., other@test.com)" -ForegroundColor White
Write-Host ""
Write-Host "=============================================================="
npm run dev
