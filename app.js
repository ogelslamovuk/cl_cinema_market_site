const nf = new Intl.NumberFormat("ru-RU");
const money = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "BYN",
  maximumFractionDigits: 0,
});

let source = null;
let reportingDateSet = new Set();
let periodDateOptions = [];
let periodWeekOptions = [];
let periodMode = "days";
let dynamicUnavailableDates = new Map();
let dataMode = "legacy";
let partitionIndex = null;
let activePeriodValue = "";
let periodRequestId = 0;
const loadedDays = new Map();
const pendingDays = new Map();
const $ = (id) => document.getElementById(id);
const esc = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");
const unique = (rows, key) => [...new Set(rows.map((row) => row[key]).filter(Boolean))]
  .sort((a, b) => String(a).localeCompare(String(b), "ru"));
const REPORTING_START_DATE = "2026-08-04";
const UNAVAILABLE_DATES = new Map([
  ["2026-08-11", {
    title: "Нет данных за 11 августа",
    message: "Сбор был прерван из-за технического сбоя у источника.",
  }],
  ["2026-08-20", {
    title: "Нет данных за 20 августа",
    message: "Финальное покрытие рынка ниже порога 87%, поэтому день не опубликован как валидный.",
  }],
]);

function setDataLoadState(kind, message) {
  const element = $("data-load-state");
  if (!element) return;
  element.hidden = !message;
  element.classList.toggle("is-loading", kind === "loading");
  element.classList.toggle("is-error", kind === "error");
  element.setAttribute("role", kind === "error" ? "alert" : "status");
  element.setAttribute("aria-busy", String(kind === "loading"));
  element.textContent = message || "";
  document.body.setAttribute("aria-busy", String(kind === "loading"));
}

function clearDataLoadState() {
  setDataLoadState("idle", "");
}

function normalizeSha256(value) {
  return String(value || "").trim().replace(/^sha256:/i, "").toLowerCase();
}

async function sha256Hex(bytes) {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Проверка целостности данных недоступна в этом браузере.");
  }
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function resolveUrl(value, base = document.baseURI) {
  return new URL(value, base).toString();
}

function marketIndexUrl(legacyUrl) {
  if (document.body.dataset.indexUrl) return resolveUrl(document.body.dataset.indexUrl);
  return resolveUrl(String(legacyUrl).replace(/market\.json(?:[?#].*)?$/, "market-index.json"));
}

function normalizeRows(rows) {
  for (const row of rows) row.region = canonicalRegion(row.region, row.city);
  return rows;
}

function rowsFromDayPayload(payload, date) {
  const marketRows = payload.market_sessions ?? payload.sessions;
  const silverRows = payload.silver_screen?.sessions ?? [];
  if (!Array.isArray(marketRows) || !Array.isArray(silverRows)) {
    throw new Error(`Некорректный формат данных за ${formatDay(date)}.`);
  }
  if ([...marketRows, ...silverRows].some((row) => row.date !== date)) {
    throw new Error(`Файл за ${formatDay(date)} содержит данные другой даты.`);
  }
  return {
    marketRows: normalizeRows(marketRows),
    silverRows: normalizeRows(silverRows),
  };
}

async function fetchVerifiedDay(date) {
  if (loadedDays.has(date)) return loadedDays.get(date);
  if (pendingDays.has(date)) return pendingDays.get(date);
  const entry = partitionIndex?.days?.[date];
  if (!entry?.url || !entry?.sha256) {
    throw new Error(`В индексе нет проверяемого файла за ${formatDay(date)}.`);
  }
  const expectedHash = normalizeSha256(entry.sha256);
  if (!/^[a-f0-9]{64}$/.test(expectedHash)) {
    throw new Error(`Некорректная контрольная сумма файла за ${formatDay(date)}.`);
  }
  const request = (async () => {
    const response = await fetch(resolveUrl(entry.url, partitionIndex.__url), { cache: "no-store" });
    if (!response.ok) throw new Error(`Не удалось загрузить ${formatDay(date)}: HTTP ${response.status}.`);
    const bytes = await response.arrayBuffer();
    const actualHash = await sha256Hex(bytes);
    if (actualHash !== expectedHash) {
      throw new Error(`Контрольная сумма данных за ${formatDay(date)} не совпала.`);
    }
    let payload;
    try {
      payload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    } catch (error) {
      throw new Error(`Файл данных за ${formatDay(date)} повреждён.`);
    }
    const rows = rowsFromDayPayload(payload, date);
    loadedDays.set(date, rows);
    source.sessions.push(...rows.marketRows);
    source.silver_screen.sessions.push(...rows.silverRows);
    return rows;
  })().finally(() => pendingDays.delete(date));
  pendingDays.set(date, request);
  return request;
}

function datesForPeriod(value) {
  if (value.startsWith("d:")) {
    const date = value.slice(2);
    return isUnavailableDate(date) ? [] : [date];
  }
  const cutoff = publishedPeriodCutoff();
  const dates = (partitionIndex?.reporting_dates || []).filter((date) => cutoff && date <= cutoff);
  if (value.startsWith("w:")) {
    const week = value.slice(2);
    return dates.filter((date) => !isUnavailableDate(date) && releaseWeekStartForDay(date) === week);
  }
  if (value === "r:last7") {
    const end = minskDay(-1);
    const start = addDays(end, -6);
    return dates.filter((date) => !isUnavailableDate(date) && date >= start && date <= end);
  }
  return dates.filter((date) => !isUnavailableDate(date));
}

async function loadPartitionDates(dates, requestId) {
  const queue = [...new Set(dates)]
    .filter((date) => partitionIndex.days?.[date] && !loadedDays.has(date));
  if (!queue.length) return;
  let completed = 0;
  const total = queue.length;
  const updateProgress = () => {
    if (requestId === periodRequestId) {
      setDataLoadState("loading", `Загрузка данных: ${completed} из ${total}`);
    }
  };
  updateProgress();
  const workers = Array.from({ length: Math.min(4, total) }, async () => {
    while (queue.length) {
      const date = queue.shift();
      await fetchVerifiedDay(date);
      completed += 1;
      updateProgress();
    }
  });
  const results = await Promise.allSettled(workers);
  const failure = results.find((result) => result.status === "rejected");
  if (failure) throw failure.reason;
}

function unavailableNotice(date) {
  return UNAVAILABLE_DATES.get(date) || dynamicUnavailableDates.get(date);
}

function isUnavailableDate(date) {
  return Boolean(unavailableNotice(date));
}

function selectedUnavailableDate() {
  const period = $("period").value;
  if (!period.startsWith("d:")) return null;
  const date = period.slice(2);
  const notice = unavailableNotice(date);
  return notice ? { date, ...notice } : null;
}

function renderAvailabilityState() {
  const unavailable = selectedUnavailableDate();
  document.body.classList?.toggle("data-unavailable", Boolean(unavailable));
  $("unavailable-day").hidden = !unavailable;
  if (unavailable && $("market-quality-state")) $("market-quality-state").hidden = true;
  if (!unavailable) return false;
  $("unavailable-day-title").textContent = unavailable.title;
  $("unavailable-day-message").textContent = unavailable.message;
  return true;
}

function dateParts(date) {
  return String(date).split("-").map((value) => Number(value));
}

function dateFromIsoDay(date) {
  const [year, month, day] = dateParts(date);
  return new Date(year, month - 1, day);
}

function isoDayFromUtcDate(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const [year, month, day] = dateParts(date);
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  return isoDayFromUtcDate(utc);
}

function minskDay(offsetDays = 0) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Europe/Minsk",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const utc = new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day) + offsetDays));
  return isoDayFromUtcDate(utc);
}

function formatDay(date) {
  return dateFromIsoDay(date).toLocaleDateString("ru-RU");
}

function formatLongDay(date) {
  return dateFromIsoDay(date).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
  });
}

function formatMonth(date) {
  return dateFromIsoDay(date).toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
}

function formatWeekday(date) {
  return dateFromIsoDay(date).toLocaleDateString("ru-RU", { weekday: "short" }).replace(".", "");
}

function releaseWeekLabel(start) {
  if (!start) return "";
  return `${formatDay(start)} — ${formatDay(addDays(start, 6))}`;
}

function releaseWeekStartForDay(date) {
  const day = dateFromIsoDay(date).getDay();
  const diffFromThursday = (day + 3) % 7;
  return addDays(date, -diffFromThursday);
}

function selectPeriod(value) {
  $("period").value = value;
  $("period").dispatchEvent(new Event("change", { bubbles: true }));
  closePeriodPopover();
}

function closePeriodPopover() {
  const popover = $("period-popover");
  if (!popover) return;
  popover.hidden = true;
  $("period-trigger")?.setAttribute("aria-expanded", "false");
}

function togglePeriodPopover() {
  const popover = $("period-popover");
  if (!popover) return;
  popover.hidden = !popover.hidden;
  $("period-trigger")?.setAttribute("aria-expanded", String(!popover.hidden));
}

function periodLabel(value) {
  if (!value) return "Весь период";
  if (value === "r:last7") return "Последние 7 дней";
  if (value.startsWith("d:")) {
    const date = value.slice(2);
    return `${formatDay(date)}${isUnavailableDate(date) ? " · нет данных" : ""}`;
  }
  if (value.startsWith("w:")) return `Прокатная неделя ${releaseWeekLabel(value.slice(2))}`;
  return value;
}

function setPeriodMode(mode) {
  periodMode = mode;
  document.querySelectorAll("[data-period-mode]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.periodMode === mode);
  });
  $("period-days")?.classList.toggle("is-active", mode === "days");
  $("period-weeks")?.classList.toggle("is-active", mode === "weeks");
}

