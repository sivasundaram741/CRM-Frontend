# CRM — Frontend

The web client for the CRM: a React single-page app built with Vite and Tailwind.

It is the front end only. Every screen reads from a separate Express/MongoDB API,
so this repository does not run on its own — point it at a running API with
`VITE_API_URL`, or let the dev server proxy to one (below).

## Running it

```bash
npm install
npm run dev          # http://localhost:5173
```

```bash
npm run build        # production bundle into dist/
npm run preview      # serve that bundle locally
```

## Configuration

Create a `.env` in this folder. Every key has a working default, so an empty
file is a valid setup for local development.

| Key | Default | What it does |
| --- | --- | --- |
| `VITE_API_URL` | *(blank)* | Where the API lives, **as the browser sees it**. Blank means same-origin `/api`, forwarded by the dev proxy below — no CORS. Set it to call another host directly, which is what a deployed build needs. |
| `VITE_API_PROXY_TARGET` | `http://localhost:5000` | Where the dev server forwards `/api` and `/uploads`. Ignored in a production build. |
| `VITE_PORT` | `5173` | Dev server port. Vite moves to the next free one if taken. |
| `VITE_HOST` | `false` | Bind all interfaces instead of localhost. Needed to forward a port or open the app from another device. |
| `VITE_APP_NAME` | `CRM Suite` | Shown in the sidebar and on the sign-in screen. |

Only `VITE_`-prefixed keys reach the browser, and everything that does is
readable by anyone using the app — never put a secret here.

### Proxy mode versus direct

Leaving `VITE_API_URL` blank is the easier setup: the browser only ever talks to
the web origin and Vite reaches the API server-side, so there is no CORS to
configure and one forwarded port is enough when tunnelling.

Setting it makes the browser call the API host directly. That host must then
allow this app's origin, and every request pays for a CORS preflight.

## Layout

```
src/
  pages/        one file per screen (Leads, Sales, Reports, Settings…)
  components/   shared UI — tables, forms, inputs, modals
  hooks/        data fetching, caching and master-data lists
  lib/          API client, auth context, formatting
```

## Notes

- The sign-in screen lists demo accounts. Those credentials belong to the API's
  seeded development data and mean nothing against a real deployment.
- Uploaded files and avatars are served by the API, not from here, so
  `VITE_API_URL` also decides where images resolve from.
