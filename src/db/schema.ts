import db from './connection';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS symbols (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    ticker      TEXT    NOT NULL UNIQUE,
    label       TEXT    NOT NULL,
    active      INTEGER NOT NULL DEFAULT 1,
    created_at  INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
);

CREATE TABLE IF NOT EXISTS events (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol_id       INTEGER NOT NULL REFERENCES symbols(id),
    event_type      TEXT    NOT NULL,
    direction       TEXT    NOT NULL,
    price           REAL    NOT NULL,
    pivot_level     REAL    NOT NULL,
    trend_before    TEXT    NOT NULL,
    trend_after     TEXT    NOT NULL,
    candle_epoch    INTEGER NOT NULL,
    created_at      INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
    UNIQUE(symbol_id, event_type, direction, candle_epoch)
);

CREATE INDEX IF NOT EXISTS idx_events_symbol_time ON events(symbol_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_created       ON events(created_at);

CREATE TABLE IF NOT EXISTS alerts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id    INTEGER NOT NULL REFERENCES events(id),
    status      TEXT    NOT NULL DEFAULT 'pending',
    email_id    INTEGER REFERENCES emails(id),
    created_at  INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
    sent_at     INTEGER
);

CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status, created_at);
CREATE INDEX IF NOT EXISTS idx_alerts_event  ON alerts(event_id);

CREATE TABLE IF NOT EXISTS emails (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    alert_count   INTEGER NOT NULL,
    ai_summary    TEXT    NOT NULL,
    status        TEXT    NOT NULL DEFAULT 'sent',
    resend_id     TEXT,
    sent_at       INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_emails_sent ON emails(sent_at DESC);

CREATE TABLE IF NOT EXISTS market_state (
    symbol_id        INTEGER PRIMARY KEY REFERENCES symbols(id),
    current_trend    TEXT    NOT NULL DEFAULT 'neutral',
    last_bos_price   REAL,
    last_choch_price REAL,
    last_event_at    INTEGER,
    updated_at       INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
);

CREATE TABLE IF NOT EXISTS notification_config (
    id                      INTEGER PRIMARY KEY CHECK (id = 1),
    batch_window_minutes    INTEGER NOT NULL DEFAULT 5,
    min_alerts_to_send      INTEGER NOT NULL DEFAULT 1,
    max_batch_size          INTEGER NOT NULL DEFAULT 10,
    cooldown_minutes        INTEGER NOT NULL DEFAULT 2,
    quiet_hours_start       TEXT,
    quiet_hours_end         TEXT,
    enabled                 INTEGER NOT NULL DEFAULT 1,
    updated_at              INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
);

INSERT OR IGNORE INTO notification_config (id) VALUES (1);
`;

const DEFAULT_SYMBOLS: { ticker: string; label: string }[] = [
  // Standard Volatility Indices
  { ticker: 'R_75',    label: 'Volatility 75 Index' },
  { ticker: 'R_50',    label: 'Volatility 50 Index' },
  { ticker: 'R_25',    label: 'Volatility 25 Index' },
  { ticker: 'R_10',    label: 'Volatility 10 Index' },
  // 1-Second Volatility Indices
  { ticker: '1HZ100V', label: 'Volatility 100 (1s) Index' },
  { ticker: '1HZ75V',  label: 'Volatility 75 (1s) Index' },
  { ticker: '1HZ50V',  label: 'Volatility 50 (1s) Index' },
  { ticker: '1HZ30V',  label: 'Volatility 30 (1s) Index' },
  { ticker: '1HZ25V',  label: 'Volatility 25 (1s) Index' },
  { ticker: '1HZ15V',  label: 'Volatility 15 (1s) Index' },
  { ticker: '1HZ10V',  label: 'Volatility 10 (1s) Index' },
];

export function initializeDatabase(): void {
  db.exec(SCHEMA);

  // Seed symbols
  const insertSymbol = db.prepare(
    'INSERT OR IGNORE INTO symbols (ticker, label) VALUES (?, ?)'
  );
  for (const s of DEFAULT_SYMBOLS) {
    insertSymbol.run(s.ticker, s.label);
  }

  // Ensure market_state has a row for every symbol
  const insertState = db.prepare(
    'INSERT OR IGNORE INTO market_state (symbol_id) SELECT id FROM symbols'
  );
  insertState.run();

  // Clean up any symbols not in DEFAULT_SYMBOLS (e.g., from old configurations)
  const allowedTickers = DEFAULT_SYMBOLS.map(s => `'${s.ticker}'`).join(',');
  const cleanupQueries = [
    `DELETE FROM market_state WHERE symbol_id IN (SELECT id FROM symbols WHERE ticker NOT IN (${allowedTickers}))`,
    `DELETE FROM alerts WHERE event_id IN (SELECT id FROM events WHERE symbol_id IN (SELECT id FROM symbols WHERE ticker NOT IN (${allowedTickers})))`,
    `DELETE FROM events WHERE symbol_id IN (SELECT id FROM symbols WHERE ticker NOT IN (${allowedTickers}))`,
    `DELETE FROM symbols WHERE ticker NOT IN (${allowedTickers})`
  ];

  db.transaction(() => {
    for (const query of cleanupQueries) {
      db.exec(query);
    }
  })();

  console.log('Database initialized and cleaned successfully.');
}
