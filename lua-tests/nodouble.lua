function o(self) print("o", #self) end
function x() print("x") return {z=o} end

x():z(x)