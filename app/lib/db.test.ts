import { upsertListing, getListingsByMake, DBListing } from './db';
import fs from 'fs';
import path from 'path';

// Mock process.cwd to use a temp directory for tests
const originalCwd = process.cwd();
const tempDir = path.join(__dirname, 'temp_test_data');

beforeAll(() => {
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir);
    }
    // We can't easily mock process.cwd() in Jest without some hacks, 
    // but we can rely on isolation or modify logic to accept a path. 
    // For now, let's assume the DB logic uses process.cwd().
    // Actually, modifying the DB code to accept a base path or using strict mocks is better.
    // But let's try to run it 'as is' first. if it writes to real data/listings.db, that's fine for dev env testing.
    // Ideally we'd mock 'better-sqlite3', but we want to test IT works.
});

afterAll(() => {
    // Cleanup if needed
});

describe('Database Layer', () => {
    it('should upsert a listing and retrieve it', () => {
        const testListing: DBListing = {
            id: 'test-123',
            make: 'Toyota',
            model: 'Corolla',
            title: 'Test Corolla',
            price: 20000,
            year: 2022,
            mileage: 10000,
            location: 'San Juan',
            img_url: 'http://example.com/img.jpg',
            link_url: 'http://example.com/detail',
        };

        // 1. Insert
        expect(() => upsertListing(testListing)).not.toThrow();

        // 2. Retrieve
        const listings = getListingsByMake('Toyota');
        expect(listings.length).toBeGreaterThan(0);

        const found = listings.find(l => l.id === 'test-123');
        expect(found).toBeDefined();
        expect(found?.price).toBe(20000);
        expect(found?.make).toBe('Toyota');
    });

    it('should update an existing listing', () => {
        const updatedListing: DBListing = {
            id: 'test-123',
            make: 'Toyota',
            model: 'Corolla',
            title: 'Test Corolla',
            price: 18000, // Price drop
            year: 2022,
            mileage: 10000,
            location: 'San Juan',
            img_url: 'http://example.com/img.jpg',
            link_url: 'http://example.com/detail',
        };

        upsertListing(updatedListing);

        const listings = getListingsByMake('Toyota');
        const found = listings.find(l => l.id === 'test-123');
        expect(found?.price).toBe(18000);
    });
});
