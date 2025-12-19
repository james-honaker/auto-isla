
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../data/listings.db');
const db = new Database(dbPath);

try {
    console.log("Adding 'is_active' column to listings table...");
    // Default to 1 (true) for existing records
    db.exec('ALTER TABLE listings ADD COLUMN is_active INTEGER DEFAULT 1');
    console.log("Migration successful.");
} catch (e) {
    if (e.message.includes('duplicate column name')) {
        console.log("Column 'is_active' already exists.");
    } else {
        console.error("Migration failed:", e);
    }
}
