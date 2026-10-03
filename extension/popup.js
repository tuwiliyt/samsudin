/**
 * AI-Free Credentials Exporter
 * Mendeteksi & mengekstrak session token serta cookies untuk 8 platform AI terintegrasi:
 * DeepSeek, Kimi AI, MiniMax, Xiaomi MiMo, InternLM, Tencent Hunyuan, Zhipu AI (GLM), dan Qwen.
 */

const PROVIDER_DEFINITIONS = [
  {
    id: "deepseek",
    name: "DeepSeek",
    icon: "🐳",
    domain: "deepseek.com",
    url: "https://chat.deepseek.com",
    storageKeys: ["userToken", "user_token"],
    cookieNames: ["ds_session_id"],
    matcher: /chat\.deepseek\.com/,
  },
  {
    id: "kimi",
    name: "Kimi AI (Moonshot)",
    icon: "🌕",
    domain: "moonshot.cn",
    url: "https://kimi.moonshot.cn",
    storageKeys: ["refresh_token", "access_token"],
    cookieNames: [],
    matcher: /kimi\.moonshot\.cn/,
  },
  {
    id: "minimax",
    name: "MiniMax Agent",
    icon: "🤖",
    domain: "minimax.io",
    url: "https://agent.minimax.io",
    storageKeys: ["_token", "token"],
    cookieNames: ["_token", "token"],
    matcher: /agent\.minimax\.io/,
  },
  {
    id: "mimo",
    name: "Xiaomi MiMo",
    icon: "📱",
    domain: "xiaomimimo.com",
    url: "https://aistudio.xiaomimimo.com",
    storageKeys: [],
    cookieNames: ["userId", "xiaomichatbot_ph", "xiaomichatbot_serviceToken"],
    matcher: /aistudio\.xiaomimimo\.com/,
  },
  {
    id: "internlm",
    name: "InternLM (OpenXLab)",
    icon: "🔬",
    domain: "intern-ai.org.cn",
    url: "https://chat.intern-ai.org.cn",
    storageKeys: ["uaa-token", "jwt"],
    cookieNames: ["uaa-token", "ssouid"],
    matcher: /chat\.intern-ai\.org\.cn/,
  },
  {
    id: "hunyuan",
    name: "Tencent Hunyuan",
    icon: "🐉",
    domain: "tencent.ai",
    url: "https://aistudio.tencent.ai",
    storageKeys: [],
    cookieNames: ["hunyuan_token", "hunyuan_user", "hunyuan_source"],
    matcher: /aistudio\.tencent\.ai/,
  },
  {
    id: "wenxin",
    name: "Baidu Wenxin",
    icon: "🔶",
    domain: "baidu.com",
    url: "https://wenxin.baidu.com",
    storageKeys: [],
    cookieNames: ["BAIDUID", "BA_HECTOR", "BDUSS"],
    matcher: /wenxin\.baidu\.com|chat\.baidu\.com/,
  },
  {
    id: "zai",
    name: "Zhipu AI (GLM)",
    icon: "⚡",
    domain: "z.ai",
    url: "https://chat.z.ai",
    storageKeys: ["token"],
    cookieNames: ["token"],
    matcher: /chat\.z\.ai/,
  },
  {
    id: "qwen",
    name: "Qwen AI",
    icon: "🟣",
    domain: "qwen.ai",
    url: "https://chat.qwen.ai",
    storageKeys: ["token"],
    cookieNames: ["login_aliyunid_ticket", "tongyi_sso_ticket"],
    matcher: /chat\.qwen\.ai/,
  },
];

// State penampung kredensial
let currentCredentials = {};
let isPreviewCollapsed = false;

// Inisialisasi saat popup dimuat
document.addEventListener("DOMContentLoaded", async () => {
  setupEventListeners();
  await runQuickScan();
});

function setupEventListeners() {
  document.getElementById("btnQuickScan").addEventListener("click", runQuickScan);
  document.getElementById("btnAutoCollect").addEventListener("click", runAutoCollector);
  document.getElementById("btnRefresh").addEventListener("click", runQuickScan);
  document.getElementById("btnCopyJson").addEventListener("click", copyJsonToClipboard);
  document.getElementById("btnDownloadJson").addEventListener("click", downloadJsonFile);

  document.getElementById("chkMaskTokens").addEventListener("change", () => {
    updateJsonPreview();
    renderProviderCards();
  });

  document.getElementById("btnTogglePreview").addEventListener("click", () => {
    const container = document.getElementById("previewContainer");
    const btn = document.getElementById("btnTogglePreview");
    isPreviewCollapsed = !isPreviewCollapsed;
    if (isPreviewCollapsed) {
      container.classList.add("collapsed");
      btn.textContent = "Tampilkan";
    } else {
      container.classList.remove("collapsed");
      btn.textContent = "Sembunyikan";
    }
  });
}

