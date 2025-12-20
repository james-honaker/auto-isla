
import { getDB } from '../app/lib/db';
import { detectModel } from '../app/lib/scoring';

const db = getDB();
const listings = db.prepare('SELECT make, title FROM listings ORDER BY RANDOM() LIMIT 20').all() as any[];

console.log("Debugging Model Detection on 20 random listings:");
listings.forEach(l => {
    const detected = detectModel(l.make, l.title);
    console.log(`[${l.make}] "${l.title}" -> ${detected ? detected : 'NULL'}`);
});
