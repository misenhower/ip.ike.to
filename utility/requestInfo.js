const dns = require('dns');
const ipaddr = require('ipaddr.js');

function reverseDns(ip) {
  return new Promise((resolve, reject) => {
    dns.reverse(ip, (err, records) => {
      if (err)
        return reject(err);
      return resolve(records);
    });
  });
}

async function getRequestInfo(req) {
  // Get the IP
  let ip = req.ip;

  // Determine IP kind (IPv4/IPv6)
  let kind = null;
  try {
    let addr = ipaddr.parse(ip);
    kind = addr.kind();
  } catch (e) { }

  // Get the host
  let host = null;

  try {
    let hosts = await reverseDns(ip);
    host = hosts[0];
  } catch (e) { }

  // Get the user agent
  let userAgent = req.headers['user-agent'];

  // Get the other headers
  let headers = [];
  for (let key in req.headers) {
    let value = req.headers[key];

    switch (key) {
      case 'connection':
      case 'x-real-ip':
      case 'x-forwarded-for':
      case 'x-forwarded-proto':
      case 'x-forwarded-ssl':
      case 'x-forwarded-port':
        continue;
      case 'x-forwarded-connection':
        // key = 'connection';
        // break;
        // TODO: Work out issues with connection header
        continue;
    }

    headers.push({ key, value });
  }

  // Sort the headers
  headers.sort((a, b) => a.key.localeCompare(b.key));

  return { ip, kind, host, userAgent, headers };
}

module.exports.getRequestInfo = getRequestInfo;
