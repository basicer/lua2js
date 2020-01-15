var env = {};
var __lua = (function() {

    // Yoinked from underscore.
    var isJSArray = Array.isArray || function(obj) { return toString.call(obj) === '[object Array]'; };

    function type(what) {
        if ( what === null || what === undefined ) return "nil";
        var t = typeof what;
        if ( t == "object" ) return "table";
        return t;
    }

    function numberForArith(n) {
        if ( type(n) == "number" ) return n;
        else if ( typeof n == "string" ) {
            n = parseInt(n);
            if ( !isNaN(n) ) return n;
        }

        throw "attempt to perform arithmetic on a " +  type(n) + " value: " + n;
    }

    function makeString(a) { 
        a = oneValue(a);

        var mtf = lookupMetaTable(a, "__tostring");
        if ( mtf !== null ) return mtf(a);

        if ( a === undefined || a === null ) return "nil";
        if ( a instanceof LuaTable ) {
            return "table: 0x" + a.id;
        } else if ( typeof a == "number" ) {
            if ( ~~a == a ) return a.toString();
            var rep = a.toPrecision();
            if ( rep.length > 14 ) return a.toPrecision(14);
            return rep;
        }
        return "" + a;
    }

    function add(a,b) {
        a = oneValue(a); b = oneValue(b);

        var mtf = lookupMetaTableBin(a, b, "__add");
        if ( mtf !== null ) return mtf(a,b);

        return numberForArith(a) + numberForArith(b); 
    }

    function sub(a,b) { 
        a = oneValue(a); b = oneValue(b);

        var mtf = lookupMetaTableBin(a, b, "__sub");
        if ( mtf !== null ) return mtf(a,b);

        return numberForArith(a) - numberForArith(b);
    }

    function mul(a,b) { 
        a = oneValue(a); b = oneValue(b);

        var mtf = lookupMetaTableBin(a, b, "__mul");
        if ( mtf !== null ) return mtf(a,b);

        return numberForArith(a) * numberForArith(b);
    }

    function div(a,b) { 
        a = oneValue(a); b = oneValue(b);

        var mtf = lookupMetaTableBin(a, b, "__div");
        if ( mtf !== null ) return mtf(a,b);

        return numberForArith(a) / numberForArith(b);
    }

    function intdiv(a,b) { 
        a = oneValue(a); b = oneValue(b);

        var mtf = lookupMetaTableBin(a, b, "__idiv");
        if ( mtf !== null ) return mtf(a,b);

        return ~~(numberForArith(a) / numberForArith(b));
    }

    function mod(a,b) { 
        a = oneValue(a); b = oneValue(b);

        var mtf = lookupMetaTableBin(a, b, "__mod");
        if ( mtf !== null ) return mtf(a,b);

        var anum = numberForArith(a);
        var bnum = numberForArith(b);
        var jsmod = anum % bnum;
        return (jsmod == 0 || (anum > 0) == (bnum > 0)) ? jsmod : jsmod + bnum;
    }

    function pow(a,b) { 
        a = oneValue(a); b = oneValue(b);

        var mtf = lookupMetaTableBin(a, b, "__pow");
        if ( mtf !== null ) return mtf(a,b);

        return Math.pow(numberForArith(a),numberForArith(b)); 
    }

    function concat(a,b) { 
        a = oneValue(a); b = oneValue(b);

        var mtf = lookupMetaTableBin(a, b, "__concat");
        if ( mtf !== null ) return mtf(a,b);
        if ( a === null || a === undefined || b === null || b === undefined )
            throw "attempt to concatenate a nil value";

        return  makeString(a) + makeString(b); 
    }

    function lte(a,b) {
        a = oneValue(a); b = oneValue(b);

        var mtf = lookupMetaTableBin(a, b, "__le");
        if ( mtf !== null ) return mtf(a,b);

        return a <= b; 
    }

    function lt(a,b) {
        a = oneValue(a); b = oneValue(b);

        var mtf = lookupMetaTableBin(a, b, "__lt");
        if ( mtf !== null ) return mtf(a,b);

        return a < b; 
    }

    function gte(a,b) { return lte(b,a); }
    function gt(a,b) { return lt(b,a); }


    function forcomp(d,a,b) { 
        if ( d > 0 ) return a <= b; 
        else if ( d < 0 ) return b <= a;
        else return false;
    }

    
    function eq(a,b) { 
        a = oneValue(a); b = oneValue(b);

        var mtf = lookupMetaTableBin(a, b, "__eq");
        if ( mtf !== null ) return mtf(a,b);


        if ( a === null || a === undefined ) {
            return ( b === null || b === undefined );
        }
        if ( a === b ) return true;
        return false;
    }
    
    function ne(a,b) { return !eq(a,b); }

    function count(a) { 
        if ( a instanceof LuaTable ) {
            var cnt = 0;
            while ( a.numeric[cnt] !== undefined ) ++cnt;
            return cnt;
        }
        return a.length;
    }

    function and(a,b) { return a && b; }
    function or(a,b) { return a || b; }

    function call(flags, what, that, helper /*, args... */ ) {
        var injectSelf = !!(flags & 1); 
        var detectLua = !!(flags & 2); 

        if ( what === null || what === undefined ) {
            if ( helper === undefined ) throw "attempt to call a " + type(what) + " value";
            else throw "attempt to call '" + helper + "' (a " + type(what) + " value)"; 
        }

        var args = expand(Array.prototype.slice.call(arguments, 4), true);

        var doInject = true;

        if ( detectLua ) {
            doInject = what.__luaType == "function";
        }

        if ( injectSelf && doInject ) {
            args.unshift(that);
        }

        if ( detectLua && what.__luaType != "function" ) {
            var args2 = [];
            for ( var i = 0; i < args.length; ++i ) {
                var a = args[i];
                if ( a instanceof LuaTable ) {
                    if ( a.numeric.length == 0 ) args2[i] = a.hash;
                    else if ( Object.keys(a.hash).length == 0 ) args2[i] = a.numeric;
                    else args2[i] = a;
                } else {
                    args2[i] = a;
                }
            }
            args = args2;
        }

        return what.apply(that, args);
    }

    function rest(args, cnt) {
        return new LuaArgList(Array.prototype.slice.call(args, cnt));
    }

    var id = 0;
    function LuaTable() {
        this.id = ++id;
        this.numeric = [];
        this.hash = {};
    };

    Object.defineProperty(LuaTable.prototype, "__luaType",  {value: "table",  enumerable: false});
    Object.defineProperty(LuaTable.prototype, "toString",  {value: function() {
        return makeString(this);
    },  enumerable: false});

    function makeTable(t, allowExpand /*, numeric ... */) {
        var out = new LuaTable();

        out.numeric = expand(Array.prototype.slice.call(arguments, 2), allowExpand);
        if ( !t ) return out;

        if ( isJSArray(t) ) {
            for ( var i = 0; i < t.length; ++i ) {
                var pair = t[i];
                var key = pair[0];
                var val = pair[1];
                if ( typeof key == "number" ) {
                    out.numeric[key - 1] = val;
                } else {
                    out.hash[key] = val;
                }
            }
        } else {
            for ( var k in t ) {
                out.hash[k] = t[k];
            }
        }

        return out;
    }

    function makeFunction(f) {
        f.__luaType = "function";
        return f;
    }

    function LuaArgList(v) {
        this.values = v;
    };
    Object.defineProperty(LuaArgList.prototype, "__luaType",  {value: "argList",  enumerable: false});
    
    // rawget and rawset helper functions
    function __ltRawSet (table, prop, value) {
        if ( typeof prop == "number") table.numeric[prop-1] = value;
        else table.hash[prop] = value;
    };
    
    function __ltRawGet (table, prop) {
        if ( typeof prop == "number" ) return table.numeric[prop-1];
        else return table.hash[prop];
    }
    
    function __arrRawSet (table, prop, value) {
        if ( typeof prop == "number") table[prop-1] = value;
        else table[prop] = value;
    };
    
    function __arrRawGet (table, prop) {
        if ( typeof prop == "number") return table[prop-1];
        return table[prop];
    };
    
    function __objRawSet (table, prop, value) {
        return table[prop] = value;
    };
    
    function __objRawGet (table, prop) {
        return table[prop];
    };
  
    function rawget(table, prop) {
        if ( table instanceof LuaTable ) {
            return __ltRawGet(table, prop);
        } else if ( isJSArray(table) ) {
            return __arrRawGet(table, prop);
        } else { // JS Object
            return __objRawGet(table, prop);
        }
    }

    function lookupMetaTable(table, entry) {
        if ( table && typeof table === "object" ) {
            if ( table.__metatable === undefined ) return null;

            var idx = rawget(table.__metatable, entry);
            if ( idx === null || idx === undefined ) return null;

            return idx;
        }

        return null;
    }

    function lookupMetaTableBin(a, b, entry) {
        var mt = lookupMetaTable(a, entry);
        if ( mt == null ) return lookupMetaTable(b, entry);
        return mt;
    }

    function index(table, prop, helper) {
        if ( table === null || table === undefined || typeof table !== "object" &&
                !(typeof table === "function" && table.hasOwnProperty('prototype'))) {
            if ( helper == undefined ) {
                throw "attempt to index a " + type(table) + " value";
            } else {
                var tt = type(table);
                if (tt === "string") return env.string[prop];
                throw "attempt to index '" + helper + "' (a " + tt + " value)";
            }
        }
        
        if ( prop === undefined || prop === null ) throw "table index is nil";

        var rget;
        if ( table instanceof LuaTable ) {
            rget = __ltRawGet;
        } else if ( isJSArray(table) ) {
            rget = __arrRawGet;
        } else { // JS Object
            rget = __objRawGet;
        }
        // main logic
        var val = rget(table, prop);
        if ( table.__metatable === undefined || (val !== null && val !== undefined) ) {
            return val;
        }
        
        var idxfx = lookupMetaTable(table, "__index");
        if ( idxfx == null ) return null;

        if ( typeof idxfx == "function" ) return oneValue(idxfx(table, prop));
        return index(idxfx, prop);
    }

    function indexAssign(table, prop, value, helper) {
        if ( table === null || table === undefined || typeof table !== "object" ) {
            if ( helper == undefined ) {
                throw "attempt to index a " + type(table) + " value";
            } else {
                throw "attempt to index '" + helper + "' (a " + type(table) + " value)";
            }
        }
        
        if ( prop === undefined || prop === null ) throw "table index is nil";

        var rset, rget;
        if ( table instanceof LuaTable ) {
            rset = __ltRawSet;
            rget = __ltRawGet;
        } else if ( isJSArray(table) ) {
            rset = __arrRawSet;
            rget = __arrRawGet;
        } else { // JS Object
            rset = __objRawSet;
            rget = __objRawGet;
        }
        // main logic
        if ( table.__metatable === undefined ) {
            return rset(table, prop, value);
        }

        var val = rget(table, prop)

        if ( val !== null && val !== undefined ) {
            return rset(table, prop, value);
        }

        var idx = table.__metatable.__newindex;
        if ( idx === null || idx === undefined ) {
            return rset(table, prop, value);
        }
        
        if ( typeof idx == "function" ) return idx(table, prop, value);
        else return indexAssign(idx, prop, value);
    }

    function oneValue(v) {
        if ( v instanceof LuaArgList ) return v.values[0];
        return v;
    }

    function makeMultiReturn() {
        return new LuaArgList(expand(arguments, true));
    }

    function expand(what, allowExpand) {
        if ( allowExpand === undefined ) allowExpand = false;

        var out = [];
        for ( var idx in what ) {
            var v = what[idx];
            if ( v instanceof LuaArgList ) {
                for ( var i in v.values ) {
                    out.push(v.values[i]);
                    if ( idx < what.length - 1 || !allowExpand) break;
                }
            } else {
                out.push(v);
            }
        }
        return out;
    }

    function expandArgList() {
        return expand(arguments, true);
    }

    function pcall(what /*, args... */ ) {
        try {
            var result = expand([what.apply(this, Array.prototype.slice.call(arguments, 1))], true);
            result.unshift(true);
            return makeMultiReturn.apply(__lua, result);
        } catch ( e ) {
            return makeMultiReturn(false, e);
        }
    }

    function isTable(a) { return a instanceof LuaTable; }

    function mark(o) {
        var seen = [];
        function domark(o) {
            if ( o in seen ) return;
            seen.push(o);
            if ( typeof o == "object" ) for ( var idx in o ) domark(o[idx]);
            else if ( typeof o == "function" ) o.__luaType = "function";
            
        }
        domark(o);
    }

    return {
        add, sub, mul, div, intdiv, mod, call, lte, lt, ne, gt, gte, eq, rawget, index,
        indexAssign, concat, makeTable, makeFunction, expandArgList, makeMultiReturn,
        count, and, or, expand, rest, pcall, type, pow, isTable, mark, forcomp,
        makeString, oneValue, lookupMetaTable, isJSArray
    };

})();

