const https = require('https');

// Helper to clean price string
function parsePrice(priceStr) {
    if (!priceStr) return 0;
    const val = parseInt(priceStr.replace(/[^0-9]/g, ''), 10);
    return isNaN(val) ? 0 : val;
}

function scrapeListPage(makeId, offset) {
    return new Promise((resolve, reject) => {
        const url = `https://www.clasificadosonline.com/UDTransListingADV.asp?Marca=${makeId}&TipoC=1&Submit2=Buscar+-+Go&offset=${offset}`;
        console.log(`Fetching offset ${offset}...`);

        https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
            }
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                const rowDelimiter = '<tr align="center" valign="middle">';
                const rows = data.split(rowDelimiter);
                rows.shift();

                console.log(`\n--- Offset ${offset} Analysis ---`);
                console.log(`Raw Row Chunks: ${rows.length}`);

                const listings = [];
                for (const rowHtml of rows) {
                    const titleMatch = rowHtml.match(/class="Tahoma17Blacknounder"[^>]*>([\s\S]*?)<\/a>/);
                    const titleRaw = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '';

                    if (titleRaw) {
                        listings.push(titleRaw);
                    }
                }

                console.log(`Refined Listings Found: ${listings.length}`);
                if (listings.length > 0) {
                    console.log("First 3 titles:");
                    listings.slice(0, 3).forEach(t => console.log(`- ${t}`));
                }

                // Check for "No Results" text often found in these sites
                if (data.includes("No se encontraron resultados") || data.includes("No Records Found")) {
                    console.log("WARN: Page contains 'No Records Found' text.");
                }

                resolve(listings);
            });
        });
    });
}

async function check() {
    console.log("Fetching Offset 0...");
    const p1 = await scrapeListPage('22', 0);
    const p1Titles = new Set(p1);

    console.log("Fetching Offset 2000...");
    const p2 = await scrapeListPage('22', 2000);

    // Check for overlap
    const duplicates = p2.filter(t => p1Titles.has(t));

    console.log(`\n--- Analysis ---`);
    console.log(`Offset 0 Count: ${p1.length}`);
    console.log(`Offset 2000 Count: ${p2.length}`);
    console.log(`Common Titles: ${duplicates.length}`);

    if (duplicates.length > 0) {
        console.log("DUPLICATES FOUND! The site is likely recycling listings or showing global featured ads.");
        duplicates.slice(0, 3).forEach(d => console.log(`- ${d}`));
    } else {
        console.log("No overlap found. These seem to be unique pages.");
    }
}

check();
