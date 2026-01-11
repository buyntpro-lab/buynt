#!/usr/bin/env node

/**
 * SCRIPT: Fix Demo Images for Buynt
 * =====================================
 *
 * Propósito:
 *   Reemplazar imágenes incoherentes en artículos DEMO por imágenes
 *   coherentes según categoría.
 *
 * Detección de Demo:
 *   Un item se considera DEMO si:
 *   - Fue creado antes de una fecha específica (ej: hace 7 días)
 *   - O tiene un patrón específico en title/category (contiene "demo", "test", etc.)
 *   - O pertenece a owner_id conocido de demo (ej: buyntpro@gmail.com)
 *
 * Ejecución:
 *   node scripts/fix-demo-images.js
 *   o
 *   npx ts-node scripts/fix-demo-images.ts
 *
 * Variables de entorno requeridas:
 *   SUPABASE_URL: URL del proyecto Supabase
 *   SUPABASE_SERVICE_ROLE_KEY: Service Role Key (para permisos elevados)
 */

import { createClient } from '@supabase/supabase-js';
import { getImageUrlForDemo } from './demo-image-urls';

// ============================================================================
// CONFIG & CONSTANTES
// ============================================================================

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Emails/IDs conocidos como demo
const DEMO_OWNERS = ['buyntpro@gmail.com', 'demo@buynt.app', 'test@buynt.app'];

// Palabras clave que indican un item es DEMO
const DEMO_KEYWORDS = ['demo', 'test', 'ejemplo', 'prueba'];

// Fecha límite: items creados antes de esta fecha se consideran demo
// (en horas desde ahora; ej: 24*7 = 7 días)
const DEMO_CUTOFF_HOURS = 24 * 30; // 30 días

interface ItemDemoFix {
  id: string;
  title: string;
  category?: string;
  owner_id?: string;
  old_image_url: string;
  new_image_url: string;
  reason: string;
}

// ============================================================================
// UTILIDADES
// ============================================================================

function log(level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS', msg: string) {
  const icons: Record<string, string> = {
    INFO: '📋',
    WARN: '⚠️',
    ERROR: '❌',
    SUCCESS: '✅'
  };
  console.log(`${icons[level]} [${level}] ${msg}`);
}

function isOldEnough(createdAt: string): boolean {
  const createdDate = new Date(createdAt);
  const cutoffDate = new Date(Date.now() - DEMO_CUTOFF_HOURS * 60 * 60 * 1000);
  return createdDate < cutoffDate;
}

function isDemoByOwner(ownerContact?: string): boolean {
  if (!ownerContact) return false;
  return DEMO_OWNERS.some(owner => 
    ownerContact.toLowerCase().includes(owner.toLowerCase())
  );
}

function isDemoByKeywords(title?: string, category?: string): boolean {
  const text = `${title || ''} ${category || ''}`.toLowerCase();
  return DEMO_KEYWORDS.some(keyword => text.includes(keyword));
}

function isDemo(item: any): { isDemo: boolean; reason: string } {
  // Criterio 1: Owner conocido como demo
  if (isDemoByOwner(item.owner_contact)) {
    return { isDemo: true, reason: `Owner is known demo account: ${item.owner_contact}` };
  }

  // Criterio 2: Keywords en title/category
  if (isDemoByKeywords(item.title, item.category)) {
    return { isDemo: true, reason: `Title/category contains demo keywords` };
  }

  // Criterio 3: Item creado hace más de 30 días (seed inicial)
  if (isOldEnough(item.created_at)) {
    return { isDemo: true, reason: `Created before cutoff date (${item.created_at})` };
  }

  return { isDemo: false, reason: '' };
}

// ============================================================================
// MAIN LOGIC
// ============================================================================

async function main() {
  log('INFO', '🚀 Starting Demo Image Fix Script');
  log('INFO', `Environment: SUPABASE_URL=${SUPABASE_URL ? '✓' : '✗'}`);
  log('INFO', `Environment: SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY ? '✓' : '✗'}`);

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    log('ERROR', 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars');
    process.exit(1);
  }

  // Conectar a Supabase con service role (sin RLS)
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });

  try {
    // 1. Fetch todos los items
    log('INFO', '📥 Fetching all items from Supabase...');
    const { data: allItems, error: fetchError } = await supabase
      .from('items')
      .select('id, title, description, price_day, city, category, image_url, owner_id, owner_contact, created_at');

    if (fetchError) {
      log('ERROR', `Failed to fetch items: ${fetchError.message}`);
      process.exit(1);
    }

    if (!allItems || allItems.length === 0) {
      log('WARN', 'No items found in database');
      process.exit(0);
    }

    log('INFO', `Found ${allItems.length} total items`);

    // 2. Detectar items demo
    const demoItems = allItems.filter(item => isDemo(item).isDemo);
    log('INFO', `Identified ${demoItems.length} demo items`);

    if (demoItems.length === 0) {
      log('WARN', 'No demo items detected. Nothing to fix.');
      process.exit(0);
    }

    // 3. Preparar actualizaciones
    const fixes: ItemDemoFix[] = [];
    for (const item of demoItems) {
      const { isDemo: isD, reason } = isDemo(item);
      if (!isD) continue;

      const newImageUrl = getImageUrlForDemo(item.category, item.title);
      
      // Solo actualiza si la imagen cambió
      if (newImageUrl !== item.image_url) {
        fixes.push({
          id: item.id,
          title: item.title,
          category: item.category,
          owner_id: item.owner_id,
          old_image_url: item.image_url,
          new_image_url: newImageUrl,
          reason
        });
      }
    }

    log('INFO', `Prepared ${fixes.length} image updates`);

    if (fixes.length === 0) {
      log('WARN', 'No image changes needed.');
      process.exit(0);
    }

    // 4. Aplicar actualizaciones en batch
    log('INFO', '💾 Applying updates to Supabase...');
    
    let successCount = 0;
    let errorCount = 0;

    for (const fix of fixes) {
      const { error } = await supabase
        .from('items')
        .update({ image_url: fix.new_image_url })
        .eq('id', fix.id);

      if (error) {
        log('ERROR', `Failed to update item ${fix.id}: ${error.message}`);
        errorCount++;
      } else {
        successCount++;
        log('SUCCESS', `Updated: "${fix.title}" (${fix.category})`);
      }
    }

    // 5. Resumen
    log('INFO', '\n' + '='.repeat(60));
    log('SUCCESS', `✨ Demo Image Fix Complete!`);
    log('INFO', `Total items processed: ${fixes.length}`);
    log('INFO', `✓ Successful updates: ${successCount}`);
    log('INFO', `✗ Failed updates: ${errorCount}`);
    log('INFO', '='.repeat(60) + '\n');

    // 6. Mostrar ejemplos
    if (fixes.length > 0) {
      log('INFO', 'Sample updates:');
      fixes.slice(0, 3).forEach((fix, idx) => {
        console.log(`\n  ${idx + 1}. "${fix.title}"`);
        console.log(`     Category: ${fix.category || 'N/A'}`);
        console.log(`     Reason: ${fix.reason}`);
        console.log(`     Old: ${fix.old_image_url.substring(0, 50)}...`);
        console.log(`     New: ${fix.new_image_url.substring(0, 50)}...`);
      });
      if (fixes.length > 3) {
        log('INFO', `\n  ... and ${fixes.length - 3} more items`);
      }
    }

    process.exit(errorCount > 0 ? 1 : 0);

  } catch (error: any) {
    log('ERROR', `Unexpected error: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// ============================================================================
// EJECUCIÓN
// ============================================================================

main();
