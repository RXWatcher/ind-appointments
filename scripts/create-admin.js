const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const path = require('path');
const readline = require('readline');

const dbPath = path.join(__dirname, '../data/ind_appointments.db');
const db = new Database(dbPath);

function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

function promptPassword(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    // Disable echo for password input
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }

    process.stdout.write(question);
    let password = '';

    process.stdin.on('data', (char) => {
      char = char.toString();

      switch (char) {
        case '\n':
        case '\r':
        case '\u0004':
          if (process.stdin.isTTY) {
            process.stdin.setRawMode(false);
          }
          process.stdout.write('\n');
          rl.close();
          resolve(password);
          break;
        case '\u0003':
          process.exit();
          break;
        case '\u007F': // Backspace
          if (password.length > 0) {
            password = password.slice(0, -1);
            process.stdout.clearLine(0);
            process.stdout.cursorTo(0);
            process.stdout.write(question + '*'.repeat(password.length));
          }
          break;
        default:
          password += char;
          process.stdout.write('*');
          break;
      }
    });
  });
}

async function createAdminUser() {
  console.log('\n=== IND Appointments Admin User Setup ===\n');

  // Get credentials from environment variables or prompt
  let email = process.env.ADMIN_EMAIL;
  let password = process.env.ADMIN_PASSWORD;
  let username = process.env.ADMIN_USERNAME || 'admin';
  let fullName = process.env.ADMIN_FULLNAME || 'Admin User';

  if (!email) {
    email = await prompt('Enter admin email: ');
  }

  if (!password) {
    password = await promptPassword('Enter admin password: ');
    const confirmPassword = await promptPassword('Confirm password: ');

    if (password !== confirmPassword) {
      console.error('\n✗ Passwords do not match');
      process.exit(1);
    }
  }

  // Validate password strength
  if (password.length < 12) {
    console.error('\n✗ Password must be at least 12 characters long');
    process.exit(1);
  }

  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    console.error('\n✗ Password must contain uppercase, lowercase, number, and special character');
    process.exit(1);
  }

  if (!email || !email.includes('@')) {
    console.error('\n✗ Valid email is required');
    process.exit(1);
  }

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

  console.log(`\n✓ Admin user created/updated successfully`);
  console.log(`  Email: ${email}`);
  console.log(`  Username: ${username}`);
  console.log(`\nNote: Password not displayed for security. Please remember it.\n`);

  db.close();
}

createAdminUser().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
