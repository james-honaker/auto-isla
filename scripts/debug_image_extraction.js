const https = require('https');

// URL for a specific listing that is known to fail image extraction
// Listing ID: 12880979 (from previous check_db output)
// We need to fetch the LIST page that contains this listing to see the row HTML.
// Targeted URL: Model 2079
const url = 'https://www.clasificadosonline.com/UDTransListingADV.asp?Marca=22&Modelo=2079&Submit2=Buscar+-+Go&offset=0';

console.log(`Fetching ${url}...`);

https.get(url, {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
    }
}, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        const rowDelimiter = '<tr align="center" valign="middle">';
        const rows = data.split(rowDelimiter);
        rows.shift();

        // Find the row for our target ID
        const targetRow = rows.find(r => r.includes('12880979'));

        if (targetRow) {
            console.log('\n--- TARGET ROW HTML ---');
            console.log(targetRow);
            console.log('--- END HTML ---\n');

            // Test Regex
            const regex1 = /<img[^>]+src="([^">]+)"/;
            const regex2 = /<img[^>]+src=["'](https?:\/\/[^"']+)["']/i;

            console.log('Regex 1 Match:', targetRow.match(regex1));
            console.log('Regex 2 Match:', targetRow.match(regex2));
        } else {
            console.log('Target listing not found on page 0.');
        }
    });
}).on('error', console.error);
