const base = import.meta.env.VITE_GATEWAY_URL || 'http://localhost:4000/api';

export async function api(path, options = {}) {
  const response = await fetch(base + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer dev-token',
      ...(options.headers || {})
    }
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Request failed');
  return body.data;
}
