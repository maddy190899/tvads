# PiP Air-Quality Widget

A persistent corner **air-quality widget** for TechYzer screens, driven by the
**[Open-Meteo Air Quality API](https://open-meteo.com/en/docs/air-quality-api)** — no API key,
no signup. Shows the current **US AQI** (color-coded by EPA band) plus the component
pollutants (PM2.5 / PM10 / O₃ / NO₂) and refreshes itself in place.

```
Open-Meteo Air Quality  ──poll──▶  aqi.js  ──POST /api/pip──▶  TechYzer  ──ws──▶  player
   (us_aqi, pm2.5, …)              (normalise + color)         (web overlay)        (corner widget)
```

It pushes a `type: web` overlay with `duration: 0` (stays up until cleared) and re-pushes
each poll; the player keeps a single overlay slot (last-show-wins) so the widget just updates.
On `Ctrl-C` it clears the overlay.

## How it works

- **`aqi.js`** — polls Open-Meteo, normalises the response, maps the US AQI to an EPA category
  + color, and pushes/refreshes the overlay. Pure helpers (`aqiCategory`, `normalise`,
  `aqiUrl`, `overlayUri`) are exported for the test.
- **`aqi-overlay.html` + `aqi-overlay.js`** — the overlay page rendered in the player's iframe.
  All data comes from the URL query string; the JS is external (no inline script) so it passes
  the signage server's CSP (`scriptSrc 'self'`).

### US EPA AQI bands

| US AQI | Category | Color |
|---|---|---|
| 0–50 | Good | `#1f9d55` |
| 51–100 | Moderate | `#F2C200` |
| 101–150 | Unhealthy (Sensitive) | `#E8730C` |
| 151–200 | Unhealthy | `#CC0000` |
| 201–300 | Very Unhealthy | `#7B0000` |
| 301+ | Hazardous | `#5B0000` |

## Setup

1. **Host the overlay page.** Copy both `aqi-overlay.html` and `aqi-overlay.js` into your
   signage server's frontend directory so they're served same-origin as the player (required by
   the CSP). They'll be reachable at `https://<your-server>/aqi-overlay.html`.

2. **Get a `full`-scope API token** (`st_…`) from the dashboard.

3. **Configure.** Copy `config.example.json` → `config.json` and fill in:
   - `api_base` — your TechYzer server, e.g. `https://signage.example.com`
   - `api_token` — the `st_…` token
   - `overlay_base_url` — `https://<your-server>/aqi-overlay.html`
   - `device_id` — a device **or** group id
   - `lat` / `lon` / `location_name` — the location to report
   - optional: `poll_interval_sec` (default 900), `position` (default `top-right`),
     `width`/`height`, `border_radius`

4. **Run:**
   ```bash
   node aqi.js
   ```
   Leave it running; it refreshes every `poll_interval_sec`. `Ctrl-C` clears the overlay.

## Test (offline, no network)

```bash
npm test
```
Checks the EPA band boundaries, the category→color map, and the normaliser against
`fixture-aqi.json`. Prints `RESULT: PASS ✅`.

## Local quick-start (this machine)

The local dev instance serves the player over self-signed HTTPS, so disable TLS verification:

```bash
# 1. copy the overlay assets into the local server's frontend dir, e.g.:
cp aqi-overlay.html aqi-overlay.js /home/owner/Downloads/remote_display/frontend/

# 2. config.json for the local "testing" player:
#   api_base         https://localhost:3443/
#   api_token        st_REPLACE_WITH_A_FULL_SCOPE_TOKEN
#   overlay_base_url https://localhost:3443/aqi-overlay.html
#   device_id        DEVICE_OR_GROUP_ID

NODE_TLS_REJECT_UNAUTHORIZED=0 node aqi.js
```

## Notes

- Open-Meteo's `us_aqi` is the **overall** US AQI (max of the per-pollutant sub-indices).
- The free Open-Meteo API is rate-limited; a 900s (15 min) poll is plenty for air quality.
- `config.json` is gitignored (it holds your token).
