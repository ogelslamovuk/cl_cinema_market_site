/* Read-only mooon media projection. No analytics or classification lives here. */
(() => {
  const catalogFile = "catalog.feabac5f2334c185.json";
  const catalogSha = "feabac5f2334c185bbdb08bf529344f7b166d2c077d09b93cd31bc9fb8613099";
  const base = new URL("assets/posters/", document.currentScript.src);
  const hex = buffer => [...new Uint8Array(buffer)].map(n => n.toString(16).padStart(2, "0")).join("");
  const digest = async bytes => hex(await crypto.subtle.digest("SHA-256", bytes));
  const icon = '<svg viewBox="0 0 24 32" aria-hidden="true" focusable="false"><path d="M5 3h14v26H5zM8 7h8M8 25h8M3 8h2m14 0h2M3 16h2m14 0h2M3 24h2m14 0h2" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>';
  let epoch = 0, context = null;
  const imageCache = new Map();
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) {
      observer.unobserve(entry.target);
      const work = entry.target._posterWork;
      if (work) loadImage(entry.target, work.item, work.epoch);
    }
  }, { rootMargin: "120px" });

  function placeholder(slot, state, reason) {
    slot.replaceChildren();
    slot.innerHTML = icon;
    slot.className = `film-poster ${state === "na" ? "is-na" : "is-missing"}`;
    slot.dataset.posterState = state;
    slot.dataset.posterLabel = state === "na" ? "N/A" : "—";
    slot.setAttribute("role", "img");
    slot.removeAttribute("aria-hidden");
    slot.setAttribute("aria-label", reason);
    slot.title = reason;
    delete slot.dataset.filmId;
    delete slot.dataset.mediaId;
  }
  async function getBytes(url, timeout) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, { signal: controller.signal, credentials: "same-origin" });
      if (!response.ok) throw Error("Media unavailable");
      return { bytes: await response.arrayBuffer(), type: response.headers.get("content-type") || "" };
    } finally { clearTimeout(timer); }
  }
  const catalog = (async () => {
    const { bytes } = await getBytes(new URL(catalogFile, base), 8000);
    if (await digest(bytes) !== catalogSha) throw Error("Catalog integrity mismatch");
    const data = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (data.version !== 1 || data.source !== "mooon-readonly-db" || !Array.isArray(data.items)) throw Error("Invalid catalog");
    const sessions = new Map(), ids = new Set();
    for (const item of data.items) {
      if (!Number.isSafeInteger(item.film_id) || item.film_id <= 0 || ids.has(item.film_id) || !Array.isArray(item.aliases) || !item.aliases.every(a => typeof a === "string") || !Array.isArray(item.session_ids)) throw Error("Invalid film identity");
      ids.add(item.film_id);
      if (item.state === "available" && (!Number.isSafeInteger(item.media_id) || !/^[a-f0-9]{64}$/.test(item.asset_sha256) || item.asset !== `f${item.film_id}-m${item.media_id}-${item.asset_sha256.slice(0,16)}.webp` || item.width !== 96 || item.height !== 144)) throw Error("Invalid media identity");
      for (const id of item.session_ids) {
        if (!/^\d+$/.test(id) || sessions.has(id)) throw Error("Ambiguous session identity");
        sessions.set(id, item);
      }
      Object.freeze(item);
    }
    return sessions;
  })().catch(() => null);

  function resolve(film, ownRows, sessions) {
    const rows = ownRows.filter(row => row.film === film.name);
    if (!rows.length) return null;
    const items = rows.map(row => sessions.get(String(row.session_id)));
    if (items.some(item => !item || !item.aliases.includes(film.name))) return null;
    if (new Set(items.map(item => item.film_id)).size !== 1) return null;
    return items[0];
  }
  async function loadImage(slot, item, generation) {
    if (!slot.isConnected || generation !== epoch) return;
    try {
      if (!imageCache.has(item.asset)) imageCache.set(item.asset, (async () => {
        const { bytes, type } = await getBytes(new URL(item.asset, base), 10000);
        if (!type.toLowerCase().startsWith("image/webp") || bytes.byteLength > 100000 || await digest(bytes) !== item.asset_sha256) throw Error("Image integrity mismatch");
        const blob = new Blob([bytes], { type: "image/webp" });
        const url = URL.createObjectURL(blob);
        const check = new Image();
        check.src = url;
        try {
          await check.decode();
          if (check.naturalWidth !== 96 || check.naturalHeight !== 144) throw Error("Invalid image dimensions");
        } catch (error) { URL.revokeObjectURL(url); throw error; }
        return url;
      })());
      const url = await imageCache.get(item.asset);
      if (!slot.isConnected || generation !== epoch) return;
      const image = new Image(32,48);
      image.alt = ""; image.loading = "lazy"; image.decoding = "async"; image.src = url;
      image.addEventListener("error", () => { if (slot.isConnected && generation === epoch) placeholder(slot, "missing", "Постер недоступен: изображение не загружено"); }, { once: true });
      slot.replaceChildren(image);
      slot.className = "film-poster is-available";
      slot.dataset.posterState = "available";
      slot.dataset.filmId = String(item.film_id); slot.dataset.mediaId = String(item.media_id);
      slot.setAttribute("aria-label", `Постер mooon: ${item.canonical_title}`);
      slot.title = `Постер mooon: ${item.canonical_title}`;
    } catch {
      if (slot.isConnected && generation === epoch) placeholder(slot, "missing", "Постер недоступен: изображение не подтверждено");
    }
  }
  function render(films, ownRows) {
    const generation = ++epoch;
    observer.disconnect();
    context = { films, ownRows: ownRows.map(({ film, session_id }) => ({ film, session_id })) };
    const current = context;
    const cells = [...document.querySelectorAll("#films-table .table-row:not(.header) .film-poster")];
    for (let i=0; i<cells.length; i++) {
      const film = films[i], slot = cells[i];
      const competitor = film.releaseScope === "competitors";
      placeholder(slot, competitor ? "na" : "pending", competitor ? "N/A — только конкуренты" : "Постер mooon загружается");
    }
    catalog.then(sessions => {
      if (generation !== epoch || current !== context) return;
      cells.forEach((slot,i) => {
        const film = films[i];
        if (film.releaseScope === "competitors" || !slot.isConnected) return;
        const item = sessions && resolve(film, current.ownRows, sessions);
        if (!item || item.state !== "available") {
          placeholder(slot, "missing", !sessions ? "Каталог постеров недоступен" : !item ? "Постер недоступен: идентичность фильма не подтверждена" : "Постер недоступен в mooon");
          return;
        }
        slot._posterWork = { item, epoch: generation };
        observer.observe(slot);
      });
    });
  }
  addEventListener("pagehide", event => { if (!event.persisted) for (const promise of imageCache.values()) promise.then(URL.revokeObjectURL).catch(() => {}); });
  globalThis.MarketPosters = Object.freeze({ render });
})();
