const nf = new Intl.NumberFormat("ru-RU");
const money = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "BYN",
  maximumFractionDigits: 0,
});

let source = null;
let reportingDateSet = new Set();
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

function filterRows(inputRows) {
  let rows = inputRows.filter((row) => reportingDateSet.has(row.date));
  const period = $("period").value;
  if (period.startsWith("d:")) rows = rows.filter((row) => row.date === period.slice(2));
  if (period.startsWith("w:")) rows = rows.filter((row) => row.release_week === period.slice(2));
  for (const key of ["region", "city", "cinema", "film"]) {
    const value = $(key).value;
    if (value) rows = rows.filter((row) => String(row[key]) === value);
  }
  return rows;
}

function rowsForSelectedPeriod() {
  let rows = [...(source.sessions || []), ...(source.silver_screen?.sessions || [])]
    .filter((row) => reportingDateSet.has(row.date));
  const period = $("period").value;
  if (period.startsWith("d:")) rows = rows.filter((row) => row.date === period.slice(2));
  if (period.startsWith("w:")) rows = rows.filter((row) => row.release_week === period.slice(2));
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

function competitorName(cinema) {
  const name = String(cinema || "").toLocaleLowerCase("ru");
  if (name.includes("skyline")) return "Skyline";
  if (name.includes("falcon club")) return "Falcon Club";
  if (name.includes("prizma")) return "Prizma";
  return "КВП";
}

function renderCompetitors(bycardRows, mooonRows) {
  const order = ["mooon", "Skyline", "Falcon Club", "Prizma", "КВП"];
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
    const group = groups[competitorName(row.cinema)];
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
    const ticketShare = marketTickets ? group.tickets / marketTickets * 100 : null;
    const revenueShare = marketRevenueMax
      ? `${(group.revenueMax / marketRevenueMax * 100).toFixed(1)}%`
      : "—";
    const coverage = group.sessions ? group.measured / group.sessions * 100 : null;
    const quality = name === "mooon"
      ? "данные mooon"
      : `${group.measured} из ${group.sessions} сеансов`;
    return `<article class="competitor-card${name === "mooon" ? " is-mooon" : ""}">
      <header><span>${esc(name)}</span><small>${esc(quality)}</small></header>
      <dl>
        <div><dt>Admissions</dt><dd>${nf.format(group.tickets)}</dd></div>
        <div><dt>Admissions share</dt><dd>${ticketShare === null ? "—" : `${ticketShare.toFixed(1)}%`}</dd></div>
        <div><dt>% revenue</dt><dd>${revenueShare}</dd></div>
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

function renderDailyTrend(bycardRows, silverRows) {
  const groups = {};
  const get = (day) => {
    if (!groups[day]) groups[day] = { day, bycard: 0, silver: 0 };
    return groups[day];
  };
  for (const row of bycardRows) get(row.date).bycard += ticketValue(row) ?? 0;
  for (const row of silverRows) get(row.date).silver += row.tickets;
  const allDays = Object.values(groups)
    .map((group) => ({ ...group, market: group.bycard + group.silver }))
    .sort((a, b) => a.day.localeCompare(b.day));
  const days = allDays.slice(-14);
  $("daily-count").textContent = allDays.length > days.length
    ? `последние ${days.length} из ${allDays.length} дней`
    : `${days.length} дней`;
  if (!days.length) {
    $("daily-trend").innerHTML = '<div class="muted">Данных за выбранный период пока нет</div>';
    return;
  }

  const width = 900;
  const height = 330;
  const inset = { top: 24, right: 28, bottom: 42, left: 18 };
  const plotWidth = width - inset.left - inset.right;
  const plotHeight = height - inset.top - inset.bottom;
  const max = Math.max(...days.map((day) => day.market), 1);
  const point = (value, index) => ({
    x: inset.left + (days.length === 1 ? plotWidth / 2 : index / (days.length - 1) * plotWidth),
    y: inset.top + plotHeight - value / max * plotHeight,
  });
  const marketPoints = days.map((day, index) => point(day.market, index));
  const silverPoints = days.map((day, index) => point(day.silver, index));
  const path = (points) => points.map((item, index) => `${index ? "L" : "M"}${item.x.toFixed(1)},${item.y.toFixed(1)}`).join(" ");
  const marketPath = path(marketPoints);
  const silverPath = path(silverPoints);
  const areaPath = `${marketPath} L${marketPoints.at(-1).x.toFixed(1)},${(inset.top + plotHeight).toFixed(1)} L${marketPoints[0].x.toFixed(1)},${(inset.top + plotHeight).toFixed(1)} Z`;
  const labelIndexes = [...new Set([0, Math.floor((days.length - 1) / 2), days.length - 1])];
  const formatDay = (value) => new Date(`${value}T00:00:00`).toLocaleDateString("ru-RU", { day: "2-digit", month: "short" });
  const latest = days.at(-1);
  const latestShare = latest.market ? latest.silver / latest.market * 100 : 0;
  $("daily-trend").innerHTML = `
    <svg class="trend-svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="trend-title trend-desc">
      <title id="trend-title">Динамика проданных билетов</title>
      <desc id="trend-desc">Период ${formatDay(days[0].day)} — ${formatDay(latest.day)}. Последний день: рынок ${nf.format(latest.market)}, mooon ${nf.format(latest.silver)}, доля ${latestShare.toFixed(1)}%.</desc>
      ${[0, .25, .5, .75, 1].map((tick) => {
        const y = inset.top + plotHeight * tick;
        return `<line class="trend-grid" x1="${inset.left}" y1="${y}" x2="${width - inset.right}" y2="${y}"></line>`;
      }).join("")}
      <path class="trend-market-area" d="${areaPath}"></path>
      ${days.length > 1 ? `<path class="trend-market-line" d="${marketPath}"></path><path class="trend-silver-line" d="${silverPath}"></path>` : ""}
      ${marketPoints.map((item) => `<circle class="trend-point-market" cx="${item.x}" cy="${item.y}" r="3"></circle>`).join("")}
      ${silverPoints.map((item) => `<circle class="trend-point-silver" cx="${item.x}" cy="${item.y}" r="4"></circle>`).join("")}
      ${labelIndexes.map((index) => `<text class="trend-axis-label" x="${marketPoints[index].x}" y="${height - 12}" text-anchor="${index === 0 ? "start" : index === days.length - 1 ? "end" : "middle"}">${formatDay(days[index].day)}</text>`).join("")}
      <text class="trend-end-label" x="${Math.max(inset.left, marketPoints.at(-1).x - 6)}" y="${Math.max(16, marketPoints.at(-1).y - 11)}" text-anchor="end">${nf.format(latest.market)}</text>
      <text class="trend-end-label" x="${Math.max(inset.left, silverPoints.at(-1).x - 6)}" y="${Math.max(16, silverPoints.at(-1).y - 11)}" text-anchor="end">mooon ${nf.format(latest.silver)}</text>
    </svg>`;
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

function renderSourceOverview(rows, silverRows, finalUsable) {
  const silverTickets = silverRows.reduce((sum, row) => sum + row.tickets, 0);
  const silverRevenue = silverRows.reduce((sum, row) => sum + row.revenue_byn, 0);
  const bycardTickets = finalUsable.reduce((sum, row) => sum + (ticketValue(row) ?? 0), 0);
  $("ss-import-period").textContent = displayDateRange(silverRows);
  $("ss-import-tickets").textContent = nf.format(silverTickets);
  $("ss-import-revenue").textContent = money.format(silverRevenue);
  $("ss-import-sessions").textContent = nf.format(silverRows.length);
  $("bycard-import-period").textContent = displayDateRange(finalUsable);
  $("bycard-import-tickets").textContent = nf.format(bycardTickets);
  $("bycard-final-sessions").textContent = nf.format(finalUsable.length);
  $("bycard-discovered-sessions").textContent = nf.format(rows.length);

}

function renderShare(bycardRows, elapsed, usable, finalUsable, silverRows) {
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
  if (silverReady && silverRows.length && bycardRows.length === 0) {
    const mooonTickets = silverRows.reduce((sum, row) => sum + row.tickets, 0);
    const mooonRevenue = silverRows.reduce((sum, row) => sum + row.revenue_byn, 0);
    $("share").textContent = mooonTickets ? "100.0%" : "—";
    $("share-note").textContent = mooonTickets
      ? `mooon ${nf.format(mooonTickets)} · конкуренты 0`
      : "В выбранном разрезе нет проданных билетов";
    $("share-track").style.width = mooonTickets ? "100%" : "0";
    $("revenue-share").textContent = mooonRevenue ? "100.0%" : "—";
    $("revenue-share-note").textContent = mooonRevenue
      ? `mooon ${money.format(mooonRevenue)} · конкуренты 0`
      : "В выбранном разрезе нет кассы";
    $("revenue-share-track").style.width = mooonRevenue ? "100%" : "0";
    return;
  }
  if (silverReady && silverRows.length && elapsed.length) {
    const coverage = usable.length / elapsed.length * 100;
    const strictCoverage = finalUsable.length / elapsed.length * 100;
    if (coverage < 96) {
      const silverTickets = silverRows.reduce((sum, row) => sum + row.tickets, 0);
      const bycardTickets = finalUsable.reduce((sum, row) => sum + (ticketValue(row) ?? 0), 0);
      const observedMarket = silverTickets + bycardTickets;
      const ticketShare = observedMarket ? silverTickets / observedMarket * 100 : null;
      const silverRevenue = silverRows.reduce((sum, row) => sum + row.revenue_byn, 0);
      const bycardRevenue = finalUsable.reduce(
        (sum, row) => sum + (row.revenue_exact_byn ?? row.revenue_estimate_max_byn ?? 0), 0,
      );
      const observedRevenue = silverRevenue + bycardRevenue;
      const revenueShare = observedRevenue ? silverRevenue / observedRevenue * 100 : null;
      $("share").textContent = ticketShare === null ? "—" : `${ticketShare.toFixed(1)}%`;
      $("share-note").textContent = `Пилотная оценка · пригодно ${usable.length} из ${elapsed.length} (${coverage.toFixed(1)}%) · strict-final ${strictCoverage.toFixed(1)}%`;
      $("share-track").style.width = ticketShare === null ? "0" : `${ticketShare}%`;
      $("revenue-share").textContent = revenueShare === null ? "—" : `${revenueShare.toFixed(1)}%`;
      $("revenue-share-note").textContent = `Не итоговая доля · учтено ${nf.format(bycardTickets)} Admissions конкурентов`;
      $("revenue-share-track").style.width = revenueShare === null ? "0" : `${revenueShare}%`;
      document.querySelectorAll(".market-card").forEach((card) => card.classList.add("provisional"));
      return;
    }
    const silverTickets = silverRows.reduce((sum, row) => sum + row.tickets, 0);
    const bycardTickets = usable.reduce((sum, row) => sum + (ticketValue(row) ?? 0), 0);
    const observedMarket = silverTickets + bycardTickets;
    const value = observedMarket ? silverTickets / observedMarket * 100 : null;
    if (value === null) {
      unavailable("В выбранном разрезе нет проданных билетов");
      return;
    }
    $("share").textContent = `${value.toFixed(1)}%`;
    $("share-note").textContent = `${nf.format(silverTickets)} Admissions mooon из ${nf.format(observedMarket)} Admissions рынка`;
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
      $("revenue-share-note").textContent = `${money.format(silverRevenue)} Revenue mooon из ${money.format(marketRevenueMax)} Revenue рынка`;
      $("revenue-share-track").style.width = `${Math.max(0, Math.min(100, revenueShare))}%`;
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
  const rows = selectedRows();
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

  renderSourceOverview(rows, silverRows, usable);
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
  $("average-price-note").textContent = "mooon + сеансы конкурентов с точным Revenue";
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
      <span>Фильм</span><span class="number">Admissions<small>рынок · билеты</small></span><span class="number">Admissions<small>mooon · билеты</small></span><span class="number">Admissions<small>конкуренты · билеты</small></span><span class="number">Revenue<small>рынок · BYN</small></span><span class="number">Revenue<small>mooon · BYN</small></span><span class="number">Доля<small>mooon</small></span><span class="number">Доля фильма<small>в рынке</small></span><span>Прокат</span>
    </div>` + films.slice(0, 20).map((film) => `
    <div class="table-row">
      <span class="film-name">${esc(film.name)}</span>
      <span class="number">${nf.format(film.marketTickets)}</span>
      <span class="number">${nf.format(film.silverTickets)}</span>
      <span class="number">${nf.format(film.otherTickets)}</span>
      <span class="number">${nf.format(Math.round(film.marketRevenue))}</span>
      <span class="number">${nf.format(Math.round(film.silverRevenue))}</span>
      <span class="number">${film.silverSharePct === null ? "—" : `${film.silverSharePct.toFixed(1)}%`}</span>
      <span class="number">${film.marketSharePct === null ? "—" : `${film.marketSharePct.toFixed(1)}%`}</span>
      <span class="release-state ${film.releaseScope}">${releaseLabels[film.releaseScope]}</span>
    </div>`).join("");

  renderBars("cities-chart", grouped(marketRows, "city"));
  renderBars("regions-chart", grouped(marketRows, "region"));
  renderBars("cinemas-chart", grouped(marketRows, "cinema"));
  renderBars("hours-chart", grouped(marketRows, "hour").map((item) => ({
    ...item,
    name: `${String(item.name).padStart(2, "0")}:00`,
  })));
  renderDailyTrend(elapsed, silverRows);

  const quality = {};
  for (const row of marketRows) quality[row.quality] = (quality[row.quality] || 0) + 1;
  const labels = {
    exact_api_sales: "Точные продажи API",
    availability_estimate: "Admissions · capacity − free",
    closed_before_capture: "Закрыто до снимка",
    general_admission_unverified: "Безместная схема · не проверена",
    not_captured: "Нет финального снимка",
    capture_failed: "Ошибка запроса",
    source_anomaly: "Аномалия источника",
    silver_screen_approved: "mooon · согласованная выгрузка",
  };
  $("quality").innerHTML = Object.entries(quality)
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => `
      <div class="quality-row">
        <i class="quality-dot"></i><span>${esc(labels[key] || key)}</span><strong>${nf.format(count)}</strong>
      </div>`).join("") || '<div class="muted">Завершённых сеансов пока нет</div>';

  renderShare(rows, elapsed, usable, finalUsable, silverRows);
  syncOrbit("share-orbit", "share-track");
  syncOrbit("revenue-orbit", "revenue-share-track");
}

