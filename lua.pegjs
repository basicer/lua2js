{
  function loc() { return undefined && {start: { line: line(), column: column() } } }
  function range() { return undefined && [offset(), offset() + text().length]; }
  function listHelper(a,b,c) { return [a].concat(b.map(function(b) { return b[c || 2]; })); }
  function opt(name, def) { return options[name] === undefined ? def : options[name] }

  function expandMultiStatements(list) {
    var out = [];
    for ( var i = 0; i < list.length; ++i ) {
        var value = list[i];
        if (value instanceof Array) out = out.concat(value);
        else out.push(value);
    }
    return out;
  }

  function wrapNode(obj, hasScope) {
    hasScope = !!hasScope 
    obj.loc = loc();
    obj.range = range();
    obj.hasScope = hasScope;

    return obj;
  }

  var opPrecedence = {
    "^": 10,
    "not": 9,
    "*": 8, "/": 8,
    "+": 7, "-": 7,
    "..": 6,
    "<": 5, ">": 5, ">=": 5, "<=": 5,
    "and": 5,
    "or": 4
  }

  function precedenceClimber(tokens, lhs, min) {
    while ( true ) { 
        if ( tokens.length == 0 ) return lhs;
        var op = tokens[0];
        var prec = opPrecedence[op];
        if ( prec < min ) return lhs;
        tokens.shift();

        var rhs = tokens.shift();
        while ( true ) {
            var peek = tokens[0];
            if ( peek == null || opPrecedence[peek] <= prec ) break;
            rhs = precedenceClimber(tokens, rhs, opPrecedence[peek]);
        }

        lhs = bhelper.binaryExpression(op, lhs, rhs);
    }

  }

  var builder = {
    assignmentExpression: function(op, left, right) { return wrapNode({type: "AssignmentExpression", operator: op, left: left, right: right }); },
    binaryExpression: function(op, left, right) { return wrapNode({type: "BinaryExpression", operator: op, left: left, right: right }); },
    blockStatement: function(body) { return wrapNode({ type: "BlockStatement", body: body}); },
    callExpression: function(callee, args) { return wrapNode({ type: "CallExpression", callee: callee, arguments: args}); },
    emptyStatement: function() { return wrapNode({ type: "EmptyStatement" }); },
    functionDeclaration: function(name, args, body, isGenerator, isExpression) {
        return wrapNode({type: "FunctionDeclaration", id: name, params: args, body: body, generator: isGenerator, expression: isExpression });
    },
    memberExpression: function(obj, prop, isComputed) { return wrapNode({ type:"MemberExpression", object: obj, property: prop, computed: isComputed }); },
    variableDeclaration: function(kind, decls) { return { type: "VariableDeclaration", declarations: decls, kind: opt("forceVar", true) ? "var" : kind } },
    functionExpression: function(name, args, body) { return { type: "FunctionExpression", body: body, params: args } }
  };

  var i = function(n) { return { type: "Identifier", name: n}; }
  var tmpVarCtr = 0;

  var bhelper = {
    tempName: function() {
        return i("__lua$tmpvar$" + (++tmpVarCtr));
    },
    tempVar: function(exp) {
        return { type: "VariableDeclarator", id: bhelper.tempName(), init: exp };
    },
    assign: function(target, exp) {
        return {
            type: "ExpressionStatement",
            expression: builder.assignmentExpression("=", target, exp)
        };
    },
    encloseDecls: function(body /*, decls...*/) {
        var decls = Array.prototype.slice.call(arguments, 1);
        var vals = [];
        var names = [];
        for ( var k in decls ) {
            var v = decls[k];
            vals.push(v.init);
            names.push(v.id);
        }
        return {
            expression: builder.callExpression(
                builder.functionExpression(null, names, builder.blockStatement(body)),
                vals
            ),
            type: "ExpressionStatement"
        }
    },
    encloseDeclsUnpack: function(body, names, explist) {
        return {
            expression: builder.callExpression(
                builder.memberExpression(
                    builder.functionExpression(null, names, builder.blockStatement(body)),
                    i("apply")
                ),
                [{type: "Literal", value: null}, bhelper.luaOperatorA("expandReturnValues", explist)]
            ),
            type: "ExpressionStatement"
        }
    },
    bulkAssign: function(names, explist) {
        var temps = [];
        var body = [];
        for ( var i = 0; i < names.length; ++i ) {
            temps[i] = bhelper.tempName();
            body[i] = bhelper.assign(names[i], temps[i]);
        }

        var out = bhelper.encloseDeclsUnpack(body, temps, explist);
        return out;
    },
    luaOperator: function(op /*, args */) {
        return builder.callExpression(
            builder.memberExpression(i("__lua"), i(op)), 
            Array.prototype.slice.call(arguments, 1)
        );
    },
    luaOperatorA: function(op, args) {
        return builder.callExpression(
            builder.memberExpression(i("__lua"), i(op)), 
            args
        );
    },
    binaryExpression: function(op, a, b) {
        if ( opt("luaOperators", false) ) {
            var map = {"+": "add", "-": "sub", "*": "mul", "/": "div", "^": "pow", "%":"mod",
                "..": "concat", "==": "eq", "<": "lt", "<=": "lte", "~=": "ne",
                "and": "and", "or": "or"
            };
            return bhelper.luaOperator(map[op], a, b);
        } else {

            if ( op == "~=" ) xop = "!=";
            else if ( op == ".." ) op = "+";
            else if ( op == "or" ) op = "||";
            else if ( op == "and" ) op = "&&";

            return builder.binaryExpression(op, a, b);
        }
    },
    callExpression: function(callee, args) {
        if ( opt("luaCalls", false) ) {
            return bhelper.luaOperator.apply(bhelper, ["call", callee].concat(args));
        } else {
            return builder.callExpression(callee, args);
        }
    },
    memberExpression: function(obj, prop, isComputed) {
        if ( opt("luaOperators", false) && !isComputed ) {
            return bhelper.luaOperator("index", obj, prop);
        }
        return builder.memberExpression(obj, prop, isComputed);
    }
  }

}

