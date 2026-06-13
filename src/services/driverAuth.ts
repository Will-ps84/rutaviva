import { supabase } from '@/integrations/supabase/client';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const DRIVER_SESSION_KEY = 'rutaviva_driver_session';

export interface DriverSession {
  access_token: string;
  refresh_token: string;
  user_id: string;
  company_id: string;
  expires_at: number;
}

export function saveDriverSession(session: DriverSession) {
  localStorage.setItem(DRIVER_SESSION_KEY, JSON.stringify(session));
}

export function getDriverSession(): DriverSession | null {
  const raw = localStorage.getItem(DRIVER_SESSION_KEY);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as DriverSession;
    if (session.expires_at && session.expires_at * 1000 < Date.now()) {
      clearDriverSession();
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function clearDriverSession() {
  localStorage.removeItem(DRIVER_SESSION_KEY);
}

export async function driverLogin(phone: string, password: string): Promise<DriverSession> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/driver-login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
    body: JSON.stringify({ phone, password }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error de autenticación');

  const session: DriverSession = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    user_id: data.user_id,
    company_id: data.company_id,
    expires_at: data.expires_at,
  };

  // Set session in Supabase client so RLS works
  await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });

  saveDriverSession(session);
  return session;
}

export async function activateDriver(phone: string, code: string, new_password: string): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/activate-driver`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
    body: JSON.stringify({ phone, code, new_password }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error al activar cuenta');
}

export async function createDriverApi(token: string, full_name: string, phone: string) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/create-driver`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ full_name, phone }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error al crear conductor');
  return data as { driver_user_id: string; code: string; expires_at: string };
}

export async function driverLogout() {
  clearDriverSession();
  await supabase.auth.signOut();
}
