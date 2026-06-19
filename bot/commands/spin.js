const { SlashCommandBuilder } = require('discord.js');
const Product = require('../../models/Product');
const Stock = require('../../models/Stock');
const ServerConfig = require('../../models/ServerConfig');
const SpinCooldown = require('../../models/SpinCooldown');
const WinHistory = require('../../models/WinHistory');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('spin')
    .setDescription('商品名を指定して抽選を行います')
    .addStringOption(option =>
      option.setName('product')
        .setDescription('抽選したい商品名')
        .setRequired(true)
        .setAutocomplete(true)
    ),

  async autocomplete(interaction) {
    const serverId = process.env.TARGET_SERVER_ID;
    const focusedValue = interaction.options.getFocused();
    
    // サーバーに登録されている商品を検索
    const products = await Product.find({ serverId, name: { $regex: focusedValue, $options: 'i' } }).limit(25);
    await interaction.respond(
      products.map(p => ({ name: p.name, value: p.name }))
    ).catch(() => {});
  },

  async execute(interaction) {
    const serverId = process.env.TARGET_SERVER_ID;
    const channelId = process.env.SPIN_CHANNEL_ID;
    const userId = interaction.user.id;

    // 1. チャンネル制限
    if (interaction.channelId !== channelId) {
      return interaction.reply({ content: 'このコマンドは指定されたチャンネルでのみ使用できます', ephemeral: true });
    }

    // 2. メンテナンスモード確認
    let config = await ServerConfig.findOne({ serverId });
    if (!config) {
      config = await ServerConfig.create({ serverId });
    }

    if (config.isMaintenanceMode) {
      return interaction.reply({ content: '現在メンテナンス中のため利用できません', ephemeral: true });
    }

    // 3. クールダウン確認 (1時間に1回)
    const cooldown = await SpinCooldown.findOne({ serverId, userId });
    const now = new Date();
    if (cooldown && cooldown.lastSpinAt) {
      const diffMs = now - cooldown.lastSpinAt;
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      if (diffMinutes < 60) {
        const remainingMinutes = 60 - diffMinutes;
        return interaction.reply({ content: `あと${remainingMinutes}分後に再挑戦できます`, ephemeral: true });
      }
    }

    // 4. 商品名の存在確認
    const productName = interaction.options.getString('product');
    const product = await Product.findOne({ serverId, name: productName });
    
    if (!product) {
      return interaction.reply({ content: '指定された商品が見つかりません', ephemeral: true });
    }

    // ここから公開のレスポンス開始
    await interaction.deferReply();

    // クールダウン更新
    await SpinCooldown.findOneAndUpdate(
      { serverId, userId },
      { lastSpinAt: now },
      { upsert: true, new: true }
    );

    // 5. ローリング演出 (絵文字なし)
    const animationFrames = [
      '抽選中',
      '抽選中 .',
      '抽選中 ..',
      '抽選中 ...',
      '抽選中 ....',
      '判定中 /',
      '判定中 -',
      '判定中 \\',
      '判定中 /',
      '判定中 -'
    ];

    for (let i = 0; i < animationFrames.length; i++) {
      await interaction.editReply({ content: animationFrames[i] }).catch(() => {});
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    // 6. 当落判定
    const availableStockCount = await Stock.countDocuments({ productId: product._id, isUsed: false });
    
    let isWin = false;
    if (availableStockCount > 0) {
      const rand = Math.random();
      if (rand < config.winRate) {
        isWin = true;
      }
    }

    if (!isWin) {
      // 落選時: 実行者をメンションしてチャンネル公開
      await interaction.editReply({ content: `<@${userId}> 不当選でした` });
      // ephemeralで本人に通知
      await interaction.followUp({ content: '今回は外れでした', ephemeral: true });
      return;
    }

    // 7. 当選時の処理
    // アトミックに1件取得して使用済みに更新
    const tokenDoc = await Stock.findOneAndUpdate(
      { productId: product._id, isUsed: false },
      { $set: { isUsed: true, usedBy: userId, usedAt: now } },
      { new: true }
    );

    if (!tokenDoc) {
      // 競合等で取得できなかった場合は落選扱いにする
      await interaction.editReply({ content: `<@${userId}> 不当選でした` });
      await interaction.followUp({ content: '今回は外れでした', ephemeral: true });
      return;
    }

    // DM送信
    const dmContent = `商品「${product.name}」に当選しました！\n\nトークン(コード):\n${tokenDoc.content}\n\nこのトークンは、動作しない場合があります。ご了承ください。\n不具合がある場合は、管理者(<@1486923873004945509>)までご連絡ください。`;
    
    let dmSuccess = false;
    try {
      await interaction.user.send(dmContent);
      dmSuccess = true;
    } catch (err) {
      // DM送信失敗時: ロールバック
      await Stock.updateOne({ _id: tokenDoc._id }, { $set: { isUsed: false, usedBy: null, usedAt: null } });
      await interaction.editReply({ content: '抽選が終了しました' });
      await interaction.followUp({ content: 'DMの送信に失敗しました。DMを許可してから再度お試しください', ephemeral: true });
      return;
    }

    // DM送信成功時
    // 公開メッセージは汎用文言
    await interaction.editReply({ content: '抽選が終了しました' });
    // ephemeralで当選通知(内容はDMを見ろと伝えるだけ)
    await interaction.followUp({ content: '当選しました。トークンの内容はDMをご確認ください', ephemeral: true });

    // 履歴保存
    await WinHistory.create({
      serverId,
      userId,
      username: interaction.user.tag,
      productId: product._id,
      productName: product.name,
      tokenContent: tokenDoc.content,
      wonAt: now
    });

    // 管理者へDM通知
    const adminUserId = process.env.ADMIN_USER_ID;
    if (adminUserId) {
      try {
        const adminUser = await interaction.client.users.fetch(adminUserId);
        if (adminUser) {
          await adminUser.send(`ユーザー名: ${interaction.user.tag} (ID: ${userId}) が商品『${product.name}』に当選しました。\n日時: ${now.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`);
        }
      } catch (err) {
        console.error('管理者へのDM送信に失敗:', err);
      }
    }
  }
};