start = ws? t:BlockStatement ws? { return t; }

ws = ([ \r\t\n] / ("--" ( [^\n]* "\n" / .* ) )) +

BlockStatement =
    r:ReturnStatement
    {
        return builder.blockStatement([r]) 
    } /
    list:StatatementList ret:(ws ReturnStatement)?
    {
        list = expandMultiStatements(list);
        return builder.blockStatement(ret === null ? list : list.concat([ret[1]])); 
    } 


StatatementList = 
    a:Statement? b:( ( ws? ";" ws? / ws )+ Statement )*
    {  
        if ( a === null ) return [];
        if ( b === null ) return a;
        return listHelper(a,b,1);
    }

ReservedWord = "if" / "then" / "else" / "do" / "end" / "return" / "local" / "nil" / "true" / "false"
    "function" / "not" / "break" / "for" / "until" / "function" / binop / unop

Name = !(ReservedWord (ws / !.)) a:$([a-zA-Z_][a-zA-Z0-9_]*) { return a; }
Number = $([0-9]+("." [0-9]+)?)

stringchar =
    "\\" c:[abfrntv'"] { return {
        "n": "\n",
        "b": "\b",
        "f": "\f",
        "r": "\r",
        "t": "\t",
        "v": "\v",
        '"': '"',
        "'": "'" 
    }[c] } / 
    "\\\n" { return "" } /
    "\\\z" ws { return "" } /
    "\\" a:$[0-9] b:$[0-9]? c:$[0-9]? { return String.fromCharCode(parseInt('' + a + b + c)); } /
    "\\" { error('Invalid Escape Sequence') } / 
    $[^'"'] 

String =
    "\"" r:(stringchar/"'") * "\"" { return r.join(''); } /
    "'" r:(stringchar/'"') * "'" { return r.join(''); }

Statement = 
    s: ( 
    BreakStatement /
    NumericFor /
    ForEach /
    WhileStatement /
    IfStatement /
    ExpressionStatement / 
    DoEndGrouped /
    LocalAssingment /
    FunctionDeclaration /
    LocalFunction / $"" & (ws? ";")
    ) {  return s == "" ? builder.emptyStatement() : s; }

DoEndGrouped = "do" b:BlockStatement "end" { return b }

