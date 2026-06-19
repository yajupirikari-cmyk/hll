const mongoose = require('mongoose');

const stockSchema = new mongoose.Schema({
  serverId: {
    type: String,
    required: true,
    index: true
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true
  },
  content: {
    type: String,
    required: true
  },
  isUsed: {
    type: Boolean,
    default: false,
    index: true
  },
  usedBy: {
    type: String,
    default: null
  },
  usedAt: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// 同じ商品内で同じトークンの重複登録を禁止
stockSchema.index({ productId: 1, content: 1 }, { unique: true });

module.exports = mongoose.model('Stock', stockSchema);
