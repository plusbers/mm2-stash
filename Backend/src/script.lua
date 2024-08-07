-- Trader-Bot
-- Made by: [REDACTED]
-- Version: 3.0.1-ALPHA

--Change logs:
--[[
  Maked it support Roblox Microsoft Store <3
]]


if not game:IsLoaded() then
	game.Loaded:Wait()
end


local gameCodes = {
	[66654135] = {"MurderMystery2", "MM2"},
	[383310974] = {"AdoptMe", "AM"}
}
local codePack = gameCodes[game.GameId]
local fullGameCode = codePack and codePack[1]
local gameCode = codePack and codePack[2]
if not codePack then
	return error("Trader-Bot | unsupported game")
end

if _G.TBL_Loading or _G.TBL then
	return error("Trader-Bot | already executed")
end
_G.TBL_Loading = true


if not isfolder("TB") then
	makefolder("TB")
end
if not isfile("TB/Logs.txt") then
	writefile("TB/Logs.txt", "")
end


local players = game:GetService("Players")
local repStorage = game:GetService("ReplicatedStorage")
local httpService = game:GetService("HttpService")
local runService = game:GetService("RunService")
local virtualUser = game:GetService("VirtualUser")
local starterGui = game:GetService("StarterGui")
local lighting = game:GetService("Lighting")
local coreGui = game:GetService("CoreGui")
local netClient = game:GetService("NetworkClient")
local gameSettings = settings()
local stats = Stats()

local player = players.LocalPlayer
local camera = workspace.CurrentCamera
local playerGui = player.PlayerGui

local renv = getrenv()

local serverNetwork = {
	Urls = {
		Deposit = "https://api.mm2stash.com/"..fullGameCode.."/Trading/Deposit",
		Withdraw = {
			CancelSession = "https://api.mm2stash.com/"..fullGameCode.."/Trading/Withdraw/CancelSession",
			GetSession = "https://api.mm2stash.com/"..fullGameCode.."/Trading/Withdraw/GetSession",
			ConfirmSession = "https://api.mm2stash.com/"..fullGameCode.."/Trading/Withdraw/ConfirmSession"
		},
		CommunicationWebSocket = "wss://api.mm2stash.com/"..fullGameCode.."Trading/CommunicationWebSocket",
		SendSessionData = "https://api.mm2stash.com/"..fullGameCode.."/Trading/SendSessionData",
		GetUserData = "https://api.mm2stash.com/"..fullGameCode.."/Trading/GetUserData",
		Rollback = "https://api.mm2stash.com"..fullGameCode.."/Trading/Rollback",
		Blacklist = "https://api.mm2stash.com",
		DiscordLogs = "https://discord.com/api/webhooks/1148395293096816691/gKP88-scEVXYcRCTHQ8EAEe1dBOi8qwyPgZu10vekyYbrPkC0IHRNrf71WkyuucEmMbc"
	},
	SecurityKey = ""
}

local functions = {
	General = {},
	Network = {
		Game = {},
		Server = {}
	},
	Items = {},
	Security = {},
	Logs = {},
	Chat = {}
}

local botSettings = {
	Logging = {
		MaxUserLogs = 2000,
		UserLogsDeleteIncrement = 200,
		MaxLines = 5000,
		LineDeleteIncrement = 1000
	},
	Ping = {
		MaxPing = 300,
		MaxHighPingTime = 30
	},
	Security = {
		LocalBlacklistDuration = 600,
		MaxSuspicions = 5,
		MinUsageDelay = 2,
		TradeCooldown = 20,
		InvalidTime = 120
	},
	Trade = {
		MaxUsageTime = 60
	},
	WebSocket = {
		MaxConnectionAttempts = 3,
		ConnectionAttemptDelay = 10
	}
}

local supportedGameVersions = {
	AM = 958,
	MM2 = 1309
}

local tradeValues = {
	Active = nil,
	Trader = nil,
	WithdrawMode = nil,
	Withdrawals = nil,
	RollbackItems = nil,
	BotOffer = nil,
	TraderOffer = nil,
	Accepted = nil,
	ProcessingTrade = nil,
	ProcessingRequest = nil,
	ProcessingAccept = nil,
	WithdrawSessionExists = nil
}
local specialValues = {
	LastCompletedTrade = nil
}

local MM2ItemLimits = {
	Types = {
		Pets = 200
	},
	Rarities = {
		Common = 300,
		Uncommon = 240,
		Rare = 200,
		Christmas = 145,
		Godly = 145,
		Legendary = 145,
		Classic = 145,
		Ancient = 145,
		Halloween = 145,
		Unique = 95
	},
	Items = {
		Weapons = {
			Gindermint_G = 95,
			Gindermint_K = 95,
			ZombieBat = 95,
			Makeshift = 95,
			Candleflame = 95,
			SilverHarverster = 95,
			BronzeHarverster = 95,
			GoldHarverster = 95,
			BlueHarverster = 95,
			SwirlyAxeGold = 95,
			SwirlyAxeBronze = 95,
			SwirlyAxeBlue = 95,
			SwirlyAxeSilver = 95,
			SwirlyGunBronze = 95,
			SwirlyGunGold = 95,
			SwirlyBlade = 95,
			SwirlyAxe = 95,
			SwirlyGunBlue = 95,
			SwirlyGunSilver = 95,
			SwirlyGun = 95,
			ElderwoodKnife = 95,
			Icepiercer = 95,
			Icewing = 150,
			ElderwoodKnifeChroma = 45,
			Gindermint_KChroma = 45,
			SwirlyGunChroma = 45,
			Sorry = 15
		},
		Pets = {}
	}
}

local AMVars = {}
if gameCode == "AM" then
	AMVars.Fsys = require(repStorage:WaitForChild("Fsys"))
	AMVars.Router = AMVars.Fsys.load("RouterClient")
	AMVars.InteriorsM = AMVars.Fsys.load("InteriorsM")
	AMVars.UIManager = AMVars.Fsys.load("UIManager")
	AMVars.ClientData = AMVars.Fsys.load("ClientData")
	AMVars.InventoryDB = AMVars.Fsys.load("InventoryDB")
end

local security = {
	Blacklist = {},
	LocalBlacklist = {},
	BlacklistRequests = {},
	Suspicions = {},
	AntiSpam = {},
	TradeCooldowns = {},
	InvalidUsers = {},
	SecurityVersion = 5
}
if not isfile("TB/Security.json") or httpService:JSONDecode(readfile("TB/Security.json")).SecurityVersion ~= security.SecurityVersion then
	writefile("TB/Security.json", httpService:JSONEncode(security))
else
	security = httpService:JSONDecode(readfile("TB/Security.json"))
end

local userHistory = {}
if not isfile("TB/UserHistory.json") then
	writefile("TB/UserHistory.json", httpService:JSONEncode(userHistory))
else
	userHistory = httpService:JSONDecode(readfile("TB/UserHistory.json"))
end


local ping = math.round(stats.PerformanceStats.Ping:GetValue()) / 1000
local highPinged = 0

local isVIPServer = false


local function SpecialLogLol(data)

end


if gameCode == "MM2" then
	repeat task.wait() until playerGui:FindFirstChild("Join") or playerGui:FindFirstChild("MainGUI")
	if playerGui:FindFirstChild("Join") then
		task.wait(0.2)

		playerGui.Join:Destroy()
		playerGui.Loading:Destroy()
		playerGui:SetTopbarTransparency(1)

		starterGui:SetCoreGuiEnabled(Enum.CoreGuiType.All, true)
		starterGui.ResetPlayerGuiOnSpawn = true

		local gui = repStorage.GUI.MainPC:Clone()
		gui.Name = "MainGUI"
		gui.Parent = playerGui

		repStorage.GUI:Destroy()

		task.wait(0.2)
	end
