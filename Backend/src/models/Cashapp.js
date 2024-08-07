// Require Dependencies
const mongoose = require("mongoose");

// Setup CryptoTransaction Schema
const CashappSchema = new mongoose.Schema({
  type: String, // "deposit" || "withdraw"

  currency: String, // cash
  siteValue: Number,
  usdValue: Number,

  senderTag: {
    type: String,
    default: "$Desking9"
  },
  recieverTag: String,
  
  cryptoValue: {
    type: String,
    default: null
  },
  
  txid: String,
  webLink: String,

  state: Number, // 1 = pending, 2 = declined, 3 = completed

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
const Cashapp = (module.exports = mongoose.model(
  "cashapp",
  CashappSchema
));
