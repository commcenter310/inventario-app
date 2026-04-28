-- =====================================================
-- SCHEMA INVENTARIO OFICINA - SUPABASE
-- Ejecuta TODO este script en el SQL Editor de Supabase
-- =====================================================

-- ===== 1. TABLA USUARIOS =====
CREATE TABLE IF NOT EXISTS public.usuarios (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT UNIQUE NOT NULL,
  nombre      TEXT NOT NULL,
  rol         TEXT NOT NULL DEFAULT 'operario' CHECK (rol IN ('admin', 'operario', 'lectura')),
  activo      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===== 2. TABLA ITEMS =====
CREATE TABLE IF NOT EXISTS public.items (
  id                BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  nombre            TEXT NOT NULL,
  categoria         TEXT,
  cantidad          INT NOT NULL DEFAULT 0 CHECK (cantidad >= 0),
  cantidad_minima   INT NOT NULL DEFAULT 5 CHECK (cantidad_minima >= 0),
  ubicacion         TEXT,
  qr_code           TEXT UNIQUE NOT NULL,
  descripcion       TEXT,
  imagen_url        TEXT,
  estado            TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'inactivo')),
  valor_aproximado  DECIMAL(10,2),
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===== 3. TABLA MOVIMIENTOS =====
CREATE TABLE IF NOT EXISTS public.movimientos (
  id              BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  item_id         BIGINT NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  usuario_id      UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  tipo            TEXT NOT NULL CHECK (tipo IN ('salida', 'entrada', 'ajuste')),
  cantidad        INT NOT NULL CHECK (cantidad > 0),
  firma_digital   TEXT,   -- base64 del canvas
  notas           TEXT,
  ip_dispositivo  TEXT,
  timestamp       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===== 4. TABLA ALERTAS =====
CREATE TABLE IF NOT EXISTS public.alertas (
  id                 BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  item_id            BIGINT REFERENCES public.items(id) ON DELETE CASCADE,
  usuario_admin_id   UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  mensaje            TEXT NOT NULL,
  leida              BOOLEAN NOT NULL DEFAULT false,
  created_at         TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===== 5. ÍNDICES =====
CREATE INDEX IF NOT EXISTS idx_items_qr       ON public.items(qr_code);
CREATE INDEX IF NOT EXISTS idx_items_estado   ON public.items(estado);
CREATE INDEX IF NOT EXISTS idx_mov_item       ON public.movimientos(item_id);
CREATE INDEX IF NOT EXISTS idx_mov_usuario    ON public.movimientos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_mov_fecha      ON public.movimientos(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_alertas_leida  ON public.alertas(leida);

-- ===== 6. TRIGGER: updated_at en items =====
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_items_updated_at
  BEFORE UPDATE ON public.items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== 7. ROW LEVEL SECURITY =====
ALTER TABLE public.usuarios    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alertas     ENABLE ROW LEVEL SECURITY;

-- Función helper: obtener rol del usuario actual
CREATE OR REPLACE FUNCTION public.get_my_rol()
RETURNS TEXT AS $$
  SELECT rol FROM public.usuarios WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Políticas USUARIOS
CREATE POLICY "usuarios: leer los activos" ON public.usuarios
  FOR SELECT USING (activo = true AND auth.role() = 'authenticated');

CREATE POLICY "usuarios: admin puede todo" ON public.usuarios
  FOR ALL USING (public.get_my_rol() = 'admin');

-- Políticas ITEMS
CREATE POLICY "items: todos los autenticados pueden leer" ON public.items
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "items: solo admin puede insertar/actualizar/borrar" ON public.items
  FOR ALL USING (public.get_my_rol() = 'admin');

-- Políticas MOVIMIENTOS
CREATE POLICY "movimientos: cada usuario ve los suyos" ON public.movimientos
  FOR SELECT USING (
    usuario_id = auth.uid() OR public.get_my_rol() = 'admin'
  );

CREATE POLICY "movimientos: operario y admin pueden insertar" ON public.movimientos
  FOR INSERT WITH CHECK (
    public.get_my_rol() IN ('admin', 'operario')
  );

-- Políticas ALERTAS
CREATE POLICY "alertas: admin puede todo" ON public.alertas
  FOR ALL USING (public.get_my_rol() = 'admin');

CREATE POLICY "alertas: todos pueden leer" ON public.alertas
  FOR SELECT USING (auth.role() = 'authenticated');

-- ===== 8. FUNCIÓN ATÓMICA PARA AJUSTE DE STOCK =====
-- Ejecuta el ajuste de stock, registro de movimiento y alerta en una sola transacción.
-- Elimina race conditions cuando dos operaciones ocurren al mismo tiempo.
-- Uso desde el cliente: supabase.rpc('ajustar_stock', { p_item_id, p_usuario_id, p_tipo, p_cantidad, p_firma, p_notas })
CREATE OR REPLACE FUNCTION public.ajustar_stock(
  p_item_id    BIGINT,
  p_usuario_id UUID,
  p_tipo       TEXT,
  p_cantidad   INT,
  p_firma      TEXT DEFAULT NULL,
  p_notas      TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item          public.items%ROWTYPE;
  v_nueva_cantidad INT;
  v_mov_id        BIGINT;
BEGIN
  -- Bloquear la fila para evitar modificaciones concurrentes
  SELECT * INTO v_item FROM public.items WHERE id = p_item_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item % no encontrado', p_item_id;
  END IF;

  IF v_item.estado = 'inactivo' THEN
    RAISE EXCEPTION 'El item "%" está inactivo', v_item.nombre;
  END IF;

  v_nueva_cantidad := CASE p_tipo
    WHEN 'salida'  THEN v_item.cantidad - p_cantidad
    ELSE                v_item.cantidad + p_cantidad
  END;

  IF v_nueva_cantidad < 0 THEN
    RAISE EXCEPTION 'Stock insuficiente: "%" solo tiene % unidades', v_item.nombre, v_item.cantidad;
  END IF;

  UPDATE public.items SET cantidad = v_nueva_cantidad WHERE id = p_item_id;

  INSERT INTO public.movimientos (item_id, usuario_id, tipo, cantidad, firma_digital, notas)
  VALUES (p_item_id, p_usuario_id, p_tipo, p_cantidad, p_firma, p_notas)
  RETURNING id INTO v_mov_id;

  IF v_nueva_cantidad <= v_item.cantidad_minima THEN
    INSERT INTO public.alertas (item_id, mensaje)
    VALUES (p_item_id,
      'Stock bajo: "' || v_item.nombre || '" tiene solo ' || v_nueva_cantidad ||
      ' unidades (mínimo: ' || v_item.cantidad_minima || ')');
  END IF;

  RETURN json_build_object(
    'movimiento_id',   v_mov_id,
    'nueva_cantidad',  v_nueva_cantidad
  );
END;
$$;

-- ===== 9. PRIMER USUARIO ADMIN =====
-- IMPORTANTE: Primero crea tu cuenta en Supabase Auth (Authentication > Users > Invite)
-- Luego ejecuta esto con el UUID del usuario creado:
--
-- INSERT INTO public.usuarios (id, email, nombre, rol)
-- VALUES ('UUID-DEL-USUARIO-AQUI', 'tu@email.com', 'Tu Nombre', 'admin');
