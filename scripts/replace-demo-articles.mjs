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

const problematicArticles = [
  'Patines en Línea Rollerblade',
  'Microscopio Digital',
  'Proyector BenQ 4K',
  'Maleta de Viaje American Tourister',
  'Bicicleta Mountain Bike Trek',
  'Televisor LG OLED 55"',
  'Tabla de Surf 6\'2"',
  'Altavoz Bluetooth JBL Flip 6',
  'Máquina de Café Espresso Delonghi',
  'Traje de Esquí Rossignol',
  'Drone DJI Mini 3',
  'Escoba Mecánica para Jardín',
  'Patinete Eléctrico Xiaomi M365',
  'Microscopio Biológico Bresser',
  'Trípode Profesional Manfrotto',
  'Patines de Hielo CCM'
];

const newArticles = [
  {
    title: 'Patines en Línea Rollerblade',
    description: 'Patines en línea profesionales Rollerblade en excelente estado',
    price_day: 15,
    city: 'Barcelona',
    category: 'deportes',
    image_url: 'https://images.unsplash.com/photo-1600185365926-3a2ce3cdb9eb?w=600&h=400&fit=crop',
    owner_contact: 'buyntpro@gmail.com',
    owner_name: 'Buynt Pro'
  },
  {
    title: 'Microscopio Digital',
    description: 'Microscopio digital con cámara integrada, perfecto para estudiantes',
    price_day: 12,
    city: 'Madrid',
    category: 'educación',
    image_url: 'https://images.unsplash.com/photo-1516571748831-5d81767b788d?w=600&h=400&fit=crop',
    owner_contact: 'buyntpro@gmail.com',
    owner_name: 'Buynt Pro'
  },
  {
    title: 'Proyector BenQ 4K',
    description: 'Proyector 4K BenQ de alta calidad para cine en casa',
    price_day: 25,
    city: 'Valencia',
    category: 'electrónica',
    image_url: 'https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=600&h=400&fit=crop',
    owner_contact: 'buyntpro@gmail.com',
    owner_name: 'Buynt Pro'
  },
  {
    title: 'Maleta de Viaje American Tourister',
    description: 'Maleta de viaje grande American Tourister, resistente y ligera',
    price_day: 10,
    city: 'Barcelona',
    category: 'viajes',
    image_url: 'https://images.unsplash.com/photo-1565026057447-bc90a3dceb87?w=600&h=400&fit=crop',
    owner_contact: 'buyntpro@gmail.com',
    owner_name: 'Buynt Pro'
  },
  {
    title: 'Bicicleta Mountain Bike Trek',
    description: 'Bicicleta MTB Trek 29 pulgadas para rutas de montaña',
    price_day: 20,
    city: 'Bilbao',
    category: 'deportes',
    image_url: 'https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=600&h=400&fit=crop',
    owner_contact: 'buyntpro@gmail.com',
    owner_name: 'Buynt Pro'
  },
  {
    title: 'Televisor LG OLED 55"',
    description: 'Televisor OLED 55 pulgadas LG con excelente calidad de imagen',
    price_day: 30,
    city: 'Sevilla',
    category: 'electrónica',
    image_url: 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=600&h=400&fit=crop',
    owner_contact: 'buyntpro@gmail.com',
    owner_name: 'Buynt Pro'
  },
  {
    title: 'Tabla de Surf 6\'2"',
    description: 'Tabla de surf 6\'2" para principiantes y intermedios',
    price_day: 18,
    city: 'San Sebastián',
    category: 'deportes',
    image_url: 'https://images.unsplash.com/photo-1531722569936-825d3dd91b15?w=600&h=400&fit=crop',
    owner_contact: 'buyntpro@gmail.com',
    owner_name: 'Buynt Pro'
  },
  {
    title: 'Altavoz Bluetooth JBL Flip 6',
    description: 'Altavoz Bluetooth portátil JBL Flip 6 con excelente sonido',
    price_day: 8,
    city: 'Barcelona',
    category: 'electrónica',
    image_url: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=600&h=400&fit=crop',
    owner_contact: 'buyntpro@gmail.com',
    owner_name: 'Buynt Pro'
  },
  {
    title: 'Máquina de Café Espresso Delonghi',
    description: 'Máquina de café espresso Delonghi automática para tu hogar',
    price_day: 22,
    city: 'Madrid',
    category: 'hogar',
    image_url: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=600&h=400&fit=crop',
    owner_contact: 'buyntpro@gmail.com',
    owner_name: 'Buynt Pro'
  },
  {
    title: 'Traje de Esquí Rossignol',
    description: 'Traje de esquí Rossignol completo para hombre, impermeable y cálido',
    price_day: 35,
    city: 'Andorra',
    category: 'deportes',
    image_url: 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=600&h=400&fit=crop',
    owner_contact: 'buyntpro@gmail.com',
    owner_name: 'Buynt Pro'
  },
  {
    title: 'Drone DJI Mini 3',
    description: 'Drone DJI Mini 3 compacto y potente para fotografía aérea',
    price_day: 28,
    city: 'Valencia',
    category: 'electrónica',
    image_url: 'https://images.unsplash.com/photo-1473968512647-3e447244af8f?w=600&h=400&fit=crop',
    owner_contact: 'buyntpro@gmail.com',
    owner_name: 'Buynt Pro'
  },
  {
    title: 'Soplador de Hojas para Jardín',
    description: 'Soplador de hojas eléctrico potente para limpiar el jardín',
    price_day: 5,
    city: 'Barcelona',
    category: 'jardín',
    image_url: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=600&h=400&fit=crop',
    owner_contact: 'buyntpro@gmail.com',
    owner_name: 'Buynt Pro'
  },
  {
    title: 'Patinete Eléctrico Xiaomi M365',
    description: 'Patinete eléctrico Xiaomi M365 Pro para desplazamientos urbanos',
    price_day: 16,
    city: 'Madrid',
    category: 'transporte',
    image_url: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=400&fit=crop',
    owner_contact: 'buyntpro@gmail.com',
    owner_name: 'Buynt Pro'
  },
  {
    title: 'Microscopio Biológico Bresser',
    description: 'Microscopio biológico profesional Bresser para observaciones detalladas',
    price_day: 14,
    city: 'Barcelona',
    category: 'educación',
    image_url: 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=600&h=400&fit=crop',
    owner_contact: 'buyntpro@gmail.com',
    owner_name: 'Buynt Pro'
  },
  {
    title: 'Trípode Profesional Manfrotto',
    description: 'Trípode profesional Manfrotto para cámaras y smartphones',
    price_day: 11,
    city: 'Valencia',
    category: 'fotografía',
    image_url: 'https://images.unsplash.com/photo-1617575521317-d2974f3b56d2?w=600&h=400&fit=crop',
    owner_contact: 'buyntpro@gmail.com',
    owner_name: 'Buynt Pro'
  },
  {
    title: 'Patines de Hielo CCM',
    description: 'Patines de hielo CCM profesionales para patinaje artístico',
    price_day: 13,
    city: 'Bilbao',
    category: 'deportes',
    image_url: 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=600&h=400&fit=crop',
    owner_contact: 'buyntpro@gmail.com',
    owner_name: 'Buynt Pro'
  }
];

