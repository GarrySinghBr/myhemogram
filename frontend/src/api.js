// Thin fetch wrappers around the FastAPI backend. Every call resolves to
// parsed JSON (or null for a 204) and rejects with a plain Error whose
// `.message` is the backend's own `detail` string - every page in this app
// just does `.catch((e) => setError(e.message))` and renders that, so a
// good HTTPException(400, "...") message on the backend is what the user
// actually sees on screen.
const BASE = "/api";

async function handle(res) {
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      // Response body wasn't JSON (or was empty) - fall back to statusText.
    }
    throw new Error(detail);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  listReports: () => fetch(`${BASE}/reports`).then(handle),
  getReport: (id) => fetch(`${BASE}/reports/${id}`).then(handle),
  createReport: (payload, uploadToken) =>
    fetch(`${BASE}/reports${uploadToken ? `?upload_token=${uploadToken}` : ""}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(handle),
  updateReport: (id, payload) =>
    fetch(`${BASE}/reports/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(handle),
  deleteReport: (id) => fetch(`${BASE}/reports/${id}`, { method: "DELETE" }).then(handle),
  reportPdfUrl: (id) => `${BASE}/reports/${id}/pdf`,

  parsePdf: (file) => {
    const form = new FormData();
    form.append("file", file);
    return fetch(`${BASE}/reports/parse`, { method: "POST", body: form }).then(handle);
  },

  addResult: (reportId, payload) =>
    fetch(`${BASE}/reports/${reportId}/results`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(handle),
  updateResult: (id, payload) =>
    fetch(`${BASE}/results/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(handle),
  deleteResult: (id) => fetch(`${BASE}/results/${id}`, { method: "DELETE" }).then(handle),

  listAnalytes: () => fetch(`${BASE}/analytes`).then(handle),
  analyteTrend: (name) => fetch(`${BASE}/analytes/${encodeURIComponent(name)}/trend`).then(handle),
  compare: (ids) => fetch(`${BASE}/compare?report_ids=${ids.join(",")}`).then(handle),
};
