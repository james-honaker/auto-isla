
import { getDB } from '../app/lib/db';
const db = getDB();
const row = db.prepare('SELECT * FROM listings LIMIT 1').get();
console.log('Columns:', Object.keys(row || {}));
