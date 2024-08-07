// Require Dependencies
const express = require("express");
const router = (module.exports = express.Router());
const {validateJWT } = require("../middleware/auth");
const rateLimit = require("express-rate-limit");
const config = require("../config");
const crypto = require('crypto');

const User = require("../models/User");
const mm2Withdrawl = require("../models/mm2Withdrawl");
const item_values = require("../config/items.json");
const Listing = require("../models/MarketplaceListing");
const { validateExpressRequest } = require("twilio/lib/webhooks/webhooks");

let totalItems = 0
let totalValue = 0

const limiter = rateLimit({
  windowMs: 1000, // 1 seconds
  max: 3,
  message: {
    error: "You can do this only every 1 second. Please wait",
    stack: {},
  },
});

const middleware = [limiter, validateJWT];

/**
 * @route   GET /api/mm2/ValidateUser
 * @desc    Confrims a user with that roblox username exists
 * @access  Public`
 */
router.post('/ValidateUser', async (req, res) => {
  try {
    const userid = req.body.Data.UserId;
    User.findOne({ robloxUsername: userid }, (err, user) => {
      if (user) {
        res.status(200).json({ Valid: true });
      } else {
        res.status(200).json({ Valid: false });
      }
    });
  } catch (err) {
    res.status(500).json({ Valid: false });
  }
});

/**
 * @route   GET /api/mm2/GetUserData
 * @desc    idk same as above
 * @access  Public`
 */
router.post('/GetUserData', (req, res) => {
  try {
    const userid = req.body.Data.UserId;
    User.findOne({ robloxUsername: userid }, (err, userdata) => {
      if (userdata) {
        res.status(200).json({
          Exists: true,
          Valid: true,
          Blacklisted: false,
          Blacklist: false,
        });
      } else {
        res.status(200).json({ Exists: false });
      }
    });
  } catch (err) {
    res.status(500).json({ Valid: false });
  }
});

/**
 * @route   GET /api/mm2/MurderMystery2/Trading/Withdraw/GetSession
 * @desc    Starts a withdraw session I think
 * @access  Public`
 */
router.post('/MurderMystery2/Trading/Withdraw/GetSession', async (req, res) => {
  const userid = req.body.Data.UserId;
  mm2Withdrawl.findOne({ robloxUsername: userid }, (err, withdrawals) => {
    if (withdrawals) {
      const withdrawal = {};
      withdrawals.items.forEach((item) => {
        withdrawal[item] = (withdrawal[item] || 0) + 1;
      });
      res.status(200).json({ Exists: true, Items: withdrawal });
    } else {
      res.status(200).json({ Exists: false, Items: {} });
    }
  });
});

/**
 * @route   GET /api/mm2/MurderMystery2/Trading/Withdraw/ConfirmSession
 * @desc    idk tbh
 * @access  Public`
 */
router.post('/MurderMystery2/Trading/Withdraw/ConfirmSession', async (req, res) => {
  const userid = req.body.Data.UserId;
  mm2Withdrawl.findOneAndDelete({ robloxUsername: userid }, (err, result) => {
    if (result.value) {
      res.status(200).json({});
    } else {
      res.status(500).json({});
    }
  });
});

/**
 * @route   GET /api/mm2/MurderMystery2/Trading/Withdraw/CancelSession
 * @desc    Cancel deposit session
 * @access  Public`
 */
router.post('/MurderMystery2/Trading/Withdraw/CancelSession', async (req, res) => {
  const userid = req.body.Data.UserId;
  mm2Withdrawl.findOneAndDelete({ robloxUsername: userid }, (err, result) => {
    if (result.value) {
      const torefund = [];
      let value = 0;
      result.value.items.forEach((item) => {
        value = item_values[item] ? item_values[item].value : 0;
        /*const thumbnail = item_values[item] ? item_values[item].thumbnail : 'https://www.seekpng.com/png/full/149-1490962_10kib-420x420-chill-face.png';
        const display_name = item_values[item] ? item_values[item].display_name : item;
        torefund.push({
          game_name: item,
          uid: require('crypto').createHash('md5').update(`${item}${Date.now()}${Math.random()}`).digest('hex'),
          value,
          thumbnail,
          display_name,
        });*/
      });
      User.updateOne({ robloxUsername: userid }, { $set: { wallet: +value } }, (err) => {
        if (!err) {
          res.status(200).json([]);
        } else {
          res.status(500).json([]);
        }
      });
    } else {
      res.status(500).json([]);
    }
  });
});

