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

Requires Node.js 22 or newer.

```sh
npm install
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

On the first deployment, accept the generated `edgecompute.app` domain and the
preconfigured `cloudflare_dns` backend. The backend must use:

- Address and override host: `cloudflare-dns.com`
- Port: `443`
- TLS: enabled
- Certificate and SNI hostname: `cloudflare-dns.com`

Test the generated domain before changing public DNS.

## Add the production domains

Add both `ip.ike.to` and `ipv6.ike.to` to the Fastly service and provision
Fastly-managed TLS for them. Complete any certificate-validation DNS records
before cutting over traffic.

In Cloudflare DNS, use the addresses displayed by the domains' Fastly TLS
configuration:

- `ip.ike.to`: Fastly **A records only**; no AAAA record
- `ipv6.ike.to`: Fastly **AAAA records only**; no A record
- Proxy status for both: **DNS only**

Do not use a dual-stack Fastly CNAME. The explicit record families are what
guarantee that the first hostname reports IPv4 and the second reports IPv6.