function renderPeriodControl() {
  const currentValue = $("period").value;
  $("period-current").textContent = periodLabel(currentValue);
  $("period-all").classList.toggle("is-selected", currentValue === "");
  const yesterdayValue = `d:${minskDay(-1)}`;
  const currentWeekValue = `w:${releaseWeekStartForDay(minskDay(0))}`;
  document.querySelectorAll("[data-period-preset]").forEach((button) => {
    const preset = button.dataset.periodPreset;
    button.classList.toggle("is-selected",
      preset === currentValue
      || (preset === "yesterday" && currentValue === yesterdayValue)
      || (preset === "current-week" && currentValue === currentWeekValue));
  });

  const months = new Map();
  for (const date of periodDateOptions) {
    const month = date.slice(0, 7);
    if (!months.has(month)) months.set(month, []);
    months.get(month).push(date);
  }

  $("period-days").innerHTML = [...months.entries()].map(([, dates]) => `
    <section class="period-month">
      <h3>${esc(formatMonth(dates[0]))}</h3>
      <div class="period-day-list">
        ${dates.map((date) => {
          const unavailable = isUnavailableDate(date);
          return `
            <button
              type="button"
              class="period-day${currentValue === `d:${date}` ? " is-selected" : ""}${unavailable ? " is-unavailable" : ""}"
              data-period-value="d:${esc(date)}"
              onclick="selectPeriod('d:${esc(date)}')"
            >
              <span>${esc(formatDay(date))}</span>
              <small>${esc(formatWeekday(date))}</small>
              ${unavailable ? '<b>нет данных</b>' : ""}
            </button>`;
        }).join("")}
      </div>
    </section>
  `).join("");

  $("period-weeks").innerHTML = periodWeekOptions.map((week) => `
    <button
      type="button"
      class="period-week${currentValue === `w:${week.value}` ? " is-selected" : ""}"
      data-period-value="w:${esc(week.value)}"
      onclick="selectPeriod('w:${esc(week.value)}')"
    >
      <span>Прокатная неделя</span>
      <strong>${esc(releaseWeekLabel(week.value))}</strong>
      <small>${nf.format(week.days)} ${week.days === 1 ? "день" : "дней"} в отчёте</small>
    </button>
  `).join("") || '<p class="period-empty">Прокатные недели появятся после закрытия данных.</p>';
}

const REGION_ALIASES = new Map([
  ["Минская обл.", "Минская область"],
  ["Гродненская обл.", "Гродненская область"],
]);

function canonicalRegion(value, city) {
  if (String(city).trim().toLocaleLowerCase("ru") === "минск") return "Минск";
  return REGION_ALIASES.get(value) || value;
}

function regionOrder(values) {
  const priority = new Map([
    ["Минск", 0],
    ["Гродненская область", 1],
  ]);
  return [...values].sort((a, b) => {
    const rankA = priority.get(a) ?? 10;
    const rankB = priority.get(b) ?? 10;
    return rankA - rankB || String(a).localeCompare(String(b), "ru");
  });
}

function options(id, values, label) {
  const el = $(id);
  el.innerHTML = `<option value="">${esc(label)}</option>`
    + values.map((value) => `<option value="${esc(value)}">${esc(value)}</option>`).join("");
}

function selectedRows() {
  return filterRows(source.sessions || []);
}

function selectedSilverRows() {
  return filterRows(source.silver_screen?.sessions || []);
}

function publishedPeriodCutoff() {
  // Publication metadata is authoritative. Never derive readiness from row
  // presence, today's clock, or browser-side coverage arithmetic.
  const published = partitionIndex?.default_date;
  if (/^\d{4}-\d{2}-\d{2}$/.test(published || "")) return published;
  return Object.entries(source?.market_quality_by_date || {})
    .filter(([date, assessment]) => /^\d{4}-\d{2}-\d{2}$/.test(date)
      && ["GREEN", "YELLOW"].includes(assessment?.status) && assessment.publishable === true)
    .map(([date]) => date).sort().at(-1) || null;
}

function filterRows(inputRows) {
  let rows = inputRows.filter((row) => reportingDateSet.has(row.date) && !isUnavailableDate(row.date));
  const period = $("period").value;
  if (!period.startsWith("d:")) {
    const cutoff = publishedPeriodCutoff();
    rows = rows.filter((row) => cutoff && row.date <= cutoff);
  }
  if (period.startsWith("d:")) rows = rows.filter((row) => row.date === period.slice(2));
  if (period.startsWith("w:")) rows = rows.filter((row) => row.release_week === period.slice(2));
  if (period === "r:last7") {
    const end = minskDay(-1);
    const start = addDays(end, -6);
    rows = rows.filter((row) => row.date >= start && row.date <= end);
  }
  for (const key of ["region", "city", "cinema", "film"]) {
    const value = $(key).value;
    if (value) rows = rows.filter((row) => String(row[key]) === value);
  }
  return rows;
}

