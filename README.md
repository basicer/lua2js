# Lua2JS

A Lua parser and standard library targeting the [Mozilla Parser API][parserapi] AST.

[parserapi]: https://developer.mozilla.org/en-US/docs/SpiderMonkey/Parser_API

## Installing

Generated and minified sources are available on NPM

```sh
npm install lua2js
```

## Dependencies

- *Development*: peg.js
- *Runtime*: None =)

## Compatibility

Many lua programs run unmodified on lua2js.  See the `lua-tests` folder for some examples.

### JavaScript <-> Lua

When the `luaCalls` option is on, the arguments to javascript functions will be adjusted in the following ways:

- If the function was being called with : syntax, the variable that would be passed as `self` is used as `this`
- If a LuaTable is passed as an argument if the table only has numeric entries, an array will be passed.  If there are no numeric entire, a javascript object will be passed.  If both are present, the LuaTable object will be passed.
- If the last argument is a function that returned multiple values, they will be unpacked as normal.

### Lua Syntax Not Supported (Yet)

- `{[expression] = value}` table fields.
- Long form strings and comments will choke on internal `]]`'s even when using the `[==[` syntax.
- The `goto` statement and labels from lua 5.2 are unimplemented.
- The global environment doesn't exist in `_ENV` or `_G`.

### Lua Runtime Standard Library

- `pairs` `ipairs` `next` all work on both lua tables and javascript objects/arrays
- MetaTable and operator overloading work on LuaTables

### Lua Standard Library Holes

- `getmetatable` and `setmetatable` only work on LuaTable's
- `requires` and `package` interface tables are missing.
- The `debug` library is missing.
- The `coroutine` library is missing (and no runtime support for coroutines exists)`
- The `bit32` library from lua 5.2 is unimplemented.
- `string.format` is unimplemented.
- Pattern matching (`string.find`, `string.match`, `string.gsub`) is unimplemented.
- Code loading (`load`, `dostring`, `dofile`, etc...) is unimplemented.



## Parser Options

**Boolean Options**

- `decorateLuaObjects`: Mark lua functions so `__lua.call` can call them differently.  Also the `{}` syntax will create a LuaTable object instead of a normal javascript object.
- `encloseWithFunctions`: Protect variable scoping by creating functions and calling them.
- `forceVar`: Forbid generation of `let` statements to maintain ES5 compatability.
- `loose`: Try not to throw parse errors, and collect them in `ast.errors` instead.
- `luaCalls`: Rewrite function calls to use `__lua.call` to fix-up varrious lua<->javascript calling convention differences.
- `luaOperators`: Use functions in the standard library instead of conventional operators to improve Lua compatibility. (e.g. `a+b` becomes `__lua.add(a,b)`)
- `noSharedObjects`: Make sure all AST nodes are unique objects.  Can prevent bugs when performing transformations on the returned AST.
- `allowRegularFunctions`: Normally all functions are emitted in `something = function() { ... }` format.  Enable this to emit the more normal (but sometimes less compatible) `function something() { ... }`.

## Testing

You can run a suite of tests using the `npm test` command.  The tests require having `nodeunit` installed globally and a working Lua interpreter on your path.  The tests fall into three categories.

- **Simple Tests**: These are contained in an array toward the top of `test.js` and test simple lua programs without the Lua interpreter.
- `./lua-tests/`: A collection of various lua programs from around the internet.  These are interpreted in node and their output compared against the systems lua interpreter.
- `./lua-testmore/`: Selected tests from the lua-TestMore project.  Similar to the above.

## License

Code and documentation copyright 2014 Rob Blanckaert. Code released under [the MIT license](LICENSE).

