import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createDohResolver, ipToPtrName } from "../src/reverse-dns.js";

describe("PTR names", () => {
  it("converts an IPv4 address", () => {
    assert.equal(
      ipToPtrName("203.0.113.7"),
      "7.113.0.203.in-addr.arpa",
    );
  });

  it("converts a compressed IPv6 address", () => {
    assert.equal(
      ipToPtrName("2001:db8::7"),
      [
        "7", "0", "0", "0", "0", "0", "0", "0",
        "0", "0", "0", "0", "0", "0", "0", "0",
        "0", "0", "0", "0", "0", "0", "0", "0",
        "8", "b", "d", "0", "1", "0", "0", "2",
      ].join(".") + ".ip6.arpa",
    );
  });

  it("converts an IPv4-embedded IPv6 address", () => {
    assert.equal(
      ipToPtrName("::ffff:192.0.2.1"),
      [
        "1", "0", "2", "0", "0", "0", "0", "c",
        "f", "f", "f", "f", "0", "0", "0", "0",
        "0", "0", "0", "0", "0", "0", "0", "0",
        "0", "0", "0", "0", "0", "0", "0", "0",
      ].join(".") + ".ip6.arpa",
    );
  });

  it("rejects invalid addresses", () => {
    assert.equal(ipToPtrName("unknown"), null);
    assert.equal(ipToPtrName("999.0.0.1"), null);
    assert.equal(ipToPtrName("2001::db8::1"), null);
  });
});

describe("DNS-over-HTTPS resolver", () => {
  it("returns the first PTR answer without its DNS root dot", async () => {
    let request;
    const reverseDns = createDohResolver({
      fetchDns: async (incomingRequest) => {
        request = incomingRequest;
        return Response.json({
          Status: 0,
          Answer: [
            {
              name: "7.113.0.203.in-addr.arpa.",
              type: 12,
              TTL: 300,
              data: "ptr.example.test.",
            },
          ],
        });
      },
    });

    assert.equal(await reverseDns("203.0.113.7"), "ptr.example.test");
    assert.equal(request.headers.get("accept"), "application/dns-json");
    assert.equal(
      new URL(request.url).searchParams.get("name"),
      "7.113.0.203.in-addr.arpa",
    );
    assert.equal(new URL(request.url).searchParams.get("type"), "PTR");
  });

  it("returns null when the resolver fails or has no PTR answer", async () => {
    const failedLookup = createDohResolver({
      fetchDns: async () => new Response("", { status: 503 }),
    });
    const emptyLookup = createDohResolver({
      fetchDns: async () => Response.json({ Status: 0 }),
    });

    assert.equal(await failedLookup("203.0.113.7"), null);
    assert.equal(await emptyLookup("203.0.113.7"), null);
    assert.equal(await emptyLookup("unknown"), null);
  });

  it("stops waiting when the resolver times out", async () => {
    const reverseDns = createDohResolver({
      fetchDns: async () => new Promise(() => {}),
      timeoutMs: 5,
    });

    assert.equal(await reverseDns("203.0.113.7"), null);
  });
});
