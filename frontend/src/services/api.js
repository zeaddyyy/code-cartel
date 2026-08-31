const API = import.meta.env.VITE_API_URL || `http://${window.location.hostname || "localhost"}:5001`;
export async function getJson(path, options = {}) { const response = await fetch(`${API}${path}`, options); if (!response.ok) { const error = new Error(response.status === 401 ? "Unauthorized" : response.status === 503 ? "Service unavailable" : `Request failed (${response.status})`); error.status = response.status; throw error; } return response.json(); }
export { API };