function rowsForSelectedPeriod() {
  let rows = [...(source.sessions || []), ...(source.silver_screen?.sessions || [])]
    .filter((row) => reportingDateSet.has(row.date) && !isUnavailableDate(row.date));
  const period = $("period").value;
  if (!period.startsWith("d:")) {
    const cutoff = publishedPeriodCutoff();
    rows = rows.filter((row) => cutoff && row.date <= cutoff);
  }
  if (period.startsWith("d:")) rows = rows.filter((row) => row.date === period.slice(2));
  if (period.startsWith("w:")) rows = rows.filter((row) => row.release_week === period.slice(2));
  if (period === "r:last7") {
    const end = minskDay(-1);
    const start = addDays(end, -6);
    rows = rows.filter((row) => row.date >= start && row.date <= end);
  }
  return rows;
}

function refreshFilterOptions() {
  let rows = rowsForSelectedPeriod();
  const filters = [
    ["region", "region", "Все области"],
    ["city", "city", "Все города"],
    ["cinema", "cinema", "Все кинотеатры"],
    ["film", "film", "Все фильмы"],
  ];
  for (const [id, key, label] of filters) {
    const current = $(id).value;
    const values = key === "region" ? regionOrder(unique(rows, key)) : unique(rows, key);
    options(id, values, label);
    if (current && values.includes(current)) $(id).value = current;
    const selected = $(id).value;
    if (selected) rows = rows.filter((row) => String(row[key]) === selected);
  }
}

function ticketValue(row) {
  return row.tickets_exact ?? row.tickets_estimate ?? null;
}

function providerForSession(row) {
  const provider = String(row?.provider || "").toLocaleLowerCase("ru");
  if (provider === "skyline") return "skyline";
  if (provider === "koronaticket" || provider === "korona") return "koronaticket";
  if (provider === "bycard" || provider === "24afisha") return "bycard";
  if (String(row?.sid || "").toLocaleLowerCase("ru").startsWith("koronaticket:")) {
    return "koronaticket";
  }
  const cinemaId = Number(row?.cinema_id);
  const cinema = String(row?.cinema || "").toLocaleLowerCase("ru");
  if (cinemaId === 5179 || cinemaId === 5180 || cinema.includes("skyline")) {
    return "skyline";
  }
  return "bycard";
}

function competitorName(row) {
  // Provider is the confirmed owner; a display-name change must not move sales.
  const provider = String(row?.provider || "").toLocaleLowerCase("ru");
  if (provider === "skyline") return "Skyline";
  const name = String(row?.cinema || "").toLocaleLowerCase("ru");
  if (name.includes("замок")) return "Замок";
  if (name.includes("корона-сити") || name.includes("корона сити")) return "Корона-Сити";
  if (!provider && name.includes("skyline")) return "Skyline";
  if (name.includes("falcon club")) return "Falcon Club";
  if (name.includes("prizma")) return "Prizma";
  return "КВП";
}

function renderCompetitors(bycardRows, mooonRows) {
  const sharesAllowed = ["GREEN", "YELLOW"].includes(selectedMarketQuality().status);
  const order = ["mooon", "Skyline", "Falcon Club", "Prizma", "КВП", "Замок", "Корона-Сити"];
  const groups = Object.fromEntries(order.map((name) => [name, {
    name, sessions: 0, measured: 0, tickets: 0,
    revenueMin: 0, revenueMax: 0,
  }]));
  for (const row of mooonRows) {
    const group = groups.mooon;
    group.sessions += 1;
    group.measured += 1;
    group.tickets += row.tickets || 0;
    group.revenueMin += row.revenue_byn || 0;
    group.revenueMax += row.revenue_byn || 0;
  }
  for (const row of bycardRows) {
    const group = groups[competitorName(row)];
    group.sessions += 1;
    const tickets = ticketValue(row);
    if (tickets === null) continue;
    group.measured += 1;
    group.tickets += tickets;
    group.revenueMin += row.revenue_exact_byn ?? row.revenue_estimate_min_byn ?? 0;
    group.revenueMax += row.revenue_exact_byn ?? row.revenue_estimate_max_byn ?? 0;
  }
  const marketTickets = order.reduce((sum, name) => sum + groups[name].tickets, 0);
  const marketRevenueMax = order.reduce((sum, name) => sum + groups[name].revenueMax, 0);
  $("competitor-cards").innerHTML = order.map((name) => {
    const group = groups[name];
    const ticketShare = sharesAllowed && marketTickets ? group.tickets / marketTickets * 100 : null;
    const revenueShare = sharesAllowed && marketRevenueMax
      ? `${(group.revenueMax / marketRevenueMax * 100).toFixed(1)}%`
      : "—";
    const coverage = group.sessions ? group.measured / group.sessions * 100 : null;
    const quality = name === "mooon"
      ? "данные mooon"
      : `${group.measured} из ${group.sessions} сеансов`;
    return `<article class="competitor-card${name === "mooon" ? " is-mooon" : ""}">
      <header><span>${esc(name)}</span><small>${esc(quality)}</small></header>
      <dl>
        <div><dt>Билеты</dt><dd>${nf.format(group.tickets)}</dd></div>
        <div><dt>Доля билетов</dt><dd>${ticketShare === null ? "—" : `${ticketShare.toFixed(1)}%`}</dd></div>
        <div><dt>Доля кассы</dt><dd>${revenueShare}</dd></div>
      </dl>
      <div class="competitor-meter" aria-hidden="true"><i style="width:${ticketShare ?? 0}%"></i></div>
      ${coverage !== null && coverage < 100 ? `<b>покрытие ${coverage.toFixed(1)}%</b>` : ""}
    </article>`;
  }).join("");
}

function grouped(rows, key) {
  const groups = {};
  for (const row of rows) {
    const name = row[key] ?? "Не определено";
    if (!groups[name]) {
      groups[name] = {
        name,
        tickets: 0,
        exactTickets: 0,
        estimatedTickets: 0,
        revenue: 0,
        sessions: 0,
        measuredSessions: 0,
      };
    }
    const group = groups[name];
    group.sessions += 1;
    const tickets = ticketValue(row);
    if (tickets !== null) group.measuredSessions += 1;
    if (row.tickets_exact !== null) group.exactTickets += row.tickets_exact;
    if (row.tickets_estimate !== null) group.estimatedTickets += row.tickets_estimate;
    group.tickets += tickets ?? 0;
    group.revenue += row.revenue_exact_byn ?? row.revenue_estimate_max_byn ?? 0;
  }
  return Object.values(groups).sort((a, b) => b.tickets - a.tickets);
}

