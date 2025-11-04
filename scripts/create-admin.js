const bcrypt = require('bcrypt');
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../data/ind_appointments.db');
const db = new Database(dbPath);

async function createAdminUser() {
  const email = 'jrcole@gmail.com';
  const password = 'Amsterdam123!';
  const username = 'admin';
  const fullName = 'Admin User';

  // Hash the password
  const passwordHash = await bcrypt.hash(password, 10);

  // Check if user exists
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);

  if (existing) {
    // Update existing user to admin
    db.prepare(`
      UPDATE users
      SET password_hash = ?, role = 'admin', email_verified = 1, username = ?, full_name = ?
      WHERE email = ?
    `).run(passwordHash, username, fullName, email);
    console.log('✓ Updated existing user to admin');
  } else {
    // Create new admin user
    db.prepare(`
      INSERT INTO users (email, username, password_hash, full_name, role, email_verified)
      VALUES (?, ?, ?, ?, 'admin', 1)
    `).run(email, username, passwordHash, fullName);
    console.log('✓ Created new admin user');
  }

  console.log(`\nAdmin Login Credentials:`);
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);

  db.close();
}

createAdminUser().catch(console.error);
