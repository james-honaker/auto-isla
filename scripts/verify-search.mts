
// Mock strict mode for typescript
import { searchDeals } from '../app/actions/search';

async function run() {
    console.log("Testing searchDeals with Toyota (49) and Honda (21)...");
    const inputs = [
        { id: '49', name: 'Toyota' },
        { id: '21', name: 'Honda' }
    ];

    try {
        const results = await searchDeals(inputs);
        console.log(`Found ${results.length} results.`);
        if (results.length > 0) {
            console.log("Sample result:", JSON.stringify(results[0], null, 2));
        }
    } catch (e) {
        console.error("Error:", e);
    }
}

run();
