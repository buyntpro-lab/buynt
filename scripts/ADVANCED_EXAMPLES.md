# Ejemplos Avanzados - Personalización del Sistema

## 1. Agregar Nueva Categoría de Imágenes

### Problema: Tienes una categoría "Electrodomésticos" que no está en el diccionario

### Solución:

**Archivo**: `scripts/demo-image-urls.ts`

```typescript
export const DEMO_IMAGE_URLS: Record<string, string> = {
  // ... otras categorías ...
  
  // AGREGAR NUEVA LÍNEA:
  'Electrónica': 'https://images.unsplash.com/photo-1505228395891-9a51e7e86e81?w=600&h=400&fit=crop',
  'Lavadora': 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=400&fit=crop',
  'Frigorífico': 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=600&h=400&fit=crop',
  
  // ... resto ...
};
```

Luego ejecuta:

```bash
npm run fix:demo-images
```

---

## 2. Cambiar Criterios de Detección de Demo

### Problema: Quieres que SOLO items del usuario "buyntpro" sean considerados demo

### Solución:

**Archivo**: `scripts/fix-demo-images.ts`

```typescript
// CAMBIAR ESTOS CRITERIOS:

// ❌ Antes: Detecta por owner, keywords Y edad
const DEMO_OWNERS = ['buyntpro@gmail.com', 'demo@buynt.app', 'test@buynt.app'];
const DEMO_KEYWORDS = ['demo', 'test', 'ejemplo', 'prueba'];
const DEMO_CUTOFF_HOURS = 24 * 30; // 30 días

// ✅ Después: SOLO por owner específico
const DEMO_OWNERS = ['buyntpro@gmail.com'];
const DEMO_KEYWORDS = [];  // Vacío
const DEMO_CUTOFF_HOURS = 0;  // Desactivado
```

Cambio en la función `isDemo()`:

```typescript
function isDemo(item: any): { isDemo: boolean; reason: string } {
  // Criterio 1: Owner conocido como demo (SOLO ESTO)
  if (isDemoByOwner(item.owner_contact)) {
    return { isDemo: true, reason: `Owner is known demo account: ${item.owner_contact}` };
  }
  // Ignorar criterios 2 y 3 comentando/removiendo:
  // if (isDemoByKeywords(...)) { ... }
  // if (isOldEnough(...)) { ... }
  
  return { isDemo: false, reason: '' };
}
```

Luego:

```bash
npm run diagnose:demos    # Revisar qué items son detectados ahora
npm run fix:demo-images   # Aplicar si está correcto
```

---

## 3. Usar Imágenes Locales en /public (SIN Unsplash)

### Problema: Quieres controlar las imágenes, no depender de Unsplash

### Solución A: Subir imágenes a Supabase Storage

1. **Crear bucket en Supabase**:
   - Dashboard → Storage
   - New bucket → Name: `demo-images`
   - Public: ✅

2. **Subir archivos**:
   - bike.jpg, paddle.jpg, tools.jpg, etc.

3. **Actualizar diccionario** en `demo-image-urls.ts`:

```typescript
// Usar URLs de Supabase Storage en lugar de Unsplash
const SUPABASE_URL = 'https://xxxxx.supabase.co';

export const DEMO_IMAGE_URLS: Record<string, string> = {
  'Bike': `${SUPABASE_URL}/storage/v1/object/public/demo-images/bike.jpg`,
  'Pádel': `${SUPABASE_URL}/storage/v1/object/public/demo-images/paddle.jpg`,
  'Herramientas': `${SUPABASE_URL}/storage/v1/object/public/demo-images/tools.jpg`,
  // ... resto ...
};
```

4. **Ejecutar**:

```bash
npm run fix:demo-images
```

---

## 4. Usar Imagen Diferente para MISMO TITLE

### Problema: Tienes 2 items con título "bici" pero quieres imágenes distintas

### Solución: Usar ID del item en lugar de categoría

**Archivo**: `demo-image-urls.ts`

```typescript
// Diccionario por ID de item (en lugar de categoría)
export const DEMO_ITEMS_OVERRIDES: Record<string, string> = {
  'id-del-item-1': 'https://images.unsplash.com/...bike-road',
  'id-del-item-2': 'https://images.unsplash.com/...bike-mtb',
};

// Función mejorada
export function getImageUrlForDemo(
  id: string,          // ← NUEVO
  category?: string, 
  title?: string
): string {
  // 1. Override específico por ID
  if (DEMO_ITEMS_OVERRIDES[id]) {
    return DEMO_ITEMS_OVERRIDES[id];
  }
  
  // 2. Resto de lógica normal...
  // ... (igual que antes)
}
```

**Archivo**: `fix-demo-images.ts`

```typescript
// En la sección de preparar updates:
const newImageUrl = getImageUrlForDemo(
  item.id,      // ← AGREGAR AQUÍ
  item.category, 
  item.title
);
```

---

## 5. Agregar Logging Detallado

### Problema: Quieres saber EXACTAMENTE qué pasó con cada item

### Solución: Guardar reporte en archivo

**Archivo**: `fix-demo-images.ts`

