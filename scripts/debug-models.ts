
import { getDB } from '../app/lib/db';
const db = getDB();
const models = db.prepare('SELECT DISTINCT model FROM listings WHERE model IS NOT NULL AND model != ""').all();
console.log(models);
