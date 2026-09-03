import http from 'http';
import {
  Client,
  GatewayIntentBits,
  Events,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
} from 'discord.js';
import { config } from './config.js';
import { createTicket, getOpenTicketByUser, closeTicket } from './db.js';

// Prosty serwer HTTP wymagany przez Render (Web Service)
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is running!');
});
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🌐 Serwer HTTP nasłuchuje na porcie ${PORT}`);
});

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

// Opisy trzech typów ticketów — jedno miejsce do edycji nazw/opisów
const TICKET_TYPES = {
  kupno: { label: '🟢 Kupno', title: 'Ticket zakupowy', color: 0x3b7dfa },
  pomoc: { label: '🟡 Pomoc', title: 'Ticket pomocy', color: 0xf5a623 },
  konkurs: { label: '🎉 Odbiór konkursu', title: 'Odbiór wygranej z konkursu', color: 0x9b59b6 },
};

client.once(Events.ClientReady, (c) => {
  console.log(`✅ Zalogowano jako ${c.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand() && interaction.commandName === 'panel-ticketow') {
      await sendTicketPanel(interaction);
      return;
    }

    if (interaction.isButton()) {
      if (interaction.customId.startsWith('ticket_open_')) {
        const type = interaction.customId.replace('ticket_open_', '');
        await createTicketChannel(interaction, type);
        return;
      }

      if (interaction.customId === 'ticket_close') {
        await askCloseConfirmation(interaction);
        return;
      }

      if (interaction.customId === 'ticket_close_confirm') {
        await performClose(interaction);
        return;
      }

      if (interaction.customId === 'ticket_close_cancel') {
        await interaction.update({ content: 'Anulowano zamknięcie ticketu.', components: [] });
        return;
      }
    }
  } catch (error) {
    console.error('Błąd obsługi interakcji:', error);
    if (interaction.isRepliable() && !interaction.replied) {
      await interaction.reply({
        content: 'Coś poszło nie tak. Spróbuj ponownie lub zgłoś to administracji.',
        ephemeral: true,
      });
    }
  }
});

// Wysyła panel z 3 przyciskami na kanał, gdzie użyto komendy /panel-ticketow
async function sendTicketPanel(interaction) {
  const embed = new EmbedBuilder()
    .setTitle('🛍️ Panel sprzedaży PayShield')
    .setDescription('Wybierz, w czym możemy pomóc:')
    .addFields(
      { name: TICKET_TYPES.kupno.label, value: 'Zakup produktu z cennika', inline: false },
      { name: TICKET_TYPES.pomoc.label, value: 'Pytanie lub problem', inline: false },
      { name: TICKET_TYPES.konkurs.label, value: 'Odbierz wygraną z konkursu', inline: false }
    )
    .setColor(0x3b7dfa);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_open_kupno')
      .setLabel('Kupno')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('ticket_open_pomoc')
      .setLabel('Pomoc')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('ticket_open_konkurs')
      .setLabel('Odbiór konkursu')
      .setStyle(ButtonStyle.Primary)
  );

  await interaction.channel.send({ embeds: [embed], components: [row] });
  await interaction.reply({ content: 'Panel wysłany ✅', ephemeral: true });
}

// Tworzy prywatny kanał-ticket dla użytkownika
async function createTicketChannel(interaction, type) {
  await interaction.deferReply({ ephemeral: true });

  const existing = getOpenTicketByUser(interaction.user.id);
  if (existing) {
    await interaction.editReply({
      content: `Masz już otwarty ticket: <#${existing.channel_id}>. Zamknij go, zanim otworzysz kolejny.`,
    });
    return;
  }

  const guild = interaction.guild;
  const typeInfo = TICKET_TYPES[type];

  const channel = await guild.channels.create({
    name: `${type}-${interaction.user.username}`,
    type: ChannelType.GuildText,
    parent: config.ticketCategoryId,
    permissionOverwrites: [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      {
        id: interaction.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      },
      {
        id: config.staffRoleId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      },
      {
        id: client.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ManageChannels,
        ],
      },
    ],
  });

  createTicket({ channelId: channel.id, userId: interaction.user.id, type });

  const welcomeEmbed = new EmbedBuilder()
    .setTitle(typeInfo.title)
    .setDescription(
      `Witaj <@${interaction.user.id}>! Ticket typu **${typeInfo.label}** został utworzony.\n\nOpisz swoją sprawę, a zajmie się nią odpowiednia osoba.`
    )
    .setColor(typeInfo.color);

  const closeRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_close').setLabel('Zamknij ticket').setStyle(ButtonStyle.Danger)
  );

  await channel.send({
    content: `<@${interaction.user.id}> <@&${config.staffRoleId}>`,
    embeds: [welcomeEmbed],
    components: [closeRow],
  });

  await interaction.editReply({ content: `Ticket utworzony: ${channel}` });
}

// Pyta o potwierdzenie przed zamknięciem
async function askCloseConfirmation(interaction) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_close_confirm')
      .setLabel('Tak, zamknij')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('ticket_close_cancel')
      .setLabel('Anuluj')
      .setStyle(ButtonStyle.Secondary)
  );

  await interaction.reply({
    content: 'Na pewno chcesz zamknąć ten ticket?',
    components: [row],
    ephemeral: true,
  });
}

// Zamyka i usuwa kanał po potwierdzeniu
async function performClose(interaction) {
  await interaction.update({ content: 'Zamykanie ticketu za 5 sekund...', components: [] });

  closeTicket(interaction.channel.id);

  setTimeout(async () => {
    try {
      await interaction.channel.delete();
    } catch (error) {
      console.error('Nie udało się usunąć kanału:', error);
    }
  }, 5000);
}

client.login(config.token);
