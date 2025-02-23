// Require Dependencies
const mongoose = require("mongoose");
const SchemaTypes = mongoose.SchemaTypes;

// Setup BattlesGame Schema
const BattlesGameSchema = new mongoose.Schema({
  // Basic fields
  betAmount: Number, 
  privateGame: Boolean,

  playerCount: {
    type: Number,
  },

  // game type
  game_type: {
    type: Number,
    /*
      1 - 1v1
      2 - 1v1v1
      3 - 1v1v1v1
      4 - 2v2
    */
  },
  isCrazyMode: {
    type: Boolean,
    default: false,
  },

  isTerminalMode: {
    type: Boolean,
    default: false,
  },

  //winning data
  win: {
    type: Object,
    default: {}
  },

  // Seed the server creates
  serverSeed: {
    type: String,
    default: null
  },

  // Seed the server creates
  serverSeedHash: {
    type: String,
    default: null
  },

  // # of the EOS block id
  blockNumber: {
    type: Number,
    default: null
  },

  // Seed from EOS block # id
  blockHash: {
    type: String,
    default: null
  },

  // which cases are in the battle
  cases: {
    type: Object
  },

  // case amount pulled for each case
  eachCaseResult: {
    type: Object
  },

  // All players that joined
  players: {
    type: Array,
    default: [],
  },

  // UserID of who created this game
  _creator: {
    type: SchemaTypes.ObjectId,
    ref: "User",
  },

  // Indicates if the bot was called or not
  isBotCalled: {
    type: Boolean,
    default: false,
  },

  // Game status
  status: {
    type: Number,
    default: 1,
    /**
     * Status list:
     *
     * 1 = Waiting
     * 2 = Rolling
     * 3 = Ended
     */
  },

  // When game was created
  created: {
    type: Date,
    default: Date.now,
  },
});

// Create and export the new model
const BattlesGame = (module.exports = mongoose.model("BattlesGame", BattlesGameSchema));
