__lua = (function() {

	function add(a,b) { return a + b; }

	function sub(a,b) { return a - b; }

	function mul(a,b) { return a * b; }

	function exp(a,b) { return Math.pow(a,b); }

	function concat(a,b) { return "" + a + b; }

	function lte(a,b) { return a <= b; }
	function lt(a,b) { return a < b; }

	function call(what /*, args... */ ) {
		return what.apply(null, Array.prototype.slice.call(arguments, 1));
	}

	function LuaTable() {
		
	};

	Object.defineProperty(LuaTable.prototype, "__luaType",  {value: "table",  enumerable: false});

	function makeTable(t) {
		var out = Object.create(LuaTable.prototype, {});
		for ( var k in t ) {
			out[k] = t;
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


	function expandReturnValues() {
		var out = [];
		for ( var idx in arguments ) {
			var v = arguments[idx];
			if ( v instanceof LuaReturnValues ) {
				for ( var i in v.values ) out.push(v.values[i]);
			} else {
				out.push(v);
			}
		}
		return out;
	}



	return {
		add: add,
		sub: sub,
		mul: mul,
		call: call,
		lte: lte,
		lt: lt,
		concat: concat,
		makeTable: makeTable,
		expandReturnValues: expandReturnValues,
		makeMultiReturn: makeMultiReturn
	}


})();

function print() { console.log.apply(console, arguments); }