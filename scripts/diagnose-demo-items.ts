#!/usr/bin/env node

/**
 * DIAGNÓSTICO: Preview de Demo Items
 * ====================================
 *
 * Muestra qué items serían detectados como DEMO sin hacer cambios
 * (read-only, 100% seguro)
 *
 * Ejecución:
 *   npx ts-node scripts/diagnose-demo-items.ts
 */

import { createClient } from '@supabase/supabase-js';
import { getImageUrlForDemo } from './demo-image-urls';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const DEMO_OWNERS = ['buyntpro@gmail.com', 'demo@buynt.app', 'test@buynt.app'];
const DEMO_KEYWORDS = ['demo', 'test', 'ejemplo', 'prueba'];
const DEMO_CUTOFF_HOURS = 24 * 30;

function log(level: string, msg: string) {
  const icons: Record<string, string> = {
    INFO: '📋',
    WARN: '⚠️',
    ERROR: '❌',
    SUCCESS: '✅',
    DEMO: '🎭'
  };
  console.log(`${icons[level] || '•'} ${msg}`);
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
  if (isDemoByOwner(item.owner_contact)) {
    return { isDemo: true, reason: `Owner: ${item.owner_contact}` };
  }
  if (isDemoByKeywords(item.title, item.category)) {
    return { isDemo: true, reason: `Keywords in title/category` };
  }
  if (isOldEnough(item.created_at)) {
    return { isDemo: true, reason: `Created: ${new Date(item.created_at).toLocaleDateString()}` };
  }
  return { isDemo: false, reason: '' };
}

async function main() {
  log('INFO', '🔍 Demo Items Diagnostic Report\n');

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    log('ERROR', 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });

  try {
    log('INFO', 'Fetching all items...');
    const { data: allItems, error } = await supabase
      .from('items')
      .select('id, title, category, owner_contact, image_url, created_at');

    if (error) {
      log('ERROR', `Failed: ${error.message}`);
      process.exit(1);
    }

    if (!allItems || allItems.length === 0) {
      log('WARN', 'No items found');
      process.exit(0);
    }

    const demoItems = allItems.filter(item => isDemo(item).isDemo);
    const realItems = allItems.filter(item => !isDemo(item).isDemo);

    log('SUCCESS', `Total items: ${allItems.length}`);
    log('DEMO', `Demo items: ${demoItems.length}`);
    log('INFO', `Real items: ${realItems.length}\n`);

    if (demoItems.length > 0) {
      log('DEMO', '=== DEMO ITEMS DETECTED ===\n');
      demoItems.forEach((item, idx) => {
        const { reason } = isDemo(item);
        const newUrl = getImageUrlForDemo(item.category, item.title);
        const willChange = newUrl !== item.image_url;

        console.log(`${idx + 1}. "${item.title}"`);
        console.log(`   Category: ${item.category || 'N/A'}`);
        console.log(`   Owner: ${item.owner_contact || 'N/A'}`);
        console.log(`   Reason: ${reason}`);
        console.log(`   Current image: ${item.image_url.substring(0, 60)}...`);
        if (willChange) {
          console.log(`   ✓ Will change to: ${newUrl.substring(0, 60)}...`);
        } else {
          console.log(`   ⊘ No change needed`);
        }
        console.log();
      });
    }

    if (realItems.length > 0) {
      log('INFO', '=== REAL ITEMS (NO CHANGES) ===\n');
      realItems.forEach((item, idx) => {
        console.log(`${idx + 1}. "${item.title}"`);
        console.log(`   Category: ${item.category || 'N/A'}`);
        console.log(`   Owner: ${item.owner_contact || 'N/A'}`);
        console.log(`   Created: ${new Date(item.created_at).toLocaleDateString()}`);
        console.log();
      });
    }

    log('SUCCESS', '✅ Diagnostic complete (read-only, no changes made)');

  } catch (error: any) {
    log('ERROR', `Unexpected error: ${error.message}`);
    process.exit(1);
  }
}

main();
