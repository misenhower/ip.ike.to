const dns = require('dns');

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

  // Get the host
  let host = null;

  try {
    let hosts = await reverseDns(ip);
    host = hosts[0];
  } catch (e) { }

  // Get the user agent
  let userAgent = req.headers['user-agent'];

  return { ip, host, userAgent };
}

module.exports.getRequestInfo = getRequestInfo;
