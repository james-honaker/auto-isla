const https = require('https');
const iconv = require('iconv-lite');

// Helper to clean price string (e.g., "$19,000" -> 19000)
function parsePrice(priceStr) {
    if (!priceStr) return 0;
    // Fix: Require '$' symbol to avoid parsing years (e.g. "2024") as prices
    if (!priceStr.includes('$')) return 0;
    const val = parseInt(priceStr.replace(/[^0-9]/g, ''), 10);
    return isNaN(val) ? 0 : val;
}

// Helper to extract year from text (e.g., "Toyota Corolla 2020" -> 2020)
function parseYear(text) {
    if (!text) return 0;
    const match = text.match(/\b(19|20)\d{2}\b/);
    return match ? parseInt(match[0], 10) : 0;
}

// Helper to parse mileage
function parseMileage(text) {
    if (!text) return 0;
    const match = text.replace(/,/g, '').match(/(\d+)/);
    return match ? parseInt(match[0], 10) : 0;
}

// Scrape a specific page (CommonJS version for Node scripts)
function scrapeListPage(makeId, offset = 0, extraParams = '') {
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

            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => {
                const buffer = Buffer.concat(chunks);
                const data = iconv.decode(buffer, 'win1252'); // Decode properly

                const rowDelimiter = '<tr align="center" valign="middle">';
                const rows = data.split(rowDelimiter);
                rows.shift();

                const listings = [];
                for (const rowHtml of rows) {
                    // Extract Title First to check for whitelist keywords
                    const titleMatch = rowHtml.match(/class="Tahoma17Blacknounder"[^>]*>([\s\S]*?)<\/a>/);
                    const titleRaw = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '';

                    // Ad Filtering Logic:
                    // Only filter out "Ad" background colors if the title DOES NOT contain 'ioniq'
                    // This ensures we capture highlighted/promoted Ioniq listings (e.g. #FFFFCC)
                    // Use Regex for case-insensitive hex code matching (e.g. #fffFCC)
                    const isAdColor = /bgcolor="?(#F7FAFD|#FFFFCC|#FFFF99)"?/i.test(rowHtml);

                    if (isAdColor && !titleRaw.toLowerCase().includes('ioniq')) {
                        continue;
                    }
                    const linkMatch = rowHtml.match(/href="(\/UDTransDetail\.asp\?AutoNumAnuncio=[^"]+)"/);
                    const linkUrl = linkMatch ? `https://www.clasificadosonline.com${linkMatch[1]}` : '';
                    const priceMatch = rowHtml.match(/class="Tahoma14BrownNound"[^>]*>([\s\S]*?)<\/span>/);
                    const priceRaw = priceMatch ? priceMatch[1].replace(/<[^>]+>/g, '').trim() : '';
                    const mileageMatch = rowHtml.match(/class="Tahoma14DbluenoUnd"[^>]*>(\s*Millas[\s\S]*?)<\/span>/i);
                    const mileageRaw = mileageMatch ? mileageMatch[1].replace(/<[^>]+>/g, '').trim() : '';
                    const locationMatch = rowHtml.match(/class="tahoma14hbluenoUnder"[^>]*>([\s\S]*?)<\/span>/);
                    const locationRaw = locationMatch ? locationMatch[1].replace(/<[^>]+>/g, '').trim() : '';
                    // Image Extraction Logic
                    // 1. Try absolute http(s) src in img tag
                    let imgUrl = '';
                    const imgMatch = rowHtml.match(/<img[^>]+src=["'](https?:\/\/[^"']+)["']/i);
                    if (imgMatch) {
                        imgUrl = imgMatch[1];
                    } else {
                        // 2. Fallback: Try relative path in meta itemprop="image" content
                        // Example: <meta itemprop="image" content="/PP/T/..." />
                        const metaMatch = rowHtml.match(/<meta[^>]+itemprop=["']image["'][^>]+content=["'](\/[^"']+)["']/i);
                        if (metaMatch) {
                            imgUrl = `https://imgcache.clasificadosonline.com${metaMatch[1]}`;
                        }
                    }

                    let price = parsePrice(priceRaw);

                    if (linkUrl.includes('12677627')) {
                        console.log('--- DEBUG 12677627 ---');
                        console.log('TitleRaw:', titleRaw);
                        console.log('PriceRaw:', priceRaw);
                        console.log('Parsed Price (Initial):', price);
                    }

                    // Retain 0 price (Call for Price) - DO NOT FILTER OUT
                    if (price === 0) {
                        const titlePrice = titleRaw.match(/\$?\s?(\d{1,3}(,\d{3})+|\d{4,})/);
                        if (titlePrice) {
                            price = parseInt(titlePrice[1].replace(/,/g, ''), 10);
                            if (linkUrl.includes('12677627')) {
                                console.log('Parsed Price (Fallback):', price);
                                console.log('Fallback Regex Match:', titlePrice);
                            }
                        }
                    }

                    // Clean Title (Remove NEW badge text if present in title, though usually it's an image)
                    // The browser check showed <img ... title="Brand new...">
                    // We need to ensure we don't accidentally parse the image tag as part of the title if regex failed to strip it.
                    // The current regex `match(/class="Tahoma17Blacknounder"[^>]*>([\s\S]*?)<\/a>/)` grabs everything inside the A tag.
                    // `replace(/<[^>]+>/g, '')` strips the IMG tag, leaving the alt/title text? No, replace removes the tag entirely.
                    // So "Hyundai Ioniq 5" <img...> -> "Hyundai Ioniq 5"

                    const year = parseYear(titleRaw);
                    const mileage = parseMileage(mileageRaw);

                    let detectedModel = 'Unknown';
                    const t = titleRaw.toLowerCase();
                    // Improved matching for Ioniq 5 vs 6 vs Hybrid
                    if (t.includes('ioniq 5') || t.includes('ionic 5')) detectedModel = 'Ioniq 5';
                    else if (t.includes('ioniq 6') || t.includes('ionic 6')) detectedModel = 'Ioniq 6';
                    else if (t.includes('hybrid') || t.includes('hibrido')) detectedModel = 'Ioniq Hybrid'; // This might be too generic for Toyota? 
                    // Better to check Make match first or be specific
                    else if (t.includes('ioniq') || t.includes('ionic')) detectedModel = 'Ioniq';

                    // Toyota Specific
                    else if (t.includes('prius')) detectedModel = 'Prius';
                    else if (t.includes('tacoma')) detectedModel = 'Tacoma';
                    else if (t.includes('4runner')) detectedModel = '4Runner';
                    else if (t.includes('corolla')) detectedModel = 'Corolla';

                    if (linkUrl && titleRaw) {
                        listings.push({
                            title: titleRaw,
                            price,
                            year,
                            mileage,
                            location: locationRaw,
                            imgUrl,
                            linkUrl,
                            modelDetected: detectedModel
                        });
                    }
                }

                const imgRegex = /<img[^>]+alt="Proximos"/i;
                const imgMatch = data.match(imgRegex);
                let nextOffset = null;

                if (imgMatch && imgMatch.index !== undefined) {
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

async function scrapeAllListings(makeId, extraParams = '', options = {}) {
    let allListings = [];
    let currentOffset = 0;
    let pagesScraped = 0;
    const MAX_PAGES = 500;

    // Incremental Sync Logic
    const existingIds = options.existingIds || new Set();
    const stopOnExisting = options.stopOnExisting || false;
    let consecutiveExistingCount = 0;
    const CONSECUTIVE_THRESHOLD = 50; // Stop after seeing 50 known listings in a row

    while (currentOffset !== null && pagesScraped < MAX_PAGES) {
        const { listings, nextOffset } = await scrapeListPage(makeId, currentOffset, extraParams);

        if (listings.length === 0) break;

        // Filter and Check for duplicates
        let newItemsInBatch = 0;

        for (const item of listings) {
            const idMatch = item.linkUrl.match(/AutoNumAnuncio=([0-9]+)/);
            const id = idMatch ? idMatch[1] : item.linkUrl;

            if (existingIds.has(id)) {
                consecutiveExistingCount++;
            } else {
                consecutiveExistingCount = 0;
                newItemsInBatch++;
            }
        }

        allListings = [...allListings, ...listings];
        currentOffset = nextOffset;
        pagesScraped++;

        if (stopOnExisting && consecutiveExistingCount >= CONSECUTIVE_THRESHOLD) {
            console.log(`[Scraper] Stopped early: Met threshold of ${CONSECUTIVE_THRESHOLD} existing listings.`);
            break;
        }

        await new Promise(r => setTimeout(r, 200));
    }
    return allListings;
}

module.exports = { scrapeAllListings };
