local x = {value = 5}

local mt = {
  __add = function (lhs, rhs) -- "add" event handler
    return lhs.value * rhs.value - 1 
  end
}

setmetatable(x, mt) -- use "mt" as the metatable for "x"

local y = x + x

print(y)

local func_example = setmetatable({}, {__index = function (t, k)
  return "key doesn't exist"
end})

local fallback_tbl = setmetatable({
  foo = "bar"
}, {__index=func_example})

local fallback_example = setmetatable({}, {__index=fallback_tbl})

print(func_example[1]) --> key doesn't exist
print(fallback_example.foo) --> bar
print(fallback_example[123]) --> 456
print(fallback_example[456]) --> key doesn't exist


