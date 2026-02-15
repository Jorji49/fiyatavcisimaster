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

const TURKISH_CHAR_MAP = {
  ı: "i",
  i: "ı",
  ö: "o",
  o: "ö",
  ü: "u",
  u: "ü",
  ş: "s",
  s: "ş",
  ç: "c",
  c: "ç",
  ğ: "g",
  g: "ğ",
};

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
    if (x.length < 3 || !isNaN(x)) {
      suggestions.push(x);
      return;
    }
    const normalizedX = normalizeForSearch(x);
    if (
      ALL_WORDS.some((aw) => normalizeForSearch(aw) === normalizedX) ||
      ALL_WORDS.includes(x)
    ) {
      suggestions.push(x);
      return;
    }

    let bestMatch = x,
      minDist = 2,
      bestWord = null;
    ALL_WORDS.forEach((d) => {
      const normalizedD = normalizeForSearch(d);
      const dist1 = getEditDistance(x, d);
      const dist2 = getEditDistance(normalizedX, normalizedD);
      const dist = Math.min(dist1, dist2);
      const lenDiff = Math.abs(d.length - x.length);

      if (dist < minDist && lenDiff <= 2) {
        minDist = dist;
        bestMatch = d;
        bestWord = d;
        hasTypo = true;
      } else if (dist === minDist && d.startsWith(x.substring(0, 2))) {
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

    const icon = document.createElement("i");
    icon.className = "fa-solid fa-wand-magic-sparkles text-blue-500";
    typoBox.appendChild(icon);

    const label = document.createElement("span");
    label.className = "text-slate-500 font-medium";
    label.textContent = "Şunu mu aramak istediniz: ";
    typoBox.appendChild(label);

    const link = document.createElement("span");
    link.className = "typo-link";
    link.textContent = sg;
    link.onclick = () => applyCorrection(sg);
    typoBox.appendChild(link);

    const details = document.createElement("span");
    details.className = "text-slate-300 text-xs ml-2";
    details.textContent =
      "(" + corrections.map((c) => c.from + " → " + c.to).join(", ") + ")";
    typoBox.appendChild(details);

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

function validateQuery(q) {
  if (!q || q.trim().length === 0) return { valid: false, silent: true };
  if (q.trim().length < 2)
    return { valid: false, msg: "Lütfen geçerli bir ürün adı girin." };
  return { valid: true };
}

function detectCategory(q) {
  const l = q.toLowerCase();
  const categories = {
    VR_GAMING: D_VR_GAMING,
    CONSOLE: D_CONSOLE,
    HARDWARE: D_HARDWARE,
    PHONE: D_PHONE,
    COMPUTER: D_COMPUTER,
    AUDIO: D_AUDIO,
    SMARTWATCH: D_SMARTWATCH,
    CAMERA: D_CAMERA,
    HOME_ELECTRONICS: D_HOME_ELECTRONICS,
    COSMETIC: D_COSMETIC,
    BOOK: D_BOOK,
    FASHION: D_FASHION,
    TOY: D_TOY,
    PET_BABY: D_PET_BABY,
    SPORTS: D_SPORTS,
    HOME: D_HOME,
  };

  let bestCat = "GENERAL";
  let maxScore = 0;

  for (let cat in categories) {
    let score = 0;
    for (let w of categories[cat]) {
      if (l.includes(w)) {
        // Use squared length to heavily favor longer, more specific matches
        score += w.length * w.length;
      }
    }
    if (score > maxScore) {
      maxScore = score;
      bestCat = cat;
    }
  }
  return bestCat;
}

function updateHistory(q) {
  let h = JSON.parse(localStorage.getItem("ph_hist") || "[]");
  h = h.filter((i) => i !== q);
  h.unshift(q);
  if (h.length > 5) h.pop();
  localStorage.setItem("ph_hist", JSON.stringify(h));
  renderHistory();
}

function clearHistory() {
  localStorage.removeItem("ph_hist");
  renderHistory();
  document.getElementById("gridContainer").innerHTML = "";
  document.getElementById("resultInfo").classList.add("hidden");
  document.getElementById("initialContent").classList.remove("hidden");
}

function renderHistory() {
  const c = document.getElementById("historyArea");
  const h = JSON.parse(localStorage.getItem("ph_hist") || "[]");
  if (h.length === 0) {
    c.classList.add("hidden");
    return;
  }
  c.innerHTML =
    '<span class="text-xs font-bold text-slate-300 self-center mr-1">SON:</span>';
  h.forEach((i) => {
    const chip = document.createElement("div");
    chip.className = "history-chip";
    chip.innerHTML =
      '<i class="fa-solid fa-clock-rotate-left text-[10px] text-slate-400"></i> ' +
      i;
    chip.onclick = () => {
      document.getElementById("queryInput").value = i;
      runEngine();
    };
    c.appendChild(chip);
  });
  const clearBtn = document.createElement("button");
  clearBtn.className = "history-clear-btn";
  clearBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
  clearBtn.title = "Geçmişi Temizle";
  clearBtn.onclick = (e) => {
    e.stopPropagation();
    clearHistory();
  };
  c.appendChild(clearBtn);
  c.classList.remove("hidden");
}

function toggleClearBtn() {
  const i = document.getElementById("queryInput"),
    b = document.getElementById("clearBtn");
  if (i.value.length > 0) b.classList.add("visible");
  else b.classList.remove("visible");
}

function handleInput(inp) {
  toggleClearBtn();
  const q = inp.value.trim();
  const box = document.getElementById("suggestionBox");

  if (q.length < 2) {
    box.classList.add("hidden");
    return;
  }

  const normalizedQ = normalizeForSearch(q);
  const uniqueWords = [...new Set(ALL_WORDS)];
  const matches = uniqueWords
    .filter((w) => normalizeForSearch(w).includes(normalizedQ))
    .slice(0, 8);

  if (matches.length > 0) {
    box.innerHTML = "";
    matches.forEach((m) => {
      const item = document.createElement("div");
      item.className =
        "px-6 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer flex items-center gap-3 transition-colors border-b last:border-0 border-slate-100 dark:border-slate-700";

      const icon = document.createElement("i");
      icon.className = "fa-solid fa-magnifying-glass text-slate-300 text-sm";
      item.appendChild(icon);

      const text = document.createElement("span");
      text.className = "font-bold text-slate-700 dark:text-slate-200";
      text.textContent = m;
      item.appendChild(text);

      item.onclick = () => applySuggestion(m);
      box.appendChild(item);
    });
    box.classList.remove("hidden");
  } else {
    box.classList.add("hidden");
  }
}

function applySuggestion(s) {
  document.getElementById("queryInput").value = s;
  document.getElementById("suggestionBox").classList.add("hidden");
  runEngine();
}

function clearSearch() {
  document.getElementById("queryInput").value = "";
  document.getElementById("gridContainer").innerHTML = "";
  document.getElementById("errorPanel").classList.add("hidden");
  document.getElementById("typoContainer").classList.add("hidden");
  document.getElementById("suggestionBox").classList.add("hidden");
  document.getElementById("resultInfo").classList.add("hidden");
  document.getElementById("initialContent").classList.remove("hidden");
  toggleClearBtn();
  document.getElementById("queryInput").focus();
}

function showSkeleton() {
  const grid = document.getElementById("gridContainer");
  grid.innerHTML = "";
  for (let i = 0; i < 6; i++) {
    const skeleton = document.createElement("div");
    skeleton.className =
      "base-card animate-pulse bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 h-32 rounded-3xl";
    grid.appendChild(skeleton);
  }
}

function runEngine() {
  const inp = document.getElementById("queryInput"),
    grid = document.getElementById("gridContainer"),
    err = document.getElementById("errorPanel"),
    btn = document.getElementById("searchBtn"),
    init = document.getElementById("initialContent");
  let q = inp.value.trim().replace(/\s+/g, " ");
  grid.innerHTML = "";
  err.classList.add("hidden");
  document.getElementById("typoContainer").classList.add("hidden");
  document.getElementById("resultInfo").classList.add("hidden");
  document.getElementById("suggestionBox").classList.add("hidden");

  if (q.length === 0) {
    init.classList.remove("hidden");
    return;
  }
  init.classList.add("hidden");
  showSkeleton();

  btn.classList.add("btn-loading");
  btn.innerHTML = "ARANIYOR...";

  setTimeout(() => {
    btn.classList.remove("btn-loading");
    btn.innerHTML = "ARA";
    const v = validateQuery(q);
    if (!v.valid) {
      if (!v.silent) {
        document.getElementById("errorText").innerText = v.msg;
        err.classList.remove("hidden");
      }
      return;
    }

    checkTypos(q);
    updateHistory(q);

    if (typeof gtag === "function")
      try {
        gtag("event", "conversion", {
          send_to: "AW-17749261970/fVEYCL6UkscbEJL9wI9C",
        });
      } catch (e) {}

    const ql = q.toLowerCase();
    const cat = detectCategory(ql);
    grid.innerHTML = "";

    let brandFound = null;
    for (let k in BRANDS) {
      if (BRANDS[k].k.some((x) => ql.includes(x))) {
        brandFound = BRANDS[k];
        break;
      }
    }
    if (brandFound)
      createCard(
        brandFound.name,
        null,
        brandFound.u(q),
        "official",
        brandFound.i,
        null,
      );

    MARKETS.forEach((m) => {
      let show = false,
        highlight = false;
      if (cat === "VR_GAMING") {
        if (
          [
            "AMAZON",
            "HEPSIBURADA",
            "N11",
            "MEDIAMARKT",
            "VATAN",
            "ITOPYA",
            "INCEHESAP",
          ].includes(m.name)
        )
          show = true;
        if (["ITOPYA", "MEDIAMARKT", "AMAZON", "VATAN"].includes(m.name))
          highlight = true;
      } else if (cat === "CONSOLE") {
        if (
          [
            "AMAZON",
            "HEPSIBURADA",
            "TRENDYOL",
            "N11",
            "MEDIAMARKT",
            "TEKNOSA",
            "VATAN",
            "ITOPYA",
            "INCEHESAP",
          ].includes(m.name)
        )
          show = true;
        if (
          [
            "MEDIAMARKT",
            "AMAZON",
            "ITOPYA",
            "VATAN",
            "TEKNOSA",
            "INCEHESAP",
          ].includes(m.name)
        )
          highlight = true;
      } else if (cat === "HARDWARE") {
        if (m.t.includes("pc")) show = true;
        if (["ITOPYA", "INCEHESAP", "SINERJI", "VATAN"].includes(m.name))
          highlight = true;
      } else if (cat === "PHONE") {
        if (
          [
            "AMAZON",
            "HEPSIBURADA",
            "TRENDYOL",
            "N11",
            "MEDIAMARKT",
            "TEKNOSA",
            "VATAN",
          ].includes(m.name)
        )
          show = true;
        if (
          [
            "AMAZON",
            "HEPSIBURADA",
            "MEDIAMARKT",
            "VATAN",
            "TRENDYOL",
            "TEKNOSA",
          ].includes(m.name)
        )
          highlight = true;
        if (
          m.name === "TROY" &&
          ["iphone", "apple"].some((k) => ql.includes(k))
        ) {
          show = true;
          highlight = true;
        }
      } else if (cat === "COMPUTER") {
        if (
          [
            "AMAZON",
            "HEPSIBURADA",
            "N11",
            "MEDIAMARKT",
            "TEKNOSA",
            "VATAN",
            "ITOPYA",
            "INCEHESAP",
          ].includes(m.name)
        )
          show = true;
        if (["AMAZON", "MEDIAMARKT", "VATAN", "INCEHESAP"].includes(m.name))
          highlight = true;
        if (
          m.name === "TROY" &&
          ["macbook", "ipad", "mac", "apple"].some((k) => ql.includes(k))
        ) {
          show = true;
          highlight = true;
        }
      } else if (cat === "AUDIO") {
        if (
          [
            "AMAZON",
            "HEPSIBURADA",
            "TRENDYOL",
            "N11",
            "MEDIAMARKT",
            "TEKNOSA",
            "VATAN",
          ].includes(m.name)
        )
          show = true;
        if (["AMAZON", "MEDIAMARKT", "TEKNOSA", "VATAN"].includes(m.name))
          highlight = true;
        if (m.name === "TROY" && ["airpods"].some((k) => ql.includes(k))) {
          show = true;
          highlight = true;
        }
      } else if (cat === "SMARTWATCH") {
        if (
          [
            "AMAZON",
            "HEPSIBURADA",
            "TRENDYOL",
            "N11",
            "MEDIAMARKT",
            "TEKNOSA",
            "VATAN",
          ].includes(m.name)
        )
          show = true;
        if (["AMAZON", "MEDIAMARKT", "TEKNOSA", "VATAN"].includes(m.name))
          highlight = true;
        if (
          m.name === "TROY" &&
          ["apple watch", "watch"].some((k) => ql.includes(k))
        ) {
          show = true;
          highlight = true;
        }
      } else if (cat === "CAMERA") {
        if (
          [
            "AMAZON",
            "HEPSIBURADA",
            "N11",
            "MEDIAMARKT",
            "TEKNOSA",
            "VATAN",
          ].includes(m.name)
        )
          show = true;
        if (["AMAZON", "MEDIAMARKT", "VATAN", "TEKNOSA"].includes(m.name))
          highlight = true;
      } else if (cat === "HOME_ELECTRONICS") {
        if (
          [
            "AMAZON",
            "HEPSIBURADA",
            "TRENDYOL",
            "N11",
            "MEDIAMARKT",
            "TEKNOSA",
            "VATAN",
          ].includes(m.name)
        )
          show = true;
        if (["AMAZON", "MEDIAMARKT", "TEKNOSA", "VATAN"].includes(m.name))
          highlight = true;
      } else if (cat === "FASHION" || cat === "SPORTS") {
        if (
          m.t.includes("fashion") ||
          m.t.includes("sneaker") ||
          m.t.includes("sports")
        )
          show = true;
        if (
          [
            "SUPERSTEP",
            "SNEAKS UP",
            "SPORTIVE",
            "INTERSPORT",
            "BOYNER",
          ].includes(m.name)
        )
          highlight = true;
        if (m.name === "DECATHLON" && ql.includes("decathlon"))
          highlight = true;
        if (["AMAZON", "HEPSIBURADA", "TRENDYOL", "N11"].includes(m.name))
          show = true;
      } else if (cat === "COSMETIC") {
        if (m.t.includes("cosmetic")) show = true;
        if (
          [
            "WATSONS",
            "GRATIS",
            "SEPHORA",
            "ROSSMANN",
            "FLORMAR",
            "BOYNER",
          ].includes(m.name)
        )
          highlight = true;
        if (["HEPSIBURADA", "TRENDYOL"].includes(m.name)) show = true;
      } else if (cat === "BOOK") {
        if (m.t.includes("book")) show = true;
        if (
          ["AMAZON", "KITAPYURDU", "İDEFİX", "D&R", "BKM KİTAP"].includes(
            m.name,
          )
        )
          highlight = true;
      } else if (cat === "TOY") {
        if (m.t.includes("toy")) show = true;
        if (["D&R", "İDEFİX", "TOYZZ SHOP", "AMAZON"].includes(m.name))
          highlight = true;
        if (["AMAZON", "HEPSIBURADA", "TRENDYOL", "N11"].includes(m.name))
          show = true;
      } else if (cat === "PET_BABY") {
        if (m.t.includes("pet")) show = true;
        if (["PETİ", "ÇİÇEKSEPETİ"].includes(m.name)) highlight = true;
        if (["AMAZON", "HEPSIBURADA", "TRENDYOL", "N11"].includes(m.name))
          show = true;
      } else if (cat === "HOME") {
        if (m.t.includes("home") || m.t.includes("home_decor")) show = true;
        if (["KOÇTAŞ", "BAUHAUS", "IKEA"].includes(m.name)) highlight = true;
        if (["MEDIAMARKT", "TEKNOSA"].includes(m.name)) show = false;
      } else {
        if (m.t.includes("market")) show = true;
        if (m.name === "AMAZON") highlight = true;
      }
      if (
        m.name === "TROY" &&
        !["apple", "iphone", "mac", "ipad", "watch", "airpods", "macbook"].some(
          (k) => ql.includes(k),
        )
      ) {
        show = false;
      }
      if (show)
        createCard(
          m.name,
          m.logo,
          m.url + encodeURIComponent(q),
          highlight ? "highlight" : "normal",
          null,
          m,
        );
    });

    const cardCount = grid.querySelectorAll(".base-card").length;
    const resultInfo = document.getElementById("resultInfo");
    const resultCount = document.getElementById("resultCount");
    if (cardCount > 0) {
      resultCount.textContent = cardCount;
      resultInfo.classList.remove("hidden");
    } else {
      resultInfo.classList.add("hidden");
    }

    if (grid.innerHTML === "") {
      document.getElementById("errorText").innerText =
        "Bu arama için uygun sonuç bulunamadı.";
      err.classList.remove("hidden");
    } else {
      setTimeout(() => {
        const rect = grid.getBoundingClientRect();
        if (rect.top > window.innerHeight * 0.4) {
          window.scrollTo({
            top: window.scrollY + rect.top - 100,
            behavior: "smooth",
          });
        }
      }, 150);
    }
  }, 300);
}

function createCard(n, l, u, t, i, td) {
  const g = document.getElementById("gridContainer"),
    c = document.createElement("a");
  c.href = u;
  c.target = "_blank";
  c.rel = "noopener noreferrer";
  let cl = "base-card animate-fade-in col-span-1 no-underline group ",
    ht = "";
  const needsInvert = td && td.darkInvert;
  const imgClass = needsInvert ? "logo-img dark-invert" : "logo-img";
  const isTrusted = TRUSTED_MARKETS.includes(n);
  const trustedBadge = isTrusted
    ? '<div class="trusted-badge"><i class="fa-solid fa-shield-check"></i> Güvenilir Mağaza</div>'
    : "";
  const accuracyInfo =
    "<div class='accuracy-info'><i class='fa-solid fa-circle-check text-green-500'></i> %100 Ürün Uyumu</div>";

  if (t === "official") {
    cl += "official-card md:col-span-2 lg:col-span-3";
    if (
      n.includes("Nike") ||
      n.includes("Adidas") ||
      n.includes("Zara") ||
      n.includes("Puma")
    )
      c.style.background = "linear-gradient(135deg,#111827 0%,#374151 100%)";
    else if (n.includes("Samsung"))
      c.style.background = "linear-gradient(135deg,#034EA2 0%,#000000 100%)";
    else if (n.includes("Xiaomi"))
      c.style.background = "linear-gradient(135deg,#FF6900 0%,#E65100 100%)";
    else if (n.includes("Dyson"))
      c.style.background = "linear-gradient(135deg,#F06D9E 0%,#A31F50 100%)";
    ht = `
      <div class="badge bg-white/20 backdrop-blur-sm shadow-sm"><i class="fa-solid fa-certificate"></i> RESMİ MAĞAZA</div>
      <div class="flex items-center gap-4 md:gap-5 w-full pl-1 md:pl-2">
        <div class="w-12 h-12 md:w-14 md:h-14 rounded-full bg-white/10 flex items-center justify-center text-2xl md:text-3xl text-white shrink-0">
          <i class="fa-brands ${i}"></i>
        </div>
        <div class="flex-grow">
          <div class="text-xl md:text-2xl font-black tracking-tight leading-none mb-1">${n}</div>
          <div class="text-[10px] md:text-xs font-bold opacity-70 tracking-widest uppercase">ARACISIZ SATIŞ</div>
        </div>
        <div class="text-white/80 text-2xl md:text-3xl group-hover:translate-x-2 transition-transform shrink-0 pr-1 md:pr-2">
          <i class="fa-solid fa-arrow-right"></i>
        </div>
      </div>
    `;
  } else if (t === "highlight") {
    cl += "recommended-card";
    c.style.setProperty("--theme-color", td.c);
    ht = `
      <div class="badge shadow-sm"><i class="fa-solid fa-check-circle mr-1"></i> ÖNERİLEN</div>
      ${trustedBadge}
      <div class="logo-wrapper mb-auto mt-2 pl-1">
        <img src="${l}" class="${imgClass}" onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
        <span class="fallback-text text-slate-800" style="color:${td.c}">${n}</span>
      </div>
      <div class="text-green-700 font-extrabold text-sm flex items-center justify-end gap-2 group-hover:gap-3 transition-all pr-1 mt-3">
        Fiyatı Gör <i class="fa-solid fa-chevron-right text-xs"></i>
      </div>
    `;
  } else {
    cl += "link-card";
    c.style.setProperty("--theme-color", td.c);
    c.style.setProperty("--theme-shadow", td.s);
    ht = `
      <div class="logo-wrapper my-auto pl-1">
        <img src="${l}" class="${imgClass}" onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
        <span class="fallback-text text-slate-700" style="color:${td.c}">${n}</span>
      </div>
      ${accuracyInfo}
      <div class="absolute bottom-4 right-4 text-slate-300 group-hover:text-[color:var(--theme-color)] transition-colors text-lg">
        <i class="fa-solid fa-arrow-up-right-from-square"></i>
      </div>
    `;
  }
  c.className = cl;
  c.innerHTML = ht;
  g.appendChild(c);
}
function toggleTheme() {
  const html = document.documentElement;
  const icon = document.getElementById("themeIcon");
  const isDark = html.classList.toggle("dark");
  localStorage.setItem("theme", isDark ? "dark" : "light");
  icon.className = isDark ? "fa-solid fa-sun" : "fa-solid fa-moon";
  updateMetaTheme(isDark);
}

function updateMetaTheme(isDark) {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = isDark ? "#0f172a" : "#2563eb";
}

function initTheme() {
  const saved = localStorage.getItem("theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = saved ? saved === "dark" : prefersDark;
  if (isDark) {
    document.documentElement.classList.add("dark");
    document.getElementById("themeIcon").className = "fa-solid fa-sun";
  }
  updateMetaTheme(isDark);
}

initTheme();

window.onload = () => {
  document.getElementById("queryInput").focus();
  renderHistory();

  const urlParams = new URLSearchParams(window.location.search);
  const query = urlParams.get("q");
  if (query) {
    document.getElementById("queryInput").value = query;
    runEngine();
  }
};

document.getElementById("queryInput").addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    runEngine();
    const box = document.getElementById("suggestionBox");
    if (box) box.classList.add("hidden");
  }
});

document.addEventListener("click", (e) => {
  const box = document.getElementById("suggestionBox");
  if (
    box &&
    !e.target.closest(".search-container") &&
    !e.target.closest("#suggestionBox")
  ) {
    box.classList.add("hidden");
  }
});
