# Checklist de Pruebas - Sistema de Fotos

Este documento contiene el checklist completo de pruebas manuales para verificar el correcto funcionamiento del sistema de fotos de Buynt.

---

## Pre-requisitos

- [ ] Buckets de Storage creados (`items-public`, `booking-proof-private`)
- [ ] Migración SQL ejecutada (tablas `item_images`, `booking_media`)
- [ ] Políticas RLS configuradas
- [ ] Usuario de prueba creado y autenticado

---

## 1. Crear Item Nuevo con Fotos

### 1.1 Subida básica
- [ ] Ir a `/publicar`
- [ ] Rellenar datos básicos (título, precio, ciudad)
- [ ] Hacer clic en zona de arrastrar para seleccionar 3 fotos
- [ ] Verificar que aparecen las previews
- [ ] Verificar que la primera foto tiene badge "Portada"
- [ ] Guardar el item
- [ ] Verificar que aparece mensaje de éxito
- [ ] Verificar que redirige a `/my-items`

### 1.2 Drag & Drop
- [ ] Arrastrar una imagen sobre la zona de upload
- [ ] Verificar que la zona cambia de color
- [ ] Soltar la imagen
- [ ] Verificar que se añade a la lista

### 1.3 Reordenar imágenes
- [ ] Crear item con 3+ fotos
- [ ] Arrastrar una foto a otra posición
- [ ] Verificar que el orden cambia visualmente
- [ ] Guardar el item
- [ ] Abrir detalle y verificar que el orden se mantiene

### 1.4 Cambiar portada
- [ ] Crear item con 2+ fotos
- [ ] Hacer hover sobre foto que no es portada
- [ ] Hacer clic en el icono de estrella (⭐)
- [ ] Verificar que el badge "Portada" se mueve a esa foto
- [ ] Guardar el item
- [ ] Verificar en feed que la nueva portada es la que se muestra

### 1.5 Eliminar foto
- [ ] Crear item con 2+ fotos
- [ ] Hacer hover sobre una foto
- [ ] Hacer clic en el icono X
- [ ] Verificar que la foto desaparece
- [ ] Si era la portada, verificar que otra foto pasa a ser portada
- [ ] Guardar y verificar que la foto eliminada no aparece

### 1.6 Validaciones
- [ ] Intentar subir archivo que no es imagen → debe rechazarlo
- [ ] Intentar subir imagen > 5MB → debe rechazarlo
- [ ] Intentar subir más de 8 fotos → debe rechazar las extras
- [ ] Intentar guardar sin fotos ni URL → debe mostrar error

### 1.7 Modo Legacy (URL externa)
- [ ] Marcar checkbox "Usar URL externa"
- [ ] Pegar URL de imagen (ej: Unsplash)
- [ ] Guardar item
- [ ] Verificar que la imagen se muestra correctamente en feed/detalle

---

## 2. Feed (Home)

### 2.1 Mostrar thumbnails
- [ ] Ir a `/` (home)
- [ ] Verificar que los items con fotos nuevas muestran thumbnail
- [ ] Verificar que carga rápido (thumb es ~400px)

### 2.2 Fallback a URL legacy
- [ ] Verificar que items antiguos (sin item_images) siguen mostrando su image_url
- [ ] No debe romperse el feed

### 2.3 Placeholder
- [ ] Crear item sin foto (usando URL legacy vacía)
- [ ] Verificar que muestra placeholder o icono

---

## 3. Detalle de Item

### 3.1 Galería con múltiples fotos
- [ ] Abrir item con 3+ fotos
- [ ] Verificar que se muestra imagen principal grande
- [ ] Verificar que aparecen thumbnails debajo
- [ ] Hacer clic en un thumbnail → cambia la imagen principal
- [ ] Usar flechas de navegación ← → para cambiar imagen

### 3.2 Lightbox
- [ ] Hacer clic en imagen principal
- [ ] Verificar que se abre lightbox a pantalla completa
- [ ] Navegar con flechas
- [ ] Presionar Escape o clic fuera → se cierra

### 3.3 Item con una sola foto
- [ ] Abrir item con 1 foto
- [ ] Verificar que se muestra como hero (sin thumbnails)
- [ ] Verificar que sigue funcionando el lightbox

### 3.4 Fallback a URL legacy
- [ ] Abrir item antiguo (sin item_images)
- [ ] Verificar que muestra la image_url correctamente

---

## 4. Editar Item (Gestión de Fotos)

### 4.1 Cargar fotos existentes
- [ ] Ir a editar un item con fotos
- [ ] Verificar que las fotos existentes se muestran
- [ ] Verificar que la portada está marcada

### 4.2 Añadir nueva foto
- [ ] Añadir una nueva foto
- [ ] Guardar cambios
- [ ] Verificar en detalle que aparece la nueva foto

### 4.3 Eliminar foto existente
- [ ] Eliminar una foto existente
- [ ] Guardar cambios
- [ ] Verificar en detalle que ya no aparece
- [ ] Verificar en Storage que el archivo fue eliminado

