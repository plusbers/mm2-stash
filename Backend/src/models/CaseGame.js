// Require Dependencies
const mongoose = require("mongoose");
const SchemaTypes = mongoose.SchemaTypes;

// Setup BattlesGame Schema
const CaseGameSchema = new mongoose.Schema({

  case: {
    type: Object
  },
  caseResult: {
    type: Object
  },

   // Bet details
   betAmount: Number,
   roll: Number,
 
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

  // When game was created
  created: {
    type: Date,
    default: Date.now,
  },
});

// Create and export the new model
const CaseGame = (module.exports = mongoose.model("CaseGame", CaseGameSchema));
