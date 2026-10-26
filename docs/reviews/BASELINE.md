# G0 frozen baseline and independently reproducible oracle

Baseline site checkout: c80e3cf at D:/JetBrains/cl_cinema_market_baseline_hnd0003.
Site source/auth/data were read only. No production requests or writes, no CRM runtime.
Served with ordinary local HTTP, actual installed Chrome through Playwright, Europe/Minsk browser; supplemental UTC and Los Angeles week scenarios.

## Independent G0 decision

ACK: complete enough to begin UI implementation. Actual pre-change HTML, controls, every source function and full rendered data outputs captured independently of Designer. This is baseline readiness, not candidate acceptance. Candidate regression remains required.

Reproduce with bundled node: baseline.cjs <immutable checkout> baseline. To complete only supplemental cases while preserving frozen 33 primary cases: add --supplement. The harness has no credentials in its serialized output. Credentials for valid local auth testing are read in memory from the unchanged local auth.js and never emitted. Dashboard tests set sessionStorage only on localhost.

## Frozen source hashes

- app.js: 350ef3afea8d2f2221690a3b18383090a1ed9ca25070a68608aa3c73a4b52285
- auth.js: 8a5dc1db4d57703d9c92f96d35251f246cb6a1bd963960f94ee7eb5393c35617
- index.html: c68a020ae8be68626f397c4332b734f4fd48e4b391117f2ca3287423d966534c
- dashboard/index.html: 1a4ecace426352184260e07e25d663c08c00a1f8129d14adf7e7179a9a9a7040
- data/market-index.json: 1f3b0777d4ed24570e59fd925039547f898d1cc98d6c88d49e70ce244f19eb27

Oracle SHA256: f0ef725898c3772a2e92046afa7b64c238b68fdbc299c622c360bf1adab7f1bf

## Complete source UI inventory

- Root login: username/password inputs, submit, invalid credentials error, blocked-sessionStorage error, granted-session root redirect, dashboard unauthenticated redirect, valid entry and reload. No logout control exists.
- Fragment routes: #overview, #competitors, #geography, #films, #quality-section. Browser URL contracts unchanged.
- Five selectors: period, region, city, cinema, film. Dependencies operate in that order. Geographic labels normalize Minsk city separately from Minsk region; filter option order frozen.
- Period: hidden native select; trigger; day/week tabs; yesterday, last7, current Thu-week, all; individual day including unavailable days; individual historical weeks. Click-outside and Escape close. Current date/date list generated from publisher index; last7 uses Minsk yesterday.
- Position: admissions share, revenue share, their qualification notes, market ticket/revenue totals, exact/estimate notes, overall coverage and status banner.
- Efficiency: elapsed sessions + usable missing qualification, average price, occupancy, estimate share.
- Networks: mooon, Skyline, Falcon Club, Prizma, KVP and any discovered Korona networks; provider ownership uses provider/sid/cinema id, not only displayed network name.
- Films: market/mooon/competitor admissions; market/mooon revenue; mooon share; film market share; shared/mooon-only/competitor-only release. Existing descending tickets order and 20 row cap. Film total count may exceed cap.
- Geography/cinema/hour bars: measured sessions only, descending tickets, existing top 8 limit. Daily trend existing last 14 days, total day count, SVG accessible title/description and market/mooon points.
- Data: separate mooon, ByCard, Korona, Skyline import date/count/ticket/revenue or found/measured/missing summaries; quality classifications and interactive explanatory tooltips with outside click and Escape.
- States: loading aria-busy progress, initial failure, period failure preserving previous data, retry by selecting again, unavailable day, unknown quality, RED measured facts with shares hidden, YELLOW caveats, GREEN, verified zero, empty.
- Loading behavior: index no-store; immutable per-day SHA256; four parallel workers; day cache/pending deduplication; latest periodRequestId wins; legacy fallback only on index404; source publication metadata authoritative.

## Mandatory row coverage in frozen oracle

