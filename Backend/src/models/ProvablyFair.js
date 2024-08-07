// Require Dependencies
const mongoose = require("mongoose");

// Setup CryptoTransaction Schema
const ProvablyFairSchema = new mongoose.Schema({

  serverSeed: String,
  serverSeedHash: String,
  clientSeed: String,
  nonce: Number,

  nextServerSeed: String,
  nextServerSeedHash: String,

  _user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },

  created: {
    type: Date,
    default: Date.now,
  },
});

// Create and export the new model
const ProvablyFair = (module.exports = mongoose.model(
  "ProvablyFair",
  ProvablyFairSchema
));
