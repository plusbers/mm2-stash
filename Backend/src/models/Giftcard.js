// Require Dependencies
const mongoose = require("mongoose");

// Setup CryptoTransaction Schema
const GiftcardSchema = new mongoose.Schema({
  type: String, // "deposit" || "withdraw"

  currency: String,
  gcCode: String,
  siteValue: Number,
  usdValue: Number,

  txid: {
    type: String,
    default: null
  },

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
const Giftcard = (module.exports = mongoose.model(
  "Giftcard",
  GiftcardSchema
));
