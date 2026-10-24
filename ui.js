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
  panel.addEventListener("change", () => {
    const count = [...panel.querySelectorAll("select")].filter(control => control.value).length;
    document.getElementById("filter-count").textContent = count ? String(count) : "";
  });
  syncFilters();
  document.querySelectorAll("[data-mirror]").forEach(target => {
    const source = document.getElementById(target.dataset.mirror);
    const copy = () => { if (target.textContent !== source.textContent) target.textContent = source.textContent; };
    new MutationObserver(copy).observe(source, { childList: true, characterData: true, subtree: true });
    copy();
  });
  const links = [...document.querySelectorAll(".nav-links a")];
  const sections = links.map(link => document.querySelector(link.getAttribute("href")));
  const observer = new IntersectionObserver(entries => {
    const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
    if (!visible) return;
    links.forEach(link => { if (link.hash === `#${visible.target.id}`) link.setAttribute("aria-current", "location"); else link.removeAttribute("aria-current"); });
  }, { rootMargin: "-110px 0px -65% 0px" });
  sections.forEach(section => observer.observe(section));
})();
