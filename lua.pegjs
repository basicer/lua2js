{
  function loc() { return {start: offset(), end: offset() + text().length } }
  function listHelper(a,b,c) { return [a].concat(b.map(function(b) { return b[c || 2]; })); }
}

start = ws? t:BlockStatement ws? { return t; }

ws = ([ \r\t\n] / ("--" ( [^\n]* "\n" / .* ) )) +

BlockStatement =
    r:ReturnStatement
    { return {
        type: "BlockStatement",
        body: [r]
    } } /
    list:StatatementList ret:(ws ReturnStatement)?
    { return {
        type: "BlockStatement",
        body: ret === null ? list : list.concat([ret[1]])
    } } 
 

StatatementList = 
    a:Statement? b:( ( ws? ";" ws? / ws )+ Statement )*
    {  
        if ( a === null ) return [];
        if ( b === null ) return a;
        return listHelper(a,b,1);
    }

ReservedWord = "if" / "then" / "else" / "do" / "end" / "return" / "local" /
    "function" / "not" / "break" / "for" / "until" / binop / unop

Name = !(ReservedWord ws?) a:$([a-zA-Z_][a-zA-Z0-9_]*) { return a; }
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
    $[^'"'] 

String =
    "\"" r:stringchar* "\"" { return r.join(''); } /
    "'" r:stringchar* "'" { return r.join(''); }

Statement = 
    s: ( 
    BreakStatement /
    NumericFor /
    WhileStatement /
    IfStatement /
    ExpressionStatement / 
    DoEndGrouped /
    LocalAssingment /
    FunctionDeclaration /
    LocalFunction / $"" & (ws? ";")
    ) {  return s == "" ? { type:"EmptyStatement" } : s; }

DoEndGrouped = "do" b:BlockStatement "end" { return b }

NumericFor =
    "for" ws a:Identifier ws? "=" ws? b:Expression ws? "," ws? c:Expression d:( ws? "," Expression )? ws? "do" ws? body:BlockStatement ws? "end"
    {
        var amount = d == null ? {type: "Literal", value: 1 } : d[2];

        var update = {
            type: "AssignmentExpression",
            left: a,
            right: {type: "BinaryExpression", left: a, right: amount, operator: "+" },
            operator: "=",
            loc: loc()
        };

        var out = {
            type: "ForStatement",
            init: {
                type: "VariableDeclaration",
                declarations: [
                    {
                        type: "VariableDeclarator",
                        id: a,
                        init: b,
                    }
                ],
                operator: "=",
                kind: "var"
            },
            body: body,
            update: update,
            test: {
                type: "BinaryExpression",
                left: a,
                right: c,
                operator: "<="
            }
        };

        return out;
    }

LocalAssingment =
    "local" ws expr:AssignmentExpression
    { return {
        type: "VariableDeclaration",
        declarations: [
            {
                type: "VariableDeclarator",
                id: expr.left,
                init: expr.right,
            }
        ],
        operator: "=",
        kind: "var"
    } }

AssignmentExpression =
    left:var ws? "=" ws? right:Expression
    { return {
        type: "AssignmentExpression",
        left: left,
        right: right,
        operator: "=",
        loc: loc()
    } }

BreakStatement = 
    "break"
    { return {
        "type": "BreakStatement"
    } }

ExpressionStatement =
    e:(AssignmentExpression/CallExpression)
    { return {
        type: "ExpressionStatement",
        expression: e,
        loc: loc()
    } }


IfStatement =
    "if" ws test:Expression ws "then" ws then:BlockStatement elze:( ws? "else" ws BlockStatement )? ws? "end" 
    {
        var result = { type: "IfStatement", test: test, consequent: then}
        if ( elze !== null ) result.alternate = elze[3];
        return result;
    }

ReturnStatement = 
    "return" ws argument:Expression
    { return {
        type: "ReturnStatement",
        argument: argument,
        loc: loc()
    } }

WhileStatement =
    "while" ws test:Expression ws "do" ws body:BlockStatement ws "end" 
    { return {
        type: "WhileStatement",
        test: test,
        body: body,
        loc: loc()

    } }




SimpleExpression = (
    CallExpression / Identifier /
    ObjectExpression / FunctionExpression / UnaryExpression / Literal / ParenExpr )

