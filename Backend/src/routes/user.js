// Require Dependencies
const express = require("express");
const router = (module.exports = express.Router());
const rateLimit = require("express-rate-limit");
const { check, validationResult } = require("express-validator");
const { validateJWT } = require("../middleware/auth");
const {
  sendVerficationTextMessage,
  verifyTextMessageCode,
} = require("../controllers/twilio");
const { checkInventoryForLoyaltyBadge } = require("../controllers/steam");
const config = require("../config");
const insertNewWalletTransaction = require("../utils/insertNewWalletTransaction");
const { checkMaintenance } = require("../middleware/maintenance");
const { verifyRecaptchaResponse } = require("../controllers/recaptcha");
const axios = require("axios");
const User = require("../models/User");
const CryptoTransaction = require("../models/CryptoTransaction");
const WalletTransaction = require("../models/WalletTransaction");
const BattlesGame = require("../models/BattlesGame");
const CaseGame = require("../models/CaseGame");
const CrashGame = require("../models/CrashGame");
const LimboGames = require("../models/LimboGame");
const DiceGame = require("../models/DiceGame");
const MineGame = require("../models/MineGame");
const RouletteGame = require("../models/RouletteGame");
const Free = require("../models/Free");
const Verification = require('../models/verification');
const Giftcard = require("../models/Giftcard");
const Cashapp = require("../models/Cashapp");
const CardTransaction = require("../models/CardTransaction");


// Create request limiter
const limiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 1, // limit each IP to 100 requests per windowMs
  message: {
    error: "You can do this only every 5 minutes. Please wait",
    stack: {},
  },
});

const limiter2 = rateLimit({
  windowMs: 1000, // 5 minutes
  max: 1,
  message: {
    error: "You can do this only every 1 second. Please wait",
    stack: {},
  },
});

// Combine middleware
const middleware = [checkMaintenance, validateJWT];

/**
 * @route   GET /api/user/
 * @desc    Get authenticated user
 * @access  Private
 */
