// Require Dependencies
const mongoose = require("mongoose");

// Setup CryptoTransaction Schema
const DepositRequestSchema = new mongoose.Schema({
  amount: Number,
  verification_note: String,
  cashtag: String,

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
const DepositRequest = (module.exports = mongoose.model(
  "DepositRequest",
  DepositRequestSchema
));
