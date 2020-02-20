var peg = require("pegjs");
var gen = require("escodegen");
var fs = require("fs");
var vm = require("vm");


var helpers = fs.readFileSync("helpers.js").toString();
var lang = fs.readFileSync("lua.pegjs").toString();
var parser = peg.generate(helpers + lang);
var exec = require('child_process').exec;

function leval(src) {
    var AST;
    try { 
        AST = parser.parse(src, {forceVar: true, decorateLuaObjects: true, luaCalls: true, luaOperators: true, encloseWithFunctions: false });
    } catch ( e ) {
        return JSON.stringify(e);
    }

    return function(code) { 
        //console.log(code); 
        return function() { return "(function() " + code + ")()"; } 
    }(gen.generate(AST));
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
    ],
    [
        [
        'eval("var array = [1,1,2,5,7];")',
        'return array[4]'
        ],5
    ],
    [
        [
        'eval("var array = [1,1,2,5,7];")',
        'out = "pairs"',
        'for k,v in pairs(array) do out = out .. " " .. k .. "," .. v end',
        'return out'
        ],'pairs 1,1 2,1 3,2 4,5 5,7'
    ],
    [
        [
        'eval("var array = [1,1,2,5,7];")',
        'out = "ipairs"',
        'for k,v in ipairs(array) do out = out .. " " .. k .. "," .. v end',
        'return out'
        ],'ipairs 1,1 2,1 3,2 4,5 5,7'
    ],
    [
	['while false do end'],
	void 0
    ]

];

function makenv() {
    var goodies = require("./public/stdlib.js");
    return (function(stdout) {
        var env = {};
        for ( var i in goodies ) env[i] = goodies[i];

        env.getStdOut = function() { return stdout; }
        env.io = {
            write: function() {
                Array.prototype.forEach.call(arguments, function(s,i) {
                    stdout = stdout + s; 
                });
            }
        };

        env.print = function() {
            var s = Array.prototype.slice.call(arguments)
                .map(function(x) { return env.tostring(x); })
                .join("\t"); 

            env.io.write(s + "\n");
            //console.log(s); 
        };

        env.__lua.mark(env);

        return env;
    })("");

}

describe("Simple Tests", function() {
    var idx = 0;
    tests.forEach(function(nfo) {
        var code = nfo[0];
        var result = nfo[1]
        it("testSimple" + idx++, function(done) {
            if ( typeof(code) != "string" ) code = code.join("\n");

            var v = leval(code);
            expect(typeof(v)).toEqual("function");
            var env = makenv();
            var a = vm.runInNewContext(v(), makenv(), "vm");
            expect(a).toEqual(result);
            done();
        });

    });
});

function testDirectory(dir) {
    return function() {
        fs.readdirSync(dir).forEach(function(f) {
            it(dir + '/' + f, function(done) {
                var code = fs.readFileSync(dir + '/' + f).toString();
                //console.log("Start " + f);
                var v = leval(code);
                if ( typeof(v) != "function" ) throw v;

                (function(env) {
                    var a = vm.runInNewContext(v(), env, "vm");     
                    exec('lua ' + dir + '/' + f, function(err, stdout, stderr) {
                        if ( stderr !== "" ) expect(false).toBe(true);
                        expect(env.getStdOut()).toEqual(stdout.replace(/\r\n/g,"\n"));
                        done();
                    });

                })(makenv());
                //console.log("End " + f);
            });
        });
    };
}

describe("Lua Tests", testDirectory('./lua-tests'));

describe("Lua More Tests", testDirectory('./lua-testmore'));

describe("Lua Lang ToolKit", testDirectory('./lua-lltk'));


