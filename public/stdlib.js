var env = this;
var __lua = (function() {

	function type(what) {
		if ( what === null || what === undefined ) return "nil";

		var t = typeof what;
		if ( t == "object" ) return "table";
		return t;
	}

	function numberForArith(n) {

		if ( typeof n == "number" ) return n;
		else if ( typeof n == "string" ) {
			n = parseInt(n);
		} else {
			n = NaN;
		}

		if ( isNaN(n) ) throw "attempt to perform arithmetic on a " +  type(n) + " value";
		return n;
	}

	function add(a,b) {
		
		var mtf = lookupMetaTable(a, "__add");
		if ( mtf !== null ) return mtf(a,b);

		return numberForArith(a) + numberForArith(b); 
	}

	function sub(a,b) { 

		var mtf = lookupMetaTable(a, "__sub");
		if ( mtf !== null ) return mtf(a,b);

		return numberForArith(a) - numberForArith(b);
	}

	function mul(a,b) { 

		var mtf = lookupMetaTable(a, "__mul");
		if ( mtf !== null ) return mtf(a,b);

		return numberForArith(a) * numberForArith(b);

	}

	function pow(a,b) { return Math.pow(numberForArith(a),numberForArith(b)); }

	function concat(a,b) { return "" + a + b; }

	function lte(a,b) { return a <= b; }
	function lt(a,b) { return a < b; }

	function gte(a,b) { return lte(b,a); }
	function gt(a,b) { return lt(b,a); }


	
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
			var count = 1;
			while ( a[("" + count)] !== undefined ) ++count;
			return count - 1;
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
		return what.apply(that, args);
	}

	function rest(args, cnt) {
		var out = Object.create(LuaReturnValues.prototype, {});
		out.values = Array.prototype.slice.call(args, cnt);
		return out;
	}

	function LuaTable() {
		
	};

	Object.defineProperty(LuaTable.prototype, "__luaType",  {value: "table",  enumerable: false});

	function makeTable(t, extra) {
		var out = new LuaTable();
		for ( var k in t ) {
			out[k] = t[k];
		}

		if ( extra !== undefined ) {
			var i = 1;
			while ( out[i] !== null && out[i] !== undefined ) ++i;
			if ( extra instanceof LuaReturnValues ) {
				for ( var j = 0; j < extra.values.length; ++j ) out[i+j] = extra.values[j];
			} else {
				out[i] = extra;
			}
		}

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

			var idx = table.__metatable[entry];
			if ( idx === null || idx === undefined ) return null;

			return idx;
		}

		return null;
	}

	function index(table, prop, helper) {
		if ( table === null || table === undefined || typeof table == "number" ) {
			if ( helper == undefined ) {
				throw "attempt to index a " + type(table) + " value";
			} else {
				throw "attempt to index '" + helper + "' (a " + type(table) + " value)";
			}
		}

		if ( table instanceof LuaTable ) {
			var val = table[prop];
			if ( val !== null & val !== undefined ) return val;

			var idx = lookupMetaTable(table, "__index");
			if ( idx == null ) return null;

			if ( typeof idx == "function" ) return oneValue(idx(table, prop));
			return index(idx, prop);
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
			var val = table[prop];
			if ( val !== null & val !== undefined ) {
				table[prop] = value;
				return value;
			}

			if ( table.__metatable === undefined ) {
				table[prop] = value;
				return value;
			}



			var idx = table.__metatable.__newindex;
			if ( idx === null || idx === undefined ) {
				table[prop] = value;
				return value;	
			}

			if ( typeof idx == "function" ) idx(table, prop, value);
			else indexAssign(idx, prop, value);


		} else if ( typeof table == "string" ) { 
			throw "attempt to index string value"
		} else {
			table[prop] = value;
			return value;
		}
	}

	function oneValue(v) {
		if ( v instanceof LuaReturnValues ) return v.values[0];
		return v;
	}

	function makeMultiReturn() {
		return new LuaReturnValues(expand(arguments));
	}

	function expand(what) {
		var out = [];
		for ( var idx in what ) {
			var v = what[idx];
			if ( v instanceof LuaReturnValues ) {
				for ( var i in v.values ) {
					out.push(v.values[i]);
					if ( idx < what.length - 1) break;
				}
			} else {
				out.push(v);
			}
		}
		return out;
	}

	function expandReturnValues() {
		return expand(arguments);
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
		pow: pow
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
		for ( var a = i; a <= j; ++a ) {
			arr.push(table[a]);
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
	return __lua.makeMultiReturn(env.next, table, null);
}

env.ipairs = function ipairs(table) {
	return __lua.makeMultiReturn(function ipairsitr(table, cur) {
		cur = cur + 1;
		if ( table[cur] === null || table[cur] === undefined ) return null;
		return __lua.makeMultiReturn(cur, table[cur]);
	}, table, null);
}

env.next = function next(table, cur) {
	var next = ( cur === null || cur === undefined );
	for ( var idx in table ) {
		var v = table[idx];
		if ( next ) return __lua.makeMultiReturn(idx, v);
		next = ( idx == cur );
	}
	return null;
}

env.print = function print() { console.log.apply(console, arguments); }
env.pcall = this.__lua.pcall;

env.rawequals = function rawequals(a,b) { return a == b; }
env.rawget = function rawget(table, prop) { return table[prop]; }
env.rawset = function rawset(table, prop, val) { return table[prop] = val; }

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
}

env.getmetatable = function getmetatable(taget, meta) {
	return taget.__metatable;
}


