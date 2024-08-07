// Require Dependencies
const mongoose = require("mongoose");
const SchemaTypes = mongoose.SchemaTypes;

// Setup CoinflipGame Schema
const CoinflipGameSchema = new mongoose.Schema({
  game_type: String,
  requirements: Object,

  privateSeed: String,
  privateHash: String,
  
  publicSeed: {
    type: String,
    default: null,
  },
  randomModule: {
    type: Number,
    default: null,
  },

  pf_id: {
    type: String,
    defualt: null
  },

  ticket: {
    type: String,
    defualt: null
  },

  joiner: {
    type: Object,
    default: null
  },

  starter: {
    type: Object,
    defualt: null
  },

  status: {
    type: String,
    default: "open"
  },

  winner: {
    type: String,
    default: null
  },

  // When game was created
  created: {
    type: Date,
    default: Date.now,
  },
});

// Create and export the new model
const CoinflipGame = (module.exports = mongoose.model("CoinflipGame", CoinflipGameSchema));
