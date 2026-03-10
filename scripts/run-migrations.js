#!/usr/bin/env node

/**
 * Database Migration Runner
 * Runs all pending migrations in order
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'ind_appointments.db');
const MIGRATIONS_DIR = path.join(process.cwd(), 'database', 'migrations');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create migrations table if it doesn't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS _migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

/**
 * Get list of executed migrations
 */
function getExecutedMigrations() {
  const rows = db.prepare('SELECT name FROM _migrations ORDER BY id').all();
  return new Set(rows.map(row => row.name));
}

/**
 * Mark migration as executed
 */
function markMigrationExecuted(name) {
  db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(name);
}

/**
 * Get list of pending migrations
 */
function getPendingMigrations() {
  const executed = getExecutedMigrations();

  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.log('No migrations directory found');
    return [];
  }

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  return files.filter(f => !executed.has(f));
}

/**
 * Run a single migration
 */
function runMigration(filename) {
  const filepath = path.join(MIGRATIONS_DIR, filename);
  const sql = fs.readFileSync(filepath, 'utf8');

  console.log(`Running migration: ${filename}`);

  try {
    // Split SQL into statements, respecting BEGIN/END blocks (e.g. triggers)
    const statements = [];
    let current = '';
    let inBlock = false;
    for (const line of sql.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('--') || trimmed === '') {
        continue;
      }
      current += line + '\n';
      if (/^BEGIN\b/i.test(trimmed)) {
        inBlock = true;
      }
      if (trimmed.endsWith(';') && !inBlock) {
        statements.push(current.trim());
        current = '';
      }
      if (inBlock && /^END;/i.test(trimmed)) {
        inBlock = false;
        statements.push(current.trim());
        current = '';
      }
    }
    if (current.trim()) {
      statements.push(current.trim());
    }

    db.transaction(() => {
      for (const statement of statements) {
        try {
          db.exec(statement);
        } catch (err) {
          if (err.message.includes('duplicate column name')) {
            console.log(`  - Column already exists, skipping`);
            continue;
          }
          if (err.message.includes('already exists')) {
            console.log(`  - Already exists, skipping`);
            continue;
          }
          throw err;
        }
      }
      markMigrationExecuted(filename);
    })();

    console.log(`  - Completed successfully`);
    return true;
  } catch (error) {
    console.error(`  - Failed: ${error.message}`);
    return false;
  }
}

/**
 * Run all pending migrations
 */
function runAllMigrations() {
  console.log('='.repeat(50));
  console.log('IND Appointments - Database Migration Runner');
  console.log('='.repeat(50));
  console.log(`Database: ${DB_PATH}`);
  console.log(`Migrations: ${MIGRATIONS_DIR}`);
  console.log('');

  const pending = getPendingMigrations();

  if (pending.length === 0) {
    console.log('No pending migrations');
    return;
  }

  console.log(`Found ${pending.length} pending migration(s)`);
  console.log('');

  let success = 0;
  let failed = 0;

  for (const migration of pending) {
    if (runMigration(migration)) {
      success++;
    } else {
      failed++;
      // Stop on first failure
      break;
    }
  }

  console.log('');
  console.log('='.repeat(50));
  console.log(`Migrations completed: ${success} success, ${failed} failed`);
  console.log('='.repeat(50));

  if (failed > 0) {
    process.exit(1);
  }
}

// Run migrations
runAllMigrations();

// Close database
db.close();
