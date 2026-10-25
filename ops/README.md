# Poster metadata

`assets/posters/catalog.json` maps stable mooon film IDs and exact, confirmed public aliases to local 96x144 WebP images. Session IDs are not used. Competitor-only rows remain N/A. Ambiguous aliases are blocked, never guessed.

`refresh_posters.py` reads only public poster metadata through the existing read-only mooon configuration. It retains the published film catalog, adds films from the current published day, and downloads only new/changed posters. Existing cached images are reused. DB failures preserve the last published catalog; individual media failures retain an available prior image of the same film.

The existing `cinema-market-close.service` runs this as one optional `ExecStartPost`, using `market-posters.conf`. No new timer or service is installed. Financial code, history and publisher remain unchanged. An isolated Git worktree owns catalog/image commits, leaving the publisher's worktree and index clean. Pushes are ordinary fast-forward pushes; concurrent financial commits are retained.

The poster-only Python environment is `/var/lib/cinema-market/poster-tools/.venv`, with dependencies pinned in `requirements-posters.txt`. It does not alter the backend environment. The isolated worktree is inside the service's existing writable runtime directory. The drop-in adds write access only to the UI repository's `.git` metadata, keeping its financial working files read-only within this service. Install it as `/etc/systemd/system/cinema-market-close.service.d/zz-market-posters.conf` and reload systemd after the UI release and environment are present. Do not restart or rerun financial closure for poster testing.

Manual poster-only refresh (same command as the post-step):

```sh
sudo -u cinema-market /usr/bin/timeout 120 /var/lib/cinema-market/poster-tools/.venv/bin/python -B /opt/cinema-market-site/ops/refresh_posters.py --site-repo /opt/cinema-market-site --db-config /etc/cinema-market/mooon-db.yaml --worktree /var/lib/cinema-market/runtime/posters/site --publish
```

Structured output is `published`, `unchanged`, or `failed`. A failed media post-step is ignored by the existing close service; it cannot fail financial publication. Remove only this named drop-in and reload systemd to disable automatic poster refresh. Existing catalogs and images remain usable.