this.__lua = __lua;

env.tonumber = function (s, base) {
    if (base) return parseInt(s, base);
    if (isNaN(s)) {
        return parseFloat(s);
    } else {
        return s;
    }
}
env.tostring = __lua.makeString;

env.string = (function() {
    /**
     * string helpers
     */
    function checkString(s, num) {
        var type = typeof(s);
        if (type === "string") return s;
        if (type === 'number') return "" + s;
        throw(`bad argument #${num} to '${checkString.caller.name}' ` +
            `(string expected, got ${__lua.type(s)})`);
    }
    
    function makePattern(pat) {
        var classPat = /\[.*?[^%]\]/g;
        var inClass = [];
        for (var match of pat.matchAll(classPat)) {
            for (var k = match.index; k < match.index + match[0].length; k++) {
                inClass[k] = 1;
            }
        }
        pat = [...pat].map(x => (x === '-' ? '*?' : x)).join('');
        return pat.replace(/%(.)/g, '\\$1');
    }
    
    function uncheckedSub(s, i, j) {
        if ( i === undefined || i === null ) i = 1;
        if ( j === undefined || j === null ) j = s.length;
        if ( i < 0 ) i += (s.length+1);
        if ( j < 0 ) j += (s.length+1);
        
        return s.substring(i-1,j);
    }

    /**
     * methods
     */
    function byte(s, i, j) {
        s = checkString(s, 1);
        var chars = sub(s, i, j);
        var out = [];
        for ( var i = 0; i < chars.length; ++i ) out[i] = chars.charCodeAt(i);
        return __lua.makeMultiReturn.apply(__lua, out);
    }
    
    function char(/* arguments */) {
        var out = "";
        for ( var i = 0; i < arguments.length; ++i ) {
            out += String.fromCharCode(arguments[i]|0); 
        }
        return out;
    }
    
    function dump() {}
    
    function find(s, pat, init, plain) {
        s = checkString(s, 1);
        init = init && (init >= 0 ? init : init + s.length + 1);
        if (plain) {
            var start = s.indexOf(pat, init - 1) + 1;
            return start ? __lua.makeMultiReturn(start, start + pat.length) : null;
        } else {
            pat = new RegExp(makePattern(pat));
            var res;
            if (init) {
                s = uncheckedSub(s, init);
                res = pat.exec(s);
                return res && __lua.makeMultiReturn(res.index + init,
                        res.index + init + res[0].length - 1);
            } else {
                res = pat.exec(s);
                return res && __lua.makeMultiReturn(res.index + 1,
                        res.index + res[0].length);
            }
        }
    }
    
    function match(s, pat, init) {
        s = checkString(s, 1);
        init = init && (init >= 0 ? init : init + s.length + 1);
        s = uncheckedSub(s, init);
        pat = new RegExp(makePattern(pat));
        var res = pat.exec(s);
        return res && (res[1] !== undefined ? __lua.makeMultiReturn.apply(__lua, res.slice(1)) : res[0]);
    }

    function gmatch() {}
    function gsub() {}
    
    function len(s) {
        s = checkString(s, 1);
        return ("" + s).length;
    }
    function lower(s) {
        s = checkString(s, 1);
        return ("" + s).toLowerCase();
    }
    function upper(s) {
        s = checkString(s, 1);
        return ("" + s).toUpperCase();
    }
    
    function rep(s, n, sep) {
        s = checkString(s, 1);
        if (!n || n < 0) return "";
        if (sep) {
            return s + (sep + s).repeat(n - 1);
        } else {
            return s.repeat(n);
        }
    }
    
    function reverse(s) {
        s = checkString(s, 1);
        return ("" + s).split("").reverse().join("");
    }
    
    function sub(s, i, j) {
        s = checkString(s, 1);
        return uncheckedSub(s, i, j);
    }
    
    function format(format, etc) {
        var arg = arguments;
        var i = 1;
        return format.replace(/%([0-9.]+)?([%sfdgi])/g, function (m, w, t) {
            var r = null;
            if ( t == "%" ) return "%";
            else if ( t == "s") r = arg[i++];
            else if ( t == "d") r = parseInt(arg[i++]);
            else if ( t == "i") r = parseInt(arg[i++]);
            else if ( t == "f" ) r = arg[i++].toFixed(parseFloat(m[1]) || 6);
            else r = arg[i++]; 
            r = "" + r;
            if ( parseInt(w) ) {
                var extra = parseInt(w) - r.length;
                if ( extra > 0 ) r = new Array(extra).join(" ") + r;
            }
            return r;
        });
    }
    
    return {
        byte, char, dump, find, gmatch, gsub, len, lower, match, rep, reverse,
        sub, upper, format
    };
})();




