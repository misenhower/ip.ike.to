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
          <td class="value mono">${copyButton({
            value,
            label: `${key} header`,
            layout: "cell",
          })}</td>
        </tr>`,
    )
    .join("");

  let addressSummary = `<h1 class="ip" title="IP Address">${copyButton({
    value: ip,
    label: "IP address",
  })}</h1>`;

  if (isIpv4(ip)) {
    addressSummary = `<h1 class="ip" id="ipv4" title="IPv4 Address">${copyButton({
      value: ip,
      label: "IPv4 address",
    })}</h1>`;
  } else if (isIpv6(ip)) {
    addressSummary = `<h1 class="ip" id="ipv4" title="IPv4 Address" hidden>${copyButton(
      {
        value: "",
        label: "IPv4 address",
      },
    )}</h1>
      <h1 class="ip" id="ipv6" title="IPv6 Address">${copyButton({
        value: ip,
        label: "IPv6 address",
      })}</h1>
      <script>
        window.fetch("https://ipv4.ike.to/api/ip")
          .then(function (response) { return response.json(); })
          .then(function (info) {
            var ipv4Element = document.getElementById("ipv4");
            ipv4Element.querySelector(".copy-text").textContent = info.ip;
            ipv4Element.hidden = false;
            document.title =
              info.ip +
              " / " +
              document.getElementById("ipv6").querySelector(".copy-text").textContent;
          })
          .catch(function (error) { console.error(error); });
      </script>`;
  }

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(ip)}</title>
    <link rel="stylesheet" href="/stylesheets/style.css?v=8">
  </head>
  <body>
    ${addressSummary}
    ${
      host
        ? `<h2 class="host" title="Hostname">${copyButton({
            value: host,
            label: "hostname",
          })}</h2>`
        : ""
    }
    ${
      userAgent
        ? `<h3 class="user-agent" title="User Agent">${copyButton({
            value: userAgent,
            label: "user agent",
          })}</h3>`
        : ""
    }
    <table class="headers" width="100%">
      ${headerRows}
    </table>
    <p class="copy-status" aria-live="polite"></p>
    <script>
      (function () {
        function legacyCopy(text) {
          var input = document.createElement("textarea");
          input.value = text;
          input.setAttribute("readonly", "");
          input.style.position = "fixed";
          input.style.opacity = "0";
          document.body.appendChild(input);
          input.select();

          var copied = document.execCommand("copy");
          input.remove();

          return copied
            ? Promise.resolve()
            : Promise.reject(new Error("Copy command failed"));
        }

        function copyText(text) {
          if (navigator.clipboard && window.isSecureContext) {
            return navigator.clipboard.writeText(text).catch(function () {
              return legacyCopy(text);
            });
          }

          return legacyCopy(text);
        }

        document.addEventListener("click", function (event) {
          var button = event.target.closest(".copy-value");

          if (!button) {
            var valueCell = event.target.closest(".headers .value");

            if (!valueCell) {
              return;
            }

            button = valueCell.querySelector(".copy-value");
          }

          var label = button.getAttribute("data-copy-label");
          var text = button.querySelector(".copy-text").textContent;

          copyText(text)
            .then(function () {
              window.clearTimeout(button.copyResetTimeout);
              button.classList.add("is-copied");
              button.setAttribute("aria-label", "Copied " + label);
              document.querySelector(".copy-status").textContent =
                "Copied " + label;
              button.copyResetTimeout = window.setTimeout(function () {
                button.classList.remove("is-copied");
                button.setAttribute("aria-label", "Copy " + label);
              }, 1200);
            })
            .catch(function (error) { console.error(error); });
        });
      })();
    </script>
  </body>
</html>`;
}

function copyButton({ value, label, layout = "centered" }) {
  return `<button class="copy-value copy-value--${layout}" type="button" aria-label="Copy ${escapeHtml(label)}" data-copy-label="${escapeHtml(label)}">
    <span class="copy-text">${escapeHtml(value)}</span>
    <span class="copy-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
        <rect x="8" y="8" width="11" height="11" rx="2"></rect>
        <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"></path>
      </svg>
    </span>
  </button>`;
}

function isIpv4(ip) {
  return ip.includes(".") && !ip.includes(":");
}

function isIpv6(ip) {
  return ip.includes(":");
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
