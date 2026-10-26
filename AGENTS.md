# Local workspace and publication safety

- This is the static UI repository. Backend: `D:\JetBrains\cl_cinema_parcer`.
- Keep the canonical checkout here. Use the backend's ignored `.artifacts/worktrees/` for temporary worktrees; never create sibling QA/release copies in `D:\JetBrains`.
- `main` is intentionally retained for the existing Pages/publisher configuration. Do not rename it as part of housekeeping.
- Never manually alter `data/**`, credentials, business formulas, or production services for repository cleanup.
- Preserve runtime URLs. Keep historical curated QA evidence under `docs/reviews/`, not disposable browser caches.
- Verify remote reachability and preserve unique changes before removing a worktree through Git. Do not delete active preview/task files.
- After an accepted task, remove disposable profiles and source archives; keep only the final evidence and a small recovery record. Keep private recovery data out of Git.
