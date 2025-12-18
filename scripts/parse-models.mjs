import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HTML_FILE = path.join(__dirname, '../temp_adv.html');
const MAKES_FILE = path.join(__dirname, '../data/makes.json');
const OUTPUT_FILE = path.join(__dirname, '../data/models.json');

function parseModels() {
    console.log('Reading temp_adv.html...');
    if (!fs.existsSync(HTML_FILE)) {
        console.error('Error: temp_adv.html not found. Run debug-html.mjs first.');
        process.exit(1);
    }
    const html = fs.readFileSync(HTML_FILE, 'utf-8');

    // Mappings
    const wajaIndexToMakeId = {};
    const modelsByMakeId = {};

    // 1. Find Make IDs: WAJA[197][0] = '49';
    const makeIdRegex = /WAJA\[(\d+)\]\[0\]\s*=\s*'(\d+)';/g;
    let match;
    while ((match = makeIdRegex.exec(html)) !== null) {
        const wajaIdx = match[1];
        const makeId = match[2];
        wajaIndexToMakeId[wajaIdx] = makeId;
        if (!modelsByMakeId[makeId]) {
            modelsByMakeId[makeId] = { makeId, models: [] };
        }
    }

    console.log(`Found ${Object.keys(wajaIndexToMakeId).length} WAJA Make entries.`);

    // 2. Find Model Names: WAJA[197][1][1] = 'Celica';
    // Pattern: WAJA[INDEX][MODEL_IDX][1] = 'NAME';
    // We also want Model ID if possible: WAJA[INDEX][MODEL_IDX][0] = 'ID';

    // Let's capture both in a simpler loop or separate regexes.
    // Since lines are separate, separate regex is safer.

    const modelNameRegex = /WAJA\[(\d+)\]\[(\d+)\]\[1\]\s*=\s*'([^']+)';/g;
    const modelIdRegex = /WAJA\[(\d+)\]\[(\d+)\]\[0\]\s*=\s*'(\d+)';/g;

    // We'll store temp models in a map: wajaIdx -> modelIdx -> { id, name }
    const tempModels = {};

    // Extract IDs first
    while ((match = modelIdRegex.exec(html)) !== null) {
        const [_, wIdx, mIdx, id] = match;
        if (!tempModels[wIdx]) tempModels[wIdx] = {};
        if (!tempModels[wIdx][mIdx]) tempModels[wIdx][mIdx] = {};
        tempModels[wIdx][mIdx].id = id;
    }

    // Extract Names
    while ((match = modelNameRegex.exec(html)) !== null) {
        const [_, wIdx, mIdx, name] = match;
        if (!tempModels[wIdx]) tempModels[wIdx] = {};
        if (!tempModels[wIdx][mIdx]) tempModels[wIdx][mIdx] = {};
        tempModels[wIdx][mIdx].name = name;
    }

    // Assemble final structure
    let totalModels = 0;
    for (const [wIdx, models] of Object.entries(tempModels)) {
        const makeId = wajaIndexToMakeId[wIdx];
        if (!makeId) continue; // Should not happen if parsing is correct

        for (const [mIdx, data] of Object.entries(models)) {
            if (data.name && data.id) {
                modelsByMakeId[makeId].models.push({
                    id: data.id,
                    name: data.name
                });
                totalModels++;
            }
        }
    }

    console.log(`Extracted ${totalModels} models across ${Object.keys(modelsByMakeId).length} makes.`);

    // Add Make Names if available
    if (fs.existsSync(MAKES_FILE)) {
        const makes = JSON.parse(fs.readFileSync(MAKES_FILE, 'utf-8'));
        const makesMap = Object.fromEntries(makes.map(m => [m.id, m.name]));

        for (const makeId of Object.keys(modelsByMakeId)) {
            modelsByMakeId[makeId].makeName = makesMap[makeId] || `Unknown (${makeId})`;
        }
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(modelsByMakeId, null, 2));
    console.log(`Saved to ${OUTPUT_FILE}`);
}

parseModels();