| ID | Baseline evidence / disposition |
|---|---|
| R01 | Captured: auth |
| R02 | Captured: default |
| R03 | Captured: 2026-10-20, 2026-10-21, 2026-10-22, 2026-10-23 |
| R04 | Captured: last7 |
| R05 | Captured: week, older-week, timezone-UTC, timezone-America-Los_Angeles |
| R06 | Captured: all |
| R07 | Captured: inventory, popover; all day/week option values frozen |
| R08 | Captured: region-0 through region-5 |
| R09 | Captured: competitor-only-city, geography-cinema |
| R10 | Captured: geography-cinema |
| R11 | Captured: long-film |
| R12 | Captured: combined-all-filters |
| R13 | Captured: cleared, auth.reload |
| R14 | Captured: fixture-corrupt, fixture-404, provenance |
| R15 | Captured: mutable-index-before, mutable-index-after |
| R16 | Captured: race, failed-selection-preserves-default, retry-recovery |
| R17 | Captured: all scenario metrics/share + fixture-zero + fixture-empty |
| R18 | Captured: all scenario revenue + estimates + source raw controls |
| R19 | Captured: all scenario notes/quality counts |
| R20 | Captured: fixture-YELLOW, fixture-RED, fixture-UNKNOWN, last7, all |
| R21 | Captured: rendered.competitor-cards each state, provider source code inventory |
| R22 | Captured: films + rendered.films-table each state; top 20 order |
| R23 | Captured: rendered.daily-trend each state, same-data series |
| R24 | Captured: series.region/city + rendered chart each state |
| R25 | Captured: series.cinema/hour + rendered chart each state |
| R26 | Captured: metrics sessions/ATP/occupancy/estimated/coverage each state |
| R27 | Captured: all provider metrics + rendered.quality + tooltip |
| R28 | Captured: unavailable-static, fixture-empty, fixture-missing-mooon, index-failure, corrupt,404, retry |
| R29 | Captured: ordinary static localhost / and /dashboard/, inventory fragment links |
| R30 | Captured: immutable baseline SHA + complete protected file manifest; root verifies candidate diff |

## Expanded discovered scenarios

D01 all six region options; D02 competitor-only city verified mooon zero share; D03 long film; D04 all filters cascade and reset; D05 August week and history limits; D06 unavailable day retains hidden previous DOM; D07 tooltip click/Escape; D08 legacy fallback; D09 staged mooon status; D10 initial index503; D11 selected-day404 recovery; D12 new live index on reload; D13 browser timezone parity; D14 actual auth valid/invalid/refresh/root redirect.

## Sandbox sabotage observed

N1 corrupted SHA: dashboard reports error, no unverified figures accepted. N2 undelivered day: default moves to delivered22; selecting23 shows unavailable, prior metrics retained only behind unavailable view. N3 missing mooon quality: UNKNOWN, shares unavailable; real verified-zero: zero tickets/revenue and shares em dash (never100%). N4 delayed20 then21: final active period21 and correct 2046 mooon tickets after late20 response.

Fixtures are routed only inside local Playwright context; disk data unchanged. YELLOW/RED/UNKNOWN fixtures intentionally modify publisher assessment metadata. They test presentation of supplied truth, not quality recalculation (frontend does not recompute those business gates).

## Existing quirks and limits (not new regressions)

- Entire history legitimately contains RED dates, hence aggregate RED and hidden shares. Last7 includes YELLOW and displays caveats. Never 'repair' these into GREEN.
- Unavailable day hides previous metrics instead of clearing their DOM text. Oracle records hidden flag separately; hidden prior figures are not a stale visible report.
- Forged GREEN assessment paired with empty day stays GREEN in existing app: publisher metadata is authoritative; denominator shares remain unavailable. This is a deliberately inconsistent sandbox fixture, not a mandate to change business logic.
- Missing/unready mooon hides shares; source card can retain rows if fixture leaves them present. Exact preserved behavior documented.
- Existing bars top8, films top20 and trend last14 are product contract; do not expand/sort differently without owner approval.
- Source snapshots/functions are frozen from old app. Candidate expected values must come from this oracle, never new-code-generated expectations.

## Actual captured scenarios