function filmBreakdown(bycardRows, silverRows) {
  const groups = {};
  const get = (name) => {
    if (!groups[name]) {
      groups[name] = {
        name,
        bycardTickets: 0,
        silverTickets: 0,
        bycardRevenue: 0,
        silverRevenue: 0,
        hasCompetitors: false,
        hasMooon: false,
      };
    }
    return groups[name];
  };
  for (const row of bycardRows) {
    const group = get(row.film ?? "Не определено");
    group.hasCompetitors = true;
    group.bycardTickets += ticketValue(row) ?? 0;
    group.bycardRevenue += row.revenue_exact_byn ?? row.revenue_estimate_max_byn ?? 0;
  }
  for (const row of silverRows) {
    const group = get(row.film ?? "Не определено");
    group.hasMooon = true;
    group.silverTickets += row.tickets;
    group.silverRevenue += row.revenue_byn;
  }
  const totalTickets = Object.values(groups).reduce(
    (sum, group) => sum + group.bycardTickets + group.silverTickets, 0,
  );
  return Object.values(groups).map((group) => {
    const marketTickets = group.bycardTickets + group.silverTickets;
    const releaseScope = group.hasMooon && group.hasCompetitors
      ? "shared"
      : group.hasMooon ? "mooon" : "competitors";
    return {
      ...group,
      marketTickets,
      otherTickets: group.bycardTickets,
      marketRevenue: group.bycardRevenue + group.silverRevenue,
      silverSharePct: marketTickets ? group.silverTickets / marketTickets * 100 : null,
      marketSharePct: totalTickets ? marketTickets / totalTickets * 100 : null,
      releaseScope,
    };
  }).sort((a, b) => b.marketTickets - a.marketTickets);
}

function renderBars(id, items) {
  const measured = items.filter((item) => item.measuredSessions > 0);
  const max = Math.max(...measured.map((item) => item.tickets), 1);
  $(id).innerHTML = measured.slice(0, 8).map((item) => `
    <div class="bar">
      <div class="bar-label"><span>${esc(item.name)}</span><span>${nf.format(item.tickets)}</span></div>
      <div class="bar-track"><i style="width:${Math.max(2, item.tickets / max * 100)}%"></i></div>
    </div>`).join("") || '<div class="muted">Данных пока нет</div>';
}

async function renderDailyTrend() {
  const host = $("daily-trend");
  if (!host || !globalThis.MarketTrend) return;
  const request = Symbol("trend");
  renderDailyTrend.currentRequest = request;
  const end = publishedPeriodCutoff();
  if (!end) {
    host.dataset.trendState = "error";
    globalThis.MarketTrend.render({ days: [], start: null, end: null, loading: false, filterLabel: "", error: "Нет опубликованной даты для динамики." });
    return;
  }
  const start = addDays(end, -13);
  const dates = Array.from({ length: 14 }, (_, index) => addDays(start, index));
  const filters = Object.fromEntries(["region", "city", "cinema", "film"].map((key) => [key, $(key).value]));
  const filterLabel = Object.values(filters).filter(Boolean).join(" · ") || "Все города · все кинотеатры · все фильмы";
  const eligibleDates = dates.filter((date) => reportingDateSet.has(date) && !isUnavailableDate(date)
    && (dataMode !== "partitioned" || partitionIndex.days?.[date]));
  const pending = dataMode === "partitioned" ? eligibleDates.filter((date) => !loadedDays.has(date)) : [];
  if (pending.length) {
    host.dataset.trendState = "loading";
    globalThis.MarketTrend.render({ days: [], start, end, loading: true, filterLabel });
  }
  const failed = new Set();
  const queue = [...pending];
  await Promise.all(Array.from({ length: Math.min(4, queue.length) }, async () => {
    while (queue.length) {
      const date = queue.shift();
      try { await fetchVerifiedDay(date); } catch (error) { failed.add(date); }
    }
  }));
  if (renderDailyTrend.currentRequest !== request) return;
  const generatedAt = new Date(source.meta.generated_at).getTime();
  const matches = (row) => Object.entries(filters).every(([key, value]) => !value || String(row[key]) === value);
  const available = new Set(eligibleDates);
  const days = dates.map((day) => {
    const quality = source.market_quality_by_date?.[day]?.status || "UNKNOWN";
    if (!available.has(day) || failed.has(day)) {
      return { day, market: null, silver: null, status: failed.has(day) ? "error" : "unavailable", quality };
    }
    const rows = dataMode === "partitioned" ? loadedDays.get(day) : {
      marketRows: (source.sessions || []).filter((row) => row.date === day),
      silverRows: (source.silver_screen?.sessions || []).filter((row) => row.date === day),
    };
    const competitors = rows.marketRows.filter((row) => matches(row) && new Date(row.stop_sale_at).getTime() <= generatedAt);
    const own = rows.silverRows.filter((row) => matches(row) && new Date(row.starts_at).getTime() <= generatedAt);
    const silver = own.reduce((sum, row) => sum + row.tickets, 0);
    const market = competitors.reduce((sum, row) => sum + (ticketValue(row) ?? 0), 0) + silver;
    return { day, market, silver, status: "ready", quality };
  });
  host.dataset.trendState = days.every((day) => day.status === "ready") ? "ready" : "partial";
  globalThis.MarketTrend.render({ days, start, end, loading: false, filterLabel, onRetry: () => { void renderDailyTrend(); } });
}

function syncOrbit(orbitId, trackId) {
  const orbit = $(orbitId);
  const raw = parseFloat($(trackId).style.width || "0");
  const value = Number.isFinite(raw) ? Math.max(0, Math.min(100, raw)) : 0;
  if (typeof orbit.style.setProperty === "function") orbit.style.setProperty("--orbit-value", value);
  else orbit.style["--orbit-value"] = value;
  if (typeof orbit.setAttribute === "function") orbit.setAttribute("aria-valuenow", value.toFixed(1));
}

function displayDateRange(rows) {
  const dates = unique(rows, "date").sort();
  if (!dates.length) return "данных пока нет";
  const first = new Date(`${dates[0]}T00:00:00`).toLocaleDateString("ru-RU");
  if (dates.length === 1) return first;
  const last = new Date(`${dates.at(-1)}T00:00:00`).toLocaleDateString("ru-RU");
  return `${first} — ${last}`;
}

function collectorSourceMetrics(discoveredRows, elapsedRows) {
  const measuredRows = elapsedRows.filter((row) => ticketValue(row) !== null);
  return {
    discovered: discoveredRows.length,
    measured: measuredRows.length,
    missing: elapsedRows.length - measuredRows.length,
    tickets: measuredRows.length
      ? measuredRows.reduce((sum, row) => sum + ticketValue(row), 0)
      : null,
  };
}

function renderSourceOverview(rows, silverRows, elapsedRows) {
  const silverTickets = silverRows.reduce((sum, row) => sum + row.tickets, 0);
  const silverRevenue = silverRows.reduce((sum, row) => sum + row.revenue_byn, 0);
  $("ss-import-period").textContent = displayDateRange(silverRows);
  $("ss-import-tickets").textContent = silverRows.length ? nf.format(silverTickets) : "—";
  $("ss-import-revenue").textContent = silverRows.length ? money.format(silverRevenue) : "—";
  $("ss-import-sessions").textContent = silverRows.length ? nf.format(silverRows.length) : "—";

  const sourceCards = [
    { provider: "bycard", id: "bycard" },
    { provider: "koronaticket", id: "korona" },
    { provider: "skyline", id: "skyline" },
  ];
  for (const card of sourceCards) {
    const discovered = rows.filter((row) => providerForSession(row) === card.provider);
    const elapsed = elapsedRows.filter((row) => providerForSession(row) === card.provider);
    const metrics = collectorSourceMetrics(discovered, elapsed);
    $(`${card.id}-import-period`).textContent = displayDateRange(discovered);
    $(`${card.id}-import-tickets`).textContent = metrics.tickets === null
      ? "—"
      : nf.format(metrics.tickets);
    const known = metrics.discovered > 0;
    $(`${card.id}-discovered-sessions`).textContent = known ? nf.format(metrics.discovered) : "—";
    $(`${card.id}-final-sessions`).textContent = known ? nf.format(metrics.measured) : "—";
    $(`${card.id}-missing-sessions`).textContent = known ? nf.format(metrics.missing) : "—";
  }
}

