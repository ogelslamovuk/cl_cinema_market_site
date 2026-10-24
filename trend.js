/* Presentation only: daily values and availability come from the existing data loader. */
(() => {
  const number = new Intl.NumberFormat("ru-RU");
  const escape = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  const date = (value, full = false) => value ? new Date(`${value}T00:00:00`).toLocaleDateString("ru-RU", { day: "numeric", month: full ? "long" : "short", ...(full ? { year: "numeric" } : {}) }) : "—";
  let model = null;
  let selected = -1;
  let previousWindow = "";
  let resizeObserver;
  let resizeFrame;
  const available = (day) => day?.status === "ready";
  const value = (amount) => typeof amount === "number" && Number.isFinite(amount) ? number.format(amount) : "—";
  const share = (day) => available(day) && day.shareAllowed === true
    && ["GREEN", "YELLOW"].includes(day.quality)
    && Number.isFinite(day.market) && Number.isFinite(day.silver)
    && day.market > 0 && day.silver >= 0 && day.silver <= day.market
    ? `${(day.silver / day.market * 100).toFixed(1)}%` : "—";
  const shareNote = (day) => share(day) === "—" ? "Доля не рассчитана" : day.quality === "YELLOW" ? "Оценка · неполное покрытие" : "от всего рынка";
  const dayStatus = (day) => !day || day.status === "unavailable" ? "Нет опубликованных данных" : day.status === "error" ? "Не удалось загрузить день" : day.quality === "YELLOW" ? "Неполное покрытие рынка" : day.quality === "RED" || day.quality === "UNKNOWN" ? "Качество данных требует внимания" : "Опубликованные данные";

  function selectDay(index, focus = false) {
    if (!model?.days?.length) return;
    selected = Math.max(0, Math.min(index, model.days.length - 1));
    const root = document.getElementById("daily-trend");
    const day = model.days[selected];
    const inspector = root.querySelector(".trend-inspector");
    inspector.innerHTML = `
      <div class="trend-selected-date"><span>Выбранный день</span><strong>${date(day.day, true)}</strong><small class="trend-day-state ${available(day) && day.quality === "GREEN" ? "is-ready" : "is-partial"}">${dayStatus(day)}</small></div>
      <div class="trend-selected-market"><span><i aria-hidden="true"></i>Весь рынок</span><strong data-qa-atomic>${available(day) ? value(day.market) : "—"}</strong><small>билетов</small></div>
      <div class="trend-selected-mooon"><span><i aria-hidden="true"></i>mooon</span><strong data-qa-atomic>${available(day) ? value(day.silver) : "—"}</strong><small>билетов</small></div>
      <div class="trend-selected-share"><span>Доля mooon</span><strong data-qa-atomic>${share(day)}</strong><small>${shareNote(day)}</small></div>`;
    root.querySelector(".trend-day-position").textContent = `${selected + 1} из ${model.days.length}`;
    root.querySelector(".trend-day-prev").disabled = selected === 0;
    root.querySelector(".trend-day-next").disabled = selected === model.days.length - 1;
    root.querySelectorAll(".trend-day-column").forEach((node, i) => node.classList.toggle("is-selected", i === selected));
    const plot = root.querySelector(".trend-plot");
    plot.setAttribute("aria-label", `Проданные билеты. ${date(day.day, true)}. Весь рынок: ${available(day) ? value(day.market) : "нет данных"}. mooon: ${available(day) ? value(day.silver) : "нет данных"}. Доля mooon: ${share(day)}. ${shareNote(day)}. ${dayStatus(day)}. Стрелки влево и вправо — выбрать день.`);
    if (focus) plot.focus({ preventScroll: true });
  }

  function draw() {
    const root = document.getElementById("daily-trend");
    const plot = root?.querySelector(".trend-plot");
    if (!plot || !model?.days?.length) return;
    const width = Math.max(220, Math.floor(plot.clientWidth));
    const compact = width < 760;
    const rowHeight = 38;
    const height = compact ? 34 + model.days.length * rowHeight + 34 : 292;
    const top = 34, bottom = height - 34;
    const max = Math.max(0, ...model.days.filter(available).flatMap(day => [day.market, day.silver].filter(v => typeof v === "number" && Number.isFinite(v))));
    const rawStep = Math.max(1, max / 4);
    const magnitude = 10 ** Math.floor(Math.log10(rawStep));
    const normalizedStep = rawStep / magnitude;
    const step = Math.max(1, (normalizedStep <= 1 ? 1 : normalizedStep <= 2 ? 2 : normalizedStep <= 5 ? 5 : 10) * magnitude);
    const limit = step * 4;
    const axisWidth = Math.max(28, number.format(limit).length * 7 + 10);
    const left = axisWidth, right = width - 4;
    const slot = (right - left) / model.days.length;
    const barWidth = Math.min(compact ? 17 : 32, slot * .66);
    const y = amount => bottom - Math.max(0, amount || 0) / limit * (bottom - top);
    const ticks = [0, .25, .5, .75, 1];
    if (compact) {
      const barLeft = 54, barRight = width - 62;
      const x = amount => barLeft + Math.max(0, amount || 0) / limit * (barRight - barLeft);
      plot.innerHTML = `<svg class="timeline-horizontal" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" aria-hidden="true" focusable="false">
        <defs><pattern id="trend-missing-hatch" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M-1 1L1-1M0 5L5 0M4 6L6 4" stroke="currentColor" stroke-width="1"/></pattern></defs>
        <text class="timeline-axis" x="0" y="16">Дата</text><text class="timeline-axis timeline-share-heading" x="${width - 2}" y="16" text-anchor="end">Доля mooon</text>
        ${[0, .5, 1].map(tick => `<line class="timeline-grid" x1="${x(limit * tick)}" y1="${top - 4}" x2="${x(limit * tick)}" y2="${bottom}"/><text class="timeline-axis" x="${x(limit * tick)}" y="${height - 12}" text-anchor="${tick === 0 ? "start" : tick === 1 ? "end" : "middle"}">${number.format(limit * tick)}</text>`).join("")}
        ${model.days.map((day, index) => {
          const center = top + rowHeight * (index + .5);
          const missing = !available(day) || day.market === null || day.silver === null;
          return `<g class="trend-day-column${index === selected ? " is-selected" : ""}${missing ? " is-unavailable" : ""}" data-day-index="${index}">
            <rect class="timeline-selection" x="0" y="${center - rowHeight / 2 + 2}" width="${width}" height="${rowHeight - 4}" rx="5"/>
            <text class="timeline-date" x="0" y="${center + 4}">${date(day.day)}</text>
            ${missing ? `<rect class="timeline-missing" x="${barLeft}" y="${center - 10}" width="24" height="20" rx="3"/>` : `
            <rect class="timeline-market" x="${barLeft}" y="${center - 10}" width="${Math.max(0, x(day.market) - barLeft)}" height="20" rx="3"/>
            <rect class="timeline-mooon" x="${barLeft}" y="${center - 5}" width="${Math.max(0, x(day.silver) - barLeft)}" height="10" rx="2"/>
            ${day.market === 0 ? `<circle class="timeline-zero" cx="${barLeft}" cy="${center}" r="3"/>` : ""}
            ${day.silver === 0 ? `<line class="timeline-zero-mooon" x1="${barLeft}" x2="${barLeft}" y1="${center - 3}" y2="${center + 3}"/>` : ""}`}
            <text class="timeline-share-label${share(day) === "—" ? " is-unavailable" : ""}" x="${width - 2}" y="${center + 4}" text-anchor="end">${share(day)}</text>
            <title>${date(day.day, true)}. Весь рынок: ${available(day) ? value(day.market) : "нет данных"}. mooon: ${available(day) ? value(day.silver) : "нет данных"}. Доля mooon: ${share(day)}. ${shareNote(day)}. ${dayStatus(day)}</title>
          </g>`;
        }).join("")}
      </svg>`;
      plot.dataset.orientation = "horizontal";
      plot.dataset.plotTop = String(top);
      plot.dataset.plotBottom = String(bottom);
      return;
    }
    const markup = `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" aria-hidden="true" focusable="false">
      <defs><pattern id="trend-missing-hatch" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M-1 1L1-1M0 5L5 0M4 6L6 4" stroke="currentColor" stroke-width="1"/></pattern></defs>
      ${ticks.map(tick => { const position = y(limit * tick); return `<line class="timeline-grid" x1="${left}" y1="${position}" x2="${right}" y2="${position}"/><text class="timeline-axis" x="${left - 8}" y="${position + 4}" text-anchor="end">${number.format(limit * tick)}</text>`; }).join("")}
      ${model.days.map((day, index) => {
        const center = left + slot * (index + .5);
        const marketY = y(day.market), silverY = y(day.silver);
        const missing = !available(day) || day.market === null || day.silver === null;
        const lastIndex = model.days.length - 1;
        const showLabel = !compact || index === lastIndex || (index % 2 === 0 && index < lastIndex - 1);
        return `<g class="trend-day-column${index === selected ? " is-selected" : ""}${missing ? " is-unavailable" : ""}" data-day-index="${index}">
          <rect class="timeline-selection" x="${center - slot / 2 + 1}" y="${top - 8}" width="${slot - 2}" height="${bottom - top + 16}" rx="5"/>
          ${missing ? `<rect class="timeline-missing" x="${center - barWidth / 2}" y="${bottom - 36}" width="${barWidth}" height="36" rx="3"/>` : `
          <rect class="timeline-market" x="${center - barWidth / 2}" y="${marketY}" width="${barWidth}" height="${Math.max(0, bottom - marketY)}" rx="${Math.min(4, barWidth / 3)}"/>
          <rect class="timeline-mooon" x="${center - barWidth * .28}" y="${silverY}" width="${barWidth * .56}" height="${Math.max(0, bottom - silverY)}" rx="${Math.min(3, barWidth / 4)}"/>
          ${day.market === 0 ? `<circle class="timeline-zero" cx="${center}" cy="${bottom}" r="3"/>` : ""}
          ${day.silver === 0 ? `<line class="timeline-zero-mooon" x1="${center - 3}" x2="${center + 3}" y1="${bottom}" y2="${bottom}"/>` : ""}`}
          <text class="timeline-share-label${share(day) === "—" ? " is-unavailable" : ""}" x="${center}" y="${missing ? bottom - 44 : Math.min(marketY, silverY) - 9}" text-anchor="middle">${share(day)}</text>
          ${showLabel ? `<text class="timeline-date" x="${center}" y="${height - 12}" text-anchor="middle">${new Date(`${day.day}T00:00:00`).getDate()}</text>` : ""}
          <title>${date(day.day, true)}. Весь рынок: ${available(day) ? value(day.market) : "нет данных"}. mooon: ${available(day) ? value(day.silver) : "нет данных"}. Доля mooon: ${share(day)}. ${shareNote(day)}. ${dayStatus(day)}</title>
        </g>`;
      }).join("")}
    </svg>`;
    plot.innerHTML = markup;
    plot.dataset.orientation = "vertical";
    plot.dataset.plotLeft = String(left);
    plot.dataset.plotRight = String(right);
  }

  function render(input) {
    const root = document.getElementById("daily-trend");
    if (!root) return;
    if (resizeObserver) resizeObserver.disconnect();
    model = input;
    root.classList.add("trend-timeline");
    root.setAttribute("aria-busy", String(Boolean(input.loading)));
    const count = document.getElementById("daily-count");
    if (count) count.textContent = "14 дней";
    if (input.loading) {
      root.innerHTML = `<div class="trend-loading" role="status"><span class="trend-loading-icon" aria-hidden="true"></span><strong>Загружаем динамику за 14 дней</strong><p>${date(input.start)} — ${date(input.end)}. ${escape(input.filterLabel || "Все города и кинотеатры")}</p></div>`;
      return;
    }
    if (!input.days?.length) {
      root.innerHTML = `<div class="trend-loading" role="status"><strong>Динамика пока недоступна</strong><p>${escape(input.error || "Нет опубликованных данных за последние 14 дней.")}</p></div>`;
      return;
    }
    const windowKey = `${input.start}:${input.end}`;
    if (windowKey !== previousWindow || selected < 0 || selected >= input.days.length) selected = input.days.length - 1;
    previousWindow = windowKey;
    const gaps = input.days.filter(day => !available(day)).length;
    const partial = input.days.filter(day => available(day) && day.quality !== "GREEN").length;
    root.innerHTML = `
      <div class="trend-range"><span>${date(input.start)} — ${date(input.end, true)}</span><small>${escape(input.filterLabel || "Все города и кинотеатры")}</small></div>
      <div class="trend-inspector" aria-live="polite" aria-atomic="true"></div>
      <div class="timeline-legend"><span><i></i>Весь рынок</span><span><i></i>mooon <small>в составе рынка</small></span><span>Билеты · подписи — доля mooon</span></div>
      <div class="trend-plot" tabindex="0" role="group"></div>
      <div class="trend-day-controls"><span>Выбери день на графике</span><div><button class="trend-day-prev" type="button" aria-label="Предыдущий день">←</button><span class="trend-day-position"></span><button class="trend-day-next" type="button" aria-label="Следующий день">→</button></div></div>
      ${gaps || partial || input.error ? `<div class="timeline-availability" role="status"><span>${gaps ? `Нет данных: ${gaps} из ${input.days.length} дней. Штриховка обозначает пропуск, а не ноль. ` : ""}${partial ? `Неполное покрытие или ограничение качества: ${partial} дн. ` : ""}${input.error ? escape(input.error) : ""}</span>${input.days.some(day => day.status === "error") && typeof input.onRetry === "function" ? '<button class="timeline-retry" type="button">Повторить загрузку</button>' : ""}</div>` : ""}
      <p class="timeline-scope">Период графика не зависит от периода отчёта. Учитывает область, город, кинотеатр и фильм.</p>
      <details class="timeline-data"><summary>Все значения по дням</summary><div class="timeline-table-wrap"><table><thead><tr><th scope="col">Дата</th><th scope="col">Весь рынок</th><th scope="col">mooon</th><th scope="col">Доля mooon</th><th scope="col">Данные</th></tr></thead><tbody>${input.days.map(day => `<tr><th scope="row">${date(day.day)}</th><td>${available(day) ? value(day.market) : "—"}</td><td>${available(day) ? value(day.silver) : "—"}</td><td class="timeline-share">${share(day)}</td><td>${dayStatus(day)}</td></tr>`).join("")}</tbody></table></div></details>`;
    const plot = root.querySelector(".trend-plot");
    draw();
    selectDay(selected);
    const choose = event => {
      const bounds = plot.getBoundingClientRect();
      if (plot.dataset.orientation === "horizontal") {
        const top = Number(plot.dataset.plotTop), bottom = Number(plot.dataset.plotBottom);
        const relative = event.clientY - bounds.top;
        if (relative < top || relative > bottom) return;
        selectDay(Math.floor((relative - top) / (bottom - top) * model.days.length));
        return;
      }
      const left = Number(plot.dataset.plotLeft), right = Number(plot.dataset.plotRight);
      const relative = event.clientX - bounds.left;
      if (relative < left || relative > right) return;
      selectDay(Math.floor((relative - left) / (right - left) * model.days.length));
    };
    plot.addEventListener("pointermove", event => { if (event.pointerType === "mouse" || event.buttons) choose(event); });
    plot.addEventListener("pointerdown", event => { choose(event); if (event.pointerType !== "mouse") plot.setPointerCapture(event.pointerId); });
    plot.addEventListener("keydown", event => {
      const offset = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -1, ArrowDown: 1, Home: -selected, End: model.days.length - selected - 1 }[event.key];
      if (offset === undefined) return;
      event.preventDefault(); selectDay(selected + offset);
    });
    root.querySelector(".trend-day-prev").addEventListener("click", () => selectDay(selected - 1));
    root.querySelector(".trend-day-next").addEventListener("click", () => selectDay(selected + 1));
    root.querySelector(".timeline-retry")?.addEventListener("click", input.onRetry);
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => { cancelAnimationFrame(resizeFrame); resizeFrame = requestAnimationFrame(draw); });
      resizeObserver.observe(plot);
    }
  }

  globalThis.MarketTrend = Object.freeze({ render });
})();
