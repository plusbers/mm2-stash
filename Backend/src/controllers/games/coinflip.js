// Require Dependencies
const jwt = require("jsonwebtoken");
const uuid = require("uuid");
const mongoose = require("mongoose");
const throttlerController = require("../throttler");
const config = require("../../config");
const colors = require("colors");
const {
  generatePrivateSeedHashPair,
  generateCoinflipRandom,
} = require("../random");
const { verifyRecaptchaResponse } = require("../recaptcha");
const { checkAndEnterRace, checkAndApplyRakeToRace } = require("../race");
const { checkAndApplyRakeback, getVipLevelFromWager } = require("../vip");
const { checkAndApplyAffiliatorCut } = require("../affiliates");
const { getCoinflipState } = require("../site-settings");
const insertNewWalletTransaction = require("../../utils/insertNewWalletTransaction");

const User = require("../../models/User");
const CoinflipGame = require("../../models/CoinflipGame");
const { parse } = require("querystring");

// Calculate winner from random data
const getWinningSide = async (playerAmount, randomModule) => {
  return new Promise((resolve, reject) => {
    if (playerAmount === 2) {
      resolve(randomModule < 30 ? "heads" : "tails");
    } else if (playerAmount === 3) {
      resolve(randomModule < 20 ? "red" : randomModule < 40 ? "blue" : "green");
    } else if (playerAmount === 4) {
      resolve(
        randomModule < 15
          ? "red"
          : randomModule < 30
            ? "blue"
            : randomModule < 45
              ? "green"
              : "yellow"
      );
    } else {
      reject(new Error("Couldn't calculate winner: Invalid player amount!"));
    }
  });
};

// Client animation length in milliseconds
const CLIENT_ANIMATION_LENGTH = 8500; // animation lenght
let ACTIVE_GAMES = [];
let HEADS_COUNT = 0;
let TAILS_COUNT = 0;

