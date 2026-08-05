const API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  "http://127.0.0.1:3000";

async function request(path, options = {}) {
  const tokenHeader = options.token
    ? { Authorization: `Bearer ${options.token}` }
    : {};

  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...tokenHeader,
      ...(options.headers || {})
    },
    method: options.method,
    body: options.body
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = data?.message || data?.error || "Request failed";
    throw new Error(message);
  }

  return data;
}

export const api = {
  registerClient(payload) {
    return request("/clients/register", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  loginClient(payload) {
    return request("/auth/client/login", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  createPickup(payload, token) {
    return request("/pickup-requests", {
      method: "POST",
      token,
      body: JSON.stringify(payload)
    });
  },
  getPickup(id, token) {
    return request(`/pickup-requests/${id}`, { token });
  },
  listMyPickups(token) {
    return request("/pickup-requests/mine", { token });
  }
};

export { API_URL };
