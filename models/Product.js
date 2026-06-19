const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  serverId: {
    type: String,
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  expiresInHours: {
    type: Number,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// 同じサーバー内で商品名の重複を禁止
productSchema.index({ serverId: 1, name: 1 }, { unique: true });

// 商品が削除されたとき、関連する在庫も削除するミドルウェア
productSchema.pre('deleteOne', { document: true, query: false }, async function() {
  await mongoose.model('Stock').deleteMany({ productId: this._id });
});

productSchema.pre('findOneAndDelete', async function() {
  const docToUpdate = await this.model.findOne(this.getQuery());
  if (docToUpdate) {
    await mongoose.model('Stock').deleteMany({ productId: docToUpdate._id });
  }
});

productSchema.pre('deleteMany', async function() {
  const docsToDelete = await this.model.find(this.getQuery());
  for (const doc of docsToDelete) {
    await mongoose.model('Stock').deleteMany({ productId: doc._id });
  }
});


module.exports = mongoose.model('Product', productSchema);
