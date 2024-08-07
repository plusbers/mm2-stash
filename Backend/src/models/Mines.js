const mongoose = require("mongoose");

// Define the Mines game schema
const minesGameSchema = new mongoose.Schema({
  gameId: { type: String, required: true },
  userId: { type: String, required: true },
  amount: { type: Number, required: true },
  minesCount: { type: Number, required: true },
  time: { type: Date, default: Date.now },
  status: { type: String, default: "inprogress" },
  multiplier: { type: Number, default: 1 },
  profit: { type: Number, default: 1 },
  grid: [
    {
      isMine: { type: Boolean, default: false },
      revealed: { type: Boolean, default: false }
      // Add other properties as needed
    }
  ]
});

// Create a Mongoose model based on the schema
const MinesGame = mongoose.model("MinesGame", minesGameSchema);

module.exports = MinesGame;
