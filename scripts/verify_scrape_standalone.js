const https = require('https');

// Helper to clean price string
function parsePrice(priceStr) {
    if (!priceStr) return 0;
    const val = parseInt(priceStr.replace(/[^0-9]/g, ''), 10);
    return isNaN(val) ? 0 : val;
}

// Scrape Logic (Re-implemented for standalone script)
function scrapeListings(makeId, quantity, offset = 0) {
    return new Promise((resolve, reject) => {
        const url = `https://www.clasificadosonline.com/UDTransListingADV.asp?Marca=${makeId}&TipoC=1&Submit2=Buscar+-+Go&offset=${offset}`;

        console.log(`Fetching ${url}...`);

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

                const listings = [];
                for (const rowHtml of rows) {
                    const titleMatch = rowHtml.match(/class="Tahoma17Blacknounder"[^>]*>([\s\S]*?)<\/a>/);
                    const titleRaw = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '';

                    const priceMatch = rowHtml.match(/class="Tahoma14BrownNound"[^>]*>([\s\S]*?)<\/span>/);
                    const priceRaw = priceMatch ? priceMatch[1].replace(/<[^>]+>/g, '').trim() : '';

                    if (titleRaw) {
                        listings.push({
                            title: titleRaw,
                            price: parsePrice(priceRaw)
                        });
                    }
                    if (listings.length >= quantity) break;
                }
                resolve(listings);
            });
        }).on('error', reject);
    });
}

async function verify() {
    console.log("Scraping Hyundai (ID 22) Page 1 (Offset 0)...");
    const p1 = await scrapeListings('22', 50, 0);
    console.log(`Page 1: ${p1.length} listings.`);

    console.log("Scraping Hyundai (ID 22) Page 2 (Offset 30)...");
    const p2 = await scrapeListings('22', 50, 30);
    console.log(`Page 2 (Offset 30): ${p2.length} listings.`);

    console.log("Scraping Hyundai (ID 22) Page 2 (Offset 50)...");
    const p3 = await scrapeListings('22', 50, 50);
    console.log(`Page 2 (Offset 50): ${p3.length} listings.`);

    const all = [...p1, ...p2, ...p3];
    // Check for overlap between p2 and p3?
    if (p2[0].title === p3[0].title) console.log("Overlap detected!");

    const ioniqs = all.filter(l => l.title.toLowerCase().includes('ioniq') || l.title.toLowerCase().includes('ionic'));
    console.log(`\nFound ${ioniqs.length} Ioniq listings in check:`);

    ioniqs.forEach(l => {
        console.log(`- ${l.title} ($${l.price})`);
    });
}

verify();