function showBanner(text, type = "info", icon = "ℹ️") {
  const banner = document.getElementById("statusBanner");
  const bannerText = document.getElementById("bannerText");
  const bannerIcon = document.getElementById("bannerIcon");

  banner.className = `status-banner ${type}`;
  bannerText.textContent = text;
  bannerIcon.textContent = icon;
}

function hideBanner() {
  document.getElementById("statusBanner").className = "status-banner hidden";
}

function maskString(str, visibleChars = 6) {
  if (!str || typeof str !== "string") return "";
  if (str.length <= visibleChars * 2) return "••••••••";
  return `${str.slice(0, visibleChars)}...${str.slice(-visibleChars)}`;
}

/**
 * Mengambil seluruh cookie untuk sebuah domain dan URL
 */
async function fetchCookiesForProvider(provider) {
  const cookiesMap = {};
  try {
    const [domainCookies, urlCookies] = await Promise.all([
      chrome.cookies.getAll({ domain: provider.domain }),
      chrome.cookies.getAll({ url: provider.url }),
    ]);

    const combined = [...(domainCookies || []), ...(urlCookies || [])];
    for (const c of combined) {
      cookiesMap[c.name] = c.value;
    }
  } catch (err) {
    console.warn(`Gagal membaca cookie ${provider.id}:`, err);
  }
  return cookiesMap;
}

/**
 * Mengekstrak localStorage dari tab yang sudah terbuka
 */
async function extractLocalStorageFromTab(tabId, storageKeys) {
  if (!storageKeys || storageKeys.length === 0) return {};
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: (keys) => {
        const extracted = {};
        for (const k of keys) {
          try {
            const val = localStorage.getItem(k);
            if (val) extracted[k] = val;
          } catch (e) {}
        }
        return extracted;
      },
      args: [storageKeys],
    });

    if (results && results[0] && results[0].result) {
      return results[0].result;
    }
  } catch (err) {
    console.warn(`Script injection tab ${tabId} gagal:`, err);
  }
  return {};
}

/**
 * Scan cepat seluruh sesi browser (cookies + tab yang aktif/terbuka)
 */
async function runQuickScan() {
  showBanner("Memindai cookies & tab terbuka...", "info", "🔍");
  setButtonsBusy(true);

  try {
    const openTabs = await chrome.tabs.query({});
    const newCreds = {
      _comment: "Konfigurasi kredensial otomatis diekspor oleh AI-Free Chrome Extension.",
    };

    let detectedCount = 0;

    for (const provider of PROVIDER_DEFINITIONS) {
      const pId = provider.id;
      const cookies = await fetchCookiesForProvider(provider);

      // Cari apakah ada tab yang sedang membuka domain ini
      const matchingTab = openTabs.find((t) => t.url && provider.matcher.test(t.url));
      let storage = {};
      if (matchingTab && matchingTab.id) {
        storage = await extractLocalStorageFromTab(matchingTab.id, provider.storageKeys);
      }

      // Format struktur kredensial sesuai target setup.mjs
      const credItem = buildProviderCredential(pId, cookies, storage);
      newCreds[pId] = credItem;

      if (isProviderConnected(pId, credItem)) {
        detectedCount++;
      }
    }

    currentCredentials = newCreds;
    updateStatsBadge(detectedCount, PROVIDER_DEFINITIONS.length);
    renderProviderCards();
    updateJsonPreview();

    if (detectedCount > 0) {
      showBanner(`Berhasil mendeteksi ${detectedCount} dari ${PROVIDER_DEFINITIONS.length} platform AI.`, "success", "✓");
    } else {
      showBanner("Belum ada sesi aktif. Klik 'Buka Semua & Ambil Token' untuk membuka platform.", "warning", "⚠️");
    }
  } catch (err) {
    showBanner(`Gagal memindai: ${err.message}`, "warning", "❌");
  } finally {
    setButtonsBusy(false);
  }
}

/**
 * Buka tab untuk platform yang belum terdeteksi, tunggu load, ambil token, dan tutup tab
 */