Expression = 
    a:(MemberExpression/SimpleExpression/var) b:( ws? op:binop ws? Expression )?
    {
        if ( b === null ) return a;
        var xop = b[1];
        if ( xop == "~=" ) xop = "!=";
        else if ( xop == ".." ) xop = "+";
        else if ( xop == "or" ) xop = "||";
        else if ( xop == "and" ) xop = "&&";

        return {
            type: "BinaryExpression",
            left: a,
            right: b[3],
            operator: xop,
            loc: loc()
        };
    } / CallExpression / AssignmentExpression



unop = $("-" / "not" / "#")
binop = $("+" / "-" / "==" / ">" / "<" / "~=" / ".." / "and" / "or" / "*" / "/" / "%" )


prefixexp =
    Identifier / funcname / '(' ws? e:Expression ws? ')' { return e; }

CallExpression = 
    who:prefixexp ws? a:args 
    { return {
        type: "CallExpression",
        callee: who,
        arguments: a,
        loc: loc()
    } } /
    who:prefixexp ws? b:ObjectExpression 
    { return {
        type: "CallExpression",
        callee: who,
        arguments: [b]
    } } /
    who:prefixexp ws? c:String
    { return {
        type: "CallExpression",
        callee: who,
        arguments: [{type: "Literal", value: c}],
        loc: loc()
    } } 

ParenExpr = "(" ws? a:Expression ws? ")" { return a; }


funcname =
    a:Identifier b:(ws? [.:] ws? Identifier)*
    {
        if ( b.length == 0 ) return a;
        var left = a;
        for ( var i in b ) {
            left = {
                type: "MemberExpression",
                object: left,
                property: b[i][3],
                computed: false,
                loc:loc()
            }
        }
        return left;
    }

args =
    "(" ws? a:Expression b:("," ws? e:Expression)* ")"
    {
         return listHelper(a,b); 
    } /
    "(" ws? ")"
    {
        return []
    }

var = MemberExpression / Identifier

MemberExpression = 
    a:SimpleExpression "[" ws? b:Expression ws? "]"
    { return {
        type: "MemberExpression",
        object: a,
        property:b,
        computed:true,
        loc:loc()
    } } /
    a:SimpleExpression "." b:SimpleExpression
    { return {
        type: "MemberExpression",
        object: a,
        property:b,
        computed:false,
        loc:loc()
    } }
    


ObjectExpression =
    "{" ws? f:field? s:(ws? ("," / ";") ws? field)* ws? "}" 
    { 
        var result = {
            type: "ObjectExpression",
            properties: [],
            loc: loc()
        };

        if ( f != null ) {
            if ( f.key === undefined ) f.key = {type: "Literal", value: 1};
            result.properties.push(f);
        }
        
        if ( s != null )
        for ( var idx in s ) {
            var v = s[idx][3];
            if ( v.key === undefined ) v.key = {type: "Literal", value: 2 + parseInt(idx)};
            result.properties.push(v);
        }

        return result;
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
    }/


FunctionDeclaration =
    "function" ws? name:funcname ws? f:funcbody
    {
        return {
            type: "FunctionDeclaration",
            id: name,
            params: f.params,
            body: f.body
        }
    }

LocalFunction =
    "local" ws "function" ws? name:funcname ws? f:funcbody
    {
        return {
            type: "FunctionDeclaration",
            id: name,
            params: f.params,
            body: f.body
        }
    }

FunctionExpression = 
    f:funcdef 
    {
        var result = {
            type: "FunctionExpression",
            body: f.body,
            params: f.params
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
        return { 
            type: "UnaryExpression",
            operator: ops[o],
            argument: e,
            prefix: true,
            loc: loc()
        }
    }

Identifier =
    name:Name
    { return {
        type: "Identifier",
        name: name,
        loc: loc()
    } }

Literal = 
    a: ("nil" / "false" / "true") 
    {
        var values = {"nil": null, "false": false, "true": true} 
        return { type: "Literal", value: values[a], loc: loc()}

    } / 
    b: Number
    {
        return { type: "Literal", value: parseFloat(b), loc: loc() }

    } /
    c: String
    {
        return { type: "Literal", value: c, loc: loc() }

    } 