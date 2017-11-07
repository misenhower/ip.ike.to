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
  let headers = JSON.parse(JSON.stringify(req.headers));
  for (let key in headers) {
    // Remove all X-* headers
    if (key.startsWith('x-'))
      delete headers[key];
  }

  return { ip, kind, host, userAgent, headers };
}

module.exports.getRequestInfo = getRequestInfo;
