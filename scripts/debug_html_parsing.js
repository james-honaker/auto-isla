const https = require('https');

const offset = 0;
const url = `https://www.clasificadosonline.com/UDTransListingADV.asp?Marca=22&TipoC=1&Submit2=Buscar+-+Go&offset=${offset}`;

https.get(url, {
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
}, (res) => {
    console.log(`Status Code: ${res.statusCode}`);
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        // 1. Count strict rows
        const rowDelimiter = '<tr align="center" valign="middle">';
        const rows = data.split(rowDelimiter);
        console.log(`Strict Rows Found: ${rows.length - 1}`);

        // 2. Count Title Classes (Global Regex)
        const titleMatches = data.match(/class="Tahoma17Blacknounder"/g) || [];
        console.log(`Title Classes Found: ${titleMatches.length}`);

        if (titleMatches.length > (rows.length - 1)) {
            console.log("\nMISMATCH DETECTED! properties are being skipped by strict row splitting.");
        }
    });
});
