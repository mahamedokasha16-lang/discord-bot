import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  ActivityType,
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder,
} from "discord.js";
import {
  AudioPlayerStatus,
  NoSubscriberBehavior,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  joinVoiceChannel,
  entersState,
  type AudioPlayer,
  type VoiceConnection,
} from "@discordjs/voice";
import play from "play-dl";

const token = process.env.DISCORD_BOT_TOKEN;

if (!token) {
  throw new Error(
    "DISCORD_BOT_TOKEN is missing. Add it to the project's Secrets before starting the bot.",
  );
}

const discordToken = token;
const musicSessions = new Map<
  string,
  { connection: VoiceConnection; player: AudioPlayer; title: string }
>();
const scores = new Map<string, number>();
type XoGame = { board: string[]; players: [string, string]; turn: 0 | 1 };
const xoGames = new Map<string, XoGame>();
type LadderGame = { player: string; position: number };
const ladderGames = new Map<string, LadderGame>();
type SnakeGame = { x: number; y: number; foodX: number; foodY: number; score: number };
const snakeGames = new Map<string, SnakeGame>();

const commands = [
  new SlashCommandBuilder().setName("ping").setDescription("يتأكد إن البوت شغال"),
  new SlashCommandBuilder().setName("help").setDescription("يعرض الأوامر المتاحة"),
  new SlashCommandBuilder().setName("server").setDescription("يعرض معلومات السيرفر الحالي"),
  new SlashCommandBuilder()
    .setName("clear")
    .setDescription("يمسح رسائل من القناة")
    .addIntegerOption((option) =>
      option
        .setName("amount")
        .setDescription("عدد الرسائل من 1 إلى 100")
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("يطرد عضوًا من السيرفر")
    .addUserOption((option) => option.setName("member").setDescription("العضو").setRequired(true))
    .addStringOption((option) => option.setName("reason").setDescription("السبب")),
  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("يحظر عضوًا من السيرفر")
    .addUserOption((option) => option.setName("member").setDescription("العضو").setRequired(true))
    .addStringOption((option) => option.setName("reason").setDescription("السبب")),
  new SlashCommandBuilder()
    .setName("play")
    .setDescription("يشغل أغنية من YouTube في القناة الصوتية")
    .addStringOption((option) =>
      option.setName("query").setDescription("اسم الأغنية أو رابط YouTube").setRequired(true),
    ),
  new SlashCommandBuilder().setName("skip").setDescription("يتخطى الأغنية الحالية"),
  new SlashCommandBuilder().setName("stop").setDescription("يوقف الموسيقى ويخرج من القناة"),
  new SlashCommandBuilder().setName("nowplaying").setDescription("يعرض الأغنية الحالية"),
  new SlashCommandBuilder().setName("dice").setDescription("يرمي حجر النرد"),
  new SlashCommandBuilder().setName("coin").setDescription("يقلب العملة"),
  new SlashCommandBuilder()
    .setName("rps")
    .setDescription("يلعب حجر ورق مقص")
    .addStringOption((option) =>
      option
        .setName("choice")
        .setDescription("اختيارك")
        .setRequired(true)
        .addChoices(
          { name: "حجر", value: "rock" },
          { name: "ورق", value: "paper" },
          { name: "مقص", value: "scissors" },
        ),
    ),
  new SlashCommandBuilder().setName("quiz").setDescription("سؤال معلومات عامة سريع"),
  new SlashCommandBuilder().setName("slots").setDescription("لعبة ماكينة الحظ"),
  new SlashCommandBuilder()
    .setName("guess")
    .setDescription("خمن رقمًا من 1 إلى 10")
    .addIntegerOption((option) =>
      option.setName("number").setDescription("رقمك").setMinValue(1).setMaxValue(10).setRequired(true),
    ),
  new SlashCommandBuilder()
    .setName("8ball")
    .setDescription("اسأل الكرة السحرية")
    .addStringOption((option) => option.setName("question").setDescription("سؤالك").setRequired(true)),
  new SlashCommandBuilder()
    .setName("trivia")
    .setDescription("اختبار معلومات عامة باختيارات"),
  new SlashCommandBuilder().setName("score").setDescription("يعرض نقاطك في الألعاب"),
  new SlashCommandBuilder()
    .setName("avatar")
    .setDescription("يعرض صورة عضو")
    .addUserOption((option) => option.setName("member").setDescription("العضو")),
  new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("يعرض معلومات عضو")
    .addUserOption((option) => option.setName("member").setDescription("العضو")),
  new SlashCommandBuilder().setName("banner").setDescription("يعرض صورة بانر السيرفر"),
  new SlashCommandBuilder()
    .setName("xo")
    .setDescription("يلعب XO ضد البوت"),
  new SlashCommandBuilder()
    .setName("ladder")
    .setDescription("يلعب السلم والثعبان"),
  new SlashCommandBuilder()
    .setName("snake")
    .setDescription("يلعب لعبة الثعبان بالأزرار"),
  new SlashCommandBuilder().setName("blackjack").setDescription("يلعب بلاك جاك ضد البوت"),
  new SlashCommandBuilder()
    .setName("higherlower")
    .setDescription("خمن هل الرقم التالي أعلى أم أقل")
    .addStringOption((option) =>
      option
        .setName("choice")
        .setDescription("توقعك")
        .setRequired(true)
        .addChoices({ name: "أعلى", value: "higher" }, { name: "أقل", value: "lower" }),
    ),
  new SlashCommandBuilder().setName("math").setDescription("حل تحدي حساب سريع"),
  new SlashCommandBuilder().setName("scramble").setDescription("خمن الكلمة الملخبطة"),
  new SlashCommandBuilder().setName("race").setDescription("سباق نرد عشوائي"),
].map((command) => command.toJSON());

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

async function registerCommands(applicationId: string): Promise<void> {
  const rest = new REST({ version: "10" }).setToken(discordToken);
  await rest.put(Routes.applicationCommands(applicationId), { body: commands });
  const guildIds = client.guilds.cache.map((guild) => guild.id);
  for (const guildId of guildIds) {
    await rest.put(Routes.applicationGuildCommands(applicationId, guildId), { body: commands });
  }
  console.info(`Slash commands registered globally and in ${guildIds.length} server(s).`);
}

function hasPermission(interaction: ChatInputCommandInteraction, permission: bigint): boolean {
  return Boolean(interaction.memberPermissions?.has(permission));
}

function addScore(userId: string, points: number): number {
  const total = (scores.get(userId) ?? 0) + points;
  scores.set(userId, total);
  return total;
}

function makeEmbed(title: string, description?: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x8b5cf6)
    .setTitle(title)
    .setDescription(description ?? "")
    .setTimestamp();
}

