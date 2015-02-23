-- Singleton
-- from luajs.org

do
  local instance
  function getInstance()
    instance = instance or {}
    instance.x = instance.x or 1
    return instance
  end
  -- TODO: var hoeisting strikes again!
  -- local instance = {x = 3}
end

print(getInstance().x)
getInstance().x = 6
print(getInstance().x)
