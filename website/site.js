/* global window, document, AEGIS_CONFIG, AEGIS_I18N */
(function () {
  const cfg = window.AEGIS_CONFIG || {};
  const i18n = window.AEGIS_I18N || { dict: {}, defaultLang: "ru" };
  const LANG_KEY = "aegis_lang";

  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  const setText = (id, text) => {
    const el = document.getElementById(id);
    if (el && text) el.textContent = text;
  };

  const t = (key, lang) => {
    const pack = i18n.dict?.[lang] || i18n.dict?.ru || {};
    return pack[key] ?? i18n.dict?.ru?.[key] ?? key;
  };

  const getLang = () => {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved && i18n.dict?.[saved]) return saved;
    return i18n.defaultLang || "ru";
  };

  const applyI18n = (lang) => {
    document.documentElement.lang = lang;
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (!key) return;
      const value = t(key, lang);
      if (el.tagName === "TITLE") {
        document.title = value;
        return;
      }
      el.textContent = value;
    });
    document.querySelectorAll("[data-lang-set]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.getAttribute("data-lang-set") === lang);
    });
    renderPricing(lang);
    applyPingLabels(lang);
  };

  document.querySelectorAll("[data-lang-set]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const lang = btn.getAttribute("data-lang-set");
      if (!lang || !i18n.dict?.[lang]) return;
      localStorage.setItem(LANG_KEY, lang);
      applyI18n(lang);
    });
  });

  const supportMail = cfg.support?.email || "";
  const supportTg = cfg.support?.telegram || "";

  document.querySelectorAll("[data-support-email]").forEach((el) => {
    if (!supportMail) return;
    if (el.tagName === "A") {
      el.href = `mailto:${supportMail}`;
      el.textContent = supportMail;
    } else {
      el.textContent = supportMail;
    }
  });

  document.querySelectorAll("[data-support-telegram]").forEach((el) => {
    el.hidden = false;
    if (supportTg) {
      el.href = supportTg;
      el.removeAttribute("aria-disabled");
      el.setAttribute("data-i18n", "support.tg");
      el.textContent = t("support.tg", getLang());
    } else {
      el.href = "#";
      el.setAttribute("aria-disabled", "true");
      el.setAttribute("data-i18n", "support.tg.soon");
      el.textContent = t("support.tg.soon", getLang());
      el.addEventListener("click", (e) => e.preventDefault());
    }
  });

  document.querySelectorAll("[data-cabinet]").forEach((el) => {
    const url = cfg.cabinetUrl;
    if (!url) {
      el.setAttribute("aria-disabled", "true");
      el.addEventListener("click", (e) => e.preventDefault());
      return;
    }
    el.href = url;
    el.removeAttribute("aria-disabled");
  });

  const downloads = cfg.downloads || {};
  document.querySelectorAll("[data-download]").forEach((btn) => {
    const key = btn.getAttribute("data-download");
    const url = downloads[key];
    const label = btn.querySelector("[data-download-state]");
    if (url) {
      btn.href = url;
      btn.removeAttribute("aria-disabled");
      if (label) {
        label.setAttribute("data-i18n", "download.get");
        label.textContent = t("download.get", getLang());
      }
    } else {
      btn.href = "#";
      btn.setAttribute("aria-disabled", "true");
      btn.addEventListener("click", (e) => e.preventDefault());
      if (label) {
        label.setAttribute("data-i18n", "download.soon");
        label.textContent = t("download.soon", getLang());
      }
    }
  });

  function renderPricing(lang) {
    const pricingRoot = document.getElementById("pricing-plans");
    const pricingSection = document.getElementById("pricing");
    if (!pricingRoot || !pricingSection) return;
    if (!cfg.pricing?.enabled) {
      pricingSection.hidden = true;
      return;
    }
    pricingSection.hidden = false;
    pricingRoot.innerHTML = "";
    const currency = cfg.pricing.currency || "₽";
    const plans = cfg.pricing.plans || [];
    plans.forEach((plan) => {
      const article = document.createElement("article");
      article.className = `cell pricing-card${plan.highlight ? " pricing-card--hot" : ""}`;
      const name =
        plan.nameKey && t(plan.nameKey, lang) !== plan.nameKey
          ? t(plan.nameKey, lang)
          : plan.name;
      const note =
        plan.noteKey && t(plan.noteKey, lang) !== plan.noteKey
          ? t(plan.noteKey, lang)
          : plan.note || "";
      const showCurrency =
        plan.price !== "—" && plan.price !== "-" && String(plan.price).trim() !== "";
      let priceLabel;
      if (plan.price === "0" || plan.price === 0) {
        priceLabel = `<b>${t("pricing.free", lang)}</b>`;
      } else if (showCurrency) {
        priceLabel = `<b>${plan.price}</b> <span>${currency}</span>`;
      } else {
        priceLabel = `<b>${plan.price}</b>`;
      }
      const badge =
        plan.id === "trial" ? "TRIAL" : plan.highlight ? "SOON" : "LATER";
      article.innerHTML = `
          <div class="label">${badge}</div>
          <h3>${name}</h3>
          <p class="pricing-price">${priceLabel}</p>
          <p>${note}</p>
        `;
      pricingRoot.appendChild(article);
    });
  }

  function applyPingLabels(lang) {
    document.querySelectorAll("[data-ping]").forEach((el) => {
      if (el.dataset.pingValue) {
        el.textContent = `${el.dataset.pingValue} ms`;
        return;
      }
      el.textContent = t("countries.ping.na", lang);
    });
  }

  function setPing(code, value) {
    document.querySelectorAll(`[data-ping="${code}"]`).forEach((el) => {
      if (value == null || value === "" || Number.isNaN(Number(value))) {
        delete el.dataset.pingValue;
        el.textContent = t("countries.ping.na", getLang());
        el.classList.remove("is-live");
        return;
      }
      const n = Math.round(Number(value));
      el.dataset.pingValue = String(n);
      el.textContent = `${n} ms`;
      el.classList.add("is-live");
    });
  }

  async function loadPings() {
    const pingCfg = cfg.pings || {};
    const codes = ["fi", "de", "it", "ee"];
    codes.forEach((code) => {
      document.querySelectorAll(`[data-ping="${code}"]`).forEach((el) => {
        el.textContent = t("countries.ping.loading", getLang());
      });
    });

    if (pingCfg.values && typeof pingCfg.values === "object") {
      Object.entries(pingCfg.values).forEach(([code, value]) => setPing(code, value));
    }

    const endpoint = pingCfg.endpoint;
    if (!endpoint) {
      applyPingLabels(getLang());
      return;
    }

    try {
      const res = await fetch(endpoint, { credentials: "omit" });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      const map = data.pings || data.values || data;
      if (map && typeof map === "object") {
        Object.entries(map).forEach(([code, value]) => setPing(code, value));
      }
    } catch (_err) {
      applyPingLabels(getLang());
    }
  }

  setText("trial-days", cfg.trial?.days != null ? String(cfg.trial.days) : "3");

  const legal = cfg.legal || {};
  const team = legal.teamName || "Aegis Gate team";
  setText("legal-team", team);
  setText("legal-team-inline", team);
  setText("legal-date", legal.offerDate);

  const lang = getLang();
  applyI18n(lang);
  loadPings();
})();
