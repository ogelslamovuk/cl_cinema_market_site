# HND-0003 RESULT_v02 — independent visual/UX review

**Engineering visual gate: PASS, 9.0/10. Product Owner acceptance remains pending. No merge or publication is authorized.**

Fresh reviewed source: `d5aa7d5d289d31fbb9c2ec39cd0c6c5d957ed79d`. Chrome captures in `release-captures/` were generated from that clean commit, using the preserved original market-index/day bytes. Firefox150.0.2 key-screen captures from the separate functional QA agent were independently inspected in actual pixels on the same source commit. No builder score was used. A later evidence-only commit must identify that relationship and retain these runtime files unchanged.

The previous visual9.1 assessment did not adequately judge discoverability and accepted inherited English/tiny helper copy too readily. Product Owner REVIEW_v01 rejected that product state at approximately8/10. This report supersedes that engineering visual judgment; it does not reinterpret or override Product Owner's score.

## Five requested fixes: expected versus observed

| Product review finding | Expected | Independently observed on new source |
|---|---|---|
| P1:320 navigation hid “Данные” | All five sections discoverable without guessing a sideways gesture | PASS. Initial320 pixels show a deliberate two-row navigation: Обзор, Конкуренты, География; Фильмы, Данные. All five anchors have fully visible bounding boxes. Real pointer navigation to sections works. Original fragments remain. Before `before/overview-320.png`; after `release-captures/overview-320.png`. |
| P1:mobile film values were hidden without a cue | Visible instruction plus real horizontal access to every existing column, sticky film identity | PASS. Visible blue instruction “Все показатели фильма — листай таблицу →” appears above the table. Genuine Chromium touch dispatch moves scrollLeft481px at390 and384px at320. All nine headers can each be fully read across scrolling, accounting for the sticky film column's occlusion. Initial, touch-middle (actual monetary columns) and end (release status) PNGs retained for320/390; sticky names remain readable. Native Firefox ArrowRight also moves the table. All20 rows/nine columns remain the functional contract; numerical parity is covered separately. |
| P1:mixed Admissions/Revenue/net | Consistent Russian analytical labels; branding unchanged; exact/estimated caveats preserved | PASS. Actual overview, competitors and film table use Билеты, Доля билетов, Касса, Доля кассы and С учётом возвратов. Rendered-main scan finds zero Admissions/Revenue/net occurrences. Sources/brands remain unchanged. YELLOW/UNKNOWN/error pixels retain their qualification; monetary amounts and BYN stay coherent. |
| P2:tiny320 helper copy | Comfortable mobile helper/calendar/table/source text without shrinking amounts or losing containment | PASS after one targeted repair. Initial3584024 still had11px helpers,10px weekdays/current-slice label and single-day SVG labels physically10.48–11.64px; it was not accepted. Final mobile helper/calendar/source/table-status text is12px or larger. Remaining10px leaf glyphs are five information “i” icons inside30px buttons, not body/meta copy. Actual screen-transform SVG label sizes: day1440=12.606px,390=12.24px,320=12.227px; last7 mobile also≥12.227px. Actual pixels were inspected, not just CSS values. |
| P2:one-day chart wasted space | Compact truthful single-day presentation, useful direction to multi-day view, original points preserved | PASS. A compact single-day plot retains both7,809 market/2,962 mooon points, date, legend and the visible12px instruction to select7 days or a release week. Last7 remains a genuine unchanged seven-point chart. Day/last7 PNGs demonstrate the difference without replacing data with invented values. |

## Direct evidence reviewed

- Chrome1440/390/320 overview, real selected-region/film controls, competitors, source-quality, keyboard period picker, one-day and last7 charts.
- Mobile320/390 table initial state, real native touch-middle and actual end scroll; all nine headers readable across the scroll range. The320 sticky140px title and140px final status column fit together without clipping the status label.
- Synthetic YELLOW, UNKNOWN and HTTP404 rendered states at390. The HTTP404 fixture intercepts the actual day filename, so it produces genuine rendered HTTP404 text and empty share tracks, not a mislabeled default screenshot.
- Actual Firefox150.0.2 overview320, film initial/scrolled390 (cue/header now in view), and last7 chart1440 from `qa/firefox/`, captured by independent functional QA. No browser discrepancy affecting these revised surfaces was observed.
- Focused period open via Enter, Tab reaching the first preset with a3px visible outline, Escape close, and mobile touch controls. Font enlargement retains a contained picker and coherent financial groups.

`release-captures/report.json` and `release-fonts/report.json` contain no harness error. No document-wide horizontal overflow was observed in the tested overview/filter/table/chart/status states. Table scrolling is deliberately contained. This is a targeted review of the five Product Owner findings plus their neighboring UI; prior broader viewport coverage is not relabeled as newly executed.

The final21 Chrome PNGs in `release-captures/` are small viewport images, not generated mockups or shrunk long-page stand-ins. Before PNGs are preserved in `before/`: their runtime source was4d4ce54, verified by Git diff to be identical to the rejected evidence-only934174f for app.js/ui.js/styles.css/tokens.css/dashboard HTML.

## Limits and remaining gate

Visual score9.0 is this reviewer's engineering judgment for the repaired, scoped candidate. It is not a Product Owner approval or a guarantee of unspecified perfection. Full R01–R30,D01–D14,N01–N04 and exact final-SHA numerical parity are the separate functional acceptance gate. The final manifest must identify the source SHA and any later evidence-only SHA accurately.

Status screenshots are explicitly synthetic sandbox states, not production incidents. No auth credentials, CRM records, new data source or business rule was introduced by this review. Browser scratch directories for the new final runs are process-local under this task's D: area; no global environment was changed.

**Stop at renewed independent product review. Publish RESULT_v02 and evidence, keep the same PR open, do not merge or release.**
