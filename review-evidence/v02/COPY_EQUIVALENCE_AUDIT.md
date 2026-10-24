# Independent copy-equivalence and source audit

Candidate d5aa7d5d289d31fbb9c2ec39cd0c6c5d957ed79d: **PASS**.

Applying the eleven declared source literal replacements to immutable c80e3cf app.js produces the ENTIRE candidate app.js exactly, normalizing CRLF only. Independent comparison has no unexplained diff: expressions, math, conditions, fetch, validation, aggregate/filter/date/quality logic and source keys are unchanged. auth.js/CNAME remain byte-identical and data/** git diff empty. Translation-map SHA256: eacd30c5b6497d82256862b6189a7e16f022da7ccbdaf1075706d57f5103a55d. Detailed individual replacement counts are in SOURCE_AUDIT.json.

Approved visible-text substitutions, applied only to metrics.* and rendered.* in the frozen G0 oracle:

| Old phrase | Approved new phrase |
|---|---|
| Admissions mooon из | — mooon · |
| Admissions рынка | — рынок |
| Revenue mooon из | — mooon · |
| Revenue рынка | — рынок, включая оценку |
| mooon + сеансы конкурентов с точным Revenue | mooon + сеансы конкурентов с точной кассой |
| Admissions share | Доля билетов |
| % revenue | Доля кассы |
| Admissions | Билеты |
| Revenue | Касса |

One separately authorized whole-string equivalence applies ONLY to metrics.daily-count: anchored old pattern a captured integer followed by space and the Russian word for days becomes the Russian label for Days, colon, and the SAME captured integer. Other daily-count phrases such as 'last14of...' do not match and remain exact. No digit extraction, digit-only comparison, rounding or broader language normalization is used.

Film/source/provider names, dates, option values and labels, raw records and series receive NO text transformation. Monetary/admissions/share/coverage display strings remain exact outside these explicitly declared copy fragments. Previously accepted <1e-7 IEEE addition-order noise applies only to unrounded internal arrays; displayed numbers have no tolerance.

This source audit is independent of Designer selftests. It does not itself replace final functional regression or independent actual-pixel review.
