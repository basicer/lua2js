-- bisect.lua
-- bisection method for solving non-linear equations

-- With Parens Added =/
-- Global variables made local
-- Trim function added for rounding

local delta=1e-6	-- tolerance
local n

function trim(x)
	return ( math.floor(x * 1000000) ) / 1000000.0
end

function bisect(f,a,b,fa,fb)
 local c=(a+b)/2
 print(n," c=",trim(c)," a=",trim(a)," b=",trim(b),"\n")
 if (c==a) or (c==b) or ((math.abs(a-b)) < delta) then return c,b-a end
 n=n+1
 local fc=f(c)
 if (fa*fc)<0 then return bisect(f,a,c,fa,fc) else return bisect(f,c,b,fc,fb) end
end

-- find root of f in the inverval [a,b]. needs f(a)*f(b)<0
function solve(f,a,b)
 n=0
 local z,e=bisect(f,a,b,f(a),f(b))
 print(n,trim(z),trim(e),trim(f(z)))
end

-- our function
function f(x)
 return ((x*x*x)-x)-1
end

-- find zero in [1,2]
solve(f,1,2)
