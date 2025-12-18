
import { calculateScore } from './scoring';

describe('Scoring Engine 2.0', () => {

    test('Should identify safe models and score high', () => {
        const car = {
            make: 'Toyota',
            title: 'Vendo Toyota Corolla 2018 Excelentes Condiciones',
            price: 14000,
            year: 2018,
            mileage: 40000,
            created_at: new Date().toISOString()
        };
        const result = calculateScore(car);

        expect(result.modelDetected).toBe('Corolla');
        expect(result.reliability).toBe(10); // Corolla is 10
        expect(result.score).toBeGreaterThan(80);
        expect(result.warning).toBeUndefined();
    });

    test('Should penalize "Bad Years" (Nissan Altima CVT)', () => {
        const car = {
            make: 'Nissan',
            title: 'Nissan Altima 2.5 S 2013',
            price: 6000, // Cheap, but...
            year: 2013, // BAD YEAR
            mileage: 90000,
            created_at: new Date().toISOString()
        };
        const result = calculateScore(car);

        expect(result.modelDetected).toBe('Altima');
        expect(result.reliability).toBe(1); // Penalty!
        expect(result.score).toBeLessThan(50); // Capped
        expect(result.warning).toContain('Avoid');
    });

    test('Should identify Ford Focus transmission risk', () => {
        const car = {
            make: 'Ford',
            title: 'Ford Focus SE 2014 Hatchback',
            price: 5000,
            year: 2014, // BAD YEAR
            mileage: 80000
        };
        const result = calculateScore(car);

        expect(result.modelDetected).toBe('Focus');
        expect(result.reliability).toBe(1);
        expect(result.warning).toContain('PowerShift');
    });

    test('Should detect models with fuzzy matching', () => {
        expect(calculateScore({ ...baseCar, make: 'Hyundai', title: 'Hyundai Elantra GT' }).modelDetected).toBe('Elantra');
        expect(calculateScore({ ...baseCar, make: 'Kia', title: 'Kia Soul !' }).modelDetected).toBe('Soul');
        expect(calculateScore({ ...baseCar, make: 'Mazda', title: 'Mazda CX-5 Touring' }).modelDetected).toBe('CX-5');
    });

    test('Should give freshness bonus', () => {
        const oldCar = calculateScore({
            ...baseCar,
            make: 'Toyota',
            title: 'Toyota Camry 2010',
            price: 8000,
            year: 2010,
            mileage: 100000,
            created_at: new Date(Date.now() - 86400000 * 10).toISOString() // 10 days ago
        });

        const freshCar = calculateScore({
            ...baseCar,
            make: 'Toyota',
            title: 'Toyota Camry 2010',
            price: 8000,
            year: 2010,
            mileage: 100000,
            created_at: new Date().toISOString() // Now
        });

        expect(freshCar.score).toBeGreaterThan(oldCar.score);
    });
});

const baseCar = {
    make: 'Toyota',
    title: 'Toyota Model',
    price: 10000,
    year: 2015,
    mileage: 50000,
    created_at: new Date().toISOString()
};
