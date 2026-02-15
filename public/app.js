const TRUSTED_MARKETS = [
  "AMAZON",
  "HEPSIBURADA",
  "TRENDYOL",
  "MEDIAMARKT",
  "TEKNOSA",
  "VATAN",
  "ITOPYA",
  "TROY",
  "IKEA",
];

const API_BASE = window.location.origin;

let rawResults = [];

function escapeHTML(str) {
  if (!str) return "";
  return str.replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[m]));
}

function getEditDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const m = [];
  for (let i = 0; i <= b.length; i++) m[i] = [i];
  for (let j = 0; j <= a.length; j++) m[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) == a.charAt(j - 1)) m[i][j] = m[i - 1][j - 1];
      else
        m[i][j] = Math.min(
          m[i - 1][j - 1] + 1,
          Math.min(m[i][j - 1] + 1, m[i - 1][j] + 1),
        );
    }
  }
  return m[b.length][a.length];
}

function normalizeForSearch(str) {
  return str
    .toLowerCase()
    .replace(/[ıİ]/g, "i")
    .replace(/[öÖ]/g, "o")
    .replace(/[üÜ]/g, "u")
    .replace(/[şŞ]/g, "s")
    .replace(/[çÇ]/g, "c")
    .replace(/[ğĞ]/g, "g");
}

function checkTypos(q) {
  const words = q.toLowerCase().split(" ");
  let suggestions = [],
    hasTypo = false,
    corrections = [];

  words.forEach((x) => {
    if (x.length < 3 || !isNaN(x)) {suggestions.push(x); return;}
    const normalizedX = normalizeForSearch(x);
    if (ALL_WORDS.some((aw) => normalizeForSearch(aw) === normalizedX) || ALL_WORDS.includes(x)) {
      suggestions.push(x);
      return;
    }

    let bestMatch = x, minDist = 2, bestWord = null;
    ALL_WORDS.forEach((d) => {
      const normalizedD = normalizeForSearch(d);
      const dist = Math.min(getEditDistance(x, d), getEditDistance(normalizedX, normalizedD));
      if (dist < minDist) {
        minDist = dist;
        bestMatch = d;
        bestWord = d;
        hasTypo = true;
      }
    });

    if (bestWord) corrections.push({ from: x, to: bestWord });
    suggestions.push(bestMatch);
  });

  const sg = suggestions.join(" ");
  const container = document.getElementById("typoContainer");

  if (hasTypo && sg !== q.toLowerCase() && corrections.length > 0) {
    container.innerHTML = "";
    const typoBox = document.createElement("div");
    typoBox.className = "typo-box";
    typoBox.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles text-blue-500"></i> <span class="text-slate-500 font-medium">Şunu mu aramak istediniz: </span><span class="typo-link" onclick="applyCorrection('${sg}')">${sg}</span>`;
    container.appendChild(typoBox);
    container.classList.remove("hidden");
  } else {
    container.classList.add("hidden");
  }
}

function applyCorrection(n) {
  document.getElementById("queryInput").value = n;
  document.getElementById("typoContainer").classList.add("hidden");
  runEngine();
}

function quickSearch(n) {
  document.getElementById("queryInput").value = n;
  runEngine();
}

function updateHistory(q) {
  let h = JSON.parse(localStorage.getItem("ph_hist") || "[]");
  h = h.filter((i) => i !== q);
  h.unshift(q);
  if (h.length > 5) h.pop();
  localStorage.setItem("ph_hist", JSON.stringify(h));
  renderHistory();
}

function renderHistory() {
  const c = document.getElementById("historyArea");
  const h = JSON.parse(localStorage.getItem("ph_hist") || "[]");
  if (h.length === 0) { c.classList.add("hidden"); return; }
  c.innerHTML = '<span class="text-xs font-bold text-slate-300 self-center mr-1">SON:</span>';
  h.forEach((i) => {
    const chip = document.createElement("div");
    chip.className = "history-chip";
    chip.innerHTML = `<i class="fa-solid fa-clock-rotate-left text-[10px] text-slate-400"></i> ${i}`;
    chip.onclick = () => { document.getElementById("queryInput").value = i; runEngine(); };
    c.appendChild(chip);
  });
  c.classList.remove("hidden");
}

function handleInput(inp) {
  const q = inp.value.trim();
  const box = document.getElementById("suggestionBox");
  const clearBtn = document.getElementById("clearBtn");

  if (q.length > 0) {
    clearBtn.classList.add("visible");
  } else {
    clearBtn.classList.remove("visible");
  }

  if (q.length < 2) { box.classList.add("hidden"); return; }
  const matches = ALL_WORDS.filter(w => normalizeForSearch(w).includes(normalizeForSearch(q))).slice(0, 5);
  if (matches.length > 0) {
    box.innerHTML = "";
    matches.forEach(m => {
        const div = document.createElement("div");
        div.className = "px-6 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer font-bold";
        div.textContent = m;
        div.onclick = () => applySuggestion(m);
        box.appendChild(div);
    });
    box.classList.remove("hidden");
  } else { box.classList.add("hidden"); }
}

