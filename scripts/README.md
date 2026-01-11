# Demo Image Fix Script

## 📋 Descripción

Script automático que reemplaza imágenes incoherentes de artículos **DEMO** por imágenes apropiadas según la categoría.

### Objetivos
- ✅ Reemplazar imágenes de seed/demo automáticamente
- ✅ NO tocar artículos reales de usuarios
- ✅ Usar URLs estables (Unsplash sin API key)
- ✅ Ser idempotente (seguro ejecutar múltiples veces)
- ✅ Loguear cambios para auditoría

---

## 🔍 Detección de Items DEMO

Un artículo se considera **DEMO** si cumple **cualquiera** de estos criterios:

1. **Owner conocido**: El `owner_contact` coincide con emails de demo:
   - `buyntpro@gmail.com`
   - `demo@buynt.app`
   - `test@buynt.app`

2. **Keywords en título/categoría**: Contiene palabras como:
   - "demo", "test", "ejemplo", "prueba"

3. **Edad del artículo**: Fue creado hace **más de 30 días**
   - (Asume que son artículos de seed inicial)

### ⚠️ Seguridad

- El script usa **Service Role Key** para permisos elevados
- Solo actualiza el campo `image_url`
- Los criterios de detección están diseñados para minimizar falsos positivos
- Se puede ejecutar múltiples veces sin efecto (idempotente)

---

## 🚀 Cómo Ejecutar

### 1️⃣ Configurar variables de entorno

Copia tu info de Supabase:

```bash
# En Windows PowerShell
$env:SUPABASE_URL = "https://your-project.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "your-service-role-key"
```

O en `.env.local`:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Luego:

```bash
# Linux/Mac
export $(cat .env.local | xargs)

# Windows (PowerShell)
Get-Content .env.local | ForEach-Object { 
  if ($_ -match '(.+)=(.*)') { 
    [Environment]::SetEnvironmentVariable($matches[1], $matches[2]) 
  } 
}
```

### 2️⃣ Instalar dependencias (si es necesario)

```bash
npm install @supabase/supabase-js
```

### 3️⃣ Ejecutar el script

**Opción A: Usar TypeScript directamente (recomendado)**

```bash
npx ts-node scripts/fix-demo-images.ts
```

**Opción B: Compilar a JavaScript primero**

```bash
npx tsc scripts/fix-demo-images.ts --module esnext --target es2020
node scripts/fix-demo-images.js
```

**Opción C: Agregar comando npm**

En `package.json`:

```json
{
  "scripts": {
    "fix:demo-images": "ts-node scripts/fix-demo-images.ts"
  }
}
```

Luego:

```bash
npm run fix:demo-images
```

---

## 📊 Esperado Output

```
📋 [INFO] 🚀 Starting Demo Image Fix Script
📋 [INFO] Environment: SUPABASE_URL=✓
📋 [INFO] Environment: SUPABASE_SERVICE_ROLE_KEY=✓
📋 [INFO] 📥 Fetching all items from Supabase...
📋 [INFO] Found 25 total items
📋 [INFO] Identified 8 demo items
📋 [INFO] Prepared 8 image updates
📋 [INFO] 💾 Applying updates to Supabase...
✅ [SUCCESS] Updated: "bici" (Bike)
✅ [SUCCESS] Updated: "pala de pádel" (Pádel)
✅ [SUCCESS] Updated: "taladro bosch" (Herramientas)
...
============================================================
✅ [SUCCESS] ✨ Demo Image Fix Complete!
📋 [INFO] Total items processed: 8
📋 [INFO] ✓ Successful updates: 8
📋 [INFO] ✗ Failed updates: 0
============================================================
```

---

## 🗂️ Archivos Incluidos

```
scripts/
├── fix-demo-images.ts           # Script principal (TypeScript)
├── demo-image-urls.ts           # Diccionario de URLs por categoría
└── README.md                    # Este archivo
```

---

## 📸 Diccionario de Categorías → Imagen

El script usa **Unsplash URLs** sin API key. Cada categoría tiene una imagen default coherente:

| Categoría | Imagen Ejemplo |
|-----------|---|
| Bike | Bicicleta de montaña |
| Pádel | Pala de pádel |
| Tenis | Raqueta de tenis |
| Herramientas | Taladro y herramientas |
| Cámara | Cámara digital |
| Electrónica | Laptop/accesorios |
| Muebles | Mesa/silla |
| Libros | Pila de libros |
| default | Genérica estable |

Ver `demo-image-urls.ts` para la lista completa.

---

## 🔄 Actualizar Diccionario

Si necesitas cambiar URLs o agregar categorías:

1. Abre `scripts/demo-image-urls.ts`
2. Edita el objeto `DEMO_IMAGE_URLS`
3. Ejecuta el script nuevamente
4. Las imágenes se actualizarán (idempotente)

---

## 🛡️ Recuperación de Fallos

### Si algo falla:

1. **Error de conexión**: Verifica SUPABASE_URL y SERVICE_ROLE_KEY
2. **Error de permisos**: Asegúrate de usar SERVICE_ROLE_KEY (no anon key)
3. **Algunos items no actualizados**: El script es parcial-idempotente; ejecuta nuevamente
4. **URLs muertas**: Unsplash es estable, pero si cambia, actualiza `demo-image-urls.ts`

### Revertir cambios:

Si necesitas revertir, puedes:

1. Guardar un backup antes: `SELECT id, title, image_url FROM items;`
2. O usar el Supabase Dashboard para editar manualmente
3. El script registra las imágenes antiguas en el output

---

## 📝 Criterios Ajustables

En `fix-demo-images.ts`, puedes cambiar:

```typescript
// Cambiar owners demo conocidos
const DEMO_OWNERS = ['buyntpro@gmail.com', 'demo@buynt.app', 'test@buynt.app'];

// Cambiar keywords de demo
const DEMO_KEYWORDS = ['demo', 'test', 'ejemplo', 'prueba'];

// Cambiar antiguedad requerida (en horas)
const DEMO_CUTOFF_HOURS = 24 * 30; // 30 días
```

---

## ✅ Checklist de Uso

- [ ] Obtener SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY de Supabase Dashboard
- [ ] Guardar credenciales en `.env.local` o variables de entorno
- [ ] Ejecutar `npx ts-node scripts/fix-demo-images.ts`
- [ ] Verificar output y contar items actualizados
- [ ] Revisar en Supabase Dashboard que las imágenes cambiaron
- [ ] (Opcional) Agregar comando npm a `package.json`

---

## 🚨 Requisitos

- Node.js 16+
- Credenciales Supabase válidas (Service Role Key)
- NPM packages: `@supabase/supabase-js`

---

## 📞 Soporte

Si el script no funciona:

1. Verifica variables de entorno: `console.log(process.env.SUPABASE_URL)`
2. Comprueba que Service Role Key tiene permisos en la tabla `items`
3. Asegúrate de que al menos 1 item cumple criterios de demo
4. Ejecuta nuevamente (idempotente, no daña)

---

## 🎯 Próximos Pasos (Opcional)

- [ ] Agregar test unitario para detectar demos
- [ ] Expandir diccionario con más categorías
- [ ] Integrar en CI/CD como hook pre-deploy
- [ ] Automatizar con cron job (ejecutar cada semana)

---

**Última actualización**: 2025-01-11  
**Versión**: 1.0
