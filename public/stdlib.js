this.__lua = (function() {

	function add(a,b) { return a + b; }

	function sub(a,b) { return a - b; }

	function mul(a,b) { return a * b; }

	function exp(a,b) { return Math.pow(a,b); }

	function concat(a,b) { return "" + a + b; }

	function lte(a,b) { return a <= b; }
	function lt(a,b) { return a < b; }

	function ne(a,b) { return a !== b; }
	function eq(a,b) { return a === b; }

	function count(a) { return a.length; }

	function and(a,b) { return a && b; }
	function or(a,b) { return a || b; }

	function div(a,b) { return a / b; }

	function call(what /*, args... */ ) {


		return what.apply(null, expand(Array.prototype.slice.call(arguments, 1)));
	}

	function LuaTable() {
		
	};

	Object.defineProperty(LuaTable.prototype, "__luaType",  {value: "table",  enumerable: false});

	function makeTable(t) {
		var out = Object.create(LuaTable.prototype, {});
		for ( var k in t ) {
			out[k] = t[k];
		}
		return out;
	}

	function LuaReturnValues() {
		
	};
	Object.defineProperty(LuaReturnValues.prototype, "__luaType",  {value: "returnValues",  enumerable: false});

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
		eq: eq,
		concat: concat,
		makeTable: makeTable,
		expandReturnValues: expandReturnValues,
		makeMultiReturn: makeMultiReturn,
		count: count,
		and: and,
		or: or
	}


})();

function print() { console.log.apply(console, arguments); }

this.math = Math;
