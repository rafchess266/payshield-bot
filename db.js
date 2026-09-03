import Database from 'better-sqlite3';

// Plik bazy danych powstanie automatycznie przy pierwszym uruchomieniu
export const db = new Database('payshield.db');
db.pragma('journal_mode = WAL');

// Tabela ticketów — na razie fundament, w kolejnych krokach dojdą
// kolumny na produkt/ilość/cenę/status płatności itd.
db.exec(`
  CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id TEXT UNIQUE NOT NULL,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('kupno', 'pomoc', 'konkurs')),
    seller_id TEXT,
    status TEXT NOT NULL DEFAULT 'otwarty' CHECK (status IN ('otwarty', 'w_realizacji', 'zamkniety')),
    created_at INTEGER NOT NULL
  )
`);

// Tabela sprzedawców — ranga, kaucja, blokada za zaległą prowizję.
// Rozbudujemy w kolejnym kroku (historia transakcji, suma sprzedaży).
db.exec(`
  CREATE TABLE IF NOT EXISTS sellers (
    user_id TEXT PRIMARY KEY,
    rank TEXT NOT NULL DEFAULT 'max_50' CHECK (rank IN ('max_50', 'max_150', 'max_500')),
    deposit_amount REAL NOT NULL DEFAULT 0,
    is_blocked INTEGER NOT NULL DEFAULT 0
  )
`);

export function createTicket({ channelId, userId, type }) {
  const stmt = db.prepare(
    `INSERT INTO tickets (channel_id, user_id, type, created_at) VALUES (?, ?, ?, ?)`
  );
  return stmt.run(channelId, userId, type, Date.now());
}

export function getOpenTicketByUser(userId) {
  return db
    .prepare(`SELECT * FROM tickets WHERE user_id = ? AND status != 'zamkniety'`)
    .get(userId);
}

export function closeTicket(channelId) {
  return db
    .prepare(`UPDATE tickets SET status = 'zamkniety' WHERE channel_id = ?`)
    .run(channelId);
}