function xoRows(messageId: string, board: string[]): ActionRowBuilder<ButtonBuilder>[] {
  return [0, 1, 2].map((row) =>
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      [0, 1, 2].map((column) => {
        const index = row * 3 + column;
        return new ButtonBuilder()
          .setCustomId(`xo:${messageId}:${index}`)
          .setLabel(board[index] || `${index + 1}`)
          .setStyle(board[index] ? ButtonStyle.Secondary : ButtonStyle.Primary)
          .setDisabled(Boolean(board[index]));
      }),
    ),
  );
}

function winner(board: string[]): string | null {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
  ];
  for (const [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  return board.every(Boolean) ? "draw" : null;
}

function ladderRow(messageId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`ladder:${messageId}:roll`).setLabel("ارمِ النرد 🎲").setStyle(ButtonStyle.Success),
  );
}

function snakeRows(messageId: string): ActionRowBuilder<ButtonBuilder>[] {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`snake:${messageId}:up`).setLabel("⬆️").setStyle(ButtonStyle.Primary),
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`snake:${messageId}:left`).setLabel("⬅️").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`snake:${messageId}:down`).setLabel("⬇️").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`snake:${messageId}:right`).setLabel("➡️").setStyle(ButtonStyle.Primary),
    ),
  ];
}

function snakeBoard(game: SnakeGame): string {
  const rows: string[] = [];
  for (let y = 0; y < 7; y += 1) {
    let row = "";
    for (let x = 0; x < 7; x += 1) row += x === game.x && y === game.y ? "🟢" : x === game.foodX && y === game.foodY ? "🍎" : "▫️";
    rows.push(row);
  }
  return rows.join("\n");
}