function selectedMarketQuality() {
  // A filter is a view, not a new market denominator or scope confirmation.
  const period = $("period").value;
  const dates = period.startsWith("d:") ? [period.slice(2)]
    : [...new Set(rowsForSelectedPeriod().map((row) => row.date))];
  const assessments = dates.map((date) => source.market_quality_by_date?.[date]);
  const statuses = assessments.map((row) => row?.status || "UNKNOWN");
  const status = !statuses.length || statuses.includes("UNKNOWN") ? "UNKNOWN"
    : statuses.includes("RED") ? "RED" : statuses.includes("YELLOW") ? "YELLOW" : "GREEN";
  return { status, dates, assessments };
}

function renderMarketQuality() {
  const quality = selectedMarketQuality();
  const banner = $("market-quality-state");
  if (!banner) return quality;
  const dateLabel = quality.dates.length === 1 ? formatDay(quality.dates[0]) : "Выбранный период";
  const row = quality.assessments.length === 1 ? quality.assessments[0] : null;
  const counts = row && Number.isInteger(row.usable) && Number.isInteger(row.total)
    ? ` · ${nf.format(row.usable)}/${nf.format(row.total)}`
      + (row.coverage_pct === null ? "" : ` = ${nf.format(row.coverage_pct)}%`) : "";
  const messages = {
    GREEN: "Зелёный отчёт · полнота рынка подтверждена",
    YELLOW: "Жёлтый отчёт · неполная рыночная выборка. Доли и сравнения ограниченно надёжны",
    RED: "Недостаточно данных · полноценный отчёт не готов. Показаны только измеренные факты; доли скрыты",
    UNKNOWN: "Качество не подтверждено · нет проверенного состава рынка, данных mooon или завершённых сеансов. Доли скрыты",
  };
  banner.hidden = false;
  banner.setAttribute("data-quality", quality.status);
  banner.textContent = `${dateLabel}${counts} · ${messages[quality.status]}`;
  return quality;
}

function renderShare(bycardRows, elapsed, usable, finalUsable, silverRows) {
  const quality = renderMarketQuality();
  const silver = source.silver_screen || {};
  const silverReady = String(silver.status || "").startsWith("ready");
  document.querySelectorAll(".market-card").forEach((card) => card.classList.remove("provisional"));
  const unavailable = (note) => {
    $("share").textContent = "—";
    $("share-note").textContent = note;
    $("share-track").style.width = "0";
    $("revenue-share").textContent = "—";
    $("revenue-share-note").textContent = note;
    $("revenue-share-track").style.width = "0";
  };
  if (!["GREEN", "YELLOW"].includes(quality.status)) {
    unavailable(quality.status === "RED" ? "Недостаточно данных для полноценного отчёта" : "Полнота рынка и данные mooon не подтверждены");
    return;
  }
  if (silverReady && silverRows.length && bycardRows.length === 0) {
    // A verified market may have a mooon-only filtered slice. This is not
    // evidence that an unverified empty competitor catalogue is complete.
    const tickets = silverRows.reduce((sum, row) => sum + row.tickets, 0);
    const revenue = silverRows.reduce((sum, row) => sum + row.revenue_byn, 0);
    $("share").textContent = tickets ? "100.0%" : "—";
    $("share-note").textContent = tickets ? `mooon ${nf.format(tickets)} · в выбранном разрезе конкуренты 0` : "В выбранном разрезе нет проданных билетов";
    $("share-track").style.width = tickets ? "100%" : "0";
    $("revenue-share").textContent = revenue ? "100.0%" : "—";
    $("revenue-share-note").textContent = revenue ? `mooon ${money.format(revenue)} · в выбранном разрезе конкуренты 0` : "В выбранном разрезе нет кассы";
    $("revenue-share-track").style.width = revenue ? "100%" : "0";
    if (quality.status === "YELLOW") {
      $("share-note").textContent = "Неполная выборка · ограниченная надёжность. " + $("share-note").textContent;
      $("revenue-share-note").textContent = "Неполная выборка · ограниченная надёжность. " + $("revenue-share-note").textContent;
      document.querySelectorAll(".market-card").forEach((card) => card.classList.add("provisional"));
    }
    return;
  }
  // Global dated quality already proves the complete mooon import. An empty
  // filtered own slice is a verified zero, not a missing source (e.g. a city
  // without a mooon cinema). A zero market denominator still stays unavailable.
  if (silverReady && elapsed.length) {
    const silverTickets = silverRows.reduce((sum, row) => sum + row.tickets, 0);
    const bycardTickets = usable.reduce((sum, row) => sum + (ticketValue(row) ?? 0), 0);
    const observedMarket = silverTickets + bycardTickets;
    const value = observedMarket ? silverTickets / observedMarket * 100 : null;
    if (value === null) {
      unavailable("В выбранном разрезе нет проданных билетов");
      return;
    }
    $("share").textContent = `${value.toFixed(1)}%`;
    $("share-note").textContent = `${nf.format(silverTickets)} — mooon · ${nf.format(observedMarket)} — рынок`;
    $("share-track").style.width = `${Math.max(0, Math.min(100, value))}%`;

    const silverRevenue = silverRows.reduce((sum, row) => sum + row.revenue_byn, 0);
    const bycardExactRevenue = usable.reduce(
      (sum, row) => sum + (row.revenue_exact_byn ?? 0), 0,
    );
    const bycardEstimateMax = usable.reduce(
      (sum, row) => sum + (row.revenue_estimate_max_byn ?? 0), 0,
    );
    const marketRevenueMax = silverRevenue + bycardExactRevenue + bycardEstimateMax;
    const revenueShare = marketRevenueMax ? silverRevenue / marketRevenueMax * 100 : null;
    if (revenueShare === null) {
      $("revenue-share").textContent = "—";
      $("revenue-share-note").textContent = "В выбранном разрезе нет кассы";
      $("revenue-share-track").style.width = "0";
    } else {
      $("revenue-share").textContent = `${revenueShare.toFixed(1)}%`;
      $("revenue-share-note").textContent = `${money.format(silverRevenue)} — mooon · ${money.format(marketRevenueMax)} — рынок, включая оценку`;
      $("revenue-share-track").style.width = `${Math.max(0, Math.min(100, revenueShare))}%`;
    }
    if (quality.status === "YELLOW") {
      const warning = "Оценка по неполной выборке · доли и сравнения ограниченно надёжны. ";
      $("share-note").textContent = warning + $("share-note").textContent;
      $("revenue-share-note").textContent = warning + $("revenue-share-note").textContent;
      document.querySelectorAll(".market-card").forEach((card) => card.classList.add("provisional"));
    }
    return;
  }
  if (!silverReady) {
    const note = silver.status === "staged_unmapped"
      ? "Выгрузка mooon загружена; бизнес-маппинг ещё не согласован"
      : "Ожидается согласованная выгрузка mooon";
    unavailable(note);
    return;
  }
  unavailable(silverRows.length
    ? "В выбранном разрезе нет завершённых сеансов конкурентов"
    : "В выбранном разрезе нет данных mooon");
}

