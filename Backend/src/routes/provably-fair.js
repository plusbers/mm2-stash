const express = require('express');
const { validateJWT } = require('../middleware/auth');
const ProvablyFair = require('../models/ProvablyFair');
const { generateServerSeedAndHash } = require('../controllers/blockchain');

const router = express.Router();

/**
 * @route   GET /api/game/current
 * @desc    Fetch or create initial server-seed, client-seed pair, and nonce
 * @access  Private
 */
router.get('/current', validateJWT, async (req, res, next) => {
  try {
    let gameData = await ProvablyFair.findOne({
      _user: req.user.id
    }).sort({ created: -1 });

    if (!gameData) {
      // Generate initial seeds and save new game session
      const { serverSeed, serverSeedHash } = generateServerSeedAndHash();
      const { serverSeed: nextServerSeed, serverSeedHash: nextServerSeedHash } = generateServerSeedAndHash();
      gameData = new ProvablyFair({
        serverSeed,
        serverSeedHash,
        nextServerSeed,
        nextServerSeedHash,
        clientSeed: 'initial', // This should be set to a sensible default or provided by the user
        nonce: 0,
        _user: req.user.id
      });
      await gameData.save();
    }

    return res.json({
      serverSeedHash: gameData.serverSeedHash,
      clientSeed: gameData.clientSeed,
      nextServerSeedHash: gameData.nextServerSeedHash,
      nonce: gameData.nonce
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * @route   POST /api/game/update-seed
 * @desc    Change client seed, create a new session, and prepare the next session's server seed and hash
 * @access  Private
 */
router.post('/update-seed', validateJWT, async (req, res, next) => {
  try {
    const { newClientSeed } = req.body;

    // Fetch the most recent game data for the user
    const lastGameData = await ProvablyFair.findOne({
      _user: req.user.id
    }).sort({ created: -1 });

    // Generate server seed and hash for the next session
    const { serverSeed: nextServerSeed, serverSeedHash: nextServerSeedHash } = generateServerSeedAndHash();

    if (lastGameData) {
      // Prepare new session data based on the last game session's next server seed and hash
      const newGameData = new ProvablyFair({
        serverSeed: lastGameData.nextServerSeed, // Use next server seed from last session
        serverSeedHash: lastGameData.nextServerSeedHash, // Use next server seed hash from last session
        clientSeed: newClientSeed,
        nonce: 0, // Reset nonce for the new game session
        nextServerSeed, // Set up next server seed for the following session
        nextServerSeedHash, // Set up next server seed hash for the following session
        _user: req.user.id
      });

      await newGameData.save();

      return res.json({
        message: 'Client seed updated and new session started successfully.',
        currentServerSeedHash: newGameData.serverSeedHash,
        nextServerSeedHash
      });
    } else {
      // If no game data exists, create initial game session
      const newGameData = new ProvablyFair({
        serverSeed: nextServerSeed, // Start with generated next server seed
        serverSeedHash: nextServerSeedHash, // Start with generated next server seed hash
        clientSeed: newClientSeed,
        nonce: 0,
        nextServerSeed, // Prepare the next server seed in advance
        nextServerSeedHash, // Prepare the next server seed hash in advance
        _user: req.user.id
      });

      await newGameData.save();

      return res.json({
        message: 'First game session created successfully.',
        currentServerSeedHash: newGameData.serverSeedHash,
        nextServerSeedHash
      });
    }
  } catch (error) {
    return next(error);
  }
});


/**
 * @route   GET /api/game/history
 * @desc    Retrieve the history of server and client seeds along with nonce counts, excluding the current session's unhashed server seed
 * @access  Private
 */
router.get('/history', validateJWT, async (req, res, next) => {
  try {
    // Fetch all game data for the user except the most recent one
    const history = await ProvablyFair.find({
      _user: req.user.id
    }).sort({ created: -1 }).skip(1); // Skip the most recent session

    if (!history.length) {
      return res.status(404).json({ message: 'No historical data found' });
    }

    const formattedHistory = history.map(game => ({
      id: game._id,
      serverSeed: game.serverSeed,
      serverSeedHash: game.serverSeedHash,
      clientSeed: game.clientSeed,
      nonce: game.nonce
    }));

    return res.json({ history: formattedHistory });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