env.table = {
    concat: function(table, sep, i, j) {
        sep = sep || "";
        if ( __lua.isTable(table) ) {
            return table.numeric.slice(i-1, j).join(sep);
        } else if ( __lua.isJSArray(table) ) {
            return table.slice(i-1, j).join(sep);
        }
    },
    insert: null,
    pack: function(/* arguments */) {
        var obj = {}
        for ( var i = 0; i < arguments.length; ++i) {
            obj[("" + (i + 1))] = arguments[i];
        }
        return __lua.makeTable(obj);
    },
    remove: null,
    sort: function(table, comp) {
        var tcomp;
        if (comp) {
            tcomp = function(a,b) { return comp(a,b) ? -1 : 1; };
        }
        if ( __lua.isTable(table) ) {
            table.numeric.sort(tcomp);
        } else if ( __lua.isJSArray(table) ) {
            table.sort(tcomp);
        }
    },
    unpack: function(table, i, j) {
        if ( i === undefined || i === null ) i = 1;
        if ( j === undefined || j === null ) j = __lua.count(table);

        var arr = [];
        if ( __lua.isTable(table) ) {
            for ( var a = i; a <= j; ++a ) {
                arr.push(table.numeric[a]);
            }
        } else if ( __lua.isJSArray(table) ) {
            for ( var a = i-1; a < j; ++a ) {
                arr.push(table[a]);
            }
        } else {
            for ( var a = i; a <= j; ++a ) {
                arr.push(table[a]);
            }
        }

        return __lua.makeMultiReturn.apply(__lua, arr);
    }
};

env.unpack = env.table.unpack;

env.os = {
    clock: null,
    date: null,
    difftime: function difftime(t1,t2) { return t2 - t1; },
    execute: null,
    exit: null,
    time: function time(table) {
        if ( table == null ) return new Date().getTime();
        throw "Time given a table not implemented yet.";
    }
};

env.io = {
    write: function() { env.print(...arguments); }
};

env.error = function error(s) { throw s; };

env.assert = function assert(what, msg, code) {
    if ( code === undefined ) {
        code = msg;
        msg = undefined;
    }

    if ( !!what ) return what;

    throw("Assertion Failed!! " + code);
};

env.type = function type(what) {
    return __lua.type(what);
};


env.pairs = function pairs(table) {

    var mtf = __lua.lookupMetaTable(table, "__pairs");
    if ( mtf !== null ) return mtf(table);

    var list = [];
    if ( __lua.isTable(table) ) {
        for ( var i = 0; i < table.numeric.length; ++i ) list.push([i + 1, i, table.numeric]);
        for ( var idx in table.hash ) list.push([idx, idx, table.hash]);
    } else if ( __lua.isJSArray(table) ) {
        for ( var i in table ) {
            list.push([isNaN(i) ? i : parseInt(i) + 1, i, table]);
        }
    } else {
        var keys = Object.keys(table);
        for ( var idx in keys ) list.push([keys[idx], keys[idx], table]);
    }

    return __lua.makeMultiReturn(function(handle, cur) {
        if ( handle.length < 1 ) return null;
        var nfo = handle.shift();
        var k = nfo[0];
        var v = nfo[2][nfo[1]];
        return __lua.makeMultiReturn(k,v);
    }, list, null);
};