NumericFor =
    "for" ws a:Identifier ws? "=" ws? b:Expression ws? "," ws? c:Expression d:( ws? "," Expression )? ws? "do" ws? body:BlockStatement ws? "end"
    {
        var amount = d == null ? {type: "Literal", value: 1 } : d[2];
        
        var updateBy = bhelper.tempVar(amount);
        var testValue = bhelper.tempVar(c);

        var update = builder.assignmentExpression("=", a, bhelper.binaryExpression("+", a, updateBy.id));


        var out = {
            type: "ForStatement",
            init: builder.variableDeclaration("let", [
                {
                    type: "VariableDeclarator",
                    id: a,
                    init: b,
                }
            ]),
            body: body,
            update: update,
            test: bhelper.binaryExpression("<=", a, testValue.id),
            loc: loc(),
            range: range()
        };

        return bhelper.encloseDecls([out], updateBy, testValue);
    }

ForEach =
    "for" ws a:namelist ws "in" ws b:explist ws "do" ws? c:BlockStatement ws? "end"
    {
        var statements = [];
        var nil = {type: "Literal", value: null };


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
        if ( a.length > 1 ) {
            assign = bhelper.bulkAssign(a, [call])
        } else {
            assign = bhelper.assign(v1, call);
        }

        statements.push(builder.variableDeclaration("let", varlist));
        statements.push({
            type: "WhileStatement",
            test: {type: "Literal", value: true},
            body: builder.blockStatement([
            assign,
            { type: "IfStatement", test: builder.binaryExpression("===", v1, nil), consequent: {type: "BreakStatement" } },
            bhelper.assign(curent, v1),
            bhelper.encloseDecls(c.body) //TODO: We could just unpack c here.

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
                result.declarations.push(            {
                    type: "VariableDeclarator",
                    id: left[i],
                    init: right[i],
                });
            }

            return result;
        } else {
            var assign = bhelper.bulkAssign(left, right)
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
    left:var ws? "=" ws? right:Expression
    { 
        return builder.assignmentExpression("=", left, right);
    }

BreakStatement = 
    "break"
    { return {
        "type": "BreakStatement",
        loc: loc(),
        range: range()
    } }

ExpressionStatement =
    e:(AssignmentExpression/CallExpression)
    { return {
        type: "ExpressionStatement",
        expression: e,
        loc: loc(),
        range: range()
    } }


IfStatement =
    "if" ws test:Expression ws "then" ws then:BlockStatement elze:( ws? "else" ws BlockStatement )? ws? "end" 
    {
        var result = { type: "IfStatement", test: test, consequent: then, loc: loc(), range: range()}
        if ( elze !== null ) result.alternate = elze[3];
        return result;
    }

ReturnStatement = 
    "return" ws argument:explist
    { 
        var arg;


        if ( argument.length == 1 ) arg = argument[0];
        else if ( argument.length > 1 ) {
            if ( opt('decorateLuaObjects', false) ) arg = bhelper.luaOperatorA("makeMultiReturn", argument);
            else  arg = {
                type: "ArrayExpression",
                elements: argument
            };            
        }
        return {
            type: "ReturnStatement",
            argument: arg,
            loc: loc(),
            range: range()
        }
    } 

WhileStatement =
    "while" ws test:Expression ws "do" ws body:BlockStatement ws "end" 
    { return {
        type: "WhileStatement",
        test: test,
        body: body,
        loc: loc(),
        range: range()

    } }




SimpleExpression = (
    Literal / FunctionExpression / CallExpression / Identifier /
    ObjectExpression / UnaryExpression / ParenExpr )

Expression = 
    FunctionExpression / CallExpression / a:(MemberExpression/SimpleExpression/var) b:( ws? op:binop ws? (MemberExpression/SimpleExpression) )*
    {
        if ( b === null ) return a;
        var tokens = [];
        for ( var idx in b ) {
            var v = b[idx];
            tokens.push(v[1]);
            tokens.push(v[3]);
        }

        return precedenceClimber(tokens, a, 1);
    } / AssignmentExpression



unop = $("-" / "not" / "#")
binop = $("+" / "-" / "==" / ">" / "<" / "~=" / ".." / "and" / "or" / "*" / "/" / "%" )


prefixexp =
    funcname / '(' ws? e:Expression ws? ')' { return e; }

CallExpression = 
    who:prefixexp ws? a:args 
    {
        return bhelper.callExpression(who,a);
    } /
    who:prefixexp ws? b:ObjectExpression 
    {
        return bhelper.callExpression(who, [b]);
    } /
    who:prefixexp ws? c:String
    {
        return bhelper.callExpression(who, [{type: "Literal", value: c}]);
    } 

ParenExpr = "(" ws? a:Expression ws? ")" { return a; }


funcname =
    a:Identifier b:(ws? [.:] ws? Identifier)*
    {
        if ( b.length == 0 ) return a;
        var left = a;
        for ( var i in b ) {
            left = builder.memberExpression(left, b[i][3], false);
        }
        return left;
    }

explist = 
    a:Expression b:(ws? "," ws? e:Expression)*
    {
         return listHelper(a,b,3); 
    } 

namelist = 
    a:Identifier b:(ws? "," ws? e:Identifier)*
    {
         return listHelper(a,b,3); 
    } 

args =
    "(" ws? a:explist ")"
    {
         return a; 
    } /
    "(" ws? ")"
    {
        return []
    }

var = MemberExpression / Identifier

MemberExpression = 
    a:SimpleExpression "[" ws? b:Expression ws? "]"
    { 
        return builder.memberExpression(a,b,true);
    } /
    a:SimpleExpression "." b:SimpleExpression
    {
        return builder.memberExpression(a,b,false);
    }
    


ObjectExpression =
    "{" ws? f:field? s:(ws? ("," / ";") ws? field)* ws? "}" 
    { 
        var result = {
            type: "ObjectExpression",
            properties: [],
            loc: loc(),
            range: range()
        };

        if ( f !== null ) {
            if ( f.key === undefined ) f.key = {type: "Literal", value: 1};
            f.kind = "init";
            result.properties.push(f);
        } 
        
        if ( s )
        for ( var idx in s ) {
            var v = s[idx][3];
            if ( v.key === undefined ) v.key = {type: "Literal", value: 2 + parseInt(idx)};
            v.kind = "init";
            result.properties.push(v);
        }

        if ( opt('decorateLuaObjects', false) ) return bhelper.luaOperator("makeTable", result);
        else return result;
    }

field =
    n:(Literal/Identifier) ws? "=" ws? v:Expression 
    {
        return { key: n, value: v };
    }/
    v:Expression ws?
    {
        return { value: v };
    }/
    ws? "[" ws? k:Expression ws? "]" ws? "=" ws? v:Expression
    {
        return { key: k, value: v }; 
    }


FunctionDeclaration =
    "function" ws? name:funcname ws? f:funcbody
    {
        return builder.functionDeclaration(name, f.params, f.body);
    }

LocalFunction =
    "local" ws "function" ws? name:funcname ws? f:funcbody
    {
        return builder.functionDeclaration(name, f.params, f.body);
    }

FunctionExpression = 
    f:funcdef 
    {
        var result = {
            type: "FunctionExpression",
            body: f.body,
            params: f.params,
            loc:loc(),
            range:range()
        }

        return result;

    }

funcdef = 
    "function" ws? b:funcbody { return b; }

funcbody = 
    "(" ws? p:paramlist ws? ")" ws? body:BlockStatement ws? "end"
    {
        return { params: p, body: body }
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
    o:unop ws? e:Expression
    { 
        var ops = {"not": "!", "-": "-", "#": "#" }
        if ( o == "#" ) return bhelper.luaOperator("count", e);
        return { 
            type: "UnaryExpression",
            operator: ops[o],
            argument: e,
            prefix: true,
            loc: loc(),
            range: range()
        }
    }

Identifier =
    name:Name
    { return {
        type: "Identifier",
        name: name,
        loc: loc(),
        range: range()
    } }

Literal = 
    a: ("nil" / "false" / "true") 
    {
        var values = {"nil": null, "false": false, "true": true} 
        return { type: "Literal", value: values[a], loc: loc(), range: range() }

    } / 
    b: Number [eE] c:$(("-" / "+")? [0-9]+)
    {
        return { type: "Literal", value: parseFloat(b) * Math.pow(10, parseInt(c)), loc: loc(), range: range()  }

    } /
    b: Number
    {
        return { type: "Literal", value: parseFloat(b), loc: loc(), range: range()  }

    } /
    s: String
    {
        return { type: "Literal", value: s, loc: loc(), range: range()  }

    } 