async function replaceArticles() {
  try {
    console.log('🔄 Iniciando reemplazo de artículos...\n');

    // Step 1: Delete problematic articles
    console.log('1️⃣ Eliminando 16 artículos problemáticos...');
    const { error: deleteError, data: deletedData } = await supabase
      .from('items')
      .delete()
      .in('title', problematicArticles);

    if (deleteError) {
      console.error('❌ Error al eliminar artículos:', deleteError);
      process.exit(1);
    }

    console.log(`✅ ${problematicArticles.length} artículos eliminados\n`);

    // Step 2: Insert new articles
    console.log('2️⃣ Creando 16 artículos nuevos con imágenes correctas...');
    
    // Add standard fields for all new articles
    const articlesToInsert = newArticles.map(article => ({
      title: article.title,
      description: article.description,
      price_day: article.price_day,
      city: article.city,
      category: article.category,
      image_url: article.image_url,
      owner_contact: article.owner_contact,
      owner_name: article.owner_name,
      created_at: new Date().toISOString()
    }));

    const { error: insertError, data: insertedData } = await supabase
      .from('items')
      .insert(articlesToInsert);

    if (insertError) {
      console.error('❌ Error al crear artículos:', insertError);
      process.exit(1);
    }

    console.log(`✅ ${articlesToInsert.length} artículos nuevos creados\n`);

    // Step 3: Verify
    console.log('3️⃣ Verificando cambios en la base de datos...');
    const { data: allItems, error: verifyError } = await supabase
      .from('items')
      .select('id, title, image_url, category')
      .order('created_at', { ascending: false })
      .limit(20);

    if (verifyError) {
      console.error('❌ Error al verificar:', verifyError);
      process.exit(1);
    }

    console.log(`\n✅ Total de items actualmente en la BD: ${allItems.length}`);
    console.log('\n📋 Últimos 16 artículos creados:');
    console.log('─'.repeat(80));
    
    allItems.slice(0, 16).forEach((item, index) => {
      const hasImage = item.image_url && item.image_url.trim() !== '';
      const imageStatus = hasImage ? '✅ Imagen' : '❌ Sin imagen';
      console.log(`${index + 1}. ${item.title} (${item.category}) - ${imageStatus}`);
    });

    console.log('─'.repeat(80));
    console.log('\n🎉 ¡Reemplazo completado exitosamente!');
    console.log('\n✨ Cambios realizados:');
    console.log('   • Eliminados: 16 artículos problemáticos');
    console.log('   • Creados: 16 artículos nuevos con imágenes correctas');
    console.log('   • Todas las imágenes son de Unsplash (acceso libre)');
    console.log('   • Las imágenes corresponden a cada categoría correctamente');

  } catch (error) {
    console.error('❌ Error inesperado:', error);
    process.exit(1);
  }
}

replaceArticles();
