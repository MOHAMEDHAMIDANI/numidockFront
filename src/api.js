const BASE = 'http://localhost:8000/api';

function getToken() {
  return localStorage.getItem('numidock_token');
}

function setToken(token) {
  localStorage.setItem('numidock_token', token);
}

function clearToken() {
  localStorage.removeItem('numidock_token');
}

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) clearToken();
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

async function login(email, password) {
  const data = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setToken(data.token);
  return data.user;
}

async function uploadExcel(date, file) {
  const token = getToken();
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${BASE}/import/${date}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData, // no Content-Type — browser sets it for multipart
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Upload failed (${res.status})`);
  return data;
}

async function gateLookup(date, reference) {
  return request(`/gate/lookup/${date}/${encodeURIComponent(reference)}`);
}

async function gateCheckIn(appointmentId, arrivedAtMin, vehiclePlate) {
  return request('/gate/check-in', {
    method: 'POST',
    body: JSON.stringify({ appointment_id: appointmentId, arrived_at_min: arrivedAtMin, vehicle_plate: vehiclePlate }),
  });
}


async function acdcTransition(taskId, to) {
  return request(`/acdc/tasks/${taskId}/transition`, {
    method: 'POST',
    body: JSON.stringify({ to }),
  });
}
async function acdcTasks(scope = 'active') {
  return request(`/acdc/tasks?scope=${scope}`);
}


async function driverLookup(reference, date) {
  const res = await fetch(`${BASE}/driver/lookup?reference=${encodeURIComponent(reference)}&date=${date}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Not found');
  return data;
}

async function driverReportDelay(reference, date, delayMinutes) {
  const res = await fetch(`${BASE}/driver/report-delay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reference, date, delay_minutes: delayMinutes }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Failed');
  return data;
}
async function gateDay(date) {
  return request(`/gate/day/${date}`);
}
async function gateLaunchAcdc(appointmentId) {
  return request('/acdc/create', { method: 'POST', body: JSON.stringify({ appointment_id: appointmentId }) });
}

async function getParameters() { return request('/parameters/active'); }
async function saveParameters(body) { return request('/parameters', { method: 'POST', body: JSON.stringify(body) }); }

async function getScheduleMeta(date) { return request(`/schedules/${date}/meta`); }
async function getScheduleUnscheduled(date) { return request(`/schedules/${date}/unscheduled`); }
async function generateSchedule(date) { return request(`/schedules/generate/${date}`, { method: 'POST' }); }
async function getSchedule(date) { return request(`/schedules/${date}`); }
async function approveSchedule(date) { return request(`/schedules/${date}/approve`, { method: 'POST' }); }
async function publishSchedule(date) { return request(`/schedules/${date}/publish`, { method: 'POST' }); }
async function updateAppointment(date, id, body) {
  return request(`/schedules/${date}/appointments/${id}`, { method: 'PUT', body: JSON.stringify(body) });
}
async function reoptimizeSchedule(date) { return request(`/schedules/${date}/reoptimize`, { method: 'POST' }); }

async function gateWaiting(id) { return request(`/gate/${id}/waiting`, { method: 'POST' }); }
async function gateAdmit(id) { return request(`/gate/${id}/admit`, { method: 'POST' }); }
async function gateDepart(id) { return request(`/gate/${id}/depart`, { method: 'POST' }); }
async function prepStart(id) { return request(`/preparation/${id}/start`, { method: 'POST' }); }
async function prepReady(id) { return request(`/preparation/${id}/ready`, { method: 'POST' }); }
async function gateServiceDone(id) { return request(`/gate/${id}/service-done`, { method: 'POST' }); }
async function gateReleaseDock(id) { return request(`/gate/${id}/release-dock`, { method: 'POST' }); }

// ── Storage ────────────────────────────────────────────────────────────────
async function getStorageKpis() { return request('/storage/kpis'); }
async function listPallets(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return request(`/storage/pallets${qs ? '?' + qs : ''}`);
}
async function createPallet(body) { return request('/storage/pallets', { method: 'POST', body: JSON.stringify(body) }); }
async function updatePallet(id, body) { return request(`/storage/pallets/${id}`, { method: 'PUT', body: JSON.stringify(body) }); }
async function deletePallet(id) { return request(`/storage/pallets/${id}`, { method: 'DELETE' }); }
async function getStorageZones() { return request('/storage/zones'); }
async function getStorageWarehouses() { return request('/storage/warehouses'); }
async function importStorage(file) {
  const token = getToken();
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${BASE}/storage/import`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Import failed (${res.status})`);
  return data;
}
async function exportStorage(params = {}) {
  const token = getToken();
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${BASE}/storage/export${qs ? '?' + qs : ''}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Export failed (${res.status})`);
  }
  const blob = await res.blob();
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `stock-${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
async function getStorageMatrix() { return request('/storage/matrix'); }
async function getZonesList() { return request('/storage/zones-list'); }
async function updateZoneStatus(id, status) { return request(`/storage/zones/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }); }
async function storageTransfer(body) { return request('/storage/transfer', { method: 'POST', body: JSON.stringify(body) }); }
async function moveToPrepZone(id, body = {}) { return request(`/storage/pallets/${id}/move-to-prep`, { method: 'POST', body: JSON.stringify(body) }); }
async function allocatePallet(body) { return request('/storage/pallets/allocate', { method: 'POST', body: JSON.stringify(body) }); }

