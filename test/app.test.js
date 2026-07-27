import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import { createApp } from "../src/app.js";

const clientIp = "203.0.113.7";
const stylesheet = await readFile(
  new URL("../public/stylesheets/style.css", import.meta.url),
  "utf8",
);

function request(path = "/", options = {}) {
  const headers = new Headers(options.headers);
  headers.set("user-agent", options.userAgent ?? "Test Browser");

  return new Request(`https://ip.ike.to${path}`, {
    method: options.method ?? "GET",
    headers,
  });
}

function appWithHostname(hostname = "example.test") {
  return createApp({
    reverseDns: async () => hostname,
    stylesheet: new TextEncoder().encode("body { color: #333; }"),
  });
}

describe("IP address routes", () => {
  it("returns the client IP as plain text", async () => {
    const response = await appWithHostname()(request("/txt"), clientIp);

    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /^text\/plain/);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.equal(await response.text(), clientIp);
  });

  it("returns the client IP as CORS-enabled JSON", async () => {
    const response = await appWithHostname()(request("/api/ip"), clientIp);

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("access-control-allow-origin"), "*");
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.deepEqual(await response.json(), { ip: clientIp });
  });

  it("returns request information as CORS-enabled JSON", async () => {
    const response = await appWithHostname("ptr.example.test")(
      request("/api"),
      clientIp,
    );

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("access-control-allow-origin"), "*");
    assert.deepEqual(await response.json(), {
      ip: clientIp,
      host: "ptr.example.test",
      userAgent: "Test Browser",
    });
  });

  it("accepts the trailing slashes supported by the original Express routes", async () => {
    const app = appWithHostname();

    assert.equal((await app(request("/txt/"), clientIp)).status, 200);
    assert.equal((await app(request("/api/"), clientIp)).status, 200);
    assert.equal((await app(request("/api/ip/"), clientIp)).status, 200);
  });
});

describe("HTML route", () => {
  it("renders request information and hides proxy headers", async () => {
    const response = await appWithHostname("<ptr.example>")(
      request("/", {
        userAgent: '<script src="bad.js"></script>',
        headers: {
          accept: "text/html",
          "fastly-client-ip": "spoofed-edge-header",
          "x-custom": "<custom>",
          "x-forwarded-for": "198.51.100.9",
        },
      }),
      clientIp,
    );
    const body = await response.text();

    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /^text\/html/);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.match(
      body,
      /<meta name="viewport" content="width=device-width, initial-scale=1">/,
    );
    assert.match(
      body,
      /<link rel="stylesheet" href="\/stylesheets\/style\.css\?v=8">/,
    );
    assert.match(
      body,
      /<h1 class="ip" id="ipv4" title="IPv4 Address"><button class="copy-value copy-value--centered"/,
    );
    assert.match(body, /aria-label="Copy IPv4 address"/);
    assert.match(body, /<span class="copy-text">203\.0\.113\.7<\/span>/);
    assert.match(body, /aria-label="Copy hostname"/);
    assert.match(body, /aria-label="Copy user agent"/);
    assert.match(body, /aria-label="Copy x-custom header"/);
    assert.match(body, /class="copy-value copy-value--cell"/);
    assert.match(body, /event\.target\.closest\("\.headers \.value"\)/);
    assert.match(body, /navigator\.clipboard\.writeText\(text\)/);
    assert.match(body, /document\.execCommand\("copy"\)/);
    assert.match(body, /<p class="copy-status" aria-live="polite"><\/p>/);
    assert.match(body, /&lt;ptr\.example&gt;/);
    assert.match(body, /&lt;script src=&quot;bad\.js&quot;&gt;/);
    assert.match(body, /x-custom/);
    assert.match(body, /&lt;custom&gt;/);
    assert.doesNotMatch(body, /spoofed-edge-header/);
    assert.doesNotMatch(body, /198\.51\.100\.9/);
    assert.doesNotMatch(body, /window\.fetch/);
  });

  it("still renders when reverse DNS has no result", async () => {
    const app = createApp({
      reverseDns: async () => null,
      stylesheet: new Uint8Array(),
    });

    const response = await app(request("/"), clientIp);

    assert.equal(response.status, 200);
    assert.match(await response.text(), /203\.0\.113\.7/);
  });

  it("loads IPv4 above the IPv6 address only for IPv6 visitors", async () => {
    const response = await appWithHostname()(
      request("/"),
      "2001:db8::7",
    );
    const body = await response.text();
    const ipv4Position = body.indexOf('id="ipv4"');
    const ipv6Position = body.indexOf('id="ipv6"');

    assert.match(
      body,
      /<h1 class="ip" id="ipv4" title="IPv4 Address" hidden>/,
    );
    assert.match(body, /aria-label="Copy IPv4 address"/);
    assert.match(
      body,
      /<h1 class="ip" id="ipv6" title="IPv6 Address"><button class="copy-value copy-value--centered"/,
    );
    assert.match(body, /aria-label="Copy IPv6 address"/);
    assert.match(body, /<span class="copy-text">2001:db8::7<\/span>/);
    assert.match(body, /https:\/\/ipv4\.ike\.to\/api\/ip/);
    assert.match(body, /ipv4Element\.hidden = false/);
    assert.match(
      body,
      /document\.getElementById\("ipv6"\)\.querySelector\("\.copy-text"\)\.textContent/,
    );
    assert.ok(ipv4Position >= 0);
    assert.ok(ipv4Position < ipv6Position);
  });

  it("does not load the IPv4 lookup without an IPv6 client address", async () => {
    const response = await appWithHostname()(request("/"));

    assert.doesNotMatch(await response.text(), /window\.fetch/);
  });
});

describe("static assets", () => {
  it("keeps long values within narrow viewports", () => {
    assert.match(stylesheet, /font-size:\s*clamp\(/);
    assert.match(stylesheet, /overflow-wrap:\s*anywhere/);
    assert.match(stylesheet, /table-layout:\s*fixed/);
  });

  it("reveals copy controls without shifting centered values", () => {
    assert.match(
      stylesheet,
      /\.copy-value--centered \.copy-icon\s*{[^}]*position:\s*absolute/s,
    );
    assert.match(
      stylesheet,
      /\.copy-value--cell\s*{[^}]*display:\s*block[^}]*width:\s*100%/s,
    );
    assert.match(
      stylesheet,
      /\.copy-value--cell \.copy-icon\s*{[^}]*position:\s*absolute[^}]*top:\s*0\.5em[^}]*right:\s*0\.5em/s,
    );
    assert.match(stylesheet, /\.copy-value:hover \.copy-icon/);
  });

  it("follows the system dark-mode preference", () => {
    assert.match(
      stylesheet,
      /@media \(prefers-color-scheme: dark\)/,
    );
    assert.match(stylesheet, /color-scheme:\s*light dark/);
  });

  it("serves the bundled stylesheet", async () => {
    const response = await appWithHostname()(
      request("/stylesheets/style.css"),
      clientIp,
    );

    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /^text\/css/);
    assert.equal(await response.text(), "body { color: #333; }");
  });
});

describe("unmatched requests", () => {
  it("returns 404 for unknown paths and unsupported methods", async () => {
    const app = appWithHostname();

    assert.equal((await app(request("/missing"), clientIp)).status, 404);
    assert.equal(
      (await app(request("/api", { method: "POST" }), clientIp)).status,
      404,
    );
  });
});
