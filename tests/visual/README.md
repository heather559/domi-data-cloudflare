# Visual snapshots

Quick eyeball checks for the neighborhood template at mobile (640px) and tablet (900px) widths.

## Run

```bash
bun run test:visual
```

Screenshots are written to `tests/visual/screenshots/`. Open the PNGs to confirm layout after CSS changes. Nothing fails automatically — this is a "look at it yourself" tool, not a pixel-diff gate.

By default it hits `http://localhost:8080` (your local dev server). Point elsewhere with:

```bash
VISUAL_BASE_URL=https://domi-data.lovable.app bun run test:visual
```

To add more pages or widths, edit `PATHS` / `WIDTHS` at the top of `neighborhoods.mjs`.