// ── ACDC history ──────────────────────────────────────────────────────────
async function getAcdcHistory() { return request('/acdc/history'); }

// ── Demo seed ─────────────────────────────────────────────────────────────
async function seedDemo() { return request('/demo/seed', { method: 'POST' }); }

// ── Dashboard aggregate ────────────────────────────────────────────────────
async function getDashboardData(date) {
  const tomorrow = (() => { const d = new Date(date); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); })();
  const [gate, acdc, meta, tMeta, params, stor, hist] = await Promise.allSettled([
    request(`/gate/day/${date}`),
    request('/acdc/kpis'),
    request(`/schedules/${date}/meta`),
    request(`/schedules/${tomorrow}/meta`),
    request('/parameters/active'),
    request('/storage/kpis'),
    request('/acdc/history'),
  ]);
  return {
    gate:        gate.status    === 'fulfilled' ? gate.value    : null,
    acdc:        acdc.status    === 'fulfilled' ? acdc.value    : null,
    meta:        meta.status    === 'fulfilled' ? meta.value    : null,
    tomorrowMeta:tMeta.status   === 'fulfilled' ? tMeta.value   : null,
    params:      params.status  === 'fulfilled' ? params.value  : null,
    storage:     stor.status    === 'fulfilled' ? stor.value    : null,
    history:     hist.status    === 'fulfilled' ? hist.value    : null,
    tomorrow,
  };
}

// ── User Management ────────────────────────────────────────────────────────
async function listUsers(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return request(`/users${qs ? '?' + qs : ''}`);
}
async function createUser(body) {
  return request('/users', { method: 'POST', body: JSON.stringify(body) });
}
async function updateUser(id, body) {
  return request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(body) });
}
async function changeUserPassword(id, password) {
  return request(`/users/${id}/password`, { method: 'PUT', body: JSON.stringify({ password }) });
}
async function deleteUser(id, permanent = false) {
  return request(`/users/${id}${permanent ? '?permanent=true' : ''}`, { method: 'DELETE' });
}

export { getAcdcHistory, seedDemo, getParameters, saveParameters, gateServiceDone, gateReleaseDock, prepReady, prepStart, gateWaiting, gateAdmit, gateDepart, gateLaunchAcdc, request, login, getToken, setToken, clearToken, uploadExcel, gateLookup, gateCheckIn, acdcTasks, acdcTransition, driverLookup, driverReportDelay, gateDay, getScheduleMeta, getScheduleUnscheduled, generateSchedule, getSchedule, approveSchedule, publishSchedule, updateAppointment, reoptimizeSchedule, listUsers, createUser, updateUser, changeUserPassword, deleteUser, getStorageKpis, listPallets, createPallet, updatePallet, deletePallet, getStorageZones, getStorageWarehouses, getDashboardData, importStorage, exportStorage, getStorageMatrix, getZonesList, updateZoneStatus, storageTransfer, moveToPrepZone, allocatePallet };