function render() {
  if (renderAvailabilityState()) return;
  const rows = selectedRows();
  const sharesAllowed = ["GREEN", "YELLOW"].includes(selectedMarketQuality().status);
  const generatedAt = new Date(source.meta.generated_at).getTime();
  const silverRows = selectedSilverRows().filter(
    (row) => new Date(row.starts_at).getTime() <= generatedAt,
  );
  const elapsed = rows.filter((row) => new Date(row.stop_sale_at).getTime() <= generatedAt);
  const usable = elapsed.filter((row) => ticketValue(row) !== null);
  const finalUsable = usable.filter((row) => row.is_final_candidate === true);
  const exact = usable.filter((row) => row.tickets_exact !== null);
  const estimated = usable.filter((row) => row.tickets_estimate !== null);
  const exactTickets = exact.reduce((sum, row) => sum + row.tickets_exact, 0);
  const estimatedTickets = estimated.reduce((sum, row) => sum + row.tickets_estimate, 0);
  const exactRevenue = exact.reduce((sum, row) => sum + (row.revenue_exact_byn ?? 0), 0);
  const estimateMax = estimated.reduce(
    (sum, row) => sum + (row.revenue_estimate_max_byn ?? 0), 0,
  );
  const silverTickets = silverRows.reduce((sum, row) => sum + row.tickets, 0);
  const silverRevenue = silverRows.reduce((sum, row) => sum + row.revenue_byn, 0);

  renderSourceOverview(rows, silverRows, elapsed);
  renderCompetitors(elapsed, silverRows);

  $("tickets").textContent = nf.format(silverTickets + exactTickets + estimatedTickets);
  $("tickets-note").textContent = `mooon ${nf.format(silverTickets)} · конкуренты ${nf.format(exactTickets + estimatedTickets)}`;
  const marketRevenue = silverRevenue + exactRevenue + estimateMax;
  $("revenue").textContent = money.format(marketRevenue);
  $("revenue-note").textContent = `mooon ${money.format(silverRevenue)} · конкуренты ${money.format(exactRevenue + estimateMax)}`;

  const coverage = elapsed.length ? usable.length / elapsed.length * 100 : 0;
  $("coverage").textContent = elapsed.length
    ? `Охвачено ${coverage.toFixed(1).replace(".", ",")}% завершённых сеансов:`
    : "Данных пока нет.";
  $("coverage-note").textContent = elapsed.length
    ? `${usable.length} из ${elapsed.length}. Итоговые показатели могут быть занижены из-за ${elapsed.length - usable.length} пропущенных сеансов.`
    : "В выбранном периоде продажи ещё не завершились.";

  $("sessions-total").textContent = nf.format(elapsed.length + silverRows.length);
  $("sessions-note").textContent = `mooon ${silverRows.length} · конкуренты ${usable.length} · без данных ${elapsed.length - usable.length}`;
  const exactMarketTickets = silverTickets + exactTickets;
  const exactMarketRevenue = silverRevenue + exactRevenue;
  const exactAveragePrice = exactMarketTickets ? exactMarketRevenue / exactMarketTickets : null;
  $("average-price").textContent = exactAveragePrice === null
    ? "—"
    : money.format(exactAveragePrice);
  $("average-price-note").textContent = "mooon + сеансы конкурентов с точной кассой";
  const seatsWithCapacity = [
    ...usable.filter((row) => row.capacity > 0).map((row) => ({
      capacity: row.capacity,
      tickets: ticketValue(row) ?? 0,
    })),
    ...silverRows.filter((row) => row.capacity > 0).map((row) => ({
      capacity: row.capacity,
      tickets: row.tickets,
    })),
  ];
  const measuredCapacity = seatsWithCapacity.reduce((sum, row) => sum + row.capacity, 0);
  const measuredAttendance = seatsWithCapacity.reduce(
    (sum, row) => sum + row.tickets, 0,
  );
  const occupancy = measuredCapacity ? measuredAttendance / measuredCapacity * 100 : null;
  $("occupancy").textContent = occupancy === null ? "—" : `${occupancy.toFixed(1)}%`;
  $("occupancy-note").textContent = measuredCapacity
    ? `${nf.format(measuredAttendance)} билетов на ${nf.format(measuredCapacity)} мест`
    : "нет измеренных схем залов";
  const estimateShare = usable.length ? estimated.length / usable.length * 100 : null;
  $("estimate-share").textContent = estimateShare === null ? "—" : `${estimateShare.toFixed(1)}%`;
  $("estimate-note").textContent = `${estimated.length} из ${usable.length} измеренных сеансов`;

  const silverMarketRows = silverRows.map((row) => ({
    ...row,
    tickets_exact: row.tickets,
    tickets_estimate: null,
    revenue_exact_byn: row.revenue_byn,
    quality: "silver_screen_approved",
  }));
  const marketRows = [...elapsed, ...silverMarketRows];
  const films = filmBreakdown(elapsed, silverRows);
  const releaseLabels = {
    shared: "Общий прокат",
    mooon: "Только mooon",
    competitors: "Только конкуренты",
  };
  $("film-count").textContent = `${films.length} фильмов`;
  $("films-table").innerHTML = `
    <div class="table-row header">
      <span>Фильм</span><span class="number">Билеты<small>рынок · билеты</small></span><span class="number">Билеты<small>mooon · билеты</small></span><span class="number">Билеты<small>конкуренты · билеты</small></span><span class="number">Касса<small>рынок · BYN</small></span><span class="number">Касса<small>mooon · BYN</small></span><span class="number">Доля<small>mooon</small></span><span class="number">Доля фильма<small>в рынке</small></span><span>Прокат</span>
    </div>` + films.slice(0, 20).map((film) => `
    <div class="table-row">
      <span class="film-name film-identity" data-poster-scope="${film.releaseScope}"><span class="film-poster" aria-hidden="true"></span><span class="film-title">${esc(film.name)}</span></span>
      <span class="number">${nf.format(film.marketTickets)}</span>
      <span class="number">${nf.format(film.silverTickets)}</span>
      <span class="number">${nf.format(film.otherTickets)}</span>
      <span class="number">${nf.format(Math.round(film.marketRevenue))}</span>
      <span class="number">${nf.format(Math.round(film.silverRevenue))}</span>
      <span class="number">${!sharesAllowed || film.silverSharePct === null ? "—" : `${film.silverSharePct.toFixed(1)}%`}</span>
      <span class="number">${!sharesAllowed || film.marketSharePct === null ? "—" : `${film.marketSharePct.toFixed(1)}%`}</span>
      <span class="release-state ${film.releaseScope}">${releaseLabels[film.releaseScope]}</span>
    </div>`).join("");

  globalThis.MarketPosters?.render(films.slice(0, 20), silverRows);

  renderBars("cities-chart", grouped(marketRows, "city"));
  renderBars("regions-chart", grouped(marketRows, "region"));
  renderBars("cinemas-chart", grouped(marketRows, "cinema"));
  renderBars("hours-chart", grouped(marketRows, "hour").map((item) => ({
    ...item,
    name: `${String(item.name).padStart(2, "0")}:00`,
  })));
  void renderDailyTrend();

  const quality = {};
  for (const row of marketRows) quality[row.quality] = (quality[row.quality] || 0) + 1;
  const labels = {
    exact_api_sales: "Точные продажи из API",
    availability_estimate: "Оценка по карте мест",
    closed_before_capture: "Закрыто до снимка",
    general_admission_unverified: "Без нумерованных мест",
    not_captured: "Снимок ещё не получен",
    capture_failed: "Ошибка запроса",
    source_anomaly: "Противоречивые данные источника",
    silver_screen_approved: "mooon · согласованная выгрузка",
  };
  const qualityHelp = {
    exact_api_sales: "Источник передал количество проданных билетов напрямую. Это точное значение, а не расчёт по карте мест.",
    availability_estimate: "Оценка занятости по карте мест: считаются места, которые уже недоступны. Это не точное число продаж — среди них могут быть брони или технически закрытые места.",
    closed_before_capture: "Сеанс закрылся до того, как мы получили пригодный снимок карты мест. Продажи по нему не подставляются.",
    general_admission_unverified: "У сеанса нет нумерованных мест, поэтому его нельзя проверить по карте мест так же, как обычный сеанс.",
    not_captured: "Сеанс найден в расписании, но пригодный итоговый снимок ещё не получен.",
    capture_failed: "При запросе данных произошла техническая ошибка. Это не означает, что продаж не было.",
    source_anomaly: "Источник вернул противоречивые показатели. Результат оставлен отдельно и требует проверки.",
    silver_screen_approved: "Согласованная выгрузка mooon: данные переданы готовым итогом.",
  };
  $("quality").innerHTML = Object.entries(quality)
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => `
      <div class="quality-row">
        <i class="quality-dot" aria-hidden="true"></i>
        <span class="quality-label">
          <span>${esc(labels[key] || key)}</span>
          <button class="quality-tooltip-trigger" type="button" aria-label="Подробнее: ${esc(labels[key] || key)}" aria-describedby="quality-tooltip-${esc(key)}" aria-expanded="false">
            <span aria-hidden="true">i</span>
            <span class="quality-tooltip" id="quality-tooltip-${esc(key)}" role="tooltip">${esc(qualityHelp[key] || "Дополнительное пояснение для этой категории пока не добавлено.")}</span>
          </button>
        </span>
        <strong>${nf.format(count)}</strong>
      </div>`).join("") || '<div class="muted">Завершённых сеансов пока нет</div>';

  renderShare(rows, elapsed, usable, finalUsable, silverRows);
  syncOrbit("share-orbit", "share-track");
  syncOrbit("revenue-orbit", "revenue-share-track");
}

