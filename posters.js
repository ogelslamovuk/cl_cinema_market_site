/* Poster identity is the film, not a day's session list. */
(() => {
  const base = new URL("assets/posters/", document.currentScript.src);
  let request, generation = 0;
  const sourceUrl = (value) => {
    if (typeof value !== "string") return null;
    let url;
    try { url = new URL(value, base); } catch { return null; }
    if (url.origin === base.origin && url.pathname.startsWith(base.pathname) && /^f\d+-m\d+-[a-f0-9]{16}\.webp$/.test(value)) return url.href;
    return url.protocol === "https:" && ["rest.mooon.by", "i.gyazo.com"].includes(url.hostname)
      && !url.username && !url.password && !url.search && !url.hash && (!url.port || url.port === "443") ? url.href : null;
  };
  function catalog() {
    if (!request) request = fetch(new URL("catalog.json", base), { cache: "no-cache" }).then(async response => {
      if (!response.ok) throw Error("Poster catalog unavailable");
      const data = await response.json();
      if (data.version !== 2 || data.source !== "mooon-readonly-db" || !Array.isArray(data.items)) throw Error("Invalid poster catalog");
      const byId = new Map(), aliases = new Map();
      for (const item of data.items) {
        if (!Number.isSafeInteger(item.film_id) || item.film_id <= 0 || byId.has(item.film_id) || !Array.isArray(item.aliases)) throw Error("Invalid poster identity");
        const entry = { ...item, src: sourceUrl(item.src) };
        byId.set(item.film_id, entry);
        for (const name of item.aliases) {
          if (typeof name !== "string" || !name) throw Error("Invalid poster alias");
          aliases.set(name, aliases.has(name) && aliases.get(name)?.film_id !== item.film_id ? null : entry);
        }
      }
      return { byId, aliases };
    }).catch(() => { request = null; return null; });
    return request;
  }
  function placeholder(slot, state, reason) {
    slot.replaceChildren();
    slot.className = `film-poster ${state === "na" ? "is-na" : state === "pending" ? "is-loading" : "is-missing"}`;
    slot.dataset.posterState = state;
    slot.dataset.posterLabel = state === "na" ? "N/A" : "—";
    slot.removeAttribute("aria-hidden"); slot.setAttribute("role", "img");
    slot.setAttribute("aria-label", reason); slot.title = reason;
    delete slot.dataset.filmId; delete slot.dataset.mediaId;
  }
  function resolve(film, rows, data) {
    const own = rows.filter(row => row.film === film.name);
    if (!own.length) return null;
    const ids = [...new Set(own.map(row => row.film_id).filter(id => id != null).map(Number))];
    if (ids.length) {
      const item = ids.length === 1 && own.every(row => row.film_id != null) ? data.byId.get(ids[0]) : null;
      return item?.aliases.includes(film.name) ? item : null;
    }
    return data.aliases.get(film.name); // Exact, DB-confirmed and unique; never fuzzy.
  }
  function render(films, ownRows) {
    const current = ++generation;
    const cells = [...document.querySelectorAll("#films-table .table-row:not(.header) .film-poster")];
    cells.forEach((slot, index) => placeholder(slot, films[index].releaseScope === "competitors" ? "na" : "pending",
      films[index].releaseScope === "competitors" ? "N/A — только конкуренты" : "Постер mooon загружается"));
    catalog().then(data => {
      if (current !== generation) return;
      cells.forEach((slot, index) => {
        const film = films[index];
        if (!slot.isConnected || film.releaseScope === "competitors") return;
        const item = data && resolve(film, ownRows, data);
        if (!item?.src) { placeholder(slot, "missing", data ? "В mooon нет подтверждённого постера этого фильма" : "Каталог постеров временно недоступен"); return; }
        const image = new Image(32, 48);
        image.alt = ""; image.loading = "lazy"; image.decoding = "async"; image.referrerPolicy = "no-referrer";
        image.onload = () => {
          if (current !== generation || !slot.isConnected || !slot.contains(image)) return;
          slot.className = "film-poster is-available"; slot.dataset.posterState = "available";
        };
        image.onerror = () => { if (current === generation && slot.isConnected && slot.contains(image)) placeholder(slot, "missing", "Постер mooon временно недоступен"); };
        slot.replaceChildren(image); slot.dataset.filmId = String(item.film_id); slot.dataset.mediaId = String(item.media_id || "");
        slot.title = `Постер mooon: ${item.title}`; slot.setAttribute("aria-label", slot.title);
        image.src = item.src;
      });
    });
  }
  globalThis.MarketPosters = Object.freeze({ render });
})();
