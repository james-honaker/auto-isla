import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// URL to debug (Results Page for Toyota)
const url = 'https://www.clasificadosonline.com/UDTransListingADV.asp?Marca=49&TipoC=1&Submit2=Buscar+-+Go';

async function downloadSource() {
    console.log(`Fetching ${url}...`);
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const html = await response.text();
        const outputPath = path.join(__dirname, '../temp_adv.html');

        fs.writeFileSync(outputPath, html, 'utf-8');
        console.log(`Saved HTML to ${outputPath}`);

    } catch (error) {
        console.error('Error:', error);
    }
}

downloadSource();
