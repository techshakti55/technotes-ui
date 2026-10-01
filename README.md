# TechNotes UI — first public release

React/Vite frontend for a public technical notes library and a private admin author workspace. This release calls real User/OAuth and Notes APIs; there is no sample database or fake login.

## Preview before backend is ready

In VS Code, open this folder, copy `.env.example` to `.env.local`, set `VITE_DEMO_MODE=true`, then run `npm install` and `npm run dev`. Open the URL printed by Vite (usually `http://localhost:5173`). The yellow PREVIEW MODE banner is always shown. A sample ArrayList note appears; Admin sign in enters a local demo workspace, and demo drafts stay in this browser only. Nothing is saved to MongoDB. To connect real services set `VITE_DEMO_MODE=false` and restart Vite. Never deploy with demo mode enabled.

## Run locally

```bash
cp .env.example .env.local
npm install
npm run dev
```

Set the issuer and Gateway addresses in `.env.local`. In your OAuth service, register **public client** `technotes-web` with Authorization Code + PKCE S256 and exact redirect `http://localhost:5173/auth/callback`. Allow the browser origin on the issuer token endpoint. Issue `technotes-api` audience and scopes from `.env.example`. The single owner account needs ADMIN (and AUTHOR if required by the Notes policy), with the matching scopes.

## Build and deploy

```bash
npm run build
```

Upload `dist/` to AWS S3 + CloudFront or another static host. Configure SPA fallback: unknown UI routes such as `/notes/arraylist` and `/auth/callback` serve `index.html` (without swallowing `/api` requests). Route `/api/*` to the Gateway. Configure your OAuth issuer at its own stable HTTPS origin, for example `https://auth.technotes.co.in`; register exact `https://technotes.co.in/auth/callback`. Build-time variables: `VITE_API_BASE_URL=https://technotes.co.in`, `VITE_OAUTH_ISSUER=https://auth.technotes.co.in`, `VITE_SITE_URL=https://technotes.co.in`, client ID and scopes. Vite embeds `VITE_*` values into static JS: rebuild after changing them; never put secrets there.

GoDaddy can hold the domain while AWS hosts the site. Configure DNS records for CloudFront/your load balancer and TLS certificate for every origin. Domain purchase alone does not deploy the application. The backend needs durable PostgreSQL and MongoDB, private secrets, backups and HTTPS.

## API contract

See `TechNotes_First_Live_Release_API_Contract.md` in the package. The UI calls exactly the listed paths. It expects `{items:[...],page,size,totalElements,totalPages}` lists and `ETag` headers on protected note reads/mutations. It uses `If-Match` for edits, submit and publish. Both services validate access tokens; the Gateway only routes them.

## Known scope for today

- Home, public category filter, note reader and safe Markdown/code rendering.
- OAuth2 code + PKCE admin sign-in, own notes, category creation, draft editor, preview, submit and admin publish.
- Root category creation and filtering only; nested taxonomy navigation, pagination beyond first 100, revisions UI, Premium, blogs, search and uploads are later.
- Auth tokens are kept in browser `sessionStorage` until expiry/sign-out. This is a temporary SPA token handling choice. Before wider account rollout, review a BFF/session approach, CSP and XSS posture. Signing out clears local token; issuer session logout is not implemented here.

## Acceptance check

1. Visitor sees published notes without a token; unknown/private slug is 404.
2. Owner signs in with issuer, creates root category and note, saves, submits and publishes.
3. Refresh public page; published note appears, draft does not.
4. Invalid/no token cannot call protected paths; different account cannot see owner's drafts.
5. Direct reload of `/notes/{slug}` and `/auth/callback` works through hosting fallback.

No live backend or AWS deployment was available while packaging this UI, so the build is verified but end-to-end integration must be run against the two services.