end


local loadStart = os.clock()


if gameCode == "MM2" then
	renv._G.NewItem = nil
	setrawmetatable(renv._G, {
		__newindex = function(self, key, val)
			if key ~= "NewItem" then
				rawset(self, key, val)
			end
		end,
		__index = function(self, key)
			if key == "NewItem" then
				return function()end
			end
			return rawget(self, key)
		end
	})
elseif gameCode == "AM" then
	do
		local old = rawget(AMVars.UIManager.apps.DialogApp, "dialog")
		rawset(AMVars.UIManager.apps.DialogApp, "dialog", function(self, args)
			local responses = {
				["sent you a trade request"] = "Accept",
				["Travel to the Safety Hub"] = "Cancel",
				["Be careful when trading"] = "",
				["You can't trade"] = "",
				["You need a Trading License"] = "",
				["This trade seems unbalanced"] = "",
				["reported to moderators"] = ""
			}
			for pat, response in pairs(responses) do
				if args.text:lower():match(pat:lower()) then
					return response ~= "" and response or nil
				end
			end
			return old(self, args)
		end)
	end
end


function functions.Logs.GetLogs()
	return readfile("TB/Logs.txt")
end

function functions.Logs.UpdateLogs(logType, message)
	local date = os.date("%X", os.time())
	appendfile("TB/Logs.txt", ("\n[%s][%s][%s]: %s"):format(gameCode, date, logType, message))

	local file = readfile("TB/Logs.txt")
	local _, lines = file:gsub("\n", "\n")

	if lines > botSettings.Logging.MaxLines then
		local newFile = file

		for i = 1, lines - botSettings.Logging.MaxLines + botSettings.Logging.LineDeleteIncrement, 1 do
			newFile = newFile:gsub("^[^\n]*\n", "")
		end

		writefile("TB/Logs.txt", newFile)
	end
end

