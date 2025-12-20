import { scrapeListings } from "../app/lib/scraper";

async function verify() {
    console.log("Scraping Hyundai (ID 22) with limit 50...");
    const listings = await scrapeListings('22', 50);
    console.log(`\nFound ${listings.length} listings.`);

    const ioniqs = listings.filter((l: any) => l.title.toLowerCase().includes('ioniq') || l.title.toLowerCase().includes('ionic'));
    console.log(`Found ${ioniqs.length} Ioniq listings in the live scrape:`);

    ioniqs.forEach((l: any) => {
        console.log(`- ${l.title} ($${l.price})`);
    });
}

verify();
