const state = { apiBase: '', token: '' };

function saveSession() { sessionStorage.setItem('cl_company_admin_session', JSON.stringify(state)); }
function loadSession() {
  const raw = sessionStorage.getItem('cl_company_admin_session');
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

async function loadCollectors() {
  const tbody = document.querySelector('#collectors-table tbody');
  tbody.innerHTML = '<tr><td colspan="8">Loading...</td></tr>';
  try {
    const rows = await apiFetch('/admin/collectors');
    tbody.innerHTML = '';
    if (rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8">No collectors yet. Create one in the "Create collector" tab.</td></tr>';
      return;
    }
    for (const c of rows) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${c.username}</td>
        <td>${c.full_name || '—'}</td>
        <td>${c.email || '—'}</td>
        <td>${c.phone_number || '—'}</td>
        <td>${c.collector_type}</td>
        <td>${c.subscription_tier || '—'}</td>
        <td>${c.kyc_status}</td>
        <td></td>
      `;
      const actionCell = tr.lastElementChild;
      if (c.kyc_status === 'pending') {
        const approveBtn = document.createElement('button');
        approveBtn.className = 'approve-btn';
        approveBtn.textContent = 'Approve';
        approveBtn.onclick = () => alert('KYC review still uses the legacy admin key — ask your super admin, or use curl with X-Admin-Key.');
        actionCell.appendChild(approveBtn);
      } else {
        actionCell.textContent = '—';
      }
      tbody.appendChild(tr);
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8">Error: ${err.message}</td></tr>`;
  }
}

async function createCollector() {
  const username = document.getElementById('new-username').value.trim();
  const password = document.getElementById('new-password').value;
  const resultEl = document.getElementById('create-result');
  if (!username || password.length < 8) {
    resultEl.textContent = 'Enter a username and a password of at least 8 characters.';
    return;
  }
  try {
    const created = await apiFetch('/collectors/admin-create', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    resultEl.innerHTML = `Created. Give these credentials to the collector:<br><b>Username:</b> ${created.username}<br><b>Password:</b> ${password}`;
    document.getElementById('new-username').value = '';
    document.getElementById('new-password').value = '';
    await loadCollectors();
  } catch (err) {
    resultEl.textContent = `Failed: ${err.message}`;
  }
}

async function loadWalletTab() {
  await Promise.all([loadCompanyBalance(), loadWalletCollectors(), loadCompanyTransactions()]);
}

async function loadCompanyBalance() {
  const el = document.getElementById('company-balance');
  el.textContent = '…';
  try {
    const data = await apiFetch('/admin/payouts/company-balance');
    el.textContent = `${Number(data.balance).toLocaleString()} FCFA`;
  } catch (err) {
    el.textContent = `Error: ${err.message}`;
  }
}

async function loadWalletCollectors() {
  const select = document.getElementById('payout-collector');
  const tbody = document.querySelector('#collector-balances-table tbody');
  tbody.innerHTML = '<tr><td colspan="2">Loading...</td></tr>';
  try {
    const rows = await apiFetch('/admin/collectors');
    select.innerHTML = '';
    tbody.innerHTML = '';
    if (rows.length === 0) {
      select.innerHTML = '<option value="">No collectors yet</option>';
      tbody.innerHTML = '<tr><td colspan="2">No collectors yet.</td></tr>';
      return;
    }
    for (const c of rows) {
      const option = document.createElement('option');
      option.value = c.id;
      option.textContent = c.full_name || c.username;
      select.appendChild(option);

      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${c.full_name || c.username}</td><td>${Number(c.balance).toLocaleString()}</td>`;
      tbody.appendChild(tr);
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="2">Error: ${err.message}</td></tr>`;
  }
}

async function loadCompanyTransactions() {
  const tbody = document.querySelector('#company-transactions-table tbody');
  tbody.innerHTML = '<tr><td colspan="4">Loading...</td></tr>';
  try {
    const rows = await apiFetch('/admin/payouts/company-transactions');
    tbody.innerHTML = '';
    if (rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4">No transactions yet.</td></tr>';
      return;
    }
    for (const tx of rows) {
      const tr = document.createElement('tr');
      const sign = tx.type === 'payout' ? '-' : '+';
      tr.innerHTML = `
        <td>${new Date(tx.created_at).toLocaleString()}</td>
        <td>${tx.type.replace('_', ' ')}</td>
        <td>${sign}${Number(tx.amount).toLocaleString()}</td>
        <td>${tx.description || '—'}</td>
      `;
      tbody.appendChild(tr);
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4">Error: ${err.message}</td></tr>`;
  }
}

async function sendPayout() {
  const collectorId = document.getElementById('payout-collector').value;
  const amount = Number(document.getElementById('payout-amount').value);
  const description = document.getElementById('payout-description').value.trim();
  const resultEl = document.getElementById('payout-result');
  resultEl.className = '';

  if (!collectorId) {
    resultEl.className = 'error';
    resultEl.textContent = 'Select a collector.';
    return;
  }
  if (!amount || amount <= 0) {
    resultEl.className = 'error';
    resultEl.textContent = 'Enter a positive amount.';
    return;
  }

  try {
    const result = await apiFetch('/admin/payouts', {
      method: 'POST',
      body: JSON.stringify({ collector_id: Number(collectorId), amount, description: description || undefined }),
    });
    resultEl.className = 'success';
    resultEl.textContent = `Sent ${amount.toLocaleString()} FCFA. Company balance: ${Number(result.company_new_balance).toLocaleString()} FCFA.`;
    document.getElementById('payout-amount').value = '';
    document.getElementById('payout-description').value = '';
    await loadWalletTab();
  } catch (err) {
    resultEl.className = 'error';
    resultEl.textContent = `Failed: ${err.message}`;
  }
}

function initDashboard() {
  showView('dashboard-view');
  showTab('collectors');
  loadCollectors();

  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.onclick = () => {
      showTab(btn.dataset.tab);
      if (btn.dataset.tab === 'wallet') loadWalletTab();
    };
  });

  document.getElementById('refresh-collectors').onclick = loadCollectors;
  document.getElementById('create-collector').onclick = createCollector;
  document.getElementById('refresh-wallet').onclick = loadWalletTab;
  document.getElementById('send-payout').onclick = sendPayout;
  document.getElementById('logout-btn').onclick = () => {
    sessionStorage.removeItem('cl_company_admin_session');
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
    if (body.admin.role !== 'company_admin') throw new Error('This account is not a company_admin.');

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