PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS equipment (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
  category TEXT NOT NULL CHECK (length(trim(category)) BETWEEN 1 AND 40),
  quantity INTEGER NOT NULL CHECK (quantity >= 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS borrowers (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL CHECK (length(trim(full_name)) BETWEEN 1 AND 80),
  email TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS loans (
  id TEXT PRIMARY KEY,
  equipment_id TEXT NOT NULL REFERENCES equipment(id),
  borrower_id TEXT NOT NULL REFERENCES borrowers(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  borrowed_at TEXT NOT NULL DEFAULT (datetime('now')),
  due_at TEXT NOT NULL,
  returned_at TEXT CHECK (returned_at IS NULL OR returned_at >= borrowed_at)
);

CREATE INDEX IF NOT EXISTS idx_loans_open_equipment
  ON loans(equipment_id, returned_at);
CREATE INDEX IF NOT EXISTS idx_loans_borrower
  ON loans(borrower_id, borrowed_at);

-- The borrow API must run this check and insert in one database transaction.
-- Example stock query for an equipment row:
-- SELECT quantity - COALESCE(
--   (SELECT SUM(quantity) FROM loans WHERE equipment_id = ? AND returned_at IS NULL), 0
-- ) AS available FROM equipment WHERE id = ?;
