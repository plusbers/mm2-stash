 // Require Dependencies
 const mongoose = require("mongoose");

 // Setup CryptoTransaction Schema
 const UpgraderGameSchema = new mongoose.Schema({
 
   // Bet details
   betAmount: Number,
   item: Object,
   isUnder: Boolean,
   roll: Number,
   success: Boolean,
   multiplier: Number,
   winAmount: Number,
 
   // Provably fair data to be saved
   seedPairId: String,
   serverSeed: String,
   serverSeedHash: String,
   clientSeed: String,
   nonce: Number,
 
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
 const UpgraderGame = (module.exports = mongoose.model(
   "UpgraderGame",
   UpgraderGameSchema
 ));