# Market Collector UI — HND-0003 v06

24 October 2026. Current v06 candidate starts from site `d6483f9` and is for independent product review, with no production release or merge. Earlier v02/v04 decisions below are retained as iteration history where explicitly labelled.

## Direction

A calm, light enterprise analytics workspace for daily executive decisions. The exact CRM/CDP reference `ogelslamovuk/m_crm_cdp@78cc1237c4d222c0ce65ea7c25431dbd4802fde5` was inspected read-only: `frontend/DESIGN.md`, `frontend/src/index.css`, `frontend/src/crm.css`. Borrowed qualities are locally bundled Inter typography, restrained blue actions, fine borders, aligned tabular figures, neutral surfaces and contained tables. No CRM runtime, records, components, architecture or backend were imported. The original synthetic Ledger recipe in web-ui-design was a secondary composition reference only.

## Composition

- Persistent compact section navigation preserves every existing fragment target.
- A concise report heading leads to the date/filter toolbar and the original quality status, then mooon position and net sales within the first screen.
- Two newly designed full-sector discs show the existing ticket/cash shares. Percentages sit outside the circles, with explicit mooon/other legends. Existing computed outputs remain owned by `app.js`; `ui.js` qualifies graphical/ARIA presentation against existing quality and load/error state.
- New executive net-sales figures are **verbatim DOM mirrors** of the existing mooon source summary, including its original whole-BYN rounding and unavailable indication. They neither compute nor read data independently. No exact-currency claim is added.
- Market totals and operational indicators form quieter comparison bands. Networks, daily demand/geography, all original film columns, cinema/hour bars and source detail remain in their original business order and scope.
- Mobile keeps the period visible and places the four original native geographic/film selectors behind one labelled inline disclosure. This is a compact expandable filter panel, not a modal; keyboard access, Escape and focus return are supported. Selected-filter count is presentation only.
- Film comparison is deliberately horizontally scrollable with a focusable, labelled container. All original columns remain; film names remain visible while horizontally scrolling on mobile.

## Protected behavior

Business expressions, functions, keys, conditions and data handling in `app.js` are unchanged. Relative to current v06 baseline its only changes are the first film cell's poster/title wrapper and one optional presentation call for the existing top20 array plus existing selected mooon rows (3 added lines, 1 removed line). There are no aggregation/classification changes. The earlier v02 copy translations are already in that baseline. `auth.js`, `CNAME` and `data/**` remain unchanged. Existing root/login form IDs and authentication behavior are retained. Presentation-only `ui.js` handles filter disclosure, mirrors, active section navigation, amount containment and validated disc/ARIA presentation. The independent old/new oracle still compares all numeric outputs exactly. GREEN/YELLOW/RED/UNKNOWN use the same original business logic; status is readable text as well as color. Unavailable-day state keeps the period/filter controls reachable.

## System and provenance

Implemented tokens are in `tokens.css`; layout and states are in `styles.css`. Inter Variable 4.1 is locally bundled from the upstream Inter release (`https://github.com/rsms/inter/tree/v4.1`), under SIL Open Font License, retained in `assets/fonts/OFL-Inter.txt`. Latin/Cyrillic and financial units are checked in the actual browser. No remote fonts, analytics, runtime dependency or framework added.

## Verification scope

Developer headless self-checks cover static HTTP at 1920, 1440, 1280, 768, 390 and 320 widths, first-screen and full-page screenshots, financial atomic groups, JavaScript errors, keyboard disclosure and period interactions. Independent functional and visual QA are separate release gates. This document does not certify their outcomes or replace product acceptance.

## Product review v01 — targeted v02 revision

The original product review requested corrections to discoverability and finish, not a second redesign. At 320 px all five section links now form two complete visible rows. Mobile film comparison has a persistent visible scroll instruction; film names and the first header remain sticky while the original nine columns and top-20 scope are retained. Narrow metadata is raised to a readable size by redistributing lines rather than compressing type. Admissions/Revenue/share/net terminology is translated into consistent Russian without altering business expressions or numbers. A single-day trend retains both original series, markers and labels in a compact graph, with a visible instruction to select a longer period for dynamics; multi-day graphs are unaffected. The review's no-merge/no-release boundary remains active.

## Handoff v06 — new sector comparison and mooon poster slots

The user rejected the loss of immediate graphical share reading in real UAT. This iteration designs a new comparison rather than restoring the old dark interface: two full sector discs encode the already-computed percentage, with the percentage outside the circle, a small explicit mooon/other legend and separate source notes. Blue identifies ticket share; teal identifies nominal-cash share with its estimate qualification. The geometry is a full pie partition, not the previous hollow orbit with a centered percentage. Neutral hatching and an unavailable dash distinguish unproved/loading/error states from a genuine verified 0% solid empty sector; verified 100% has a fully colored disc.

`ui.js` reads the existing percentage text and existing global quality/loading state only. It does not recalculate sales or financial ratios. The dedicated paint value and ARIA value are removed/reset when proof is missing, even if an old percentage or stale original `--orbit-value` remains. All existing source IDs and numeric outputs remain. Short source-composition notes and coverage are retained inside the native labelled “Состав рынка и полнота данных” disclosure; source links remain visible beside it. This allows the mobile first view to show both circles and the four absolute ticket/cash figures without shrinking helper text below 12px. Wide historical amounts use a full-width ledger row rather than spilling outside a card.

The same executive grid uses four columns on desktop and two on phones. Mobile section navigation shows all five original anchors in one fully visible row; film comparison keeps its visible scroll instruction and sticky first column. The poster slot is a reserved 32×48 portrait (30×45 at 320px), next to the unchanged film title. Actual poster resolution and DB provenance belong to the separate read-only mooon poster manifest. A neutral N/A tile (a deliberately miniature 10px thumbnail badge) is visibly distinct from a warm dashed unavailable-poster tile. Badge text is CSS-generated, preserving the first cell's original textContent. The UI neither uses competitor image URLs nor invents a replacement movie image. Original film order, top-20 limit and nine financial columns remain.

Independent visual review must inspect the actual new screenshots against both the old and current Market on the same day. Early review is not final acceptance or permission to release. No production merge/publication is authorized by this note.
