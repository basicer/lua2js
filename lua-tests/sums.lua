function sum(n)
	local sum = 0
	for i=1,n do sum = sum + i end
	return sum
end

for i=10,100,7 do
	print("->", i, sum(i))
end
