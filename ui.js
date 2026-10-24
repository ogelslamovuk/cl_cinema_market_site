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
    const copy = () => { if (target.textContent !== source.textContent) target.textContent = source.textContent; };
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
})();
