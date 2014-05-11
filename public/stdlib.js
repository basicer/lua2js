this.__lua = (function() {

	function add(a,b) { return a + b; }

	function sub(a,b) { return a - b; }

	function mul(a,b) { return a * b; }

	function exp(a,b) { return Math.pow(a,b); }

	function concat(a,b) { return "" + a + b; }

	function lte(a,b) { return a <= b; }
	function lt(a,b) { return a < b; }

	function gte(a,b) { return a >= b; }
	function gt(a,b) { return a > b; }


	function ne(a,b) { return a !== b; }
	function eq(a,b) { return a === b; }

	function count(a) { 
		if ( a instanceof LuaTable ) {
			var count = 0;
			while ( a[count] !== undefined ) ++count;
			return count;
		}
		return a.length;
	}

	function and(a,b) { return a && b; }
	function or(a,b) { return a || b; }

	function div(a,b) { return a / b; }

	function call(flags, what, that /*, args... */ ) {
		var injectSelf = !!(flags & 1); 
		var args = expand(Array.prototype.slice.call(arguments, 3));

		if ( injectSelf ) args.unshift(that);
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

	function makeTable(t) {
		var out = new LuaTable();
		for ( var k in t ) {
			out[k] = t[k];
		}
		return out;
	}

	function LuaReturnValues(v) {
		this.values = v;
	};
	Object.defineProperty(LuaReturnValues.prototype, "__luaType",  {value: "returnValues",  enumerable: false});

	function index(table, prop) {
		if ( table instanceof LuaTable ) {
			var val = table[prop];
			if ( val !== null & val !== undefined ) return val;
			if ( table.__metatable === undefined ) return null;

			var idx = table.__metatable.__index;
			if ( idx === null || idx === undefined ) return null;

			if ( typeof idx == "function" ) return oneValue(idx(table, prop));
			return index(idx, prop);
		} else {
			return table[prop];
		}
	}

	function indexAssign(table, prop, value) {
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
		return new LuaReturnValues(Array.prototype.slice.call(arguments, 0));
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
		expandReturnValues: expandReturnValues,
		makeMultiReturn: makeMultiReturn,
		count: count,
		and: and,
		or: or,
		expand: expand,
		rest: rest,
		pcall: pcall
	}


})();

this.string = {
	byte: function byte() { },
	char: function char(/* arguments */) {

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

this.table = {
	concat: null,
	insert: null,
	pack: null,
	remove: null,
	sort: function sort(table) { return table; },
	unpack: null

}

this.os = {
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

this.io = {
	write: function() { print(arguments); }
}

this.error = function error(s) { throw s; }

this.assert = function assert(what, msg) {
	if ( !!!what ) console.log("Assertion Failed!", msg);
	else ( console.log("Assert Passed!" , msg));
}

this.type = function type(what) {
	var t = typeof what;
	if ( t == "object" ) return "table";
	return t;

}


this.pairs = function pairs(table) {
	return __lua.makeMultiReturn(this.next, table, null);
}

this.ipairs = function ipairs(table) {
	return __lua.makeMultiReturn(function ipairsitr(table, cur) {
		cur = cur + 1;
		if ( table[cur] === null || table[cur] === undefined ) return null;
		return __lua.makeMultiReturn(cur, table[cur]);
	}, table, null);
}

this.next = function next(table, cur) {
	var next = ( cur === null || cur === undefined );
	for ( var idx in table ) {
		var v = table[idx];
		if ( next ) return __lua.makeMultiReturn(idx, v);
		next = ( idx == cur );
	}
	return null;
}

this.print = function print() { console.log.apply(console, arguments); }
this.pcall = this.__lua.pcall;

this.rawequals = function rawequals(a,b) { return a == b; }
this.rawget = function rawget(table, val) { return table[va]; }

this.rawget = function rawget(table) {
	var array = [];
	var idx = 1;
	while ( table[idx] !== undefined ) {
		array.push(table[idx]);
		++idx;
	}
	return __lua.makeMultiReturn.apply(__lua, array);
}
this.math = Math;

this.setmetatable = function setmetatable(target, meta) {

	Object.defineProperty(target, "__metatable", {value: meta, enumerable: false, configurable: true });
}

this.getmetatable = function getmetatable(taget, meta) {
	return taget.__metatable;
}
