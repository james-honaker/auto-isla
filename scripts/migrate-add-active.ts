
import { getDB } from '../app/lib/db';

const db = getDB();

try {
    console.log("Adding 'is_active' column to listings table...");
    // Default to 1 (true) for existing records so they remain visible until confirmed stale.
    db.exec('ALTER TABLE listings ADD COLUMN is_active INTEGER DEFAULT 1');
    console.log("Migration successful.");
} catch (e: any) {
    if (e.message.includes('duplicate column name')) {
        console.log("Column 'is_active' already exists.");
    } else {
        console.error("Migration failed:", e);
    }
}
