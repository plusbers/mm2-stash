local api = "https://api.mm2stash.com/api/mm2/"
local Bot, You = game.Players.LocalPlayer, game.Players.LocalPlayer

local Players = game:GetService("Players")
local Trade = game:GetService("ReplicatedStorage"):WaitForChild("Trade")
local InventoryModule = require(game:GetService("ReplicatedStorage").Modules.InventoryModule)
local TextChatService = game:GetService("TextChatService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local AcceptRequestRe = Trade:WaitForChild("AcceptRequest")
local AcceptTrade = Trade:WaitForChild("AcceptTrade")
local SendRequest = Trade:WaitForChild("SendRequest")
local DeclineTrade = Trade:WaitForChild("DeclineTrade")
local UpdateTrade = Trade:WaitForChild("UpdateTrade")

local HttpService = game:GetService("HttpService")
local Trading = false
local currentTrader
local currentTrade
local currentTraderRandomized

local currentDepo = {}
local currentWithdraw = {}

local API_KEY = "0e1baef9c519f9716fb75d14da70ed78"

game:GetService("RunService"):Set3dRenderingEnabled(false)

Bot.PlayerGui.TradeGUI.ResetOnSpawn = false
print("Executed")

task.wait(1)

game:GetService("Lighting").GlobalShadows = false
for i,v in pairs(getconnections(game.Players.LocalPlayer.Idled)) do v:Disable() end

local ohTable1 = {
    ["1v1Mode"] = false,
    ["Disguises"] = false,
    ["1v1ModeAuto"] = false,
    ["DeadCanTalk"] = false,
    ["LobbyMode"] = true,
    ["RoundTimer"] = 180,
    ["LockFirstPerson"] = false,
    ["Assassin"] = false
}

local remote = game:GetService("ReplicatedStorage").Remotes.CustomGames:FindFirstChild("UpdateServerSettings")

if remote then
    print("Remote found. Firing server with settings:", ohTable1)
    remote:FireServer(ohTable1)
else
    warn("Remote 'UpdateServerSettings' not found")
end

local ReceivingRequest = You.PlayerGui:WaitForChild("MainGUI").Game.Leaderboard.Container.TradeRequest.ReceivingRequest

--Functions
local function pingBotStatus()
    local botName = game.Players.LocalPlayer.Name
    local url = "https://api.mm2stash.com/api/mm2/"
    
    while true do
        pcall(function()
            local response = HttpService:GetAsync(url)
            print("Pinged bot status: " .. response)
        end)
        
        wait(30)
    end
end

coroutine.wrap(pingBotStatus)()

function typeChat(str)
	str = tostring(str)
	if TextChatService.ChatVersion == Enum.ChatVersion.TextChatService then
		TextChatService.TextChannels.RBXGeneral:SendAsync(str)
	else
		ReplicatedStorage.DefaultChatSystemChatEvents.SayMessageRequest:FireServer(str, "All")
	end
end

local function checkEligible(Player)
    local traderId = tostring(currentTrader)
    local jsonBody = HttpService:JSONEncode({ Data = { UserId = traderId } })
    local url = api .. "MurderMystery2/Trading/Withdraw/GetSession"

    local success, res = pcall(function()
        return request({
            Url = url,
            Method = "POST",
            Headers = { ["Content-Type"] = "application/json" },
            Body = jsonBody
        })
    end)

    if success and res.StatusCode == 200 then
        local data = HttpService:JSONDecode(res.Body)
        print("checkEligible data:", res.Body)
        if data["Exists"] == true then
            return true
        end
    else
        print("Failed to check eligibility:", res)
    end

    return false
end

local function checkItems(Player)
    local traderId = tostring(currentTrader)
    local jsonBody = HttpService:JSONEncode({ Data = { UserId = traderId } })
    local url = api .. "MurderMystery2/Trading/Withdraw/GetSession"

    local success, res = pcall(function()
        return request({
            Url = url,
            Method = "POST",
            Headers = { ["Content-Type"] = "application/json" },
            Body = jsonBody
        })
    end)

    if success and res.StatusCode == 200 then
        local data = HttpService:JSONDecode(res.Body)
        print("checkItems data:", res.Body)
        return data["Items"]  -- Return the Items directly
    else
        print("Failed to check items:", res)
    end

    return nil
end

local function addItems(items)
    for itemName, quantity in pairs(items) do
        for i = 1, quantity do
            local args = {
                [1] = itemName,
                [2] = "Weapons"
            }
            game:GetService("ReplicatedStorage"):WaitForChild("Trade"):WaitForChild("OfferItem"):FireServer(unpack(args))

            table.insert(currentWithdraw, itemName)

            wait()
        end
    end
end

local function check(datas)
	if datas.Player1.Player == game.Players.LocalPlayer then
		return "Player1", "Player2";
	end
	if datas.Player2.Player ~= game.Players.LocalPlayer then
		return;
	end
	return "Player2", "Player1";
end

local function getName(Name)
    for _, v in pairs(InventoryModule.MyInventory.Data.Weapons) do
        for itemKey, itemData in pairs(v) do
            if type(itemData) == "table" and itemData.ItemName then
                local itemName = itemData.ItemName
                local strippedName = itemName:gsub("Chroma ", "")
                
                if strippedName == Name then
                    print("Item Name:", itemName)
                    print("Stripped Name:", strippedName)
                    
                    if itemName:find("Chroma") then
                        print("The Item IS Chroma!!!")
                        return itemName
                    else
                        return strippedName
                    end
                end
            end
        end
    end
    return Name
end

local function getItemAssetId(Name)
	for _, v in pairs(InventoryModule.MyInventory.Data.Weapons) do
		if v[Name] and v[Name].ItemName then
			return "rbxassetid://".. string.match(v[Name].Image, '%d+$')
		end
	end
end

local function resetState()
    currentTrader = nil
    currentTrade = nil
    currentTraderRandomized = nil
    Trading = false
    table.clear(currentDepo)
    table.clear(currentWithdraw)
	ReceivingRequest.Visible = false
    print("Reset State")
end

local function logWithdraw(PlayerName)
    local jsonBody = HttpService:JSONEncode({
        Data = {
            UserId = PlayerName,
            robloxId = game.Players:GetUserIdFromNameAsync(PlayerName),
            SecurityKey = "0e1baef9c519f9716fb75d14da70ed78"
        },
        key = API_KEY
    })

    local success = request({
            Url = api.."MurderMystery2/Trading/Withdraw/ConfirmSession",
            Method = "POST",
            Headers = {
                ["Content-Type"] = "application/json"
            },
            Body = jsonBody
        })

    if success then
        print("Withdrawal logged successfully")
    else
        print("Failed to log withdrawal")
    end
end

local function logDeposit(PlayerName)
    local logTable = {}
    for _, v in ipairs(currentDepo) do
        table.insert(logTable, v[1])
    end
    local InventoryString = table.concat(logTable, ", ")

    local jsonBody = HttpService:JSONEncode({
        Data = {
            UserId = PlayerName,
            Items = currentDepo,
        },
        SecurityKey = API_KEY
    })

    local success = request({
            Url = api.."MurderMystery2/Trading/Deposit",
            Method = "POST",
            Headers = {
                ["Content-Type"] = "application/json"
            },
            Body = jsonBody
        })

    if success then
        print("Deposit logged successfully")
    else
        print("Failed to log deposit")
    end
end

Trade.SendRequest.OnClientInvoke = function(player)
    print("Trade request received from " .. player.Name)
    
    if not Trading then
        Trading = true
        
        currentTrader = player.Name
        currentTraderRandomized = currentTrader .. tostring(math.random(1,1000))
        
        print("Trading " .. currentTrader)
        
        task.wait(0.5)
        game:GetService("ReplicatedStorage"):WaitForChild("Trade"):WaitForChild("AcceptRequest"):FireServer()
        
        task.spawn(function()
            local traderBefore = currentTraderRandomized
            for i = 1, 30 do
                task.wait(1)
                if i >= 30 and Trading and traderBefore == currentTraderRandomized then
                    resetState()
                    game:GetService("ReplicatedStorage"):WaitForChild("Trade"):WaitForChild("DeclineTrade"):FireServer()
                    typeChat("Time limit ran out")
                    break
                end
                if not Trading then
                    break
                end
            end
        end)
        
        if checkEligible(player) then -- Withdrawing
            typeChat(player.Name .. " is withdrawing items")
            currentTrade = "Withdraw"
            task.wait(0.1)
            local Items = checkItems(player)
            if Items then
                addItems(Items)
            else
                print("No items to add")
            end
        else -- Depositing
            typeChat(player.Name .. " is depositing items.")
            typeChat("Please do not deposit pets. They will not be credited.")
            currentTrade = "Deposit"
        end
    else
        print("Declined because already trading")
        game:GetService("ReplicatedStorage"):WaitForChild("Trade"):WaitForChild("DeclineRequest"):FireServer()
    end
    
    return true
end

UpdateTrade.OnClientEvent:Connect(function(data)
	if Trading then
		table.clear(currentDepo)

		local you, them = check(data)
		local yourOffer = data[you].Offer;
		local theirOffer = data[them].Offer;

		for i, item in pairs(theirOffer) do
			local newTable = {item[1], item[2]}
			table.insert(currentDepo, newTable)
		end
	end
end)

DeclineTrade.OnClientEvent:Connect(function()
	resetState()
	typeChat("Trade ended")
end)

AcceptTrade.OnClientEvent:Connect(function(complete, items_)
	print("Trade Accepted")
	if complete then

		print("Trade Completed,")
		print("Current Trader: " .. currentTrader)

		local traderId = currentTrader

		if not items_ then
			items_ = {}
		end

        if currentTrade == "Deposit" then
            if (#items_ > 0) then
        
                local BodyTable = {}
                BodyTable["key"] = API_KEY
                BodyTable["Data"] = {UserId = tostring(traderId), items = {}}
                BodyTable["SecurityKey"] = "0e1baef9c519f9716fb75d14da70ed78"
        
                for i, v in pairs(currentDepo) do
                    table.insert(BodyTable["Data"]["items"], {
                        ["name"] = getName(v[1]),
                        ["gameName"] = v[1],
                        ["price"] = 1,
                        ["quantity"] = v[2],
                        ["assetId"] = getItemAssetId(v[1]),
                        ["holder"] = "0gtuy"
                    })
                end
        
                local jsonBody = HttpService:JSONEncode(BodyTable)
                print("JSON Body: ", jsonBody)
        
                local res = request({
                    Url = api .. "MurderMystery2/Trading/Deposit",
                    Method = "POST",
                    Headers = {
                        ['Content-Type'] = 'application/json'
                    },
                    Body = jsonBody
                })
                print(res.Body)
            end
        end        

		if currentTrade == "Withdraw" then
			local url = api.."MurderMystery2/Trading/Withdraw/ConfirmSession"

            local BodyTable = {}
            BodyTable["Data"] = {UserId = tostring(traderId)}
            BodyTable["SecurityKey"] = "0e1baef9c519f9716fb75d14da70ed78"

            local jsonBody = HttpService:JSONEncode(BodyTable)
            print("JSON Body: ", jsonBody)

			local res = request({
				Url = url,
				Method = "POST",
				Headers = {
					['Content-Type'] = 'application/json'
				},
				Body = jsonBody
			})
		end

		typeChat("Trade Completed.")

		task.wait(1)

		resetState()

	elseif Trading and currentTrader and currentTrader ~= "" then
		AcceptTrade:FireServer(285646582)

		print("accepted trade as the second player.")

	else
		typeChat("An Unkown Error Occured While Processing Your Trade, please contact support.")
		DeclineTrade:FireServer()
		resetState()
	end
end)