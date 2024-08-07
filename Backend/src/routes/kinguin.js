// Require Dependencies
const express = require("express");
const router = (module.exports = express.Router());
const { validateJWT } = require("../middleware/auth");
const { check, validationResult } = require("express-validator");
const insertNewWalletTransaction = require("../utils/insertNewWalletTransaction");
const fs = require('fs');
const axios = require("axios");

const User = require("../models/User");
const Giftcard = require("../models/Giftcard");
const config = require("../config/index");

/**
 * @route   POST /api/kinguin/redeem
 * @desc    Redeem a giftcard code
 * @access  Private
 */
router.post(
  "/redeem",
  [
    validateJWT,
    check("code", "Giftcard code is required")
      .notEmpty()
      .isString()
      .withMessage("Invalid giftcard code type"),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);

    // Check for validation errors
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { code } = req.body;
    try {
      // Get user
      let user = await User.findOne({ _id: req.user.id });

      // If user is not found
      if (!user) {
        return next(
          new Error("Couldn't find user! Maybe database did an error?")
        );
      }

      // If user has restricted transactions
      if (user.transactionsLocked) {
        res.status(403);
        return next(
          new Error(
            "Your account has a transaction restriction. Please contact support for more information."
          )
        );
      }

      let value;

      const values = [5, 10, 15, 20, 50, 100];
      for (const val of values) {
        const filePath = `${__dirname}/codes/${val}.txt`;
        try {
          const codes = fs.readFileSync(filePath, 'utf8').split('\n');
          const index = codes.indexOf(code);
          if (index !== -1) {
            value = val;
            codes.splice(index, 1);
            const updatedCodes = codes.join('\n');
            fs.writeFileSync(filePath, updatedCodes, 'utf8');
            break;
          }
        } catch (error) {
          console.error(`Error reading file ${filePath}: ${error}`);
        }
      };

      // If no code was found in any file, return an error
      if (!value) {
        res.status(400);
        return next(new Error("This giftcard code doesn't exist or has been used!"));
      }

      const usdValue = value.toFixed(2);
      const siteValue = parseFloat(usdValue*2).toFixed(2);

      user = await User.findOneAndUpdate(
        { _id: user.id },
        {
          $inc: {
            wallet: siteValue,
            wagerNeededForWithdraw: user.wagerNeededForWithdraw < 0 ? Math.abs(wagerNeededForWithdraw) + siteValue : siteValue,
            totalDeposited: siteValue
          }
        }
      );

      const newTransaction = new Giftcard({
        type: "deposit", 

        currency: "giftcard",
        siteValue,
        usdValue,
        gcCode: code, 
        state: 3, 

        _user: user.id, 
      });

      try {
        const information = `
          \`\`\`
User: ${user.username}
UID: ${user._id}

Method: ${"giftcard"}
Value: $${usdValue}

GC-CODE: ${code}\`\`\`
        `

        await axios.post(config.site.discordDepositWebhook ,{
          "username": "Deposit",
          "avatar_url": "https://i.imgur.com/4M34hi2.png",
          "content": "@everyone New Deposit!" + information,
        });
      } catch(error) {
        console.error(error)
      }

      // Save the document
      await newTransaction.save();

      insertNewWalletTransaction(user.id, siteValue, "Kinguin GC redeemed", {
        giftcardId: code,
      });

      return res.json({ message: `Your ${siteValue} coin ($${usdValue}) kinguin giftcard code has been redeemed!`, payout: siteValue });
    } catch (error) {
      return next(error);
    }
  }
);
