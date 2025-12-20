const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '../data/listings.db');
const db = new Database(dbPath);

console.log('--- Verifying Model Column in DB ---');

const rows = db.prepare("SELECT title, model FROM listings WHERE title LIKE '%Ioniq 5%' LIMIT 10").all();
console.log(JSON.stringify(rows, null, 2));

console.log('\n--- Verifying Encoding ---');
// Check for "más" 
const mas = db.prepare("SELECT title FROM listings WHERE title LIKE '%más%' LIMIT 3").all();
console.log(`\nListings with 'más': ${mas.length}`);
mas.forEach(r => console.log(` - ${r.title}`));
