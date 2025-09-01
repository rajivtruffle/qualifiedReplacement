// assets/app.js
(function () {
  const REPO = "qualifiedReplacement"; // must match your repo

  // Map UI language -> Salesforce-supported language
  const ESW_LANG_MAP = { en: "en_US", fr: "fr", de: "de" };

  // ---------- URL helpers ----------
  function getBasePath() {
    const parts = location.pathname.split("/").filter(Boolean);
    const idx = parts.indexOf(REPO);
    return idx !== -1 ? "/" + parts.slice(0, idx + 1).join("/") + "/" : "/";
  }

  // UI language for routing/assets ('en' | 'fr' | 'de')
  function currentUILang() {
    const parts = location.pathname.split("/").filter(Boolean);
    const idx = parts.indexOf(REPO);
    const lang = idx !== -1 ? (parts[idx + 1] || "").toLowerCase() : "";
    return ["en", "fr", "de"].includes(lang) ? lang : "en";
  }

  // Salesforce language ('en_US' | 'fr' | 'de')
  function sfLang() {
    return ESW_LANG_MAP[currentUILang()] || "en_US";
  }

  function langUrl(lang) {
    return getBasePath() + lang + "/";
  }

  // ---------- UTM / Referrer ----------
  function parseUTMs() {
    const sp = new URLSearchParams(location.search);
    const pick = (k) => sp.get(k) || null;
    return {
      utm_source: pick("utm_source"),
      utm_medium: pick("utm_medium"),
      utm_campaign: pick("utm_campaign"),
      utm_term: pick("utm_term"),
      utm_content: pick("utm_content"),
    };
  }
  const referrer = document.referrer || null;

  // ---------- Device ----------
  const deviceType = () => (window.innerWidth < 768 ? "mobile" : "desktop");

  // ---------- Session ----------
  const SID_KEY = "truffle_session_id";
  const FIRST_SEEN_KEY = "truffle_first_seen";
  const LAST_SEEN_KEY = "truffle_last_seen";
  function uuid() {
    const rnd = () =>
      (window.crypto?.getRandomValues
        ? crypto.getRandomValues(new Uint8Array(1))[0] & 15
        : Math.floor(Math.random() * 16));
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = rnd();
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
  const sessionId =
    localStorage.getItem(SID_KEY) ||
    (localStorage.setItem(SID_KEY, uuid()), localStorage.getItem(SID_KEY));
  const firstSeen =
    localStorage.getItem(FIRST_SEEN_KEY) ||
    (localStorage.setItem(FIRST_SEEN_KEY, new Date().toISOString()),
    localStorage.getItem(FIRST_SEEN_KEY));
  localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString());
  const lastSeen = localStorage.getItem(LAST_SEEN_KEY);

  // ---------- Core context (sync) ----------
  const context = {
    device: deviceType(),
    language: currentUILang(),     // UI language: 'en' | 'fr' | 'de'
    sfLanguage: sfLang(),          // Salesforce language: 'en_US' | 'fr' | 'de'
    pageUrl: window.location.href,
    referrer,
    ...parseUTMs(),
    sessionId,
    firstSeen,
    lastSeen,
    ipAddress: null,
    geo: null, // { country, countryCode, region, city, timezone }
  };
  window.TruffleContext = context;

  // Optional: set the document <html lang="…"> for accessibility/SEO
  try { document.documentElement.lang = context.sfLanguage.replace("_", "-"); } catch {}

  // Logs
  console.log("🧭 BasePath:", getBasePath());
  console.log("🌍 UI Language:", context.language, "→ SF Language:", context.sfLanguage);
  console.log("📱 Device:", context.device);
  console.log("📄 Page URL:", context.pageUrl);
  if (context.referrer) console.log("↩️ Referrer:", context.referrer);
  const { utm_source, utm_medium, utm_campaign, utm_term, utm_content } = context;
  if (utm_source || utm_medium || utm_campaign || utm_term || utm_content) {
    console.log("📊 UTM:", { utm_source, utm_medium, utm_campaign, utm_term, utm_content });
  }
  console.log("🆔 Session:", {
    sessionId: context.sessionId,
    firstSeen: context.firstSeen,
    lastSeen: context.lastSeen,
  });

  // ---------- IP + Geo (CORS-friendly) ----------
  fetch("https://api.ipify.org?format=json")
    .then((r) => r.json())
    .then(({ ip }) => {
      context.ipAddress = ip || null;
      console.log("🌐 IP:", context.ipAddress);
      if (!ip) throw new Error("No IP");
      return fetch(`https://ipwho.is/${encodeURIComponent(ip)}`);
    })
    .then((r) => r.json())
    .then((j) => {
      if (j?.success) {
        context.geo = {
          country: j.country || null,
          countryCode: j.country_code || null,
          region: j.region || null,
          city: j.city || null,
          timezone: j.timezone?.id || null,
        };
        console.log("🗺️ Geo:", context.geo);
      } else {
        console.warn("Geo lookup failed or unavailable:", j?.message);
      }
      window.dispatchEvent(new Event("truffleContextUpdated"));
    })
    .catch((err) => {
      console.warn("IP/Geo lookup failed:", err);
      window.dispatchEvent(new Event("truffleContextUpdated"));
    });

  // ---------- Resize updates ----------
  window.addEventListener(
    "resize",
    (() => {
      let t;
      return () => {
        clearTimeout(t);
        t = setTimeout(() => (window.TruffleContext.device = deviceType()), 200);
      };
    })()
  );

  // ---------- Language selector ----------
  const sel = document.getElementById("langSelect");
  if (sel) {
    sel.value = context.language; // 'en' | 'fr' | 'de'
    sel.addEventListener("change", (e) =>
      window.location.assign(langUrl(e.target.value))
    );
  }

  // ---------- Full-bleed background ----------
  (function setLanguageBackground() {
    const bg = document.querySelector(".bg");
    if (!bg) return;
    const base = getBasePath(); // "/TruffleAlgolia/"
    const lang = context.language; // UI language for asset names
    const pick = (l) => `${base}assets/Algolia_${l}.png`;
    let url = pick("en");
    if (lang === "fr") url = pick("fr");
    if (lang === "de") url = pick("de");

    const img = new Image();
    img.onload = () => {
      bg.style.backgroundImage = `url("${url}")`;
      console.log("🎯 Background set:", url);
    };
    img.onerror = () => {
      console.warn("❌ Could not load background:", url);
      const fallbacks = [
        `../assets/Algolia_${lang}.png`,
        `/assets/Algolia_${lang}.png`,
        `${base}assets/Algolia_en.png`,
      ];
      for (const f of fallbacks) {
        const test = new Image();
        test.onload = () => {
          bg.style.backgroundImage = `url("${f}")`;
          console.log("✅ Background fallback used:", f);
        };
        test.onerror = () => console.warn("↪︎ Fallback failed:", f);
        test.src = f + `?cb=${Date.now()}`;
      }
    };
    img.src = url + `?cb=${Date.now()}`;
  })();

  // ---------- Embedded Messaging helpers ----------
  function compact(obj) {
    const out = {};
    Object.keys(obj || {}).forEach((k) => {
      const v = obj[k];
      if (v !== null && v !== undefined && String(v).trim() !== "") out[k] = v;
    });
    return out;
  }
  function buildPrechatFields() {
    return compact({
      Device: context.device,
      Site_Language: context.sfLanguage, // ensure Salesforce receives 'en_US'
      Page_URL: context.pageUrl,
      Referrer_URL: context.referrer,
      UTM_Source: context.utm_source,
      UTM_Medium: context.utm_medium,
      UTM_Campaign: context.utm_campaign,
      UTM_Term: context.utm_term,
      UTM_Content: context.utm_content,
      Session_ID: context.sessionId,
      First_Seen_At: context.firstSeen,
      Last_Seen_At: context.lastSeen,
      IP_Address: context.ipAddress,
      Country: context.geo?.country,
      Country_Code: context.geo?.countryCode,
      Region: context.geo?.region,
      City: context.geo?.city,
      Timezone: context.geo?.timezone,
    });
  }
  function pushPrechatFields() {
    try {
      if (window.embeddedservice_bootstrap?.prechatAPI?.setHiddenPrechatFields) {
        const fields = buildPrechatFields();
        embeddedservice_bootstrap.prechatAPI.setHiddenPrechatFields(fields);
        console.log("📨 Prechat fields sent:", fields);
      }
    } catch (e) {
      console.warn("Prechat push failed:", e);
    }
  }

  // ---------- ESW ready ----------
  window.addEventListener("onEmbeddedMessagingReady", () => {
    console.log("✅ onEmbeddedMessagingReady");
    try {
      if (window.embeddedservice_bootstrap?.settings) {
        embeddedservice_bootstrap.settings.language = context.sfLanguage; // en_US for English
      }
    } catch (e) {
      console.warn("Could not set ESW language:", e);
    }
    pushPrechatFields();
  });

  // ---------- Update ESW after async geo ----------
  window.addEventListener("truffleContextUpdated", () => {
    pushPrechatFields();
    console.log("🔁 Updated prechat fields with IP/Geo");
  });

  // ---- Load & init ESW exactly once ----
  (function ensureESW() {
    const BOOT_URL =
      "https://tr1755614761355.my.site.com/ESWAlgolia1755631261845/assets/js/bootstrap.min.js";
    const ORG_ID = "00DKY00000Ggx3e";
    const DEPLOY = "Algolia";
    const SNIPPET =
      "https://tr1755614761355.my.site.com/ESWAlgolia1755631261845";
    const SCRT2 = "https://tr1755614761355.my.salesforce-scrt.com";

    if (window.__TRUFFLE_ESW_INITTED) return;

    function setLanguageFromUrl() {
      try {
        embeddedservice_bootstrap.settings.language = context.sfLanguage;
        console.log("🌐 ESW language set to:", context.sfLanguage);
      } catch (e) {
        console.warn("Could not set ESW language:", e);
      }
    }

    function initESW() {
      if (!window.embeddedservice_bootstrap?.init) return false;
      if (window.__TRUFFLE_ESW_INITTED) return true;
      try {
        setLanguageFromUrl();
        embeddedservice_bootstrap.init(ORG_ID, DEPLOY, SNIPPET, {
          scrt2URL: SCRT2,
        });
        window.__TRUFFLE_ESW_INITTED = true;
        console.log("💬 Embedded Messaging initialized");
        return true;
      } catch (err) {
        console.error("Error loading Embedded Messaging:", err);
        return false;
      }
    }

    if (initESW()) return;

    const existing = document.querySelector(`script[src="${BOOT_URL}"]`);
    if (existing) {
      existing.addEventListener("load", initESW);
      existing.addEventListener("error", () =>
        console.error("Failed to load ESW bootstrap:", BOOT_URL)
      );
    } else {
      const s = document.createElement("script");
      s.src = BOOT_URL;
      s.async = true;
      s.onload = initESW;
      s.onerror = () =>
        console.error("Failed to load ESW bootstrap:", BOOT_URL);
      document.head.appendChild(s);
    }

    const start = Date.now();
    const timer = setInterval(() => {
      if (initESW()) clearInterval(timer);
      if (Date.now() - start > 10000) {
        clearInterval(timer);
        console.warn("Timed out waiting for ESW bootstrap.");
      }
    }, 100);
  })();
})();