var express = require('express');
var router = express.Router();
var cors = require('cors');
var { getRequestInfo } = require('../utility/requestInfo');

router.get('/', cors(), async function(req, res, next) {
  let { ip, host, userAgent } = await getRequestInfo(req);
  res.send({ ip, host, userAgent });
});

router.get('/ip', cors(), function(req, res, next) {
  res.send({ ip: req.ip });
});

module.exports = router;