async function runAutoCollector() {
  const autoClose = document.getElementById("chkAutoClose").checked;
  setButtonsBusy(true);

  try {
    showBanner("Mempersiapkan koleksi token otomatis...", "info", "🚀");

    // Ambil tab yang terbuka saat ini
    const initialTabs = await chrome.tabs.query({});

    for (let i = 0; i < PROVIDER_DEFINITIONS.length; i++) {
      const provider = PROVIDER_DEFINITIONS[i];
      const pId = provider.id;

      // Cek apakah sudah terhubung lengkap
      if (currentCredentials[pId] && isProviderConnected(pId, currentCredentials[pId])) {
        continue;
      }

      showBanner(`[${i + 1}/${PROVIDER_DEFINITIONS.length}] Memeriksa ${provider.name}...`, "info", "⏳");

      // Cek apakah sudah ada tab terbuka
      let tab = initialTabs.find((t) => t.url && provider.matcher.test(t.url));
      let createdTab = false;

      if (!tab) {
        // Buat background tab baru
        tab = await chrome.tabs.create({ url: provider.url, active: false });
        createdTab = true;

        // Tunggu tab selesai loading
        await waitForTabLoad(tab.id, 8000);
        // Delay ekstra 1.5 detik agar JS aplikasi web sempat menulis ke localStorage
        await new Promise((r) => setTimeout(r, 1500));
      }

      // Ambil cookies dan localStorage
      const cookies = await fetchCookiesForProvider(provider);
      let storage = {};
      if (tab && tab.id) {
        storage = await extractLocalStorageFromTab(tab.id, provider.storageKeys);
      }

      currentCredentials[pId] = buildProviderCredential(pId, cookies, storage);

      // Tutup tab jika tadi dibuat baru dan opsi auto-close aktif
      if (createdTab && autoClose && tab.id) {
        try {
          await chrome.tabs.remove(tab.id);
        } catch (e) {}
      }

      renderProviderCards();
      updateJsonPreview();
    }

    // Hitung total terdeteksi
    let count = 0;
    for (const p of PROVIDER_DEFINITIONS) {
      if (isProviderConnected(p.id, currentCredentials[p.id])) count++;
    }

    updateStatsBadge(count, PROVIDER_DEFINITIONS.length);
    showBanner(`Pengumpulan selesai! ${count} dari ${PROVIDER_DEFINITIONS.length} platform berhasil dideteksi.`, "success", "🎉");
  } catch (err) {
    showBanner(`Kesalahan saat koleksi token: ${err.message}`, "warning", "❌");
  } finally {
    setButtonsBusy(false);
  }
}

/**
 * Menunggu hingga status tab 'complete'
 */
function waitForTabLoad(tabId, timeoutMs = 8000) {
  return new Promise((resolve) => {
    let resolved = false;

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }, timeoutMs);

    const listener = (id, changeInfo) => {
      if (id === tabId && changeInfo.status === "complete") {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      }
    };

    chrome.tabs.onUpdated.addListener(listener);
  });
}

/**
 * Membentuk objek data kredensial sesuai format template
 */
function buildProviderCredential(providerId, cookies, storage) {
  switch (providerId) {
    case "deepseek":
      return {
        userToken: storage["userToken"] || storage["user_token"] || "",
        ds_session_id: cookies["ds_session_id"] || "",
      };
    case "kimi":
      return {
        accessToken: storage["access_token"] || "",
        refreshToken: storage["refresh_token"] || "",
      };
    case "minimax":
      return {
        token: storage["_token"] || storage["token"] || cookies["_token"] || cookies["token"] || "",
      };
    case "mimo":
      return {
        userId: cookies["userId"] || "",
        xiaomichatbot_ph: cookies["xiaomichatbot_ph"] || "",
        xiaomichatbot_serviceToken: cookies["xiaomichatbot_serviceToken"] || "",
      };
    case "internlm":
      return {
        uaaToken: cookies["uaa-token"] || storage["uaa-token"] || storage["jwt"] || "",
        ssouid: cookies["ssouid"] || "",
      };
    case "hunyuan":
      return {
        hunyuan_token: cookies["hunyuan_token"] || "",
        hunyuan_user: cookies["hunyuan_user"] || "",
        hunyuan_source: cookies["hunyuan_source"] || "web",
      };
    case "wenxin": {
      const keep = ["BAIDUID", "BAIDUID_BFESS", "BA_HECTOR", "BDUSS", "BDUSS_BFESS", "H_WISE_SIDS", "ppfuid", "XFI", "ZFY"];
      const out = {};
      for (const k of keep) if (cookies[k]) out[k] = cookies[k];
      return out;
    }
    case "zai":
      return {
        token: storage["token"] || cookies["token"] || "",
      };
    case "qwen":
      return {
        token: storage["token"] || cookies["login_aliyunid_ticket"] || "",
      };
    default:
      return {};
  }
}

/**
 * Mengecek apakah provider memiliki minimal 1 token valid
 */
function isProviderConnected(providerId, data) {
  if (!data) return false;
  switch (providerId) {
    case "deepseek":
      return Boolean(data.userToken || data.ds_session_id);
    case "kimi":
      return Boolean(data.refreshToken || data.accessToken);
    case "minimax":
      return Boolean(data.token);
    case "mimo":
      return Boolean(data.xiaomichatbot_serviceToken);
    case "internlm":
      return Boolean(data.uaaToken);
    case "hunyuan":
      return Boolean(data.hunyuan_token);
    case "wenxin":
      return Boolean(data.BAIDUID || data.BDUSS);
    case "zai":
      return Boolean(data.token);
    case "qwen":
      return Boolean(data.token);
    default:
      return false;
  }
}

