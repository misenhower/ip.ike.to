# ip.ike.to

A fetch-style Cloudflare Worker that reports the visitor's IP address, reverse
DNS hostname, user agent, and request headers.

## Routes

| Route | Response |
| --- | --- |
| `/` | HTML request summary |
| `/txt` | Client IP as plain text |
| `/api` | IP, reverse DNS hostname, and user agent as JSON |
| `/api/ip` | Client IP as JSON |

The JSON routes allow cross-origin GET requests. All dynamic responses use
`Cache-Control: private, no-store` because they contain visitor-specific data.

## Run locally

Requires Node.js 22 or newer.

```sh
npm install
npm test
npm run dev
```

Wrangler serves the application at `http://localhost:8787` by default. The CSS
under `public/` is served as a static Worker asset.

## Deploy

```sh
npm run deploy
```

The initial deployment uses a `workers.dev` address. After verifying it, add
`ip.ike.to` and `ipv6.ike.to` as Worker custom domains in the Cloudflare
dashboard. Keeping custom-domain routing out of `wrangler.jsonc` makes the DNS
cutover a deliberate final step.

Cloudflare Workers Builds can connect this repository to GitHub and run
`npx wrangler deploy` whenever the production branch changes.

The `ipv6.ike.to` hostname is expected to reach the same Worker. Cloudflare
custom domains are normally dual-stack, so the browser—not the Worker—chooses
whether that secondary request uses IPv4 or IPv6.
