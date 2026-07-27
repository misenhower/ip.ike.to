import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createApp } from "../src/app.js";

const clientIp = "203.0.113.7";

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
    assert.match(body, /203\.0\.113\.7/);
    assert.match(body, /&lt;ptr\.example&gt;/);
    assert.match(body, /&lt;script src=&quot;bad\.js&quot;&gt;/);
    assert.match(body, /x-custom/);
    assert.match(body, /&lt;custom&gt;/);
    assert.doesNotMatch(body, /spoofed-edge-header/);
    assert.doesNotMatch(body, /198\.51\.100\.9/);
    assert.match(body, /https:\/\/ipv6\.ike\.to\/api\/ip/);
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

  it("does not request a second address for IPv6 visitors", async () => {
    const response = await appWithHostname()(
      request("/"),
      "2001:db8::7",
    );

    assert.doesNotMatch(
      await response.text(),
      /https:\/\/ipv6\.ike\.to\/api\/ip/,
    );
  });
});

describe("static assets", () => {
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
