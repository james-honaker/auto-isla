import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, '../data');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'makes.json');

// Ensure output dir exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function scrapeMakes() {
    console.log('Fetching TAutos.asp...');
    const response = await fetch('https://www.clasificadosonline.com/TAutos.asp', {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
        }
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();
    console.log(`Fetched ${html.length} bytes. Parsing...`);

    // Regex to find the <select name="Marca"> ... </select> block (simplified)
    // We'll look for <option value="ID">NAME</option> patterns
    // Note: This matches the "Marca" dropdown options typically found in ASP forms
    const makeRegex = /<option value="(\d+)">([^<]+)<\/option>/g;

    // We need to narrow it down to the regex specific to the Marca dropdown to avoid other dropdowns.
    // The Marca dropdown usually starts after a label or explicitly inside <select ... id="Marca" ...>
    // Let's try to extract the specific select block first.
    const selectBlockMatch = html.match(/<select[^>]*name="Marca"[^>]*>([\s\S]*?)<\/select>/i);

    if (!selectBlockMatch) {
        console.error('Could not find "Marca" select element.');
        return;
    }

    const selectContent = selectBlockMatch[1];
    const makes = [];
    let match;

    while ((match = makeRegex.exec(selectContent)) !== null) {
        const id = match[1];
        const name = match[2].trim();

        // Filter out "All" or empty options if any
        if (id !== '0' && name !== '') {
            makes.push({ id, name });
        }
    }

    console.log(`Found ${makes.length} makes.`);
    console.log(makes.slice(0, 5)); // Preview

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(makes, null, 2));
    console.log(`Saved to ${OUTPUT_FILE}`);
}

scrapeMakes().catch(console.error);
