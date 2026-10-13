# europ-2027

## Name That Country

A world-map game: click a country, guess its name to yourself, reveal the answer and score the point honestly. 197 countries are scored; territories and disputed areas are shown in grey and not scored.

- `index.html`: page markup and styles
- `countries.js`: country outlines (SVG paths) and names
- `game.js`: zoom/pan, selection and scoring logic

Progress is saved in the browser (`localStorage`), so it stays on the device you play on.

### Run locally

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

It is a static site with no build step, so it can be served as-is from GitHub Pages.
