// Compatibilidade cross-browser: Firefox usa `browser`, Chrome/Edge/Opera usam `chrome`
const api = (typeof browser !== 'undefined' && browser.cookies) ? browser : chrome;

// ──────────────────────────────────────────────
// Parser de cookies no formato Netscape/cookies.txt
// Colunas separadas por TAB:
// domain | includeSubdomains | path | secure | expiry | name | value
// ──────────────────────────────────────────────
function parseCookieText(text) {
  const cookies = [];
  const lines = text.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const parts = trimmed.split('\t');
    if (parts.length < 7) continue;

    const domain  = parts[0].trim();
    const path    = parts[2].trim() || '/';
    const secure  = parts[3].trim().toUpperCase() === 'TRUE';
    const expiry  = parseInt(parts[4].trim(), 10);
    const name    = parts[5].trim();
    const value   = parts[6].trim();

    if (!domain || !name) continue;

    cookies.push({ domain, path, secure, expiry: isNaN(expiry) ? undefined : expiry, name, value });
  }

  return cookies;
}

// ──────────────────────────────────────────────
// Define um cookie via API do navegador
// ──────────────────────────────────────────────
function setCookieAsync(cookie) {
  // Garante que o domínio começa com "."
  const domain = cookie.domain.startsWith('.') ? cookie.domain : '.' + cookie.domain;

  const cookieDetails = {
    url:            'https://www.netflix.com',
    name:           cookie.name,
    value:          cookie.value,
    domain:         domain,
    path:           cookie.path,
    secure:         cookie.secure,
    sameSite:       'no_restriction',
  };

  if (cookie.expiry !== undefined) {
    cookieDetails.expirationDate = cookie.expiry;
  }

  // Firefox retorna Promise; Chrome usa callback
  if (typeof browser !== 'undefined' && browser.cookies) {
    return browser.cookies.set(cookieDetails);
  }

  return new Promise((resolve, reject) => {
    chrome.cookies.set(cookieDetails, (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(result);
      }
    });
  });
}

// ──────────────────────────────────────────────
// UI helpers
// ──────────────────────────────────────────────
function showStatus(msg, type) {
  const el = document.getElementById('status');
  el.textContent = msg;
  el.className = 'status ' + type;
}

function updateCount(text) {
  const count = parseCookieText(text).length;
  const el    = document.getElementById('cookieCount');
  if (count === 0) {
    el.textContent = '';
  } else {
    el.innerHTML = `<span>${count}</span> cookie${count !== 1 ? 's' : ''} detectado${count !== 1 ? 's' : ''}`;
  }
}

// ──────────────────────────────────────────────
// Eventos
// ──────────────────────────────────────────────
const textarea = document.getElementById('cookieInput');
const loginBtn = document.getElementById('loginBtn');
const clearBtn = document.getElementById('clearBtn');

textarea.addEventListener('input', () => {
  updateCount(textarea.value);
  document.getElementById('status').className = 'status';
});

clearBtn.addEventListener('click', () => {
  textarea.value = '';
  document.getElementById('cookieCount').textContent = '';
  document.getElementById('status').className = 'status';
  textarea.focus();
});

loginBtn.addEventListener('click', async () => {
  const text = textarea.value.trim();

  if (!text) {
    showStatus('❌ Cole os cookies antes de continuar.', 'error');
    return;
  }

  const cookies = parseCookieText(text);

  if (cookies.length === 0) {
    showStatus('❌ Nenhum cookie válido encontrado.\nVerifique se o formato está correto (colunas separadas por TAB).', 'error');
    return;
  }

  loginBtn.disabled = true;
  showStatus(`⏳ Definindo ${cookies.length} cookie(s)...`, 'info');

  let successCount = 0;
  const errors = [];

  for (const cookie of cookies) {
    try {
      const result = await setCookieAsync(cookie);
      if (result) {
        successCount++;
      } else {
        errors.push(cookie.name);
      }
    } catch (e) {
      errors.push(cookie.name);
      console.warn(`[Netflix Cookie Login] Erro ao definir "${cookie.name}":`, e.message);
    }
  }

  loginBtn.disabled = false;

  if (successCount === 0) {
    showStatus(`❌ Falha ao definir os cookies. Verifique as permissões da extensão.`, 'error');
    return;
  }

  const errorNote = errors.length > 0 ? `\n⚠️ Falha em: ${errors.join(', ')}` : '';
  showStatus(`✅ ${successCount}/${cookies.length} cookie(s) definido(s)! Abrindo Netflix...${errorNote}`, 'success');

  setTimeout(() => {
    api.tabs.create({ url: 'https://www.netflix.com/browse' });
  }, 1200);
});
