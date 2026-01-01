#!/usr/bin/env node

/**
 * Database Restore Script
 *
 * This script restores a SQLite database from a backup file.
 *
 * Usage:
 *   node scripts/restore-database.js <backup-file>
 *
 * Example:
 *   node scripts/restore-database.js backups/ind_appointments_2026-01-01T12-00-00.db.gz
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '../data/ind_appointments.db');

function main() {
  const backupFile = process.argv[2];

  if (!backupFile) {
    console.error('Usage: node scripts/restore-database.js <backup-file>');
    console.error('');
    console.error('Available backups:');
    listBackups();
    process.exit(1);
  }

  const backupPath = path.resolve(backupFile);

  if (!fs.existsSync(backupPath)) {
    console.error(`[RESTORE] Backup file not found: ${backupPath}`);
    process.exit(1);
  }

  console.log('[RESTORE] Starting database restore...');
  console.log(`[RESTORE] Source: ${backupPath}`);
  console.log(`[RESTORE] Target: ${DB_PATH}`);

  // Create backup of current database before restoring
  if (fs.existsSync(DB_PATH)) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const preRestoreBackup = `${DB_PATH}.pre-restore.${timestamp}`;
    console.log(`[RESTORE] Backing up current database to: ${preRestoreBackup}`);
    fs.copyFileSync(DB_PATH, preRestoreBackup);
  }

  try {
    let dbData;

    if (backupFile.endsWith('.gz')) {
      // Decompress gzipped backup
      console.log('[RESTORE] Decompressing backup...');
      const compressed = fs.readFileSync(backupPath);
      dbData = zlib.gunzipSync(compressed);
    } else {
      // Read uncompressed backup
      dbData = fs.readFileSync(backupPath);
    }

    // Write to database file
    console.log('[RESTORE] Writing database...');
    fs.writeFileSync(DB_PATH, dbData);

    const stats = fs.statSync(DB_PATH);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`[RESTORE] Database restored: ${sizeMB} MB`);
    console.log('[RESTORE] Restore completed successfully!');
    console.log('');
    console.log('NOTE: You may need to restart the application for changes to take effect.');
  } catch (error) {
    console.error('[RESTORE] Restore failed:', error.message);
    process.exit(1);
  }
}

function listBackups() {
  const backupDir = path.join(__dirname, '../backups');

  if (!fs.existsSync(backupDir)) {
    console.log('  No backups directory found');
    return;
  }

  const files = fs.readdirSync(backupDir)
    .filter(f => f.startsWith('ind_appointments_') && f.endsWith('.db.gz'))
    .sort()
    .reverse();

  if (files.length === 0) {
    console.log('  No backups found');
    return;
  }

  for (const file of files) {
    const filePath = path.join(backupDir, file);
    const stats = fs.statSync(filePath);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    const date = stats.mtime.toLocaleString();
    console.log(`  ${path.join('backups', file)} (${sizeMB} MB) - ${date}`);
  }
}

main();
