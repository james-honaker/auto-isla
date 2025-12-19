/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom'; // Fix for toBeInTheDocument type
import SmartSearch from './SmartSearch';
import * as searchAction from '../actions/search';

// Mock the server action
jest.mock('../actions/search', () => ({
    searchDeals: jest.fn(),
}));

describe('SmartSearch Component', () => {
    it('should handle search results and display them without crashing', async () => {
        // Create a controlled promise
        let resolveSearch: (value: any) => void;
        const searchPromise = new Promise((resolve) => {
            resolveSearch = resolve;
        });

        // Mock return value to return our controlled promise
        (searchAction.searchDeals as jest.Mock).mockReturnValue(searchPromise);

        jest.useFakeTimers();
        render(<SmartSearch />);

        // 1. Find the Toyota button (Make ID 49)
        const toyotaBtn = screen.getByText('Toyota');
        expect(toyotaBtn).toBeInTheDocument();

        // 2. Click it
        fireEvent.click(toyotaBtn);

        // 3. Fast-forward past debounce (800ms)
        const { act } = require('react');
        await act(async () => {
            jest.advanceTimersByTime(850);
        });

        // 4. Expect Loading State (now it should remain loading until we resolve)
        expect(screen.getByText(/Scanning market/i)).toBeInTheDocument();

        // 5. Resolve the search
        await act(async () => {
            // @ts-ignore
            resolveSearch([
                {
                    listing: {
                        title: 'Test Toyota',
                        price: 0,
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
        });

        // 6. Expect Results
        expect(screen.getByText('Test Toyota')).toBeInTheDocument();

        // Clean up timers
        jest.useRealTimers();

    });
});
