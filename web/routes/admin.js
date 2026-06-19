const express = require('express');
const router = express.Router();
const Product = require('../../models/Product');
const Stock = require('../../models/Stock');
const ServerConfig = require('../../models/ServerConfig');
const WinHistory = require('../../models/WinHistory');

// 認証ミドルウェア
const isAuthenticated = (req, res, next) => {
  if (req.session && req.session.user) {
    return next();
  }
  res.redirect('/auth/login');
};

router.use(isAuthenticated);

const serverId = process.env.TARGET_SERVER_ID;

// ダッシュボードトップ
router.get('/', async (req, res) => {
  const productsCount = await Product.countDocuments({ serverId });
  
  // 有効な総在庫数の計算
  const validStockQuery = {
    serverId: serverId,
    isUsed: false,
    $or: [
      { expiresInHours: null },
      { expiresInHours: { $exists: false } },
      {
        $expr: {
          $gt: [
            { $add: ["$createdAt", { $multiply: ["$expiresInHours", 60 * 60 * 1000] }] },
            new Date()
          ]
        }
      }
    ]
  };
  const stockCount = await Stock.countDocuments(validStockQuery);
  
  const historyCount = await WinHistory.countDocuments({ serverId });
  
  res.render('dashboard', { 
    user: req.session.user,
    productsCount,
    stockCount,
    historyCount
  });
});

// 商品管理
router.get('/products', async (req, res) => {
  const products = await Product.find({ serverId }).sort({ createdAt: -1 });
  
  // 各商品の残り在庫数を取得
  const productsWithStock = await Promise.all(products.map(async p => {
    const validStockQuery = {
      productId: p._id,
      isUsed: false,
      $or: [
        { expiresInHours: null },
        { expiresInHours: { $exists: false } },
        {
          $expr: {
            $gt: [
              { $add: ["$createdAt", { $multiply: ["$expiresInHours", 60 * 60 * 1000] }] },
              new Date()
            ]
          }
        }
      ]
    };
    const stockCount = await Stock.countDocuments(validStockQuery);
    return { ...p.toObject(), stockCount };
  }));

  res.render('products', { user: req.session.user, products: productsWithStock });
});

router.post('/products', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || name.trim() === '') return res.status(400).send('商品名は必須です');

    await Product.create({ serverId, name: name.trim() });
    res.redirect('/products');
  } catch (error) {
    if (error.code === 11000) {
      res.status(400).send('同名の商品が既に存在します');
    } else {
      console.error(error);
      res.status(500).send('エラーが発生しました');
    }
  }
});

router.post('/products/:id/delete', async (req, res) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, serverId });
    if (product) {
      await product.deleteOne(); // preミドルウェアでStockも削除される
    }
    res.redirect('/products');
  } catch (error) {
    console.error(error);
    res.status(500).send('エラーが発生しました');
  }
});

// 商品詳細 (トークン管理)
router.get('/products/:id', async (req, res) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, serverId });
    if (!product) return res.status(404).send('商品が見つかりません');

    const stocks = await Stock.find({ productId: product._id }).sort({ createdAt: -1 });

    res.render('product-detail', { user: req.session.user, product, stocks });
  } catch (error) {
    console.error(error);
    res.status(500).send('エラーが発生しました');
  }
});

// トークン一括登録
router.post('/products/:id/tokens', async (req, res) => {
  try {
    const { tokens, expiresInHours } = req.body;
    if (!tokens || tokens.trim() === '') return res.redirect(`/products/${req.params.id}`);

    const tokenArray = tokens.split('\n').map(t => t.trim()).filter(t => t !== '');
    
    const parsedHours = (expiresInHours && !isNaN(parseInt(expiresInHours))) ? parseInt(expiresInHours) : null;

    // 重複を排除して保存
    let addedCount = 0;
    for (const content of tokenArray) {
      const exists = await Stock.findOne({ productId: req.params.id, content });
      if (!exists) {
        await Stock.create({ serverId, productId: req.params.id, content, expiresInHours: parsedHours });
        addedCount++;
      }
    }

    res.redirect(`/products/${req.params.id}`);
  } catch (error) {
    console.error(error);
    res.status(500).send('エラーが発生しました');
  }
});

// 個別トークン削除
router.post('/products/:productId/tokens/:tokenId/delete', async (req, res) => {
  try {
    await Stock.deleteOne({ _id: req.params.tokenId, productId: req.params.productId });
    res.redirect(`/products/${req.params.productId}`);
  } catch (error) {
    console.error(error);
    res.status(500).send('エラーが発生しました');
  }
});

// 履歴確認
router.get('/history', async (req, res) => {
  try {
    const { search, product } = req.query;
    let query = { serverId };

    if (search) {
      query.$or = [
        { userId: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (product && product !== '') {
      query.productId = product;
    }

    const histories = await WinHistory.find(query).sort({ wonAt: -1 }).limit(100);
    const products = await Product.find({ serverId });

    res.render('history', { user: req.session.user, histories, products, query: req.query });
  } catch (error) {
    console.error(error);
    res.status(500).send('エラーが発生しました');
  }
});

// 設定画面
router.get('/settings', async (req, res) => {
  let config = await ServerConfig.findOne({ serverId });
  if (!config) {
    config = await ServerConfig.create({ serverId });
  }
  res.render('settings', { user: req.session.user, config });
});

router.post('/settings', async (req, res) => {
  try {
    let { winRate, isMaintenanceMode } = req.body;
    winRate = parseFloat(winRate);
    if (isNaN(winRate) || winRate < 0 || winRate > 1) {
      return res.status(400).send('不正な当選確率です');
    }

    await ServerConfig.findOneAndUpdate(
      { serverId },
      { winRate, isMaintenanceMode: isMaintenanceMode === 'on' },
      { upsert: true }
    );

    res.redirect('/settings');
  } catch (error) {
    console.error(error);
    res.status(500).send('エラーが発生しました');
  }
});

module.exports = router;
