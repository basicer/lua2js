/* Helpers include here by build script */

start = &{ init(); return true; } ("#" [^\n]* "\n")? ws? t:BlockStatement ws? { return finalize(t); }
ws = ([ \r\t\n] / "--[" balstringinsde "]"  / ("--" ( [^\n]* "\n" / .* ) )) +
scws = (ws? ";" ws?)+ / ws 
BlockStatement =
    r:ReturnStatement
    {
        return builder.blockStatement([r]) 
    } /
    list:StatementList ret:(scws+ ReturnStatement)? 
    {
        list = expandMultiStatements(list);
        return builder.blockStatement(ret === null ? list : list.concat([ret[1]])); 
    } 
StatementList = 
    a:Statement? b:(scws+ Statement )* (ws? ";")*
    {  
        if ( a === null ) return [];
        if ( b === null ) return a;
        return listHelper(a,b,1);
    } 
ReservedWord = rw:("if" / "then" / "elseif" / "else" / "do" / "end" / "return" / "local" / "nil" / "true" / "false"
    / "function" / "not" / "break" / "for" / "until" / "while" / binop / unop) ![a-z] { return rw }
Name = !(ReservedWord) a:$([a-zA-Z_][a-zA-Z0-9_]*) { return a; }
Number = $([0-9]+("." [0-9]+)?)
stringchar =
    "\\" c:[abfrntv'"\\] { return {
        "n": "\n",
        "b": "\b",
        "f": "\f",
        "r": "\r",
        "t": "\t",
        "v": "\v",
        '"': '"',
        "'": "'",
        "\\": "\\"
    }[c] } / 
    "\\\n" { return "\n" } /
    "\\\z" ws { return "" } /
    "\\x" a:$[0-9a-f] b:$[0-9a-f] { return String.fromCharCode(parseInt('0x' + a + b)); } /
    "\\" a:$[0-9] b:$[0-9]? c:$[0-9]? { return String.fromCharCode(parseInt('' + a + b + c)); } /
    "\\" { error('Invalid Escape Sequence') } / 
    $[^'"'] 
