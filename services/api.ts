/** API base: empty string uses same origin (Vite dev proxy → backend). */
export function getApiBase(): string {
  const raw = import.meta.env.VITE_API_URL as string | undefined;
  return raw ? raw.replace(/\/$/, '') : '';
}

export async function apiFetch<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const url = `${getApiBase()}${path.startsWith('/') ? path : `/${path}`}`;
  
  let token: string | null = null;
  try {
    const { getAuth } = await import('firebase/auth');
    const auth = getAuth();
    if (auth.currentUser) {
      token = await auth.currentUser.getIdToken();
    }
  } catch (e) {
    console.error('Error fetching Firebase ID token:', e);
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    ...init,
    headers,
  });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      if (!res.ok) throw new Error(text.slice(0, 240));
    }
  }
  if (!res.ok) {
    const msg = (data && typeof data === 'object' && data && 'error' in data && typeof (data as { error: unknown }).error === 'string')
      ? (data as { error: string }).error
      : res.statusText;
    throw new Error(msg || `Request failed: ${res.status}`);
  }
  return data as T;
}
