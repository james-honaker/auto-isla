const https = require('https');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// --- DB Logic ---
let dbInstance = null;
function getDB() {
    if (dbInstance) return dbInstance;
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    const dbPath = path.join(dataDir, 'listings.db');
    dbInstance = new Database(dbPath);
    // Schema (Ensure it exists)
    dbInstance.exec(`
        CREATE TABLE IF NOT EXISTS listings (
            id TEXT PRIMARY KEY,
            make TEXT,
            model TEXT,
            title TEXT,
            price INTEGER,
            year INTEGER,
            mileage INTEGER,
            location TEXT,
            img_url TEXT,
            link_url TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    return dbInstance;
}

// --- Scraper Logic ---
function parsePrice(priceStr) {
    if (!priceStr) return 0;
    const val = parseInt(priceStr.replace(/[^0-9]/g, ''), 10);
    return isNaN(val) ? 0 : val;
}
function parseYear(text) {
    if (!text) return 0;
    const match = text.match(/\b(19|20)\d{2}\b/);
    return match ? parseInt(match[0], 10) : 0;
}
function parseMileage(text) {
    if (!text) return 0;
    const match = text.replace(/,/g, '').match(/(\d+)/);
    return match ? parseInt(match[0], 10) : 0;
}

function scrapeListPage(makeId, offset) {
    return new Promise((resolve, reject) => {
        const url = `https://www.clasificadosonline.com/UDTransListingADV.asp?Marca=${makeId}&TipoC=1&Submit2=Buscar+-+Go&offset=${offset}`;
        console.log(`Fetching offset ${offset}...`);

        const req = https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
            }
        }, (res) => {
            if (res.statusCode !== 200) {
                console.error(`Status Code: ${res.statusCode}`);
                resolve([]);
                return;
            }
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                const rowDelimiter = '<tr align="center" valign="middle">';
                const rows = data.split(rowDelimiter);
                rows.shift();
                const listings = [];
                for (const rowHtml of rows) {
                    // Filter out Ads
                    if (rowHtml.includes('bgcolor="#F7FAFD"') ||
                        rowHtml.includes('bgcolor="#FFFFCC"') ||
                        rowHtml.includes('bgcolor="#ffffcc"') ||
                        rowHtml.includes('bgcolor="#FFFF99"') ||
                        rowHtml.includes('bgcolor="#ffff99"')) {
                        continue;
                    }

                    const titleMatch = rowHtml.match(/class="Tahoma17Blacknounder"[^>]*>([\s\S]*?)<\/a>/);
                    const titleRaw = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '';
                    const linkMatch = rowHtml.match(/href="(\/UDTransDetail\.asp\?AutoNumAnuncio=[^"]+)"/);
                    const linkUrl = linkMatch ? `https://www.clasificadosonline.com${linkMatch[1]}` : '';

                    if (!titleRaw || !linkUrl) continue;

                    const priceMatch = rowHtml.match(/class="Tahoma14BrownNound"[^>]*>([\s\S]*?)<\/span>/);
                    const priceRaw = priceMatch ? priceMatch[1].replace(/<[^>]+>/g, '').trim() : '';
                    const mileageMatch = rowHtml.match(/class="Tahoma14DbluenoUnd"[^>]*>(\s*Millas[\s\S]*?)<\/span>/i);
                    const mileageRaw = mileageMatch ? mileageMatch[1].replace(/<[^>]+>/g, '').trim() : '';
                    const locationMatch = rowHtml.match(/class="tahoma14hbluenoUnder"[^>]*>([\s\S]*?)<\/span>/);
                    const locationRaw = locationMatch ? locationMatch[1].replace(/<[^>]+>/g, '').trim() : '';
                    const imgMatch = rowHtml.match(/<img[^>]+src="([^">]+)"/);
                    const imgUrl = imgMatch ? imgMatch[1] : '';

                    listings.push({
                        title: titleRaw,
                        price: parsePrice(priceRaw),
                        year: parseYear(titleRaw),
                        mileage: parseMileage(mileageRaw),
                        location: locationRaw,
                        imgUrl: imgUrl,
                        linkUrl: linkUrl
                    });
                }
                // Debug Next Link
                if (data.includes("Proximos")) {
                    // console.log("DEBUG: 'Proximos' text found in page.");
                } else {
                    console.log("DEBUG: 'Proximos' NOT found in page.");
                }

                // Robust approach: Find "Proximos" img, then look back for <a href...>
                const imgRegex = /<img[^>]+alt="Proximos"/i;
                const imgMatch = data.match(imgRegex);

                let nextOffset = null;

                if (imgMatch) {
                    const imgIndex = imgMatch.index;
                    // Look backwards from imgIndex for "<a "
                    const searchWindow = data.substring(Math.max(0, imgIndex - 500), imgIndex);
                    const lastAnchorIndex = searchWindow.lastIndexOf("<a ");

                    if (lastAnchorIndex !== -1) {
                        const anchorTag = searchWindow.substring(lastAnchorIndex);
                        console.log(`DEBUG: Found Anchor Tag via Reverse Search: ${anchorTag}`);

                        const hrefMatch = anchorTag.match(/href="([^"]+)"/i);
                        if (hrefMatch) {
                            const relativeUrl = hrefMatch[1];
                            const match = relativeUrl.match(/offset=(\d+)/i);
                            if (match) {
                                nextOffset = parseInt(match[1], 10);
                                console.log(`DEBUG: Extracted Next Offset: ${nextOffset}`);
                            }
                        }
                    } else {
                        console.log("DEBUG: Found Proximos img but NO parent anchor in window.");
                    }
                } else {
                    // Try "Next" or ">" or other variations if Proximos fails?
                    // No, browser said Proximos.
                    console.log("DEBUG: Proximos image NOT found via regex match.");
                }

                resolve({ listings, nextOffset });
            });
        });
        req.on('error', (e) => {
            console.error(e);
            resolve({ listings: [], nextOffset: null });
        });
    });
}

