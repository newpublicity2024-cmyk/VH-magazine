# Fonts

Self-hosted Latin subsets, loaded through `next/font/local` in `src/app/(frontend)/layout.tsx`.

| File | Font | Source | Licence |
|---|---|---|---|
| `inter-latin.woff2` | Inter v20, variable, weights 400–700 | Google Fonts (`fonts.gstatic.com/s/inter/v20/…1ZL7W0Q5nw.woff2`) | SIL OFL 1.1 — `OFL-Inter.txt` |
| `archivo-latin.woff2` | Archivo v25, variable, the full weight axis (declared 600–900: 900 is the "VH ___" section headings' word) | Google Fonts (`fonts.gstatic.com/s/archivo/v25/…sLydOxKsv4Rn.woff2`) | SIL OFL 1.1 — `OFL-Archivo.txt` |

Why local and not `next/font/google`: on 2026-11-11 Google Fonts began answering plain
HTTP/1.1 requests (no `Accept-Encoding`) with `/l/font?kit=…&skey=…` URLs. Turbopack's
font fetch makes exactly that request, and its font-file query cannot carry a `&`
("next/font/google queries have exactly one entry"), so production builds failed — and an
earlier build had already shipped Archivo as an unresolved internal URL (headings fell back
to Arial). The Inter file here is byte-identical to the one that build shipped.

To update: fetch `https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap`
with a browser user agent and compression, and take the `/* latin */` block's URL.