/**
 * @route   GET /api/mm2/MurderMystery2/Trading/Deposit
 * @desc    Deposit post
 * @access  Public`
 */
router.post('/MurderMystery2/Trading/Deposit', async (req, res) => {
  try {
    const data = req.body.Data;
    const userid = data.UserId;
    const items = data.Items;
    const hashdeposit = req.body.SecurityKey;

    const hashsecurity = crypto.createHash('md5').update('!').digest('hex');
    if (hashdeposit === hashsecurity) {
      let total = 0;
      const user = await User.findOne({ robloxUsername: userid });

      if (!user) {
        return res.status(404).json({ status: "User-Not-Found" });
      }

      for (const item in items) {
        if (items.hasOwnProperty(item)) {
          total += items[item] * (item_values[item] ? item_values[item].value : 0);

          for (let i = 0; i < items[item]; i++) {
            user.inventory = user.inventory || [];
            user.inventory.push({
              game_name: item,
              display_name: item_values[item].display_name,
              thumbnail: item_values[item].thumbnail,
              value: item_values[item].value,
              uid: crypto.createHash('md5').update(`${item}${Date.now()}${Math.random()}`).digest('hex')
            });
          }
        }
      }

      await user.save();

      res.status(200).json({ status: "Success", wallet: user.wallet, inventory: user.inventory });
    } else {
      res.status(403).json({ status: "Invalid-Security-Key" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ ResponseMessage: 'Server Error', ResponseCode: 5 });
  }
});

/**
 * @route   POST /api/mm2/market/list
 * @desc    List an item on the marketplace
 * @access  Private
 */
router.post('/market/list', middleware, async (req, res) => {
  try {
    const { item, adjustment } = req.body;
    let user = await User.findOne({ _id: req.user.id });

    if (!user) {
      return res.status(404).json({ status: "User-Data-Invalid" });
    }

    if (!item_values[item.game_name]) {
      return res.status(404).json({ status: "Item-Not-Found" });
    }

    const basePrice = item_values[item.game_name].value;
    let finalPrice = basePrice;

    if (adjustment) {
      if (adjustment >= 1 && adjustment <= 20) {
        finalPrice += (basePrice * adjustment / 100);
      } else if (adjustment <= -1 && adjustment >= -20) {
        finalPrice = finalPrice + (basePrice * adjustment / 100);
      } else {
        return res.status(400).json({ status: "Invalid-Adjustment" });
      }
    }

    // Check if the item exists in the user's inventory
    const itemIndex = user.inventory.findIndex(inventoryItem => inventoryItem.uid === item.uid);
    if (itemIndex === -1) {
      return res.status(400).json({ status: "Item-Not-In-Inventory" });
    }

    // Remove the item from the user's inventory
    user.inventory.splice(itemIndex, 1);
    await user.save();

    const newListing = new Listing({
      item,
      display_name: item_values[item.game_name].display_name,
      thumbnail: item_values[item.game_name].thumbnail,
      game_name: item.game_name,
      price: finalPrice,
      adjustment: adjustment,
      user: user._id
    });

    await newListing.save();

    res.status(201).json({ status: "Item-Listed", listing: newListing });
  } catch (err) {
    console.error(err)
    res.status(500).json({ ResponseMessage: 'Server Error', ResponseCode: 5 });
  }
});

/**
 * @route   POST /api/mm2/market/withdraw
 * @desc    Process withdrawal from the marketplace
 * @access  Private
 */
router.post('/market/withdraw', middleware, async (req, res) => {
  try {
    const { listingId } = req.body;

    if (!listingId) {
      return res.status(400).json({ ResponseMessage: 'Invalid body', ResponseCode: 4 });
    }

    const listing = await Listing.findById(listingId).populate('user');

    if (!listing) {
      return res.status(404).json({ status: "Listing-Not-Found" });
    }

    const user = await User.findOne({ _id: req.user.id });

    if (!user) {
      return res.status(404).json({ status: "User-Data-Invalid" });
    }

    if (listing.user._id.equals(user._id)) {
      return res.status(404).json({ status: "Can\'t buy from yourself dumb ass" });
    }

    if (user.wallet < listing.price) {
      return res.status(400).json({ status: "Insufficient-Funds" });
    }

    // Deduct the amount from the buyer's wallet
    user.wallet -= listing.price;
    await user.save();

    // Add the amount to the seller's wallet
    const seller = listing.user;
    seller.wallet += listing.price;
    await seller.save();

    totalItems++
    totalValue += listing.price;

    // Add the item to the buyer's inventory
    user.inventory = user.inventory || [];
    user.inventory.push({
      game_name: listing.game_name,
      display_name: listing.display_name,
      thumbnail: listing.thumbnail,
      value: item_values[listing.game_name].value,
      uid: crypto.createHash('md5').update(`${listing.item}${Date.now()}${Math.random()}`).digest('hex')
    });

    await user.save();

    // Remove the listing
    await Listing.findByIdAndDelete(listingId);

    res.status(200).json({
      status: "Success",
      item: {
        game_name: listing.item,
        display_name: listing.display_name,
        thumbnail: listing.thumbnail,
        value: listing.price
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ResponseMessage: 'Server Error', ResponseCode: 5 });
  }
});

/**
 * @route   POST /api/mm2/withdraw
 * @desc    Create a withdrawal session by removing the item from the user's inventory and adding it to the withdrawal record
 * @access  Private
 */
router.post('/withdraw', middleware, async (req, res) => {
  try {
    const { item } = req.body;

    if (!item) {
      return res.status(400).json({ ResponseMessage: 'Invalid body', ResponseCode: 4 });
    }

    const user = await User.findOne({ _id: req.user.id });

    if (!user) {
      return res.status(404).json({ status: "User-Not-Found" });
    }

    if (!item_values[item.game_name]) {
      return res.status(404).json({ status: "Item-Not-Found" });
    }

    const itemIndex = user.inventory.findIndex(inventoryItem => inventoryItem.uid === item.uid);
    if (itemIndex === -1) {
      return res.status(400).json({ status: "Item-Not-In-Inventory" });
    }

    const itemToWithdraw = user.inventory.splice(itemIndex, 1)[0];

    await user.save();

    let withdrawal = await mm2Withdrawl.findOne({ robloxUsername: user.robloxUsername });

    if (!withdrawal) {
      withdrawal = new mm2Withdrawl({
        robloxUsername: user.robloxUsername,
        items: []
      });
    }

    withdrawal.items.push(itemToWithdraw.game_name);
    await withdrawal.save();

    res.status(200).json({
      status: "Success",
      withdrawal: {
        robloxUsername: withdrawal.robloxUsername,
        items: withdrawal.items
      }
    });
  } catch (err) {
    console.error(err)
    res.status(500).json({ ResponseMessage: 'Server Error', ResponseCode: 5 });
  }
});

router.post('/withdraw/cancel', middleware, async (req, res) => {
  try {
    const { item } = req.body;

    if (!item) {
      return res.status(400).json({ ResponseMessage: 'Invalid body', ResponseCode: 4 });
    }

    let user = await User.findOne({ _id: req.user.id });

    if (!user) {
      return res.status(404).json({ status: "User-Not-Found" });
    }

    if (!item_values[item]) {
      return res.status(404).json({ status: "Item-Not-Found" });
    }

    let withdrawal = await mm2Withdrawl.findOne({ robloxUsername: user.robloxUsername });

    if (!withdrawal) {
      res.status(500).json({ ResponseMessage: 'Server Error', ResponseCode: 4 });
    }

    const itemIndex = withdrawal.items.findIndex(inventoryItem => inventoryItem === item);
    if (itemIndex === -1) {
      return res.status(400).json({ status: "Item-Not-In-Withdrawals" });
    }

    withdrawal.items.splice(itemIndex, 1)[0];
    await withdrawal.save();

    user.inventory = user.inventory || [];
    user.inventory.push({
      game_name: item,
      display_name: item_values[item].display_name,
      thumbnail: item_values[item].thumbnail,
      value: item_values[item].value,
      uid: crypto.createHash('md5').update(`${item}${Date.now()}${Math.random()}`).digest('hex')
    });

    await user.save();

    res.status(200).json({
      status: "Success",
    });
  } catch (err) {
    console.error(err)
    res.status(500).json({ ResponseMessage: 'Server Error', ResponseCode: 5 });
  }
});

router.post('/market/cancel', middleware, async (req, res) => {
  try {
    const { listingId } = req.body;

    if (!listingId) {
      return res.status(400).json({ ResponseMessage: 'Invalid body', ResponseCode: 4 });
    }

    const listing = await Listing.findById(listingId).populate('user');

    if (!listing) {
      return res.status(404).json({ status: "Listing-Not-Found" });
    }

    const user = await User.findOne({ _id: listing.user });

    if (!listing.user._id.equals(user._id)) {
      return res.status(404).json({ status: "User-Data-Invalid2" });
    }

    if (!user) {
      return res.status(404).json({ status: "User-Data-Invalid" });
    }

    if (user.wallet < listing.price) {
      return res.status(400).json({ status: "Insufficient-Funds" });
    }

    // Add the item to the buyer's inventory
    user.inventory = user.inventory || [];
    user.inventory.push({
      game_name: listing.game_name,
      display_name: listing.display_name,
      thumbnail: listing.thumbnail,
      value: listing.price,
      uid: crypto.createHash('md5').update(`${listing.item}${Date.now()}${Math.random()}`).digest('hex')
    });

    await user.save();

    await Listing.findByIdAndDelete(listingId);

    res.status(200).json({
      status: "Success",
      item: {
        game_name: listing.item,
        display_name: listing.display_name,
        thumbnail: listing.thumbnail,
        value: listing.price
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ResponseMessage: 'Server Error', ResponseCode: 5 });
  }
});

/**
 * @route   GET /api/mm2/market/listings
 * @desc    Fetch all marketplace listings
 * @access  Public
 */
router.get('/market/listings', limiter, async (req, res) => {
  try {
    const listings = await Listing.find().populate('user', 'username');

    res.status(200).json({ status: "Success", listings, totalValue, totalItems });
  } catch (err) {
    res.status(500).json({ ResponseMessage: 'Server Error', ResponseCode: 5 });
  }
});

/**
 * @route   GET /api/mm2/market/listings
 * @desc    Fetch all marketplace listings
 * @access  Public
 */
router.get('/market/trades', middleware, async (req, res) => {
  try {
    // Check if req.user is properly populated
    if (!req.user || !req.user.id) return res.status(400).json({ status: "Failure", message: "User not authenticated" });

    // Fetch the user from the database
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ status: "Failure", message: "User not found" });

    console.log(user.robloxUsername);
    
    if (user.robloxUsername) {
      const withdrawals = await mm2Withdrawl.find({ robloxUsername: user.robloxUsername })
      console.log(withdrawals)
      const listings = await Listing.find({ user: user._id });
      return res.status(200).json({ status: "Success2", listings, withdrawals: withdrawals[0].items });
    } else {
      const listings = await Listing.find({ user: user._id });
      return res.status(200).json({ status: "Success1", listings });
    }

    // Respond with the listings
  } catch (err) {
    console.error(err); // Log error details
    res.status(500).json({ status: "Failure", ResponseMessage: 'Server Error', ResponseCode: 5 });
  }
});

module.exports = router;