### 4.4 Cambiar portada
- [ ] Cambiar qué foto es portada
- [ ] Guardar
- [ ] Verificar en feed que muestra la nueva portada

### 4.5 Permisos
- [ ] Intentar editar item de otro usuario → debe denegar acceso

---

## 5. Evidencias de Booking (Handoff/Return)

### 5.1 Pre-requisito
- [ ] Tener un rental activo (solicitud aceptada)
- [ ] Verificar que `rental_id` existe en la solicitud

### 5.2 Subir fotos de entrega (Handoff)
- [ ] Ir a detalle de solicitud aceptada
- [ ] Localizar sección "Fotos de Entrega"
- [ ] Subir 3 fotos
- [ ] Verificar que aparecen en la galería
- [ ] Verificar badge "3/3 mín." cambia a "Completado"

### 5.3 Ver fotos de entrega (como otra parte)
- [ ] Iniciar sesión como la otra parte del booking
- [ ] Ir al mismo detalle de solicitud
- [ ] Verificar que puede ver las fotos de entrega

### 5.4 Subir fotos de devolución (Return)
- [ ] Localizar sección "Fotos de Devolución"
- [ ] Subir 3 fotos
- [ ] Verificar que aparecen

### 5.5 Lightbox en evidencias
- [ ] Hacer clic en una foto de evidencia
- [ ] Verificar que se abre lightbox
- [ ] Navegar entre fotos

### 5.6 Eliminar evidencia propia
- [ ] Hover sobre foto propia → aparece botón X
- [ ] Eliminar foto
- [ ] Verificar que desaparece

### 5.7 Permisos - No participante
- [ ] Intentar acceder a solicitud de otros usuarios
- [ ] Verificar que no puede ver las evidencias (403 o vacío)

---

## 6. Script de Migración

### 6.1 Dry-run
```bash
npx tsx scripts/migrate-images.ts --dry-run
```
- [ ] Ejecutar sin errores
- [ ] Verificar que lista items con image_url sin migrar
- [ ] Verificar que muestra URLs válidas e inválidas

### 6.2 Ejecutar migración (5 items)
```bash
npx tsx scripts/migrate-images.ts --execute --batch=5
```
- [ ] Verificar que descarga las imágenes
- [ ] Verificar que sube a Storage
- [ ] Verificar que crea registros en item_images
- [ ] Verificar que marca `image_migrated_at`

### 6.3 Verificar migración
- [ ] Ir al feed
- [ ] Verificar que items migrados muestran imagen desde Storage
- [ ] Abrir detalle de item migrado
- [ ] Verificar que la imagen carga correctamente

### 6.4 Fallback en fallos
- [ ] Si una URL falla, verificar que el item sigue mostrando la URL original
- [ ] Verificar logs de errores

### 6.5 Re-ejecutar (idempotencia)
- [ ] Ejecutar migración de nuevo
- [ ] Verificar que no duplica imágenes
- [ ] Items ya migrados deben saltarse

---

## 7. Rendimiento y Edge Cases

### 7.1 Compresión
- [ ] Subir imagen grande (ej: 4000x3000 px)
- [ ] Verificar que se comprime (thumbnail ~400px, full ~1600px)
- [ ] Verificar que el tamaño final es < 1MB

### 7.2 Carga lenta / Error de red
- [ ] Simular red lenta (DevTools → Network → Slow 3G)
- [ ] Verificar que el uploader muestra progreso
- [ ] Verificar que no se bloquea la UI

### 7.3 Múltiples pestañas
- [ ] Abrir item en 2 pestañas
- [ ] Editar fotos en una pestaña
- [ ] Refrescar la otra pestaña → debe mostrar cambios

### 7.4 Mobile
- [ ] Probar upload en dispositivo móvil
- [ ] Verificar que funciona con cámara
- [ ] Verificar que la galería es responsive

---

## 8. Limpieza y Seguridad

### 8.1 Storage cleanup
- [ ] Eliminar un item con fotos
- [ ] Verificar que las fotos se eliminan de Storage (CASCADE)

### 8.2 RLS
- [ ] Intentar subir foto a item ajeno → debe fallar
- [ ] Intentar eliminar foto de item ajeno → debe fallar
- [ ] Intentar ver evidencias de booking ajeno → debe fallar

### 8.3 CORS (Migración)
- [ ] Verificar que la migración descarga URLs externas
- [ ] Verificar que bloquea URLs internas (127.0.0.1, etc.)

---

## Resultado Final

| Sección | Total Tests | Pasados | Fallidos |
|---------|-------------|---------|----------|
| 1. Crear Item | 16 | | |
| 2. Feed | 3 | | |
| 3. Detalle | 6 | | |
| 4. Editar | 5 | | |
| 5. Evidencias | 7 | | |
| 6. Migración | 5 | | |
| 7. Rendimiento | 4 | | |
| 8. Seguridad | 3 | | |
| **TOTAL** | **49** | | |

---

## Notas

- Fecha de pruebas: _______________
- Probador: _______________
- Versión: _______________
- Comentarios adicionales:

