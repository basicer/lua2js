var env = {};
var __lua = (function() {

	// Yoinked from underscore.
	var isJSArray = Array.isArray || function(obj) { return toString.call(obj) === '[object Array]'; };

	function type(what) {
		if ( what === null || what === undefined ) return "nil";
		if ( isNaN(what) ) return "number";
		var t = typeof what;
		if ( t == "object" ) return "table";
		return t;
	}

	function numberForArith(n) {
		if ( type(n) == "number" ) return n;
		else if ( typeof n == "string" ) {
			n = parseInt(n);
		} else {
			n = NaN;
		}

		if ( isNaN(n) ) throw "attempt to perform arithmetic on a " +  type(n) + " value";
		return n;
	}

	function add(a,b) {
		
		var mtf = lookupMetaTableBin(a, b, "__add");
		if ( mtf !== null ) return mtf(a,b);

		return numberForArith(a) + numberForArith(b); 
	}

	function sub(a,b) { 

		var mtf = lookupMetaTableBin(a, b, "__sub");
		if ( mtf !== null ) return mtf(a,b);

		return numberForArith(a) - numberForArith(b);
	}

	function mul(a,b) { 

		var mtf = lookupMetaTableBin(a, b, "__mul");
		if ( mtf !== null ) return mtf(a,b);

		return numberForArith(a) * numberForArith(b);

	}

	function pow(a,b) { return Math.pow(numberForArith(a),numberForArith(b)); }

	function concat(a,b) { 
		var mtf = lookupMetaTableBin(a, b, "__concat");
		if ( mtf !== null ) return mtf(a,b);

		return "" + a + b; 
	}

	function lte(a,b) { 
		var mtf = lookupMetaTableBin(a, b, "__le");
		if ( mtf !== null ) return mtf(a,b);

		return a <= b; 
	}

	function lt(a,b) {
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
		if ( a === null || a === undefined ) {
			return ( b === null || b === undefined );
		}
		if ( a === b ) return true;
		return false;
	}
	
	function ne(a,b) { return !eq(a,b); }

	function count(a) { 
		if ( a instanceof LuaTable ) {
			var count = 0;
			while ( a.numeric[count] !== undefined ) ++count;
			return count;
		}
		return a.length;
	}

	function and(a,b) { return a && b; }
	function or(a,b) { return a || b; }

	function div(a,b) { return a / b; }

	function call(flags, what, that, helper /*, args... */ ) {
		var injectSelf = !!(flags & 1); 
		var detectLua = !!(flags & 2); 

		if ( what === null || what === undefined ) {
			if ( helper === undefined ) throw "attempt to call a " + type(what) + " value";
			else throw "attempt to call '" + helper + "' (a " + type(what) + " value)"; 
		}

		var args = expand(Array.prototype.slice.call(arguments, 4));

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
		var out = Object.create(LuaReturnValues.prototype, {});
		out.values = Array.prototype.slice.call(args, cnt);
		return out;
	}

	function LuaTable() {
		this.numeric = [];
		this.hash = {};
	};

	Object.defineProperty(LuaTable.prototype, "__luaType",  {value: "table",  enumerable: false});

	function makeTable(t, allowExpand /*, numeric ... */) {
		var out = new LuaTable();
		for ( var k in t ) {
			out.hash[k] = t[k];
		}

		out.numeric = expand(Array.prototype.slice.call(arguments, 2), allowExpand);

		return out;
	}

	function makeFunction(f) {
		f.__luaType = "function";
		return f;
	}

	function LuaReturnValues(v) {
		this.values = v;
	};
	Object.defineProperty(LuaReturnValues.prototype, "__luaType",  {value: "returnValues",  enumerable: false});

	function lookupMetaTable(table, entry) {
		if ( table instanceof LuaTable ) {
			if ( table.__metatable === undefined ) return null;

			var idx = table.__metatable.hash[entry];
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
		if ( table === null || table === undefined || typeof table == "number" ) {
			if ( helper == undefined ) {
				throw "attempt to index a " + type(table) + " value";
			} else {
				throw "attempt to index '" + helper + "' (a " + type(table) + " value)";
			}
		} else if ( table instanceof LuaTable ) {
			var val;
			if ( typeof prop == "number") val = table.numeric[prop-1];
			else val = table.hash[prop];

			if ( val !== null & val !== undefined ) return val;

			var idx = lookupMetaTable(table, "__index");
			if ( idx == null ) return null;

			if ( typeof idx == "function" ) return oneValue(idx(table, prop));
			return index(idx, prop);
		} else if ( isJSArray(table) ) {
			return table[prop - 1];
		} else if ( typeof table == "string" ) {
			return this.string[prop];
		} else {
			return table[prop];
		}
	}

	function indexAssign(table, prop, value, helper) {

		if ( table === null || table === undefined || typeof table == "number" ) {
			if ( helper == undefined ) {
				throw "attempt to index a " + type(table) + " value";
			} else {
				throw "attempt to index '" + helper + "' (a " + type(table) + " value)";
			}
		}

		if ( table instanceof LuaTable ) {
			var val;

			if ( prop === undefined || prop === null ) throw "table index is nil";

			if ( typeof prop == "number" ) val = table.numeric[prop-1];
			else val = table.hash[prop];

			if ( val !== null & val !== undefined ) {
				if ( typeof prop == "number") table.numeric[prop-1] = value;
				else table.hash[prop] = value;
				return true;
			}

			if ( table.__metatable === undefined ) {
				if ( typeof prop == "number") table.numeric[prop-1] = value;
				else table.hash[prop] = value;
				return true;
			}



			var idx = table.__metatable.__newindex;
			if ( idx === null || idx === undefined ) {
				if ( typeof pop == "number") table.numeric[prop] = value;
				else table.hash[prop] = value;
				return true;	
			}

			if ( typeof idx == "function" ) idx(table, prop, value);
			else indexAssign(idx, prop, value);

			return true;


		} else if ( typeof table == "string" ) { 
			throw "attempt to index string value"
		} else if ( isJSArray(table) ) {
			table[prop-1] = value;
			return true;
		} else {
			table[prop] = value;
			return true;
		}
	}

	function oneValue(v) {
		if ( v instanceof LuaReturnValues ) return v.values[0];
		return v;
	}

	function makeMultiReturn() {
		return new LuaReturnValues(expand(arguments));
	}

	function expand(what, allowExpand) {
		if ( allowExpand === undefined ) allowExpand = false;

		var out = [];
		for ( var idx in what ) {
			var v = what[idx];
			if ( v instanceof LuaReturnValues ) {
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

	function expandReturnValues() {
		return expand(arguments, true);
	}

	function pcall(what /*, args... */ ) {
		try {
			var result = expand([what.apply(this, Array.prototype.slice.call(arguments, 1))]);
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
		add: add,
		sub: sub,
		mul: mul,
		div: div,
		call: call,
		lte: lte,
		lt: lt,
		ne: ne,
		gt: gt,
		gte: gte,
		eq: eq,
		index: index,
		indexAssign: indexAssign,
		concat: concat,
		makeTable: makeTable,
		makeFunction: makeFunction,
		expandReturnValues: expandReturnValues,
		makeMultiReturn: makeMultiReturn,
		count: count,
		and: and,
		or: or,
		expand: expand,
		rest: rest,
		pcall: pcall,
		type: type,
		pow: pow,
		isTable: isTable,
		mark: mark,
		forcomp: forcomp
	}


})();


this.__lua = __lua;

env.string = {
	byte: function byte() { },
	char: function char(/* arguments */) {
		var out = "";
		for ( var i = 0; i < arguments.length; ++i ) {
			out += String.fromCharCode(arguments[i]|0); 
		}
		return out;

	},
	dump: null,
	find: null,
	format: null,
	gmatch: null,
	gsub: null,
	len: function len(s) { return ("" + s).length; },
	lower: function lower(s) { return ("" + s).toLowerCase() },
	match: null,
	reverse: function(s) {
		return ("" + s).split("").reverse().join("");
	},
	sub: function(s, i, j) {
		if ( j === undefined || n === null ) j = s.length;
		i = i % string.length;
		j = j % string.length;

		return ("" + s).substring(i,j);

	},
	upper: function lower(s) { return ("" + s).toUpperCase(); }
}

env.table = {
	concat: null,
	insert: null,
	pack: function(/* arguments */) {
		var obj = {}
		for ( var i = 0; i < arguments.length; ++i) {
			obj[("" + (i + 1))] = arguments[i];
		}
		return __lua.makeTable(obj);
	},
	remove: null,
	sort: function sort(table) { return table; },
	unpack: function(table,i,j) {
		if ( i === undefined || i === null ) i = 1;
		if ( j === undefined || j === null ) j = __lua.count(table);

		var arr = [];
		if ( __lua.isTable(table) ) {
			for ( var a = i; a <= j; ++a ) {
				arr.push(table.numeric[a]);
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

env.tonumber = function(n) {
	return parseInt(n);
}

env.tostring = function(n) {
	return "" + n;
}

env.os = {
	clock: null,
	date: null,
	difftime: function difftime(t1,t2) { return t2 - t1; },
	execute: null,
	exit: null,
	time: function time(table) {
		if ( table == null ) return new Date().getTime();
		throw "Time given a table not implemented yet."
	}
}

env.io = {
	write: function() { env.print(arguments); }
}

env.error = function error(s) { throw s; }

env.assert = function assert(what, msg) {
	if ( !!!what ) console.log("Assertion Failed!", msg);
	else ( console.log("Assert Passed!" , msg));
}

env.type = function type(what) {
	return __lua.type(what);
}


env.pairs = function pairs(table) {
	var list = [];
	if ( __lua.isTable(table) ) {
		for ( var i = 0; i < table.numeric.length; ++i ) list.push([i + 1, i, table.numeric]);
		for ( var idx in table.hash ) list.push([idx, idx, table.hash]);
	} else {
		var keys = Object.keys(table);
		for ( var idx in keys ) list.push([keys[idx], keys[idx], table])
	}

	return __lua.makeMultiReturn(function(handle, cur) {
		if ( handle.length < 1 ) return null;
		var nfo = handle.shift();
		var k = nfo[0];
		var v = nfo[2][nfo[1]];
		return __lua.makeMultiReturn(k,v);
	}, list, null);
}

env.ipairs = function ipairs(table) {
	return __lua.makeMultiReturn(function ipairsitr(table, cur) {
		cur = cur + 1;
		if ( __lua.isTable(table) ) {
			if ( table.numeric[cur-1] === null || table.numeric[cur-1] === undefined ) return null;
			return __lua.makeMultiReturn(cur, table.numeric[cur-1]);
		} else {
			return table[cur-1];
		}
	}, table, null);
}

env.next = function next(table, cur) {
	if ( __lua.isTable(table) ) {
		var list = [];
		for ( var i = 0; i < table.numeric.length; ++i ) list.push([i + 1, table.numeric[i]]);
		for ( var idx in table.hash ) list.push([idx, table.hash[idx]]);
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
		var list = Object.keys(table);
		var trigger = false;
		for ( var i = 0; i < list.length; ++i ) {
			var idx = list[i];
			var sidx = idx;
			if ( typeof sidx == "number" ) sidx = sidx = 1;
			if ( cur === null || cur === undefined || trigger ) return __lua.makeMultiReturn(idx, table[sidx]);
			if ( cur === idx ) trigger = true;
		}
		return null;
	}
}

env.print = function print() { console.log.apply(console, arguments); }
env.pcall = this.__lua.pcall;

env.rawequals = function rawequals(a,b) { return a == b; }
env.rawget = function rawget(table, prop) { 
	if ( table instanceof LuaTable ) {
		if ( typeof prop == "number" ) return table.numeric[prop - 1];
		else return table.hash[prop];
	}
	return table[prop]; 
}
env.rawset = function rawset(table, prop, val) { 
	if ( table instanceof LuaTable ) {
		if ( typeof prop == "number" ) return table.numeric[prop - 1] = val;
		else return table.hash[prop] = val;
	}
	return table[prop] = val; 
}

env.something = function something(table) {
	var array = [];
	var idx = 1;
	while ( table[idx] !== undefined ) {
		array.push(table[idx]);
		++idx;
	}
	return __lua.makeMultiReturn.apply(__lua, array);
}
env.math = Math;

env.setmetatable = function setmetatable(target, meta) {

	Object.defineProperty(target, "__metatable", {value: meta, enumerable: false, configurable: true });
	return target;
}

env.getmetatable = function getmetatable(taget, meta) {
	return taget.__metatable;
}



__lua.mark(env);
__lua.env = env;
for ( var idx in env ) this[idx] = env[idx];

