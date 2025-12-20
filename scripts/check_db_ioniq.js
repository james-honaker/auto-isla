const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '../data/listings.db');
const db = new Database(dbPath);

const info = db.prepare("DELETE FROM listings").run();
console.log(`Cleared ${info.changes} listings from database.`);
