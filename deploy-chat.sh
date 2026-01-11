#!/bin/bash

# Script para ejecutar la migración del sistema de chat en Supabase
# Uso: bash deploy-chat.sh

set -e

echo "🚀 Deploying Chat System to Supabase..."
echo ""

# Opción 1: Usando Supabase CLI
if command -v supabase &> /dev/null; then
    echo "✅ Supabase CLI encontrado"
    echo "Ejecutando: npx supabase db push"
    npx supabase db push
    echo "✅ Migración completada via CLI"
else
    echo "⚠️  Supabase CLI no está instalado"
    echo ""
    echo "OPCIÓN 1: Instalar Supabase CLI"
    echo "  npm install -D @supabase/cli"
    echo "  npx supabase db push"
    echo ""
    echo "OPCIÓN 2: Ejecutar manualmente en Dashboard"
    echo "  1. Ve a https://app.supabase.com"
    echo "  2. Selecciona tu proyecto"
    echo "  3. SQL Editor → Create new query"
    echo "  4. Copia todo el contenido de: supabase/migrations/20250111_chat_system.sql"
    echo "  5. Click RUN"
    echo ""
    echo "OPCIÓN 3: Usar psql (si tienes PostgreSQL instalado)"
    echo "  psql postgresql://[user]:[password]@[host]/postgres < supabase/migrations/20250111_chat_system.sql"
    exit 1
fi

echo ""
echo "✅ Verificando Realtime..."
echo "Asegurate de habilitar Realtime para las tablas:"
echo "  - conversations"
echo "  - messages"
echo "  - notifications"
echo ""
echo "En Dashboard → Replication → marca los checkboxes"
echo ""
echo "🎉 ¡Setup completado!"
