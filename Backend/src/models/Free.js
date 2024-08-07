// Require Dependencies
const mongoose = require("mongoose");
const SchemaTypes = mongoose.Schema.Types;

// Setup CouponCode Schema
const FreeSchema = new mongoose.Schema({
  action: String,
  amount: Number,

  to: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    defualt: null
  },

  from: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    defualt: null
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
const Free = (module.exports = mongoose.model(
  "Free",
  FreeSchema
));
