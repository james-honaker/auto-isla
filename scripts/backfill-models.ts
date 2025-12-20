
import { getListingsByMakes, upsertListing, getDB } from '../app/lib/db';
import { detectModel } from '../app/lib/scoring';
import makesData from '../data/makes.json';

const db = getDB();

async function backfill() {
    console.log("Starting Model Backfill...");

    // Get all listings
    const listings = db.prepare('SELECT * FROM listings').all() as any[];
    console.log(`Found ${listings.length} listings to check.`);

    let updatedCount = 0;

    const stmt = db.prepare('UPDATE listings SET model = ? WHERE id = ?');

    for (const listing of listings) {
        if (listing.model) continue; // Skip if already has model

        const detected = detectModel(listing.make, listing.title);
        if (detected) {
            stmt.run(detected, listing.id);
            updatedCount++;
            if (updatedCount % 100 === 0) process.stdout.write('.');
        }
    }

    console.log(`\nBackfilled ${updatedCount} listings with detected models.`);
}

backfill();
