import 'dotenv/config';

export const config = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID,
  ticketCategoryId: process.env.TICKET_CATEGORY_ID,
  staffRoleId: process.env.STAFF_ROLE_ID,
};

// Prosta walidacja — od razu widać, czego brakuje w .env
const required = ['token', 'clientId', 'guildId', 'ticketCategoryId', 'staffRoleId'];
const missing = required.filter((key) => !config[key]);

if (missing.length > 0) {
  console.warn(
    `⚠️  Brakuje zmiennych w .env: ${missing.join(', ')}. Uzupełnij plik .env przed startem bota.`
  );
}
