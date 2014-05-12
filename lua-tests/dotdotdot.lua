function test(...) 
	return {...}
end 

x = test(1,2,3,4,5)
-- y = {unpack({1,2,3,4,5}),7,8,9,unpack({10,11,12,13,14})}

y = {1,2,3}

print("X")
for k,v in pairs(x) do print(k,v) end


print()
print("Y" )
for k,v in pairs(y) do print(k,v) end 