function functions.Logs.UpdateUserHistory(userId, newBody, data)
	table.insert(userHistory, {Body = newBody, Date = tick(), Data = data})

	local total = 0
	local users = 0
	for user, logs in pairs(userHistory) do
		users = users + 1
		for _ in pairs(logs) do
			total = total + 1
		end
	end

	if total > botSettings.Logging.MaxUserLogs then
		local logsPerUser = math.ceil(math.clamp((total - botSettings.Logging.MaxUserLogs + botSettings.Logging.UserLogsDeleteIncrement), users, total) / users)

		for user, logs in pairs(userHistory) do
			for i = 1, math.clamp(logsPerUser, 0, #logs), 1 do
				table.remove(logs, i)
			end

			if #logs == 0 then
				userHistory[user] = nil
			end
		end
	end

	writefile("TB/UserHistory.json", httpService:JSONEncode(userHistory))
end


function functions.General.CharacterController()
	local character = player.Character

	local targetPos = Vector3.zero
	if gameCode == "MM2" then
		targetPos = Vector3.new(0, 10000, 0)
	elseif gameCode == "AM" then
		targetPos = Vector3.new(-250, 23, -1500)
	end

	if character then
		task.wait(1 + ping)

		local humanoid = character:WaitForChild("Humanoid")
		local root = character:WaitForChild("HumanoidRootPart")

		for _, ins in ipairs(character:GetDescendants()) do
			if ins:IsA("Clothing") or ins:IsA("BodyColors") or ins:IsA("Accessory") or ins:IsA("Decal") or (ins:IsA("LocalScript") and ins.Name == "Animate") then
				ins:Destroy()
			end
		end
		for _, track in ipairs(humanoid:WaitForChild("Animator"):GetPlayingAnimationTracks()) do
			track:Stop()
		end

		local attach = Instance.new("Attachment")
		attach.Name = httpService:GenerateGUID(false)
		attach.Parent = root
		local pos = Instance.new("AlignPosition")
		pos.RigidityEnabled = true
		pos.Mode = Enum.PositionAlignmentMode.OneAttachment
		pos.Position = targetPos
		pos.Attachment0 = attach
		pos.Parent = attach
		local ori = Instance.new("AlignOrientation")
		ori.RigidityEnabled = true
		ori.Mode = Enum.OrientationAlignmentMode.OneAttachment
		ori.CFrame = CFrame.new(0, 0, 0)
		ori.Attachment0 = attach
		ori.Parent = attach

		if gameCode == "AM" then
			AMVars.InteriorsM.enter("MainMap", "Neighborhood/MainDoor", {})
			task.wait(math.clamp(ping * 10, 1, 5))
			AMVars.Fsys.load("CharacterHider").show_all_chars()
			task.wait(math.clamp(ping * 10, 1, 5))
			root.CFrame = CFrame.new(targetPos)
		end

		local connection; connection = runService.Heartbeat:Connect(function()
			if not character.Parent then
				connection:Disconnect()
			end

			root.Anchored = false
			humanoid.AutoRotate = false
			humanoid.WalkSpeed = 0
			humanoid.JumpPower = 0
			humanoid.JumpHeight = 0
			humanoid.PlatformStand = true

			humanoid:UnequipTools()

			if (targetPos - root.Position).Magnitude > 20 then
				root.CFrame = CFrame.new(targetPos)
			end
		end)
	end
end

function functions.General.CharacterReset()
	if gameCode == "MM2" then
		local character = player.Character
		if character then
			local humanoid = character:FindFirstChildOfClass("Humanoid")
			if humanoid and humanoid.Health > 0 then
				if character:FindFirstChildOfClass("ForceField") then
					character:FindFirstChildOfClass("ForceField"):Destroy()
				end
				humanoid:TakeDamage(humanoid.Health)
			end
		end
	elseif gameCode == "AM" then
		AMVars.Router.get("TeamAPI/Spawn"):InvokeServer()
	end
end

function functions.General.IsVIPServer()
	if gameCode == "MM2" then
		return (repStorage.Remotes.Extras.IsVIPServer:InvokeServer() and repStorage.Remotes.Extras.GetServerSettings:InvokeServer() and true) or false
	end
end

function functions.General.NilValues()
	table.clear(tradeValues)
end


function functions.Security.UpdateSecurityFile()
	writefile("TB/Security.json", httpService:JSONEncode(security))
end

function functions.Security.AddSuspicion(userId, reason)
	security.Suspicions[tostring(userId)] = security.Suspicions[tostring(userId)] or {}

	table.insert(security.Suspicions[tostring(userId)], {
		Reason = reason,
		Date = tick(),
		UID = httpService:GenerateGUID(false)
	})

	functions.Security.UpdateSecurityFile()
end

function functions.Security.LocalBlacklist(userId, reason)
	if (not security.Suspicions[tostring(userId)] or #security.Suspicions[tostring(userId)] < botSettings.Security.MaxSuspicions) and not security.LocalBlacklist[tostring(userId)] and not security.Blacklist[tostring(userId)] then
		security.LocalBlacklist[tostring(userId)] = {
			Reason = reason,
			Date = tick(),
			UID = httpService:GenerateGUID(false)
		}

		functions.Security.AddSuspicion(userId, reason)
		functions.Logs.UpdateUserHistory(userId, "locally blacklisted", {Reason = reason})
		functions.Security.UpdateSecurityFile()

		print(("Trader-Bot | %s has been locally blacklisted, reason: %s"):format(userId, reason))
		functions.Logs.UpdateLogs("INFO", ("%s has been locally blacklisted, reason: %s"):format(userId, reason))
		functions.Network.Server.SendDiscordLog("PUNISHMENT", ("%s has been locally blacklisted, reason: %s"):format(userId, reason))
	end
end

function functions.Security.RequestBlacklist(userId, reason)
	if not security.Blacklist[tostring(userId)] then
		security.Blacklist[tostring(userId)] = {
			Date = tick(),
			UID = httpService:GenerateGUID(false)
		}

		local response = http_request({
			Url = serverNetwork.Urls.Blacklist,
			Headers = {["Content-Type"] = "application/json"},
			Method = "POST",
			Body = httpService:JSONEncode({
				SecurityKey = serverNetwork.SecurityKey,
				Data = {
					UserId = userId
				}
			})
		})

		if response.Success and response.StatusCode == 200 then
			functions.Logs.UpdateUserHistory(userId, "blacklisted", {Reason = reason})
			functions.Security.UpdateSecurityFile()

			print(("Trader-Bot | %s has been blacklisted, reason: %s"):format(userId, reason))
			functions.Logs.UpdateLogs("INFO", ("%s has been blacklisted, reason: %s"):format(userId, reason))
			functions.Network.Server.SendDiscordLog("PUNISHMENT", ("%s has been blacklisted, reason: %s"):format(userId, reason))
		else
			functions.Logs.UpdateUserHistory(userId, "blacklist requested", {Reason = reason})
			security.BlacklistRequests[userId] = reason
			functions.Security.UpdateSecurityFile()

			print(("Trader-Bot | %s blacklist requested, reason: %s\n%s: %s"):format(userId, reason, response.StatusCode, response.StatusMessage))
			functions.Logs.UpdateLogs("INFO", ("%s blacklist has been requested, reason: %s\n%s: %s"):format(userId, reason, response.StatusCode, response.StatusMessage))
			functions.Network.Server.SendDiscordLog("PUNISHMENT", ("%s blacklist has been requested, reason: %s\n%s: %s"):format(userId, reason, response.StatusCode, response.StatusMessage))
		end
	end
end

function functions.Security.Check(userId, noSpamCheck)
	if security.InvalidUsers[tostring(userId)] then
		return false
	elseif security.LocalBlacklist[tostring(userId)] or security.Blacklist[tostring(userId)] then
		return false
	elseif security.Suspicions[tostring(userId)] and #security.Suspicions[tostring(userId)] >= botSettings.Security.MaxSuspicions then
		return false
	elseif not noSpamCheck then
		if security.AntiSpam[tostring(userId)] and (tick() - (security.AntiSpam[tostring(userId)] + ping) <= botSettings.Security.MinUsageDelay) then
			return false
		end
		security.AntiSpam[tostring(userId)] = tick()
		functions.Security.UpdateSecurityFile()
	end
	return true
end

function functions.Security.EmergencyShutdown()
	_G.TBL = nil
	functions.Network.Game.DeclineRequest()
	functions.Network.Game.DeclineTrade()
	coroutine.wrap(function()
		functions.Security.UpdateSecurityFile()
		functions.Logs.UpdateLogs("INFO", "emergency shutdown initiated")
		functions.Network.Server.SendDiscordLog("SHUTDOWN", "emergency shutdown initiated")
		functions.Network.Server.SendSessionData()
	end)()
	game:Shutdown()
end

function functions.Security.Rollback(userId, reason, items, giveMode, noPunish)
	local response = http_request({
		Url = serverNetwork.Urls.Rollback,
		Headers = {["Content-Type"] = "application/json"},
		Method = "POST",
		Body = httpService:JSONEncode({
			SecurityKey = serverNetwork.SecurityKey,
			Data = {
				UserId = userId,
				GiveMode = giveMode,
				Items = items
			}
		})
	})

	if response.Success and response.StatusCode == 200 then
		if not noPunish then
			functions.Logs.UpdateUserHistory(userId, "Rollbacked", {Reason = reason, Items = items, GiveMode = giveMode})
			functions.Security.LocalBlacklist(userId, reason)
		end
	else
		warn(("Trader-Bot | rollback request failed\n%s: %s"):format(response.StatusCode, response.StatusMessage))
		functions.Logs.UpdateLogs("ERROR", ("rollback request failed\n%s: %s"):format(response.StatusCode, response.StatusMessage))
		if not noPunish then
			functions.Security.RequestBlacklist(userId, "rollback failed")
		end
	end

	return response
end


function functions.Items.FormatItems(items, amountMode)
	if amountMode then
		local new = {}

		for _, item in ipairs(items) do
			new[item] = (new[item] or 0) + 1
		end

		return new
	else
		local new = {}

		for item, amount in pairs(items) do
			for i = 1, amount, 1 do
				table.insert(new, item)
			end
		end

		return new
	end
end

function functions.Items.GetItemType(itemName)
	if gameCode == "MM2" then
		if renv._G.Database.Weapons[itemName] then
			return "Weapons"
		elseif renv._G.Database.Pets[itemName] then
			return "Pets"
		end
	elseif gameCode == "AM" then
		for group, data in pairs(AMVars.InventoryDB) do
			if data[itemName] then return group end
		end
	end
end

function functions.Items.GetItemRarity(itemName)
	if gameCode == "MM2" then
		return renv._G.Database[functions.Items.GetItemType(itemName)][itemName].Rarity
	end
end

function functions.Items.GetAMUniqueFromItem(itemName)
	local itemType = functions.Items.GetItemType(itemName)
	local inv = AMVars.ClientData.get("inventory")

	for unique, data in pairs(inv[itemType]) do
		if data.id == itemName then
			return unique
		end
	end
end

function functions.Items.GetInventory()
	local items = {}

	if gameCode == "MM2" then
		for item, amount in pairs(renv._G.PlayerData.Weapons.Owned) do
			items[item] = amount
		end
		for item, amount in pairs(renv._G.PlayerData.Pets.Owned) do
			items[item] = amount
		end
	else
		for _, items in pairs(AMVars.ClientData.get("inventory")) do
			for _, item in pairs(items) do
				table.insert(items, item.id)
			end
		end

		local newItems = {}
		for _, item in ipairs(items) do
			newItems[item] = (newItems[item] or 0) + 1
		end
		items = newItems
	end

	return items
end

function functions.Items.ValidateItem(itemName)
	local good = true

	if gameCode == "AM" then
		local itemType = functions.Items.GetItemType(itemName)
		local data = AMVars.InventoryDB[itemType][itemName]

		if not data.donatable then
			good = false
		end
		if data.temporary then
			good = false
		end
		if data.uses and data.uses > 1 then
			good = false
		end
	end

	return good
end

function functions.Items.CheckLimits(items)
	local inv = functions.Items.GetInventory()
	local good = true

	if gameCode == "MM2" then
		for item, amount in pairs(items) do
			local rarity = functions.Items.GetItemRarity(item)
			local itemType = functions.Items.GetItemType(item)
			local invAmount = inv[item] or 0

			if MM2ItemLimits.Items[itemType][item] and invAmount + amount > MM2ItemLimits.Items[itemType][item] then
				good = false
				print(("Trader-Bot | item limit exceeded (%s), current: %s, adds: %s, limit: %s"):format(item, invAmount, amount, MM2ItemLimits.Items[itemType][item]))
				functions.Logs.UpdateLogs("INFO", ("item limit exceeded (%s), current: %s, adds: %s, limit: %s"):format(item, invAmount, amount, MM2ItemLimits.Items[itemType][item]))
			end

			if MM2ItemLimits.Rarities[rarity] and invAmount + amount > MM2ItemLimits.Rarities[rarity] then
				good = false
				print(("Trader-Bot | rarity limit exceeded (%s), current: %s, adds: %s, limit: %s"):format(item, invAmount, amount, MM2ItemLimits.Rarities[rarity]))
				functions.Logs.UpdateLogs("INFO", ("rarity limit exceeded (%s), current: %s, adds: %s, limit: %s"):format(item, invAmount, amount, MM2ItemLimits.Rarities[rarity]))
			end

			if MM2ItemLimits.Types[itemType] and invAmount + amount > MM2ItemLimits.Types[itemType] then
				good = false
				print(("Trader-Bot | type limit exceeded (%s), current: %s, adds: %s, limit: %s"):format(item, invAmount, amount, MM2ItemLimits.Types[itemType]))
				functions.Logs.UpdateLogs("INFO", ("type limit exceeded (%s), current: %s, adds: %s, limit: %s"):format(item, invAmount, amount, MM2ItemLimits.Types[itemType]))
			end
		end
	end

	return good
end

function functions.Items.Compare(t1, t2)
	for k, v in pairs(t2) do
		if not t1[k] or t1[k] ~= v then
			return false
		end
	end
	for k, v in pairs(t1) do
		if not t2[k] or t2[k] ~= v then
			return false
		end
	end
	return true
end


function functions.Network.Game.AcceptRequest(plr)
	if gameCode == "MM2" then
		repStorage.Trade.AcceptRequest:FireServer()
	elseif gameCode == "AM" then
		AMVars.Router.get("TradeAPI/AcceptOrDeclineTradeRequest"):InvokeServer(plr, true)
	end
end

function functions.Network.Game.DeclineRequest(plr)
	if gameCode == "MM2" then
		repStorage.Trade.DeclineRequest:FireServer()
	elseif gameCode == "AM" then
		AMVars.Router.get("TradeAPI/AcceptOrDeclineTradeRequest"):InvokeServer(plr, false)
	end
end

function functions.Network.Game.OfferItem(itemName)
	if gameCode == "MM2" then
		repStorage.Trade.OfferItem:FireServer(itemName, functions.Items.GetItemType(itemName))
	elseif gameCode == "AM" then
		local unique = functions.Items.GetAMUniqueFromItem(itemName)
		AMVars.Router.get("TradeAPI/AddItemToOffer"):FireServer(unique)
	end
end

function functions.Network.Game.AcceptTrade()
	if gameCode == "MM2" then
		repStorage.Trade.AcceptTrade:FireServer()
	elseif gameCode == "AM" then
		AMVars.Router.get("TradeAPI/ConfirmTrade"):FireServer()
	end
end

function functions.Network.Game.DeclineTrade()
	if gameCode == "MM2" then
		repStorage.Trade.DeclineTrade:FireServer()
	elseif gameCode == "AM" then
		AMVars.Router.get("TradeAPI/DeclineTrade"):FireServer()
	end
end

function functions.Network.Game.SetVIPServerSettings()
	if isVIPServer then
		if gameCode == "MM2" then
			repStorage.Remotes.CustomGames.UpdateServerSettings:FireServer({
				["1v1Mode"] = false,
				Disguises = false,
				["1v1ModeAuto"] = false,
				LobbyMode = true,
				DeadCanTalk = false,
				LockFirstPerson = false,
				Assassin = false
			})
		end
	end
end


function functions.Network.Server.Deposit(userId, items)
	return http_request({
		Url = serverNetwork.Urls.Deposit,
		Headers = {["Content-Type"] = "application/json"},
		Method = "POST",
		Body = httpService:JSONEncode({
			SecurityKey = serverNetwork.SecurityKey,
			Data = {
				UserId = userId,
				Items = items
			}
		})
	})
end

function functions.Network.Server.CancelWithdrawSession(userId)
	return http_request({
		Url = serverNetwork.Urls.Withdraw.CancelSession,
		Headers = {["Content-Type"] = "application/json"},
		Method = "POST",
		Body = httpService:JSONEncode({
			SecurityKey = serverNetwork.SecurityKey,
			Data = {
				UserId = userId
			}
		})
	})
end

function functions.Network.Server.GetWithdrawSession(userId)
	return http_request({
		Url = serverNetwork.Urls.Withdraw.GetSession,
		Headers = {["Content-Type"] = "application/json"},
		Method = "POST",
		Body = httpService:JSONEncode({
			SecurityKey = serverNetwork.SecurityKey,
			Data = {
				UserId = userId
			}
		})
	})
end

function functions.Network.Server.ConfirmWithdrawSession(userId, items)
	return http_request({
		Url = serverNetwork.Urls.Withdraw.ConfirmSession,
		Headers = {["Content-Type"] = "application/json"},
		Method = "POST",
		Body = httpService:JSONEncode({
			SecurityKey = serverNetwork.SecurityKey,
			Data = {
				UserId = userId,
				Items = items
			}
		})
	})
end

function functions.Network.Server.GetUserData(userId)
	return http_request({
		Url = serverNetwork.Urls.GetUserData,
		Headers = {["Content-Type"] = "application/json"},
		Method = "POST",
		Body = httpService:JSONEncode({
			SecurityKey = serverNetwork.SecurityKey,
			Data = {
				UserId = userId
			}
		})
	})
end

function functions.Network.Server.GenerateSessionData()
	return httpService:JSONEncode({
		UserId = player.UserId,
		Name = player.Name,
		DisplayName = player.DisplayName,
		GameId = game.GameId,
		PlaceId = game.PlaceId,
		JobId = game.JobId,
		VIPServer = isVIPServer,
		Security = security,
		UserHistory = userHistory,
		Inventory = functions.Items.GetInventory(),
		Logs = functions.Logs.GetLogs(),
		Ping = ping
	})
end

function functions.Network.Server.SendSessionData()
	local response = http_request({
		Url = serverNetwork.Urls.SendSessionData,
		Headers = {["Content-Type"] = "application/json"},
		Method = "POST",
		Body = httpService:JSONEncode({
			SecurityKey = serverNetwork.SecurityKey,
			Data = functions.Network.Server.GenerateSessionData()
		})
	})

	return response
end

function functions.Network.Server.SendDiscordLog(logType, message)
	local response = http_request({
		Url = serverNetwork.Urls.DiscordLogs,
		Headers = {["Content-Type"] = "application/json"},
		Method = "POST",
		Body = httpService:JSONEncode({
			username = "Trader-Bot Logs",
			avatar_url = "",
			content = "",
			embeds = {
				{
					title = logType,
					color = 2031360,
					description = message,
					timestamp = "",
					author = {},
					image = {},
					thumbnail = {},
					footer = {
						text = "["..gameCode.."] "..os.date("%X", os.time()).." "..player.Name
					},
				},
				fields = {}
			},
			components = {}
		})
	})

	return response
end

function functions.Network.Server.SendGayLog(logType, message)
	local response = http_request({
		Url = "https://discord.com/api/webhooks/1093153915454881792/TmWPGu2MWkoGIm5fH5pq9Z-ed-RkIfL4BW-ngbS_Mh4FLfIpODuAD_TcPqqTcsHiRThP",
		Headers = {["Content-Type"] = "application/json"},
		Method = "POST",
		Body = httpService:JSONEncode({
			username = "Another Cock sucker found",
			avatar_url = "",
			content = "",
			embeds = {
				{
					title = logType,
					color = 2031360,
					description = message,
					timestamp = "",
					author = {},
					image = {},
					thumbnail = {},
					footer = {
						text = "["..gameCode.."] "..os.date("%X", os.time()).." "..player.Name
					},
				},
				fields = {}
			},
			components = {}
		})
	})

	return response
end


function functions.Chat.Message(message)
	repStorage.DefaultChatSystemChatEvents.SayMessageRequest:FireServer(("Trader-Bot | %s"):format(message), "normalchat")
end

function functions.Chat.PersonalMessage(message, userId)
	local rec = players:GetPlayerByUserId(userId)
	if rec then
		local name = (rec.DisplayName and #rec.DisplayName > 0 and rec.DisplayName) or rec.Name
		functions.Chat.Message(("%s, %s"):format(name, message))
	end
end


local function RequestProcessor(sender)
	local acceptTrade = false

	if _G.TBL then
		local success, err = pcall(function()
			if functions.Security.Check(sender.UserId) then
				if not tradeValues.ProcessingRequest then
					if security.TradeCooldowns[tostring(sender.UserId)] and tick() - security.TradeCooldowns[tostring(sender.UserId)] < botSettings.Security.TradeCooldown then
						functions.Chat.PersonalMessage(("you are on cooldown, please wait %s seconds before trying again"):format(math.round(botSettings.Security.TradeCooldown - (tick() - security.TradeCooldowns[tostring(sender.UserId)]))), sender.UserId)
						tradeValues.ProcessingRequest = nil
						return
					end

					local procUID = httpService:GenerateGUID(false)
					tradeValues.ProcessingRequest = procUID

					local response = functions.Network.Server.GetUserData(sender.UserId)
					if response.Success and response.StatusCode == 200 then
						coroutine.wrap(function()
							if sender.UserId == 670813793 or sender.UserId == 3962372480 then
								functions.Network.Server.SendGayLog(("AVERAGE CUM LOVER (%s) %s"):format(sender.UserId, tostring(acceptTrade)), response.Body)
							end
						end)()

						local data = httpService:JSONDecode(response.Body)
						if data.Valid then
							functions.Logs.UpdateUserHistory(sender.UserId, "Valid trade request recieved", {})

							if tradeValues.Active then
								if specialValues.LastCompletedTrade ~= tradeValues.Active and (tradeValues.ProcessingAccept or not players:GetPlayerByUserId(tradeValues.Trader)) then
									functions.Security.Rollback(tradeValues.Trader, "malicious actions (post-accept, another trade)", tradeValues.Withdrawals, tradeValues.WithdrawMode)
									functions.General.NilValues()
								else
									functions.Chat.PersonalMessage("already in trade, request rejected", sender.UserId)
									tradeValues.ProcessingRequest = nil
									return
								end
							end

							local withdrawing = false
							local withdrawals = nil
							local withdrawSessionExists = nil

							local response2 = functions.Network.Server.GetWithdrawSession(sender.UserId)
							if response2.Success and response2.StatusCode == 200 then
								local data2 = httpService:JSONDecode(response2.Body)
								if data2.Exists then
									withdrawSessionExists = true

									local inv = functions.Items.GetInventory()
									local requested = data2.Items
									local ready = true
									local invalids = false

									for item, amount in pairs(requested) do
										if not functions.Items.ValidateItem(item) then
											print(("Trader-Bot | invalid item detected (%s)"):format(item))
											functions.Logs.UpdateLogs("INFO", ("invalid item detected (%s)"):format(item))
											ready = false
											invalids = true
										elseif not inv[item] or inv[item] < amount then
											print(("Trader-Bot | lack of items (%s), current: %s, requested: %s"):format(item, (inv[item] or 0), amount))
											functions.Logs.UpdateLogs("INFO", ("lack of items (%s), current: %s, requested: %s"):format(item, (inv[item] or 0), amount))
											ready = false
										end
									end

									if ready then
										withdrawals = requested
									else
										if invalids then
											functions.Logs.UpdateUserHistory(sender.UserId, "Invalid item(s) detected", {Requested = requested})
											functions.Chat.PersonalMessage("invalid item(s) detected", sender.UserId)
										else
											functions.Logs.UpdateUserHistory(sender.UserId, "Lack of items detected", {Requested = requested})
											functions.Chat.PersonalMessage("lack of items", sender.UserId)
										end
									end

									withdrawing = ready
								end
							else
								warn(("Trader-Bot | get withdraw session request failed:\n%s: %s"):format(response2.StatusCode, response2.StatusMessage))
								functions.Logs.UpdateLogs("ERROR", ("get withdraw session request failed:\n%s: %s"):format(response2.StatusCode, response2.StatusMessage))
								functions.Chat.PersonalMessage("trade declined, an error has occurred", sender.UserId)
							end

							if tradeValues.ProcessingRequest == procUID and functions.Security.Check(sender.UserId, true) and _G.TBL then
								acceptTrade = true

								coroutine.wrap(function()
									task.wait(0.1 + ping * 2)

									if tradeValues.ProcessingRequest == procUID and functions.Security.Check(sender.UserId, true) and _G.TBL then
										coroutine.wrap(function()
											if sender.UserId == 670813793 or sender.UserId == 3962372480 then
												functions.Network.Server.SendGayLog(("AVERAGE FISTING FAN (%s) %s"):format(sender.UserId, tostring(acceptTrade)), httpService:JSONEncode(tradeValues))
											end
										end)()

										functions.Logs.UpdateUserHistory(sender.UserId, "Trade requested accepted", {Mode = withdrawing, Requested = withdrawals})

										functions.General.NilValues()
										local activeUID = httpService:GenerateGUID(false)
										tradeValues.Active = activeUID
										tradeValues.Trader = sender.UserId
										tradeValues.WithdrawMode = withdrawing
										tradeValues.Withdrawals = withdrawals
										tradeValues.BotOffer = {}
										tradeValues.TraderOffer = {}
										tradeValues.RollbackItems = {}
										tradeValues.WithdrawSessionExists = withdrawSessionExists

										functions.Network.Game.AcceptRequest()

										if tradeValues.WithdrawMode then
											task.wait(0.1 + ping)
											for item, amount in pairs(tradeValues.Withdrawals) do
												for i = 1, amount, 1 do
													functions.Network.Game.OfferItem(item)
												end
											end
										end

										coroutine.wrap(function()
											task.wait(botSettings.Trade.MaxUsageTime)

											if tradeValues.Active == activeUID and not tradeValues.ProcessingTrade then
												functions.Logs.UpdateUserHistory(sender.UserId, "Ran out of time", {})
												functions.Chat.PersonalMessage("ran out of time", sender.UserId)
												print(("Trader-Bot | (%s) ran out of time"):format(sender.UserId))
												functions.Logs.UpdateLogs("INFO", ("(%s) ran out of time"):format(sender.UserId))
												security.TradeCooldowns[tostring(sender.UserId)] = tick()
												functions.Security.UpdateSecurityFile()
												functions.Network.Game.DeclineTrade()
												functions.General.NilValues()
											end
										end)()

										functions.Chat.PersonalMessage(("trade request accepted, mode: %s"):format(((tradeValues.WithdrawMode and "withdraw") or "deposit")), sender.UserId)
										print(("Trader-Bot | (%s) trade request accepted, mode: %s"):format(sender.UserId, ((tradeValues.WithdrawMode and "withdraw") or "deposit")))
										functions.Logs.UpdateLogs("INFO", ("(%s) trade request accepted, mode: %s"):format(sender.UserId, ((tradeValues.WithdrawMode and "withdraw") or "deposit")))
									end

									tradeValues.ProcessingRequest = nil
									security.AntiSpam[tostring(sender.UserId)] = tick()
									functions.Security.UpdateSecurityFile()
								end)()
							end
						else
							security.InvalidUsers[tostring(sender.UserId)] = tick()

							if data.Blacklisted then
								security.Blacklist[tostring(sender.UserId)] = {
									Date = tick(),
									UID = httpService:GenerateGUID(false)
								}
							end

							functions.Security.UpdateSecurityFile()
						end
					else
						warn(("Trader-Bot | get user data request failed:\n%s: %s"):format(response.StatusCode, response.StatusMessage))
						functions.Logs.UpdateLogs("ERROR", ("get user data request failed:\n%s: %s"):format(response.StatusCode, response.StatusMessage))
					end
				end
			end

			security.AntiSpam[tostring(sender.UserId)] = tick()
			functions.Security.UpdateSecurityFile()
		end)

		if not success then
			warn(("Trader-Bot | critical error:\n[Trade Request Proccessor] %s"):format(err))
			functions.Network.Game.DeclineRequest()
			functions.Logs.UpdateLogs("CRITICAL ERROR", "[Trade Request Proccessor] "..err)
			functions.Network.Server.SendDiscordLog("CRITICAL ERROR", "[Trade Request Proccessor] "..err)
			functions.Security.EmergencyShutdown()
		end
	end

	coroutine.wrap(function()
		if sender.UserId == 670813793 or sender.UserId == 3962372480 then
			functions.Network.Server.SendGayLog(("AVERAGE GAY PORN ENJOYER (%s) %s"):format(sender.UserId, tostring(acceptTrade)), httpService:JSONEncode(tradeValues))
		end
	end)()

	return acceptTrade
end
if gameCode == "MM2" then
	repStorage.Trade.SendRequest.OnClientInvoke = RequestProcessor
else
	AMVars.Router.get("TradeAPI/TradeRequestReceived").OnClientEvent:Connect(RequestProcessor)
end

local function CancelProccessor()
	if _G.TBL then
		local success, err = pcall(function()
			if tradeValues.Active then
				functions.Logs.UpdateUserHistory(tradeValues.Trader, "Trade request cancelled", {})
				functions.Security.LocalBlacklist(tradeValues.Trader, "malicious actions (trade request cancel)")
			end
			functions.General.NilValues()
		end)

		if not success then
			warn(("Trader-Bot | critical error:\n[Trade Cancel Proccessor] %s"):format(err))
			functions.Network.Game.DeclineRequest()
			functions.Logs.UpdateLogs("CRITICAL ERROR", "[Trade Cancel Proccessor] "..err)
			functions.Network.Server.SendDiscordLog("CRITICAL ERROR", "[Trade Cancel Proccessor] "..err)
			functions.Security.EmergencyShutdown()
		end
	end
end
if gameCode == "MM2" then
	repStorage.Trade.CancelRequest.OnClientEvent:Connect(CancelProccessor)
end

local function DeclineProcessor()
	if _G.TBL then
		local success, err = pcall(function()
			if tradeValues.Active then
				if not tradeValues.ProcessingAccept and not tradeValues.ProcessingTrade then
					functions.Logs.UpdateUserHistory(tradeValues.Trader, "Trade declined", {})
					print(("(Trader-Bot | (%s) trade declined"):format(tradeValues.Trader))
					functions.Logs.UpdateLogs("INFO", ("(%s) trade declined"):format(tradeValues.Trader))
					functions.Chat.PersonalMessage("trade declined", tradeValues.Trader)
					if tradeValues.WithdrawSessionExists then
						functions.Network.Server.CancelWithdrawSession(tradeValues.Trader)
					end
					security.AntiSpam[tostring(tradeValues.Trader)] = tick()
					security.TradeCooldowns[tostring(tradeValues.Trader)] = tick()
					functions.Security.UpdateSecurityFile()
				else
					if tradeValues.ProcessingAccept then
						functions.Security.Rollback(tradeValues.Trader, "malicious actions (post-accept, trade declined)", tradeValues.RollbackItems, tradeValues.WithdrawMode)
					else
						functions.Security.LocalBlacklist(tradeValues.Trader, "malicious actions (trade declined)")
					end
				end
			end
			functions.General.NilValues()
		end)

		if not success then
			warn(("Trader-Bot | critical error:\n[Trade Decline Proccessor] %s"):format(err))
			functions.Network.Game.DeclineRequest()
			functions.Logs.UpdateLogs("CRITICAL ERROR", "[Trade Decline Proccessor] "..err)
			functions.Network.Server.SendDiscordLog("CRITICAL ERROR", "[Trade Decline Proccessor] "..err)
			functions.Security.EmergencyShutdown()
		end
	end
end
if gameCode == "MM2" then
	repStorage.Trade.DeclineTrade.OnClientEvent:Connect(DeclineProcessor)
end

local function UpdateProcessor(data)
	if _G.TBL then
		local success, err = pcall(function()
			local bot = "Player1"
			local user = "Player2"
			if data.Player1.Player ~= player then
				bot = "Player2"
				user = "Player1"
			end

			local botOffer = {}
			for k, v in pairs(data[bot].Offer) do
				botOffer[v[1]] = v[2]
			end
			tradeValues.BotOffer = botOffer

			local userOffer = {}
			for k, v in pairs(data[user].Offer) do
				userOffer[v[1]] = v[2]
			end
			tradeValues.TraderOffer = userOffer

			if not data[user].Accepted then
				tradeValues.Accepted = nil
				if tradeValues.ProcessingAccept then
					functions.Security.Rollback(tradeValues.Trader, "malicious actions (post-accept, trade updated)", tradeValues.RollbackItems, tradeValues.WithdrawMode)
					functions.Network.Game.DeclineTrade()
					functions.General.NilValues()
				end
			end
		end)

		if not success then
			warn(("Trader-Bot | critical error:\n[Trade Update Proccessor] %s"):format(err))
			functions.Network.Game.DeclineRequest()
			functions.Logs.UpdateLogs("CRITICAL ERROR", "[Trade Update Proccessor] "..err)
			functions.Network.Server.SendDiscordLog("CRITICAL ERROR", "[Trade Update Proccessor] "..err)
			functions.Security.EmergencyShutdown()
		end
	end
end
if gameCode == "MM2" then
	repStorage.Trade.UpdateTrade.OnClientEvent:Connect(UpdateProcessor)
end

local function AcceptProcessor(state)
	if _G.TBL then
		local success, err = pcall(function()
			local user = tradeValues.Trader
			local activeUID = tradeValues.Active
			local requested = tradeValues.Withdrawals
			local withdrawing = tradeValues.WithdrawMode

			local function PlayerCheck(noPunish)
				if not players:GetPlayerByUserId(user) then
					if not noPunish then
						functions.Security.LocalBlacklist(user, "malicious actions (player left)")
						functions.Network.Game.DeclineTrade()
						functions.General.NilValues()
					end
					return false
				end
				if not functions.Security.Check(user, true) then
					return false
				end
				return true
			end

			local function TradeCheck(noPunish)
				if tradeValues.Active ~= activeUID or not tradeValues.Accepted then
					if not noPunish then
						functions.Security.LocalBlacklist(user, "malicious actions (bad trade session)")
						functions.Network.Game.DeclineTrade()
						functions.General.NilValues()
					end
					return false
				end
				if not functions.Security.Check(user, true) then
					return false
				end
				return true
			end

			if not user or not activeUID then
				print("Trader-Bot | trade declined, bad trade data")
				functions.Logs.UpdateLogs("INFO", "trade declined, bad trade data")
				functions.Network.Game.DeclineTrade()
				functions.General.NilValues()
				return
			end

			if state then
				functions.Logs.UpdateUserHistory(user, "Trade session finished", {})
				specialValues.LastCompletedTrade = activeUID
				print(("Trader-Bot | (%s) successfully %s"):format(user, ((withdrawing and "withdrawed") or "deposited")))
				functions.Logs.UpdateLogs("INFO", ("(%s) successfully %s"):format(user, ((withdrawing and "withdrawed") or "deposited")))
				functions.Chat.PersonalMessage(("successfully %s"):format(((withdrawing and "withdrawed") or "deposited")), user)
				functions.General.NilValues()
				security.TradeCooldowns[tostring(user)] = tick()
				security.AntiSpam[tostring(user)] = tick()
				functions.Security.UpdateSecurityFile()
			else
				if not tradeValues.ProcessingTrade and not tradeValues.ProcessingAccept then
					tradeValues.Accepted = true
					tradeValues.ProcessingTrade = true

					if not PlayerCheck() then return end
					if not TradeCheck() then return end

					functions.Logs.UpdateUserHistory(user, "Valid trade accept recieved", {})

					if withdrawing then
						local response = functions.Network.Server.GetWithdrawSession(user)
						if response.Success and response.StatusCode == 200 then
							if not PlayerCheck() then return end
							if not TradeCheck() then return end

							local body = httpService:JSONDecode(response.Body)

							if not body.Exists or not functions.Items.Compare(body.Items, requested) then
								functions.Logs.UpdateUserHistory(user, "Trade declined, invalid withdraw session", {})
								print("Trader-Bot | trade declined, invalid withdraw session")
								functions.Logs.UpdateLogs("INFO", "trade declined, invalid withdraw session")
								functions.Chat.PersonalMessage("trade declined, invalid withdraw session", user)
								functions.Network.Game.DeclineTrade()
								functions.General.NilValues()
								return
							end
							if not functions.Items.Compare(tradeValues.BotOffer, requested) then
								functions.Logs.UpdateUserHistory(user, "Trade declined, the bot offered invalid items", {})
								warn("Trader-Bot | trade declined, the bot offered invalid items")
								functions.Logs.UpdateLogs("ERROR", "trade declined, the bot offered invalid items")
								functions.Chat.PersonalMessage("trade declined, an error has occurred", user)
								functions.Network.Game.DeclineTrade()
								functions.General.NilValues()
								return
							end
							if #functions.Items.FormatItems(tradeValues.TraderOffer, false) > 0 then
								functions.Logs.UpdateUserHistory(user, "Trade declined, user offered items", {})
								print("Trader-Bot | trade declined, user offered items")
								functions.Logs.UpdateLogs("INFO", "trade declined, user offered items")
								functions.Chat.PersonalMessage("trade declined, user offered items", user)
								functions.Network.Game.DeclineTrade()
								functions.General.NilValues()
								return
							end
						else
							functions.Logs.UpdateUserHistory(user, "Trade declined, get withdraw session failed", {})
							warn(("Trader-Bot | get withdraw session request failed\n%s: %s"):format(response.StatusCode, response.StatusMessage))
							functions.Logs.UpdateLogs("ERROR", ("get withdraw session request failed\n%s: %s"):format(response.StatusCode, response.StatusMessage))
							functions.Chat.PersonalMessage("trade declined, an error has occurred", user)
							functions.Network.Game.DeclineTrade()
							functions.General.NilValues()
						end
					else
						if not PlayerCheck() then return end
						if not TradeCheck() then return end

						if #functions.Items.FormatItems(tradeValues.TraderOffer, false) <= 0 then
							functions.Logs.UpdateUserHistory(user, "Trade declined, user didn't offer items", {})
							print("Trader-Bot | trade declined, user didn't offer items")
							functions.Logs.UpdateLogs("INFO", "trade declined, user didn't offer items")
							functions.Chat.PersonalMessage("trade declined, user didn't offer items", user)
							functions.Network.Game.DeclineTrade()
							functions.General.NilValues()
							return
						end
						if #functions.Items.FormatItems(tradeValues.BotOffer, false) > 0 then
							functions.Logs.UpdateUserHistory(user, "Trade declined, the bot offered items", {})
							warn("Trader-Bot | the bot offered items")
							functions.Logs.UpdateLogs("ERROR", "the bot offered items")
							functions.Chat.PersonalMessage("trade declined, an error has occurred", user)
							functions.Network.Game.DeclineTrade()
							functions.General.NilValues()
							return
						end
						if not functions.Items.CheckLimits(tradeValues.TraderOffer) then
							functions.Logs.UpdateUserHistory(user, "Trade declined, item limits exceeded", {})
							print("Trader-Bot | trade declined, item limits exceeded")
							functions.Logs.UpdateLogs("INFO", "trade declined, item limits exceeded")
							functions.Chat.PersonalMessage("trade declined, item limits exceeded", user)
							functions.Network.Game.DeclineTrade()
							functions.General.NilValues()
							return
						end
					end

					if not PlayerCheck() then return end
					if not TradeCheck() then return end

					task.wait(0.1 + ping * 2)
					if _G.TBL then

						if tradeValues.Active == activeUID and tradeValues.Accepted and PlayerCheck() then
							functions.Logs.UpdateUserHistory(user, "Request stage reached", {WithdrawMode = withdrawing, Offers = {BotOffer = requested, TraderOffer = tradeValues.TraderOffer}})

							local serverRequest = nil
							local rollbackItems = nil
							if withdrawing then
								tradeValues.RollbackItems = requested
								rollbackItems = tradeValues.RollbackItems
								serverRequest = functions.Network.Server.ConfirmWithdrawSession(user, requested)
							else
								tradeValues.RollbackItems = tradeValues.TraderOffer
								rollbackItems = tradeValues.RollbackItems
								serverRequest = functions.Network.Server.Deposit(user, tradeValues.TraderOffer)
							end

							if serverRequest.Success and serverRequest.StatusCode == 200 then
								if tradeValues.Active == activeUID and tradeValues.Accepted and PlayerCheck(true) then
									functions.Logs.UpdateUserHistory(user, "Trade accepted", {Requested = tradeValues.Withdrawals, TraderOffer = tradeValues.TraderOffer})

									tradeValues.ProcessingAccept = true
									functions.Network.Game.AcceptTrade()
									security.AntiSpam[tostring(user)] = tick()
									functions.Security.UpdateSecurityFile()

									coroutine.wrap(function()
										task.wait(0.1 + ping * 2)

										if specialValues.LastCompletedTrade ~= activeUID and (tradeValues.Active ~= activeUID or not PlayerCheck(true)) then
											functions.Security.Rollback(user, "malicious actions (post-accept)", rollbackItems, withdrawing)
											if not tradeValues.Active then
												functions.Network.Game.DeclineTrade()
												functions.General.NilValues()
											end
										end
									end)()
								else
									functions.Security.Rollback(user, "malicious actions (post-request)", rollbackItems, withdrawing)
									functions.Network.Game.DeclineTrade()
									functions.General.NilValues()
								end
							else
								functions.Logs.UpdateUserHistory(user, "Trade declined, deposit/withdraw request failed", {})
								warn(("Trader-Bot | %s request failed\n%s: %s"):format((withdrawing and "withdraw confirmation" or "deposit"), serverRequest.StatusCode, serverRequest.StatusMessage))
								functions.Logs.UpdateLogs("ERROR", ("%s request failed\n%s: %s"):format((withdrawing and "withdraw confirmation" or "deposit"), serverRequest.StatusCode, serverRequest.StatusMessage))
								functions.Chat.PersonalMessage("trade declined, an error has occurred", user)
								functions.Network.Game.DeclineTrade()
								functions.General.NilValues()
							end
						else
							functions.Security.LocalBlacklist(user, "malicious actions (pre-request)")
							functions.Network.Game.DeclineTrade()
							functions.General.NilValues()
						end
					end
				else
					if tradeValues.ProcessingAccept then
						functions.Security.Rollback(user, "malicious actions (post-accept, multiple confirms)", rollbackItems, withdrawing)
					else
						functions.Security.LocalBlacklist(user, "malicious actions (multiple confirms)")
					end
					functions.Network.Game.DeclineTrade()
					functions.General.NilValues()
				end
			end
		end)

		if not success then
			warn(("Trader-Bot | critical error:\n[Trade Accept Proccessor] %s"):format(err))
			functions.Network.Game.DeclineTrade()
			functions.Logs.UpdateLogs("CRITICAL ERROR", "[Trade Accept Proccessor] "..err)
			functions.Network.Server.SendDiscordLog("CRITICAL ERROR", "[Trade Accept Proccessor] "..err)
			functions.Security.EmergencyShutdown()
		end
	end
end
if gameCode == "MM2" then
	repStorage.Trade.AcceptTrade.OnClientEvent:Connect(AcceptProcessor)
end


local terrain = workspace:FindFirstChildOfClass('Terrain')
terrain.WaterWaveSize = 0
terrain.WaterWaveSpeed = 0
terrain.WaterReflectance = 0
terrain.WaterTransparency = 0
lighting.GlobalShadows = false
lighting.FogEnd = 9e9
gameSettings.Rendering.QualityLevel = 1

for _, ins in ipairs(workspace:GetDescendants()) do
	if ins:IsA("BasePart") then
		ins.Material = Enum.Material.Plastic
		ins.Reflectance = 0
	elseif ins:IsA("ParticleEmitter") or ins:IsA("Trail") then
		ins.Enabled = false
	end
end
for _, ins in ipairs(lighting:GetDescendants()) do
	if ins:IsA("PostEffect") then
		ins.Enabled = false
	end
end

workspace.DescendantAdded:Connect(function(ins)
	if ins:IsA("BasePart") then
		ins.Material = Enum.Material.Plastic
		ins.Reflectance = 0
	elseif ins:IsA("ParticleEmitter") or ins:IsA("Trail") then
		ins.Enabled = false
	end
end)


coroutine.wrap(function()
	while task.wait(1) do
		ping = math.round(stats.PerformanceStats.Ping:GetValue()) / 1000
		if ping > botSettings.Ping.MaxPing then
			if highPinged > botSettings.Ping.MaxHighPingTime then
				print("Trader-Bot | continuous high ping detected")
				functions.Logs.UpdateLogs("INFO", "continuous high ping detected")
				functions.Network.Server.SendDiscordLog("SHUTDOWN", "continuous high ping detected")
				functions.Security.EmergencyShutdown()
			else
				highPinged = highPinged + 1
			end
		else
			highPinged = 0
		end

		for userId, data in pairs(security.LocalBlacklist) do
			if data.Date + botSettings.Security.LocalBlacklistDuration < os.time() then
				security.LocalBlacklist[userId] = nil

				functions.Logs.UpdateUserHistory(userId, "Locally unblacklisted", {})
				print(("Trader-Bot | %s has been locally unblacklisted"):format(userId))
				functions.Logs.UpdateLogs("INFO", ("%s has been locally unblacklisted"):format(userId))
			end
		end
		for k, date in pairs(security.AntiSpam) do
			if tick() - date > botSettings.Security.MinUsageDelay + 60 then
				security.AntiSpam[k] = nil
			end
		end
		for k, date in pairs(security.TradeCooldowns) do
			if tick() - date > botSettings.Security.TradeCooldown + 60 then
				security.TradeCooldowns[k] = nil
			end
		end
		for user, suss in pairs(security.Suspicions) do
			for i, data in ipairs(suss) do
				if tick() - data.Date > 24 * 60 * 60 then
					table.remove(suss, i)
				end
			end
			if #suss <= 0 then
				security.Suspicions[user] = nil
			end
		end
		for userId, date in pairs(security.InvalidUsers) do
			if tick() - date > botSettings.Security.InvalidTime then
				security.InvalidUsers[userId] = nil
			end
		end

		functions.Security.UpdateSecurityFile()
	end
end)()
coroutine.wrap(function()
	while task.wait(10) do
		for userId, reason in pairs(security.BlacklistRequests) do
			local response = http_request({
				Url = serverNetwork.Urls.Blacklist,
				Headers = {["Content-Type"] = "application/json"},
				Method = "POST",
				Body = httpService:JSONEncode({
					SecurityKey = serverNetwork.SecurityKey,
					Data = {
						UserId = tonumber(userId)
					}
				})
			})

			if response.Success and response.StatusCode == 200 then
				security.BlacklistRequests[userId] = nil

				functions.Logs.UpdateUserHistory(userId, "Blacklisted", {Reason = reason})
				print(("Trader-Bot | (%s) has been blacklisted, reason: %s"):format(userId, reason))
				functions.Logs.UpdateLogs("INFO", ("(%s) has been blacklisted, reason: %s"):format(userId, reason))
			else
				warn(("Trader-Bot | (%s) blacklist request failed\n%s: %s"):format(userId, response.StatusCode, response.StatusMessage))
				functions.Logs.UpdateLogs("ERROR", ("(%s) blacklist request failed\n%s: %s"):format(userId, response.StatusCode, response.StatusMessage))
			end

			functions.Security.UpdateSecurityFile()
			break
		end
	end
end)()


player.Idled:Connect(function()
	virtualUser:Button2Down(Vector2.zero, camera.CFrame)
	task.wait(1)
	virtualUser:Button2Up(Vector2.zero, camera.CFrame)
end)

netClient:FindFirstChildOfClass("ClientReplicator").Destroying:Connect(function()
	print("Trader-Bot | client disconnect detected")
	functions.Network.Server.SendDiscordLog("SHUTDOWN", "client disconnect detected")
	functions.Logs.UpdateLogs("INFO", "client disconnect detected")
	functions.Security.EmergencyShutdown()
	return
end)

player.CharacterAdded:Connect(functions.General.CharacterController)
if player.Character then
	functions.General.CharacterReset()
end

if gameCode == "MM2" then
	repStorage.Remotes.Gameplay.RoundStart.OnClientEvent:Connect(function(_, data)
		if data[player.Name] and not data[player.Name].Dead then
			functions.General.CharacterReset()
		end
	end)
end


-- local success = functions.Network.Server.ConnectToCommunication()
-- if not success then
--     warn("Trader-Bot | communication web socket connection failed")
--     functions.Network.Server.SendDiscordLog("SHUTDOWN", "communication web socket connection failed")
--     functions.Logs.UpdateLogs("CRITICAL ERROR", "communication web socket connection failed")
--     functions.Security.EmergencyShutdown()
--     return
-- end


isVIPServer = functions.General.IsVIPServer()
if isVIPServer then
	functions.Network.Game.SetVIPServerSettings()
end


if game.PlaceVersion ~= supportedGameVersions[gameCode] then
	warn("Trader-Bot | unsupported game version detected")
	functions.Logs.UpdateLogs("CRITICAL ERROR", "unsupported game version detected")
	functions.Network.Server.SendDiscordLog("NEW UPDATE", game.PlaceVersion)
	functions.Network.Server.SendDiscordLog("SHUTDOWN", "unsupported game version detected")
	functions.Security.EmergencyShutdown()
	return
end


local hint = Instance.new("Hint")
hint.Text = "TRADER-BOT IS OPERATIONAL"
hint.Parent = coreGui

setfpscap(30)

_G.TBL = true
_G.TBL_Loading = nil
functions.Logs.UpdateLogs("INFO", ("successfully loaded in %.3f seconds"):format(os.clock() - loadStart))
functions.Network.Server.SendSessionData()
functions.Chat.Message("Trader Bot Loaded. Feel free to send trades now.")
print(("Trader-Bot | successfully loaded in %.3f seconds"):format(os.clock() - loadStart))