env.ipairs = function ipairs(table) {

    var mtf = __lua.lookupMetaTable(table, "__ipairs");
    if ( mtf !== null ) return mtf(table);

    return __lua.makeMultiReturn(function ipairsitr(table, cur) {
        cur = cur + 1;
        if ( __lua.isJSArray(table) ) {
            if ( table.length < cur ) return null;
            return __lua.makeMultiReturn(cur, table[cur-1]);
        } else if ( __lua.isTable(table) ) {
            if ( table.numeric[cur-1] === null || table.numeric[cur-1] === undefined ) return null;
            return __lua.makeMultiReturn(cur, table.numeric[cur-1]);
        } else {
            return table[cur-1];
        }
    }, table, 0);
};

env.next = function next(table, cur) {
    if ( __lua.isTable(table) ) {
        var list = [];
        for ( var i = 0; i < table.numeric.length; ++i ) list.push([i + 1, table.numeric[i]]);
        for ( var tidx in table.hash ) list.push([tidx, table.hash[tidx]]);
        var trigger = false;
        for ( var i = 0; i < list.length; ++i ) {
            var itm = list[i];
            if ( cur === null || cur === undefined || trigger ) {
                if ( itm[1] !== undefined && itm[1] !== null )
                    return __lua.makeMultiReturn(itm[0], itm[1]);
            }
            if ( cur === itm[0] ) trigger = true;
        }

        return null;
    } else {
        var listk = Object.keys(table);
        var trigger = false;
        for ( var i = 0; i < listk.length; ++i ) {
            var idx = listk[i];
            var sidx = idx;
            if ( typeof sidx == "number" ) sidx = sidx = 1;
            if ( cur === null || cur === undefined || trigger ) return __lua.makeMultiReturn(idx, table[sidx]);
            if ( cur === idx ) trigger = true;
        }
        return null;
    }
};