function bindQualityTooltips() {
  document.addEventListener("click", (event) => {
    const trigger = event.target.closest(".quality-tooltip-trigger");
    const openTriggers = document.querySelectorAll('.quality-tooltip-trigger[aria-expanded="true"]');
    if (!trigger) {
      openTriggers.forEach((item) => item.setAttribute("aria-expanded", "false"));
      return;
    }
    const wasOpen = trigger.getAttribute("aria-expanded") === "true";
    openTriggers.forEach((item) => item.setAttribute("aria-expanded", "false"));
    trigger.setAttribute("aria-expanded", String(!wasOpen));
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    document.querySelectorAll('.quality-tooltip-trigger[aria-expanded="true"]')
      .forEach((item) => item.setAttribute("aria-expanded", "false"));
  });
}

async function loadInitialSource() {
  const legacyUrl = resolveUrl(document.body.dataset.dataUrl || "data/market.json");
  const indexUrl = marketIndexUrl(legacyUrl);
  const indexResponse = await fetch(indexUrl, { cache: "no-store" });
  if (indexResponse.status === 404) {
    const legacyResponse = await fetch(legacyUrl, { cache: "no-store" });
    if (!legacyResponse.ok) throw new Error(`Не удалось загрузить данные: HTTP ${legacyResponse.status}.`);
    const payload = await legacyResponse.json();
    const marketRows = payload.market_sessions ?? payload.sessions ?? [];
    if (!Array.isArray(marketRows) || !Array.isArray(payload.silver_screen?.sessions ?? [])) {
      throw new Error("Некорректный формат файла market.json.");
    }
    payload.sessions = normalizeRows(marketRows);
    payload.silver_screen = {
      ...(payload.silver_screen || {}),
      sessions: normalizeRows(payload.silver_screen?.sessions || []),
    };
    dataMode = "legacy";
    return payload;
  }
  if (!indexResponse.ok) {
    throw new Error(`Не удалось загрузить индекс данных: HTTP ${indexResponse.status}.`);
  }
  const index = await indexResponse.json();
  if (!Array.isArray(index.reporting_dates) || !index.days || typeof index.days !== "object") {
    throw new Error("Некорректный формат индекса данных.");
  }
  const reportingDates = [...new Set(index.reporting_dates)]
    .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))
    .sort();
  if (!reportingDates.length) throw new Error("В индексе нет опубликованных дат.");
  partitionIndex = { ...index, reporting_dates: reportingDates, __url: indexUrl };
  const { sessions, market_sessions: marketSessions, ...basePayload } = index;
  const { sessions: silverSessions, ...silverBase } = index.silver_screen || {};
  source = {
    ...basePayload,
    sessions: [],
    silver_screen: { ...silverBase, sessions: [] },
  };
  dataMode = "partitioned";
  return source;
}

function incidentUnavailableMessage(incident) {
  const number = (value) => (typeof value === "number" || (typeof value === "string" && value.trim() !== ""))
    && Number.isFinite(Number(value)) ? Number(value) : null;
  const threshold = number(incident.threshold_pct);
  const coverage = number(incident.coverage_pct);
  const usable = number(incident.usable_sessions);
  const total = number(incident.total_sessions);
  const suffix = "День не опубликован как валидный.";
  if (incident.reason === "required_source_preparation_failed") {
    return `Не удалось загрузить или обработать данные обязательного источника. ${suffix}`;
  }
  const labels = { bycard: "ByCard", skyline: "Skyline", koronaticket: "Korona", korona: "Korona", overall: "Рынок" };
  const reasons = {
    unavailable: "данные источника недоступны",
    zero_sessions_unverified: "отсутствие сеансов не подтверждено",
    no_sessions: "нет подтверждённых сеансов",
    scope_anchor_unconfirmed: "не подтверждён согласованный состав кинотеатров",
    scope_anchor_missing: "нет подтверждения состава кинотеатров",
    scope_anchor_stale: "истекло подтверждение состава кинотеатров",
    observed_catalog_strict_subset: "получен неполный каталог кинотеатров",
    catalogue_change_unconfirmed: "изменение каталога не подтверждено",
  };
  const parts = [];
  for (const failure of Array.isArray(incident.quality_failures) ? incident.quality_failures : []) {
    if (typeof failure !== "string") continue;
    const [provider, rule] = failure.split(":");
    // Overall coverage is described below only when the numbers prove it.
    if (provider === "overall" && rule === "coverage_below_threshold") continue;
    const quality = incident.source_quality?.[provider] || {};
    const measured = number(quality.coverage_pct);
    const count = number(quality.usable);
    const all = number(quality.total);
    let explanation;
    if (rule === "schedule_evidence_incomplete") {
      const evidence = quality.schedule_evidence || {};
      explanation = reasons[evidence.reason || evidence.scope_anchor?.reason] || "не подтверждена полнота расписания";
    } else if (rule === "coverage_below_threshold") {
      explanation = measured !== null && measured >= 0 && measured <= 100 && threshold !== null
        && measured < threshold && all > 0
        ? `покрытие ${nf.format(measured)}% ниже порога ${nf.format(threshold)}%`
        : "проверка покрытия источника не пройдена";
    } else {
      explanation = reasons[rule] || "проверка обязательного источника не пройдена";
    }
    const counts = Number.isInteger(count) && Number.isInteger(all) && count >= 0 && all > 0 && count <= all
      ? ` (${nf.format(count)} из ${nf.format(all)} сеансов)` : "";
    parts.push(`${labels[provider] || "Источник"}: ${explanation}${counts}.`);
  }
  const overallBelow = coverage !== null && coverage >= 0 && coverage <= 100
    && threshold !== null && threshold > 0 && threshold <= 100 && coverage < threshold && total > 0;
  if (overallBelow) {
    const counts = Number.isInteger(usable) && Number.isInteger(total) && usable >= 0 && usable <= total
      ? ` — ${nf.format(usable)} из ${nf.format(total)} сеансов` : "";
    parts.push(`Финальное покрытие рынка ${nf.format(coverage)}%${counts}, ниже порога ${nf.format(threshold)}%.`);
  }
  return parts.length ? `${[...new Set(parts)].join(" ")} ${suffix}`
    : `День не прошёл проверку качества. ${suffix}`;
}

