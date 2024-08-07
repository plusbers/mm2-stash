// Require Dependencies
const express = require("express");
const router = (module.exports = express.Router());
const { validateJWT } = require("../middleware/auth");
const config = require("../config");

const BattlesGame = require("../models/BattlesGame");
const User = require("../models/User");

/**
 * @route   GET /api/cases/
 * @desc    Get active battles games
 * @access  Public
 */
router.get("/", async (req, res, next) => {
  try {
    
    return res.json({});
  } catch (error) {
    return next(error);
  }
});

router.get("/lastopen", validateJWT, async (req, res, next) => {
  try {
    const dbUser = await User.findOne({ _id: req.user.id });


    return res.json(dbUser.rewards.lastOpen);
  } catch (error) {
    return next(error);
  }
});
