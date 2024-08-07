  // Require Dependencies
  const jwt = require("jsonwebtoken");
  const config = require("../../config");
  const crypto = require("crypto");
  const throttlerController = require("../throttler");
  const { checkAndEnterRace, checkAndApplyRakeToRace } = require("../race");
  const { checkAndApplyRakeback } = require("../vip");
  const { checkAndApplyAffiliatorCut } = require("../affiliates");
  const { getUpgraderState } = require("../site-settings");
  const insertNewWalletTransaction = require("../../utils/insertNewWalletTransaction");
  const User = require("../../models/User");
  const ProvablyFair = require("../../models/ProvablyFair");
  const UpgraderGame = require("../../models/UpgraderGame");

  const calculateMultiplier = (betAmount, itemPrice) => {
    return (itemPrice / betAmount) * 0.9;
  };

  const calculateChance = (betAmount, itemPrice, maxTicket, isUnder) => {
    const percentage = (betAmount / itemPrice) * 100;
    const ticketChance = Math.floor((percentage / 100) * maxTicket);
    return isUnder ? ticketChance : maxTicket - ticketChance;
  };

  const getRandomRollValue = (serverSeed, clientSeed, nonce) => {
    const min = 1;
    const max = 1000000001;

    const rollValue = getRandomIntValue(serverSeed, clientSeed, nonce, max - min);

    return rollValue + min;
  };

  const getCombinedSeed = (serverSeed, clientSeed, nonce) => {
    return [serverSeed, clientSeed, nonce].join(":");
  };

  const getRandomIntValue = (serverSeed, clientSeed, nonce, maxNumber) => {
    const seed = getCombinedSeed(serverSeed, clientSeed, nonce);
    return getRandomInt({ max: maxNumber, seed });
  };

  function getRandomInt({ max, seed }) {
    const hash = crypto.createHmac("sha256", seed).digest("hex");

    const subHash = hash.slice(0, 13);
    const valueFromHash = Number.parseInt(subHash, 16);

    const e = Math.pow(2, 52);
    const result = valueFromHash / e;
    return Math.floor(result * max);
  };

  // Get socket.io instance
  const listen = io => {
      // Listen for new websocket connections
      io.of("/upgrader").on("connection", socket => {
        let loggedIn = false;
        let user = null;
    
        socket.join("upgrader");
    
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

        socket.on("upgrader:attempt", async (betAmount, item, isUnder) => {
          if (!loggedIn)
            return socket.emit("upgrader:error", "You are not logged in!");
          if (!betAmount || !item || typeof isUnder !== 'boolean') {
            return socket.emit("upgrader:error", "Invalid game data provided.");
          }

          if(parseFloat(betAmount) == NaN)
            return socket.emit("upgrader:error", "Invalid game data provided.");

          if(!item.name || !item.price || !item.image)
            return socket.emit("upgrader:error", "Invalid game data provided.");

          // More validation on the bet value
          const { minBetAmount, maxBetAmount } = config.games.upgrader;
          if (
            parseFloat(betAmount.toFixed(2)) < minBetAmount ||
            parseFloat(betAmount.toFixed(2)) > maxBetAmount
          ) {
            return socket.emit(
              "upgrader:error",
              `Your bet must be a minimum of ${minBetAmount} credits and a maximum of ${maxBetAmount} credits!`
            );
          }

          const maxTicket = 1000000001;
          const ticketChance = calculateChance(betAmount, item.price, maxTicket, isUnder);

          if((betAmount / item.price) * 100 > 80) 
            return socket.emit("upgrader:error", "Upgrader chance can't exceed 80%!");

          if(ticketChance >= maxTicket)
            return socket.emit("upgrader:error", "Invalid game data provided.");

          // Get battles enabled status
          const isEnabled = getUpgraderState();
      
          // If battles is disabled
          if (!isEnabled) {
            return socket.emit(
              "upgrader:error",
              "Upgrader is currently disabled! Contact admins for more information."
            );
          }   

          try {
            const fairSession = await ProvablyFair.findOne({ _user: user.id }).sort({ created: -1 });

            if (!fairSession)
              return socket.emit("upgrader:error", "No seed pair session found!");
      
            const dbUser = await User.findOne({ _id: user.id });

            if (dbUser.betsLocked) {
              return socket.emit(
                "upgrader:error",
                "Your account has an betting restriction. Please contact support for more information."
              );
            }

            if (dbUser.wallet < parseFloat(betAmount.toFixed(2))) {
              return socket.emit("upgrader:error", "You can't afford to create this battle!");
            }

            const { serverSeed, clientSeed, serverSeedHash } = fairSession;

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
            io.of("/upgrader").to(user.id).emit("update-wallet", -Math.abs(parseFloat(betAmount.toFixed(2))));

            fairSession.nonce += 1;
            await fairSession.save();

            const roll = getRandomRollValue(fairSession.serverSeed, fairSession.clientSeed, fairSession.nonce);
            const multiplier = calculateMultiplier(betAmount, item.price);
            const isSuccess = (isUnder && roll <= ticketChance) || (!isUnder && roll > ticketChance);
            const winAmount = isSuccess ? betAmount * multiplier : 0;
      
            const newGame = new UpgraderGame({
              betAmount,
              item,
              isUnder,
              roll,
              multiplier,
              winAmount,
              success: isSuccess,
              seedPairId: fairSession._id,
              serverSeed,
              serverSeedHash,
              clientSeed,
              nonce: fairSession.nonce,
              _user: dbUser._id
            });
            await newGame.save();

                      
            insertNewWalletTransaction(user.id, -Math.abs(parseFloat(betAmount.toFixed(2))), "Upgrader attempt", { upgraderGameId: newGame._id });
            await checkAndEnterRace(user.id, Math.abs(parseFloat(betAmount.toFixed(2))));
            const houseRake = parseFloat(betAmount.toFixed(2)) * config.games.upgrader.houseEdge;
            await checkAndApplyRakeToRace(houseRake * 0.05);
            await checkAndApplyRakeback(user.id, houseRake);
            await checkAndApplyAffiliatorCut(user.id, houseRake);

            socket.emit("upgrader:result", {
              success: isSuccess,
              ticket: roll
            });

            if(isSuccess) {
              insertNewWalletTransaction(user.id, Math.abs(parseFloat(winAmount.toFixed(2))), "Upgrader success", { upgraderGameId: newGame._id });
              await User.updateOne(
                { _id: user.id },
                {
                  $inc: {
                    wallet: Math.abs(parseFloat(winAmount.toFixed(2))),
                    betsPlaced: +1
                  },
                }
              );
              setTimeout(() => {
                io.of("/upgrader").to(user.id).emit("update-wallet", Math.abs(parseFloat(winAmount.toFixed(2))));
              }, 5000);
            };

            return;    
          } catch (error) {
            console.error(error);

            return socket.emit(
              "upgrader:error",
              "There was an error while proccessing your upgrade request."
            );
          }
        });
    });
  };

  module.exports = { listen };