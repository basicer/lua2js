function fastfib(n)
	fibs = {1,1}
    local i = 3
	while i < n do
	    local b = fib[i-2]
		fibs[i] = fib[i-1] + b
	end
	return fibs[n]
end
fastfib(10)