env.print = function print() { console.log.apply(console, arguments); };
env.pcall = this.__lua.pcall;

env.rawequals = function rawequals(a,b) { return a == b; };
env.rawget = __lua.rawget;
env.rawset = function rawset(table, prop, val) { 
    if ( table instanceof LuaTable ) {
        if ( typeof prop == "number" ) return table.numeric[prop - 1] = val;
        else return table.hash[prop] = val;
    }
    return table[prop] = val; 
};

env.something = function something(table) {
    var array = [];
    var idx = 1;
    while ( table[idx] !== undefined ) {
        array.push(table[idx]);
        ++idx;
    }
    return __lua.makeMultiReturn.apply(__lua, array);
};
env.math = Object.assign(Math, {
    huge: Infinity,
    randomseed: () => {},
    ldexp: function (mantissa, exponent) {
        var steps = Math.min(3, Math.ceil(Math.abs(exponent) / 1023));
        var result = mantissa;
        for (var i = 0; i < steps; i++)
            result *= Math.pow(2, Math.floor((exponent + i) / steps));
        return result;
    }
});

env.setmetatable = function setmetatable(target, meta) {
    Object.defineProperty(target, "__metatable", {value: meta, enumerable: false, configurable: true });
    return target;
};

env.getmetatable = function getmetatable(taget, meta) {
    return taget.__metatable;
};

var reduce = function reduce(arr, op) {
    if ( arr.length < 1 ) return undefined;
    var val = arr[0];
    for ( var i = 1; i < arr.length; ++i ) {
        val = op(val, arr[i]);
    }
    return val;
};

env.bit32 = {
    band: function band() { return reduce(arguments, function(a,b) { return a & b; }); },
    bor: function bor() { return reduce(arguments, function(a,b) { return a | b; }); },
    bxor: function bxor() { return reduce(arguments, function(a,b) { return a ^ b; }); },

    rshift: function rshift(b, disp) { return b >> disp; }
};

env.require = function require(what) {
    if ( what == "bit" ) return env.bit32;
    if ( what == "bit32" ) return env.bit32;
    throw "Module " + what + " not found";
};

__lua.mark(env);
__lua.env = env;

if (typeof window === "undefined") {
    for ( var idx in env ) exports[idx] = env[idx];
}
