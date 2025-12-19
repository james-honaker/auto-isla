import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

let dbInstance: Database.Database | null = null;

export function getDB() {
    if (dbInstance) return dbInstance;

    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    const dbPath = path.join(dataDir, 'listings.db');
    dbInstance = new Database(dbPath);

    // Initialize Schema
    dbInstance.exec(`
        CREATE TABLE IF NOT EXISTS listings (
            id TEXT PRIMARY KEY,
            make TEXT,
            model TEXT,
            title TEXT,
            price INTEGER,
            year INTEGER,
            mileage INTEGER,
            location TEXT,
            img_url TEXT,
            link_url TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    return dbInstance;
}

export interface DBListing {
    id: string;
    make: string;
    model: string;
    title: string;
    price: number;
    year: number;
    mileage: number;
    location: string;
    img_url: string;
    link_url: string;
    created_at?: string;
    updated_at?: string;
}

export function upsertListing(listing: DBListing) {
    const db = getDB();
    const stmt = db.prepare(`
        INSERT INTO listings (id, make, model, title, price, year, mileage, location, img_url, link_url, updated_at)
        VALUES (@id, @make, @model, @title, @price, @year, @mileage, @location, @img_url, @link_url, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
            price = excluded.price,
            mileage = excluded.mileage,
            updated_at = CURRENT_TIMESTAMP
    `);

    // Use link_url hash or just match the ID logic (we'll use the AutoNumAnuncio from URL as ID)
    stmt.run(listing);
}

export function getListingsByMake(makeName: string, limit = 50): DBListing[] {
    const db = getDB();
    const stmt = db.prepare(`
        SELECT * FROM listings 
        WHERE make = ? 
        ORDER BY created_at DESC 
        LIMIT ?
    `);
    return stmt.all(makeName, limit) as DBListing[];
}

export function getListingsByMakes(makeNames: string[], limitPerMake = 50, models?: string[]): DBListing[] {
    const db = getDB();
    // Dynamically build placeholders for IN clause
    const makePlaceholders = makeNames.map(() => '?').join(',');

    let query = `
        SELECT * FROM listings 
        WHERE make IN (${makePlaceholders})
    `;

    const args: any[] = [...makeNames];

    // Add Model Filtering
    if (models && models.length > 0) {
        const modelPlaceholders = models.map(() => '?').join(',');
        query += ` AND model IN (${modelPlaceholders})`;
        args.push(...models);
    }

    query += ` ORDER BY created_at DESC LIMIT ?`;
    args.push(limitPerMake * makeNames.length);

    const stmt = db.prepare(query);
    return stmt.all(...args) as DBListing[];
}

export function getLastUpdated(): string | null {
    const db = getDB();
    const row = db.prepare('SELECT MAX(updated_at) as last_updated FROM listings').get() as { last_updated: string };
    return row?.last_updated || null;
}
