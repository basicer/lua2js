var peg = require("pegjs");
var gen = require("escodegen");
var fs = require("fs");

var lang = fs.readFileSync("lua.pegjs").toString();


var parser = peg.buildParser(lang);


var AST;
try { 
    AST = parser.parse(fs.readFileSync("test.lua").toString());
} catch ( e ) {
    console.dir(e);
    return;
}

console.log(JSON.stringify(AST, null, 2));
var src = "(function() " + gen.generate(AST) + "())";
console.log(src);
x = eval(src);
console.log(x);