| Scenario | Period | Status | mooon tickets | mooon revenue as rendered |
|---|---|---|---|---|
| default | d:2026-10-23 | GREEN | 2 962 | 60 854 BYN |
| 2026-10-20 | d:2026-10-20 | GREEN | 2 001 | 39 718 BYN |
| 2026-10-21 | d:2026-10-21 | GREEN | 2 046 | 40 406 BYN |
| 2026-10-22 | d:2026-10-22 | GREEN | 1 645 | 33 292 BYN |
| 2026-10-23 | d:2026-10-23 | GREEN | 2 962 | 60 854 BYN |
| last7 | r:last7 | YELLOW | 22 901 | 448 574 BYN |
| week | w:2026-10-22 | GREEN | 4 607 | 94 146 BYN |
| older-week | w:2026-08-06 | GREEN | 33 994 | 645 462 BYN |
| all | all | RED | 352 281 | 6 948 318 BYN |
| unavailable-static | d:2026-08-11 | RED | 352 281 | 6 948 318 BYN |
| region-0 | d:2026-10-23 | GREEN | 2 612 | 54 040 BYN |
| region-1 | d:2026-10-23 | GREEN | 350 | 6 814 BYN |
| region-2 | d:2026-10-23 | GREEN | — | — |
| region-3 | d:2026-10-23 | GREEN | — | — |
| region-4 | d:2026-10-23 | GREEN | — | — |
| region-5 | d:2026-10-23 | GREEN | — | — |
| competitor-only-city | d:2026-10-23 | GREEN | — | — |
| geography-cinema | d:2026-10-23 | GREEN | — | — |
| combined-all-filters | d:2026-10-23 | GREEN | — | — |
| long-film | d:2026-10-23 | GREEN | — | — |
| cleared | d:2026-10-23 | GREEN | 2 962 | 60 854 BYN |
| fixture-YELLOW | d:2026-10-23 | YELLOW | 2 962 | 60 854 BYN |
| fixture-RED | d:2026-10-23 | RED | 2 962 | 60 854 BYN |
| fixture-UNKNOWN | d:2026-10-23 | UNKNOWN | 2 962 | 60 854 BYN |
| fixture-missing-mooon | d:2026-10-23 | UNKNOWN | 2 962 | 60 854 BYN |
| fixture-zero | d:2026-10-23 | GREEN | 0 | 0 BYN |
| fixture-empty | d:2026-10-23 | GREEN | — | — |
| fixture-corrupt | all | UNKNOWN | — | — |
| fixture-404 | all | UNKNOWN | — | — |
| fixture-not-delivered | d:2026-10-22 | GREEN | 1 645 | 33 292 BYN |
| fixture-legacy | d:2026-10-23 | UNKNOWN | — | — |
| fixture-staged | d:2026-10-23 | GREEN | 2 962 | 60 854 BYN |
| race | d:2026-10-21 | GREEN | 2 046 | 40 406 BYN |
| failed-selection-preserves-default | d:2026-10-23 | GREEN | 2 962 | 60 854 BYN |
| retry-recovery | d:2026-10-20 | GREEN | 2 001 | 39 718 BYN |
| mutable-index-before | d:2026-10-22 | GREEN | 1 645 | 33 292 BYN |
| undelivered-selected | d:2026-10-23 | GREEN | 1 645 | 33 292 BYN |
| mutable-index-after | d:2026-10-23 | GREEN | 2 962 | 60 854 BYN |
| timezone-UTC | w:2026-10-22 | GREEN | 4 607 | 94 146 BYN |
| timezone-America-Los_Angeles | w:2026-10-22 | GREEN | 4 607 | 94 146 BYN |

Harness errors remaining: 0. Candidate parity/visual gate not yet run.

Raw mooon 23 October contains 130 source rows; rendered eligible session count is 129 because one row starts after generated_at (24 October 06:35 +03, zero tickets/money). Existing frontend excludes future starts. Raw session control and rendered eligible sessions measure different populations; this is preserved behavior, not a regression. Tickets and revenue agree.
