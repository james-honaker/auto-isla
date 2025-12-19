
import reliabilityData from '../../data/reliability.json';

// Type definitions for the JSON structure
type ModelInfo = {
    score: number;
    bad_years?: number[];
    warning?: string;
};

type MakeInfo = {
    score: number;
    models: Record<string, ModelInfo>;
};

type ReliabilityDB = Record<string, MakeInfo>;

// Cast the imported JSON
const RELIABILITY_DB = reliabilityData as ReliabilityDB;

export type ScoredResult = {
    score: number;
    reliability: number;
    dealScore: number;
    warning?: string;
    modelDetected?: string;
};

// Helper: Extract Model from Title
// e.g. "Toyota Corolla 2020" -> "Corolla"
// We use the keys in our reliability DB as the "known models" list for that make.
// Helper: Extract Model from Title
// e.g. "Toyota Corolla 2020" -> "Corolla"
// We use the keys in our reliability DB as the "known models" list for that make.
export function detectModel(make: string, title: string): string | null {
    if (!make || !title) return null;

    const makeInfo = RELIABILITY_DB[make];
    if (!makeInfo || !makeInfo.models) return null;

    const titleLower = title.toLowerCase();

    // Check each known model for that make
    // e.g. Check if "corolla" is in "Toyota Corolla LE"
    const knownModels = Object.keys(makeInfo.models);

    // Sort by length desc so we match "CX-5" before "CX" if that existed
    knownModels.sort((a, b) => b.length - a.length);

    for (const model of knownModels) {
        // console.log(`Checking ${model} in ${titleLower}`);
        if (titleLower.includes(model.toLowerCase())) {
            return model;
        }
    }
    return null;
}

export function calculateScore(car: {
    make?: string;
    title?: string;
    price: number;
    year: number;
    mileage: number;
    created_at?: string;
}): ScoredResult {
    const { make, title, price, year, mileage } = car;

    // --- 1. Reliability Score ---
    let reliabilityScore = 5; // Default average
    let warning: string | undefined = undefined;
    let modelName: string | undefined = undefined;

    if (make && RELIABILITY_DB[make]) {
        const makeInfo = RELIABILITY_DB[make];
        reliabilityScore = makeInfo.score; // Start with brand score

        // Try to identify model
        const detected = detectModel(make, title || '');
        if (detected) {
            modelName = detected;
            const modelInfo = makeInfo.models[detected];

            if (modelInfo) {
                // If we found a model-specific score, average it with the make score
                // or just use it? Let's use it, it's more specific.
                reliabilityScore = modelInfo.score;

                // CHECK FOR BAD YEARS
                if (modelInfo.bad_years && modelInfo.bad_years.includes(year)) {
                    reliabilityScore = 1; // Severe Penalty
                    warning = `Avoid: Known Issues in ${year} (e.g. ${modelInfo.warning || 'Reliability'})`;
                } else if (modelInfo.warning) {
                    // It's a risky model but maybe not a bad year? 
                    // Or maybe we treat the warning as general info.
                    // For now, only warn on bad years or if score is low.
                }
            }
        }
    }

    // --- 2. Deal Score (Price/Value) ---
    // Simple heuristic needs to be realistic.
    // 2020+ car for < $15k is amazing. 2005 car for $15k is bad.
    // We can't build a full market values DB yet.
    // Let's stick to the simple tiered buckets for now but adjust for year slightly.
    let dealScore = 5;
    if (price > 100) { // filter out $0 or $1 placeholders
        // Base baseline: $18,000
        let baseline = 18000;

        // Adjust baseline by year
        // 2025 = +$10k, 2000 = -$10k
        const currentYear = new Date().getFullYear();
        const age = currentYear - year;
        baseline -= (age * 800); // Depreciate $800/yr roughly

        // Min baseline $3000
        baseline = Math.max(3000, baseline);

        // Ratio: Price / Baseline
        const ratio = price / baseline;

        if (ratio < 0.6) dealScore = 10; // 40% under market
        else if (ratio < 0.8) dealScore = 9;
        else if (ratio < 0.9) dealScore = 8;
        else if (ratio < 1.0) dealScore = 7; // Fair
        else if (ratio < 1.1) dealScore = 6;
        else if (ratio < 1.3) dealScore = 5;
        else if (ratio < 1.5) dealScore = 3;
        else dealScore = 1;
    }

    // --- 3. Mileage Score ---
    let mileageScore = 5;
    if (year > 1990 && mileage > 0) {
        const age = Math.max(1, new Date().getFullYear() - year);
        const avgMiles = age * 12000;

        if (mileage < avgMiles * 0.5) mileageScore = 10;
        else if (mileage < avgMiles * 0.8) mileageScore = 8;
        else if (mileage < avgMiles * 1.0) mileageScore = 7;
        else if (mileage < avgMiles * 1.2) mileageScore = 5;
        else if (mileage < avgMiles * 1.5) mileageScore = 3;
        else mileageScore = 1;
    }

    // --- 4. Freshness ---
    let freshnessBonus = 0;
    if (car.created_at) {
        const created = new Date(car.created_at).getTime();
        const hoursDiff = (Date.now() - created) / (3600 * 1000);
        if (hoursDiff < 48) freshnessBonus = 10; // Boost recent listings
    }

    // --- TOTAL CALCULATION ---
    // If Reliability is 1 (Avoid), the total score tanked effectively.
    // We explicitly cap the total score if reliability is critical.

    const weights = { rel: 0.5, deal: 0.3, mile: 0.2 };
    let total = (reliabilityScore * 10 * weights.rel) +
        (dealScore * 10 * weights.deal) +
        (mileageScore * 10 * weights.mile);

    total += freshnessBonus;

    if (reliabilityScore <= 2) {
        total = Math.min(total, 45); // Cap score for unreliable cars
        if (!warning) warning = "Low Reliability Score";
    }

    return {
        score: Math.round(Math.min(100, Math.max(1, total))),
        reliability: reliabilityScore,
        dealScore,
        warning,
        modelDetected: modelName
    };
}
