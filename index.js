var peg = require("pegjs");
var gen = require("escodegen");
var fs = require("fs");
var vm = require("vm");

var lang = fs.readFileSync("lua.pegjs").toString();


var parser = peg.buildParser(lang);


var AST;
try { 
    AST = parser.parse(fs.readFileSync(process.argv[2]).toString(), {forceVar: true});
} catch ( e ) {
    console.dir(e);
    return;
}

var src = "(function() " + gen.generate(AST) + "())";
vm.runInNewContext(src, require('./public/stdlib.js'), "vm");
