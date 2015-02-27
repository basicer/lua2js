var express = require('express');
var app = express();

var peg = require("pegjs");
var gen = require("escodegen");
var fs = require("fs");

var helpers = fs.readFileSync("helpers.js").toString();
var lang = fs.readFileSync("lua.pegjs").toString();
var parser = peg.buildParser(helpers + lang, {output: 'source'});

app.get('/piler.js', function(req,res) {
	res.setHeader('content-type', 'text/javascript');
	res.write("window.parser = ");
	res.write(parser);
	res.end();
});

app.use(express.static(__dirname + '/public'));

app.listen(4000);
