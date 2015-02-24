function values()
	return 1,2,"buckle my shoe"
end

function echo(...)
	print(...)
	return ...
end

print(values())
print(values(), 'and done')

print(pcall(echo,'presenting', values()))
print(pcall(echo,'presenting', values(), "act"))