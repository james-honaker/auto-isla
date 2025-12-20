const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, '../data/listings.db');
const db = new Database(dbPath);

console.log('--- Verifying Data Accuracy & Cleanup ---');

// 1. Check Ioniq 5 Counts
const activeIoniqs = db.prepare("SELECT COUNT(*) as count FROM listings WHERE model='Ioniq 5' AND is_active=1").get();
const inactiveIoniqs = db.prepare("SELECT COUNT(*) as count FROM listings WHERE model='Ioniq 5' AND is_active=0").get();
console.log(`Active Ioniq 5s: ${activeIoniqs.count} (Should match ~21)`);
console.log(`Inactive Ioniq 5s: ${inactiveIoniqs.count} (Stale data)`);

// 2. Check for "No Price" Listing ID specifically
const missingId = db.prepare("SELECT * FROM listings WHERE id LIKE '%12677627%'").get();
console.log('\nMissing ID 12677627 Found?', missingId ? 'YES' : 'NO');
if (missingId) console.log(missingId);

// 3. Check All Ioniq Variations
console.log('\n--- Model Distribution ---');
const models = db.prepare("SELECT model, is_active, COUNT(*) as count FROM listings WHERE title LIKE '%Ioniq%' GROUP BY model, is_active").all();
console.log(JSON.stringify(models, null, 2));
