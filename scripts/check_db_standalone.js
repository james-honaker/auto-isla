const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(process.cwd(), 'data', 'listings.db');
const db = new Database(dbPath);

console.log('Querying DB at:', dbPath);

const rows = db.prepare("SELECT * FROM listings WHERE make = 'Hyundai'").all();
console.log(`Total Hyundai in DB: ${rows.length}`);

const potential = rows.filter(l => {
    const t = l.title.toLowerCase();
    return t.includes('ioniq') || t.includes('ionic');
});

console.log(`\nPotential Ioniqs in DB ("${potential.length}"):`);
potential.forEach(l => console.log(`- [${l.model || '?'}] ${l.title}`));
