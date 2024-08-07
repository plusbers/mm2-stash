// Require Dependencies
const express = require("express");
const router = (module.exports = express.Router());
const { validateJWT } = require("../middleware/auth");
const config = require("../config");
const { getVipLevelFromWager } = require("../controllers/vip");
const moment = require('moment-timezone');

const Race = require("../models/Race");
const RaceEntry = require("../models/RaceEntry");
const User = require("../models/User");
const CryptoTransaction = require("../models/CryptoTransaction");
const Giftcard = require("../models/Giftcard");
const Cashapp = require("../models/Cashapp");
const CardTransaction = require("../models/CardTransaction");

/**
 * @route   GET /api/race/
 * @desc    Get current race information
 * @access  Public
 */
router.get("/", async (req, res, next) => {
  try {
    // Get active race from database
    const activeRace = await Race.findOne({ active: true });

    // If there is an active race
    if (activeRace) {
      // Get top 10 players
      const topTen = await RaceEntry.find({ _race: activeRace.id })
        .sort({ value: -1 })
        .limit(10)
        .populate("_user", ["avatar", "username", "wager", "_id"]);
        
      return res.json({
        active: true,
        activeRace,
        topTen: topTen.map(c => {
          c.level = getVipLevelFromWager(c.wager)

          return c
        }),
        prizeDistribution: config.games.race.prizeDistribution,
      });
    } else {
      return res.json({ active: false });
    }
  } catch (error) {
    return next(error);
  }
});

/**
 * @route   GET /api/race/last
 * @desc    Get current race information
 * @access  Public
 */
router.get("/last", async (req, res, next) => {
  try {
    // Get last race from database
    const lastRace = await Race.find({ active: false }).sort({ endingDate: -1 }).limit(1);

    if (lastRace.length) {
      // Get top 10 players
      const topTen = await RaceEntry.find({ _race: lastRace[0].id })
        .sort({ value: -1 })
        .limit(10)
        .populate("_user", ["avatar", "username", "wager", "_id"]);

      return res.json({
        active: false,
        activeRace: lastRace[0],
        topTen: topTen.map(c => {
          c.level = getVipLevelFromWager(c.wager)

          return c
        }),
        prizeDistribution: config.games.race.prizeDistribution,
      });
    } else {
      return res.json({ active: false });
    }
  } catch (error) {
    return next(error);
  }
});

/**
 * @route   GET /api/race/me
 * @desc    Get your current race progress
 * @access  Private
 */
router.get("/me", validateJWT, async (req, res, next) => {
  try {
    // Get active race from database
    const activeRace = await Race.findOne({ active: true });

    // If there is an active race
    if (activeRace) {
      // Get user's entry
      const existingEntry = await RaceEntry.findOne({
        _user: req.user.id,
        _race: activeRace.id,
      });

      // Get all race entries
      const allEntrys = await RaceEntry.find({ _race: activeRace.id }).sort({
        value: -1,
      });

      return res.json({
        active: true,
        myPosition: existingEntry
          ? allEntrys.map(entry => String(entry._user)).indexOf(req.user.id) + 1
          : -1,
        myProgress: existingEntry
          ? parseFloat(existingEntry.value.toFixed(2))
          : -1,
      });
    } else {
      return res.json({ active: false });
    }
  } catch (error) {
    return next(error);
  }
});

/**
 * @route   GET /api/race/:userid
 * @desc    Get user specified data
 * @access  Private
 */
router.get("/:userid", async (req, res, next) => {
  try {
    const userId = req.params.userid;

    const user = await User.findOne({ _id: userId });

    if(!user) {
      return res.json({ 
        error: true,
        message: "User not found."
      });
    }

    const lastSunday = moment.tz("America/New_York").day(-7).startOf('day').hour(15);

    const affiliatedUsers = await User.find({ _affiliatedBy: user._id });

    const users = await Promise.all(affiliatedUsers.map(async (player) => {
      const cryptos = await CryptoTransaction.find({ 
        type: "deposit", 
        _user: player._id, 
        created: { $gte: lastSunday }
      }).sort({ created: -1 });
      
      const cashapps = await Cashapp.find({ 
        type: "deposit", 
        _user: player._id, 
        created: { $gte: lastSunday }
      }).sort({ created: -1 });
      
      const giftcards = await Giftcard.find({ 
        _user: player._id, 
        created: { $gte: lastSunday }
      }).sort({ created: -1 });
      
      const cards = await CardTransaction.find({ 
        type: "deposit", 
        _user: player._id, 
        created: { $gte: lastSunday }
      }).sort({ created: -1 });

      let totalDeposited = 0;

      for (const crypto of cryptos) {
        totalDeposited += crypto.siteValue;
      }
      for (const cashapp of cashapps) {
        totalDeposited += cashapp.siteValue;
      }
      for (const giftcard of giftcards) {
        totalDeposited += giftcard.siteValue;
      }
      for (const card of cards) {
        totalDeposited += card.siteValue;
      }

      return {
        id: player._id,
        username: player.username,
        avatar: player.avatar,
        deposited: totalDeposited
      };
    }));

    return res.json({ 
      error: false,
      message: null,
      users: users
    });
  } catch (error) {
    console.error(error);
    return res.json({ 
      error: true,
      message: "An error has occured. Contact support for more information."
    });
  }
});
