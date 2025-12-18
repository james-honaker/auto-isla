export type CarListing = {
    title: string;
    price: number;
    year: number;
    mileage: number;
    location: string;
    imgUrl: string;
    linkUrl: string;
    make?: string;
};

// Helper to clean price string (e.g., "$19,000" -> 19000)
function parsePrice(priceStr: string) {
    if (!priceStr) return 0;
    const val = parseInt(priceStr.replace(/[^0-9]/g, ''), 10);
    return isNaN(val) ? 0 : val;
}

// Helper to extract year from text (e.g., "Toyota Corolla 2020" -> 2020)
function parseYear(text: string) {
    if (!text) return 0;
    const match = text.match(/\b(19|20)\d{2}\b/);
    return match ? parseInt(match[0], 10) : 0;
}

// Helper to parse mileage
function parseMileage(text: string) {
    if (!text) return 0;
    // Look for number after "Millas" or just a number if clear
    const match = text.replace(/,/g, '').match(/(\d+)/);
    return match ? parseInt(match[0], 10) : 0;
}

export async function scrapeListings(makeId: string, quantity = 10): Promise<CarListing[]> {
    console.log(`[Server] Scraping Make ID: ${makeId}...`);

    // Construct URL for specific Make, Type=Autos
    const url = `https://www.clasificadosonline.com/UDTransListingADV.asp?Marca=${makeId}&TipoC=1&Submit2=Buscar+-+Go`;

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
            },
            next: { revalidate: 0 } // Don't cache for now
        });

        if (!response.ok) {
            console.error(`Scrape failed: ${response.status}`);
            return [];
        }

        const html = await response.text();

        // Strategy: Split by the specific row tag
        const rowDelimiter = '<tr align="center" valign="middle">';
        const rows = html.split(rowDelimiter);
        rows.shift(); // Remove content before first listing

        const listings: CarListing[] = [];

        for (const rowHtml of rows) {
            // Title
            const titleMatch = rowHtml.match(/class="Tahoma17Blacknounder"[^>]*>([\s\S]*?)<\/a>/);
            const titleRaw = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '';

            // Link
            const linkMatch = rowHtml.match(/href="(\/UDTransDetail\.asp\?AutoNumAnuncio=[^"]+)"/);
            const linkUrl = linkMatch ? `https://www.clasificadosonline.com${linkMatch[1]}` : '';

            if (!titleRaw || !linkUrl) continue;

            // Price
            const priceMatch = rowHtml.match(/class="Tahoma14BrownNound"[^>]*>([\s\S]*?)<\/span>/);
            const priceRaw = priceMatch ? priceMatch[1].replace(/<[^>]+>/g, '').trim() : '';

            // Mileage
            // Check for 'Millas' specifically
            const mileageMatch = rowHtml.match(/class="Tahoma14DbluenoUnd"[^>]*>(\s*Millas[\s\S]*?)<\/span>/i);
            const mileageRaw = mileageMatch ? mileageMatch[1].replace(/<[^>]+>/g, '').trim() : '';

            // Location
            const locationMatch = rowHtml.match(/class="tahoma14hbluenoUnder"[^>]*>([\s\S]*?)<\/span>/);
            const locationRaw = locationMatch ? locationMatch[1].replace(/<[^>]+>/g, '').trim() : '';

            // Image
            const imgMatch = rowHtml.match(/<img[^>]+src="([^">]+)"/);
            const imgUrl = imgMatch ? imgMatch[1] : '';

            const price = parsePrice(priceRaw);
            const year = parseYear(titleRaw);
            const mileage = parseMileage(mileageRaw);

            if (linkUrl && titleRaw) {
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

        return listings;

    } catch (error) {
        console.error('Error scraping listings:', error);
        return [];
    }
}
