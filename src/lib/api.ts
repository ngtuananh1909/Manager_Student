const ACCESS_TOKEN_KEY = 'schooljudge_access_token';
const AUTH_CHANGED_EVENT = 'schooljudge-auth-changed';

function storage(): Storage | null {
  return typeof sessionStorage === 'undefined' ? null : sessionStorage;
}

export function getAccessToken(): string | null {
  return storage()?.getItem(ACCESS_TOKEN_KEY) || null;
}

export function setAccessToken(token: string): void {
  storage()?.setItem(ACCESS_TOKEN_KEY, token);
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export function clearAccessToken(): void {
  storage()?.removeItem(ACCESS_TOKEN_KEY);
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const inheritedHeaders = typeof Request !== 'undefined' && input instanceof Request
    ? input.headers
    : undefined;
  const headers = new Headers(inheritedHeaders);
  new Headers(init.headers).forEach((value, key) => headers.set(key, value));

  const accessToken = getAccessToken();
  if (accessToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const response = await fetch(input, { ...init, headers });
  if (response.status === 401 && accessToken) clearAccessToken();
  return response;
}

export async function downloadAuthenticatedFile(url: string, fileName: string): Promise<void> {
  const response = await apiFetch(url);
  if (!response.ok) throw new Error(`Không thể tải file (HTTP ${response.status})`);
  const objectUrl = URL.createObjectURL(await response.blob());
  try {
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export { ACCESS_TOKEN_KEY, AUTH_CHANGED_EVENT };
