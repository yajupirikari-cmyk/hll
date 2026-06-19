const mongoose = require('mongoose');

const spinCooldownSchema = new mongoose.Schema({
  serverId: {
    type: String,
    required: true
  },
  userId: {
    type: String,
    required: true
  },
  lastSpinAt: {
    type: Date,
    required: true
  }
});

// サーバーIDとユーザーIDの組み合わせでユニーク、検索も高速化
spinCooldownSchema.index({ serverId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('SpinCooldown', spinCooldownSchema);
