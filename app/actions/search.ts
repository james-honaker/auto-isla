'use server';

import { scrapeListings } from "../lib/scraper";
import { calculateScore } from "../lib/scoring";
import { upsertListing, getListingsByMake, DBListing } from "../lib/db";

export type ScoredListing = {
    listing: DBListing;
    score: number;
    reliability: number;
    dealScore: number;
    isFresh: boolean;
};

export async function findBestDeals(makeId: string, makeName: string): Promise<ScoredListing[]> {
    console.log(`Searching best deals for ${makeName} (${makeId})...`);

    // 1. Scrape Listings (Real-time)
    // We scrape first to update the DB with latest data
    try {
        const rawListings = await scrapeListings(makeId, 20);

        // 2. Upsert into DB
        for (const listing of rawListings) {
            upsertListing({
                id: listing.linkUrl, // Use URL as unique ID
                make: makeName,
                model: '', // Scraper doesn't parse model robustly yet
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
        console.error("Scraping failed, falling back to DB only", e);
    }

    // 3. Fetch from DB (Historic + New)
    // This gives us the persistent view
    const dbListings = getListingsByMake(makeName, 50);

    // 4. Score Listings
    const scoredListings = dbListings.map(listing => {
        // Hydrate listing with Make info for reliability lookup
        const { score, reliability, dealScore } = calculateScore(listing);

        // Determine freshness (created < 24h ago)
        const isFresh = listing.created_at
            ? (Date.now() - new Date(listing.created_at).getTime()) < (24 * 60 * 60 * 1000)
            : false;

        return {
            listing,
            score,
            reliability,
            dealScore,
            isFresh
        };
    });

    // 3. Sort by Smart Score (Descending)
    scoredListings.sort((a, b) => b.score - a.score);

    return scoredListings;
}
