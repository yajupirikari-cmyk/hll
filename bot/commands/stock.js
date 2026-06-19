const { EmbedBuilder } = require('discord.js');
const Product = require('../../models/Product');
const Stock = require('../../models/Stock');

module.exports = {
  name: 'stock',
  description: '現在登録されている商品名とそれぞれの残り在庫数を確認します',
  
  async execute(message, args) {
    const serverId = process.env.TARGET_SERVER_ID;

    if (message.guildId && message.guildId !== serverId) return;

    try {
      const products = await Product.find({ serverId });

      const embed = new EmbedBuilder()
        .setTitle('在庫状況')
        .setColor(0x0099FF)
        .setTimestamp();

      if (products.length === 0) {
        embed.setDescription('現在、登録されている商品はありません。');
        return message.channel.send({ embeds: [embed] });
      }

      for (const product of products) {
        let stockQuery = { productId: product._id, isUsed: false };
        if (product.expiresInHours) {
          const expirationDate = new Date(Date.now() - product.expiresInHours * 60 * 60 * 1000);
          stockQuery.createdAt = { $gt: expirationDate };
        }
        const stockCount = await Stock.countDocuments(stockQuery);
        // 絵文字は使用しない
        embed.addFields({ name: product.name, value: `残り: ${stockCount}件`, inline: true });
      }

      await message.channel.send({ embeds: [embed] });

    } catch (error) {
      console.error(error);
      await message.reply('在庫情報の取得中にエラーが発生しました。').catch(() => {});
    }
  }
};
