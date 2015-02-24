local function b() return 1,2,3 end
local x, y, z = b(), b()

print(x,y,z)

x,y,w,z = b()

print(x,z)

x = b()
print(x)