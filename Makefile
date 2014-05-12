all: public/piler.js public/piler.js.min public/stdlib.js.min

public/piler.js: lua.pegjs
	pegjs -e this.parser lua.pegjs  public/piler.js

public/piler.js.min: public/piler.js
	uglifyjs public/piler.js -o public/piler.js.min

public/stdlib.js.min: public/stdlib.js
	uglifyjs public/stdlib.js -o public/stdlib.js.min