function configureReportingDates() {
  const generatedDay = source.meta.generated_at.slice(0, 10);
  const yesterday = minskDay(-1);
  const sourceDates = dataMode === "partitioned"
    ? partitionIndex.reporting_dates
    : [...new Set([
      ...unique(source.silver_screen?.sessions || [], "date"),
      ...unique(source.sessions || [], "date"),
    ])];
  dynamicUnavailableDates = new Map();
  for (const incident of source.data_quality_incidents || []) {
    const date = String(incident?.date || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    if (incident.status !== "data_quality_incident" && !incident.excluded_from_period_aggregates) continue;
    dynamicUnavailableDates.set(date, {
      title: `Нет данных за ${formatLongDay(date)}`,
      message: incidentUnavailableMessage(incident),
    });
  }
  const collectedDates = sourceDates
    .filter((value) => value >= REPORTING_START_DATE && value <= generatedDay && !isUnavailableDate(value));
  if (yesterday >= REPORTING_START_DATE
      && !collectedDates.includes(yesterday)
      && !UNAVAILABLE_DATES.has(yesterday)
      && !dynamicUnavailableDates.has(yesterday)) {
    dynamicUnavailableDates.set(yesterday, {
      title: `Нет данных за ${formatDay(yesterday)}`,
      message: "День ещё не опубликован в dashboard.",
    });
  }
  const reportingDates = [...new Set([
    ...collectedDates,
    ...UNAVAILABLE_DATES.keys(),
    ...dynamicUnavailableDates.keys(),
  ])].sort().reverse();
  reportingDateSet = new Set(reportingDates);
  periodDateOptions = reportingDates;
  periodWeekOptions = [...collectedDates.reduce((weeks, date) => {
    const week = releaseWeekStartForDay(date);
    if (!weeks.has(week)) weeks.set(week, new Set());
    weeks.get(week).add(date);
    return weeks;
  }, new Map()).entries()]
    .map(([value, days]) => ({ value, days: days.size }))
    .sort((a, b) => b.value.localeCompare(a.value));
  const currentReleaseWeekPeriod = `w:${releaseWeekStartForDay(minskDay(0))}`;
  $("period").innerHTML = '<option value="">Весь период</option>'
    + '<option value="r:last7">Последние 7 дней</option>'
    + `<option value="${esc(currentReleaseWeekPeriod)}">Текущая прокатная неделя</option>`
    + reportingDates.map((value) => {
      const label = new Date(`${value}T00:00:00`).toLocaleDateString("ru-RU")
        + (isUnavailableDate(value) ? " · нет данных" : "");
      return `<option value="d:${esc(value)}">${esc(label)}</option>`;
    }).join("")
    + periodWeekOptions
    .map((week) => `<option value="w:${esc(week.value)}">Прокатная неделя ${esc(releaseWeekLabel(week.value))}</option>`)
    .join("");
  const requestedDefault = dataMode === "partitioned" ? partitionIndex.default_date : null;
  const defaultDate = collectedDates.includes(requestedDefault)
    ? requestedDefault
    : reportingDates.includes(yesterday)
      ? yesterday
      : [...collectedDates].filter((date) => date <= yesterday).sort().reverse()[0] || reportingDates[0];
  return defaultDate ? `d:${defaultDate}` : "";
}

async function handlePeriodChange() {
  const requestedPeriod = $("period").value;
  if (dataMode !== "partitioned") {
    activePeriodValue = requestedPeriod;
    refreshFilterOptions();
    renderPeriodControl();
    render();
    return;
  }
  const requestId = ++periodRequestId;
  try {
    await loadPartitionDates(datesForPeriod(requestedPeriod), requestId);
    if (requestId !== periodRequestId) return;
    activePeriodValue = requestedPeriod;
    refreshFilterOptions();
    renderPeriodControl();
    render();
    clearDataLoadState();
  } catch (error) {
    if (requestId !== periodRequestId) return;
    $("period").value = activePeriodValue;
    renderPeriodControl();
    setDataLoadState("error", `${error.message} Ранее загруженные данные сохранены.`);
    $("data-load-state")?.focus?.();
    console.error(error);
  }
}

async function init() {
  setDataLoadState("loading", "Загрузка данных…");
  source = await loadInitialSource();
  if (!source.meta?.generated_at) throw new Error("В данных отсутствует время обновления.");
  $("updated").textContent = `Обновлено ${new Date(source.meta.generated_at).toLocaleString("ru-RU")}`;
  const defaultPeriod = configureReportingDates();
  if (dataMode === "partitioned" && defaultPeriod) {
    const requestId = ++periodRequestId;
    await loadPartitionDates(datesForPeriod(defaultPeriod), requestId);
  }
  $("period").value = defaultPeriod;
  activePeriodValue = defaultPeriod;
  refreshFilterOptions();
  renderPeriodControl();
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".period-filter")) closePeriodPopover();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closePeriodPopover();
  });
  $("period").addEventListener("change", handlePeriodChange);
  for (const id of ["region", "city", "cinema", "film"]) {
    $(id).addEventListener("change", () => {
      refreshFilterOptions();
      renderPeriodControl();
      render();
    });
  }
  bindQualityTooltips();
  render();
  clearDataLoadState();
}

let initializationError = null;
const dashboardReady = init().catch((error) => {
  initializationError = error;
  $("updated").textContent = "Ошибка данных";
  $("subtitle").textContent = error.message;
  setDataLoadState("error", error.message);
  console.error(error);
});

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    ready: dashboardReady,
    selectPeriod,
    handlePeriodChange,
    state: () => ({
      dataMode,
      loadedDates: [...loadedDays.keys()].sort(),
      activePeriodValue,
      initializationError,
    }),
    providerForSession,
    collectorSourceMetrics,
    incidentUnavailableMessage,
  };
}
