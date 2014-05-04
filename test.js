var peg = require("pegjs");
var gen = require("escodegen");
var fs = require("fs");

var lang = fs.readFileSync("lua.pegjs").toString();
var parser = peg.buildParser(lang);

function leval(src) {
	var AST;
	try { 
	    AST = parser.parse(src);
	} catch ( e ) {
	    return e.toString();
	}

	var code = gen.generate(AST);
	console.log(code);
	return new Function(code);
}

tests = [
	["  return 10"  ,	 10],
	["return 10"	 ,	 10],
	["return 20     ",	 20],
	[
		['if true then',
		 ' return "yum"',
		 'else ',
		 ' return "ouch"',
		 'end'], "yum"
	],
	['if 0 then return "yum" else return "ouch" end', "ouch" ],
	['add = function(a,b) return a+b end return add(2,5)', 7],
	['function add(a,b) return a+b end return add(2,5)', 7],
	[
		[
		'function fastfib(n)',
		'fibs = {1,1}',
	    'local i = 2',
		'while i < n do',
		'   i = i + 1',
		'   fibs[i] = fibs[i-1] + fibs[i-2]',
		'end',
		'return fibs[n]',
		'end',
		'return fastfib(10)'
		], 55
	]


];


var idx = 0;
tests.forEach(function(nfo) {
	var code = nfo[0];
	var result = nfo[1];
	exports["test" + idx++] = function(test) {
		test.expect(2);

		if ( typeof(code) != "string" ) code = code.join("\n");

		var v = leval(code);
		test.ok(typeof(v) == "function", v);
		if ( typeof(v) == "function" ) test.equal(v(), result);
		else test.ok(false, "Coudnt run");

		test.done();
	}

});
