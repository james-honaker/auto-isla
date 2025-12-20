import { scrapeAllListings } from '../app/lib/scraper';
import { upsertListing, getDB } from '../app/lib/db';
import { detectModel } from '../app/lib/scoring';
// Mock/bypass TS errors for direct execution if needed or let ts-node handle it.
// Actually, since app/lib is TS, we should use import.

interface ListingItem {
    title: string;
    price: number;
    year: number;
    mileage: number;
    location: string;
    imgUrl: string;
    linkUrl: string;
}


async function sync() {
    console.log("Starting Deep Sync for Hyundai (ID 22)...");

    // 1. Scrape EVERYTHING
    const listings = await scrapeAllListings('22');
    console.log(`\nTotal Raw Listings Found: ${listings.length}`);

    // 2. Insert into DB
    let inserted = 0;
    const makeName = 'Hyundai';

    const db = getDB();
    const insertStmt = db.prepare(`
        INSERT INTO listings (id, make, model, title, price, year, mileage, location, img_url, link_url, updated_at)
        VALUES (@id, @make, @model, @title, @price, @year, @mileage, @location, @img_url, @link_url, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
            price = excluded.price,
            mileage = excluded.mileage,
            updated_at = CURRENT_TIMESTAMP
    `);

    // Using transaction for speed
    const processTransaction = db.transaction((items) => {
        for (const item of items) {
            const detectedModel = detectModel(makeName, item.title) || '';

            insertStmt.run({
                id: item.linkUrl, // using link as ID (or could extract ID param)
                make: makeName,
                model: detectedModel,
                title: item.title,
                price: item.price,
                year: item.year,
                mileage: item.mileage,
                location: item.location,
                img_url: item.imgUrl,
                link_url: item.linkUrl
            });
            inserted++;
        }
    });

    processTransaction(listings);

    console.log(`Successfully synced ${inserted} items.`);

    // 3. Verify Ioniq 5
    const ioniq5s = listings.filter(l =>
        l.title.toLowerCase().includes('ioniq 5') ||
        (l.title.toLowerCase().includes('ioniq') && !l.title.toLowerCase().includes('6'))
    );

    console.log(`\nPotential Ioniq 5s found: ${ioniq5s.length}`);
    ioniq5s.forEach(l => console.log(`- ${l.title} [$${l.price}]`));
}

sync();
