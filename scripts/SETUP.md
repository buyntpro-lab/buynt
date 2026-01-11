# 🔐 Obtener Credenciales Supabase para Scripts

## Paso 1: Acceder al Supabase Dashboard

1. Ve a [https://app.supabase.com](https://app.supabase.com)
2. Inicia sesión con tu cuenta
3. Selecciona tu proyecto **Buynt**

---

## Paso 2: Obtener SUPABASE_URL

1. En el dashboard, ve a **Settings** → **API**
2. Copia el campo **Project URL**
   - Se ve así: `https://xxxxx.supabase.co`
3. Guarda este valor

---

## Paso 3: Obtener SUPABASE_SERVICE_ROLE_KEY ⚠️

**⚠️ IMPORTANTE**: Esta clave tiene permisos ELEVADOS. Guárdala en `.env.local` (NUNCA en GitHub)

### Pasos:

1. En **Settings** → **API**
2. Busca la sección **Service Role Secret**
3. Copia la clave (es larga, empieza con `eyJh...`)

### ⚠️ SEGURIDAD:

- **NUNCA** la commits a GitHub
- **NUNCA** la publiques en Slack/email
- Úsala solo localmente en `.env.local`
- Si la expones accidentalmente, regenera en Supabase Dashboard

---

## Paso 4: Configurar Variables Locales

### Opción A: Archivo `.env.local` (RECOMENDADO)

Crea un archivo `.env.local` en la raíz del proyecto:

```bash
# .env.local (NO COMMITS)
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...muylargakey...
```

Asegúrate de que `.env.local` está en `.gitignore`:

```bash
# .gitignore
.env.local
.env*.local
```

### Opción B: Variables de Entorno del Sistema (Temporal)

**Windows PowerShell:**

```powershell
$env:SUPABASE_URL="https://xxxxx.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="eyJhbGc..."
```

**Linux/Mac:**

```bash
export SUPABASE_URL="https://xxxxx.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="eyJhbGc..."
```

---

## Paso 5: Verificar Configuración

Ejecuta el script de diagnóstico para verificar que está bien:

```bash
npm run diagnose:demos
```

### Esperado:

- ✅ Si las credenciales son correctas: Mostrará una lista de items
- ❌ Si falla: Verifica URL y Service Role Key

---

## ⚠️ Checklist de Seguridad

- [ ] `.env.local` está en `.gitignore`
- [ ] No expusiste la Service Role Key en Slack/email
- [ ] Estás usando la key del proyecto correcto (Buynt, no otro)
- [ ] La key comienza con `eyJh...` (formato JWT)
- [ ] Ejecutas comandos desde máquina de desarrollo (no servidor)

---

## 🔄 Si Regeneras la Key

Si expones la key accidentalmente:

1. Ve a **Settings** → **API**
2. En **Service Role Secret**, haz clic en **Regenerate**
3. Copia la nueva clave
4. Actualiza `.env.local`
5. La clave antigua deja de funcionar al instante

---

## 📝 Resumen

```
1. Obtén SUPABASE_URL de Settings → API
2. Obtén SUPABASE_SERVICE_ROLE_KEY de Settings → API
3. Crea .env.local con ambas variables
4. Ejecuta: npm run diagnose:demos
5. Si funciona, usa: npm run fix:demo-images
```

---

**Próximo paso**: Lee `/scripts/README.md` para instrucciones de ejecución