async function scrapeAll(makeId) {
    let all = [];
    let currentOffset = 0;
    const MAX_PAGES = 500;
    let pages = 0;

    while (currentOffset !== null && pages < MAX_PAGES) {
        const { listings, nextOffset } = await scrapeListPage(makeId, currentOffset);

        if (listings.length === 0) break;

        all = [...all, ...listings];
        currentOffset = nextOffset;
        pages++;

        // Polite delay
        await new Promise(r => setTimeout(r, 200));
    }
    return all;
}

// --- Scoring Logic (Detection Only) ---
// Simplified detection because we can't easily import the JSON in standalone JS without type assertions
// We'll just replicate the simple substring logic.
const reliabilityData = require('../data/reliability.json');
function detectModel(make, title) {
    if (!make || !title) return '';
    const makeInfo = reliabilityData[make];
    if (!makeInfo || !makeInfo.models) return '';
    const knownModels = Object.keys(makeInfo.models).sort((a, b) => b.length - a.length);
    const lowerTitle = title.toLowerCase();
    for (const model of knownModels) {
        if (lowerTitle.includes(model.toLowerCase())) return model;
    }
    return '';
}

// --- Main Sync ---
async function main() {
    console.log("Syncing Hyundai...");
    const listings = await scrapeAll('22');
    console.log(`Found ${listings.length} total listings.`);

    const db = getDB();
    const insert = db.prepare(`
        INSERT INTO listings (id, make, model, title, price, year, mileage, location, img_url, link_url, updated_at)
        VALUES (@id, @make, @model, @title, @price, @year, @mileage, @location, @img_url, @link_url, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
            price = excluded.price,
            mileage = excluded.mileage,
            updated_at = CURRENT_TIMESTAMP
    `);

    // Transaction
    const runMany = db.transaction((rows) => {
        for (const row of rows) {
            const detected = detectModel('Hyundai', row.title);
            insert.run({
                id: row.linkUrl,
                make: 'Hyundai',
                model: detected,
                title: row.title,
                price: row.price,
                year: row.year,
                mileage: row.mileage,
                location: row.location,
                img_url: row.imgUrl,
                link_url: row.linkUrl
            });
        }
    });

    runMany(listings);
    console.log("DB Updated.");

    // Check for Ioniq 5
    const ioniq5s = listings.filter(l => l.title.toLowerCase().includes('ioniq 5'));
    console.log(`\nIoniq 5 Count: ${ioniq5s.length}`);
    ioniq5s.forEach(l => console.log(`- ${l.title}`));
}

main();
