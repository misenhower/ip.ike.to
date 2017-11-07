var express = require('express');
var router = express.Router();
var { getRequestInfo } = require('../utility/requestInfo');

/* GET home page. */
router.get('/', async function(req, res, next) {
  let { ip, host, userAgent } = await getRequestInfo(req);

  res.render('index', {
    title: ip,
    ip,
    host,
    userAgent,
  });
});

router.get('/txt', function(req, res, next) {
  res.send(req.ip);
});

module.exports = router;
