
async function inspectPagination() {
    // Toyota (49)
    const url = `https://www.clasificadosonline.com/UDTransListingADV.asp?Marca=49&TipoC=1&Submit2=Buscar+-+Go`;
    console.log(`Fetching ${url}...`);

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        const html = await response.text();

        // Look for "Next" or "Siguiente" or pagination parameters
        // Common patterns: "offset=", "page=", "siguiente"

        // Let's print all hrefs that look like pagination
        const hrefs = html.match(/href="[^"]*"/g) || [];
        const paginationLinks = hrefs.filter(link =>
            link.includes('offset') ||
            link.includes('Offset') ||
            link.includes('Page') ||
            link.toLowerCase().includes('siguiente') ||
            link.toLowerCase().includes('next')
        );

        console.log("Potential Pagination Links:");
        paginationLinks.forEach(l => console.log(l));

    } catch (e) {
        console.error(e);
    }
}

inspectPagination();
