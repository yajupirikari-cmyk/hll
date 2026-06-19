require('dotenv').config();
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');
const mongoose = require('mongoose');

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const connectDB = require('../bot/utils/db');

const app = express();
const PORT = process.env.PORT || 3000;

// EJSセットアップ
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ミドルウェア
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// DB接続
connectDB();

// セッション管理
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/gacha-bot',
    collectionName: 'sessions'
  }),
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 // 24時間
  }
}));

// ルーティング
app.use('/auth', authRoutes);
app.use('/', adminRoutes);

// エラーハンドリング
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

app.listen(PORT, () => {
  console.log(`Web dashboard is running on http://localhost:${PORT}`);
});
