// Require Dependencies
const express = require("express");
const router = (module.exports = express.Router());
const { validateJWT } = require("../middleware/auth");
const config = require("../config");

const BattlesGame = require("../models/BattlesGame");
const User = require("../models/User");
const Battles = require("../controllers/games/battles.js");

/**
 * @route   GET /api/battles/
 * @desc    Get active battles games
 * @access  Public`
 */
router.get("/", async (req, res, next) => {
  try {
    const waiting = await BattlesGame.find({ status: 1 })
    const active = await BattlesGame.find({ status: 2 });

    const ended = await BattlesGame.find({ status: 3 })
      .sort({ created: -1 }) 
      .limit(10); 

    const games = [...waiting, ...active];
    
    // Create new objects with desired properties
    const modifiedGames = games.map(game => {

      return {
        id: game._id,  
        price: game.betAmount,
        cases: game.cases,
        casesRoundResults: game.eachCaseResult,
        players: game.players,
        isCrazyMode: game.isCrazyMode,
        isTerminalMode: game.isTerminalMode,
        gameType: game.game_type,
        status: game.status,
        playerCount: game.game_type == 1 ? 2 : game.game_type == 2 ? 3 : game.game_type == 3 ? 4 : game.game_type == 4 ? 4 : 0,
      };
    });

    return res.json(modifiedGames);
  } catch (error) {
    return next(error);
  }
});

/**
 * @route   GET /api/battles/game
 * @desc    Returns the battle game with a given id
 * @access  Public`
 */
router.post("/game", async (req, res, next) => {
  try {
    const { gameId } = req.body;

    const gameData = Battles.getPendingGames().find(game => String(game._id) === gameId) ? Battles.getPendingGames().find(game => String(game._id) === gameId) : await BattlesGame.findOne({ _id: gameId });

    return res.json({
      id: gameData._id,
      price: gameData.betAmount,
      cases: gameData.cases,
      casesRoundResults: gameData.eachCaseResult,
      players: gameData.players,
      isCrazyMode: gameData.isCrazyMode,
      isTerminalMode: gameData.isTerminalMode,
      serverSeedHash: gameData.serverSeedHash,
      serverSeed: gameData.status == 1 ? "Null" : gameData.serverSeed,
      blockNumber: gameData.blockNumber ?? "Null",
      blockHash: gameData.blockHash ?? "Null",
      gameType: gameData.game_type,
      status: gameData.status,
      win: gameData.win,
      playerCount: gameData.game_type == 1 ? 2 : gameData.game_type == 2 ? 3 : gameData.game_type == 3 ? 4 : gameData.game_type == 4 ? 4 : 0,
    });


  } catch (error) {
    return next(error);
  }
});


router.get("/cases", async (req, res, next) => {
  try {
    const cases = require("../controllers/games/cases.json");

    return res.json(cases);
  } catch (error) {
    return next(error);
  }
});

router.post("/case", async (req, res, next) => {
  try {
    const { slug } = req.body;
    const x = require("../controllers/games/cases.json");
    const y = require("../controllers/games/freecases.json");
    const cases = [...x, ...y];
    return res.json(cases.filter((item) => item.slug == slug)[0]);
  } catch (error) {
    return next(error);
  }
});