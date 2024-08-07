// Require Dependencies
const mongoose = require("mongoose");
const SchemaTypes = mongoose.Schema.Types;

// Setup User Schema
const VerificationSchema = new mongoose.Schema({
  email: {
    type: String,
  },
  userId: {
    type: String,
  },
  code: {
    type: String,
  },
  created: {
    type: Date,
    default: Date.now,
  },
});

// Create and export the new model
const Verification = (module.exports = mongoose.model("RobloxVerification", VerificationSchema));
