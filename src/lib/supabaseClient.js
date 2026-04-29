import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Faltan variables de entorno de Supabase. Crea un archivo .env.local con REACT_APP_SUPABASE_URL y REACT_APP_SUPABASE_ANON_KEY');
}

// Lock no-op: bypass del Web Lock de Supabase que se cuelga cuando hay
// tabs huérfanas o crashes previos. Para apps single-tab esto es seguro.
const noopLock = async (_name, _acquireTimeout, fn) => fn();

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    lock: noopLock,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
