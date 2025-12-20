const { getListingsByMake } = require('../app/lib/db');
const { detectModel } = require('../app/lib/scoring');

const listings = getListingsByMake('Hyundai', 100);

console.log(`Found ${listings.length} Hyundai listings.`);

const ioniqListings = listings.filter((l: any) => l.title.toLowerCase().includes('ioniq') || l.title.toLowerCase().includes('ionic'));

console.log(`Found ${ioniqListings.length} potential Ioniq listings.`);

ioniqListings.forEach((l: any) => {
    console.log(`\nTitle: "${l.title}"`);
    console.log(`Current Model in DB: "${l.model}"`);
    const redetected = detectModel('Hyundai', l.title);
    console.log(`Re-detected: "${redetected}"`);
});
