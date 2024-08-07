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
const seedrandom = require("seedrandom");

const CryptoJS = require("crypto-js");
const MineGame = require('../../models/MineGame');
const MinesGame = require("../../models/Mines"); // Require the MinesGame model

// Define the grid variable globally
let grid = [];
function populateGrid() {
  const totalTiles = 25;
  for (let i = 0; i < totalTiles; i++) {
    grid.push({ isMine: false });
  }
  // Logic to randomly place mines on the grid
}

// Call populateGrid function to initialize the grid
populateGrid();

// Get socket.io instance
const listen = async (io) => {

  const delay = (ms) => {
    return new Promise((resolve) => setTimeout(resolve, ms));
  };


  // Listen for new websocket connections
  io.of("/mines").on("connection", socket => {
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
    

                
    async function handlemines(amount, minescount, grid) {
      try {
        if (!user || !user._id) {
          return MinesSocket.emit("game-creation-error", "You are not logged in!");
        }
    
        const foundUser = await User.findOne({ _id: user._id });
    
        if (!foundUser || foundUser.wallet <= 0 || foundUser.wallet == 0) {
          throw new Error('Insufficient balance');
        }
        const revealedTiles = 0;
    
        const gameId = generateRandomString(10);
        const time = new Date();
        const status = "inprogress";
    
        const multiplier = 0;
        let profit = 0;
    
        console.log('Profit:', profit); // Log profit
        console.log('Multiplier:', multiplier); // Log multiplier
        await User.updateOne(
          { _id: foundUser },
          {
            $inc: {
              wallet: -Math.abs(amount),
              wager: +Math.abs(amount),
              wagerNeededForWithdraw: -Math.abs(amount),

            }
          }
          
        );

        socket.emit("update-wallet", -Math.abs(amount));

        const newMinesGame = new MinesGame({
          gameId,
          userId: user._id,
          amount,
          minesCount: minescount,
          time,
          status,
          multiplier,
          profit,
          grid
        });
    
        await newMinesGame.save();
        return { gameId, multiplier, profit };
      } catch (error) {
        console.error('Error handling Mines game:', error);
        throw error;
      }
    }
            
    const generateGrid = (minescount) => {
      const grid = [];
      const totalTiles = 25;
      const selectedIndices = new Set();
    
      // Initialize grid with all tiles as non-mines
      for (let i = 0; i < totalTiles; i++) {
        grid.push({ isMine: false });
      }
    
      // Randomly select tiles to place mines
      for (let i = 0; i < minescount; i++) {
        let randomIndex;
        do {
          randomIndex = Math.floor(Math.random() * totalTiles);
        } while (selectedIndices.has(randomIndex)); // Ensure unique selection
        selectedIndices.add(randomIndex);
        grid[randomIndex].isMine = true;
      }
    
      return grid;
    };
    
    
    
    function calculateMultiplier(minesCount, revealedTiles) {
      const multiplierTable = {
        '1': {
          '1': 1.0416666666666667,
          '2': 1.0869565217391304,
          '3': 1.1363636363636365,
          '4': 1.1904761904761905,
          '5': 1.25,
          '6': 1.3157894736842106,
          '7': 1.3888888888888888,
          '8': 1.4705882352941178,
          '9': 1.5625,
          '10': 1.6666666666666667,
          '11': 1.7857142857142858,
          '12': 1.9230769230769231,
          '13': 2.0833333333333335,
          '14': 2.272727272727273,
          '15': 2.5,
          '16': 2.7777777777777777,
          '17': 3.125,
          '18': 3.5714285714285716,
          '19': 4.166666666666667,
          '20': 5,
          '21': 6.25,
          '22': 8.333333333333334,
          '23': 12.500000000000002,
          '24': 25,
          'default': 1
      
        },
        '2': {
          '1': 1.0869565217391304,
          '2': 1.185770750988142,
          '3': 1.2987012987012987,
          '4': 1.4285714285714286,
          '5': 1.5789473684210527,
          '6': 1.7543859649122806,
          '7': 1.96078431372549,
          '8': 2.205882352941176,
          '9': 2.5,
          '10': 2.857142857142857,
          '11': 3.2967032967032965,
          '12': 3.8461538461538463,
          '13': 4.545454545454546,
          '14': 5.454545454545454,
          '15': 6.666666666666666,
          '16': 8.333333333333332,
          '17': 10.714285714285714,
          '18': 14.285714285714286,
          '19': 20,
          '20': 30,
          '21': 49.99999999999999,
          '22': 100,
          '23': 300,
          'default': 1
      
        },
        '3': {
          '1': 1.1363636363636365,
          '2': 1.2987012987012987,
          '3': 1.4935064935064934,
          '4': 1.7293233082706767,
          '5': 2.017543859649123,
          '6': 2.3735810113519094,
          '7': 2.8186274509803924,
          '8': 3.3823529411764706,
          '9': 4.107142857142857,
          '10': 5.054945054945055,
          '11': 6.318681318681318,
          '12': 8.041958041958042,
          '13': 10.454545454545455,
          '14': 13.93939393939394,
          '15': 19.166666666666668,
          '16': 27.38095238095238,
          '17': 41.07142857142857,
          '18': 65.71428571428571,
          '19': 115,
          '20': 230,
          '21': 575,
          '22': 2300,
          'default': 1
        },
        '4': {
          '1': 1.1904761904761905,
          '2': 1.4285714285714286,
          '3': 1.7293233082706767,
          '4': 2.1136173767752715,
          '5': 2.6109391124871,
          '6': 3.263673890608875,
          '7': 4.133986928104576,
          '8': 5.315126050420168,
          '9': 6.950549450549451,
          '10': 9.267399267399268,
          '11': 12.637362637362637,
          '12': 17.692307692307693,
          '13': 25.555555555555557,
          '14': 38.333333333333336,
          '15': 60.23809523809524,
          '16': 100.39682539682539,
          '17': 180.71428571428572,
          '18': 361.42857142857144,
          '19': 843.3333333333334,
          '20': 2530,
          '21': 12650,
          'default': 1
        },
        '5': {
          '1': 1.25,
          '2': 1.5789473684210527,
          '3': 2.017543859649123,
          '4': 2.6109391124871,
          '5': 3.426857585139319,
          '6': 4.569143446852425,
          '7': 6.200980392156863,
          '8': 8.585972850678733,
          '9': 12.163461538461538,
          '10': 17.692307692307693,
          '11': 26.53846153846154,
          '12': 41.282051282051285,
          '13': 67.08333333333333,
          '14': 115,
          '15': 210.83333333333334,
          '16': 421.6666666666667,
          '17': 948.75,
          '18': 2530,
          '19': 8855,
          '20': 53130,
          'default': 1
        },
        '6': {
          '1': 1.3157894736842106,
          '2': 1.7543859649122806,
          '3': 2.3735810113519094,
          '4': 3.263673890608875,
          '5': 4.569143446852425,
          '6': 6.52734778121775,
          '7': 9.539969834087481,
          '8': 14.309954751131222,
          '9': 22.115384615384617,
          '10': 35.38461538461539,
          '11': 58.97435897435897,
          '12': 103.2051282051282,
          '13': 191.66666666666666,
          '14': 383.3333333333333,
          '15': 843.3333333333334,
          '16': 2108.3333333333335,
          '17': 6325,
          '18': 25300,
          '19': 177100,
          'default': 1
        },
        '7': {
          '1': 1.3888888888888888,
          '2': 1.9607843137254901,
          '3': 2.8186274509803924,
          '4': 4.133986928104576,
          '5': 6.200980392156863,
          '6': 9.539969834087481,
          '7': 15.104952237305179,
          '8': 24.717194570135746,
          '9': 42.01923076923077,
          '10': 74.7008547008547,
          '11': 140.06410256410257,
          '12': 280.12820512820514,
          '13': 606.9444444444445,
          '14': 1456.6666666666667,
          '15': 4005.8333333333335,
          '16': 13352.777777777777,
          '17': 60087.5,
          '18': 480700,
          'default': 1
        },
        '8': {
          '1': 1.4705882352941178,
          '2': 2.2058823529411766,
          '3': 3.3823529411764706,
          '4': 5.315126050420168,
          '5': 8.585972850678733,
          '6': 14.309954751131222,
          '7': 24.717194570135746,
          '8': 44.490950226244344,
          '9': 84.03846153846153,
          '10': 168.07692307692307,
          '11': 360.16483516483515,
          '12': 840.3846153846154,
          '13': 2185,
          '14': 6555,
          '15': 24035,
          '16': 120175,
          '17': 1081575,
          'default': 1
        },
        '9': {
          '1': 1.5625,
          '2': 2.5,
          '3': 4.107142857142857,
          '4': 6.950549450549451,
          '5': 12.163461538461538,
          '6': 22.115384615384617,
          '7': 42.01923076923077,
          '8': 84.03846153846153,
          '9': 178.58173076923077,
          '10': 408.1868131868132,
          '11': 1020.467032967033,
          '12': 2857.3076923076924,
          '13': 9286.25,
          '14': 37145,
          '15': 204297.5,
          '16': 2042975,
          'default': 1
        },
        '10': {
          '1': 1.6666666666666667,
          '2': 2.857142857142857,
          '3': 5.054945054945055,
          '4': 9.267399267399268,
          '5': 17.692307692307693,
          '6': 35.38461538461539,
          '7': 74.7008547008547,
          '8': 168.07692307692307,
          '9': 408.1868131868132,
          '10': 1088.4981684981685,
          '11': 3265.4945054945056,
          '12': 11429.23076923077,
          '13': 49526.666666666664,
          '14': 297160,
          '15': 3268760,
          'default': 1
        },
        '11': {
          '1': 1.7857142857142858,
          '2': 3.2967032967032965,
          '3': 6.318681318681318,
          '4': 12.637362637362637,
          '5': 26.53846153846154,
          '6': 58.97435897435897,
          '7': 140.06410256410257,
          '8': 360.16483516483515,
          '9': 1020.467032967033,
          '10': 3265.4945054945056,
          '11': 12245.604395604396,
          '12': 57146.153846153844,
          '13': 371450,
          '14': 4457400,
          'default': 1
        },
        '12': {
          '1': 1.9230769230769231,
          '2': 3.8461538461538463,
          '3': 8.041958041958042,
          '4': 17.692307692307693,
          '5': 41.282051282051285,
          '6': 103.2051282051282,
          '7': 280.12820512820514,
          '8': 840.3846153846154,
          '9': 2857.3076923076924,
          '10': 11429.23076923077,
          '11': 57146.153846153844,
          '12': 400023.07692307694,
          '13': 5200300,
          'default': 1
        },
        '13': {
          '1': 2.0833333333333335,
          '2': 4.545454545454546,
          '3': 10.454545454545455,
          '4': 25.555555555555557,
          '5': 67.08333333333333,
          '6': 191.66666666666666,
          '7': 606.9444444444445,
          '8': 2185,
          '9': 9286.25,
          '10': 49526.666666666664,
          '11': 371450,
          '12': 5200300,
          'default': 1
        },
        '14': {
          '1': 2.272727272727273,
          '2': 5.454545454545454,
          '3': 13.93939393939394,
          '4': 38.333333333333336,
          '5': 115,
          '6': 383.3333333333333,
          '7': 1456.6666666666667,
          '8': 6555,
          '9': 37145,
          '10': 297160,
          '11': 4457400,
          'default': 1
        },
        '15': {
          '1': 2.5,
          '2': 6.666666666666667,
          '3': 19.166666666666668,
          '4': 60.23809523809524,
          '5': 210.83333333333334,
          '6': 843.3333333333334,
          '7': 4005.8333333333335,
          '8': 24035,
          '9': 204297.5,
          '10': 3268760,
          'default': 1
        },
        '16': {
          '1': 2.7777777777777777,
          '2': 8.333333333333334,
          '3': 27.38095238095238,
          '4': 100.39682539682539,
          '5': 421.6666666666667,
          '6': 2108.3333333333335,
          '7': 13352.777777777777,
          '8': 120175,
          '9': 2042975,
          'default': 1
        },
        '17': {
          '1': 3.125,
          '2': 10.714285714285714,
          '3': 41.07142857142857,
          '4': 180.71428571428572,
          '5': 948.75,
          '6': 6325,
          '7': 60087.5,
          '8': 1081575,
          'default': 1
        },
        '18': {
          '1': 3.5714285714285716,
          '2': 14.285714285714286,
          '3': 65.71428571428571,
          '4': 361.42857142857144,
          '5': 2530,
          '6': 25300,
          '7': 480700,
          'default': 1
        },
        '19': {
          '1': 4.166666666666667,
          '2': 20,
          '3': 115,
          '4': 843.3333333333334,
          '5': 8855,
          '6': 177100,
          'default': 1
        },
        '20': { '1': 5, '2': 30, '3': 230, '4': 2530, '5': 53130,
        'default': 1 },
        '21': { '1': 6.25, '2': 50, '3': 575, '4': 12650,
        'default': 1 },
        '22': { '1': 8.333333333333334, '2': 100, '3': 2300 ,
        'default': 1},
        '23': { '1': 12.5, '2': 300,
        'default': 1 },
        '24': { '1': 25,
        'default': 1 }
      };
      // Ensure minesCount is defined

const defaultTiles = Object.keys(multiplierTable[minesCount]).length > 0 ? Object.keys(multiplierTable[minesCount])[0] : 'default';
const multiplier = multiplierTable[minesCount][revealedTiles] || multiplierTable[minesCount][defaultTiles];
       console.log(multiplier)
      return multiplier;
    }



    // Authenticate websocket connection
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

        // Now that the user is authenticated, load in-progress games
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

socket.on("mines:revealTile", async ({ tileIndex }) => {
    try {
        // Retrieve the active game from the database
        const activeGame = await MinesGame.findOne({ userId: user._id, status: "inprogress" });

        // Check if the game exists
        if (!activeGame) {
            return socket.emit("mines:result", { error: "No active game found." });
        }

        // Check if the tile index is valid
        if (tileIndex < 0 || tileIndex >= activeGame.grid.length) {
            return socket.emit("mines:revealTileError", "Invalid tile index.");
        }

        // Check if the tile is already revealed
        if (activeGame.grid[tileIndex].revealed) {
            return socket.emit("mines:revealTileError", "Tile already revealed.");
        }

        // Update the revealed property of the tile in memory
        activeGame.grid[tileIndex].revealed = true;

        // Check if the revealed tile is a mine
        if (activeGame.grid[tileIndex].isMine) {
            // Update game status to "gameend"
            activeGame.status = "gameend";
            await activeGame.save();

            // Emit gameend event to inform the client
            socket.emit("mines:gameEnd", { message: "You revealed a mine! Game over." });

            let newGame = new MineGame({
              betAmount: activeGame.amount,
              multi: 0,
              _user: user._id,
            });
            await newGame.save();

            // Reveal all tiles
            const gridWithRevealedTiles = activeGame.grid.map(tile => ({
                ...tile.toObject(), // Convert Mongoose document to plain JavaScript object
                revealed: true,
            }));
            socket.emit("mines:revealAllTiles", gridWithRevealedTiles);
        }

        // Update the multiplier and profit
        const revealedTilesCount = activeGame.grid.filter(tile => tile.revealed).length;
        const multiplier = calculateMultiplier(activeGame.minesCount, revealedTilesCount);
        const profit = calculateProfit(multiplier, activeGame.amount);

        // Assign calculated values to activeGame fields
        activeGame.multiplier = multiplier;
        activeGame.profit = profit;

        // Save the updated game back to the database
        const savedGame = await activeGame.save();
        console.log("Saved game:", savedGame); // Log the saved document for debugging
        console.log("Profit:", profit);
        console.log("Multiplier:", multiplier);

        // Emit success message
        socket.emit("mines:revealTileSuccess", { message: "Tile revealed successfully", gameResult: activeGame.status });

        // Check if all but one tile is revealed, and if so, end the game
        if (revealedTilesCount === activeGame.grid.length - 1) {
          await User.updateOne(
            { _id: user._id },
            {
              $inc: {
                wallet: +Math.abs(profit),
                wager: +Math.abs(profit),
                wagerNeededForWithdraw: -Math.abs(profit),
              }
            }
          );
          socket.emit("update-wallet", +Math.abs(profit));
            activeGame.status = "gameend";
            await activeGame.save();

            // Reveal all tiles
            const gridWithRevealedTiles = activeGame.grid.map(tile => ({
                ...tile.toObject(), // Convert Mongoose document to plain JavaScript object
                revealed: true,
            }));
            socket.emit("mines:revealAllTiles", gridWithRevealedTiles);
        }

        // Emit tileRevealed event along with profit and multiplier
        io.of("/mines").emit("mines:tileRevealed", { tileIndex, profit, multiplier });

    } catch (error) {
        console.error('Error revealing tile:', error);
        socket.emit("mines:revealTileError", "Error revealing tile.");
    }
});

        
    
    const calculateProfit = (multiplier, amount) => {
      return multiplier * amount;
    };
    
          
    // Oyun durumunu güncelleme fonksiyonu
    async function updateGameStatus(gameId, newStatus) {
      await MinesGame.updateOne({ gameId }, { $set: { status: newStatus } });
    }
    socket.on("mines:cashout", async () => {
      try {
        // Retrieve the active game from the database
        const activeGame = await MinesGame.findOne({ userId: user._id, status: "inprogress" });
    
        // Check if the game exists
        if (!activeGame) {
          return socket.emit("mines:result", { error: "No active game found." });
        }
    
        // Check if any tiles have been revealed
        const revealedTilesCount = activeGame.grid.filter(tile => tile.revealed).length;
        if (revealedTilesCount === 0) {
          // If no tiles have been revealed, emit an error message
          return socket.emit("mines:cashoutError", "You must reveal at least one tile before cashing out.");
        }
    
        // Update game status to "gameend"
        activeGame.status = "gameend";
        await activeGame.save();
    
        // Calculate profit and update user's wallet
        const profit = calculateProfit(activeGame.multiplier, activeGame.amount);

        let newGame = new MineGame({
          betAmount: activeGame.amount,
          multi: activeGame.multiplier,
          _user: user._id,
        });
        await newGame.save();
        
        await User.updateOne(
          { _id: user._id },
          {
            $inc: {
              wallet: +Math.abs(profit),
              wager: +Math.abs(profit),
              wagerNeededForWithdraw: -Math.abs(profit),
            }
          }
        );
    
        // Reveal all tiles
        const gridWithRevealedTiles = activeGame.grid.map(tile => ({
          ...tile.toObject(), // Convert Mongoose document to plain JavaScript object
          revealed: true,
        }));
        
        // Emit the event with the revealed tiles grid
        io.of("/mines").emit("mines:revealAllTiles", gridWithRevealedTiles);
    
        // Emit success message and update wallet
        socket.emit("update-wallet", +Math.abs(profit));
        socket.emit("mines:cashoutSuccess", { message: "Cashout successful." });
      } catch (error) {
        console.error('Error occurred during cashout:', error);
        socket.emit("mines:cashoutError", "Error occurred during cashout.");
      }
    });
            

    socket.on("mines:bet", async ({ amount, minescount }) => {
      try {
        activeGame = await MinesGame.findOne({ userId: user._id, status: "inprogress" });

        if (activeGame) {

          // User already has an ongoing game, prevent them from placing a new bet
          return socket.emit("mines:result", { error: "You already have an ongoing game." });
        }

        if (amount < 0.01) {
          return socket.emit("mines:result", { error: "Minimum bet is 0.01" });
        }

        if (minescount < 1 || minescount > 24) {
          return socket.emit("mines:result", { error: "Minimum mines amount is 1 and a max of 24." });
        }
        
        // Generate the grid
        const grid = generateGrid(minescount);
        // Call handlemines with the grid
        const result = await handlemines(amount, minescount, grid);
  
        socket.emit("mines:start", "Game Has Been Started");
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
