


function go()
	local a
	print(a and a.b)
end

local none, err = pcall(go)

if err then print(err) else print("OK") end


