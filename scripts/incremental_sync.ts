// Incremental Hourly Sync Script
// Run with: npx ts-node scripts/incremental_sync.ts
// Strategies:
// 1. Incremental Scrape (stopOnExisting: true) -> Speed
// 2. No Cleanup -> Safety/Additive only

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { scrapeAllListings } = require('../app/lib/scraper_common');
const { GENERAL_MAKES, TARGETED_MODELS } = require('./sync_config');

const dbPath = path.join(__dirname, '../data/listings.db');
const db = new Database(dbPath);

// Helper to upsert listings
function upsertListings(listings: any, defaultMake: any, defaultModelTarget?: any) {
    const insert = db.prepare(`
        INSERT INTO listings (id, title, price, year, mileage, location, link_url, img_url, make, model, is_active, updated_at)
        VALUES (@id, @title, @price, @year, @mileage, @location, @linkUrl, @imgUrl, @make, @model, 1, @updatedAt)
        ON CONFLICT(id) DO UPDATE SET
            price = excluded.price,
            mileage = excluded.mileage,
            is_active = 1,
            updated_at = excluded.updated_at
    `);

    const updateTx = db.transaction((items: any) => {
        for (const item of items) {
            const idMatch = item.linkUrl.match(/AutoNumAnuncio=([0-9]+)/);
            const id = idMatch ? idMatch[1] : item.linkUrl;
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

async function runIncrementalSync() {
    console.log('Starting INCREMENTAL Hourly Sync (Fast Updates)...');

    // Load existing IDs for incremental logic
    const existingIds = getExistingIds();
    console.log(`Loaded ${existingIds.size} existing listings from DB.`);

    const startTime = Date.now();

    // 1. General Incremental Scrape
    for (const make of GENERAL_MAKES) {
        console.log(`\n=== Syncing General (INCREMENTAL): ${make.name} ===`);
        // Add Sort Param and pass existingIds
        const listings = await scrapeAllListings(make.id, '&jumpMenu=Trecientesdesc', {
            stopOnExisting: true,
            existingIds: existingIds
        });
        console.log(`Saved ${listings.length} new/updated listings for ${make.name}`);
        upsertListings(listings, make.name);
    }

    // 2. Targeted Incremental Scrape
    for (const target of TARGETED_MODELS) {
        console.log(`\n=== Syncing Targeted (INCREMENTAL): ${target.modelTarget} ===`);
        const listings = await scrapeAllListings(target.makeId, target.extraParams, {
            stopOnExisting: true,
            existingIds: existingIds
        });
        console.log(`Saved ${listings.length} new/updated listings for ${target.modelTarget}`);
        upsertListings(listings, target.make, target.modelTarget);
    }

    const duration = (Date.now() - startTime) / 1000;
    console.log(`\nINCREMENTAL Sync Completed in ${duration.toFixed(2)}s`);
}

runIncrementalSync().catch(console.error);
