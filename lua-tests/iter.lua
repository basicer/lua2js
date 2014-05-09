function iter()
    return function(c, x)
        if (x ~= nil) and (x < 10) then return x + 1, x - 1 end
        return nil
    end, 1, 0
    
end

for k,v in iter() do 
    print(k,v)
end 
