// Small fetch wrapper used by every page: sends JSON, attaches the JWT, and turns errors into readable messages.
export async function api(path, { method = 'GET', body } = {}) {
  const token = localStorage.getItem('token');

  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({})); // empty body if the backend is down
  if (!res.ok) {
    throw new Error(data.message || `Request failed (${res.status}). Is the backend running on port 5000?`);
  }
  return data;
}
