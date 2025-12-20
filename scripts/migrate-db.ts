
import { getDB } from '../app/lib/db';

const db = getDB();

try {
    console.log("Adding 'model' column to listings table...");
    db.exec('ALTER TABLE listings ADD COLUMN model TEXT');
    console.log("Migration successful.");
} catch (e: any) {
    if (e.message.includes('duplicate column name')) {
        console.log("Column 'model' already exists.");
    } else {
        console.error("Migration failed:", e);
    }
}
