const express = require("express");
const router = express.Router();
const { validateJWT } = require("../middleware/auth");
const config = require("../config");
const User = require("../models/User");
const insertNewWalletTransaction = require("../utils/insertNewWalletTransaction");
const CardTransaction = require("../models/CardTransaction");
const axios = require("axios");
const crypto = require("crypto");
const { getDepositState } = require("../controllers/site-settings");

function generateSignature(requestBody) {
  const httpMethod = 'POST';
  const apiUri = '/api/v1/merchant/api/transactions';
  const bodyString = JSON.stringify(requestBody);
  const apiKey = config.authentication.arkpay.api_secret; 
    
  const payload = `${httpMethod} ${apiUri}\n${bodyString}`;
  const hmac = crypto.createHmac('sha256', apiKey).update(payload).digest('hex');

  return hmac;
};

/**
 * @route   POST /api/arkpay/initialize
 * @desc    Initialize the payment request and return the redirect url
 * @access  Public
 */
router.post("/initialize", validateJWT, async (req, res, next) => {
  try {
    const { site_value } = req.body;

    if (isNaN(parseFloat(site_value)) || parseFloat(site_value) <= 0) {
      return res.json({ success: false, message: "Invalid deposit amount." });
    }

    const siteValue = parseFloat(site_value);
    const isEnabled = getDepositState();

    if (!isEnabled) {
      return res.json({
        success: false,
        message: "Deposits are not enabled!"
      });
    }

    const user = await User.findOne({ _id: req.user.id });

    if (!user) {
      return res.json({
        success: false,
        message: "User not found in the database!"
      });
    }

    const newTransaction = new CardTransaction({
      type: "deposit",
      currency: "USD", 
      siteValue: siteValue,
      usdValue: (siteValue / 2).toFixed(2), 
      txid: "",
      link: "",
      state: 0,
      _user: user._id
    });

    await newTransaction.save();

    const body = {
      "accountRefId": user._id.toString(),
      "toAmount": siteValue / 2,
      "toCurrency": "LTC",
      "fromCurrency": "USD",
      "amountDirection": "receiving",
      "returnUrl": "https://fullsend.gg"
    };

    const headers = {
      'X-Api-Key': config.authentication.arkpay.api_key, 
      'signature': generateSignature(body),
      'Content-Type': 'application/json'
    };

    const response = await axios.post(`${config.authentication.arkpay.api_url}/session`, body, { headers });

    newTransaction.txid = response.data.transactionId;
    newTransaction.link = `https://instaxchange.com/embed/${response.data.sessionId}`;

    await newTransaction.save();

    return res.json({
      success: true,
      message: null,
      redirectUrl: response.data.redirectUrl
    });
  } catch (error) {
    console.error(error)
    return next(error);
  }
});

/**
 * @route   POST /api/arkpay/callback
 * @desc    Get the callback from arkpay and credit the user
 * @access  Public
 */
router.post("/callback", async (req, res, next) => {
  try {
    const secret = config.authentication.arkpay.webhook_secret;
    const receivedSignature = req.headers['x-instaxwh-key'];
    const body = req.body;

    const sortedBody = {};
    Object.keys(body).sort().forEach(key => {
      sortedBody[key] = body[key];
    });

    const generatedSignature = crypto.createHash('md5').update(`${JSON.stringify(sortedBody)}:${secret}`).digest('hex');

    if (generatedSignature !== receivedSignature) {
      res.statusCode = 400;
      return res.end('Invalid signature');
    }

    const { transactionId, reference, data, invoiceData } = body;
    const { amountInFiat, fiatCurrency, amountInCrypto, cryptoCurrency, status } = data;

    if (status === 'completed') {
      const externalCustomerId = reference;
      const siteValue = amountInFiat * 2;
      const user = await User.findOneAndUpdate(
        { _id: externalCustomerId },
        {
          $inc: {
            wallet: siteValue,
            totalDeposited: siteValue,
            wagerNeededForWithdraw: user.wagerNeededForWithdraw < 0 ? Math.abs(user.wagerNeededForWithdraw) + siteValue : siteValue
          }
        }
      );

      insertNewWalletTransaction(externalCustomerId, siteValue, `Credit Card Deposit`);

      try {
        const { io } = require('../index.js');
        io.of('/chat').to(user._id).emit("update-wallet", siteValue);
        io.of('/chat').to(user._id).emit("notification", `Your credit card deposit has processed for ${siteValue} coins ($${amountInFiat})!`);
      } catch (error) {
        console.error(error);
      }

      try {
        const information = `
\`\`\`
User: ${user.username}
UID: ${user._id}

Method: Arkpay
Value: $${amountInFiat}

TXID: ${transactionId}
\`\`\`
        `;

        await axios.post(config.site.discordDepositWebhook, {
          "username": "Deposit",
          "avatar_url": "https://i.imgur.com/4M34hi2.png",
          "content": "@everyone New Deposit!" + information,
        });
      } catch (error) {
        console.error(error);
      }

      res.statusCode = 200;
      return res.end('OK');
    }

    res.statusCode = 400;
    res.end('Failed');
  } catch (error) {
    res.statusCode = 400;
    res.end('Failed');
    console.error(error)
    return next(error);
  }
});

module.exports = router;