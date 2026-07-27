# ip.ike.to

A Fastly Compute application that reports the visitor's IP address, reverse
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

Fastly supplies the client IP directly from the incoming connection. Reverse
DNS uses a PTR query against Cloudflare's DNS-over-HTTPS endpoint, with a
one-second timeout and a `null` hostname fallback.

## Run locally

Requires Node.js 24.12 or newer. The repository's `.nvmrc` selects the current
Node.js 24 LTS release when using nvm.

```sh
nvm use
npm install --global "$(node -p 'require("./package.json").packageManager')"
npm ci
npm test
npm run dev
```

Fastly's local server listens at `http://127.0.0.1:7676` by default. The local
client IP is `127.0.0.1`, so reverse DNS normally returns `null` locally.

## Deploy

Authenticate the Fastly CLI without putting a token in the repository:

```sh
npx fastly auth login
npm run deploy
```

Pushes to `main` also run the tests and deploy automatically through GitHub
Actions. Create a dedicated Fastly automation token with `global` scope,
restrict its access to this service, and give it an appropriate expiration
date. Add it to the GitHub repository as an Actions secret named
`FASTLY_API_TOKEN`:

```sh
gh secret set FASTLY_API_TOKEN
```

The workflow can also be started manually from the repository's Actions page.

On the first deployment, accept the generated `edgecompute.app` domain and the
preconfigured `cloudflare_dns` backend. The backend must use:

- Address and override host: `cloudflare-dns.com`
- Port: `443`
- TLS: enabled
- Certificate and SNI hostname: `cloudflare-dns.com`

Test the generated domain before changing public DNS.

## Add the production domains

Add both `ip.ike.to` and `ipv4.ike.to` to the Fastly service and provision
Fastly-managed TLS for them. Complete any certificate-validation DNS records
before cutting over traffic.

In Cloudflare DNS, use the addresses displayed by the domains' Fastly TLS
configuration:

- `ip.ike.to`: the assigned Fastly **CNAME**, providing IPv4 and IPv6
- `ipv4.ike.to`: the assigned Fastly **A records only**; no AAAA record
- Proxy status for both: **DNS only**

An IPv4 request renders its address directly. An IPv6 request renders the IPv6
address as secondary information and loads JavaScript that retrieves the
visitor's IPv4 address from `ipv4.ike.to`, placing it in the larger first line.
