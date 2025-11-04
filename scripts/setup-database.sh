#!/bin/bash

# IND Appointments Database Setup Script (SQLite)

set -e

echo "==================================="
echo "IND Appointments Database Setup"
echo "==================================="
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "ERROR: .env file not found!"
    echo "Please copy .env.example to .env"
    exit 1
fi

# Load environment variables
source .env

# Set default DB path
DB_PATH=${DB_PATH:-data/ind_appointments.db}

echo "Database Configuration:"
echo "  Database: SQLite"
echo "  Path: $DB_PATH"
echo ""

# Create data directory if it doesn't exist
mkdir -p data

echo "Setting up SQLite database..."

# Check if sqlite3 command is available
if command -v sqlite3 &> /dev/null; then
    # Use sqlite3 command if available
    sqlite3 "$DB_PATH" < database/schema.sql
    echo ""
    echo "✓ Database setup completed using sqlite3 command!"
else
    echo "Note: sqlite3 command not found. The database will be created automatically when you run the app."
    echo ""
    echo "To manually set up the database, install sqlite3:"
    echo "  - Ubuntu/Debian: sudo apt-get install sqlite3"
    echo "  - macOS: brew install sqlite3"
    echo ""
    echo "Or just run 'npm run dev' and the app will create it automatically."
fi

echo ""
echo "✓ Setup completed!"
echo ""
echo "Next steps:"
echo "  1. Configure your SMTP settings in .env for email notifications"
echo "  2. Run 'npm run dev' to start the development server"
echo "  3. Open http://localhost:3000"
