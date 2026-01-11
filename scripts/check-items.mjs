import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ ERROR: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkItems() {
  try {
    console.log('🔍 Verificando tabla items...\n');

    // Count total items
    const { count, error: countError } = await supabase
      .from('items')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('❌ Error al contar:', countError);
      process.exit(1);
    }

    console.log(`📊 TOTAL de artículos en la tabla items: ${count}\n`);

    // Get all items
    const { data: allItems, error: fetchError } = await supabase
      .from('items')
      .select('id, title, owner_contact, category, created_at')
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('❌ Error al obtener artículos:', fetchError);
      process.exit(1);
    }

    console.log('📋 Todos los artículos en la BD:\n');
    allItems.forEach((item, index) => {
      console.log(`${index + 1}. ${item.title}`);
      console.log(`   Owner: ${item.owner_contact}`);
      console.log(`   Category: ${item.category}`);
      console.log(`   Created: ${new Date(item.created_at).toLocaleDateString()}\n`);
    });

    // Group by owner
    console.log('\n📌 Agrupados por propietario:\n');
    const byOwner = {};
    allItems.forEach(item => {
      if (!byOwner[item.owner_contact]) {
        byOwner[item.owner_contact] = [];
      }
      byOwner[item.owner_contact].push(item.title);
    });

    for (const [owner, items] of Object.entries(byOwner)) {
      console.log(`👤 ${owner}: ${items.length} artículos`);
      items.forEach(title => {
        console.log(`   - ${title}`);
      });
      console.log();
    }

  } catch (error) {
    console.error('❌ Error inesperado:', error);
    process.exit(1);
  }
}

checkItems();
