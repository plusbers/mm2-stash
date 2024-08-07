// Require Dependencies
const jwt = require("jsonwebtoken");
const { parallelLimit } = require("async");
const _ = require("lodash");
const throttlerController = require("../throttler");
const config = require("../../config");
const colors = require("colors");
const { getCurrentBlock, awaitNextBlockHash, generateServerSeedAndHash } = require("../blockchain");
const { checkAndEnterRace, checkAndApplyRakeToRace } = require("../race");
const { checkAndApplyRakeback } = require("../vip");
const { checkAndApplyAffiliatorCut } = require("../affiliates");
const { getBattlesState } = require("../site-settings");
const insertNewWalletTransaction = require("../../utils/insertNewWalletTransaction");
const fs = require('fs');

const User = require("../../models/User");
const BattlesGame = require("../../models/BattlesGame");
const seedrandom = require("seedrandom");

const caseList = require("./cases.json");

let PENDING_GAMES = [];

const getPendingGames = () => { return PENDING_GAMES };

// Get socket.io instance
const listen = async (io) => {
  function isPlayerAlreadyJoined(playersArray, playerId) {
    return playersArray.some(player => String(player.id) === String(playerId));
  }

  const generateCaseResult = async (caseObj, mod, playerCount, roundNum, players) => {
    const caseInfo = caseList.find((caseItem) => caseItem.slug === caseObj?.slug);
    if (!caseInfo) {
      throw new Error(`Case information not found for slug: ${caseObj?.slug}`);
    }
    
    const result = [];

    for (let i = 1; i <= playerCount; i++) {
      const seed = `${mod}:${i}:${roundNum}`;
      const rollNumber = seedrandom(seed)()
      const ticket = ~~(rollNumber * 100_000)

      const item = caseInfo.items.find(
        (item) => ticket >= item?.ticketsStart && ticket <= item?.ticketsEnd
      );

      const drop = {
        item: {
          name: item?.name,
          color: item?.color,
          image: item?.image,
          price: item?.price,
          ticketsStart: item?.ticketsStart,
          ticketsEnd: item?.ticketsEnd,
        },
        result: ticket,
        battlePlayerId: 0,
        team: i,
        userId: players[i - 1].id,
        seed: `${mod}:${i}:${roundNum}`,
      };

      result.push(drop);
    }
  
    return result;
  };

  function getRandomWeightedItems(data, totalItems) {
    const itemList = data.items;
    let weightedList = [];

    for (const item of itemList) {
      const weight = item.ticketsEnd - item.ticketsStart + 1;
      for (let i = 0; i < weight; i++) {
        weightedList.push(item);
      }
    }

    for (let i = weightedList.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [weightedList[i], weightedList[j]] = [weightedList[j], weightedList[i]];
    }

    return weightedList.slice(0, totalItems);
  }

  const delay = (ms) => {
    return new Promise((resolve) => setTimeout(resolve, ms));
  };

  const runGame = async (battleId) => {
    const pendingGameIndex = PENDING_GAMES.findIndex(game => String(game._id) === String(battleId));
    if (pendingGameIndex === -1) {
        return console.error("Battle not found in PENDING_GAMES.");
    }
    let battle = PENDING_GAMES[pendingGameIndex];
    PENDING_GAMES.splice(pendingGameIndex, 1);

    const mostRecentBlockNum = await getCurrentBlock();
    const waitForBlockNumber = mostRecentBlockNum + 10;

    battle.status = 2;
    let terminalMode = Boolean(battle.isTerminalMode);
    console.log(terminalMode)
    battle.blockNumber = waitForBlockNumber;
    await battle.save();

    io.of("/battles").to("battles").emit("battles:expose", {
        battleId: battleId,
        blockNumber: waitForBlockNumber
    });

    const blockHash = await awaitNextBlockHash(waitForBlockNumber);

    battle.blockHash = blockHash;
    await battle.save();

    io.of("/battles").to("battles").emit("battles:start", {
        battleId: battleId,
        blockHash: battle.blockHash,
        serverSeed: battle.serverSeed,
    });

    console.log(
        colors.red("Battles >> Starting game"),
        battle._id,
        colors.red("with hash"),
        battle.blockHash
    );

    let resArr = [];
    let lastCaseResults = [];
    for (let i = 0; i < battle.cases.length; i++) {
        const mod = `${battle.serverSeed}${battle.blockHash}`;
        const caseResult = await generateCaseResult(
            battle.cases[i],
            mod,
            battle.playerCount,
            i + 1,
            battle.players
        );

        resArr.push(caseResult);
        x = battle.eachCaseResult;
        x.push(caseResult);
        battle.eachCaseResult = x;
        await BattlesGame.updateOne({ _id: battle.id }, { $set: { eachCaseResult: x }});
        await battle.save();

        io.of("/battles").to("battles").emit("battles:round", {
            battleId: battleId,
            result: caseResult,
            img: getRandomWeightedItems(caseList.find((caseItem) => caseItem.slug === battle.cases[i].slug), 33),
            caseNumber: i,
        });

        lastCaseResults = caseResult;
        console.log(lastCaseResults)

        await delay(6000);
    }

    await delay(1000);

    battle.status = 3;
    await battle.save();

    let playerBals = [];
    for (let i = 0; i < battle.players.length; i++) {
        let bal = 0;
        for (let j = 0; j < battle.eachCaseResult.length; j++) {
            bal += parseFloat((battle.eachCaseResult[j][i]?.item?.price).toFixed(2));
        }
        playerBals.push(bal);
    }

    // code to resolve winner
    let winningTeam = 0;
    let winAmount = 0;
    let isEqual = false;
    let equals = [];

    if (battle.game_type === 4) {
        const team1Balance = playerBals[0] + playerBals[1];
        const team2Balance = playerBals[2] + playerBals[3];
        winAmount = parseFloat(((team1Balance + team2Balance) / 2).toFixed(2));

        if(team1Balance == team2Balance) {
            winAmount = parseFloat((winAmount/2).toFixed(2));
            isEqual = true;
        } else {
            if (battle.isCrazyMode) {
                if (team1Balance < team2Balance) {
                    winningTeam = 1;
                } else if (team2Balance < team1Balance) {
                    winningTeam = 2;
                } else {
                    isEqual = true;
                }
            } else {
                if (team1Balance > team2Balance) {
                    winningTeam = 1;
                } else if (team2Balance > team1Balance) {
                    winningTeam = 2;
                } else {
                    isEqual = true;
                }
            }
        }

        if (terminalMode) {
          const team1LastCaseResults = lastCaseResults[0].item.price + lastCaseResults[1].item.price;
          const team2LastCaseResults = lastCaseResults[2].item.price + lastCaseResults[3].item.price;

          if (team1LastCaseResults > team2LastCaseResults) {
              winningTeam = 1;
              isEqual = false;
          } else if (team2LastCaseResults > team1LastCaseResults) {
              winningTeam = 2;
              isEqual = false;
          } else {
              isEqual = true;
          }
        }
  
      for (let i = 0; i < 4; i++) {
          if (battle.players[i].id === "bot") continue;
          if (isEqual) {
              await User.updateOne(
                  { _id: battle.players[i].id },
                  {
                      $inc: {
                          wallet: +Math.abs(parseFloat(winAmount.toFixed(2))),
                          betsWon: +1
                      }
                  }
              );
              insertNewWalletTransaction(battle.players[i].id, +Math.abs(parseFloat(winAmount.toFixed(2))), "Battles win", { battlesGameId: battle._id });
              io.of("/battles").to(battle.players[i].id).emit("update-wallet", +Math.abs(parseFloat(winAmount.toFixed(2))));
          } else {
              if (winningTeam === 1 && i > 1) continue;
              if (winningTeam === 2 && i <= 1) continue;
              await User.updateOne(
                  { _id: battle.players[i].id },
                  {
                      $inc: {
                          wallet: +Math.abs(parseFloat(winAmount.toFixed(2))),
                          betsWon: +1
                      }
                  }
              );
              insertNewWalletTransaction(battle.players[i].id, +Math.abs(parseFloat(winAmount.toFixed(2))), "Battles win", { battlesGameId: battle._id });
              io.of("/battles").to(battle.players[i].id).emit("update-wallet", +Math.abs(parseFloat(winAmount.toFixed(2))));
          }
      }
    } else {
      let maxBalance = Math.max(...playerBals);
      let maxPlayerIndices = [];
      let minBalance = Math.min(...playerBals);
      let minPlayerIndices = [];

      for (let i = 0; i < playerBals.length; i++) {
          if (playerBals[i] === maxBalance) {
              maxPlayerIndices.push(i);
          }

          if (playerBals[i] === minBalance) {
              minPlayerIndices.push(i);
          }
      }

      winAmount = parseFloat(playerBals.reduce((accumulator, currentValue) => accumulator + currentValue,0).toFixed(2));

      if (battle.isCrazyMode) {
          if (minPlayerIndices.length > 1) {
              isEqual = true;
              equals = minPlayerIndices;
              winAmount = parseFloat((winAmount / equals.length).toFixed(2));
          } else {
              winningTeam = minPlayerIndices[0] + 1;
          }
      } else {
          if (maxPlayerIndices.length > 1) {
              isEqual = true;
              equals = maxPlayerIndices;
              winAmount = parseFloat((winAmount / equals.length).toFixed(2));
          } else {
              winningTeam = maxPlayerIndices[0] + 1;
          }
          if (terminalMode) {
            let maxBal = Math.max(...playerBals);
            let winners = [];
            for (let i = 0; i < playerBals.length; i++) {
                if (playerBals[i] === maxBal) {
                    winners.push(i);
                }
            }
        
            let maxLastCaseResult = Math.max(...lastCaseResults.map(result => result.item.price));
        
            console.log(colors.green(`Battles >> ${maxLastCaseResult}`), battle._id);
        
            let lastCaseWinners = [];
            for (let i = 0; i < lastCaseResults.length; i++) {
                if (lastCaseResults[i].item.price === maxLastCaseResult) {
                    lastCaseWinners.push(i);
                }
            }
        
            if (lastCaseWinners.length === 1) {
                winningTeam = lastCaseWinners[0] + 1;
            } else {
                isEqual = true;
                equals = lastCaseWinners;
                winAmount = parseFloat((winAmount / equals.length).toFixed(2));
            }
        
            console.log(winningTeam);
        }

          for(let i = 0; i < battle.players.length; i++) {
              if(battle.players[i].id == "bot") continue;
              if(isEqual) {
                  if(equals[i] != i) continue;
                  await User.updateOne(
                      { _id: battle.players[i].id },
                      {
                          $inc: {
                              wallet: +Math.abs(parseFloat(winAmount.toFixed(2))),
                              betsWon: + 1
                          }
                      }
                  );
                  insertNewWalletTransaction(battle.players[i].id, +Math.abs(parseFloat(winAmount.toFixed(2))), "Battles win", { battlesGameId: battle._id });
                  io.of("/battles").to(battle.players[i].id).emit("update-wallet", +Math.abs(parseFloat(winAmount.toFixed(2))));
              } else {
                  if(winningTeam != i+1) continue;
                  await User.updateOne(
                      { _id: battle.players[i].id },
                      {
                          $inc: {
                              wallet: +Math.abs(parseFloat(winAmount.toFixed(2))),
                              betsWon: +1
                          }
                      }
                  );
                  insertNewWalletTransaction(battle.players[i].id, +Math.abs(parseFloat(winAmount.toFixed(2))), "Battles win", { battlesGameId: battle._id });
                  io.of("/battles").to(battle.players[i].id).emit("update-wallet", +Math.abs(parseFloat(winAmount.toFixed(2))));
              }
          }
      }

      for(let i = 0; i < equals.length; i++) {
          equals[i] += 1;
      };
    }

    battle.win = {
      battleId: battleId,
      winningTeam: winningTeam,
      winAmount: winAmount,
      pc: battle.playerCount,
      bt: battle.game_type,
      isEqual: isEqual,
      equals: equals,
  };
  await battle.save();

  io.of("/battles").to("battles").emit("battles:finished", {
      battleId: battleId,
      winningTeam: winningTeam,
      winAmount: winAmount,
      pc: battle.playerCount,
      bt: battle.game_type,
      isEqual: isEqual,
      equals: equals,
  });
}

  const resetUnfinishedBattles = async (io) => {
    try {
      const unfinishedBattles = await BattlesGame.find({ status: { $in: [1, 2] } });
  
      for (const battle of unfinishedBattles) {
        const { serverSeed, serverSeedHash } = generateServerSeedAndHash();
        battle.serverSeed = serverSeed;
        battle.serverSeedHash = serverSeedHash;
        battle.blockNumber = null;
        battle.blockHash = null;
        battle.eachCaseResult = [];
        battle.status = 1;
        await battle.save();
  
        console.log(
          colors.green("Battles >> Resetting game to original state"),
          battle._id
        );

        PENDING_GAMES.push(battle);
  
        io.of("/battles").to("battles").emit("battles:reset", {
          battleId: battle._id,
          status: battle.status,
        });
  
        if (battle.players && battle.players.filter(p => p.id).length === battle.playerCount) {
          runGame(battle._id);
        }
      }
    } catch (error) {
      console.error("Error in resetting unfinished battles:", error);
    }
  };
  
  await resetUnfinishedBattles(io);

  async function loadListingsToLocal() {
    const waiting = await BattlesGame.find({ status: 1 })
    const active = await BattlesGame.find({ status: 2 });

    const games = [...waiting, ...active];

    if(games.length > 0) PENDING_GAMES = games;
  }

  loadListingsToLocal();

  // Listen for new websocket connections
  io.of("/battles").on("connection", socket => {
    let loggedIn = false;
    let user = null;

    socket.join("battles");

    // Throttle connnections
    socket.use(throttlerController(socket));

    // Authenticate websocket connection
    socket.on("auth", async token => {
      if (!token) {
        loggedIn = false;
        user = null;
        return socket.emit(
          "error",
          "No authentication token provided, authorization declined"
        );
      }

      try {
        // Verify token
        const decoded = jwt.verify(token, config.authentication.jwtSecret);

        user = await User.findOne({ _id: decoded.user.id });
        if (user) {
          if (parseInt(user.banExpires) > new Date().getTime()) {
            // console.log("banned");
            loggedIn = false;
            user = null;
            return socket.emit("user banned");
          } else {
            loggedIn = true;
            socket.join(String(user._id));
            // socket.emit("notify:success", "Successfully authenticated!");
          }
        }
        // return socket.emit("alert success", "Socket Authenticated!");
      } catch (error) {
        loggedIn = false;
        user = null;
        return socket.emit("notify:error", "Authentication token is not valid");
      }
    });

    // Check for users ban status
    socket.use(async (packet, next) => {
      if (loggedIn && user) {
        try {
          const dbUser = await User.findOne({ _id: user.id });

          // Check if user is banned
          if (dbUser && parseInt(dbUser.banExpires) > new Date().getTime()) {
            return socket.emit("user banned");
          } else {
            return next();
          }
        } catch (error) {
          return socket.emit("user banned");
        }
      } else {
        return next();
      }
    });

    socket.on("battles:create", async (      
      selectedCases,
      selectedType,
      selectedMode,
      totalCost,
      totalCaseCount,
      ) => {
      // Validate user input
      if (!loggedIn)
        return socket.emit("battles:error", "You are not logged in!");
      if (typeof totalCost !== "number" || isNaN(totalCost))
        return socket.emit("battles:error", "Invalid totalCost type!");
      if(selectedCases.length == 0) 
        return socket.emit("battles:error", "No cases selected!");

      if(selectedMode != '1v1' && selectedMode != '1v1v1' && selectedMode != '1v1v1v1' && selectedMode != '2v2') 
        return socket.emit("battles:error", "Not a valid gamemode! If you continue to try and break the code, you will be ip blacklisted.");

      let c = 0, verifiedCases = [];
      totalCost = 0;
      for(const item of selectedCases) {
        const last = caseList.find((caseItem) => caseItem.slug === item.slug);
        if(!last) return socket.emit("battles:error", "Not a valid case! If you continue to try and break the code, you will be ip blacklisted.");
        verifiedCases.push(last)
        totalCost += last.price;
      }
      
      if(!selectedType && selectedType != 'standard' && selectedType != 'crazy' && selectedType != 'terminal' && selectedType != 'group')
        return socket.emit("battles:error", "Invalid game type!");
      if(!selectedMode && selectedMode != '1v1' && selectedMode != '1v1v1' && selectedMode != '1v1v1v1' && selectedMode != '2v2')
        return socket.emit("battles:error", "Invalid mode type!");

      // Get battles enabled status
      const isEnabled = getBattlesState();
  
      // If battles is disabled
      if (!isEnabled) {
        return socket.emit(
          "battles:error",
          "Battles is currently disabled! Contact admins for more information."
        );
      }   

      try {
        // Get user from database
        const dbUser = await User.findOne({ _id: user.id });

        // If user has restricted bets
        if (dbUser.betsLocked) {
          return socket.emit(
            "battles:error",
            "Your account has an betting restriction. Please contact support for more information."
          );
        }

        // If user can afford this bet
        if (dbUser.wallet < parseFloat(totalCost.toFixed(2))) {
          return socket.emit("battles:error", "You can't afford to create this battle!");
        }

        const gameTypeInt = selectedMode == '1v1' ? 1 : selectedMode == '1v1v1' ? 2 : selectedMode == '1v1v1v1' ? 3 : selectedMode == '2v2' ? 4 : 0;
        let newPlayers = [{
          id: dbUser.id,
          username: dbUser.username,
          pfp: dbUser.avatar
        }];
        for(let i = 1; i < (gameTypeInt == 1 ? 2 : gameTypeInt == 2 ? 3 : gameTypeInt == 3 ? 4 : gameTypeInt == 4 ? 4 : 0); i++) {
          newPlayers.push({
            id: null,
            username: null,
            pfp: null
          });
        }


        const { serverSeed, serverSeedHash } = generateServerSeedAndHash();

        const newGame = BattlesGame({
          betAmount: totalCost, 
          privateGame: false,

          game_type: gameTypeInt,

          isCrazyMode: "crazy" == String(selectedType),
          isTerminalMode: "terminal" == String(selectedType),

          serverSeed: serverSeed,
          serverSeedHash: serverSeedHash,
          blockNumber: null,
          blockHash: null,

          playerCount: gameTypeInt == 1 ? 2 : gameTypeInt == 2 ? 3 : gameTypeInt == 3 ? 4 : gameTypeInt == 4 ? 4 : 0,
          cases: verifiedCases,

          eachCaseResult: [],

          players: newPlayers,

          _creator: dbUser._id,

          isBotCalled: false,

          status: 1,
        });

        await newGame.save();
        PENDING_GAMES.push(newGame);

        // Remove bet amount from user's balance
        await User.updateOne(
          { _id: user.id },
          {
            $inc: {
              wallet: -Math.abs(parseFloat(totalCost.toFixed(2))),
              wager: Math.abs(parseFloat(totalCost.toFixed(2))),
              wagerNeededForWithdraw: -Math.abs(
                parseFloat(totalCost.toFixed(2))
              ),
              betsPlaced: +1
            },
          }
        );

        insertNewWalletTransaction(user.id, -Math.abs(parseFloat(totalCost.toFixed(2))), "Battles creation", { battlesGameId: newGame._id });

        // Update local wallet
        io.of("/battles").to(user.id).emit("update-wallet", -Math.abs(parseFloat(totalCost.toFixed(2))));

        // Update user's race progress if there is an active race
        await checkAndEnterRace(user.id, Math.abs(parseFloat(totalCost.toFixed(2))));

        // Calculate house edge
        const houseRake = parseFloat(totalCost.toFixed(2)) * config.games.battles.houseEdge;

        // Apply 5% rake to current race prize pool
        await checkAndApplyRakeToRace(houseRake * 0.05);

        // Apply user's rakeback if eligible
        await checkAndApplyRakeback(user.id, houseRake);

        // Apply cut of house edge to user's affiliator
        await checkAndApplyAffiliatorCut(user.id, houseRake);

        io.of("/battles").to("battles").emit("battles:new", {
          id: newGame._id,
          price: newGame.betAmount,
          cases: newGame.cases,
          casesRoundResults: [],
          players: newPlayers,
          isCrazyMode: newGame.isCrazyMode,
          isTerminalMode: newGame.isTerminalMode,
          gameType: newGame.game_type,
          status: newGame.status,
          playerCount: newGame.playerCount,
        });
        return socket.emit("battles:created", newGame._id);
      } catch (error) {
        console.error(error);

        return socket.emit(
          "battles:error",
          "There was an error while proccessing your battles creation."
        );
      }
    });

    socket.on("battles:reqdata", async (id) => {
      try {
        if(!id)
          return socket.emit("battles:error", "Not a valid battle id!");

        
        const gameData = PENDING_GAMES.find(game => String(game._id) === id) ? PENDING_GAMES.find(game => String(game._id) === id) :  await BattlesGame.findOne({ _id: id });

        if(!gameData)
          return socket.emit("battles:error", "Not a valid battle id!");

        const gd = {
          id: gameData._id,
          price: gameData.betAmount,
          cases: gameData.cases,
          casesRoundResults: gameData.eachCaseResult,
          players: gameData.players,
          isTerminalMode: gameData.isTerminalMode,  
          isCrazyMode: gameData.isCrazyMode,
          hash: gameData.privateHash,
          gameType: gameData.game_type,
          status: gameData.status,
          win: gameData.win,
          playerCount: gameData.game_type == 1 ? 2 : gameData.game_type == 2 ? 3 : gameData.game_type == 3 ? 4 : gameData.game_type == 4 ? 4 : 0,
        };
        return socket.emit("battles:data", gd);
      } catch (error) {
        console.error(error);

        return socket.emit(
          "battles:error",
          "There was an error while getting battles data"
        );
      }
    });
    
    socket.on("battles:join", async (battleId, seatNumber) => {
      try {
        if (!loggedIn)
          return socket.emit("battles:error", "You are not logged in!");
        
        user = await User.findOne({ _id: user.id });
        //let battle = await BattlesGame.findOne({ _id: battleId });

        if (user.betsLocked) {
          return socket.emit(
            "battles:error",
            "Your account has an betting restriction. Please contact support for more information."
          );
        }

        const pendingGame = PENDING_GAMES.find(game => String(game._id) === String(battleId));
        let battle;
    
        if (pendingGame) {
          battle = pendingGame;
        } else {
          battle = await BattlesGame.findOne({ _id: battleId });
          if (!battle) {
            return socket.emit("battles:error", "The game you are trying to join is invalid!");
          }
        }

        const betAmount = battle.betAmount;

        if(betAmount > user.wallet) 
          return socket.emit("battles:error", "You can't afford to join this game!")
        

        if(isPlayerAlreadyJoined(battle.players, user.id)) 
          return socket.emit("battles:error", "You have already joined this game!");


        let newPlayers = [
          ...battle.players,
        ];

        if (newPlayers[seatNumber]?.id)
          return socket.emit("battles:error", "You have already joined this game!");
        newPlayers.splice(seatNumber, 1, {
          id: user.id,
          username: user.username,
          pfp: user.avatar
        })

        const index = PENDING_GAMES.findIndex(game => String(game._id) === String(battleId));
        if (index === -1) {
          return console.error("Battle not found in PENDING_GAMES.");
        }
        PENDING_GAMES[index].players = newPlayers;
        battle = PENDING_GAMES[index];

        
        // Remove bet amount from user's balance
        await User.updateOne(
          { _id: user.id },
          {
            $inc: {
              wallet: -Math.abs(parseFloat(betAmount.toFixed(2))),
              wager: Math.abs(parseFloat(betAmount.toFixed(2))),
              wagerNeededForWithdraw: -Math.abs(
                parseFloat(betAmount.toFixed(2))
              ),
              betsPlaced: +1
            },
          }
        );
        insertNewWalletTransaction(user.id, -Math.abs(parseFloat(betAmount.toFixed(2))), "Battles join", { battlesGameId: battle._id });
        io.of("/battles").to(user.id).emit("update-wallet", -Math.abs(parseFloat(betAmount.toFixed(2))));
        await checkAndEnterRace(user.id,Math.abs(parseFloat(betAmount.toFixed(2))));
        const houseRake = parseFloat(betAmount.toFixed(2)) * config.games.crash.houseEdge;
        await checkAndApplyRakeToRace(houseRake * 0.05);
        await checkAndApplyRakeback(user.id, houseRake);
        await checkAndApplyAffiliatorCut(user.id, houseRake);

        await BattlesGame.findOneAndUpdate({ _id: battleId }, { $set: { players: [...newPlayers] }});
        

        io.of("/battles").to("battles").emit("battles:join", {
          battleId: battle._id,
          newPlayers
        });

        let pc = 0;
        for(const player of battle.players) {
          if(player?.id) pc++
        }

        if(pc == battle.playerCount) {
          runGame(battle._id);
        }

      } catch (error) {
        console.error(error);

        return socket.emit(
          "battles:error",
          "There was an error while joining this battle"
        );
      }
    });
    
    socket.on("battles:callbot", async (battleId, seatNumber) => {
      try {
        if (!loggedIn)
          return socket.emit("battles:error", "You are not logged in!");

        let battle = PENDING_GAMES.find(game => String(game._id) === String(battleId));

        if(!battle) 
          return socket.emit(
            "battles:error",
            "Can't find thid battle!"
          );
        
        if(String(battle._creator) != user.id) {
          return socket.emit(
            "battles:error",
            "To call bots you must be the creator!"
          );
        }

        const pool = [
          {
            id: "bot",
            username: "Verdict",
            pfp: "https://cdn.discordapp.com/attachments/957702130414780416/1230725836491984936/Untitled.jpg?ex=66345dc1&is=6621e8c1&hm=d64e460739145014cc5173d2f6134e1fc700988021318267ec34a7ea7dfb262f&"
          },
          {
            id: "bot",
            username: "Trocherings",
            pfp: "https://cdn.discordapp.com/attachments/957702130414780416/1230725936203305100/image.png?ex=66345dd8&is=6621e8d8&hm=2aa848c7704b78a8c28e7f3c5212a6082511230b819b050de1b362d8244fad83&"
          },
          {
            id: "bot",
            username: "Mike",
            pfp: "https://media.discordapp.net/attachments/957702130414780416/1227777770512449638/image.png?ex=6629a427&is=66172f27&hm=5efe4b8f0fd27e8d22f5355f6d8b7643b74761f848fb5745b26f109487c6ffcb&=&format=webp&quality=lossless&width=337&height=338"
          },
          {
            id: "bot",
            username: "Salamander",
            pfp: "https://media.discordapp.net/attachments/957702130414780416/1227776965067411526/image.png?ex=6629a367&is=66172e67&hm=ca1584e048d00e822aacf66966cd2f14157077a8306b47ba247f3e8cf5d1c114&=&format=webp&quality=lossless&width=273&height=343"
          },
          {
            id: "bot",
            username: "Animal",
            pfp: "https://images-ext-1.discordapp.net/external/gAmYo7lmanANhZ680-sn-ej79Xnt6TtGwVYuFk4hKcw/%3Fsize%3D4096/https/cdn.discordapp.com/guilds/1208101772087001218/users/942989035473875046/avatars/8a25865e83606dc5a12f0b976d4a2c39.png?format=webp&quality=lossless&width=668&height=668"
          },
          {
            id: "bot",
            username: "Cleaner",
            pfp: "https://media.discordapp.net/attachments/957702130414780416/1227776789133394010/image.png?ex=6629a33d&is=66172e3d&hm=19ed866fc0e9b49563d3b81b139ad057b475ea7b25ae240e1edf403b6e78c91c&=&format=webp&quality=lossless&width=335&height=332"
          },
          {
            id: "bot",
            username: "PDIDDY",
            pfp: "https://cdn.discordapp.com/attachments/1214404136590647306/1227776234411528273/image.png?ex=6629a2b9&is=66172db9&hm=aed5a49c92e9e18025379f32cc853e8030da389c050fb86be7ab4f233c8e22ba&"
          },
          {
            id: "bot",
            username: "Rkelly",
            pfp: "https://cdn.discordapp.com/attachments/1214404136590647306/1227776273057845249/images.jpg?ex=6629a2c2&is=66172dc2&hm=7a2ed54658b0683892f7a821e6a57a105380ba6e317cabab4ecfac4d16382590&"
          },
          {
            id: "bot",
            username: "Bill Cosby",
            pfp: "https://cdn.discordapp.com/attachments/1214404136590647306/1227776372970094592/bill_cosby_photo_gilbert_carrasquillo_getty_images_645957922_profile.jpg?ex=6629a2da&is=66172dda&hm=16523219dc68cbb3a135912ca376cb02b0cfdafa70de4081993fed94f9ebf5e1&"
          },
          {
            id: "bot",
            username: "Balls",
            pfp: "https://cdn.discordapp.com/attachments/1214404136590647306/1227776320373788732/images.jpg?ex=6629a2cd&is=66172dcd&hm=791e08fe5e1b92f1e54173a5723e79c043df717131321748b8dad4d2c8664817&"
          },
          {
            id: "bot",
            username: "Cheesers",
            pfp: "https://cdn.discordapp.com/embed/avatars/0.png"
          },
        ];

        const randomBot = pool[Math.floor(Math.random() * pool.length)];

        let newPlayers = [
          ...battle.players,
        ];

        if (newPlayers[seatNumber]?.id)
          return socket.emit("battles:error", "There is already a bot in this seat!");
        newPlayers.splice(seatNumber, 1, randomBot)

        const index = PENDING_GAMES.findIndex(game => String(game._id) === String(battleId));
        PENDING_GAMES[index].players = newPlayers
        battle = PENDING_GAMES[index];
        await BattlesGame.findOneAndUpdate({ _id: battleId }, { $set: { players: [...newPlayers] }});

        io.of("/battles").to("battles").emit("battles:join", {
          battleId: battle._id,
          newPlayers
        });

        let pc = 0;
        for(const player of newPlayers) {
          if(player?.id) pc++
        }

        if(pc == battle.playerCount) {
          runGame(battle._id);
        }

      } catch (error) {
        console.error(error);

        return socket.emit(
          "battles:error",
          "There was an error while calling bots for this battle"
        );
      }
    });
  });

  };

// Export functions
module.exports = {
  listen,
  getPendingGames
};