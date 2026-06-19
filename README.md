# Gacha Bot & Admin Dashboard

商品・在庫管理機能付き抽選(ガチャ)Discord Botと、それを管理するWebダッシュボードです。

## 前提条件
- Node.js v18 以上
- MongoDB
- Discord Developer Portal での Bot / OAuth2 Application 登録

## セットアップ手順

1. **パッケージのインストール**
```bash
npm install
```

2. **環境変数の設定**
`.env.example` を `.env` にコピーして編集します。

```bash
cp .env.example .env
```

`.env` 必須項目:
- `DISCORD_BOT_TOKEN`: Botのトークン
- `DISCORD_CLIENT_ID`: アプリケーションのClient ID
- `DISCORD_CLIENT_SECRET`: アプリケーションのClient Secret
- `DISCORD_REDIRECT_URI`: OAuth2コールバックURL (例: `http://localhost:3000/auth/callback`)
  - ※ Discord Developer Portalの「OAuth2 > Redirects」にも同じURLを登録してください。
- `TARGET_SERVER_ID`: Botを稼働させるサーバー(Guild)のID
- `SPIN_CHANNEL_ID`: `/spin` コマンドを許可するチャンネルのID
- `ADMIN_ROLE_ID`: Webダッシュボードにアクセスできる管理者ロールのID
- `ADMIN_USER_ID`: 当選通知DMを受け取る管理者のユーザーID

3. **Discord Bot Intents の設定**
Discord Developer Portalの「Bot > Privileged Gateway Intents」にて、以下を全てONにしてください。
- Presence Intent
- Server Members Intent
- Message Content Intent

4. **Botコマンドの登録**
対象サーバーにスラッシュコマンド(`/spin`)を登録します。

```bash
npm run deploy
```

5. **アプリケーションの起動**
Bot本体とWebダッシュボード(Expressサーバー)を同時に起動します。

```bash
npm run dev
```

※ 本番環境など別々に起動する場合は `npm run start` と `npm run web` を実行してください。

## Webダッシュボードの利用方法
ブラウザで `http://localhost:3000` (ポート設定に従う) にアクセスし、「Login with Discord」からログインしてください。
対象サーバーの指定された管理者ロール(`ADMIN_ROLE_ID`)を持っている場合のみアクセス可能です。

## 機能
- **`/spin <商品名>`**: 商品名を指定してガチャを回します。(1時間に1回制限)
- **`L!stock`**: 現在の商品と在庫数をテキストコマンドで表示します。(管理者・一般問わず使用可能)
- **Web Dashboard**: 商品登録、トークン一括登録、当選確率設定、履歴確認が可能です。
