var express = require('express');
var router = express.Router();
var { getRequestInfo } = require('../utility/requestInfo');

/* GET home page. */
router.get('/', async function(req, res, next) {
  let { ip, kind, host, userAgent } = await getRequestInfo(req);

  res.render('index', {
    title: ip,
    ip,
    kind,
    ipv4: kind === 'ipv4',
    host,
    userAgent,
  });
});

router.get('/txt', function(req, res, next) {
  res.send(req.ip);
});

module.exports = router;
