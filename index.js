var peg = require("pegjs");
var gen = require("escodegen");
var fs = require("fs");
var vm = require("vm");

var helpers = fs.readFileSync("helpers.js").toString();
var lang = fs.readFileSync("lua.pegjs").toString();
var parser = peg.buildParser(helpers + lang);


var AST;
try { 
    AST = parser.parse(fs.readFileSync(process.argv[2]).toString(), {forceVar: true, decorateLuaObjects: true, luaCalls: true, luaOperators: true });
} catch ( e ) {
    console.dir(e);
    return;
}

var src = "(function() " + gen.generate(AST) + "())";

console.log(src);

vm.runInNewContext(src, require('./public/stdlib.js'), "vm");
