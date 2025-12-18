'use server';

import { scrapeListings } from "../lib/scraper";
import { calculateScore } from "../lib/scoring";
import { upsertListing, getListingsByMakes, DBListing } from "../lib/db";
import { ScoredListing } from "../lib/types";

// Helper to scrape a single make
async function updateMarketData(makeId: string, makeName: string) {
    try {
        const rawListings = await scrapeListings(makeId, 20); // Scrape top 20 fresh ones

        for (const listing of rawListings) {
            upsertListing({
                id: listing.linkUrl,
                make: makeName,
                model: '',
                title: listing.title,
                price: listing.price,
                year: listing.year,
                mileage: listing.mileage,
                location: listing.location,
                img_url: listing.imgUrl,
                link_url: listing.linkUrl
            });
        }
    } catch (e) {
        console.error(`Scraping failed for ${makeName}`, e);
    }
}

export async function searchDeals(makes: { id: string, name: string }[]): Promise<ScoredListing[]> {
    console.log(`Searching best deals for ${makes.map(m => m.name).join(', ')}...`);

    // 1. Scrape Listings (Parallel)
    // We limit parallel requests to avoid blasting the server if too many brands
    // But 9 is likely fine.
    await Promise.all(makes.map(m => updateMarketData(m.id, m.name)));

    // 2. Fetch from DB (Historic + New)
    const makeNames = makes.map(m => m.name);
    const dbListings = getListingsByMakes(makeNames, 20); // Get recent 20 from each (approx)

    // 3. Score Listings
    const scoredListings = dbListings.map(listing => {
        const { score, reliability, dealScore, warning, modelDetected } = calculateScore(listing);

        const isFresh = listing.created_at
            ? (Date.now() - new Date(listing.created_at).getTime()) < (24 * 60 * 60 * 1000)
            : false;

        return {
            listing,
            score,
            reliability,
            dealScore,
            isFresh,
            warning,
            modelDetected
        };
    });

    // 4. Sort by Smart Score (Descending)
    scoredListings.sort((a, b) => b.score - a.score);

    return scoredListings;
}
