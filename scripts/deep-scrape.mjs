
import Database from 'better-sqlite3';

const db = new Database('data/listings.db');

db.exec(`
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

const upsertStmt = db.prepare(`
    INSERT INTO listings (id, make, model, title, price, year, mileage, location, img_url, link_url, updated_at)
    VALUES (@id, @make, @model, @title, @price, @year, @mileage, @location, @img_url, @link_url, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
        price = excluded.price,
        updated_at = CURRENT_TIMESTAMP
`);

const BUYERS_LIST = [
    { id: "49", name: "Toyota" },
    { id: "21", name: "Honda" },
    { id: "36", name: "Nissan" },
    { id: "22", name: "Hyundai" },
    { id: "27", name: "Kia" },
    { id: "18", name: "Ford" },
    { id: "35", name: "Mitsubishi" },
    { id: "10", name: "Chevrolet" },
    { id: "32", name: "Mazda" }
];

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

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function scrapePage(makeId, makeName, offset) {
    const url = `https://www.clasificadosonline.com/UDTransListingADV.asp?Marca=${makeId}&TipoC=1&Submit2=Buscar+-+Go&offset=${offset}`;

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        const html = await response.text();

        const rowDelimiter = '<tr align="center" valign="middle">';
        const rows = html.split(rowDelimiter);
        rows.shift();

        let count = 0;

        for (const rowHtml of rows) {
            const linkMatch = rowHtml.match(/href="(\/UDTransDetail\.asp\?AutoNumAnuncio=[^"]+)"/);
            const linkUrl = linkMatch ? `https://www.clasificadosonline.com${linkMatch[1]}` : '';

            if (!linkUrl) continue;

            const titleMatch = rowHtml.match(/class="Tahoma17Blacknounder"[^>]*>([\s\S]*?)<\/a>/);
            const titleRaw = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '';

            const priceMatch = rowHtml.match(/class="Tahoma14BrownNound"[^>]*>([\s\S]*?)<\/span>/);
            const priceRaw = priceMatch ? priceMatch[1].replace(/<[^>]+>/g, '').trim() : '';

            const mileageMatch = rowHtml.match(/class="Tahoma14DbluenoUnd"[^>]*>(\s*Millas[\s\S]*?)<\/span>/i);
            const mileageRaw = mileageMatch ? mileageMatch[1].replace(/<[^>]+>/g, '').trim() : '';

            const locationMatch = rowHtml.match(/class="tahoma14hbluenoUnder"[^>]*>([\s\S]*?)<\/span>/);
            const locationRaw = locationMatch ? locationMatch[1].replace(/<[^>]+>/g, '').trim() : '';

            const imgMatch = rowHtml.match(/<img[^>]+src="([^">]+)"/);
            const imgUrl = imgMatch ? imgMatch[1] : '';

            upsertStmt.run({
                id: linkUrl,
                make: makeName,
                model: '',
                title: titleRaw,
                price: parsePrice(priceRaw),
                year: parseYear(titleRaw),
                mileage: parseMileage(mileageRaw),
                location: locationRaw,
                img_url: imgUrl,
                link_url: linkUrl
            });
            count++;
        }
        return count;

    } catch (e) {
        console.error(`Error on ${makeName} page ${offset}:`, e);
        return 0;
    }
}

async function runBackfill() {
    console.log("Starting Deep Scrape Backfill...");
    const MAX_PAGES = 15;

    for (const brand of BUYERS_LIST) {
        console.log(`Processing ${brand.name}...`);

        for (let i = 0; i < MAX_PAGES; i++) {
            const offset = i * 30;
            process.stdout.write(`  Page ${i + 1} (offset ${offset}) ... `);

            const count = await scrapePage(brand.id, brand.name, offset);
            console.log(`Found ${count} listings.`);

            if (count === 0) {
                console.log(`  No more results for ${brand.name}.`);
                break;
            }

            await sleep(1500);
        }
    }
    console.log("Backfill Complete!");
}

runBackfill();
