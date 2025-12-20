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
    // Fix: Require '$' symbol to avoid parsing years (e.g. "2024") as prices
    if (!priceStr.includes('$')) return 0;
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

// Scrape a specific page of listings for a given Make
export async function scrapeListPage(makeId: string, offset = 0, extraParams?: string): Promise<{ listings: CarListing[], nextOffset: number | null }> {
    console.log(`[Server] Scraping Make ID: ${makeId} (Offset: ${offset}, Extra: ${extraParams || ''})...`);

    // Construct URL for specific Make, Type=Autos, with Offset
    const url = `https://www.clasificadosonline.com/UDTransListingADV.asp?Marca=${makeId}&TipoC=1&Submit2=Buscar+-+Go&offset=${offset}${extraParams || ''}`;

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
            },
            // next: { revalidate: 0 } // Don't cache for now - Removed for TS-Node compatibility
        });

        if (!response.ok) {
            console.error(`Scrape failed: ${response.status}`);
            return { listings: [], nextOffset: null };
        }

        const arrayBuffer = await response.arrayBuffer();
        const decoder = new TextDecoder('windows-1252');
        const html = decoder.decode(arrayBuffer);

        // Strategy: Split by the specific row tag
        const rowDelimiter = '<tr align="center" valign="middle">';
        const rows = html.split(rowDelimiter);
        rows.shift(); // Remove content before first listing

        const listings: CarListing[] = [];

        for (const rowHtml of rows) {
            // Extract Title First to check for whitelist keywords
            const titleMatch = rowHtml.match(/class="Tahoma17Blacknounder"[^>]*>([\s\S]*?)<\/a>/);
            const titleRaw = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '';

            // Filter out Ads/Featured listings based on background color or keywords
            // Common Ad colors: #F7FAFD (Featured top), #FFFFCC (Highlighted/Yellow)
            // Use Regex for case-insensitive hex code matching (e.g. #fffFCC)
            // But ALLOW if title contains 'ioniq' (Highlighted real listings)
            const isAdColor = /bgcolor="?(#F7FAFD|#FFFFCC|#FFFF99)"?/i.test(rowHtml);

            if (isAdColor && !titleRaw.toLowerCase().includes('ioniq')) {
                continue;
            }

            // Title (already extracted)

            // Link

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
            let imgUrl = '';
            const imgMatch = rowHtml.match(/<img[^>]+src=["'](https?:\/\/[^"']+)["']/i);
            if (imgMatch) {
                imgUrl = imgMatch[1];
            } else {
                // 2. Fallback: Try relative path in meta itemprop="image" content
                const metaMatch = rowHtml.match(/<meta[^>]+itemprop=["']image["'][^>]+content=["'](\/[^"']+)["']/i);
                if (metaMatch) {
                    imgUrl = `https://imgcache.clasificadosonline.com${metaMatch[1]}`;
                }
            }

            let price = parsePrice(priceRaw);

            // Fallback: Parse price from title if 0 or missing
            // FIX: Require '$' sign to avoid matching years (e.g. 2024)
            if (price === 0) {
                const titlePrice = titleRaw.match(/\$\s?(\d{1,3}(,\d{3})+|\d{4,})/);
                if (titlePrice) {
                    price = parseInt(titlePrice[1].replace(/,/g, ''), 10);
                }
            }

            const year = parseYear(titleRaw);
            const mileage = parseMileage(mileageRaw);

            // Detect correct model from title (Advanced Classification)
            let detectedModel = 'Unknown';
            const t = titleRaw.toLowerCase();

            // Hyundai Ioniq Specific Logic
            if (t.includes('ioniq 5') || t.includes('ionic 5') || t.includes('ionic 5')) detectedModel = 'Ioniq 5';
            else if (t.includes('ioniq 6') || t.includes('ionic 6')) detectedModel = 'Ioniq 6';
            else if (t.includes('hybrid') || t.includes('hibrido')) detectedModel = 'Ioniq Hybrid';
            else if (t.includes('ioniq') || t.includes('ionic')) detectedModel = 'Ioniq'; // Generic fallback

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
                    // @ts-ignore - appending dynamic property for sync script usage
                    modelDetected: detectedModel
                });
            }
        }

        // Find "Proximos" (Next) link using robust reverse-lookup
        // Structure: <a href="...">...<img ... alt="Proximos">...</a>
        // We find the image first, then look backwards for the opening <a> tag.
        const imgRegex = /<img[^>]+alt="Proximos"/i;
        const imgMatch = html.match(imgRegex);
        let nextOffset: number | null = null;

        if (imgMatch && imgMatch.index !== undefined) {
            const imgIndex = imgMatch.index;
            const searchWindow = html.substring(Math.max(0, imgIndex - 1000), imgIndex);
            const lastAnchorIndex = searchWindow.lastIndexOf("<a ");

            if (lastAnchorIndex !== -1) {
                const anchorTag = searchWindow.substring(lastAnchorIndex);
                const hrefMatch = anchorTag.match(/href="([^"]+)"/i);
                if (hrefMatch) {
                    const relativeUrl = hrefMatch[1];
                    const match = relativeUrl.match(/offset=(\d+)/i);
                    if (match) {
                        nextOffset = parseInt(match[1], 10);
                    }
                }
            }
        }

        return { listings, nextOffset };

    } catch (error) {
        console.error('Error scraping listings:', error);
        return { listings: [], nextOffset: null };
    }
}

// Scrape ALL pages until empty
export async function scrapeAllListings(makeId: string, extraParams?: string): Promise<CarListing[]> {
    let allListings: CarListing[] = [];
    let currentOffset: number | null = 0;

    // Safety limit
    let pagesScraped = 0;
    const MAX_PAGES = 500; // ~15,000 listings, plenty for any brand

    while (currentOffset !== null && pagesScraped < MAX_PAGES) {
        const { listings, nextOffset } = await scrapeListPage(makeId, currentOffset, extraParams);

        if (listings.length === 0) {
            break;
        }

        allListings = [...allListings, ...listings];
        currentOffset = nextOffset;
        pagesScraped++;

        // Polite delay
        await new Promise(r => setTimeout(r, 200));
    }

    return allListings;
}

// For backward compatibility (shallow scrape)
export async function scrapeListings(makeId: string, quantity = 50): Promise<CarListing[]> {
    // Just fetch page 0
    const { listings } = await scrapeListPage(makeId, 0);
    return listings;
}
