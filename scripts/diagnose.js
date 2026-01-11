#!/usr/bin/env node

/**
 * SCRIPT: Diagnóstico de Items DEMO (Versión Simple)
 * Detecta qué items serían actualizados sin hacer cambios
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const DEMO_OWNERS = ['buyntpro@gmail.com', 'demo@buynt.app', 'test@buynt.app'];
const DEMO_KEYWORDS = ['demo', 'test', 'ejemplo', 'prueba'];
const DEMO_CUTOFF_HOURS = 24 * 30;

// Diccionario de imágenes
const DEMO_IMAGE_URLS = {
  'Bike': 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=400&fit=crop',
  'Bicicleta': 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=400&fit=crop',
  'MTB': 'https://images.unsplash.com/photo-1516650752132-53e584f66afa6?w=600&h=400&fit=crop',
  'Pádel': 'https://images.unsplash.com/photo-1587280591945-bdec7724cfca?w=600&h=400&fit=crop',
  'Patines': 'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=600&h=400&fit=crop',
  'Electrónica': 'https://images.unsplash.com/photo-1505228395891-9a51e7e86e81?w=600&h=400&fit=crop',
  'Cámara': 'https://images.unsplash.com/photo-1606986628025-35d57e735ae0?w=600&h=400&fit=crop',
  'Laptop': 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600&h=400&fit=crop',
  'Herramientas': 'https://images.unsplash.com/photo-1586864387789-628af90f8a9b?w=600&h=400&fit=crop',
  'Taladro': 'https://images.unsplash.com/photo-1577720643272-265f434df2ef?w=600&h=400&fit=crop',
  'Microscopio': 'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?w=600&h=400&fit=crop',
  'default': 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&h=400&fit=crop'
};

function getImageUrlForDemo(category, title) {
  if (category && DEMO_IMAGE_URLS[category]) {
    return DEMO_IMAGE_URLS[category];
  }
  if (title) {
    const titleLower = title.toLowerCase();
    for (const [key, url] of Object.entries(DEMO_IMAGE_URLS)) {
      if (key !== 'default' && titleLower.includes(key.toLowerCase())) {
        return url;
      }
    }
  }
  return DEMO_IMAGE_URLS.default;
}

function isOldEnough(createdAt) {
  const createdDate = new Date(createdAt);
  const cutoffDate = new Date(Date.now() - DEMO_CUTOFF_HOURS * 60 * 60 * 1000);
  return createdDate < cutoffDate;
}

function isDemoByOwner(ownerContact) {
  if (!ownerContact) return false;
  return DEMO_OWNERS.some(owner => 
    ownerContact.toLowerCase().includes(owner.toLowerCase())
  );
}

function isDemoByKeywords(title, category) {
  const text = `${title || ''} ${category || ''}`.toLowerCase();
  return DEMO_KEYWORDS.some(keyword => text.includes(keyword));
}

function isDemo(item) {
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
  console.log('\n🔍 Demo Items Diagnostic Report\n');

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.log('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });

  try {
    console.log('📥 Fetching all items...');
    const { data: allItems, error } = await supabase
      .from('items')
      .select('id, title, category, owner_contact, image_url, created_at');

    if (error) {
      console.log(`❌ Failed: ${error.message}`);
      process.exit(1);
    }

    if (!allItems || allItems.length === 0) {
      console.log('⚠️  No items found');
      process.exit(0);
    }

    const demoItems = allItems.filter(item => isDemo(item).isDemo);
    const realItems = allItems.filter(item => !isDemo(item).isDemo);

    console.log(`✅ Total items: ${allItems.length}`);
    console.log(`🎭 Demo items: ${demoItems.length}`);
    console.log(`📝 Real items: ${realItems.length}\n`);

    if (demoItems.length > 0) {
      console.log('=== DEMO ITEMS DETECTED ===\n');
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

    console.log('\n✅ Diagnostic complete (read-only, no changes made)');

  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

main();
