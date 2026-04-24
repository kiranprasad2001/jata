# Self-hosting JATA

JATA is designed so that you — not a service provider — control the infrastructure it talks to. The default `EXPO_PUBLIC_BACKEND_URL` in the repo points at a demo instance for convenience; for anything beyond tinkering, run your own.

## What "the backend" actually is

A stateless Node relay (`backend/`) that:

- polls the TTC GTFS-Realtime feeds and caches the latest snapshot in memory,
- proxies transit routing to a MOTIS / OpenTripPlanner instance (default: [Transitous](https://transitous.org)),
- proxies geocoding to [Photon](https://photon.komoot.io).

No database. No user records. No request logging beyond redacted console output.

## 5-minute deploy (Docker)

```bash
git clone https://github.com/your-fork/jata.git
cd jata
docker compose up -d backend
```

That's it. The relay listens on `http://<host>:3000`. Health check: `curl http://localhost:3000/api/health`.

## Point the app at your relay

Two options:

**Option A — in-app (recommended for personal use):**
Open **Settings → Advanced → Backend Server URL** and paste `http://your-host:3000`. The app stores the URL on-device only.

**Option B — at build time:**
Set `EXPO_PUBLIC_BACKEND_URL` in `eas.json` or your `.env` before running `npx expo start` / building with EAS.

## Using different upstream services

The relay reads upstream URLs from environment variables, so you can swap them without touching code:

```bash
ROUTING_API_URL=https://your-motis-instance/api
GEOCODING_API_URL=https://your-photon-instance
PORT=3000
```

If you want to run your own MOTIS + Photon locally, both have published Docker images. The [Transitous docs](https://transitous.org/self-hosting) are a good starting point.

## What the relay logs

By default, the relay logs:

- cache update tick messages (`Cached N vehicles`, `Cached N alerts`),
- upstream HTTP error messages, with anything that looks like a `lat,lon` pair redacted to `[coord]`,
- rate-limit rejection warnings.

It does **not** log:

- request bodies,
- client IPs (beyond whatever the hosting provider records at the TCP layer),
- query parameters from `/api/directions` or `/api/search`.

If your hosting provider's platform logs add their own layer (e.g., Render stdout capture), be aware of what they retain.

## Hardening for public instances

If you're running a relay that other people will use:

1. Put it behind HTTPS (Caddy, Cloudflare, or nginx + Let's Encrypt).
2. Keep the default rate limiter on (500 req / 15 min / IP) — it's in `backend/src/index.ts`.
3. Drop the TTC-specific polling interval if you're relaying a different agency — see `TTC_*_URL` constants at the top of the file.
4. Don't add analytics. Don't. If you want traffic stats, look at your reverse proxy's request count and leave it there.

## The data JATA stores on a user's device

All listed in `CLAUDE.md` under "AsyncStorage Keys". Users can export this from **Settings → Backup & Restore** and carry it to a new install. Nothing ever leaves the device unless the user taps Share.
