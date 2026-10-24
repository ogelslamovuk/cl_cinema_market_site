# HND-0003 v04 — independent visual and UX QA

**Verdict: PASS for product review. Visual/UX rating: 9.1/10. Product acceptance and production release remain pending.**

Reviewed executable UI source commit `4d4ce541a1281c1bc7853d34d6f30716950e3b44` against preserved baseline `c80e3cf`, served over ordinary local static HTTP in installed Chrome headless with Playwright. All final `release-*` captures were freshly generated from this source commit. Adding review evidence later does not change this source identity. Root must record the final evidence-only commit and confirm UI files unchanged.

This reviewer did not implement UI changes. I independently read the v04 brief/matrix and pinned CRM `78cc1237c4d222c0ce65ea7c25431dbd4802fde5` DESIGN.md/index.css/crm.css. No CRM runtime or records were used. I inspected actual PNG pixels with the image-viewing tool, executed controls/navigation, and checked measured containment and contrast. Builder self-ratings were not supplied or used. Functional/numeric full regression belongs to the separate functional report; this visual PASS does not substitute for it.

## Why the redesign meets the reference bar

The old first screen spent most of its height on the title and decorative circles. The new 1440 first screen presents selected date, report confidence, both shares, mooon net tickets/money, market totals and efficiency metrics together. At 390, date/quality/shares and mooon money are visible in the first screen. Neutral surfaces, restrained blue, fine dividers, Inter, tabular values and consistent control/panel alignment match the CRM's enterprise design standard without copying its architecture. Mobile filters have a discoverable trigger/count rather than requiring sideways discovery of clipped selects.

## Required visual criteria

| Criterion | Result and direct evidence |
|---|---|
| V1 | PASS. Same preserved data requests for old/new 1440 and 390 overview; `baseline/overview-1440-viewport.png`, `baseline/overview-390-viewport.png`, `release-captures/overview-1440-viewport.png`, `release-captures/overview-390-viewport.png`. Full-page counterparts also retained. |
| V2 | PASS. Actual 1920x1080,1440x900,1280x800,768x1024 renders inspected. Date, status and major values remain legible; no page horizontal overflow. Evidence `release-captures/overview-{1920,1440,1280,768}-viewport.png`. |
| V3 | PASS. Actual 390x844,320x844 and constrained320x700. Cyrillic, long titles, percentages and BYN retained. Wide films table scrolls inside its own container (826px travel at320) without page overflow. All-history mooon amount `6 948 318 BYN` remains inside the repaired320 row. Evidence `release-captures/overview-320-viewport.png`, `release-navigation/all-history-320.png`, `release-constrained/table-scroll-320.png`. |
| V4 | PASS. Period day/week panes open and scroll; Escape closes. Keyboard Enter opens the picker and Tab reaches first preset with a visible3px outline. Mobile filter Escape closes and returns focus to trigger. Selected region+film count2 is visible. All15 settled anchor clicks (5 targets x1440/390/320) select correct underline; mobile Back/Forward retain matching hash/current state. Evidence `release-navigation/report.json`, `release-selected/selected-region-film-390.png`, `release-constrained/period-320x700.png`, `weeks-320x700.png`. |
| V5 | PASS. Networks, films, source panels, geography/daily/hour/cinema charts inspected in actual pixels. Daily single-day and last7 mobile labels now legible. Film column remains identifiable during horizontal scroll. Evidence `release-navigation/nav-{competitors,films,geography,quality-section}-{1440,390}.png`, `release-constrained/last7-chart-320.png`, `table-scroll-320.png`, `tooltip-320.png`. |
| V6 | PASS. Actual sandbox YELLOW/RED/UNKNOWN, verified-zero, empty/missing, HTTP404 and delayed-loading pixels inspected. Text qualifies status in addition to color; missing amounts are dashes, zero is explicitly0, 0/0 shares are not100. Loading/error tracks stay empty after repair. Evidence `release-captures/state-{YELLOW,RED,UNKNOWN,missing,404}-viewport.png`, `release-zero-empty/state-{zero,empty}-viewport.png`, `release-loading/state-loading-viewport.png`. |
| V7 | PASS. Normal widths and200% equivalent reflow (720x450CSSpx atDPR2,1440x900 output) have no page x-overflow. Text, focus and tooltips inspected. Flat text contrast: muted/white5.04:1, muted/canvas4.70:1, main muted text/white9.43:1, blue/white6.47:1; status text6.90–7.33:1. Evidence `release-constrained/zoom200-overview.png`, `report.json`, `release-navigation/keyboard-period-320.png`. |
| V8 | PASS. Coherent overview, filters, tables, source/status components and responsive hierarchy. No decorative hero or gauge competes with the analyst's first question. Clear upgrade from baseline, consistent with pinned CRM quality cues. |

## Defects found and repairs independently verified

1. Mobile active navigation selected the preceding section after real anchor clicks. Fixed in presentation JS; final15/15 clicks and mobile history transitions pass.
2. The initial HTTP404/loading share tracks were fully colored despite unknown percentages. Default track width now0; actual delayed-loading and404 pixels show empty tracks, normal actual report still shows37.9/49.2 proportions.
3. Short844x390 landscape picker originally extended below the viewport. Final top80/bottom374 is contained with independent scrolling;320x700 top122/bottom682 is also contained.
4. Earlier root/designer/functional findings (filter count after automatic reset,320 all-history money crowding, tiny scaled SVG labels) were inspected on repaired UI. No residual visual blocker observed.

No unresolved Blocker/Critical or mandatory visual failure remains. Non-blocking inherited terminology includes Admissions/Revenue in original generated analytical copy and the original singular-day count wording; these do not hide the metric and were not changed in protected app.js. This report does not claim new financial correctness from prettier pixels.

## Evidence and fixture integrity

`release-captures/report.json`, `release-navigation/report.json`, `release-constrained/report.json`, `release-selected/report.json`, `release-zero-empty/report.json` and `release-loading/report.json` contain no harness error. The full six-width report has no document overflow. A prior CSS `zoom:2` experiment was rejected as an inaccurate browser-zoom proxy; its earlier artifacts are not release evidence. Final200% evidence uses actual720CSSpx reflow and2x output pixels.

Status/zero/empty/error/loading screenshots are **sandbox synthetic fixtures**, not production incidents or actual reported business days. Status fixtures override index status solely for visible-state review. Zero/empty fixtures replace day rows and update their SHA; frozen index-quality metadata remains, so their GREEN banner is not a new claim that an empty production source is complete. HTTP404 routing was corrected to match the actual `days/filename` path and independently confirmed through rendered HTTP404 text; earlier falsely labeled404 PNG is excluded.

No credentials or customer records are in these screenshots. Original app.js SHA256 matches baseline exactly: `350ef3afea8d2f2221690a3b18383090a1ed9ca25070a68608aa3c73a4b52285`.

**Release stop:** readiness for independent Product Owner UI review only. Do not merge or publish before that approval.
