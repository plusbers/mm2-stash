/*
  Author: king
  Telegram: @kingdevelops
  Copyright (c) kingdevelops
  Program: Auto CashApp Deposits
  Description: Automatically deposits cashapp payments into a users account.
  Date: 10/13/2021
*/

const express = require("express");
const router = express.Router();
const { validateJWT } = require("../middleware/auth");
const config = require("../config");
const User = require("../models/User");
const Cashapp = require("../models/Cashapp");
const DepositRequest = require("../models/DepositRequest");
const axios = require("axios");
const insertNewWalletTransaction = require("../utils/insertNewWalletTransaction");

const CASH_TAGS = ["$Desking9"];

function generateUniqueVerificationNote() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const noteLength = 10;

  let note = '';
  for (let i = 0; i < noteLength; i++) {
    note += characters.charAt(Math.floor(Math.random() * characters.length));
  }

  return note;
}


/**
 * @route   POST /api/cashapp/initialize
 * @desc    Initialize the deposit request
 * @access  Public
 */
router.post("/initialize", validateJWT, async (req, res, next) => {
  try {
    // Validate input
    const { deposit_amount } = req.body;
    if (isNaN(parseFloat(deposit_amount)) || parseFloat(deposit_amount) <= 0) {
      return res.json({ success: false, message: "Invalid deposit amount." });
    }

    // Generate secure randomness
    const cash_tag = CASH_TAGS[Math.floor(Math.random() * CASH_TAGS.length)];
    const verification_note = generateUniqueVerificationNote(); 

    // Save deposit request to database
    const depositRequest = new DepositRequest({
      amount: deposit_amount,
      verification_note,
      cashtag: cash_tag,
      _user: req.user.id
    });
    await depositRequest.save();

    return res.json({
      success: true,
      note: verification_note,
      cashtag: cash_tag
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * @route   POST /api/cashapp/check
 * @desc    Check the payment URL to verify the requirements and credit the user
 * @access  Public
 */
router.post("/check", validateJWT, async (req, res, next) => {
  try {
    // Validate input
    const { payment_link } = req.body;
    if (!payment_link.startsWith("https://cash.app/payments/")) {
      return res.json({ success: false, message: "Invalid payment link." });
    }

    const startIndex = payment_link.indexOf('/payments/') + '/payments/'.length;
    const endIndex = payment_link.indexOf('/receipt');
    const payment_id = payment_link.substring(startIndex, endIndex);

    const previousCashapp = await Cashapp.findOne({ txid: payment_id });

    if (previousCashapp) {
      return res.json({ success: false, message: "Deposit already claimed ;)" });
    }

    const cashapp_json = `https://cash.app/receipt-json/f/${payment_id}`;

    const response = await axios.get(cashapp_json).then(res => res.data);

    const { detail_rows, notes, header_subtext, status_treatment } = response;

    const depositRequest = await DepositRequest.findOne({ verification_note: notes });

    if (!depositRequest) {
      return res.json({ success: false, message: "Deposit request not found." });
    }

    const cash_amount = parseFloat(detail_rows[0]?.value.replace(/^\$/, ''));
    const site_value = (cash_amount*2).toFixed(2);
    const sender_cashtag = header_subtext.split(' ')[2];

    if (cash_amount !== depositRequest.amount || notes !== depositRequest.verification_note) { // 
      return res.json({ success: false, message: "Payment verification failed." });
    }

    if (String(detail_rows[1].value) != "Cash") {
      return res.json({ success: false, message: "Money must be sent with cash balance!" });
    }

    if (String(status_treatment) != "SUCCESS") {
      return res.json({ success: false, message: "Payment must be successful!" });
    }

    await depositRequest.delete();

    let user = await User.findById(depositRequest._user);
    user = await User.findOneAndUpdate({ _id: depositRequest._user }, { $inc: { wallet: site_value, totalDeposited: site_value,
      wagerNeededForWithdraw: user.wagerNeededForWithdraw < 0 ? Math.abs(user.wagerNeededForWithdraw) + parseFloat(site_value) : parseFloat(site_value), }});
    insertNewWalletTransaction(depositRequest._user, site_value, `Cashapp Deposit`);

    const newTransaction = new Cashapp({
      type: "deposit",
      currency: "cash",
      usdValue: cash_amount,
      siteValue: site_value,
      senderTag: sender_cashtag,
      recieverTag: depositRequest.cashtag,
      txid: payment_id,
      webLink: payment_link,
      _user: user.id
    });

    await newTransaction.save();

    try {
      const information = `
        \`\`\`
User: ${user.username}
UID: ${user._id}

Method: cashapp
Value: $${cash_amount}

Link: ${payment_link}\`\`\`
      `

      await axios.post(config.site.discordDepositWebhook ,{
        "username": "Deposit",
        "avatar_url": "https://i.imgur.com/4M34hi2.png",
        "content": "@everyone New Deposit!" + information,
      });
    } catch(error) {
      console.error(error)
    }
    
    return res.json({ success: true, message: `Successfully credited ${site_value} coins to your wallet! Refresh page to see changes.` });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;