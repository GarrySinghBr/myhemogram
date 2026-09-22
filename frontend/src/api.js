const BASE = "/api";

async function handle(res) {
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      // ignore
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