// Get socket.io instance
const listen = io => {

  async function loadGamesToLocal() {
    const games = await CoinflipGame.find({
      status: "open"
    });
    if(games.length > 0) ACTIVE_GAMES = games;

    const games2 = await CoinflipGame.find({
      status: "finised"
    });
    if(games.length < 100) {
      HEADS_COUNT = 50;
      TAILS_COUNT = 50;
    } else {
      for(let game in games) {
        if(game.winner == "heads") HEADS_COUNT++;
        if(game.winner == "tails") TAILS_COUNT++;
      }
    }
  }

  loadGamesToLocal();

  /*setInterval(() => {
    const first = Math.floor(Math.random() * 100) + 1;
    const second = 100 - first;
    io.of("/coinflip").emit("coinflip:100", first, second); 
  }, 10000)*/

  const runGame = async (gid, joiner) => {

    const game = ACTIVE_GAMES.filter((item) => item._id == gid);

    console.log(game._id)

    // Generate random data
    const randomData = await generateCoinflipRandom(
      String(game._id),
      String(game.privateSeed)
    );

    // Calculate winner
    const winningSide = await getWinningSide(
      2,
      randomData.module
    );

    io.of("/coinflip").emit("coinflip:rolled", {
      _id: String(game._id),
      joiner,
      winningSide,
      randomModule: randomData.module,
      publicSeed: randomData.publicSeed,
      privateSeed: String(game.privateSeed),
    });

  }

  // Listen for new websocket connections
  io.of("/coinflip").on("connection", socket => {
    let loggedIn = false;
    let user = null;

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
            // socket.emit("notify-success", "Successfully authenticated!");
          }
        }
        // return socket.emit("alert success", "Socket Authenticated!");
      } catch (error) {
        loggedIn = false;
        user = null;
        return socket.emit("notify-error", "Authentication token is not valid");
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

    socket.on("coinflip:req", async () => {
      socket.emit("coinflip:100", HEADS_COUNT, TAILS_COUNT); 
      let parsedGames = [];
      for (let i = 0; i < ACTIVE_GAMES.length; i++) {
        let game = ACTIVE_GAMES[i];
        game = { ...game, privateSeed: null }
        parsedGames.push(game);
      }
      return socket.emit("coinflip:active", parsedGames); 
    });

    socket.on("coinflip:req-modal", async (gid) => {
      let game = (ACTIVE_GAMES.filter((game) => game._id == gid))[0];
      delete game.privateSeed;
      return socket.emit("coinflip:modal", game); 
    });

    socket.on("coinflip:create", async (items, side) => {
      try {
        if (!loggedIn)
          return socket.emit("coinflip:error2", "You are not logged in!");

        if ("heads" != side && "tails" != side) 
          return socket.emit("coinflip:error2", "Cannot select this side!");

        const dbUser = await User.findOne({ _id: user.id });

        let itemUids = [];
        for(let item of items) {
          itemUids.push(item.uid);
        };

        let realItems = [];
        for(let item of dbUser.inventory) {
          if(!itemUids.includes(item.uid)) continue;
          realItems.push(item);
          if(item.status.locked) return socket.emit("coinflip:error2", "Item(s) are locked!");
        }

        if(realItems.length < 1)
          return socket.emit("coinflip:error2", "No items found.");

        let newInventory = dbUser.inventory;
        for(let item of realItems) {
          const index = newInventory.findIndex(list => item.uid == list.uid);
          newInventory.splice(index, 1);
        }
        await User.findOneAndUpdate({ _id: user.id }, { $set: { inventory: newInventory }});  

        const provablyData = await generatePrivateSeedHashPair();

        const newGame = new CoinflipGame();

        newGame.game_type = "mm2";
        newGame.requirements = {
          "maxiumum": (realItems.reduce((total, item) => total + item.value, 0) * 1.1).toFixed(2),
          "minimum": (realItems.reduce((total, item) => total + item.value, 0) * 0.9).toFixed(2)
        }
        newGame.starter = {
          _id: dbUser._id,
          items: realItems,
          side: side,
          thumbnail: dbUser.avatar,
          username: dbUser.username,
        };

        newGame.privateSeed = provablyData.seed;
        newGame.privateHash = provablyData.hash;

        // Save the document
        await newGame.save();
        ACTIVE_GAMES.push(newGame);

        delete newGame.privateSeed;

        // Notify client
        io.of("/coinflip").emit("coinflip:new", newGame);
        socket.emit("coinflip:success2", "Successfully created a new game!");

        console.log(
          colors.yellow("Coinflip >> Created a new game"),
          newGame.id,
          colors.yellow("worth"),
          realItems.reduce((total, item) => total + item.value, 0) / 1000 + "k",
        );
      } catch (error) {
        console.log("Error while creating Coinflip game:", error);
        return socket.emit("coinflip:error2", "Your bet couldn't be placed: Internal server error, please try again later!");
      }
    });

    socket.on("coinflip:join", async (gid, items, side) => {
      try {
        if (!loggedIn)
          return socket.emit("coinflip:error2", "You are not logged in!");

        if ("heads" != side && "tails" != side) 
          return socket.emit("coinflip:error2", "Cannot select this side!");

        const dbUser = await User.findOne({ _id: user.id });
        const game = ACTIVE_GAMES.filter((item) => item._id == gid);

        if(!game)
          return socket.emit("coinflip:error2", "Game does not exsist!");

        let itemUids = [];
        for(let item of items) {
          itemUids.push(item.uid);
        };

        let realItems = [];
        let totalValue = 0;
        for(let item of dbUser.inventory) {
          if(!itemUids.includes(item.uid)) continue;
          realItems.push(item);
          if(item.status.locked) return socket.emit("coinflip:error2", "Item(s) are locked!");
          // value += item.value;
        }

        //if(game.requirements.minimum <= totalValue && totalValue >= game.requirements.maxiumum)
         // return socket.emit("coinflip:error2", "Items not in the value range!");

        //const index = ACTIVE_GAMES.findIndex(list => item.uid == list.uid);

        const joiner = {
          _id: dbUser._id,
          items: realItems,
          side: side,
          thumbnail: dbUser.avatar,
          username: dbUser.username,
        };
        
        socket.emit("coinflip:success2", "Successfully joined game!");

        runGame(gid, joiner);
      } catch (error) {
        console.log("Error while joining Coinflip game:", error);
        return socket.emit("coinflip:error2", "Your bet couldn't be placed: Internal server error, please try again later!");
      }
    });
    
    socket.on("coinflip:cancel", async (gid) => {
      try {
        if (!loggedIn)
          return socket.emit("coinflip:error", "You are not logged in!");

        const index = ACTIVE_GAMES.findIndex((game) => game._id == gid);

        const game = ACTIVE_GAMES[index];

        if(String(game.starter._id) != user.id)
          return socket.emit("coinflip:error", "You can't cancel a game that isn't yours!");

        ACTIVE_GAMES.splice(index, 1);

        const dbUser = await User.findOne({ _id: user.id });
        let newInventory = dbUser.inventory;
        for(let item of game.starter.items) {
          newInventory.push(item);
        };
        await User.findOneAndUpdate({ _id: dbUser._id }, { $set: { inventory: newInventory }});
        await CoinflipGame.findOneAndUpdate({ _id: String(game._id) }, { $set: { status: "canceled" } });


        io.of("/coinflip").emit("coinflip:remove", game._id);
        socket.emit("coinflip:success", "Successfully canceled game!");
      } catch (error) {
        console.log("Error while caneling Coinflip game:", error);
        return socket.emit("coinflip:error", "Your game couldn't be canceld. Internal server error, please try again later!");
      }
    });

  });
};

// Export functions
module.exports = { listen };
