const mongoose = require("mongoose");
const SchemaTypes = mongoose.SchemaTypes;

const LimboGameSchema = new mongoose.Schema({
   betAmount: Number,
   multi: Number,
   serverSeed: String,
   serverSeedHash: String,
   clientSeed: String,
 
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
const LimboGame = (module.exports = mongoose.model("LimboGame", LimboGameSchema));