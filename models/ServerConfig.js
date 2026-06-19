const mongoose = require('mongoose');

const serverConfigSchema = new mongoose.Schema({
  serverId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  winRate: {
    type: Number,
    default: 0.4, // 初期値40%
    min: 0,
    max: 1
  },
  adminRoleId: {
    type: String,
    default: "1499332574051438662" // 初期値
  },
  isMaintenanceMode: {
    type: Boolean,
    default: false
  }
});

module.exports = mongoose.model('ServerConfig', serverConfigSchema);
