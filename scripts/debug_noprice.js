const https = require('https');
const iconv = require('iconv-lite');

const url = 'https://www.clasificadosonline.com/UDTransListingADV.asp?Marca=22&Modelo=2079&Submit2=Buscar+-+Go';

console.log(`Fetching ${url}...`);

https.get(url, {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
}, (res) => {
    const chunks = [];
    res.on('data', chunk => chunks.push(chunk));
    res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const data = iconv.decode(buffer, 'win1252');

        const rowDelimiter = '<tr align="center" valign="middle">';
        const rows = data.split(rowDelimiter);

        console.log(`Found ${rows.length - 1} rows.`);

        const targetId = '12677627';
        const targetRow = rows.find(r => r.includes(targetId));

        if (targetRow) {
            console.log('\n--- TARGET ROW HTML START ---');
            console.log(targetRow.substring(0, 300)); // Print start of row to see TR attributes
            console.log('--- TARGET ROW HTML END ---');

            const bgcolorMatch = targetRow.match(/bgcolor="([^"]+)"/i);
            console.log('BGColor:', bgcolorMatch ? bgcolorMatch[1] : 'NONE');

            console.log('\n--- REGEX TEST ---');

            const titleMatch = targetRow.match(/class="Tahoma17Blacknounder"[^>]*>([\s\S]*?)<\/a>/);
            console.log('Title Match:', titleMatch ? 'YES' : 'NO');
            if (titleMatch) console.log('Extracted:', titleMatch[1]);

            const priceMatch = targetRow.match(/class="Tahoma14BrownNound"[^>]*>([\s\S]*?)<\/span>/);
            console.log('Price Match:', priceMatch ? 'YES' : 'NO');
            if (priceMatch) console.log('Price Raw:', priceMatch[1]);

            const linkMatch = targetRow.match(/href="(\/UDTransDetail\.asp\?AutoNumAnuncio=[^"]+)"/);
            console.log('Link Match:', linkMatch ? 'YES' : 'NO');

        } else {
            console.log(`Target ID ${targetId} NOT FOUND in HTML.`);
        }
    });
});
