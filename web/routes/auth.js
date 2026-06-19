const express = require('express');
const router = express.Router();
const crypto = require('crypto');

// Discord OAuth2 設定
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI;
const TARGET_SERVER_ID = process.env.TARGET_SERVER_ID;
const ADMIN_ROLE_ID = process.env.ADMIN_ROLE_ID || "1499332574051438662";

router.get('/login', (req, res) => {
  // CSRF対策としてstateを生成
  const state = crypto.randomBytes(16).toString('hex');
  req.session.oauthState = state;

  const authUrl = new URL('https://discord.com/api/oauth2/authorize');
  authUrl.searchParams.append('client_id', CLIENT_ID);
  authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.append('response_type', 'code');
  authUrl.searchParams.append('scope', 'identify guilds guilds.members.read');
  authUrl.searchParams.append('state', state);

  res.redirect(authUrl.toString());
});

router.get('/callback', async (req, res) => {
  const { code, state } = req.query;

  // stateの検証
  if (req.session.oauthState !== state) {
    return res.status(403).send('Invalid state');
  }

  try {
    // 1. アクセストークンの取得
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: REDIRECT_URI
      }),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to fetch access token');
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // 2. ユーザー情報の取得
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: {
        authorization: `Bearer ${accessToken}`
      }
    });
    const userData = await userResponse.json();

    // 3. サーバーメンバー情報の取得 (ロールの確認)
    const memberResponse = await fetch(`https://discord.com/api/users/@me/guilds/${TARGET_SERVER_ID}/member`, {
      headers: {
        authorization: `Bearer ${accessToken}`
      }
    });

    if (!memberResponse.ok) {
      return res.status(403).send('対象サーバーのメンバーではありません');
    }

    const memberData = await memberResponse.json();

    // ロールのチェック
    if (!memberData.roles.includes(ADMIN_ROLE_ID)) {
      return res.status(403).send('管理権限(ロール)がありません');
    }

    // セッションに保存
    req.session.user = {
      id: userData.id,
      username: userData.username,
      avatar: userData.avatar,
      accessToken
    };

    res.redirect('/');

  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).send('Authentication failed');
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/auth/login');
});

module.exports = router;
