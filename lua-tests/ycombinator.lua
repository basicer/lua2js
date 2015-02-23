-- Y Combinator
-- from luajs.org

local function Y(f)
  local function _1(u)
    return u(u)
  end

  local function _2(x)
    return f(function(...)
      return x(x)(...)
    end)
  end

  return _1(_2)
end

local function F(f)
  return function(x)
    if x == 0 then
      return 1
    end
    return x * f (x - 1)
  end
end

local factorial = Y(F)
print(factorial(3))