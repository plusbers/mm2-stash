// Require Dependencies
const express = require("express");
const router = (module.exports = express.Router());
const { validateJWT } = require("../middleware/auth");
const config = require("../config");

const MinesGame = require("../models/Mines"); // Require the MinesGame model

/**
 * @route   GET /api/mines/me
 * @desc    Get active mines games
 * @access  Public
 */
router.get("/me", validateJWT, async (req, res, next) => {
  try {
    // Retrieve in-progress game for the user
    const activeGame = await MinesGame.findOne({ userId: req.user.id, status: "inprogress" });

    // Check if the game exists
    if (!activeGame) {
      console.log("No in-progress game found for the user.");
      return res.status(404).json({ message: "No in-progress game found for the user." });
    }

    // Get all tiles from the game and omit the isMine property
    const revealedTiles = activeGame.grid.map(({ revealed, _id }) => ({ revealed, _id }));

    // Send the modified response without the isMine property
    return res.json({ ...activeGame.toObject(), grid: revealedTiles });
  } catch (error) {
    return next(error);
  }
});


/**
 * @route   GET /api/mines/reveal;
 * @desc    Get reveal mines
 * @access  Public
 */
router.get("/reveal", validateJWT, async (req, res, next) => {
  try {

    // Retrieve inprogress game for the user
    const activeGame = await MinesGame.findOne({ userId: req.user.id, status: "reveal" });


    // Get all tiles from the game and omit isMine property
    const revealedTiles = activeGame.grid.map(({ revealed, _id }) => ({ revealed, _id }));


    return res.json(activeGame);
  } catch (error) {
    return next(error);
  }
});