```typescript
import * as fs from 'fs/promises';

// Al final, antes de exit:
const reportPath = `./demo-fix-report-${new Date().toISOString().split('T')[0]}.json`;

await fs.writeFile(reportPath, JSON.stringify({
  timestamp: new Date().toISOString(),
  totalProcessed: fixes.length,
  successful: successCount,
  failed: errorCount,
  details: fixes.map(f => ({
    itemId: f.id,
    title: f.title,
    category: f.category,
    reason: f.reason,
    oldImage: f.old_image_url,
    newImage: f.new_image_url
  }))
}, null, 2));

log('SUCCESS', `Report saved to: ${reportPath}`);
```

Luego ejecutar:

```bash
npm run fix:demo-images
cat demo-fix-report-2025-01-11.json  # Ver reporte
```

---

## 6. Automatizar en CI/CD (GitHub Actions)

### Archivo: `.github/workflows/fix-demo-images.yml`

```yaml
name: Fix Demo Images Weekly

on:
  schedule:
    # Cada domingo a las 2 AM UTC (ajusta según tu zona)
    - cron: '0 2 * * 0'
  
  # Permitir ejecución manual
  workflow_dispatch:

jobs:
  fix:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run demo image fix
        run: npm run fix:demo-images
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}

      - name: Commit changes (optional)
        if: always()
        run: |
          git config --local user.email "automation@buynt.app"
          git config --local user.name "Demo Image Bot"
          git add -A
          git commit -m "chore: auto-fix demo images" || true
          git push
```

**Configuración en GitHub**:

1. Settings → Secrets and variables → Actions
2. Agregar:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

---

## 7. Rollback/Revertir Cambios

### Problema: Hiciste cambios y quieres revertir

### Solución A: Desde Supabase SQL Editor

```sql
-- Ejecutar en Supabase SQL Editor
-- (requiere tener backup de URLs antiguas)

UPDATE items
SET image_url = 'https://old-image-url-here'
WHERE id = 'item-id-here';
```

### Solución B: Desde logs del script

Si guardaste el reporte JSON (opción 5):

```typescript
// Script de rollback
const report = require('./demo-fix-report-2025-01-11.json');

for (const item of report.details) {
  // Revertir cada image_url a la antigua
  // ... supabase update ...
}
```

---

## 8. Dry Run (Simular sin cambios)

### Problema: Quieres ver qué pasaría sin hacer cambios reales

### Solución: Agregar flag `--dry-run`

**Archivo**: `fix-demo-images.ts`

```typescript
const isDryRun = process.argv.includes('--dry-run');

// En la sección de updates:
if (isDryRun) {
  log('WARN', `[DRY RUN] Would update: ${fix.title}`);
} else {
  const { error } = await supabase.from('items').update(...);
}
```

Ejecutar:

```bash
# Solo preview, sin cambios
npx ts-node scripts/fix-demo-images.ts --dry-run

# Con cambios reales
npm run fix:demo-images
```

---

## 9. Filtrar por Ciudad/Región

### Problema: Solo quieres arreglar demo items de Madrid

### Solución: Agregar criterio de ciudad

**Archivo**: `fix-demo-images.ts`

```typescript
const DEMO_CITIES = ['Madrid', 'Barcelona'];  // ← NUEVO

function isDemo(item: any): { isDemo: boolean; reason: string } {
  // ... criterios anteriores ...
  
  // Nuevo criterio: ciudad
  if (DEMO_CITIES.includes(item.city)) {
    return { isDemo: true, reason: `Demo city: ${item.city}` };
  }
  
  return { isDemo: false, reason: '' };
}
```

---

## 10. Usar IA para Generar Títulos/Descripciones

### Problema: Las imágenes no coinciden con título/descripción del item demo

### Solución: Actualizar TAMBIÉN descripción (OPCIONAL)

**Archivo**: `fix-demo-images.ts`

```typescript
// En lugar de solo actualizar image_url:
const updates = {
  image_url: newImageUrl,
  // OPCIONAL: Actualizar descripción también
  description: generateDemoDescription(item.category, item.title),
  title: generateDemoTitle(item.category)
};

await supabase.from('items').update(updates).eq('id', item.id);
```

**⚠️ RIESGO**: Esto cambia contenido, no solo imágenes. Usar con cuidado.

---

## Resumen de Customización

| Necesidad | Archivo | Cambio |
|-----------|---------|--------|
| Agregar categoría | `demo-image-urls.ts` | Agregar línea en `DEMO_IMAGE_URLS` |
| Cambiar criterios | `fix-demo-images.ts` | Editar `DEMO_OWNERS`, `DEMO_KEYWORDS`, `DEMO_CUTOFF_HOURS` |
| Usar storage local | `demo-image-urls.ts` | Cambiar URLs de Unsplash a `/public/` o Supabase |
| Logging detallado | `fix-demo-images.ts` | Agregar guardado de reporte JSON |
| Automatizar | `.github/workflows/` | Crear archivo YAML |
| Dry run | `fix-demo-images.ts` | Agregar flag `--dry-run` |

---

**Nota**: Para cualquier cambio, ejecuta primero `npm run diagnose:demos` para verificar que funciona correctamente antes de hacer `npm run fix:demo-images`.
