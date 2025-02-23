// Require Dependencies
const jwt = require("jsonwebtoken");
const { parallelLimit } = require("async");
const _ = require("lodash");
const throttlerController = require("../throttler");
const config = require("../../config");
const colors = require("colors");
const crypto = require("crypto");
const {
  generatePrivateSeedHashPair,
} = require("../random");
const { checkAndEnterRace, checkAndApplyRakeToRace } = require("../race");
const { checkAndApplyRakeback } = require("../vip");
const { checkAndApplyAffiliatorCut } = require("../affiliates");
const insertNewWalletTransaction = require("../../utils/insertNewWalletTransaction");
const fs = require('fs');
const { getCasesState } = require("../site-settings");

const User = require("../../models/User");
const CaseGame = require("../../models/CaseGame");
const ProvablyFair = require("../../models/ProvablyFair");
const caseList = require("./cases.json");
const freeList = require("./freecases.json");

const MINIMUM_CASE_OPEN_INTERVAL = 24 * 60 * 60 * 1000; 

const getRandomRollValue = (serverSeed, clientSeed, nonce) => {
  const min = 0;
  const max = 100000;

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

const getResult = (ticket, caseData) => {

  const item = caseData.items.find(
    (item) => ticket >= item.ticketsStart && ticket <= item.ticketsEnd
  );

  const drop = {
    item: {
      name: item.name,
      color: item.color,
      image: item.image,
      price: item.price,
      ticketsStart: item.ticketsStart,
      ticketsEnd: item.ticketsEnd,
    },
    result: ticket,
  };

  return drop;
}

// Get socket.io instance
const listen = async (io) => { 

  const delay = (ms) => {
    return new Promise((resolve) => setTimeout(resolve, ms));
  };
  

  // Listen for new websocket connections
  io.of("/cases").on("connection", socket => {
    let loggedIn = false;
    let user = null;

    socket.join("cases");

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

    socket.on("cases:reqdata", async (slug) => {
      try {
        if(!slug)
          return socket.emit("cases:error", "Not a valid case slug!");
        
        const caseData = caseList.find(object => object.slug === slug);    

        if(!caseData)
          return socket.emit("cases:error", "Not a valid case slug!");

        if(user) {
          const dbUser = await User.findOne({ _id: user.id });
          return socket.emit("cases:data", {
            case: caseData,
            lastOpen: dbUser.rewards.lastOpen
          });
        }

        return socket.emit("cases:data", {
          case: caseData,
        });
      } catch (error) {
        console.error(error);

        return socket.emit(
          "cases:error",
          "There was an error while getting case data!"
        );
      }
    });

    socket.on("cases:open", async (slug) => {
      try {
        if (!loggedIn)
          return socket.emit("cases:error", "You are not logged in!");
        
        if(!slug)
          return socket.emit("cases:error", "Not a valid case slug!");
        
        const caseData = caseList.find(object => object.slug === slug);

        if(!caseData)
          return socket.emit("cases:error", "Not a valid case slug!");

        const isEnabled = getCasesState();
  
        // If battles is disabled
        if (!isEnabled) {
          return socket.emit(
            "cases:error",
            "Cases is currently disabled! Contact admins for more information."
          );
        }   

        const dbUser = await User.findOne({ _id: user._id });

        // If user has restricted bets
        if (dbUser.betsLocked) {
          return socket.emit(
            "cases:error",
            "Your account has an betting restriction. Please contact support for more information."
          );
        }

        const fairSession = await ProvablyFair.findOne({ _user: dbUser._id }).sort({ created: -1 });

        if (!fairSession)
          return socket.emit("upgrader:error", "No seed pair session found!");

        // If user can afford this bet
        if (dbUser.wallet < parseFloat(caseData.price.toFixed(2))) {
          return socket.emit("cases:error", "You can't afford to open this case!");
        }
        
        const { serverSeed, clientSeed, serverSeedHash } = fairSession;
        
        // Remove bet amount from user's balance
        await User.updateOne(
          { _id: user.id },
          {
            $inc: {
              wallet: -Math.abs(parseFloat(caseData.price.toFixed(2))),
              wager: Math.abs(parseFloat(caseData.price.toFixed(2))),
              wagerNeededForWithdraw: -Math.abs(
                parseFloat(caseData.price.toFixed(2))
              ),
            },
          }
        );

        socket.emit("update-wallet", -Math.abs(caseData.price));
        insertNewWalletTransaction(user._id, -Math.abs(parseFloat(caseData.price.toFixed(2))), "Cases open", { SoloCaseSlug: caseData.slug });

        fairSession.nonce += 1;
        await fairSession.save();

        const roll = getRandomRollValue(fairSession.serverSeed, fairSession.clientSeed, fairSession.nonce);
        const newGame = CaseGame({
          betAmount: caseData.price,
          roll,
          case: caseData,
          caseResult: getResult(roll, caseData),
          seedPairId: fairSession._id,
          serverSeed,
          serverSeedHash,
          clientSeed,
          nonce: fairSession.nonce,
          _user: dbUser._id,
        });
        await newGame.save();
        
        // add winnings amount from user's balance
        await User.updateOne(
          { _id: user.id },
          {
            $inc: {
              wallet: +Math.abs(parseFloat(newGame.caseResult.item.price.toFixed(2))),
            },
          }
        );
        insertNewWalletTransaction(user._id, +Math.abs(parseFloat(newGame.caseResult.item.price.toFixed(2))), "Cases win", { SoloCase: newGame._id });

        socket.emit("cases:opened", {
          case: caseData,
          caseResult: newGame.caseResult.item
        });

        await delay(5750);

        socket.emit("update-wallet", +Math.abs(newGame.caseResult.item.price));

      } catch (error) {
        console.error(error);

        return socket.emit(
          "cases:error",
          "There was an error while opening this case!"
        );
      }
    });

    socket.on("cases:free", async (slug) => {
      try {
        if (!loggedIn)
          return socket.emit("cases:error", "You are not logged in!");
        
        if(!slug)
          return socket.emit("cases:error", "Not a valid case slug!");
        
        const caseData = freeList.find(object => object.slug === slug);

        if(!caseData)
          return socket.emit("cases:error", "Not a valid case slug!");

        const dbUser = await User.findOne({ _id: user._id });

        const lastOpenTimestamp = dbUser.rewards.lastOpen.getTime();
        const currentTime = Date.now();
        if (currentTime - lastOpenTimestamp < MINIMUM_CASE_OPEN_INTERVAL) {
          return socket.emit("cases:error", "You have already opened a case in the last 24 hours.");
        }

        // If user has restricted bets
        if (dbUser.betsLocked) {
          return socket.emit(
            "cases:error",
            "Your account has an betting restriction. Please contact support for more information."
          );
        }

        const fairSession = await ProvablyFair.findOne({ _user: dbUser._id }).sort({ created: -1 });

        if (!fairSession)
          return socket.emit("upgrader:error", "No seed pair session found!");
        
        const { serverSeed, clientSeed, serverSeedHash } = fairSession;

        insertNewWalletTransaction(user._id, -Math.abs(parseFloat(caseData.price.toFixed(2))), "Daily case", { SoloCaseSlug: caseData.slug });

        
        fairSession.nonce += 1;
        await fairSession.save();

        const roll = getRandomRollValue(fairSession.serverSeed, fairSession.clientSeed, fairSession.nonce);
        const newGame = CaseGame({
          betAmount: caseData.price,
          roll,
          case: caseData,
          caseResult: getResult(roll, caseData),
          seedPairId: fairSession._id,
          serverSeed,
          serverSeedHash,
          clientSeed,
          nonce: fairSession.nonce,
          _user: dbUser._id,
        });
        await newGame.save();
        
        // add winnings amount from user's balance
        await User.updateOne(
          { _id: user.id },
          {
            $inc: {
              wallet: +Math.abs(parseFloat(newGame.caseResult.item.price.toFixed(2))),
            },
            $set: {
              "rewards.lastOpen": new Date()
            }
          }
        );
        insertNewWalletTransaction(user._id, +Math.abs(parseFloat(newGame.caseResult.item.price.toFixed(2))), "Daily case win", { SoloCase: newGame._id });

        socket.emit("cases:opened", {
          case: caseData,
          caseResult: newGame.caseResult.item
        });

        await delay(7000);

        socket.emit("update-wallet", +Math.abs(newGame.caseResult.item.price));

      } catch (error) {
        console.error(error);

        return socket.emit(
          "cases:error",
          "There was an error while opening this case!"
        );
      }
    });
  });
};

// Export functions
module.exports = {
  listen,
};