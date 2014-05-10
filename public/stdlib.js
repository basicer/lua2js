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

	function count(a) { return a.length; }

	function and(a,b) { return a && b; }
	function or(a,b) { return a || b; }

	function div(a,b) { return a / b; }

	function call(flags, what, that /*, args... */ ) {
		var injectSelf = !!(flags & 1); 
		var args = expand(Array.prototype.slice.call(arguments, 3));

		if ( injectSelf ) args.unshift(that);
		return what.apply(that, args);
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

	function LuaReturnValues() {
		
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
		var out = Object.create(LuaReturnValues.prototype, {});
		out.values = Array.prototype.slice.call(arguments, 0);
		return out;
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
		expand: expand
	}


})();

this.error = function(s) { throw s; }

this.print = function() { console.log.apply(console, arguments); }
this.unpack = function(table) {
	var array = [];
	var idx = 1;
	while ( table[idx] !== undefined ) {
		array.push(table[idx]);
		++idx;
	}
	return __lua.makeMultiReturn.apply(__lua, array);
}
this.math = Math;

this.setmetatable = function(target, meta) {

	Object.defineProperty(target, "__metatable", {value: meta, enumerable: false, configurable: true });
}

this.getmetatable = function(taget, meta) {
	return taget.__metatable;
}
