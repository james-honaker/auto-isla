
import { searchDeals } from './search';
import { getListingsByMakes, upsertListing } from '../lib/db';

// Mock DB and Scraper if needed, but integration test with local DB is better for 'logic' check.
// However, scraping takes time. We should mock scraping.

jest.mock('../lib/scraper', () => ({
    scrapeListings: jest.fn().mockImplementation(async (makeId, limit) => {
        // Return fake listings based on makeId
        if (makeId === '49') { // Toyota
            return [{
                title: 'Toyota Corolla',
                price: 20000,
                year: 2020,
                mileage: 10000,
                linkUrl: 'http://test.com/toyota1',
                imgUrl: 'http://test.com/img1.jpg',
                location: 'San Juan'
            }];
        }
        if (makeId === '21') { // Honda
            return [{
                title: 'Honda Civic',
                price: 22000,
                year: 2021,
                mileage: 5000,
                linkUrl: 'http://test.com/honda1',
                imgUrl: 'http://test.com/img2.jpg',
                location: 'Caguas'
            }];
        }
        return [];
    })
}));

describe('Search Action', () => {
    it('should aggregate listings from multiple makes', async () => {
        const inputs = [
            { id: '49', name: 'Toyota' },
            { id: '21', name: 'Honda' }
        ];

        const results = await searchDeals(inputs);

        // Expect results to contain both
        expect(results.length).toBeGreaterThanOrEqual(2);

        const makes = results.map(r => r.listing.make);
        expect(makes).toContain('Toyota');
        expect(makes).toContain('Honda');

        // Cleanup implicitly by DB rollback or using a test DB?
        // Our db.ts uses a persistent file or singleton. Jest might share state.
        // But for verification logic this is fine.
    });
});
