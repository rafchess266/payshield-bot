import { REST, Routes, SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { config } from './config.js';

const commands = [
  new SlashCommandBuilder()
    .setName('panel-ticketow')
    .setDescription('Wysyła panel do tworzenia ticketów (Kupno / Pomoc / Odbiór konkursu)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
].map((command) => command.toJSON());

const rest = new REST({ version: '10' }).setToken(config.token);

try {
  console.log('🔄 Rejestruję komendy slash...');

  await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), {
    body: commands,
  });

  console.log('✅ Komendy zarejestrowane. Możesz teraz odpalić bota (npm start).');
} catch (error) {
  console.error('❌ Błąd przy rejestracji komend:', error);
}
