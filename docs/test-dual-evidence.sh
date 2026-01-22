#!/bin/bash
# Quick Start Script for Dual Evidence Testing
# Run from project root: bash docs/test-dual-evidence.sh

echo "🚀 Starting Buynt Development Server for Dual Evidence Testing"
echo "=============================================================="
echo ""

# Check if in correct directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Run this from project root:"
    echo "   cd c:\\Users\\Testing\\Desktop\\buynt"
    echo "   bash docs/test-dual-evidence.sh"
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# TypeScript check
echo "🔍 Checking TypeScript compilation..."
npx tsc --noEmit
if [ $? -ne 0 ]; then
    echo "❌ TypeScript errors found. Fix before testing."
    exit 1
fi
echo "✅ TypeScript OK (0 errors)"
echo ""

# Start dev server
echo "🌐 Starting dev server at http://localhost:5173"
echo ""
echo "📋 Test Plan: docs/dual_evidence_test_plan.md"
echo "Priority Cases: 1-3, 5, 12-13"
echo ""
echo "Test Accounts Needed:"
echo "  • Owner account (e.g., owner@test.com)"
echo "  • Renter account (e.g., renter@test.com)"
echo "  • Non-participant (e.g., other@test.com)"
echo ""
echo "=============================================================="
npm run dev
