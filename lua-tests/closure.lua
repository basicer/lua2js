function muler(n)
	local amt = n+1
	return function(x) return x * amt end
end

local double = muler(1);
print(double(3))
print(double(4))


