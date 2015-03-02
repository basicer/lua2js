{
  function loc() { return {start: { line: line(), column: column() } } }
  function range() { return [offset(), offset() + text().length]; }
  function listHelper(a,b,c) { return a == null ? [] : [a].concat(b.map(function(b) { return b[c || 2]; })); }
  function opt(name, def) { return name in options ? options[name] : def }

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
    obj.text = text();
    return obj;
  }

  function eUntermIfEmpty(what, type, end, start) {
    if ( what.length == 0 ) return eUnterminated(type, end, start);
    return true;
  }

  function eUnterminated(type, end, start) {
    var xline = start !== undefined ? start.loc.start.line : (line());
    var xcol = start !== undefined ? start.loc.start.column : (column());

    eMsg("`" + (end || "end") + "` expected (to close " + type + " at " + xline + ":" + xcol + ") at " + line() +  ":" + column() );
    return true;
  }

  function eMsg(why) {
    if ( !opt("loose", false) ) error(why);
    errors.push({msg: why, loc: loc(), range: range()});
    return true;
  }

  var opPrecedence = {
    "^": 10,
    "not": 9,
    "*": 8, "/": 8, "%": 8, "//": 8,
    "+": 7, "-": 7,
    "..": 6,
    "<": 5, ">": 5, ">=": 5, "<=": 5, "==": 5, "~=": 5,
    "and": 4,
    "or": 3
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

  var errors;

  function init() {
    errors = [];
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
    functionExpression: function(name, args, body) { return { type: "FunctionExpression", name: name, body: body, params: args } },
    returnStatement: function(arg) { return wrapNode({type: "ReturnStatement", argument: arg}); }
  };

  var i = function(n) { return { type: "Identifier", name: n}; }
  var id = i;
  var tmpVarCtr = 0;

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }



  function finalize(ast) {
    if ( opt("loose", false) ) ast.errors = errors;
    
    if ( opt("useStrict", false) ) {
        ast.body.unshift({
            type: "ExpressionStatement",
            expression: { type: "Literal", value: "use strict" }
        });
    }

    if ( opt("noSharedObjects", true) ) return clone(ast);
    return ast;
  }

  var bhelper = {
    blockStatement: function(body) {
        return builder.blockStatement(expandMultiStatements(body));
    },
    tempName: function() {
        return i("__lua$tmpvar$" + (++tmpVarCtr));
    },
    tempVar: function(exp) {
        return { type: "VariableDeclarator", id: bhelper.tempName(), init: exp };
    },
    assign: function(target, exp) {
        var out = builder.assignmentExpression("=", target, exp);
        if ( target.type == "MemberExpression" && opt("luaOperators", false) ) {
            var prop = target.property;
            if ( !target.computed ) prop = {"type": "Literal", "value": prop.name, loc: prop.loc, range: prop.range };
            
            var helper;
            var nue = bhelper.translateExpressionIfNeeded(target.object);

            if ( target.object.type == "Identifier" ) helper = target.object.name;

            if ( helper === undefined ) {
                nue = bhelper.luaOperator("indexAssign", nue, prop, exp);
            } else {
                nue = bhelper.luaOperator("indexAssign", nue, prop, exp, {type:"Literal", value: helper});
            }

            nue = {type: "ConditionalExpression",test: nue, consequent: exp, alternate: out};

            out = nue;
        }
            
        return {
            type: "ExpressionStatement",
            expression: out
        };
    },
    encloseDecls: function(body /*, decls...*/) {
        var decls = Array.prototype.slice.call(arguments, 1);
        return bhelper.encloseDeclsEx.apply(this, [body, opt("encloseWithFunctions", true) ].concat(decls));
    },
    encloseDeclsEx: function(body, enclose /*, decls...*/) {
        var decls = Array.prototype.slice.call(arguments, 2);
        var vals = [];
        var names = [];
        for ( var k in decls ) {
            var v = decls[k];
            vals.push(v.init);
            names.push(v.id);
        }

        if ( enclose ) {
            return {
                expression: builder.callExpression(
                    builder.functionExpression(null, names, bhelper.blockStatement(body)),
                    vals
                ),
                type: "ExpressionStatement"
            }
        } else {
            if ( decls.length < 1 ) return body;
            return bhelper.blockStatement([ builder.variableDeclaration("let", decls) ].concat(body));
        }
    },
    encloseDeclsUnpack: function(body, names, explist, force) {

        if ( force || opt("encloseWithFunctions", true) ) {
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
        } else {
            var decls = [];
            for ( var idx in names ) {
                decls.push({
                    type: "VariableDeclarator",
                    id: names[idx],
                    init: idx.id
                });
            }
            return bhelper.blockStatement([ 
                builder.variableDeclaration("let", decls),
                bhelper.bulkAssign(names, explist)
                ].concat(body));
        }
    },
    bulkAssign: function(names, explist) {
        var temps = [];
        var body = [];
        for ( var i = 0; i < names.length; ++i ) {
            temps[i] = bhelper.tempName();
        }

        // If we are refrencing a previously set value in a bulk assign as a property
        // we want to use the old value to look up the index, so we will pull that from
        // the temp var passed in
        var extra = 0;
        for ( var i = 0; i < names.length; ++i ) {
            var exp = names[i];
            if ( exp.type == "MemberExpression" && exp.property.type == "Identifier" ) {
                for ( var j = 0; j < i; ++j) {
                    if ( names[j].name == exp.property.name ) {
                        var holding = bhelper.tempName();
                        temps.unshift(holding);
                        explist.unshift(exp.property);
                        exp.property = holding;
                        ++extra;
                    }
                }
            }
        }

        for ( var i = 0; i < names.length; ++i ) {
            body[i] = bhelper.assign(names[i], temps[i+extra]);
        }

        if ( names.length > 1 ) {
            return bhelper.encloseDeclsUnpack(body, temps, explist, true);
        } else {
            var value = explist[0];
            if ( value.type == "CallExpression" ) value = bhelper.luaOperator("oneValue", value);
            return bhelper.assign(names[0], value);
        }
        
    },
    luaOperator: function(op /*, args */) {
        var o = builder.callExpression(
            builder.memberExpression(i("__lua"), i(op)), 
            Array.prototype.slice.call(arguments, 1)
        );
        o.internal = true;
        return o;
    },
    luaOperatorA: function(op, args) {
        var o = builder.callExpression(
            builder.memberExpression(i("__lua"), i(op)), 
            args
        );
        o.internal = true;
        return o;
    },
    binaryExpression: function(op, a, b) {
        if ( opt("luaOperators", false) && op != "and" && op != "or" ) {
            var map = {"+": "add", "-": "sub", "*": "mul", "/": "div", "//": "intdiv", "^": "pow", "%":"mod",
                "..": "concat", "==": "eq", "<": "lt", "<=": "lte", ">": "gt", ">=": "gte", "~=": "ne",
                "and": "and", "or": "or"
            };
            
            return bhelper.luaOperator(map[op], a, b);
        } else {

            if ( op == "~=" ) xop = "!=";
            else if ( op == ".." ) op = "+";
            else if ( op == "or" ) op = "||";
            else if ( op == "and" ) op = "&&";
            else if ( op == "//" ) op = "/";

            a = bhelper.luaOperator("oneValue", a);
            b = bhelper.luaOperator("oneValue", b);

            return builder.binaryExpression(op, a, b);
        }
    },
    callExpression: function(callee, args) {
        if ( opt("luaCalls", false) ) {
            var that = {"type": "ThisExpression" };
            if ( callee.type == "MemberExpression" ) that = {"type":"Literal", "value": null};
            var flags = 0;
            if ( callee.selfSuggar ) {
                flags = flags | 1;
            }

            if ( opt('decorateLuaObjects', false) ) {
                flags = flags | 2;
            }

            var flagso = {"type": "Literal", "value": flags};
            var helper = null;
            
            if ( callee.type == "Identifier" ) helper = callee.name;
            else if ( callee.type == "MemberExpression" && !callee.computed ) helper = callee.property.name;

            helper = {"type": "Literal", "value": helper};

            if ( callee.selfSuggar ) {
                if ( callee.object.type == "Identifier" ) {
                    //Dont bother making a function if we are just an identifer.
                    var rcallee = bhelper.translateExpressionIfNeeded(callee)
                    return bhelper.luaOperator.apply(bhelper, ["call", flagso , rcallee, callee.object, helper].concat(args));

                } else {
                    var tmp = bhelper.tempVar(bhelper.translateExpressionIfNeeded(callee.object));
                    
                    var rexpr = builder.memberExpression(tmp.id, callee.property, callee.computed);
                    var rcallee = bhelper.translateExpressionIfNeeded(rexpr);
                    var expr = bhelper.luaOperator.apply(bhelper, ["call", flagso, rcallee, tmp.id, helper].concat(args));
                    return result = bhelper.encloseDeclsEx([
                        builder.returnStatement(
                            expr
                        )
                    ], true, tmp).expression;

                }
            } else {
                var rcallee = bhelper.translateExpressionIfNeeded(callee)
                if ( rcallee.type == "Identifier" && rcallee.name == "assert" ) {
                    args.push({type: "Literal", value: args[0].text || "?"})
                }
                return bhelper.luaOperator.apply(bhelper, ["call", flagso , rcallee, that, helper].concat(args));
            }
        } else {
            return builder.callExpression(callee, args);
        }
    },
    memberExpression: function(obj, prop, isComputed) {
        if ( opt("luaOperators", false) && !isComputed ) {
            var helper;
            if ( obj.type == "Identifier") helper = obj.name;

            if ( helper == undefined ) {
                return bhelper.luaOperator("index", obj, prop);
            } else {
                return bhelper.luaOperator("index", obj, prop, {type:"Literal", value: helper});
            }
        }
        return builder.memberExpression(obj, prop, isComputed);
    },
    translateExpressionIfNeeded: function(exp) {
        if ( !opt("luaOperators", false) ) return exp;
        if ( exp.type == "MemberExpression" ) {
            var prop = exp.property;
            if ( !exp.computed ) prop = {"type": "Literal", value: prop.name };
            var nu = bhelper.memberExpression(bhelper.translateExpressionIfNeeded(exp.object), prop, false);
            nu.origional = exp;
            nu.range = exp.range;
            nu.loc = exp.loc;
            return nu;
        }

        return exp;
    },
    injectRest: function(block, count) {
        block.unshift(builder.variableDeclaration("let", [
                {
                    type: "VariableDeclarator", 
                    id: {type: "Identifier", name:"__lua$rest"}, 
                    init: bhelper.luaOperator("rest", 
                        {type: "Identifier", name:"arguments"},
                        {type: "Literal", value:count}
                    )
                }
             ]));
    },
    valueProvdier: function(statement) {
        return builder.functionExpression(null, [], bhelper.blockStatement([
            builder.returnStatement(statement)
        ]));
    }
  }

}
