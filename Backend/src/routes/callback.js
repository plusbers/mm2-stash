// Require Dependencies
const express = require("express");
const router = (module.exports = express.Router());
const { validateJWT } = require("../middleware/auth");
const crypto = require("crypto");
const colors = require("colors");
const config = require("../config");

const User = require("../models/User");
const CryptoTransaction = require("../models/CryptoTransaction");
const insertNewWalletTransaction = require("../utils/insertNewWalletTransaction");
const axios = require("axios");

/**
 * @route   POST /api/callback/
 * @desc   
 * @access  Public`
 */
router.post("/", async (req, res, next) => {
  let data = req.body;

  const apiSecretKey = config.authentication.oaxpay.merchant_id;
  const hmacHeader = req.headers['hmac'];
  const calculatedHmac = crypto.createHmac('sha512', apiSecretKey).update(JSON.stringify(data)).digest('hex');
  if (calculatedHmac === hmacHeader) {
      if(data.status == "Paid") {
        const find = await CryptoTransaction.findOne({ txid: data.txID });
        if(find) {
          res.statusCode = 200;
          res.end('OK');
        }

        const address = data.address;
        const currency = data.currency;
        const amount = data.amount;
        const txid = data.txID;
        const usdAmount = await axios.get(`https://min-api.cryptocompare.com/data/price?fsym=${currency.toUpperCase()}&tsyms=USD`).then(res => {return parseFloat(res.data.USD * amount).toFixed(2)});
        const siteValue = parseFloat(usdAmount * 2);
        const user = await User.findOne({[`crypto.${currency.toLowerCase()}.address`]: address});

        await CryptoTransaction.findOneAndUpdate(
          { txid: txid }, 
          { 
            $set: { 
              state: 3,
              siteValue: siteValue,
              usdValue: usdAmount
            } 
          }
        );
  
        insertNewWalletTransaction(user._id, siteValue, `${currency} Deposit`);
        await User.updateOne({ _id: user._id }, { $inc: { wallet: siteValue, totalDeposited: siteValue,
          wagerNeededForWithdraw: user.wagerNeededForWithdraw < 0 ? Math.abs(user.wagerNeededForWithdraw) + parseFloat(siteValue) : parseFloat(siteValue), }});  
        

        try {
          const { io } = require('../index.js');
          io.of('/chat').to(user._id).emit("update-wallet", siteValue);
          io.of('/chat').to(user._id).emit("notification", `Your deposit of ${siteValue} coins ($${(usdAmount)}) has been credited!`);
        } catch (error) {
          console.error(error);
        }

        try {
          const information = `
            \`\`\`
User: ${user.username}
UID: ${user._id}

Coin: ${currency}
Value: $${usdAmount}

Crypto: ${amount}
TXID: ${txid}\`\`\`
          `

          await axios.post(config.site.discordDepositWebhook ,{
            "username": "Deposit",
            "avatar_url": "https://i.imgur.com/4M34hi2.png",
            "content": "@everyone New Deposit!" + information,
          });
        } catch(error) {
          console.error(error)
        }
  
        console.log(
          colors.blue("0xapay >> Deposit verified! Gave"),
          colors.cyan(`${siteValue}`),
          colors.blue("coins to"),
          colors.cyan(user.username)
        );
      } else {

        const address = data.address;
        const currency = data.currency;
        const amount = data.amount;
        const txid = data.txID;
        const usdAmount = await axios.get(`https://min-api.cryptocompare.com/data/price?fsym=${currency.toUpperCase()}&tsyms=USD`).then(res => {return parseFloat(res.data.USD * amount).toFixed(2)});
        const siteValue = parseFloat(usdAmount * 2);
        const user = await User.findOne({[`crypto.${currency.toLowerCase()}.address`]: address});

        const newTransaction = new CryptoTransaction({
          type: "deposit",
  
          currency, 
          siteValue: siteValue, 
          usdValue: usdAmount,
          cryptoValue: amount, 
          address: address, 
  
          txid: txid, 
          state: 1, 
  
          _user: user._id, 
        });
  
        await newTransaction.save();

        try {
          const { io } = require('../index.js');
          io.of('/chat').to(user._id).emit("notification", `Your deposit has been seen on the blockchain!`);
        } catch (error) {
          console.error(error);
        }

        console.log(
          colors.blue("0xapay >> Deposit pending!"),
          colors.cyan(`${data.amount}`),
          colors.blue("coins to"),
          colors.cyan(data.currency)
        );
      }
      res.statusCode = 200;
      res.end('OK');
  } else {
      // HMAC signature is not valid
      // Handle the error accordingly
      res.statusCode = 400;
      res.end('Invalid HMAC signature');
  }
});