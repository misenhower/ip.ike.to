/// <reference types="@fastly/js-compute" />

import { includeBytes } from "fastly:experimental";

import { createApp } from "./app.js";
import { createDohResolver } from "./reverse-dns.js";

const stylesheet = includeBytes("./public/stylesheets/style.css");
const reverseDns = createDohResolver({
  fetchDns(request) {
    return fetch(request, { backend: "cloudflare_dns" });
  },
});
const app = createApp({ reverseDns, stylesheet });

addEventListener("fetch", (event) => {
  event.respondWith(app(event.request, event.client.address));
});
