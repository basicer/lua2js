var peg = require("pegjs");
var gen = require("escodegen");
var fs = require("fs");
var vm = require("vm");


var lang = fs.readFileSync("lua.pegjs").toString();
var parser = peg.buildParser(lang);
var exec = require('child_process').exec;

function leval(src) {
	var AST;
	try { 
	    AST = parser.parse(src);
	} catch ( e ) {
		console.log(e);
	    return e.toString();
	}

	return function(code) { return function() { return "(function() " + code + ")()"; } }(gen.generate(AST));
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
	],
	[
		[
		'local total = 0',
		'for i=1,20,3 do total = total + i end',
		'return total'
		], 70
	]


];

function makenv() {

	return (function(stdout) {
		var env = {};
		env.print = function() {
			var s = Array.prototype.slice.call(arguments).join("\t"); 
			stdout = stdout + s + "\n";
			console.log(s); 
		};

		env.getStdOut = function() { return stdout; }
		
		return env;
	})("");

}

var idx = 0;
tests.forEach(function(nfo) {
	var code = nfo[0];
	var result = nfo[1]
	exports["testSimple" + idx++] = function(test) {
		test.expect(2);

		if ( typeof(code) != "string" ) code = code.join("\n");

		var v = leval(code);
		test.ok(typeof(v) == "function", v);
		if ( typeof(v) == "function" ) {
			var env = makenv();
			var a = vm.runInNewContext(v(), makenv(), "vm");
			test.equal(a, result);
		}
		else test.ok(false, "Coudnt run");

		test.done();
	}

});


fs.readdirSync("./lua-tests").forEach(function(f) {
	exports["testLua" + f] = function(test) {
		var code = fs.readFileSync("./lua-tests/" + f).toString();
		test.expect(2);

		var v = leval(code);
		test.ok(typeof(v) == "function", v);
		if ( typeof(v) == "function" ) {
			(function(env) {
				var a = vm.runInNewContext(v(), env, "vm");		

				exec('lua ./lua-tests/' + f, function(err, stdout, stderr) {
					if ( stderr !== "" ) test.ok(false, stderr);
					test.equals(env.getStdOut(), stdout );
					test.done();
				});
			})(makenv());
		}
		else test.ok(false, "Coudnt parse.");
	};

});