function clearSearch() {
  const inp = document.getElementById("queryInput");
  inp.value = "";
  document.getElementById("clearBtn").classList.remove("visible");
  document.getElementById("suggestionBox").classList.add("hidden");
  inp.focus();
}

function applySuggestion(s) {
  document.getElementById("queryInput").value = s;
  document.getElementById("suggestionBox").classList.add("hidden");
  runEngine();
}

function showSkeleton() {
  const grid = document.getElementById("gridContainer");
  grid.innerHTML = Array(6).fill(0).map(() => `
    <div class="base-card bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 h-32 rounded-3xl p-6 flex gap-4">
        <div class="w-16 h-16 rounded-xl skeleton-box shrink-0"></div>
        <div class="flex-grow space-y-3">
            <div class="h-3 w-20 skeleton-box rounded"></div>
            <div class="h-4 w-full skeleton-box rounded"></div>
            <div class="h-6 w-24 skeleton-box rounded"></div>
        </div>
    </div>
  `).join("");
}

async function runEngine() {
  document.getElementById("suggestionBox").classList.add("hidden");
  const inp = document.getElementById("queryInput"),
        grid = document.getElementById("gridContainer"),
        err = document.getElementById("errorPanel"),
        btn = document.getElementById("searchBtn"),
        init = document.getElementById("initialContent"),
        prog = document.getElementById("searchProgress"),
        pBar = document.getElementById("progressBar");

  let q = inp.value.trim();
  if (!q) return;

  grid.innerHTML = "";
  err.classList.add("hidden");
  init.classList.add("hidden");
  document.getElementById("typoContainer").classList.add("hidden");

  showSkeleton();
  prog.classList.remove("hidden");
  pBar.style.width = "30%";
  btn.classList.add("btn-loading");

  try {
    const response = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(q)}`);
    pBar.style.width = "70%";

    if (!response.ok) {
        throw new Error("Sunucu hatası: " + response.status);
    }

    const results = await response.json();
    rawResults = results;
    pBar.style.width = "100%";

    setTimeout(() => {
        prog.classList.add("hidden");
        pBar.style.width = "0%";
        btn.classList.remove("btn-loading");

        grid.innerHTML = "";
        if (results.length === 0) {
            err.classList.remove("hidden");
            document.getElementById("errorText").innerText = "Ürün bulunamadı.";
            return;
        }

        updateMarketFilter(results);
        renderResults(results);

        document.getElementById("resultInfo").classList.remove("hidden");
        document.getElementById("initialContent").classList.add("hidden");
        updateSEO(q);
        checkTypos(q);
        updateHistory(q);
    }, 500);

  } catch (error) {
    console.error(error);
    btn.classList.remove("btn-loading");
    prog.classList.add("hidden");
    err.classList.remove("hidden");
    document.getElementById("errorText").innerText = "Sunucuya bağlanılamadı. Lütfen tekrar deneyin.";
  }
}

function updateMarketFilter(results) {
  const filter = document.getElementById("marketFilter");
  const markets = [...new Set(results.map(r => r.name))].sort();

  filter.innerHTML = '<option value="all">Tüm Mağazalar</option>';
  markets.forEach(m => {
    filter.innerHTML += `<option value="${m}">${m}</option>`;
  });
}

function handleSortFilter() {
  const sortVal = document.getElementById("sortSelect").value;
  const marketVal = document.getElementById("marketFilter").value;
  const minPrice = parseFloat(document.getElementById("minPrice")?.value) || 0;
  const maxPrice = parseFloat(document.getElementById("maxPrice")?.value) || Infinity;

  let filtered = [...rawResults];

  if (marketVal !== "all") {
    filtered = filtered.filter(r => r.name === marketVal);
  }

  filtered = filtered.filter(r => r.price >= minPrice && r.price <= maxPrice);

  if (sortVal === "price-asc") {
    filtered.sort((a, b) => a.price - b.price);
  } else {
    filtered.sort((a, b) => b.price - a.price);
  }

  renderResults(filtered);
}

function renderResults(results) {
  const grid = document.getElementById("gridContainer");
  grid.innerHTML = "";
  document.getElementById("resultCount").textContent = results.length;

  results.forEach((item, index) => {
    createResultCard(item, index === 0 && document.getElementById("sortSelect").value === "price-asc");
  });
}

function createResultCard(item, isBest) {
  const grid = document.getElementById("gridContainer");
  const cardWrapper = document.createElement("div");
  cardWrapper.className = "relative group";

  const card = document.createElement("a");
  card.href = item.url;
  card.target = "_blank";
  card.className = `base-card link-card animate-fade-in ${isBest ? 'border-2 border-blue-500 shadow-xl' : ''}`;

  const marketData = MARKETS.find(m => m.name === item.name) || { c: "#64748b", logo: "" };
  const isTrusted = TRUSTED_MARKETS.includes(item.name);
  const isLive = item.type === 'LIVE';

  const sTitle = escapeHTML(item.productTitle);
  const sPrice = escapeHTML(item.priceFormatted);
  const sName = escapeHTML(item.name);

  card.innerHTML = `
    ${isBest ? '<div class="badge bg-blue-600 shadow-lg shadow-blue-500/20"><i class="fa-solid fa-crown mr-1"></i> EN UYGUN SEÇENEK</div>' : ''}
    <div class="flex items-start gap-4">
        <div class="w-16 h-16 rounded-2xl bg-slate-50 dark:bg-slate-900/50 flex items-center justify-center overflow-hidden shrink-0 border border-slate-100 dark:border-slate-800 shadow-inner">
            <img src="${item.image || marketData.logo}" class="w-full h-full object-contain p-2" onerror="this.src='https://ui-avatars.com/api/?name=${item.name}&background=f1f5f9&color=64748b&bold=true'">
        </div>
        <div class="flex-grow min-w-0">
            <div class="flex items-center gap-2 mb-1.5">
                <span class="text-[10px] font-black tracking-wider uppercase px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800" style="color:${marketData.c}">${sName}</span>
                ${isTrusted ? '<span class="trusted-badge" title="Güvenilir Mağaza"><i class="fa-solid fa-shield-check"></i></span>' : ''}
            </div>
            <h4 class="text-sm font-bold text-slate-800 dark:text-white truncate mb-1.5" title="${sTitle}">${sTitle}</h4>
            <div class="text-2xl price-tag">${sPrice}</div>
            <div class="accuracy-info mt-2">
                ${isLive
                    ? '<div class="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border border-green-100 dark:border-green-900/30"><i class="fa-solid fa-bolt-lightning text-[9px]"></i> <span>CANLI VERİ</span></div>'
                    : '<div class="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30"><i class="fa-solid fa-clock text-[9px]"></i> <span>DEMO / TAHMİNİ</span></div>'}
            </div>
        </div>
    </div>
    <div class="absolute top-1/2 -translate-y-1/2 right-4 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
        <div class="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-lg shadow-blue-500/40">
            <i class="fa-solid fa-chevron-right text-xs"></i>
        </div>
    </div>
  `;

  const shareBtn = document.createElement("button");
  shareBtn.className = "absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-white/80 dark:bg-slate-700/80 backdrop-blur shadow-sm flex items-center justify-center text-slate-500 hover:text-blue-500 transition-all opacity-0 group-hover:opacity-100";
  shareBtn.innerHTML = '<i class="fa-solid fa-share-nodes text-xs"></i>';
  shareBtn.title = "Paylaş";
  shareBtn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    copyToClipboard(item.url, shareBtn);
  };

  cardWrapper.appendChild(card);
  cardWrapper.appendChild(shareBtn);
  grid.appendChild(cardWrapper);
}

function copyToClipboard(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const original = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-check text-xs text-green-500"></i>';
    setTimeout(() => {
      btn.innerHTML = original;
    }, 2000);
  });
}

function updateSEO(q) {
  const title = `${q} En Uygun Fiyatları | FiyatAvcısı`;
  document.title = title;

  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) {
    metaDesc.setAttribute("content", `${q} için en ucuz ve en güvenilir fiyatları karşılaştırın. FiyatAvcısı ile tasarruf edin.`);
  }

  // Update OG tags
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.setAttribute("content", title);
}

function toggleTheme() {
  const isDark = document.documentElement.classList.toggle("dark");
  localStorage.setItem("theme", isDark ? "dark" : "light");
  document.getElementById("themeIcon").className = isDark ? "fa-solid fa-sun" : "fa-solid fa-moon";
}

function init() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(err => console.log('SW failed', err));
  }

  const saved = localStorage.getItem("theme");
  if (saved === "dark") {
    document.documentElement.classList.add("dark");
    document.getElementById("themeIcon").className = "fa-solid fa-sun";
  }
  renderHistory();
}

init();

window.onload = () => {
  document.getElementById("queryInput").focus();
  const urlParams = new URLSearchParams(window.location.search);
  const q = urlParams.get("q");
  if (q) {
    document.getElementById("queryInput").value = q;
    runEngine();
  }
};

document.getElementById("queryInput").addEventListener("keypress", (e) => {
    if (e.key === "Enter") runEngine();
});