async function init() {
  const dataUrl = document.body.dataset.dataUrl || "data/market.json";
  source = await fetch(dataUrl, { cache: "no-store" }).then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  });
  for (const row of [...(source.sessions || []), ...(source.silver_screen?.sessions || [])]) {
    row.region = canonicalRegion(row.region, row.city);
  }
  $("updated").textContent = `Обновлено ${new Date(source.meta.generated_at).toLocaleString("ru-RU")}`;
  const allSilverRows = source.silver_screen?.sessions || [];
  const silverDates = unique(allSilverRows, "date").sort();
  const generatedDay = source.meta.generated_at.slice(0, 10);
  const reportingDates = silverDates
    .filter((value) => value >= REPORTING_START_DATE && value <= generatedDay)
    .reverse();
  reportingDateSet = new Set(reportingDates);
  $("period").innerHTML = '<option value="">Весь период</option>' + reportingDates
    .map((value) => `<option value="d:${esc(value)}">${new Date(`${value}T00:00:00`).toLocaleDateString("ru-RU")}</option>`)
    .join("");
  if (reportingDates.length) $("period").value = `d:${reportingDates[0]}`;
  refreshFilterOptions();
  document.querySelectorAll("select").forEach((select) => select.addEventListener("change", () => {
    refreshFilterOptions();
    render();
  }));
  render();
}

init().catch((error) => {
  $("updated").textContent = "Ошибка данных";
  $("subtitle").textContent = error.message;
  console.error(error);
});