singlequote = [\'] { return wrapNode({}); }
doublequote = [\"] { return wrapNode({}); }
String =
    s:doublequote r:(stringchar/"'") * e:(doublequote) &{ return eUntermIfEmpty(e,"string","\"",s); } { return r.join(''); } /
    s:singlequote r:(stringchar/'"') * e:(singlequote) &{ return eUntermIfEmpty(e,"string","'",s); } { return r.join(''); } / 
    "[" s: balstringinsde "]" { return s; }
balstringinsde =
    "=" a:balstringinsde "=" { return a; } /
    "[" [\n]? a:$(!("]" "="* "]") .)* "]" { return a;}
Statement = 
    s: ( 
    Debugger / BreakStatement /
    NumericFor /
    ForEach /
    RepeatUntil /
    WhileStatement /
    IfStatement /
    ExpressionStatement / 
    DoEndGrouped /
    LocalAssingment /
    FunctionDeclaration /
    LocalFunction /
    !(ws? ReservedWord) e:$Expression &{ return eMsg("Found an expression but expected a statement: " + e)} { return builder.emptyStatement(); } /
    !(ws? ReservedWord) e:$Identifier &{ return eMsg("`=` expected")} { return builder.emptyStatement(); } /
    !(ws? ReservedWord) e:$[^\n\t\r ] [^\n]* ([\n]/!.) &{ return eMsg("Parser error near `" + e + "`"); } { return builder.emptyStatement(); }
    ) 
Debugger = 
    "debugger"
    { return {type: "ExpressionStatement", expression: {type: "Identifier", name:"debugger; "} } }
DoEndGrouped = 
    start:do ws b:(BlockStatement ws)? end:("end") & { return eUntermIfEmpty(end, "do", "end", start); }
    { return b ? b[0] : {type: "BlockStatement", body: []}; }

if = "if" { return wrapNode({}); }
do = "do" { return wrapNode({}); }
for = "for" { return wrapNode({}); }
function = "function" { return wrapNode({}); }
NumericFor =
    start:for ws a:Identifier ws? "=" ws? b:Expression ws? "," ws? c:Expression d:( ws? "," ws? Expression )? ws? "do" ws? body:(BlockStatement ws)? end:("end") &{ return eUntermIfEmpty(end, "for", "end", start); } 
    {
        var amount = d == null ? {type: "Literal", value: 1 } : d[3];
        var start = bhelper.tempVar(b);
        var updateBy = bhelper.tempVar(amount);
        var testValue = bhelper.tempVar(c);
        var idx = bhelper.tempVar();
        var update = builder.assignmentExpression("=", idx.id, bhelper.binaryExpression("+", idx.id, updateBy.id));
        var texp;
        if ( false ) {
            texp = bhelper.binaryExpression("<=", idx.id, testValue.id)
        } else {
            texp = bhelper.luaOperator("forcomp", updateBy.id, idx.id, testValue.id);
        }

        if ( !body ) body = {type: "BlockStatement", body: []};
        else body = body[0];

        body.body.unshift(builder.variableDeclaration("let",[
            {
                    type: "VariableDeclarator",
                    id: a,
                    init: idx.id
            }
        ]));
        var out = {
            type: "ForStatement",
            init: builder.variableDeclaration("let", [
                {
                    type: "VariableDeclarator",
                    id: idx.id,
                    init: start.id,
                }
            ]),
            body: body,
            update: update,
            test: texp,
            loc: location()
        };
        return bhelper.encloseDecls([out], start, updateBy, testValue);
    }
ForEach =
    start:for ws a:namelist ws "in" ws b:explist ws "do" ws? c:BlockStatement ws? end:("end") & { return eUntermIfEmpty(end, "for", "end", start); } 
    {
        var statements = [];
        var nil = {type: "Literal", value: null };
        var uf = {type: "Identifier", name: 'undefined' };
        var iterator = bhelper.tempName();
        var context = bhelper.tempName();
        var curent = bhelper.tempName();
        var v1 = a[0];
        var varlist = [];
        for ( var idx in a ) {
            varlist.push({type: "VariableDeclarator", id: a[idx] });
        }
        var call = builder.callExpression(iterator,[context, curent]);
        var assign;
        //if ( a.length > 1 ) {
            assign = bhelper.bulkAssign(a, [call])
        //} else {
        //    assign = bhelper.assign(v1, call);
        //}
        var nullish = function(v) {
            return builder.binaryExpression("||", builder.binaryExpression("===", v1, nil), builder.binaryExpression("===", v1, uf))
        }
        statements.push(builder.variableDeclaration("let", varlist));
        statements.push({
            type: "WhileStatement",
            test: {type: "Literal", value: true},
            body: bhelper.blockStatement([
            assign,
            { type: "IfStatement", test: nullish(v1), consequent: {type: "BreakStatement" } },
            bhelper.assign(curent, v1),
            c.body
            ])
        });
        return bhelper.encloseDeclsUnpack(statements, [iterator, context, curent], b);
    }
LocalAssingment =
    "local" ws left:namelist ws? "=" ws? right:explist
    { 
        var result = builder.variableDeclaration("let", []);
        if ( !opt('decorateLuaObjects', false) || ( left.length < 2 && right.length < 2 )) {
            for ( var i = 0; i < left.length; ++i ) {
                if ( i !==  right.length - 1 || i ===  left.length - 1 ) {
                    if ( right[i] !== undefined && right[i].type !== "Identifier" && right[i].type !== "Literal" ) {
                        right[i] = bhelper.luaOperator("oneValue", right[i]);
                    }
                    result.declarations.push({
                        type: "VariableDeclarator",
                        id: left[i],
                        init: right[i]
                    });
                } else if ( right[i].type === "Identifier" || right[i].type === "Literal" ) {
                    result.declarations.push({
                        type: "VariableDeclarator",
                        id: left[i],
                        init: right[i]
                    });
                } else {
                    left = left.slice(i);
                    result.declarations = result.declarations.concat(left.map(x => {
                        return { type: "VariableDeclarator", id: x };
                    }));
                    var assign = bhelper.bulkAssign(left, [ right[i] ]);
                    return [result, assign];
                }
            }
            return result;
        } else {
            var assign = bhelper.bulkAssign(left, right);
            for ( var i = 0; i < left.length; ++i ) {
                result.declarations.push({
                    type: "VariableDeclarator",
                    id: left[i]
                });
            }
            return [result, assign];
        }
    }/
    "local" ws left:namelist
    {
        var result = builder.variableDeclaration("let", []);
        for ( var i = 0; i < left.length; ++i ) {
            result.declarations.push({
                type: "VariableDeclarator",
                id: left[i]
            });
        }
        return result;  
    }
AssignmentExpression =
    left:varlist ws? "=" ws? right:explist
    { 
        // if ( left.length < 2 ) return bhelper.assign(left[0], right[0]).expression;
        return bhelper.bulkAssign(left, right).expression;
    }
BreakStatement = 
    "break"
    { return {
        "type": "BreakStatement",
        loc: location()
    } }
ExpressionStatement =
    e:(AssignmentExpression/CallExpression)
    { return {
        type: "ExpressionStatement",
        expression: e,
        loc: location()
    } }
elseif = "elseif" ws test:Expression ws "then" ws then:BlockStatement { return wrapNode({test: test, then:then}); }
IfStatement =
    start:if ws test:Expression ws 
    ("then" / &{ return eUnterminated("if","then"); } ) ws then:BlockStatement 
    elzeifs:( ws? elseif )* 
    elze:( ws? "else" ws BlockStatement )? ws? end:("end") &{ return eUntermIfEmpty(end, "if", "end", start); }
    {
        var result = { type: "IfStatement", test: test, consequent: then, loc: location() }
        var last = result;
        for ( var idx in elzeifs ) {
            var elif = elzeifs[idx][1];
            var nue = { type: "IfStatement", test: elif.test, consequent: elif.then, loc: elif.loc, range: elif.range }
            last.alternate = nue;
            last = nue;
        }
        if ( elze !== null ) last.alternate = elze[3];
        return result;
    }
ReturnStatement = 
    "return" ws argument:explist
    { 
        var arg;
        if ( argument == null ) { }
        else if ( argument.length == 1 ) arg = argument[0];
        else if ( argument.length > 1 ) {
            arg = bhelper.luaOperatorA("makeMultiReturn", argument);
        }
        return {
            type: "ReturnStatement",
            argument: arg,
            loc: location()
        }
    } /
    "return"
    {
        return {
            type: "ReturnStatement",
            loc: location() }     
    }
WhileStatement =
    "while" ws test:Expression ws "do" ws body:(BlockStatement ws)? ( "end" / & { return eUnterminated("if"); } ) 
    { return {
        type: "WhileStatement",
        test: test,
        body: body ? body[0] : {type: "EmptyStatement"},
        loc: location()
    } }
RepeatUntil =
    "repeat" ws body:(BlockStatement ws)? ( "until" / & { return eUnterminated("repeat", "until"); } )  ws  test:( Expression / &{return eMsg("repeat until needs terminations criteria"); })
    { return {
        type: "DoWhileStatement",
        test: { 
            type: "UnaryExpression",
            operator: "!",
            argument: test,
            prefix: true,
            loc: test.loc
        },
        body: body ? body[0] : {type: "EmptyStatement"},
        loc: location()
    } }
That = "that" { return { "type": "ThisExpression" }; }
SimpleExpression = (
    ResetExpression / FunctionExpression / CallExpression / That / Identifier / Literal /
    ObjectExpression / UnaryExpression / ParenExpr )
Expression = AssignmentExpression / BinSimpleExpression
BinSimpleExpression = 
    a:(MemberExpression/SimpleExpression) b:( ws? op:binop ws? (MemberExpression/SimpleExpression) )*
    {
        a = bhelper.translateExpressionIfNeeded(a);
        if ( b === null ) return a;
        var tokens = [];
        for ( var idx in b ) {
            var v = b[idx];
            tokens.push(v[1]);
            tokens.push(bhelper.translateExpressionIfNeeded(v[3]));
        }
        return precedenceClimber(tokens, a, 1);
    }
unop = $("-" / "not" / "#")
binop = $("+" / "-" / "==" / ">=" / "<=" / "~=" / ">" / "<" / ".." / "and" / "or" / "*" / "//" / "/" / "%" / "^" )
prefixexp =
    funcname / '(' ws? e:Expression ws? ')' { return e; }
CallExpression = 
    !("function" ws? "(") who:prefixexp a:(ws? (":" Identifier )? callsuffix)+
    {
        var left = who
        for ( var idx = 0; idx < a.length; ++idx ) {
            var v = a[idx];
            if ( v[1] != null ) {
                left = builder.memberExpression(left, v[1][1], false);
                left.selfSuggar = true;
            }
            left = bhelper.callExpression(left,v[2]);
        }
        return left;
    } 
callsuffix =
    a:args { return a; } /
    b:ObjectExpression { return [b]; } /
    c:String { return [{type: "Literal", value: c, loc: location() }]; }
ParenExpr = "(" ws? a:Expression ws? ")" {
    // Wraping a call in ()'s reduces it to a singel value
    if ( a.type == "CallExpression" ) {
        return bhelper.luaOperator("oneValue", a);
    } else if ( a.type == "Identifier" && a.name == "__lua$rest" ) {
        return bhelper.luaOperator("oneValue", a);
    }
    return a;
}
ResetExpression = 
    "..." {
        return wrapNode({type: "Identifier", name: "__lua$rest"});
    }
funcname =
    a:(That/Identifier) b:( funcnamesuffix )*
    {
        var selfSuggar = false;
        if ( b.length == 0 ) return a;
        var left = a;
        for ( var i in b ) {
            left = builder.memberExpression(left, b[i].exp, b[i].computed);
            if ( b[i].suggar ) left.selfSuggar = true;
        }
        return left;
    }
funcnamesuffix = 
    ws? p:[.:] ws? e:Identifier 
    {
        return {exp: e, suggar: p == ':', computed: false }
    } /
    ws? "[" ws? e:Expression ws? "]"
    {
        return {exp: e, suggar: false, computed: true }
    }
explist = 
    a:Expression b:(ws? "," ws? e:(Expression / &{ return eMsg("Malformed argument list."); } ))*
    {
         return listHelper(a,b,3); 
    }
varlist = 
    a:var b:(ws? "," ws? e:var)*
    {
         return listHelper(a,b,3); 
    } 
namelist = 
    a:Identifier b:(ws? "," ws? e:Identifier)*
    {
         return listHelper(a,b,3); 
    } 
args =
    "(" ws? a:explist ws? (")" / &{return eUnterminated(")", "argument list"); })
    {
         return a; 
    } /
    "(" ws? (")" / &{return eUnterminated(")", "argument list"); })
    {
        return []
    }
var = MemberExpression / Identifier
MemberExpression = 
    a:(CallExpression/SimpleExpression) b:indexer c:indexer*
    { 
        var left = builder.memberExpression(a, b[0], b[1]);
        for ( var idx in c ) {
            left = builder.memberExpression(left, c[idx][0], c[idx][1]);
        }
        return left;
    } 
indexer =
    ws? "[" ws? b:Expression ws? "]" { return [b, true]; } /
    ws? "." b:SimpleExpression { return [b,false]; }
ObjectExpression =
    "{" ws? f:field? s:(ws? ("," / ";") ws? field)* ws? (("," / ";") ws?)? "}" 
    { 
        var result;
        var props = listHelper(f,s,3);
        var arrProps = [];
        var kvProps = [];
        for ( var idx in props ) {
            var p = props[idx];
            if ( p.key === undefined ) {
                arrProps.push(p.value);
            } else {
                p.kind = "init";
                kvProps.push(p);
            }
        }
        if ( opt('decorateLuaObjects', false) ) {
            var last = false;
            if (kvProps.length) {
                result = { type: "ArrayExpression", elements: kvProps.map(p => {
                    return { type: "ArrayExpression", elements: [p.key, p.value] };
                }) };
            } else {
                last = true;
                result = { type:"Literal", value: null };
            }
            return bhelper.luaOperator.apply(bhelper, ["makeTable", result,
                    { type: "Literal", value: last }].concat(arrProps)); 
        } else {
            result = {
                loc: location()
            };
            if (kvProps.length) {
                result.type = "ObjectExpression";
                result.properties = arrProps.map((val, idx) => {
                    return {
                        key: { type: "Literal", value: idx + 1 },
                        kind: "init",
                        value: val
                    }
                }).concat(kvProps)
            } else {
                result.type = "ArrayExpression";
                result.elements = arrProps;
            }
            return result;
        }
    }
field =
                                          /* Otherwise we think it might be a multi assignment */
    n:(Literal/Identifier) ws? "=" ws? v:(BinSimpleExpression) 
    {
        if ( n.type == "Identifier" ) n = {type: "Literal", value: n.name};
        return { key: n, value: v };
    }/
    v:BinSimpleExpression ws?
    {
        return { value: v };
    }/
    ws? "[" ws? k:Expression ws? "]" ws? "=" ws? v:BinSimpleExpression
    {
        return { key: k, value: v }; 
    }
FunctionDeclaration =
    start:function ws? name:funcname ws? f:funcbody ws? end:("end") & { return eUntermIfEmpty(end, "function", "end", start); }
    {
        if ( name.type != "MemberExpression" && opt("allowRegularFunctions", false) ) {
            //TODO: this would need to be decorated
            return builder.functionDeclaration(name, f.params, f.body);
        }
        //TODO: Translate member expression into call
        var params = f.params.slice(0);
        if ( name.selfSuggar ) params = [{type: "Identifier", name: "self"}].concat(f.params);
        if ( f.rest ) {
            bhelper.injectRest(f.body.body, params.length);
        }
        var out = builder.functionExpression(null, params, f.body)
        if ( opt('decorateLuaObjects', false) ) {
            out = bhelper.luaOperator("makeFunction", out);
        }
        return bhelper.assign(name, out);
    }
LocalFunction =
    "local" ws start:function ws? name:funcname ws? f:funcbody ws? end:("end") & { return eUntermIfEmpty(end, "function", "end", start); }
    {
        if ( f.rest ) {
            bhelper.injectRest(f.body.body, f.params.length);
        }
        if ( opt("allowRegularFunctions", false) )
            return builder.functionDeclaration(name, f.params, f.body);
        var func = builder.functionExpression(name, f.params, f.body);
        if ( opt('decorateLuaObjects', false) ) {
            func = bhelper.luaOperator("makeFunction", func);
        }
        var decl = {type: "VariableDeclarator", id: name, init: func};
        var out = builder.variableDeclaration("let", [ decl ]);
        return out;
    } 
FunctionExpression = 
    f:funcdef 
    {
        var result = {
            type: "FunctionExpression",
            body: f.body,
            params: f.params,
            loc:location() }
        if ( f.rest ) {
            bhelper.injectRest(f.body.body, f.params.length)
        }
        if ( opt('decorateLuaObjects', false) ) {
            return bhelper.luaOperator("makeFunction", result);
        } else {
            return result;
        }
    }
funcdef = 
    start:function ws? b:funcbody ws? end:("end") & { return eUntermIfEmpty(end, "function", "end", start); } { return b; }
funcbody = 
    "(" ws? p:paramlist ws? rest:("," ws? "..." ws?)? ")" ws? body:BlockStatement
    {
        return { params: p, body: body, rest: rest != null }
    } /
    "(" ws? "..." ws? ")" ws? body:BlockStatement
    {
        return { params: [], body: body, rest: true }
    }
paramlist = 
    a:Identifier ws? b:("," ws? Identifier)*
    {
        return listHelper(a,b); 
    } /
    ws? { 
        return [] 
    }
UnaryExpression =
    o:unop ws? e:(MemberExpression/SimpleExpression/Expression)
    { 
        var ops = {"not": "!", "-": "-", "#": "#" }
        if ( o == "#" ) {
            e = bhelper.translateExpressionIfNeeded(e);
            return bhelper.luaOperator("count", e);
        }
        return { 
            type: "UnaryExpression",
            operator: ops[o],
            argument: bhelper.translateExpressionIfNeeded(e),
            prefix: true,
            loc: location()
        }
    }
Identifier =
    name:Name
    { return {
        type: "Identifier",
        name: name,
        loc: location()
    } }
Literal = 
    a: ("nil" / "false" / "true") 
    {
        var values = {"nil": null, "false": false, "true": true} 
        return wrapNode({ type: "Literal", value: values[a] })
    } / 
    b: Number [eE] c:$(("-" / "+")? [0-9]+)
    {
        return wrapNode({ type: "Literal", value: parseFloat(b) * Math.pow(10, parseInt(c)) })
    } /
    a: "0" [Xx] b:$([0-9a-fA-F]+)
    {
        return wrapNode({ type: "Literal", value: parseInt(b, 16) })
    } /
    b: Number
    {
        return wrapNode({ type: "Literal", value: parseFloat(b) })
    } /
    s: String
    {
        return wrapNode({ type: "Literal", value: s })
    }