const PRIVATE_RESPONSE_HEADERS = {
  "cache-control": "private, no-store",
};

const JSON_RESPONSE_HEADERS = {
  ...PRIVATE_RESPONSE_HEADERS,
  "access-control-allow-origin": "*",
  "content-type": "application/json; charset=utf-8",
};

const HIDDEN_HEADERS = new Set([
  "connection",
  "x-real-ip",
]);

export function createApp({ reverseDns, stylesheet }) {
  return async function app(request, clientIp = "unknown") {
    const response = await handleRequest({
      request,
      clientIp,
      reverseDns,
      stylesheet,
    });

    if (request.method === "HEAD") {
      return new Response(null, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    }

    return response;
  };
}

async function handleRequest({ request, clientIp, reverseDns, stylesheet }) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return notFound();
  }

  const pathname = normalizedPathname(new URL(request.url).pathname);

  if (pathname === "/stylesheets/style.css") {
    return new Response(stylesheet, {
      headers: {
        "cache-control": "public, max-age=3600",
        "content-type": "text/css; charset=utf-8",
      },
    });
  }

  if (pathname === "/txt") {
    return new Response(clientIp, {
      headers: {
        ...PRIVATE_RESPONSE_HEADERS,
        "content-type": "text/plain; charset=utf-8",
      },
    });
  }

  if (pathname === "/api/ip") {
    return json({ ip: clientIp });
  }

  if (pathname === "/api") {
    return json({
      ip: clientIp,
      host: await reverseDns(clientIp),
      userAgent: request.headers.get("user-agent"),
    });
  }

  if (pathname === "/") {
    const page = renderPage({
      ip: clientIp,
      host: await reverseDns(clientIp),
      userAgent: request.headers.get("user-agent"),
      headers: visibleHeaders(request.headers),
    });

    return new Response(page, {
      headers: {
        ...PRIVATE_RESPONSE_HEADERS,
        "content-type": "text/html; charset=utf-8",
      },
    });
  }

  return notFound();
}

function visibleHeaders(headers) {
  return [...headers]
    .filter(([key]) => {
      return (
        !key.startsWith("fastly-") &&
        !key.startsWith("x-forwarded-") &&
        !HIDDEN_HEADERS.has(key)
      );
    })
    .map(([key, value]) => ({ key, value }))
    .sort((left, right) => left.key.localeCompare(right.key));
}

function renderPage({ ip, host, userAgent, headers }) {
  const headerRows = headers
    .map(
      ({ key, value }) => `
        <tr>
          <td class="key">${escapeHtml(key)}</td>
          <td class="value mono">${escapeHtml(value)}</td>
        </tr>`,
    )
    .join("");

  const ipv6Lookup = isIpv4(ip)
    ? `
      <h1 class="ip" id="ipv6" title="IPv6 Address"></h1>
      <script>
        window.fetch("https://ipv6.ike.to/api/ip")
          .then(function (response) { return response.json(); })
          .then(function (info) {
            document.getElementById("ipv6").textContent = info.ip;
          })
          .catch(function (error) { console.error(error); });
      </script>`
    : "";

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(ip)}</title>
    <link rel="stylesheet" href="/stylesheets/style.css">
  </head>
  <body>
    <h1 class="ip" title="IP Address">${escapeHtml(ip)}</h1>
    ${ipv6Lookup}
    ${host ? `<h2 class="host" title="Hostname">${escapeHtml(host)}</h2>` : ""}
    ${
      userAgent
        ? `<h3 class="user-agent" title="User Agent">${escapeHtml(userAgent)}</h3>`
        : ""
    }
    <table class="headers" width="100%">
      ${headerRows}
    </table>
  </body>
</html>`;
}

function isIpv4(ip) {
  return ip.includes(".") && !ip.includes(":");
}

function normalizedPathname(pathname) {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }

  return pathname;
}

function escapeHtml(value) {
  const entities = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };

  return String(value ?? "").replace(/[&<>"']/g, (character) => {
    return entities[character];
  });
}

function json(value) {
  return new Response(JSON.stringify(value), {
    headers: JSON_RESPONSE_HEADERS,
  });
}

function notFound() {
  return new Response("Not Found", {
    status: 404,
    headers: {
      ...PRIVATE_RESPONSE_HEADERS,
      "content-type": "text/plain; charset=utf-8",
    },
  });
}