router.get("/", validateJWT, async (req, res, next) => {
  try {
    const user = await User.findOne({ _id: req.user.id }).select({
      crypto: 0,
      phoneVerificationCode: 0,
    });

    // Check that user exists
    if (!user) {
      console.error("User not found, maybe database did an oopsie?");
      return next(new Error("User not found, maybe database did an oopsie?"));
    }
    return res.json({
      user,
      token: req.authToken,
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * @route   GET /api/user/history
 * @desc    Get authenticated user's games history
 * @access  Private
 */
router.get("/history", middleware, async (req, res, next) => {
  try {
    // Get user
    const user = await User.findOne({ _id: req.user.id });

    const battlesGames = await BattlesGame.find({ "players.id": user.id })
    const CaseGames = await CaseGame.find({ _user: user.id });
    const crashGames = await CrashGame.find({ players: user.id });
    const rouletteGames = await RouletteGame.find({"players._id": user.id}).lean();
    const limboGames = await LimboGames.find({_user: user.id});
    const diceGames = await DiceGame.find({ _user: user.id });
    const mineGames = await MineGame.find({ _user: user.id });

    return res.json({
      caseBattles: battlesGames.filter(item => item.status == 3),
      cases: CaseGames.filter(game => game.case.price > 0),
      crash: crashGames,
      roulette: rouletteGames,
      limbo: limboGames,
      dice: diceGames,
      mines: mineGames
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * @route   POST /api/user/profile
 * @desc    Get un-auth user's profile info
 * @access  Private
 */
router.post("/profile", checkMaintenance, async (req, res, next) => {
  try {
    const { userid } = req.body;

    const user = await User.findOne({ _id: userid });

    // Check that user exists
    if (!user) {
      console.error("User not found, maybe database did an oopsie?");
      return next(new Error("User not found, maybe database did an oopsie?"));
    }

    // Get wallet transactions
    const transactions = await WalletTransaction.find({
      _user: user.id,
    }).sort({ created: -1 });
    return res.json(
      {
        gamesPlayed: user.betsPlaced,
        gamesWon: user.betsWon,
        wager: user.wager.toFixed(2),
        totalDeposited: user.totalDeposited,
        totalWithdrawn: user.totalWithdrawn,
        avatar: user.avatar,
        username: user.username,
        robloxUsername: user.robloxUsername,
        _id: user._id,
        inventory: user.inventory,
        hasVerifiedAccount: user.hasVerifiedAccount,
        profit: (user.totalWithdrawn - user.totalDeposited + user.wallet).toFixed(2),
        created: user.created
      }
    );
  } catch (error) {
    return next(error);
  }
});

/**
 * @route   POST /api/user/txs
 * @desc    Get users transactions
 * @access  Private
 */
router.get("/txs", middleware, async (req, res, next) => {
  try {
    const user = await User.findOne({ _id: req.user.id });

    // Check that user exists
    if (!user) {
      console.error("User not found, maybe database did an oopsie?");
      return next(new Error("User not found, maybe database did an oopsie?"));
    }

    const deposits = await CryptoTransaction.find({ type: "deposit", _user: user.id}).sort({ created: -1 });

    const cashapp = await Cashapp.find({ type: "deposit", _user: user.id }).sort({ created: -1 });

    const giftcards = await Giftcard.find({ _user: user.id,}).sort({ created: -1 });

    const cards = await CardTransaction.find({  type: "deposit", _user: user.id,}).sort({ created: -1 });

    const withdraws = await CryptoTransaction.find({ type: "withdraw", _user: user.id,}).sort({ created: -1 });

    const cashappw = await Cashapp.find({ type: "withdraw", _user: user.id }).sort({ created: -1 });

    const frees = await Free.find({ _user: user.id }).sort({ created: -1 });

    return res.json({
      deposits: [...deposits, ...giftcards, ...cashapp, ...cards],
      withdraws: [...withdraws, ...cashappw], 
      free: frees,
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * @route   GET /api/user/affiliates
 * @desc    Get authenticated user's affiliate info
 * @access  Private
 */
router.get("/affiliates", middleware, async (req, res, next) => {
  try {
    const user = await User.findOne({ _id: req.user.id });

    // Check that user exists
    if (!user) {
      console.error("User not found, maybe database did an oopsie?");
      return next(new Error("User not found, maybe database did an oopsie?"));
    }

    // Get user's affiliator
    const affiliator = await User.findOne({ _id: user._affiliatedBy });
    const affiliatedUsers = await User.find({
      _affiliatedBy: user.id,
    }).select({ username: 1, avatar: 1, wager: 1, totalDeposited: 1, });

    let totalDeposited = 0;
    let totalWagered = 0;

    affiliatedUsers.forEach(user => {
        totalDeposited += user.totalDeposited || 0; 
        totalWagered += user.wager || 0;
    });

    return res.json({
      affiliateCode: user.affiliateCode || "",
      affiliateLink: user.affiliateCode
        ? `${config.site.frontend.productionUrl}/a/${user.affiliateCode}`
        : "Set affiliate code first in settings!",
      affiliateMoney: user.affiliateMoney,
      affiliateMoneyAvailable:
        user.affiliateMoney - user.affiliateMoneyCollected,
      affiliateMoneyCollected: user.affiliateMoneyCollected,
      usersAffiliated: affiliatedUsers.length,
      currentlySupporting: affiliator
        ? { code: affiliator.affiliateCode, username: affiliator.username }
        : null,
      totalDeposited: totalDeposited,
      totalWagered: totalWagered,
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * @route   POST /api/user/affiliates/update-code
 * @desc    Update user's affiliate code
 * @access  Private
 */
router.post(
  "/affiliates/update-code",
  [
    checkMaintenance,
    validateJWT,
    check("code", "New affiliate code is required")
      .notEmpty()
      .isString()
      .withMessage("Invalid affiliate code type"),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);

    // Check for validation errors
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { code } = req.body;
    try {
      // Remove any illegal characters
      const parsedCode = encodeURI(
        code
          .replace(/[^\w\s]/gi, "")
          .replace(/\s/g, "")
          .toLowerCase()
      );

      // If still not valid
      if (parsedCode.length < 3) {
        res.status(400);
        return next(
          new Error(
            "Your code must be at least 3 characters long and musn't contain special characters!"
          )
        );
      }

      // Get existing user with that affiliate code
      const existingUser = await User.findOne({
        affiliateCode: parsedCode,
      });

      // If affiliate code is already in-use
      if (existingUser && existingUser.id !== req.user.id) {
        res.status(400);
        return next(new Error("This affiliate code is already in-use!"));
      }

      // Update user document
      await User.updateOne(
        { _id: req.user.id },
        { $set: { affiliateCode: parsedCode } }
      );

      return res.json({ newAffiliateCode: parsedCode });
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * @route   GET /api/user/affiliates
 * @desc    Get authenticated user's affiliate info
 * @access  Private
 */
router.get("/roblox", middleware, async (req, res, next) => {
  try {
    const user = await User.findOne({ _id: req.user.id });

    // Check that user exists
    if (!user) {
      console.error("User not found, maybe database did an oopsie?");
      return next(new Error("User not found, maybe database did an oopsie?"));
    }

    return res.json({
      username: user.robloxUsername
        ? `${user.robloxUsername}`
        : "Set Roblox Username",
    });
  } catch (error) {
    return next(error);
  }
});

router.post(
  "/update-roblox",
  [
    checkMaintenance,
    validateJWT,
    check("username", "New affiliate code is required")
      .notEmpty()
      .isString()
      .withMessage("Invalid affiliate code type"),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);

    // Check for validation errors
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username } = req.body;
    let user = await User.findOne({ _id: req.user.id });
    
    try {
      const randomWords = [
        "apple", "banana", "orange", "grape", "strawberry", "pineapple", "watermelon", "kiwi", "blueberry", "raspberry",
        "peach", "pear", "plum", "apricot", "mango", "cherry", "lemon", "lime", "coconut", "fig",
        "avocado", "pomegranate", "melon", "cranberry", "blackberry", "tangerine", "nectarine", "guava", "papaya", "dragonfruit",
        "lychee", "passionfruit", "boysenberry", "elderberry", "persimmon", "cantaloupe", "kumquat", "starfruit", "plantain", "rhubarb",
        "quince", "mulberry", "gooseberry", "durian", "jackfruit", "breadfruit", "soursop"
      ];

      function generateCode() {
        const words = [];
        for (let i = 0; i < 4; i++) {
            const randomIndex = Math.floor(Math.random() * randomWords.length);
            words.push(randomWords[randomIndex]);
        }
        return words.join(' ');
      }

      const excludeBannedUsers = true;
        const requestData = {
            usernames: [req.body.username],
            excludeBannedUsers: excludeBannedUsers
        };

        const response = await axios.post('https://users.roblox.com/v1/usernames/users', requestData);
        const userData = response.data.data[0];

        if (!userData) {
            return res.status(404).json({ success: false, error: { type: 'not_found', message: `User not found` } });
        }

        const userId = userData.id;

        let code = generateCode()

        let VerificationCode = await Verification.findOne({userId: userId.toString(), email: user.providerId });

        if (!VerificationCode) {
            VerificationCode = new Verification({
                userId: userId.toString(),
                code: code.toString(),
                email: user.providerId,
            })

            await VerificationCode.save()

            return res.status(200).json({ status: "needVerification", code: code })
        } else {
            if (VerificationCode.email !== user.providerId) {
              return res.status(200).json({ status: "So you obviously can\'t have multiple accounts with the same Roblox User." })
            }

            const response = await axios.get(`https://users.roblox.com/v1/users/${userId}`);
            const userData1 = response.data;

            if (!userData1.description.toString().includes(VerificationCode.code)) {
                return res.status(200).json({ status: "error", error: "missing_description", code: VerificationCode.code });
            }

            await Verification.deleteOne({userId: userId.toString()});
            const size = req.query.size || '48x48';
            const format = req.query.format || 'Png';
            const isCircular = req.query.isCircular || false;
    
            const responser = await axios.get(`https://users.roblox.com/v1/users/${userId}`);
            const userData = responser.data;
    
            const headshotResponse = await axios.get(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=${size}&format=${format}&isCircular=${isCircular}`);
            const headshotData = headshotResponse.data.data[0];

            user.robloxUsername = userData.name
            user.robloxId = `${Verification.userId}`

            await user.save()
    
            res.status(200).json({ status: "success" });
        }
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * @route   POST /api/user/affiliates/redeem
 * @desc    Redeem affiliate code and receive first time $0.25
 * @access  Private
 */
router.post(
  "/affiliates/redeem",
  [
    limiter,
    checkMaintenance,
    validateJWT,
    check("code", "Affiliate code is required")
      .notEmpty()
      .isString()
      .withMessage("Invalid affiliate code type"),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);

    // Check for validation errors
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { code } = req.body;
    try {
      // Get user from db
      const user = await User.findOne({ _id: req.user.id });

      // If user is not found
      if (!user) {
        return next(
          new Error("Couldn't find user! Maybe database did an error?")
        );
      }

      // If user isn't verified   !user.hasVerifiedAccount
      //if (user.totalDeposited < 5) {
      //  res.status(400);
      //  return next(
      //    new Error(
      //      "You must deposit min. $5.00 before redeeming an affiliate code!"
      //    )
      //  );
      //}

      // Get existing user with that affiliate code
      const existingUser = await User.findOne({
        affiliateCode: code.toLowerCase(),
      });

      // If affiliate code isn't valid
      if (!existingUser) {
        res.status(400);
        return next(
          new Error(
            "This affiliate code doesn't belong to anyone! Please double-check your input"
          )
        );
      }

      // If user is trying to affiliate himself
      if (existingUser.id === user.id) {
        res.status(400);
        return next(new Error("You can't affiliate yourself :)"));
      }

      // If this is user's first time redeeming a code
      if (!user._affiliatedBy) {
        // Update user
        await User.updateOne(
          { _id: user.id },
          {
            $inc: { wallet: 0.25 },
            $set: {
              _affiliatedBy: existingUser.id,
              affiliateClaimed: new Date().toISOString(),
            },
          }
        );
        insertNewWalletTransaction(
          user.id,
          0.25,
          "First time affiliate redeem",
          { affiliatorId: existingUser.id }
        );
        const newFree = Free({
          action: "affiliate-redeem",
          amount: 0.25,
          _user: user.id
        });
        await newFree.save();

        return res.json({
          code,
          username: existingUser.username,
          freeMoneyClaimed: true,
        });
      } else {
        res.status(400);
        return next(new Error("You can't change your affiliator!"));
      } /*else {
        // Update user
        await User.updateOne(
          { _id: user.id },
          { $set: { _affiliatedBy: existingUser.id } }
        );

        return res.json({
          code,
          username: existingUser.username,
          freeMoneyClaimed: false,
        });
      }*/
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * @route   POST /api/user/affiliates/claim
 * @desc    Claim user's affiliate earnings
 * @access  Private
 */
router.post("/affiliates/claim", middleware, async (req, res, next) => {
  try {
    // Get user from DB
    const user = await User.findOne({ _id: req.user.id });

    // If user doesn't exist
    if (!user) {
      res.status(400);
      return next(new Error("User not found! (database error)"));
    }

    // User affiliate revenue
    const affiliateRevenue = user.affiliateMoney - user.affiliateMoneyCollected;

    // Check if user has enough revenue to collect it
    if (affiliateRevenue < 1) {
      res.status(400);
      return next(
        new Error("You must have collected at least 1.00 coins before claiming it!")
      );
    }

    // Update user document
    await User.updateOne(
      { _id: user.id },
      {
        $inc: {
          wallet: Math.abs(affiliateRevenue),
          affiliateMoneyCollected: Math.abs(affiliateRevenue),
        },
      }
    );
    insertNewWalletTransaction(
      user.id,
      Math.abs(affiliateRevenue),
      "Affiliate revenue claim"
    );
    const newFree = Free({
      action: "affiliate-balance",
      amount: affiliateRevenue,
      _user: user.id
    });
    await newFree.save();


    return res.json({ claimedAmount: parseFloat(affiliateRevenue.toFixed(2)) });
  } catch (error) {
    return next(error);
  }
});

/**
 * @route   GET /api/user/verify
 * @desc    Return data required to verify user's account
 * @access  Private
 */
router.get("/verify", middleware, async (req, res, next) => {
  try {
    // Get user from DB
    const user = await User.findOne({ _id: req.user.id });

    // If user doesn't exist
    if (!user) {
      res.status(400);
      return next(new Error("User not found! (database error)"));
    }

    return res.json({
      hasVerifiedAccount: user.hasVerifiedAccount,
      verifiedPhoneNumber: user.verifiedPhoneNumber,
      verificationType: "textmessage",
      // user.provider === "steam" ? "loyaltybadge" : "textmessage",
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * @route   POST /api/user/verify/check
 * @desc    Check Steam user's inventory for Loyalty Badge
 * @access  Private
 */
router.post(
  "/verify/check",
  [checkMaintenance, validateJWT, limiter],
  async (req, res, next) => {
    res.status(400);
    return next(
      new Error(
        "We have removed this verification method, please use the SMS verification instead!"
      )
    );
    try {
      const user = await User.findOne({ _id: req.user.id });

      // If user doesn't exist
      if (!user) {
        res.status(400);
        return next(new Error("User not found! (database error)"));
      }

      // Check that user has registered with Steam
      if (user.hasVerifiedAccount || user.provider !== "steam") {
        res.status(400);
        return next(new Error("You can't verify using this method!"));
      }

      // Check if user has loyalty badge
      const hasBadge = await checkInventoryForLoyaltyBadge(user.providerId);

      // If user doesn't have the badge
      if (!hasBadge) {
        res.status(400);
        return next(
          new Error(
            "Couldn't find the Loyalty Badge in your CS:GO inventory. Unfortunately you cannot verify your account at the moment."
          )
        );
      }

      // Update user
      await User.updateOne(
        { _id: user.id },
        {
          $set: {
            hasVerifiedAccount: true,
            accountVerified: new Date().toISOString(),
          },
        }
      );

      return res.json({ success: true });
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * @route   POST /api/user/verify/send
 * @desc    Send an SMS verification code to user's phone number
 * @access  Private
 */
router.post(
  "/verify/send",
  [
    checkMaintenance,
    validateJWT,
    check("number", "Phone number is required")
      .notEmpty()
      .bail()
      .isString()
      .withMessage("Invalid phone number type")
      .bail(),
    // .isMobilePhone("any", { strictMode: true })
    // .withMessage("Please enter a valid phone number"),
    check("recaptchaResponse", "Please check the ReCAPTCHA field").notEmpty(),
    limiter,
  ],
  async (req, res, next) => {
    const errors = validationResult(req);

    // Check for validation errors
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { number, recaptchaResponse } = req.body;
    try {
      // Verify reCaptcha response
      const valid = await verifyRecaptchaResponse(recaptchaResponse);

      // If captcha wasn't valid
      if (!valid) {
        res.status(400);
        return next(
          new Error("Invalid ReCAPTCHA response, please try again later!")
        );
      }

      const user = await User.findOne({ _id: req.user.id });

      // If user doesn't exist
      if (!user) {
        res.status(400);
        return next(new Error("User not found! (database error)"));
      }

      // // If user has registered with steam
      // if (user.provider === "steam") {
      //   res.status(400);
      //   return next(
      //     new Error(
      //       "You can't use this verification method because you registered with Steam!"
      //     )
      //   );
      // }

      // Get account registered with this number
      const registeredUser = await User.findOne({
        verifiedPhoneNumber: number,
      });

      // If number is registered to another user
      if (registeredUser && registeredUser.id !== user.id) {
        res.status(400);
        return next(
          new Error(
            "This phone number has been used to register another user, please use a different phone number."
          )
        );
      }

      // Try to send the message
      await sendVerficationTextMessage(number);

      // Update user
      await User.updateOne(
        { _id: user.id },
        { $set: { verifiedPhoneNumber: number } }
      );

      return res.json({ mobileNumber: number });
    } catch (error) {
      console.log(
        "Error while sending verification code:",
        error.message,
        error.code,
        error.moreInfo
      );

      // Check if this was valid twilio error
      if (error.code && error.moreInfo) {
        // Filter common statuses
        if (error.code === 20003) {
          return next(
            new Error(
              "We are currently unavailable to send your verification code, please contact admins with this error code: 20003"
            )
          );
        } else {
          return next(
            new Error(
              "Couldn't send your verification code! Error: " + error.code
            )
          );
        }
      } else {
        return next(error);
      }
    }
  }
);

/**
 * @route   POST /api/user/verify/submit
 * @desc    Check verification code to verify user
 * @access  Private
 */
router.post(
  "/verify/submit",
  [
    checkMaintenance,
    validateJWT,
    check("code", "Verification code is required")
      .notEmpty()
      .bail()
      .isString()
      .withMessage("Invalid verification code type")
      .bail()
      .isLength({ min: 6, max: 6 })
      .withMessage("Invalid verification code!"),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);

    // Check for validation errors
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { code } = req.body;
    try {
      const user = await User.findOne({ _id: req.user.id });

      // If user doesn't exist
      if (!user) {
        res.status(400);
        return next(new Error("User not found! (database error)"));
      }

      // Check that user hasn't registered with Steam
      if (user.hasVerifiedAccount /* || user.provider === "steam" */) {
        res.status(400);
        return next(new Error("You can't verify using this method!"));
      }

      // Check if code is valid
      const verification = await verifyTextMessageCode(
        user.verifiedPhoneNumber,
        code
      );

      // Update user
      await User.updateOne(
        { _id: user.id },
        {
          $set: {
            hasVerifiedAccount: true,
            accountVerified: new Date().toISOString(),
          },
        }
      );

      return res.json({ success: true });
    } catch (error) {
      return next(error);
    }
  }
);
