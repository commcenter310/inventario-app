# 🚀 Guía de Deploy — Inventario Oficina

## Tiempo estimado: ~45 minutos

---

## PASO 1: Configurar Supabase (15 min)

### 1.1 Crear cuenta y proyecto
1. Ir a [supabase.com](https://supabase.com) → **Start for free**
2. Crear cuenta con Google o email
3. Click **New Project**
   - Organization: (la que crea por defecto)
   - Name: `inventario-oficina`
   - Database Password: guarda esto en un lugar seguro
   - Region: South America (São Paulo) → más rápido desde México
4. Esperar ~2 minutos a que el proyecto se inicialice

### 1.2 Ejecutar el schema SQL
1. En el panel izquierdo: **SQL Editor**
2. Click **+ New query**
3. Copiar y pegar TODO el contenido de `supabase_schema.sql`
4. Click **Run** (o Ctrl+Enter)
5. Verifica que no haya errores (deben salir líneas verdes)

### 1.3 Crear el primer usuario Admin
1. Panel izquierdo: **Authentication** → **Users**
2. Click **Invite user**
3. Pon tu email y contraseña
4. Acepta el email de confirmación que llegará
5. Una vez confirmado, vuelve a **Authentication > Users** y copia el UUID del usuario
6. Vuelve a **SQL Editor** y ejecuta:
   ```sql
   INSERT INTO public.usuarios (id, email, nombre, rol)
   VALUES ('PEGA-EL-UUID-AQUI', 'tu@email.com', 'Tu Nombre', 'admin');
   ```

### 1.4 Obtener las credenciales
1. Panel izquierdo: **Settings** → **API**
2. Copiar:
   - **Project URL** (algo como `https://abcxyz.supabase.co`)
   - **anon / public** key (clave larga)
3. Guárdalas, las necesitarás en los siguientes pasos

---

## PASO 2: Preparar el proyecto en tu computadora (10 min)

### 2.1 Tener Node.js instalado
- Verificar: abre terminal y escribe `node -v`
- Si no aparece nada, descargar de [nodejs.org](https://nodejs.org) (versión LTS)

### 2.2 Descargar el proyecto
1. Guarda la carpeta `inventario-app` (que te dio Cowork) en un lugar de tu computadora, por ejemplo `C:\proyectos\inventario-app`

### 2.3 Crear el archivo de variables de entorno
1. Dentro de la carpeta `inventario-app`, crea un archivo llamado exactamente `.env.local`
2. Pega esto (con TUS datos de Supabase):
   ```
   REACT_APP_SUPABASE_URL=https://TU-PROYECTO.supabase.co
   REACT_APP_SUPABASE_ANON_KEY=tu-clave-anon-aqui
   ```

### 2.4 Instalar dependencias y probar local
Abre terminal en la carpeta del proyecto:
```bash
npm install
npm start
```
Se abrirá el navegador en `http://localhost:3000`. Prueba hacer login con el usuario admin que creaste.

---

## PASO 3: Subir a GitHub (5 min)

### 3.1 Crear repositorio
1. Ir a [github.com](https://github.com) → **New repository**
2. Name: `inventario-app`
3. Private (recomendado)
4. **NO** agregar README ni .gitignore (ya viene en el proyecto)
5. Click **Create repository**

### 3.2 Subir el código
En la terminal dentro de la carpeta del proyecto:
```bash
git init
git add .
git commit -m "Inventario app inicial"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/inventario-app.git
git push -u origin main
```

> ⚠️ Asegúrate de que el archivo `.env.local` NO esté en el commit. El `.gitignore` de create-react-app ya lo excluye por defecto.

---

## PASO 4: Deploy en Vercel (10 min)

### 4.1 Crear cuenta Vercel
1. Ir a [vercel.com](https://vercel.com) → **Start Deploying**
2. Registrarse con GitHub (recomendado, más fácil)

### 4.2 Importar el proyecto
1. En Vercel dashboard: **Add New... → Project**
2. Seleccionar tu repositorio `inventario-app`
3. Click **Import**

### 4.3 Configurar variables de entorno (IMPORTANTE)
Antes de darle Deploy, en la sección **Environment Variables**:
- Variable 1:
  - Name: `REACT_APP_SUPABASE_URL`
  - Value: `https://TU-PROYECTO.supabase.co`
- Variable 2:
  - Name: `REACT_APP_SUPABASE_ANON_KEY`
  - Value: tu clave anon

### 4.4 Deploy
1. Click **Deploy**
2. Esperar ~2-3 minutos
3. Vercel te da una URL como `https://inventario-app-abc123.vercel.app`
4. ¡Tu app está en línea!

---

## PASO 5: Uso desde celular (2 min)

La URL de Vercel funciona en cualquier navegador de celular.
- Safari en iPhone: funciona perfectamente
- Chrome en Android: funciona perfectamente
- Para el escáner QR, el celular pedirá permiso de cámara → **Permitir**

### Tip: agregar al Home Screen
- iPhone: Safari → Compartir → "Agregar a pantalla de inicio"
- Android: Chrome → menú → "Agregar a pantalla de inicio"
Así se ve como una app nativa.

---

## PASO 6: Crear usuarios operarios

1. Inicia sesión como admin
2. Ve a **Usuarios** en el menú
3. Click **+ Nuevo Usuario**
4. Llena nombre, email, contraseña temporal y rol (operario)
5. El usuario recibirá un correo de Supabase para confirmar su cuenta
6. Después de confirmar, podrá iniciar sesión

---

## ✅ Checklist final

- [ ] Schema SQL ejecutado sin errores en Supabase
- [ ] Usuario admin creado e insertado en tabla `usuarios`
- [ ] `.env.local` con credenciales correctas
- [ ] `npm start` funciona local sin errores
- [ ] Código subido a GitHub
- [ ] Variables de entorno configuradas en Vercel
- [ ] Deploy exitoso en Vercel
- [ ] Login desde celular funciona
- [ ] Escaneo QR funciona (crea un item de prueba primero)

---

## ❓ Problemas comunes

**"Error: missing env variables"**
→ Revisa que el archivo se llame exactamente `.env.local` y que las variables empiecen con `REACT_APP_`

**"Invalid credentials" al hacer login**
→ Confirma que el email fue verificado (revisa el correo de Supabase)

**"Item not found" al escanear**
→ El QR que estás escaneando no está en la base de datos. Usa la app para crear items primero, luego imprime los QRs desde el panel admin.

**La cámara no abre en celular**
→ La app DEBE estar servida por HTTPS para acceder a la cámara. En localhost funciona por excepción; en producción (Vercel) siempre es HTTPS, así que debería funcionar.

**Vercel da error de build**
→ Verifica que las variables de entorno estén configuradas en Vercel y redeploya.