async function handleButton(interaction: ButtonInteraction): Promise<void> {
  const [type, messageId, action] = interaction.customId.split(":");
  if (type === "xo") {
    const game = xoGames.get(messageId);
    if (!game) {
      await interaction.reply({ content: "اللعبة دي خلصت.", ephemeral: true });
      return;
    }
    const index = Number(action);
    if (interaction.user.id !== game.players[game.turn]) {
      await interaction.reply({ content: "استنى دورك.", ephemeral: true });
      return;
    }
    game.board[index] = game.turn === 0 ? "X" : "O";
    const result = winner(game.board);
    if (result) {
      xoGames.delete(messageId);
      await interaction.update({
        content: result === "draw" ? "تعادل! 🤝" : `الفائز: **${game.players[game.turn] === interaction.user.id ? "إنت" : "البوت"}**`,
        components: xoRows(messageId, game.board),
      });
      return;
    }
    game.turn = game.turn === 0 ? 1 : 0;
    if (game.turn === 1) {
      const free = game.board.map((value, i) => (value ? -1 : i)).filter((i) => i >= 0);
      const botMove = free[Math.floor(Math.random() * free.length)];
      game.board[botMove] = "O";
      const botResult = winner(game.board);
      if (botResult) {
        xoGames.delete(messageId);
        await interaction.update({ content: botResult === "draw" ? "تعادل! 🤝" : "البوت كسب المرة دي.", components: xoRows(messageId, game.board) });
        return;
      }
      game.turn = 0;
    }
    await interaction.update({ content: "دورك — اختار خانة.", components: xoRows(messageId, game.board) });
    return;
  }
  if (type === "ladder") {
    const game = ladderGames.get(messageId);
    if (!game || interaction.user.id !== game.player) {
      await interaction.reply({ content: game ? "دي لعبة لاعب تاني." : "اللعبة دي خلصت.", ephemeral: true });
      return;
    }
    const roll = Math.floor(Math.random() * 6) + 1;
    game.position = Math.min(30, game.position + roll);
    const jumps: Record<number, number> = { 3: 12, 8: 20, 11: 5, 17: 29, 24: 14, 27: 9 };
    game.position = jumps[game.position] ?? game.position;
    const done = game.position >= 30;
    if (done) ladderGames.delete(messageId);
    await interaction.update({
      content: `${done ? "كسبت اللعبة! 🎉" : `طلعت **${roll}** ووصلت للخانة **${game.position}/30**.`}`,
      components: done ? [] : [ladderRow(messageId)],
    });
    return;
  }
  if (type === "snake") {
    const game = snakeGames.get(messageId);
    if (!game) {
      await interaction.reply({ content: "اللعبة دي خلصت.", ephemeral: true });
      return;
    }
    if (action === "up") game.y = Math.max(0, game.y - 1);
    if (action === "down") game.y = Math.min(6, game.y + 1);
    if (action === "left") game.x = Math.max(0, game.x - 1);
    if (action === "right") game.x = Math.min(6, game.x + 1);
    if (game.x === game.foodX && game.y === game.foodY) {
      game.score += 1;
      game.foodX = Math.floor(Math.random() * 7);
      game.foodY = Math.floor(Math.random() * 7);
    }
    await interaction.update({ content: `**Snake** — النقاط: ${game.score}\n${snakeBoard(game)}`, components: snakeRows(messageId) });
  }
}

async function playMusic(interaction: ChatInputCommandInteraction): Promise<void> {
  const guild = interaction.guild;
  const voiceChannel = interaction.guild?.members.cache.get(interaction.user.id)?.voice.channel;
  const query = interaction.options.getString("query", true);

  if (!guild || !voiceChannel) {
    await interaction.reply("ادخل قناة صوتية الأول عشان أشغل الموسيقى.");
    return;
  }

  const botMember = guild.members.me;
  const voicePermissions = botMember && voiceChannel.permissionsFor(botMember);
  if (!voicePermissions?.has(PermissionFlagsBits.Connect) || !voicePermissions.has(PermissionFlagsBits.Speak)) {
    await interaction.reply("محتاج أذونات **Connect** و **Speak** في القناة الصوتية.");
    return;
  }

  await interaction.deferReply();
  const results = await play.search(query, { limit: 1 });
  const track = results[0];
  if (!track?.url || track.type !== "video") {
    await interaction.editReply("مش لاقي الأغنية دي. جرب اسم أو رابط YouTube تاني.");
    return;
  }

  const existing = musicSessions.get(guild.id);
  const connection =
    existing?.connection ??
    joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
    });
  const player = existing?.player ?? createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Stop } });
  connection.subscribe(player);
  await entersState(connection, VoiceConnectionStatus.Ready, 15_000);
  const stream = await play.stream(track.url, { quality: 2 });
  player.play(createAudioResource(stream.stream, { inputType: stream.type }));
  musicSessions.set(guild.id, { connection, player, title: track.title ?? "أغنية بدون اسم" });
  await interaction.editReply(`شغلت: **${track.title ?? "الأغنية"}**`);
}

