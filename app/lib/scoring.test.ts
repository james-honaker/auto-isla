import { calculateScore } from './scoring';
import { DBListing } from './db';

const mockListing: any = {
    price: 20000,
    year: 2020,
    mileage: 50000,
    make: 'Toyota',
};

describe('Scoring Algorithm', () => {
    it('should give a high score for a reliable, low price, low mileage car', () => {
        const car = {
            ...mockListing,
            make: 'Toyota', // Tier S (Reliability 10) -> 40 pts
            price: 4000,   // < 5k (Deal 10) -> 40 pts
            year: 2022,
            mileage: 1000, // Very low (Mileage 10) -> 20 pts
            created_at: new Date().toISOString() // Fresh (+20 boost)
        };
        const result = calculateScore(car);
        // Base: 40 + 40 + 20 = 100. +20 boost = 120. Cap at 100.
        expect(result.score).toBe(100);
        expect(result.reliability).toBe(10);
    });

    it('should penalize high mileage', () => {
        const car = {
            ...mockListing,
            year: 2020,
            mileage: 200000, // Way above avg (5yr * 12k = 60k)
        };
        const result = calculateScore(car);
        // Mileage score should be low (1 or 2)
        // 20% of score is mileage.
        // If reliability is max (10->40) and price is avg (5->20), base is 60.
        // Mileage 1->2. Total 62.
        expect(result.score).toBeLessThan(80);
    });

    it('should boost fresh listings', () => {
        // Old listing
        const oldCar = {
            ...mockListing,
            created_at: '2020-01-01T00:00:00Z'
        };
        const oldScore = calculateScore(oldCar).score;

        // Fresh listing (same stats)
        const freshCar = {
            ...mockListing,
            created_at: new Date().toISOString()
        };
        const freshScore = calculateScore(freshCar).score;

        expect(freshScore).toBeGreaterThan(oldScore);
        // Should be exactly 20 points higher (unless capped)
        if (oldScore <= 80) {
            expect(freshScore).toBe(oldScore + 20);
        }
    });

    it('should handle unknown makes gracefully', () => {
        const car = { ...mockListing, make: 'UnknownBrand' };
        const result = calculateScore(car);
        expect(result.reliability).toBe(5); // Default
    });
});