/**
 * Render kartu status untuk masing-masing provider
 */
function renderProviderCards() {
  const container = document.getElementById("providersList");
  container.innerHTML = "";

  const mask = document.getElementById("chkMaskTokens").checked;

  for (const provider of PROVIDER_DEFINITIONS) {
    const pId = provider.id;
    const cred = currentCredentials[pId] || {};
    const connected = isProviderConnected(pId, cred);

    const card = document.createElement("div");
    card.className = `provider-card ${connected ? "connected" : "missing"}`;

    // Buat ringkasan key yang terdeteksi
    let keysSummary = "";
    if (connected) {
      const detectedKeys = Object.entries(cred)
        .filter(([_, v]) => Boolean(v))
        .map(([k, v]) => `${k}: ${mask ? maskString(v) : v}`)
        .join(" | ");
      keysSummary = `<div class="provider-keys">${detectedKeys}</div>`;
    } else {
      keysSummary = `<div class="provider-keys" style="color: var(--text-muted);">Belum terdeteksi token</div>`;
    }

    card.innerHTML = `
      <div class="provider-info">
        <div class="provider-icon">${provider.icon}</div>
        <div class="provider-details">
          <h3>${provider.name}</h3>
          <div class="provider-domain">${provider.domain}</div>
          ${keysSummary}
        </div>
      </div>
      <div class="provider-actions">
        <span class="badge-status ${connected ? "connected" : "missing"}">
          ${connected ? "✓ Terhubung" : "Belum Ada"}
        </span>
        <button class="btn-small btn-open-tab" data-url="${provider.url}" title="Buka ${provider.name} di tab baru">
          Buka Tab
        </button>
      </div>
    `;

    card.querySelector(".btn-open-tab").addEventListener("click", () => {
      chrome.tabs.create({ url: provider.url });
    });

    container.appendChild(card);
  }
}

/**
 * Update JSON Preview di bagian bawah
 */
function updateJsonPreview() {
  const pre = document.getElementById("jsonPreview");
  const mask = document.getElementById("chkMaskTokens").checked;

  let displayData = currentCredentials;
  if (mask) {
    displayData = JSON.parse(JSON.stringify(currentCredentials));
    for (const [pId, pObj] of Object.entries(displayData)) {
      if (typeof pObj === "object" && pObj !== null) {
        for (const [k, v] of Object.entries(pObj)) {
          if (typeof v === "string" && v.length > 12) {
            pObj[k] = maskString(v, 6);
          }
        }
      }
    }
  }

  pre.textContent = JSON.stringify(displayData, null, 2);
}

function updateStatsBadge(detected, total) {
  const badge = document.getElementById("statsBadge");
  const count = document.getElementById("detectedCount");
  count.textContent = `${detected}/${total}`;

  if (detected === 0) {
    badge.style.color = "var(--text-muted)";
    badge.style.borderColor = "var(--border-color)";
    badge.style.background = "rgba(100, 116, 139, 0.1)";
    badge.querySelector(".dot").style.background = "var(--text-muted)";
  } else {
    badge.style.color = "var(--accent-green)";
    badge.style.borderColor = "rgba(16, 185, 129, 0.25)";
    badge.style.background = "rgba(16, 185, 129, 0.12)";
    badge.querySelector(".dot").style.background = "var(--accent-green)";
  }
}

function setButtonsBusy(isBusy) {
  document.getElementById("btnQuickScan").disabled = isBusy;
  document.getElementById("btnAutoCollect").disabled = isBusy;
  document.getElementById("btnRefresh").disabled = isBusy;
}

/**
 * Salin JSON asli (tanpa masking) ke clipboard
 */
async function copyJsonToClipboard() {
  try {
    const rawJson = JSON.stringify(currentCredentials, null, 2);
    await navigator.clipboard.writeText(rawJson);
    showBanner("Berhasil menyalin credentials.json ke clipboard!", "success", "📋");
  } catch (err) {
    showBanner(`Gagal menyalin: ${err.message}`, "warning", "❌");
  }
}

/**
 * Download file credentials.json langsung ke browser
 */
function downloadJsonFile() {
  try {
    const rawJson = JSON.stringify(currentCredentials, null, 2);
    const blob = new Blob([rawJson], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "credentials.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showBanner("File credentials.json berhasil di-download! Pindahkan ke folder ai-free/", "success", "💾");
  } catch (err) {
    showBanner(`Gagal men-download file: ${err.message}`, "warning", "❌");
  }
}