async function handleCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  switch (interaction.commandName) {
    case "ping":
      await interaction.reply({
        embeds: [
          makeEmbed("البوت شغال", "كل الأنظمة تعمل بشكل طبيعي.")
            .setColor(0x22c55e)
            .addFields(
              { name: "الحماية", value: "مفعّلة", inline: true },
              { name: "الموسيقى", value: "جاهزة", inline: true },
              { name: "الألعاب", value: "جاهزة", inline: true },
            )
            .setFooter({ text: "Black Bot • سريع وآمن" }),
        ],
      });
      return;
    case "help":
      await interaction.reply({
        embeds: [
          makeEmbed("Black Bot Command Center", "كل أدوات السيرفر في مكان واحد.")
            .setColor(0x7c3aed)
            .setThumbnail(interaction.client.user.displayAvatarURL({ size: 512 }))
            .addFields(
              { name: "الحماية والإدارة", value: "`/clear`  `/kick`  `/ban`", inline: false },
              { name: "الموسيقى", value: "`/play`  `/skip`  `/stop`  `/nowplaying`", inline: false },
              { name: "ألعاب تنافسية", value: "`/xo`  `/ladder`  `/snake`  `/blackjack`  `/race`", inline: false },
              { name: "ألعاب سريعة", value: "`/dice`  `/coin`  `/rps`  `/slots`  `/guess`  `/8ball`", inline: false },
              { name: "تحديات", value: "`/quiz`  `/trivia`  `/math`  `/scramble`  `/higherlower`", inline: false },
              { name: "معلومات", value: "`/server`  `/avatar`  `/userinfo`  `/banner`  `/score`", inline: false },
            )
            .setFooter({ text: "Black Bot • استخدم /help في أي وقت" }),
        ],
      });
      return;
    case "server": {
      const guild = interaction.guild;
      if (!guild) {
        await interaction.reply("الأمر ده متاح داخل السيرفر فقط.");
        return;
      }
      const icon = guild.iconURL({ size: 512 });
      const serverEmbed = makeEmbed(guild.name, "معلومات السيرفر الحالية.")
        .setColor(0x5865f2)
        .addFields(
          { name: "الأعضاء", value: `${guild.memberCount}`, inline: true },
          { name: "القنوات", value: `${guild.channels.cache.size}`, inline: true },
          { name: "المالك", value: `<@${guild.ownerId}>`, inline: true },
          { name: "تاريخ الإنشاء", value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: false },
        )
        .setFooter({ text: "Black Bot • Server Overview" });
      if (icon) serverEmbed.setThumbnail(icon);
      await interaction.reply({ embeds: [serverEmbed] });
      return;
    }
    case "clear": {
      if (!hasPermission(interaction, PermissionFlagsBits.ManageMessages)) {
        await interaction.reply({ content: "محتاج صلاحية Manage Messages.", ephemeral: true });
        return;
      }
      const amount = interaction.options.getInteger("amount", true);
      if (!interaction.channel?.isTextBased() || !("bulkDelete" in interaction.channel)) {
        await interaction.reply("الأمر ده مش متاح في القناة دي.");
        return;
      }
      const deleted = await interaction.channel.bulkDelete(amount, true);
      await interaction.reply({ content: `تم مسح ${deleted.size} رسالة.`, ephemeral: true });
      return;
    }
    case "kick":
    case "ban": {
      const permission =
        interaction.commandName === "kick" ? PermissionFlagsBits.KickMembers : PermissionFlagsBits.BanMembers;
      if (!hasPermission(interaction, permission)) {
        await interaction.reply({ content: "مش معاك صلاحية تنفيذ الأمر ده.", ephemeral: true });
        return;
      }
      const member = interaction.options.getMember("member");
      if (!member || !("kick" in member) || !("ban" in member)) {
        await interaction.reply("مش قادر أجيب العضو ده.");
        return;
      }
      const reason = interaction.options.getString("reason") ?? "بدون سبب محدد";
      if (interaction.commandName === "kick") {
        await member.kick(reason);
        await interaction.reply(`تم طرد **${member.user.username}**. السبب: ${reason}`);
      } else {
        await member.ban({ reason });
        await interaction.reply(`تم حظر **${member.user.username}**. السبب: ${reason}`);
      }
      return;
    }
    case "play":
      await playMusic(interaction);
      return;
    case "skip": {
      const session = interaction.guild && musicSessions.get(interaction.guild.id);
      if (!session) {
        await interaction.reply("مفيش موسيقى شغالة حاليًا.");
        return;
      }
      session.player.stop();
      await interaction.reply("تم تخطي الأغنية.");
      return;
    }
    case "stop": {
      const guildId = interaction.guild?.id;
      const session = guildId && musicSessions.get(guildId);
      if (!session) {
        await interaction.reply("مفيش جلسة موسيقى شغالة.");
        return;
      }
      session.player.stop();
      session.connection.destroy();
      musicSessions.delete(guildId);
      await interaction.reply("وقفت الموسيقى وخرجت من القناة.");
      return;
    }
    case "nowplaying": {
      const session = interaction.guild && musicSessions.get(interaction.guild.id);
      await interaction.reply({
        embeds: [
          makeEmbed(session ? "Now Playing" : "الموسيقى متوقفة", session ? `**${session.title}**` : "مفيش أغنية شغالة حاليًا.")
            .setColor(session ? 0xec4899 : 0x64748b)
            .setFooter({ text: "Black Bot Music" }),
        ],
      });
      return;
    }
    case "dice":
      await interaction.reply(`🎲 طلعتلك: **${Math.floor(Math.random() * 6) + 1}**`);
      return;
    case "coin":
      await interaction.reply(`🪙 النتيجة: **${Math.random() < 0.5 ? "صورة" : "كتابة"}**`);
      return;
    case "rps": {
      const choices = ["rock", "paper", "scissors"] as const;
      const labels = { rock: "حجر", paper: "ورق", scissors: "مقص" };
      const userChoice = interaction.options.getString("choice", true) as (typeof choices)[number];
      const botChoice = choices[Math.floor(Math.random() * choices.length)];
      const win = (userChoice === "rock" && botChoice === "scissors") ||
        (userChoice === "paper" && botChoice === "rock") ||
        (userChoice === "scissors" && botChoice === "paper");
      await interaction.reply(
        `إنت اخترت **${labels[userChoice]}** وأنا اخترت **${labels[botChoice]}** — ${
          userChoice === botChoice ? "تعادل!" : win ? "كسبت!" : "أنا كسبت!"
        }`,
      );
      return;
    }
    case "quiz": {
      const questions = [
        ["ما هو أكبر كوكب في المجموعة الشمسية؟", "المشتري"],
        ["كم عدد ألوان قوس قزح؟", "7"],
        ["ما عاصمة مصر؟", "القاهرة"],
        ["ما هو أسرع حيوان بري؟", "الفهد"],
      ];
      const [question, answer] = questions[Math.floor(Math.random() * questions.length)];
      await interaction.reply(`**سؤال:** ${question}\nأول إجابة صحيحة: **${answer}**`);
      return;
    }
    case "slots": {
      const symbols = ["🍒", "🍋", "⭐", "7️⃣", "🔔"];
      const spin = Array.from({ length: 3 }, () => symbols[Math.floor(Math.random() * symbols.length)]);
      const won = spin.every((symbol) => symbol === spin[0]);
      const points = won ? 10 : spin[0] === spin[1] || spin[1] === spin[2] ? 2 : 0;
      const total = points ? addScore(interaction.user.id, points) : scores.get(interaction.user.id) ?? 0;
      await interaction.reply(
        `${spin.join(" | ")}\n${won ? `مبروك! كسبت ${points} نقاط.` : points ? `كسبت ${points} نقاط.` : "حظ أوفر المرة الجاية!"}\nنقاطك: **${total}**`,
      );
      return;
    }
    case "guess": {
      const guess = interaction.options.getInteger("number", true);
      const answer = Math.floor(Math.random() * 10) + 1;
      const points = guess === answer ? 5 : 0;
      const total = points ? addScore(interaction.user.id, points) : scores.get(interaction.user.id) ?? 0;
      await interaction.reply(
        guess === answer
          ? `صح! الرقم كان **${answer}** وكسبت ${points} نقاط. مجموعك: **${total}**`
          : `غلط، الرقم كان **${answer}**. مجموعك: **${total}**`,
      );
      return;
    }
    case "8ball": {
      const answers = [
        "أكيد، الموضوع واضح.",
        "أيوه، غالبًا.",
        "ممكن، حاول تاني.",
        "مش باين دلوقتي.",
        "لا، مش متوقع.",
        "الإجابة مش عندي حاليًا.",
      ];
      await interaction.reply(`سؤالك: **${interaction.options.getString("question") ?? "..." }**\n🎱 ${answers[Math.floor(Math.random() * answers.length)]}`);
      return;
    }
    case "trivia": {
      const questions = [
        { question: "أي كوكب يُعرف بالكوكب الأحمر؟", answer: "المريخ", options: "الأرض - المريخ - زحل" },
        { question: "كم يومًا في السنة الكبيسة؟", answer: "366", options: "365 - 366 - 364" },
        { question: "ما أكبر محيط؟", answer: "الهادئ", options: "الأطلسي - الهندي - الهادئ" },
        { question: "كم ضلعًا للمثلث؟", answer: "3", options: "3 - 4 - 5" },
      ];
      const item = questions[Math.floor(Math.random() * questions.length)];
      await interaction.reply(`**${item.question}**\nالاختيارات: ${item.options}\nالإجابة: ||${item.answer}||`);
      return;
    }
    case "score":
      await interaction.reply({
        embeds: [
          makeEmbed("لوحة نقاطك", `مجموع نقاط الألعاب: **${scores.get(interaction.user.id) ?? 0}**`)
            .setColor(0xf59e0b)
            .setThumbnail(interaction.user.displayAvatarURL({ size: 512 }))
            .setFooter({ text: "العب أكتر وارفع ترتيبك" }),
        ],
      });
      return;
    case "avatar": {
      const user = interaction.options.getUser("member") ?? interaction.user;
      await interaction.reply({
        embeds: [
          makeEmbed(`صورة ${user.username}`, "الصورة الشخصية بجودة عالية.")
            .setColor(0x06b6d4)
            .setImage(user.displayAvatarURL({ size: 1024 }))
            .setFooter({ text: "Black Bot Profiles" }),
        ],
      });
      return;
    }
    case "userinfo": {
      const user = interaction.options.getUser("member") ?? interaction.user;
      await interaction.reply({
        embeds: [
          makeEmbed(`معلومات ${user.username}`, "بيانات العضو.")
            .setColor(0x14b8a6)
            .setThumbnail(user.displayAvatarURL({ size: 512 }))
            .addFields(
              { name: "الـ ID", value: user.id, inline: false },
              { name: "تاريخ إنشاء الحساب", value: `<t:${Math.floor(user.createdTimestamp / 1000)}:D>`, inline: true },
              { name: "المنشن", value: `<@${user.id}>`, inline: true },
            ),
        ],
      });
      return;
    }
    case "banner": {
      const guild = interaction.guild;
      const banner = guild?.bannerURL({ size: 1024 });
      await interaction.reply({
        embeds: [
          makeEmbed(guild?.name ?? "السيرفر", banner ? "بانر السيرفر." : "السيرفر مش عامل بانر حاليًا.")
            .setColor(0x3b82f6)
            .setImage(banner ?? "https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=1200&q=80"),
        ],
      });
      return;
    }
    case "xo": {
      await interaction.deferReply();
      const reply = await interaction.fetchReply();
      xoGames.set(reply.id, { board: Array(9).fill(""), players: [interaction.user.id, "bot"], turn: 0 });
      await interaction.editReply({ content: "لعبة XO ضد البوت — إنت X. اختار خانة:", components: xoRows(reply.id, Array(9).fill("")) });
      return;
    }
    case "ladder": {
      await interaction.deferReply();
      const reply = await interaction.fetchReply();
      ladderGames.set(reply.id, { player: interaction.user.id, position: 0 });
      await interaction.editReply({ content: "السلم والثعبان — أول واحد يوصل للخانة 30 يكسب. ارمِ النرد!", components: [ladderRow(reply.id)] });
      return;
    }
    case "snake": {
      const game: SnakeGame = { x: 3, y: 3, foodX: 1, foodY: 1, score: 0 };
      await interaction.deferReply();
      const reply = await interaction.fetchReply();
      snakeGames.set(reply.id, game);
      await interaction.editReply({ content: `**Snake** — النقاط: 0\n${snakeBoard(game)}`, components: snakeRows(reply.id) });
      return;
    }
    case "blackjack": {
      const card = () => Math.floor(Math.random() * 10) + 1;
      const player = card() + card();
      const bot = card() + card();
      const result = player > 21 ? "خسرت، عدّيت 21." : bot > 21 || player > bot ? "كسبت!" : player === bot ? "تعادل!" : "البوت كسب.";
      await interaction.reply(`🃏 إنت: **${player}** — البوت: **${bot}**\n${result}`);
      return;
    }
    case "higherlower": {
      const first = Math.floor(Math.random() * 100) + 1;
      const second = Math.floor(Math.random() * 100) + 1;
      const choice = interaction.options.getString("choice", true);
      const correct = choice === "higher" ? second > first : second < first;
      const total = correct ? addScore(interaction.user.id, 3) : scores.get(interaction.user.id) ?? 0;
      await interaction.reply(`الرقم الأول **${first}** والثاني **${second}** — ${correct ? "توقعت صح! +3 نقاط" : "توقعت غلط!"}\nمجموعك: **${total}**`);
      return;
    }
    case "math": {
      const a = Math.floor(Math.random() * 20) + 1;
      const b = Math.floor(Math.random() * 20) + 1;
      const operation = Math.random() < 0.5 ? "+" : "-";
      const answer = operation === "+" ? a + b : a - b;
      const total = addScore(interaction.user.id, 1);
      await interaction.reply(`🧠 حل بسرعة: **${a} ${operation} ${b} = ?**\nالإجابة: ||${answer}||\nنقطة للمشاركة! مجموعك: **${total}**`);
      return;
    }
    case "scramble": {
      const words = ["discord", "computer", "football", "javascript", "elephant", "developer"];
      const word = words[Math.floor(Math.random() * words.length)];
      const scrambled = word.split("").sort(() => Math.random() - 0.5).join("");
      await interaction.reply(`🔤 رتب الحروف دي: **${scrambled}**\nالإجابة: ||${word}||`);
      return;
    }
    case "race": {
      const racers = ["🐎", "🐢", "🐇", "🐕", "🦊"];
      const winnerIndex = Math.floor(Math.random() * racers.length);
      await interaction.reply(`🏁 السباق بدأ!\n${racers.map((racer, index) => `${racer} المتسابق ${index + 1} ${index === winnerIndex ? "🏆" : ""}`).join("\n")}\nالفائز: **المتسابق ${winnerIndex + 1}**`);
      return;
    }
    default:
      await interaction.reply("الأمر ده مش معروف.");
  }
}

