// Simple script to initialize the SQLite database with schema
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'ind_appointments.db');
const SCHEMA_PATH = path.join(__dirname, '..', 'database', 'schema.sql');

// Create data directory
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

console.log('Initializing SQLite database...');
console.log('Database path:', DB_PATH);

// Create/open database
const db = new Database(DB_PATH);

// Read schema
const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');

// Execute schema
console.log('Creating tables...');
db.exec(schema);

console.log('✓ Database initialized successfully!');

// Show table count
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
console.log(`Created ${tables.length} tables:`, tables.map(t => t.name).join(', '));

db.close();
