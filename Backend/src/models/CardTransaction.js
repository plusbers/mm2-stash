// Require Dependencies
const mongoose = require("mongoose");

// Setup CardTransaction Schema
const CardTransactionSchema = new mongoose.Schema({
  type: String, // "deposit" || "withdraw"

  currency: String, 
  siteValue: Number,
  usdValue: Number,

  txid: String, // Transaction id
  state: Number, // 0 = not started 1 = pending, 2 = declined, 3 = completed, 4 = manual hold, 5 = refunded, 6 = canceled
  link: String, // Payment link

  arkpayId: {
    type: String,
    default: ""
  },

  store: {
    type: Object,
    default: {}
  },

  email: {
    type: String,
    default: ""
  },

  fee: {
    type: Number,
    default: 0.00
  },

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
const CardTransaction = (module.exports = mongoose.model(
  "CardTransaction",
  CardTransactionSchema
));
