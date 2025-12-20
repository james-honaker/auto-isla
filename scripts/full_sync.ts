// Full Nightly Sync Script
// Run with: npx ts-node scripts/full_sync.ts
// Strategies:
// 1. Full Scrape (stopOnExisting: false) -> Reliability
// 2. Logical Deletion (Cleanup) -> Accuracy

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

async function runFullSync() {
    console.log('Starting FULL Nightly Sync (Deep Scrape + Cleanup)...');
    const startTime = Date.now();
    const cleanupThreshold = new Date(startTime).toISOString();

    // 1. General Deep Scrape (Full Depth)
    for (const make of GENERAL_MAKES) {
        console.log(`\n=== Syncing General (FULL): ${make.name} ===`);
        // We add sorting just to look nice, but we DO NOT stop on existing.
        const listings = await scrapeAllListings(make.id, '&jumpMenu=Trecientesdesc', {
            stopOnExisting: false
        });
        console.log(`Saved ${listings.length} listings for ${make.name}`);
        upsertListings(listings, make.name);

        // CLEANUP: Mark missing items for this Make as inactive
        // Safety check: Don't cleanup if we somehow scraped 0 items (site down?)
        if (listings.length > 0) {
            console.log(`Performing Cleanup for Make: ${make.name}...`);
            const info = db.prepare(`
                UPDATE listings 
                SET is_active = 0 
                WHERE make = ? 
                AND is_active = 1 
                AND updated_at < ?
            `).run(make.name, cleanupThreshold);
            console.log(`-> Marked ${info.changes} stale ${make.name} listings as inactive.`);
        } else {
            console.warn(`[WARNING] Scraped 0 items for ${make.name}. Skipping cleanup to prevent accidental wipe.`);
        }
    }

    // 2. Targeted Scrape (Full Depth)
    for (const target of TARGETED_MODELS) {
        console.log(`\n=== Syncing Targeted (FULL): ${target.modelTarget} ===`);
        const listings = await scrapeAllListings(makeId = target.makeId, target.extraParams, {
            stopOnExisting: false
        });
        console.log(`Saved ${listings.length} listings for ${target.modelTarget}`);
        upsertListings(listings, target.make, target.modelTarget);

        // CLEANUP: Mark missing items for this specific Model as inactive
        if (listings.length > 0) {
            console.log(`Performing Cleanup for Model: ${target.modelTarget}...`);
            // We cleanup based on the MODEL field in the DB.
            const info = db.prepare(`
                UPDATE listings 
                SET is_active = 0 
                WHERE model = ? 
                AND is_active = 1 
                AND updated_at < ?
            `).run(target.modelTarget, cleanupThreshold);
            console.log(`-> Marked ${info.changes} stale ${target.modelTarget} listings as inactive.`);
        }
    }

    const duration = (Date.now() - startTime) / 1000;
    console.log(`\nFULL Sync Completed in ${duration.toFixed(2)}s`);
}

runFullSync().catch(console.error);
