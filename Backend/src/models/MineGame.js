const mongoose = require("mongoose");
const SchemaTypes = mongoose.SchemaTypes;

const LimboGameSchema = new mongoose.Schema({
   betAmount: Number,
   multi: Number,
 
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
const LimboGame = (module.exports = mongoose.model("MineGame", LimboGameSchema));