client.once(Events.ClientReady, async (readyClient) => {
  console.info(`Logged in as ${readyClient.user.tag} (${readyClient.user.id})`);
  const presenceMessages = [
    { name: "🛡️ حماية السيرفرات", type: ActivityType.Watching },
    { name: "🎵 موسيقى بجودة عالية", type: ActivityType.Listening },
    { name: "🎮 ألعاب وتحديات", type: ActivityType.Playing },
    { name: "/help لكل الأوامر", type: ActivityType.Watching },
  ];
  let presenceIndex = 0;
  const updatePresence = () => {
    const activity = presenceMessages[presenceIndex % presenceMessages.length];
    readyClient.user.setPresence({
      activities: [{ name: activity.name, type: activity.type }],
      status: "online",
    });
    presenceIndex += 1;
  };
  updatePresence();
  setInterval(updatePresence, 30_000);
  await registerCommands(readyClient.user.id);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isButton()) {
    try {
      await handleButton(interaction);
    } catch (error) {
      console.error("Failed to handle game button:", error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: "حصل خطأ في اللعبة.", ephemeral: true });
      }
    }
    return;
  }
  if (!interaction.isChatInputCommand()) return;
  try {
    await handleCommand(interaction);
  } catch (error) {
    console.error("Failed to handle Discord interaction:", error);
    const message = "حصل خطأ أثناء تنفيذ الأمر. اتأكد إن البوت عنده الصلاحيات المطلوبة.";
    if (interaction.replied || interaction.deferred) await interaction.followUp(message);
    else await interaction.reply(message);
  }
});

client.on("error", (error) => console.error("Discord client error:", error));
client.on(AudioPlayerStatus.Idle, () => undefined);

process.once("SIGINT", () => {
  client.destroy();
  process.exit(0);
});
process.once("SIGTERM", () => {
  client.destroy();
  process.exit(0);
});

await client.login(discordToken);