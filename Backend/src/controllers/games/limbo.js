// Require Dependencies
const jwt = require("jsonwebtoken");
const { parallelLimit } = require("async");
const _ = require("lodash");
const throttlerController = require("../throttler");
const config = require("../../config");
const colors = require("colors");
const {
  generatePrivateSeedHashPair,
} = require("../random");
const { verifyRecaptchaResponse } = require("../recaptcha");

const { checkAndEnterRace, checkAndApplyRakeToRace } = require("../race");
const { checkAndApplyRakeback } = require("../vip");
const { checkAndApplyAffiliatorCut } = require("../affiliates");
const insertNewWalletTransaction = require("../../utils/insertNewWalletTransaction");
const fs = require('fs');

const User = require("../../models/User");
const LimboGame = require("../../models/LimboGame");
const seedrandom = require("seedrandom");

const CryptoJS = require("crypto-js");


// Get socket.io instance
const listen = async (io) => {
  const delay = (ms) => {
    return new Promise((resolve) => setTimeout(resolve, ms));
  };

  let lastRequestTime = 0;
  const requestInterval = 1000;

  // Listen for new websocket connections
  io.of("/limbo").on("connection", socket => {
    let loggedIn = false;
    let user = null;

    // Throttle connections
    socket.use(throttlerController(socket));
    const HOUSE_EDGE = 4;
    const MAX_MULTIPLIER = 1000.00;
    
    function generateRandomString(length) {
      const characters =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
      let result = "";
      for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
      }
      return result;
    }
    
    async function handlelimbo(amount, multiplier) {
      try {
        if (!user || !user._id) {
          return socket.emit(
            "game-creation-error",
            "You are not logged in!"
          );
       }
    
        const foundUser = await User.findOne({ _id: user._id });
        
        if (!foundUser || foundUser.wallet <= 0) {
          throw new Error('Insufficient balance');
        }
    
        if (multiplier < 1.01) {
          return socket.emit(
            "game-creation-error",
            "Multiplier can't be lower than 1.01"
          );
        }

        if (foundUser.wallet <= amount) {
          return socket.emit(
            "game-creation-error",
            "You can't afford this bet!"
          );
        }
        const { minBetAmount, maxBetAmount } = config.games.limbo;
        if (
          amount < minBetAmount ||
          amount > maxBetAmount
        ) {
          return socket.emit(
            "game-creation-error",
            `Your bet must be a minimum of ${minBetAmount} dls and a maximum of ${maxBetAmount} dls!`
          );
        }
        if (!loggedIn) {
          return socket.emit(
            "game-creation-error",
            "You are not logged in!"
          );
        }
        if(isNaN(amount) || amount <= 0) {
          return socket.emit(
            "game-creation-error",
            "Invalid Amount"
          );
        }
  
        // Generate random game seed and client seed for each request
        const gameSeed = generateRandomString(32); // Generate a new game seed for each request
        const clientSeed = generateRandomString(32); // Generate a new client seed for each request
    
        function sha256(s) {
          return CryptoJS.SHA256(s).toString(CryptoJS.enc.Hex);
        }
    
        function clamp(num, min, max) {
          return Math.min(Math.max(num, min), max);
        }
    
        function getGameHash(gameSeed, clientSeed) {
          return CryptoJS.HmacSHA256(clientSeed, gameSeed).toString(CryptoJS.enc.Hex);
        }
    
        function getNumberFromHash(gameHash) {
          return parseInt(gameHash.slice(0, 52 / 4), 16);
        }
    
        function getCrashPoint(gameHash) {
          const n = getNumberFromHash(gameHash);
          const e = Math.pow(2, 52);
          const num = Math.floor(((100 - HOUSE_EDGE) * e - n) / (e - n)) / 100;
          return clamp(num, 1.00, MAX_MULTIPLIER);
        }
    
        const gameHash = getGameHash(sha256(gameSeed), sha256(clientSeed));
        const crashPoint = getCrashPoint(gameHash);
    
        let status, payout;
    
        if (crashPoint > multiplier) {
          // Player wins
          status = 'WIN';
          payout = amount * multiplier - amount;

          let newGame = new LimboGame({
            betAmount: amount,
            multi: multiplier,
            serverSeed: `${gameSeed}`,
            serverHash: `${gameHash}`,
            clientSeed,
            _user: user._id,
          });
          await newGame.save();
    
          console.log('Amount:', amount);
          console.log('Multiplier:', multiplier);
          console.log('Payout:', payout);
          console.log(gameHash)
          console.log(gameSeed)
          console.log(clientSeed)

          await User.updateOne(
            { _id: user._id },
            {
              $inc: {
                wallet: +Math.abs(payout),
                wager: +Math.abs(payout),
                wagerNeededForWithdraw: -Math.abs(amount),

              }
            }
            
          );

          socket.emit("update-wallet", +Math.abs(payout));
          insertNewWalletTransaction(
            user.id,
            -Math.abs(amount),
            "Limbo Play"
          );
          insertNewWalletTransaction(
            user.id,
            +Math.abs(payout),
            "Limbo Win"
          );
          await checkAndEnterRace(user.id, Math.abs(payout));
          const houseEdge =
          parseFloat(amount) *
          config.games.limbo.feePercentage;

        // Apply user's rakeback if eligible
        await checkAndApplyRakeback(user.id, houseEdge);

        // Apply cut of house edge to user's affiliator
        await checkAndApplyAffiliatorCut(user.id, houseEdge);
            // Generate pre-roll provably fair data
            const provablyData = await generatePrivateSeedHashPair();

        } else {
          // Player loses
          status = 'LOSE';
          payout = 0;
    
          console.log('Amount:', amount);
          console.log('Payout:', payout);
    
          await User.updateOne(
            { _id: user._id },
            {
              $inc: {
                wallet: -Math.abs(amount),
                wager: +Math.abs(amount),
                wagerNeededForWithdraw: -Math.abs(amount),
              }
            }
          );
          socket.emit("update-wallet", -Math.abs(amount));
          insertNewWalletTransaction(
            user.id,
            -Math.abs(amount),
            "Limbo Lose"
          );
          await checkAndEnterRace(user.id, Math.abs(amount));
          const houseEdge =
          parseFloat(amount) *
          config.games.limbo.feePercentage;

        // Apply user's rakeback if eligible
        await checkAndApplyRakeback(user.id, houseEdge);

        // Apply cut of house edge to user's affiliator
        await checkAndApplyAffiliatorCut(user.id, houseEdge);
            // Generate pre-roll provably fair data
            const provablyData = await generatePrivateSeedHashPair();

        }

        let newGame = new LimboGame({
          betAmount: amount,
          multi: multiplier,
          serverSeed: `${gameSeed}`,
          serverHash: `${gameHash}`,
          clientSeed,
          _user: user._id,
        });
        await newGame.save();
      
        // Return the result of the bet
        return { payout, crashpoint: crashPoint };
      } catch (error) {
        // Handle errors
        console.error('Error handling bet:', error);
        throw error;
      }
    }
    
    
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
            loggedIn = false;
            user = null;
            return socket.emit("user banned");
          } else {
            loggedIn = true;
            socket.join(String(user._id));
          }
        }
      } catch (error) {
        loggedIn = false;
        user = null;
        return socket.emit("notify:error", "Authentication token is not valid");
      }
    });

    // Check for user's ban status
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

    // Handling limbo bets
    socket.on("limbo:bet", async ({ amount, multiplier }) => {
      try {
        const currentTime = Date.now();
        if (currentTime - lastRequestTime < requestInterval) {
          socket.emit("limbo:error", "Rate limit exceeded. Please try again later.");
          return;
        }
        lastRequestTime = currentTime;

        const result = await handlelimbo(amount, multiplier);

        socket.emit("limbo:result", result);
      } catch (error) {
        console.error(error);
        return socket.emit("limbo:error", "Error occurred while processing bet");
      }
    });
  });
};

// Export function
module.exports = {
  listen,
};
