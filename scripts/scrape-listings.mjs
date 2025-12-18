import fs from 'fs';
import path from 'path';

// Helper to clean price string (e.g., "$19,000" -> 19000)
function parsePrice(priceStr) {
    if (!priceStr) return 0;
    return parseInt(priceStr.replace(/[^0-9]/g, ''), 10);
}

// Helper to extract year from text (e.g., "Toyota Corolla 2020" -> 2020)
function parseYear(text) {
    if (!text) return 0;
    const match = text.match(/\b(19|20)\d{2}\b/);
    return match ? parseInt(match[0], 10) : 0;
}

// Helper to parse mileage (e.g., "Millas 66000" -> 66000)
function parseMileage(text) {
    if (!text) return 0;
    const match = text.replace(/,/g, '').match(/(\d+)/);
    return match ? parseInt(match[0], 10) : 0;
}

async function scrapeListings(makeId, quantity = 5) {
    console.log(`Scraping Make ID: ${makeId}...`);

    // Construct URL for specific Make, Type=Autos
    const url = `https://www.clasificadosonline.com/UDTransListingADV.asp?Marca=${makeId}&TipoC=1&Submit2=Buscar+-+Go`;

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const html = await response.text();

        // Strategy: Split by the specific row tag to distinguish listing blocks
        // The listings always start with this specific TR signature
        const rowDelimiter = '<tr align="center" valign="middle">';
        const rows = html.split(rowDelimiter);

        // Remove the first chunk (header/content before first listing)
        rows.shift();

        const listings = [];

        for (const rowHtml of rows) {
            // Stop if we see something that indicates the end of listings table (optional safety)
            // But usually the split is safe enough as long as we validate content.

            // Extract Title/Name (Year often here)
            // <a ... class="Tahoma17Blacknounder">...</a>
            // Note: Use [^>]* in case of extra attributes, and [\s\S]*? for multiline content
            const titleMatch = rowHtml.match(/class="Tahoma17Blacknounder"[^>]*>([\s\S]*?)<\/a>/);
            const titleRaw = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '';

            // Extract Detail Link
            const linkMatch = rowHtml.match(/href="(\/UDTransDetail\.asp\?AutoNumAnuncio=[^"]+)"/);
            const linkUrl = linkMatch ? `https://www.clasificadosonline.com${linkMatch[1]}` : '';

            // If no title or link, it's likely not a listing row (or end of file junk)
            if (!titleRaw || !linkUrl) continue;

            // Extract Price
            const priceMatch = rowHtml.match(/class="Tahoma14BrownNound"[^>]*>([\s\S]*?)<\/span>/);
            const priceRaw = priceMatch ? priceMatch[1].replace(/<[^>]+>/g, '').trim() : '';

            // Extract Mileage
            // Look for span specifically containing "Millas" or use the second occurrence of the class if necessary
            // But checking for 'Millas' is safer.
            // HTML: <span class="Tahoma14DbluenoUnd"> Millas 66000</span>
            const mileageMatch = rowHtml.match(/class="Tahoma14DbluenoUnd"[^>]*>(\s*Millas[\s\S]*?)<\/span>/i);
            const mileageRaw = mileageMatch ? mileageMatch[1].replace(/<[^>]+>/g, '').trim() : '';

            // Extract Location
            const locationMatch = rowHtml.match(/class="tahoma14hbluenoUnder"[^>]*>([\s\S]*?)<\/span>/);
            const locationRaw = locationMatch ? locationMatch[1].replace(/<[^>]+>/g, '').trim() : '';

            // Extract Image URL
            const imgMatch = rowHtml.match(/<img[^>]+src="([^">]+)"/);
            const imgUrl = imgMatch ? imgMatch[1] : '';

            const price = parsePrice(priceRaw);
            const year = parseYear(titleRaw);
            const mileage = parseMileage(mileageRaw);

            // Basic validation
            if (price > 0 && linkUrl && titleRaw) {
                listings.push({
                    title: titleRaw,
                    price,
                    year,
                    mileage,
                    location: locationRaw,
                    imgUrl,
                    linkUrl
                });
            }

            if (listings.length >= quantity) break;
        }

        console.log(`Found ${listings.length} listings.`);
        return listings;

    } catch (error) {
        console.error('Error scraping listings:', error);
        return [];
    }
}

// Test run if executed directly
// Node arguments: node scrape-listings.mjs [MakeID]
const makeIdArg = process.argv[2] || '49'; // Default Toyota

scrapeListings(makeIdArg, 5).then(data => {
    console.log(JSON.stringify(data, null, 2));
});
