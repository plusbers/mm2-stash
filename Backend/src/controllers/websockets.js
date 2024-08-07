// Require Dependencies
const socketio = require("socket.io");
const chatController = require("./chat");
const coinflipController = require("./games/coinflip");
const rouletteController = require("./games/roulette");
const battlesController = require("./games/battles");
const casesController = require("./games/cases");
const crashController = require("./games/crash");
const upgraderController = require("./games/upgrader");
const limboController = require("./games/limbo");
const diceController = require("./games/dice");
const MinesController = require("./games/mines");

// const exampleController = require("./games/example");
let io;

// Configure Socket.io
const startSocketServer = (server, app) => {
  try {
    // Main socket.io instance
    io = socketio(server);

    // Make the socket connection accessible at the routes
    app.set("socketio", io);

    // Start listeners
    chatController.listen(io);
    coinflipController.listen(io);
    rouletteController.listen(io);
    battlesController.listen(io);
    casesController.listen(io);
    crashController.listen(io);
    upgraderController.listen(io);
    limboController.listen(io);
    diceController.listen(io);
    MinesController.listen(io);

    // exampleController.listen(io);

    console.log("WebSocket >>", "Connected!");
    return io;
  } catch (error) {
    console.log(`WebSocket ERROR >> ${error.message}`);

    // Exit current process with failure
    process.exit(1);
  }
};

// Export functions
module.exports = { startSocketServer, io };
