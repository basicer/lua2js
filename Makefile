all: public/piler.js public/piler.js.min public/stdlib.js.min
	cp public/piler.js dist/parser.js
	cp public/piler.min.js dist/parser.min.js
	cp public/stdlib{,.min}.js dist


public/piler.js: lua.pegjs
	pegjs -e this.parser lua.pegjs  public/piler.js

public/piler.js.min: public/piler.js
	uglifyjs public/piler.js -o public/piler.min.js

public/stdlib.js.min: public/stdlib.js
	uglifyjs public/stdlib.js -o public/stdlib.min.js
