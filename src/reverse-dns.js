const DOH_ENDPOINT = "https://cloudflare-dns.com/dns-query";
const PTR_RECORD_TYPE = 12;

export function createDohResolver({ fetchDns, timeoutMs = 1000 }) {
  return async function reverseDns(ip) {
    const name = ipToPtrName(ip);

    if (!name) {
      return null;
    }

    const url = new URL(DOH_ENDPOINT);
    url.searchParams.set("name", name);
    url.searchParams.set("type", "PTR");

    let timeout;

    try {
      const lookup = (async () => {
        const response = await fetchDns(
          new Request(url, {
            headers: {
              accept: "application/dns-json",
            },
          }),
        );

        if (!response.ok) {
          return null;
        }

        const result = await response.json();

        if (result.Status !== 0 || !Array.isArray(result.Answer)) {
          return null;
        }

        const answer = result.Answer.find((record) => {
          return record.type === PTR_RECORD_TYPE && typeof record.data === "string";
        });

        return answer?.data.replace(/\.$/, "") || null;
      })();

      return await Promise.race([
        lookup,
        new Promise((resolve) => {
          timeout = setTimeout(() => resolve(null), timeoutMs);
        }),
      ]);
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  };
}

export function ipToPtrName(ip) {
  if (ip.includes(":")) {
    return ipv6ToPtrName(ip);
  }

  if (ip.includes(".")) {
    return ipv4ToPtrName(ip);
  }

  return null;
}

function ipv4ToPtrName(ip) {
  const octets = parseIpv4Octets(ip);

  if (!octets) {
    return null;
  }

  return `${octets.reverse().join(".")}.in-addr.arpa`;
}

function ipv6ToPtrName(ip) {
  if ((ip.match(/::/g) ?? []).length > 1) {
    return null;
  }

  const normalized = normalizeEmbeddedIpv4(ip);

  if (!normalized) {
    return null;
  }

  const [leftText, rightText = ""] = normalized.split("::");
  const left = leftText ? leftText.split(":") : [];
  const right = rightText ? rightText.split(":") : [];

  if (
    [...left, ...right].some((hextet) => !/^[0-9a-f]{1,4}$/i.test(hextet))
  ) {
    return null;
  }

  const omittedCount = 8 - left.length - right.length;
  const hasCompression = normalized.includes("::");

  if (
    (!hasCompression && omittedCount !== 0) ||
    (hasCompression && omittedCount < 1)
  ) {
    return null;
  }

  const hextets = [
    ...left,
    ...Array.from({ length: omittedCount }, () => "0"),
    ...right,
  ];
  const nibbles = hextets
    .map((hextet) => hextet.padStart(4, "0"))
    .join("")
    .split("")
    .reverse();

  return `${nibbles.join(".")}.ip6.arpa`;
}

function normalizeEmbeddedIpv4(ip) {
  const lastColon = ip.lastIndexOf(":");
  const finalPart = ip.slice(lastColon + 1);

  if (!finalPart.includes(".")) {
    return ip;
  }

  const octets = parseIpv4Octets(finalPart);

  if (!octets) {
    return null;
  }

  const first = (Number(octets[0]) << 8) | Number(octets[1]);
  const second = (Number(octets[2]) << 8) | Number(octets[3]);

  return `${ip.slice(0, lastColon + 1)}${first.toString(16)}:${second.toString(16)}`;
}

function parseIpv4Octets(ip) {
  const octets = ip.split(".");

  if (
    octets.length !== 4 ||
    octets.some((octet) => {
      return !/^\d{1,3}$/.test(octet) || Number(octet) > 255;
    })
  ) {
    return null;
  }

  return octets;
}
