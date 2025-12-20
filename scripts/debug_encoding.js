const https = require('https');

const url = 'https://www.clasificadosonline.com/UDTransListingADV.asp?Marca=22&Submit2=Buscar+-+Go&offset=0';

console.log(`Fetching HEADERS for ${url}...`);

https.get(url, {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    }
}, (res) => {
    console.log('--- HEADERS ---');
    console.log(JSON.stringify(res.headers, null, 2));

    const chunks = [];
    res.on('data', chunk => chunks.push(chunk));
    res.on('end', () => {
        const buffer = Buffer.concat(chunks);

        // Try decoding as UTF-8
        const utf8 = buffer.toString('utf8');
        console.log('\n--- UTF-8 PREVIEW (First 500 chars) ---');
        console.log(utf8.substring(0, 500));

        // Look for common Spanish characters in standard listings to see if they break
        const match = utf8.match(/m(?:||ï¿½)s/i); // Looking for broken "más"
        if (match) {
            console.log('\n[!] Found broken character sequence:', match[0]);
        }

        // Check for specific known broken title "El ms nuevo!"
        if (utf8.includes('ms nuevo') || utf8.includes('ms')) {
            console.log('\n[!] Confirmed broken "más" symbol found in UTF-8 output.');
        }
    });
}).on('error', console.error);
