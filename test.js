var peg = require("pegjs");
var gen = require("escodegen");
var fs = require("fs");
var vm = require("vm");


var helpers = fs.readFileSync("helpers.js").toString();
var lang = fs.readFileSync("lua.pegjs").toString();
var parser = peg.buildParser(helpers + lang);
var exec = require('child_process').exec;

function leval(src) {
    var AST;
    try { 
        AST = parser.parse(src, {forceVar: !('function' === typeof Map), decorateLuaObjects: true, luaCalls: true, luaOperators: true, encloseWithFunctions: false });
    } catch ( e ) {
        console.log(e);
        return e.toString();
    }

    return function(code) { return function() { return "(function() " + code + ")()"; } }(gen.generate(AST));
}

tests = [
    ["  return 10"  ,    10],
    ["return 10"     ,   10],
    ["return 20     ",   20],
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
    ],
    [
        [
        'eval("var a = [1,2,3]")',
        'return a[1]'
        ],1
    ],
    [
        [
        'eval("var a = [1,2,3]")',
        'a[2] = 7',
        'return eval("a.toString()")'
        ],"1,7,3"
    ],
    [
        [
        'eval("var ct = function(w) { return \'!\' + w + \'!\' + (typeof w); }")',
        'function add(a,b) return 7 + a + b, b - a end',
        'local sum = add(2,3)',
        'return ct(sum)',
        ],"!12!number"
    ],
    [
        [
            'function add(a,b) return a*a+b*b,0 end',
            'local o = add(3,4)',
            'return ("a" .. o .. add(5,12))'
        ], 'a25169'
    ],
    [
        [
        'eval("var json = function(w) { return JSON.stringify(w); }")',
        'function g() return {x=1, y=20} end',
        'o = g()',
        'return json(o) .. " " .. eval("(function(x) { return x.__luaType; })(o)")',
        ],'{"x":1,"y":20} table'
    ]


];

function makenv() {
    var goodies = require("./public/stdlib.js");
    return (function(stdout) {
        var env = {};
        for ( var i in goodies ) env[i] = goodies[i];
        env.print = function() {
            var s = Array.prototype.slice.call(arguments)
                .map(function(x) { return env.tostring(x); })
                .join("\t"); 
            stdout = stdout + s + "\n";
            console.log(s); 
        };

        env.getStdOut = function() { return stdout; }
        env.io = {
            write: function(w) { return env.print(w); }
        };

        env.string = {
            format: function(format, etc) {
                var arg = arguments;
                var i = 1;
                return format.replace(/%([0-9.]+)?([%sf])/g, function (m) { 
                    if ( m[2] == "%" ) return "%";
                    else if ( m[2] == "s") return arg[i++];
                    else if ( m[2] == "f" ) return arg[i++].toFixed(parseFloat(m[1]) || 6);
                    else return arg[i++]; 
                });
            }
        }
        env.__lua.mark(env);
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
            try {
		var a = vm.runInNewContext(v(), makenv(), "vm");
                test.equal(a, result);
	    } catch ( e ) {
                test.ok(false, e);
            }
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
                    test.equals(env.getStdOut(), stdout.replace(/\r\n/g,"\n") );
                    test.done();
                });
            })(makenv());
        } else {
            test.ok(false, "Coudnt parse:" + v);
            test.done();
        }
    };

});

fs.readdirSync("./lua-testmore").forEach(function(f) {
    exports["testMore" + f] = function(test) {
        var code = fs.readFileSync("./lua-testmore/" + f).toString();
        test.expect(2);
        var v = leval(code);
        test.ok(typeof(v) == "function", v);
        if ( typeof(v) == "function" ) {
            (function(env) {
                try {
			var a = vm.runInNewContext(v(), env, "vm");
		} catch ( e ) {
			test.ok(false, e);
		}
                exec('lua ./lua-testmore/' + f, function(err, stdout, stderr) {
                    if ( stderr !== "" ) test.ok(false, stderr);
                    console.log("exec" + err);
                    test.equals(env.getStdOut(), stdout.replace(/\r\n/g,"\n") );
                    test.done();
                });
            })(makenv());
        } else {
            test.ok(false, "Coudnt parse:" + v);
            test.done();
        }
    };

});
