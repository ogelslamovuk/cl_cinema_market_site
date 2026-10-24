/* Presentation only. Business outputs remain owned by unmodified app.js. */
(() => {
  const panel = document.getElementById("geography-filters");
  const toggle = document.getElementById("filter-toggle");
  const mobile = matchMedia("(max-width: 600px)");
  let open = false;
  function syncFilters() {
    panel.hidden = mobile.matches && !open;
    toggle.setAttribute("aria-expanded", String(!panel.hidden));
  }
  toggle.addEventListener("click", () => { open = !open; syncFilters(); });
  mobile.addEventListener("change", syncFilters);
  panel.addEventListener("keydown", event => {
    if (event.key === "Escape" && mobile.matches) { open = false; syncFilters(); toggle.focus(); }
  });
  function refreshFilterCount() {
    const count = [...panel.querySelectorAll("select")].filter(control => control.value).length;
    document.getElementById("filter-count").textContent = count ? String(count) : "";
  }
  panel.addEventListener("change", refreshFilterCount);
  new MutationObserver(refreshFilterCount).observe(panel, { childList: true, subtree: true });
  refreshFilterCount();
  syncFilters();
  document.querySelectorAll("[data-mirror]").forEach(target => {
    const source = document.getElementById(target.dataset.mirror);
    const copy = () => {
      if (target.textContent !== source.textContent) target.textContent = source.textContent;
      target.closest(".own-metric")?.classList.toggle("has-long-value", source.textContent.length > 12);
    };
    new MutationObserver(copy).observe(source, { childList: true, characterData: true, subtree: true });
    copy();
  });
  const links = [...document.querySelectorAll(".nav-links a")];
  const sections = links.map(link => document.querySelector(link.getAttribute("href")));
  function markSection(section) {
    links.forEach(link => { if (link.hash === `#${section.id}`) link.setAttribute("aria-current", "location"); else link.removeAttribute("aria-current"); });
  }
  function syncSection() {
    // Read every section, rather than only changed observer entries. The reading
    // line includes the two-row mobile header and the existing anchor spacing.
    const line = Math.max(document.querySelector(".app-chrome").getBoundingClientRect().bottom + 24, innerHeight * .4);
    const current = sections.filter(section => section.getBoundingClientRect().top <= line).at(-1) || sections[0];
    markSection(current);
  }
  let sectionFrame;
  function queueSectionSync() {
    if (sectionFrame) return;
    sectionFrame = requestAnimationFrame(() => { sectionFrame = null; syncSection(); });
  }
  links.forEach(link => link.addEventListener("click", () => markSection(document.querySelector(link.hash))));
  addEventListener("hashchange", queueSectionSync);
  addEventListener("scroll", queueSectionSync, { passive: true });
  addEventListener("resize", queueSectionSync);
  syncSection();
  const marketMoney = document.getElementById("revenue");
  function fitMarketMoney() {
    marketMoney.closest(".volume-metric").classList.toggle("has-long-value", marketMoney.textContent.length > 12);
  }
  new MutationObserver(fitMarketMoney).observe(marketMoney, { childList: true, characterData: true, subtree: true });
  fitMarketMoney();

  // Project already owns the percentages. This presentation layer validates the
  // existing displayed result and state; it never calculates a market ratio.
  function syncShareDiscs() {
    const banner = document.getElementById("market-quality-state");
    const load = document.getElementById("data-load-state");
    const busy = document.body.getAttribute("aria-busy") === "true" || (!load.hidden && load.classList.contains("is-loading"));
    const failed = !load.hidden && load.classList.contains("is-error");
    let quality = banner.dataset.quality;
    try {
      const existing = selectedMarketQuality();
      if (!["GREEN", "YELLOW"].includes(existing.status)) quality = existing.status;
    } catch { quality = "UNKNOWN"; }
    const proven = ["GREEN", "YELLOW"].includes(quality) && !banner.hidden && document.getElementById("unavailable-day").hidden;
    for (const [meterId, valueId] of [["share-orbit", "share"], ["revenue-orbit", "revenue-share"]]) {
      const meter = document.getElementById(meterId);
      const text = document.getElementById(valueId).textContent.trim();
      const match = /^(\d+(?:[.,]\d+)?)%$/.exec(text);
      const value = match ? Number(match[1].replace(",", ".")) : NaN;
      const valid = proven && !busy && !failed && Number.isFinite(value) && value >= 0 && value <= 100;
      meter.style.setProperty("--dial-share", valid ? value : 0);
      meter.dataset.dialState = busy ? "loading" : failed ? "error" : !valid ? "unavailable" : quality === "YELLOW" ? "provisional" : "verified";
      if (valid) {
        meter.setAttribute("aria-valuenow", String(value));
        meter.setAttribute("aria-valuetext", `${text} mooon${quality === "YELLOW" ? ", неполная выборка" : ""}`);
      } else {
        meter.removeAttribute("aria-valuenow");
        meter.setAttribute("aria-valuetext", busy ? "Доля загружается" : failed ? "Доля недоступна: ошибка данных" : "Доля не подтверждена");
      }
    }
  }
  let shareFrame;
  function queueShareSync() {
    if (shareFrame) return;
    shareFrame = requestAnimationFrame(() => { shareFrame = null; syncShareDiscs(); });
  }
  const shareObserver = new MutationObserver(queueShareSync);
  ["share", "revenue-share", "market-quality-state", "data-load-state", "unavailable-day"].forEach(id => {
    shareObserver.observe(document.getElementById(id), { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ["hidden", "class", "data-quality"] });
  });
  shareObserver.observe(document.body, { attributes: true, attributeFilter: ["aria-busy"] });
  syncShareDiscs();
})();
