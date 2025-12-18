import reliabilityData from '../../data/reliability.json';

type CarListing = {
    make?: string;
    model?: string;
    price: number;
    year: number;
    mileage: number;
};

// Reliability Map (Tier S=10, Tier C=4)
const reliabilityMap: Record<string, number> = reliabilityData;

export function calculateScore(car: CarListing): { score: number; reliability: number; dealScore: number } {
    const { make, price, year, mileage } = car;

    // 1. Reliability Score (0-10)
    // Default to 5 if unknown
    const reliability = reliabilityMap[make || ''] || 5;

    // 2. Price/Value Score (0-10)
    // Heuristic: Lower is better, but contextual to year.
    // Simple baseline: $20k is "average" (5/10). $5k is great (10/10). $50k is poor (1/10).
    // This is very rough and should eventually compare against market average for that model.
    let dealScore = 0;
    if (price > 0) {
        if (price < 5000) dealScore = 10;
        else if (price < 10000) dealScore = 9;
        else if (price < 15000) dealScore = 8;
        else if (price < 20000) dealScore = 7;
        else if (price < 25000) dealScore = 6;
        else if (price < 35000) dealScore = 5;
        else dealScore = 4 - Math.floor((price - 35000) / 10000);
    }
    dealScore = Math.max(1, Math.min(10, dealScore));

    // 3. Mileage Factor (Penalty)
    // 12k miles/year is avg. 
    // If mileage < (2025 - year) * 10000, it's low mileage (Bonus).
    let mileageScore = 5;
    if (mileage > 0 && year > 1990) {
        const age = new Date().getFullYear() - year;
        const expectedMileage = age * 12000;
        if (mileage < expectedMileage * 0.5) mileageScore = 10; // Very low
        else if (mileage < expectedMileage * 0.8) mileageScore = 8; // Low
        else if (mileage > expectedMileage * 1.5) mileageScore = 2; // High
        else if (mileage > expectedMileage * 2.0) mileageScore = 1; // Very High
    }

    // 4. Freshness Boost (Persistence Bonus)
    // If the car was "created_at" in DB within the last 24 hours (or passed as fresh), add bonus.
    // We assume 'car' object might have a createdAt date string.
    let freshnessScore = 0;
    // @ts-ignore - Assuming we extend the type in implementation or passed loosely
    if (car.created_at) {
        // @ts-ignore
        const created = new Date(car.created_at).getTime();
        const now = Date.now();
        const hoursDiff = (now - created) / (1000 * 60 * 60);
        if (hoursDiff < 24) {
            freshnessScore = 20; // Massive boost for "Just Listed"
        }
    }

    // Weighted Total Score (0-100) + Bonus
    // Reliability: 40%
    // Deal/Price: 40%
    // Mileage: 20%
    const baseScore = (reliability * 4) + (dealScore * 4) + (mileageScore * 2);
    const totalScore = Math.min(100, baseScore + freshnessScore);

    return {
        score: Math.round(totalScore), // 0-100
        reliability,
        dealScore
    };
}
