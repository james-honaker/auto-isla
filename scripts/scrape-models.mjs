import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, '../data');
const MAKES_FILE = path.join(OUTPUT_DIR, 'makes.json');
const MODELS_FILE = path.join(OUTPUT_DIR, 'models.json');

// Top 10 Popular Makes in PR (IDs mapped from makes.json)
const TARGET_MAKES = [
    "49", // Toyota
    "21", // Honda
    "36", // Nissan
    "22", // Hyundai
    "27", // Kia
    "18", // Ford
    "35", // Mitsubishi
    "26", // Jeep
    "32"  // Mazda
];

async function scrapeModels() {
    console.log('Reading makes.json...');
    const makes = JSON.parse(fs.readFileSync(MAKES_FILE, 'utf-8'));
    const modelsByMake = {};

    for (const makeId of TARGET_MAKES) {
        const makeName = makes.find(m => m.id === makeId)?.name || makeId;
        console.log(`Fetching models for ${makeName} (ID: ${makeId})...`);

        // Note: Analysis suggests the site uses query params to pre-fill dynamic selects or standard form structure.
        // We will try fetching the Advanced Search page with the Marca param set.
        // URL: https://www.clasificadosonline.com/TransportationADV.asp?Marca={ID}
        // If this doesn't populate 'Modelo', we might need to hit the search result page to see filters, 
        // but let's try this standard pattern first.

        const url = `https://www.clasificadosonline.com/TransportationADV.asp?Marca=${makeId}`;

        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                }
            });

            if (!response.ok) {
                console.error(`Failed to fetch ${makeName}: ${response.status}`);
                continue;
            }

            const html = await response.text();

            // Regex to find the <select name="Modelo"> ... </select> block
            const modelsMatch = html.match(/<select[^>]*name="Modelo"[^>]*>([\s\S]*?)<\/select>/i);

            if (!modelsMatch) {
                console.warn(`No 'Modelo' dropdown found for ${makeName}. Might require JS execution.`);
                continue;
            }

            const modelRegex = /<option value="(\d+)">([^<]+)<\/option>/g;
            let match;
            const models = [];

            while ((match = modelRegex.exec(modelsMatch[1])) !== null) {
                const id = match[1];
                const name = match[2].trim();
                // Filter out placeholders
                if (id !== '0' && name !== '') {
                    models.push({ id, name });
                }
            }

            console.log(`  Found ${models.length} models for ${makeName}.`);
            modelsByMake[makeId] = {
                makeName,
                models
            };

            // Be nice to the server
            await new Promise(r => setTimeout(r, 1000));

        } catch (error) {
            console.error(`Error processing ${makeName}:`, error);
        }
    }

    fs.writeFileSync(MODELS_FILE, JSON.stringify(modelsByMake, null, 2));
    console.log(`Saved models to ${MODELS_FILE}`);
}

scrapeModels().catch(console.error);
