const https = require('https');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, '../data/listings.db');
const db = new Database(dbPath);

// Targeted Models Configuration
// Using KEYWORD search since Model ID returns 0 results on the platform.
const TARGETS = [
    { make: 'Hyundai', makeId: '22', model: 'Ioniq 5', extraParams: '&TipoC=1&Key=Ioniq' },
    { make: 'Hyundai', makeId: '22', model: 'Ioniq 5 (ModelID)', extraParams: '&Modelo=2079' }
];

function scrapeListPage(makeId, offset, extraParams) {
    return new Promise((resolve, reject) => {
        const url = `https://www.clasificadosonline.com/UDTransListingADV.asp?Marca=${makeId}&Submit2=Buscar+-+Go&offset=${offset}${extraParams}`;
        console.log(`Fetching ${url}...`);

        const req = https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
            }
        }, (res) => {
            if (res.statusCode !== 200) {
                console.error(`Failed: ${res.statusCode}`);
                resolve({ listings: [], nextOffset: null });
                return;
            }

            let data = '';
            res.on('data', chunk => data += chunk);
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
                    const priceMatch = rowHtml.match(/class="Ver12nounderBlack"[^>]*>\$([\d,]+)/);
                    let price = priceMatch ? parseInt(priceMatch[1].replace(/,/g, ''), 10) : 0;

                    // Fallback: Parse price from title if 0
                    if (price === 0) {
                        const titlePrice = titleRaw.match(/\$?\s?(\d{1,3}(,\d{3})+|\d{4,})/);
                        if (titlePrice) {
                            price = parseInt(titlePrice[1].replace(/,/g, ''), 10);
                        }
                    }

                    if (titleRaw && linkUrl) {
                        // Detect correct model from title
                        let detectedModel = 'Ioniq'; // Default
                        const t = titleRaw.toLowerCase();
                        if (t.includes('ioniq 5') || t.includes('ionic 5') || t.includes('ionic 5')) detectedModel = 'Ioniq 5';
                        else if (t.includes('ioniq 6') || t.includes('ionic 6')) detectedModel = 'Ioniq 6';
                        else if (t.includes('hybrid') || t.includes('hibrido')) detectedModel = 'Ioniq Hybrid';

                        listings.push({
                            title: titleRaw,
                            price,
                            linkUrl,
                            make: 'Hyundai',
                            model: detectedModel
                        });
                    }
                }

                // Robust Next Link Detection
                const imgRegex = /<img[^>]+alt="Proximos"/i;
                const imgMatch = data.match(imgRegex);
                let nextOffset = null;

                if (imgMatch) {
                    const imgIndex = imgMatch.index;
                    const searchWindow = data.substring(Math.max(0, imgIndex - 1000), imgIndex);
                    const lastAnchorIndex = searchWindow.lastIndexOf("<a ");

                    if (lastAnchorIndex !== -1) {
                        const anchorTag = searchWindow.substring(lastAnchorIndex);
                        const hrefMatch = anchorTag.match(/href="([^"]+)"/i);
                        if (hrefMatch) {
                            const relativeUrl = hrefMatch[1];
                            const match = relativeUrl.match(/offset=(\d+)/i);
                            if (match) nextOffset = parseInt(match[1], 10);
                        }
                    }
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

function updateDB(listings, modelName) {
    const insert = db.prepare(`
        INSERT OR REPLACE INTO listings (id, title, price, year, mileage, location, link_url, img_url, make, model, updated_at)
        VALUES (@id, @title, @price, 0, 0, 'Unknown', @linkUrl, '', @make, @model, @updatedAt)
    `);

    const updateTx = db.transaction((items) => {
        for (const item of items) {
            const idMatch = item.linkUrl.match(/AutoNumAnuncio=([0-9]+)/);
            const id = idMatch ? idMatch[1] : item.linkUrl;

            insert.run({
                id,
                title: item.title,
                price: item.price,
                linkUrl: item.linkUrl,
                make: 'Hyundai',
                model: item.model, // Use the dynamically detected model from the item
                updatedAt: new Date().toISOString()
            });
        }
    });

    updateTx(listings);
}

async function syncTarget(target) {
    console.log(`Syncing ${target.model} using ${target.extraParams}...`);
    let all = [];
    let currentOffset = 0;
    let pages = 0;

    while (currentOffset !== null && pages < 100) {
        console.log(`Fetching offset ${currentOffset}...`);
        const { listings, nextOffset } = await scrapeListPage(target.makeId, currentOffset, target.extraParams);

        if (listings.length === 0) break;

        all = [...all, ...listings];
        currentOffset = nextOffset;
        pages++;

        await new Promise(r => setTimeout(r, 200));
    }

    console.log(`Found ${all.length} listings.`);
    updateDB(all, target.model);
}

async function main() {
    for (const target of TARGETS) {
        await syncTarget(target);
    }
}

main();
