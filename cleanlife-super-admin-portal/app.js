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

function initDashboard() {
  showView('dashboard-view');
  showTab('overview');
  loadOverview();

  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.onclick = () => {
      showTab(btn.dataset.tab);
      if (btn.dataset.tab === 'overview') loadOverview();
      if (btn.dataset.tab === 'companies') loadCompanies();
    };
  });

  document.getElementById('add-company').onclick = addCompany;
  document.getElementById('refresh-companies').onclick = loadCompanies;
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