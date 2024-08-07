const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const MarketplaceListingSchema = new Schema({
  item: { type: Array, required: true },
  display_name: { type: String, required: true },
  game_name: { type: String, required: true},
  thumbnail: { type: String, required: true },
  price: { type: Number, required: true },
  adjustment: { type: Number},
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  listed_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('MarketplaceListingNew', MarketplaceListingSchema);