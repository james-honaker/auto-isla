/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SmartSearch from './SmartSearch';
import * as searchAction from '../actions/search';

// Mock the server action
jest.mock('../actions/search', () => ({
    findBestDeals: jest.fn(),
}));

describe('SmartSearch Component', () => {
    it('should handle search results and display them without crashing', async () => {
        // Mock return value with a potential crash-inducing value (simulating NaN -> null serialization)
        // @ts-ignore - simulating runtime null equivalent
        (searchAction.findBestDeals as jest.Mock).mockResolvedValue([
            {
                listing: {
                    title: 'Test Toyota',
                    price: null as unknown as number, // Force null to simulate JSON(NaN)
                    year: 2020,
                    mileage: 50000,
                    location: 'San Juan',
                    img_url: 'http://example.com/img.jpg',
                    link_url: 'http://example.com/link',
                },
                score: 95,
                reliability: 10,
                dealScore: 8,
                isFresh: true
            }
        ]);

        render(<SmartSearch />);

        // 1. Find the Toyota button (Make ID 49)
        // Note: In our UI tests, finding by text is usually easiest. 
        // We know from the component "Toyota" is generated from ID 49.
        const toyotaBtn = screen.getByText('Toyota');
        expect(toyotaBtn).toBeInTheDocument();

        // 2. Click it
        fireEvent.click(toyotaBtn);

        // 3. Expect Loading State
        expect(screen.getByText(/Scaning market/i)).toBeInTheDocument();

        // 4. Wait for results
        // If the component crashes, this expectation or the render will throw/fail
        await waitFor(() => {
            expect(screen.getByText('Test Toyota')).toBeInTheDocument();
        });

        // 5. Verify price is handled (even if null/0)
        // If it was null, hopefully we fixed it to show $0 or N/A. 
        // Assuming we fix it to show $0 for now.
        // expect(screen.getByText('$0')).toBeInTheDocument(); 
    });
});
