const mongoose = require('mongoose');

const winHistorySchema = new mongoose.Schema({
  serverId: {
    type: String,
    required: true,
    index: true
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  username: {
    type: String,
    required: true
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  productName: {
    type: String,
    required: true,
    index: true
  },
  tokenContent: {
    type: String,
    required: true
  },
  wonAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

module.exports = mongoose.model('WinHistory', winHistorySchema);
