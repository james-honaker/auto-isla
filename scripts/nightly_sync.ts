// Nightly Sync Script
// Run with: npx ts-node scripts/nightly_sync.ts
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const { scrapeAllListings } = require('../app/lib/scraper_common');

const dbPath = path.join(__dirname, '../data/listings.db');
const db = new Database(dbPath);

// Configuration
const GENERAL_MAKES = [
    { name: 'Hyundai', id: '22' },
    { name: 'Toyota', id: '49' },
];

const TARGETED_MODELS = [
    // Targeted: Ioniq 5 (using Key=Ioniq)
    { make: 'Hyundai', makeId: '22', modelTarget: 'Ioniq 5', extraParams: '&TipoC=1&Key=Ioniq&jumpMenu=Trecientesdesc' },
    // Targeted: Ioniq 5 (using Modelo=2079) - Fix for specific missing models
    { make: 'Hyundai', makeId: '22', modelTarget: 'Ioniq 5', extraParams: '&Modelo=2079&jumpMenu=Trecientesdesc' }
];

// Explicitly typed as any to bypass strict TS checks in this mixed environment
function upsertListings(listings: any, defaultMake: any, defaultModelTarget?: any) {
    const insert = db.prepare(`
        INSERT INTO listings (id, title, price, year, mileage, location, link_url, img_url, make, model, updated_at)
        VALUES (@id, @title, @price, @year, @mileage, @location, @linkUrl, @imgUrl, @make, @model, @updatedAt)
        ON CONFLICT(id) DO UPDATE SET
            price = excluded.price,
            mileage = excluded.mileage,
            updated_at = excluded.updated_at
    `);

    const updateTx = db.transaction((items: any) => {
        for (const item of items) {
            const idMatch = item.linkUrl.match(/AutoNumAnuncio=([0-9]+)/);
            const id = idMatch ? idMatch[1] : item.linkUrl;

            // Determine Model:
            // 1. If explicit 'modelDetected' from scraper is provided and specific, use it.
            // 2. Otherwise fall back to default target model or 'Unknown'.

            let model = item.modelDetected;

            if (model === 'Unknown' || !model) {
                model = defaultModelTarget || 'Unknown';
            }

            insert.run({
                id,
                title: item.title,
                price: item.price,
                year: item.year,
                mileage: item.mileage,
                location: item.location,
                linkUrl: item.linkUrl,
                imgUrl: item.imgUrl,
                make: defaultMake,
                model: model,
                updatedAt: new Date().toISOString()
            });
        }
    });

    updateTx(listings);
}

function getExistingIds() {
    const rows = db.prepare('SELECT id FROM listings').all();
    return new Set(rows.map((r: any) => String(r.id)));
}

async function runSync() {
    console.log('Starting Nightly Sync (Incremental)...');

    // Load existing IDs for incremental logic
    const existingIds = getExistingIds();
    console.log(`Loaded ${existingIds.size} existing listings from DB.`);

    const startTime = Date.now();

    // 1. General Deep Scrape
    for (const make of GENERAL_MAKES) {
        console.log(`\n=== Syncing General: ${make.name} ===`);
        // Add Sort Param and pass existingIds
        const listings = await scrapeAllListings(make.id, '&jumpMenu=Trecientesdesc', {
            stopOnExisting: true,
            existingIds: existingIds
        });
        console.log(`Saved ${listings.length} listings for ${make.name}`);
        upsertListings(listings, make.name);
    }

    // 2. Targeted Scrape
    for (const target of TARGETED_MODELS) {
        console.log(`\n=== Syncing Targeted: ${target.modelTarget} ===`);
        // Sort param already in extraParams
        const listings = await scrapeAllListings(target.makeId, target.extraParams, {
            stopOnExisting: true,
            existingIds: existingIds
        });
        console.log(`Saved ${listings.length} listings for ${target.modelTarget}`);
        upsertListings(listings, target.make, target.modelTarget);
    }

    const duration = (Date.now() - startTime) / 1000;
    console.log(`\nSync Request Completed in ${duration.toFixed(2)}s`);
}

runSync().catch(console.error);
