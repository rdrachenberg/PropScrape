var express = require("express");
var router = express.Router();
var app = express();


router.get("/", function(req, res) {
  // Scrape data
  res.redirect("/scrape");
});

module.exports = router;
