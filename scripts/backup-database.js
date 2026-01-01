#!/usr/bin/env node

/**
 * Database Backup Script
 *
 * This script creates a backup of the SQLite database with compression.
 * It supports:
 * - Local file backups with rotation
 * - Optional upload to S3-compatible storage
 *
 * Usage:
 *   node scripts/backup-database.js [--upload]
 *
 * Environment variables:
 *   BACKUP_DIR - Directory for local backups (default: ./backups)
 *   BACKUP_RETENTION_DAYS - Days to keep local backups (default: 7)
 *   S3_ENDPOINT - S3 endpoint URL (optional)
 *   S3_BUCKET - S3 bucket name (optional)
 *   S3_ACCESS_KEY - S3 access key (optional)
 *   S3_SECRET_KEY - S3 secret key (optional)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const zlib = require('zlib');

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '../data/ind_appointments.db');
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, '../backups');
const RETENTION_DAYS = parseInt(process.env.BACKUP_RETENTION_DAYS || '7', 10);
const UPLOAD_TO_S3 = process.argv.includes('--upload');

async function main() {
  console.log('[BACKUP] Starting database backup...');
  console.log(`[BACKUP] Source: ${DB_PATH}`);

  // Check if database exists
  if (!fs.existsSync(DB_PATH)) {
    console.error(`[BACKUP] Database not found: ${DB_PATH}`);
    process.exit(1);
  }

  // Create backup directory if it doesn't exist
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log(`[BACKUP] Created backup directory: ${BACKUP_DIR}`);
  }

  // Generate backup filename with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupFilename = `ind_appointments_${timestamp}.db.gz`;
  const backupPath = path.join(BACKUP_DIR, backupFilename);

  try {
    // Create backup using SQLite's backup command (safe for hot backups)
    const tempBackupPath = path.join(BACKUP_DIR, `temp_backup_${timestamp}.db`);

    console.log('[BACKUP] Creating database copy...');
    execSync(`sqlite3 "${DB_PATH}" ".backup '${tempBackupPath}'"`, {
      encoding: 'utf-8',
    });

    // Compress the backup
    console.log('[BACKUP] Compressing backup...');
    const dbData = fs.readFileSync(tempBackupPath);
    const compressed = zlib.gzipSync(dbData, { level: 9 });
    fs.writeFileSync(backupPath, compressed);

    // Remove temporary uncompressed backup
    fs.unlinkSync(tempBackupPath);

    const stats = fs.statSync(backupPath);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`[BACKUP] Backup created: ${backupFilename} (${sizeMB} MB)`);

    // Upload to S3 if configured
    if (UPLOAD_TO_S3) {
      await uploadToS3(backupPath, backupFilename);
    }

    // Clean up old backups
    await cleanupOldBackups();

    console.log('[BACKUP] Backup completed successfully!');
  } catch (error) {
    console.error('[BACKUP] Backup failed:', error.message);
    process.exit(1);
  }
}

async function uploadToS3(filePath, filename) {
  const endpoint = process.env.S3_ENDPOINT;
  const bucket = process.env.S3_BUCKET;
  const accessKey = process.env.S3_ACCESS_KEY;
  const secretKey = process.env.S3_SECRET_KEY;

  if (!endpoint || !bucket || !accessKey || !secretKey) {
    console.log('[BACKUP] S3 credentials not configured, skipping upload');
    return;
  }

  console.log(`[BACKUP] Uploading to S3: ${bucket}/${filename}...`);

  try {
    // Using AWS SDK v3 style if available, otherwise fall back to curl
    const AWS = require('@aws-sdk/client-s3');
    const { S3Client, PutObjectCommand } = AWS;

    const s3Client = new S3Client({
      endpoint: endpoint,
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      },
      forcePathStyle: true,
    });

    const fileContent = fs.readFileSync(filePath);

    await s3Client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: `backups/${filename}`,
      Body: fileContent,
      ContentType: 'application/gzip',
    }));

    console.log('[BACKUP] Uploaded to S3 successfully');
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') {
      console.log('[BACKUP] AWS SDK not installed, skipping S3 upload');
      console.log('[BACKUP] To enable S3 uploads: npm install @aws-sdk/client-s3');
    } else {
      console.error('[BACKUP] S3 upload failed:', error.message);
    }
  }
}

async function cleanupOldBackups() {
  console.log(`[BACKUP] Cleaning up backups older than ${RETENTION_DAYS} days...`);

  const files = fs.readdirSync(BACKUP_DIR);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

  let deletedCount = 0;

  for (const file of files) {
    if (!file.startsWith('ind_appointments_') || !file.endsWith('.db.gz')) {
      continue;
    }

    const filePath = path.join(BACKUP_DIR, file);
    const stats = fs.statSync(filePath);

    if (stats.mtime < cutoffDate) {
      fs.unlinkSync(filePath);
      console.log(`[BACKUP] Deleted old backup: ${file}`);
      deletedCount++;
    }
  }

  console.log(`[BACKUP] Cleaned up ${deletedCount} old backup(s)`);
}

// Run the backup
main().catch(console.error);
