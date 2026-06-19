require('dotenv').config();
const { Client, Collection, GatewayIntentBits, Partials } = require('discord.js');
const fs = require('fs');
const path = require('path');
const connectDB = require('./utils/db');

// Botクライアントの初期化 (必要なIntentsを指定)
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel, Partials.Message]
});

client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');

if (!fs.existsSync(commandsPath)) {
  fs.mkdirSync(commandsPath, { recursive: true });
}

// コマンドの読み込み
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
  } else if ('name' in command && 'execute' in command && !('data' in command)) {
    // テキストコマンド(L!stock等)も必要に応じてマッピング可能
    client.commands.set(command.name, command);
  }
}

client.once('ready', async () => {
  await connectDB();
  console.log(`Logged in as ${client.user.tag}!`);

  // 自動でスラッシュコマンドを登録する
  try {
    const { REST, Routes } = require('discord.js');
    const commandsArray = [];
    client.commands.forEach(cmd => {
      if (cmd.data) commandsArray.push(cmd.data.toJSON());
    });

    if (commandsArray.length > 0) {
      const rest = new REST().setToken(process.env.DISCORD_BOT_TOKEN);
      console.log('Started refreshing application (/) commands automatically.');
      await rest.put(
        Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.TARGET_SERVER_ID),
        { body: commandsArray },
      );
      console.log('Successfully reloaded application (/) commands automatically.');
    }
  } catch (error) {
    console.error('Failed to register commands automatically:', error);
  }
});

client.on('interactionCreate', async interaction => {
  // スラッシュコマンド
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(error);
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: 'コマンド実行中にエラーが発生しました', ephemeral: true }).catch(console.error);
      } else {
        await interaction.reply({ content: 'コマンド実行中にエラーが発生しました', ephemeral: true }).catch(console.error);
      }
    }
  } 
  // オートコンプリート
  else if (interaction.isAutocomplete()) {
    const command = client.commands.get(interaction.commandName);
    if (!command || !command.autocomplete) return;

    try {
      await command.autocomplete(interaction);
    } catch (error) {
      console.error(error);
    }
  }
});

// テキストコマンドの処理 (L!stock用)
client.on('messageCreate', async message => {
  if (message.author.bot) return;

  const prefix = 'L!';
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();

  const command = client.commands.get(commandName);
  if (!command) return;

  try {
    await command.execute(message, args);
  } catch (error) {
    console.error(error);
    await message.reply('コマンド実行中にエラーが発生しました').catch(console.error);
  }
});

client.login(process.env.DISCORD_BOT_TOKEN);
