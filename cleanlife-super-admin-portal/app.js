const state = { apiBase: '', token: '' };

function saveSession() { sessionStorage.setItem('cl_superadmin_session', JSON.stringify(state)); }
function loadSession() {
  const raw = sessionStorage.getItem('cl_superadmin_session');
  if (!raw) return false;
  Object.assign(state, JSON.parse(raw));
  return !!(state.apiBase && state.token);
}

async function apiFetch(path, options = {}) {
  const res = await fetch(`${state.apiBase}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${state.token}`,
      ...(options.headers || {}),
    },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error || `Request failed (${res.status})`);
  return body;
}

function showView(id) {
  document.querySelectorAll('.view').forEach((v) => v.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

function showTab(name) {
  document.querySelectorAll('.tab-panel').forEach((p) => p.classList.add('hidden'));
  document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
  document.getElementById(`tab-${name}`).classList.remove('hidden');
  document.querySelector(`.tab-btn[data-tab="${name}"]`).classList.add('active');
}

async function loadOverview() {
  const row = document.getElementById('stats-row');
  row.innerHTML = '<p>Loading...</p>';
  try {
    const stats = await apiFetch('/admin/overview');
    row.innerHTML = `
      <div class="stat-card"><div class="stat-value">${stats.companies}</div><div class="stat-label">Companies</div></div>
      <div class="stat-card"><div class="stat-value">${stats.collectors}</div><div class="stat-label">Collectors</div></div>
      <div class="stat-card"><div class="stat-value">${stats.clients}</div><div class="stat-label">Clients</div></div>
      <div class="stat-card"><div class="stat-value">${stats.pickup_requests}</div><div class="stat-label">Pickup requests</div></div>
    `;
  } catch (err) {
    row.innerHTML = `<p>Error: ${err.message}</p>`;
  }
}

async function loadCompanies() {
  const tbody = document.querySelector('#companies-table tbody');
  tbody.innerHTML = '<tr><td colspan="5">Loading...</td></tr>';
  try {
    const rows = await apiFetch('/admin/companies');
    tbody.innerHTML = '';
    if (rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5">No companies yet.</td></tr>';
      return;
    }
    for (const c of rows) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${c.id}</td><td>${c.company_name}</td><td>${c.company_code}</td><td>${c.subscription_tier}</td><td></td>`;
      const cell = tr.lastElementChild;
      const btn = document.createElement('button');
      btn.className = 'grant-btn';
      btn.textContent = 'Create admin account';
      btn.onclick = () => grantPortalAccess(c.id, c.company_name);
      cell.appendChild(btn);
      tbody.appendChild(tr);
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5">Error: ${err.message}</td></tr>`;
  }
}

async function grantPortalAccess(companyId, companyName) {
  const username = prompt(`Admin username for ${companyName}:`);
  if (!username) return;
  const password = prompt(`Admin password (min 8 chars) for ${companyName}:`);
  if (!password) return;
  try {
    await apiFetch(`/admin/companies/${companyId}/admins`, {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    alert(`Company admin created.\nGive these credentials to ${companyName}:\nUsername: ${username}\nPassword: ${password}\nThey log in at the Company Admin portal.`);
  } catch (err) {
    alert(`Failed to create admin: ${err.message}`);
  }
}

async function addCompany() {
  const company_name = document.getElementById('co-name').value.trim();
  const company_code = document.getElementById('co-code').value.trim();
  const subscription_tier = document.getElementById('co-tier').value;
  if (!company_name || !company_code) return alert('Enter company name and code.');
  try {
    await apiFetch('/admin/companies', { method: 'POST', body: JSON.stringify({ company_name, company_code, subscription_tier }) });
    document.getElementById('co-name').value = '';
    document.getElementById('co-code').value = '';
    await loadCompanies();
  } catch (err) {
    alert(`Failed to add company: ${err.message}`);
  }
}

// ============ REPORTS ============
function reportFilterQuery() {
  const params = new URLSearchParams();
  const neighborhood = document.getElementById('rpt-neighborhood').value.trim();
  const status = document.getElementById('rpt-status').value;
  const dateFrom = document.getElementById('rpt-date-from').value;
  const dateTo = document.getElementById('rpt-date-to').value;
  if (neighborhood) params.set('neighborhood', neighborhood);
  if (status) params.set('status', status);
  if (dateFrom) params.set('date_from', dateFrom);
  if (dateTo) params.set('date_to', dateTo);
  return params.toString();
}

function statusPillHtml(status) {
  return `<span class="status-pill status-${status}">${status}</span>`;
}

function neighborhoodCellHtml(report) {
  const label = report.neighborhood || '—';
  return `<span class="neighborhood-cell">${label}<span class="tag-link" data-report-id="${report.id}">edit</span></span>`;
}

function reportActionsHtml(report) {
  const toggleLabel = report.review_status === 'resolved' ? 'Reopen' : 'Resolve';
  const toggleClass = report.review_status === 'resolved' ? 'reopen-btn' : 'resolve-btn';
  const toggleTo = report.review_status === 'resolved' ? 'open' : 'resolved';
  return `
    <button class="action-btn ${toggleClass}" data-action="toggle-status" data-report-id="${report.id}" data-to="${toggleTo}">${toggleLabel}</button>
    <button class="action-btn merge-btn" data-action="merge" data-dumpster-id="${report.dumpster_id ?? ''}">Merge</button>
  `;
}

async function toggleReportStatus(reportId, toStatus) {
  try {
    await apiFetch(`/admin/reports/${reportId}/status`, { method: 'POST', body: JSON.stringify({ status: toStatus }) });
    await loadReports();
  } catch (err) {
    alert(`Failed to update status: ${err.message}`);
  }
}

async function tagNeighborhood(reportId) {
  const neighborhood = prompt('Neighborhood for this report:');
  if (!neighborhood) return;
  try {
    await apiFetch(`/admin/reports/${reportId}/neighborhood`, { method: 'POST', body: JSON.stringify({ neighborhood }) });
    await loadReports();
  } catch (err) {
    alert(`Failed to tag neighborhood: ${err.message}`);
  }
}

async function mergeBin(duplicateDumpsterId) {
  if (!duplicateDumpsterId) return alert('This report has no associated bin to merge.');
  const primaryIdRaw = prompt(`Merge bin #${duplicateDumpsterId} into which bin ID? (the OTHER, correct entry for the same physical bin)`);
  if (!primaryIdRaw) return;
  const primaryId = Number(primaryIdRaw);
  if (!Number.isInteger(primaryId) || primaryId <= 0) return alert('Enter a valid bin ID.');
  try {
    const result = await apiFetch(`/admin/reports/bins/${duplicateDumpsterId}/merge`, {
      method: 'POST',
      body: JSON.stringify({ primary_dumpster_id: primaryId }),
    });
    alert(`Merged. ${result.reports_moved} report(s) moved to bin #${result.primary_id}.`);
    await loadReports();
  } catch (err) {
    alert(`Failed to merge: ${err.message}`);
  }
}

function wireReportRowActions(tbody) {
  tbody.querySelectorAll('[data-action="toggle-status"]').forEach((btn) => {
    btn.onclick = () => toggleReportStatus(btn.dataset.reportId, btn.dataset.to);
  });
  tbody.querySelectorAll('[data-action="merge"]').forEach((btn) => {
    btn.onclick = () => mergeBin(btn.dataset.dumpsterId ? Number(btn.dataset.dumpsterId) : null);
  });
  tbody.querySelectorAll('.tag-link').forEach((link) => {
    link.onclick = () => tagNeighborhood(link.dataset.reportId);
  });
}

async function loadAttributedReports() {
  const tbody = document.querySelector('#attributed-reports-table tbody');
  tbody.innerHTML = '<tr><td colspan="9">Loading...</td></tr>';
  try {
    const rows = await apiFetch(`/admin/reports/attributed?${reportFilterQuery()}`);
    tbody.innerHTML = '';
    if (rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9">No attributed reports match these filters.</td></tr>';
      return;
    }
    for (const r of rows) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${r.id}</td>
        <td>${r.dumpster_id ?? '—'}</td>
        <td>${r.report_type}</td>
        <td>${r.reporter_name || '—'} (${r.reporter_role})</td>
        <td>${neighborhoodCellHtml(r)}</td>
        <td>${statusPillHtml(r.review_status)}</td>
        <td>${new Date(r.created_at).toLocaleString()}</td>
        <td><a href="${r.photo_url}" target="_blank" rel="noopener">view</a></td>
        <td>${reportActionsHtml(r)}</td>
      `;
      tbody.appendChild(tr);
    }
    wireReportRowActions(tbody);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="9">Error: ${err.message}</td></tr>`;
  }
}

async function loadAnonymousReports() {
  const tbody = document.querySelector('#anonymous-reports-table tbody');
  tbody.innerHTML = '<tr><td colspan="8">Loading...</td></tr>';
  try {
    const rows = await apiFetch(`/admin/reports/anonymous?${reportFilterQuery()}`);
    tbody.innerHTML = '';
    if (rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8">No anonymous reports match these filters.</td></tr>';
      return;
    }
    for (const r of rows) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${r.id}</td>
        <td>${r.dumpster_id ?? '—'}</td>
        <td>${r.report_type}</td>
        <td>${neighborhoodCellHtml(r)}</td>
        <td>${statusPillHtml(r.review_status)}</td>
        <td>${new Date(r.created_at).toLocaleString()}</td>
        <td><a href="${r.photo_url}" target="_blank" rel="noopener">view</a></td>
        <td>${reportActionsHtml(r)}</td>
      `;
      tbody.appendChild(tr);
    }
    wireReportRowActions(tbody);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8">Error: ${err.message}</td></tr>`;
  }
}

async function loadReports() {
  await Promise.all([loadAttributedReports(), loadAnonymousReports()]);
}

// Authenticated CSV download — a plain <a href> can't carry the
// Authorization header, so fetch as a blob and trigger the download via a
// throwaway object URL instead.
async function exportReportsCsv(kind) {
  try {
    const res = await fetch(`${state.apiBase}/admin/reports/${kind}/export?${reportFilterQuery()}`, {
      headers: { Authorization: `Bearer ${state.token}` },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error || `Export failed (${res.status})`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${kind}-bin-reports.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (err) {
    alert(`Export failed: ${err.message}`);
  }
}

function initDashboard() {
  showView('dashboard-view');
  showTab('overview');
  loadOverview();

  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.onclick = () => {
      showTab(btn.dataset.tab);
      if (btn.dataset.tab === 'overview') loadOverview();
      if (btn.dataset.tab === 'companies') loadCompanies();
      if (btn.dataset.tab === 'reports') loadReports();
    };
  });

  document.getElementById('add-company').onclick = addCompany;
  document.getElementById('refresh-companies').onclick = loadCompanies;
  document.getElementById('rpt-apply-filters').onclick = loadReports;
  document.getElementById('rpt-export-attributed').onclick = () => exportReportsCsv('attributed');
  document.getElementById('rpt-export-anonymous').onclick = () => exportReportsCsv('anonymous');
  document.getElementById('logout-btn').onclick = () => {
    sessionStorage.removeItem('cl_superadmin_session');
    showView('login-view');
  };
}

document.getElementById('login-btn').onclick = async () => {
  const apiBase = document.getElementById('api-base').value.trim().replace(/\/$/, '');
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const errorEl = document.getElementById('login-error');
  errorEl.classList.add('hidden');
  if (!apiBase || !username || !password) return alert('Fill in all fields.');

  try {
    const res = await fetch(`${apiBase}/admin-auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Login failed');
    if (body.admin.role !== 'super_admin') throw new Error('This account is not a super_admin.');

    state.apiBase = apiBase;
    state.token = body.token;
    saveSession();
    initDashboard();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.classList.remove('hidden');
  }
};

if (loadSession()) {
  initDashboard();
} else {
  showView('login-view');
}