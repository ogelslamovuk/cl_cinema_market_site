# HND-0003 v04 review candidate

This is a static HTML/CSS/JavaScript UI candidate. No framework, package installation, build step or application server was added. Serve the repository with any ordinary static HTTP server and open `/` or `/dashboard/`. Original client-side authentication behavior is unchanged.

Start with [actual screenshot index](../../SCREENSHOT_INDEX.md), [design decisions](../../DESIGN_DECISIONS.md), [baseline inventory](BASELINE.md), [functional QA](REGRESSION_REPORT.md) and [independent visual QA](VISUAL_QA.md).

The frozen baseline is site commit `c80e3cf8a1052e3346d30437d8fe80f289cce490`. Complete initial old/new regression ran on `5ecf147`; targeted repairs ran on `1b17691`, `e9e344e` and `4d4ce54`. Final published PNGs were captured from `4d4ce541a1281c1bc7853d34d6f30716950e3b44`. The following evidence-only commit changes no runtime file. The manifest records canonical Git-blob SHA256 values so the UI identity can be verified independently.

The final exact-HEAD functional integration verdict and reproducible audit tools are published under the existing private coordination [HND-0003 result](https://github.com/ogelslamovuk/cl_cinema_parcer/blob/coordination/agent-exchange/coordination/handoffs/HND-0003_20261024_market-ui-redesign/HND-0003_market-ui-redesign_RESULT_v01.md). The baseline's full locally generated oracle is deliberately excluded from the public repository; compact numerical differences, source controls and actual rendered screenshots are included here.

All status/error/zero/empty screenshots are explicitly sandbox fixtures. They do not describe live incidents. Before/after overview captures use the same preserved 23 October dataset. The production default date is dynamic and was not hardcoded.

`app.js`, `auth.js`, `CNAME` and `data/**` are identical to the baseline. Historical raw mooon controls for 20/21/22/23 October match the accepted values and SHA256 references. The 23 October raw file has 130 rows; the original renderer shows 129 eligible sessions because the remaining zero-ticket, zero-revenue row starts after the index generation timestamp. This distinction is unchanged. Original whole-BYN display rounding and inherited generated Admissions/Revenue terminology are also retained.

GitHub Pages serves `main` at `/`; this feature branch is not a live publication. Do not merge or publish before explicit independent Product Owner review. Readiness for review is not product acceptance.
