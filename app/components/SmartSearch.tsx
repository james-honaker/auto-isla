'use client';

import { useState, useMemo, useEffect } from 'react';
import Fuse from 'fuse.js';
import makesData from '../../data/makes.json';
import modelsData from '../../data/models.json';
import { searchDeals } from '../actions/search';
import { ScoredListing } from '../lib/types';

// Type definitions
type Make = {
    id: string;
    name: string;
};

type Model = {
    id: string;
    name: string;
};

type ModelsData = {
    [key: string]: {
        makeId: string;
        makeName?: string;
        models: Model[];
    };
};

const BUYERS_LIST = [
    "49", // Toyota
    "21", // Honda
    "36", // Nissan
    "22", // Hyundai
    "27", // Kia
    "18", // Ford
    "35", // Mitsubishi
    "10", // Chevrolet
    "32", // Mazda
];

export default function SmartSearch() {
    // Multi-select state
    const [selectedMakes, setSelectedMakes] = useState<string[]>([]);

    // NOTE: Model selection with multi-make is complex. 
    // For now, we disable model filtering when multiple makes are selected, 
    // or arguably we could just hide it until a single make is focused.
    // Let's hide it for simplicity in "Compare Mode".

    // Results State
    const [results, setResults] = useState<ScoredListing[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Cast imported JSON to typed data
    const makes = makesData as Make[];

    // Filter makes to just the buyer's list
    const filteredMakes = useMemo(() => {
        return makes.filter(make => BUYERS_LIST.includes(make.id))
            .sort((a, b) => BUYERS_LIST.indexOf(a.id) - BUYERS_LIST.indexOf(b.id));
    }, [makes]);

    // Handle Toggle
    const toggleMake = (makeId: string) => {
        setSelectedMakes(prev => {
            if (prev.includes(makeId)) {
                // Remove
                return prev.filter(id => id !== makeId);
            } else {
                // Add
                return [...prev, makeId];
            }
        });
    };

    // Trigger Search when keys change
    useEffect(() => {
        const fetchDeals = async () => {
            setIsLoading(true);
            setResults([]);

            try {
                // Determine target makes
                // If selection is empty, we search ALL buyers list (Default View)
                const targetIds = selectedMakes.length > 0 ? selectedMakes : BUYERS_LIST;

                // Map IDs to Objects
                const targetMakes = targetIds.map(id => {
                    const m = makes.find(mk => mk.id === id);
                    return { id, name: m?.name || '' };
                });

                const deals = await searchDeals(targetMakes);
                setResults(deals);
            } catch (e) {
                console.error("Search failed", e);
            } finally {
                setIsLoading(false);
            }
        };

        // Debounce slightly to allow rapid toggling without firing 100 reqs
        const timer = setTimeout(fetchDeals, 800);
        return () => clearTimeout(timer);
    }, [selectedMakes, makes]);


    return (
        <div className="w-full max-w-6xl px-4 py-8 space-y-8 flex flex-col items-center">

            {/* Header */}
            <div className="text-center space-y-2 max-w-2xl">
                <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                    AutoIsla Intelligence
                </h2>
                <p className="text-zinc-500 dark:text-zinc-400">
                    Select brands to compare. <br />
                    <span className="text-xs text-sky-600 font-medium">
                        {selectedMakes.length === 0 ? "Showing Top Picks from All Brands" : `Comparing ${selectedMakes.length} Brand(s)`}
                    </span>
                </p>
            </div>

            {/* Brand Grid (Multi-Select) */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 w-full">
                {filteredMakes.map((make) => {
                    const isSelected = selectedMakes.includes(make.id);
                    return (
                        <button
                            key={make.id}
                            onClick={() => toggleMake(make.id)}
                            className={`
                                flex flex-col items-center justify-center p-4 rounded-xl border transition-all duration-200
                                ${isSelected
                                    ? 'border-sky-500 bg-sky-600 text-white shadow-md ring-2 ring-sky-500/20 shadow-sky-500/20'
                                    : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:border-sky-300 hover:bg-sky-50 dark:hover:bg-zinc-800'
                                }
                            `}
                        >
                            <span className="text-base font-semibold">
                                {make.name}
                            </span>
                            {isSelected && <span className="text-[10px] uppercase font-bold mt-1 opacity-80">Active</span>}
                        </button>
                    );
                })}
            </div>

            {/* Loading Indicator */}
            {isLoading && (
                <div className="flex flex-col items-center p-12 space-y-4 animate-in fade-in">
                    <div className="w-8 h-8 border-4 border-sky-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-zinc-500 font-medium">Scanning market for {selectedMakes.length || 'all'} brands...</p>
                </div>
            )}

            {/* Results Grid */}
            {!isLoading && results.length > 0 && (
                <div className="w-full space-y-6 animate-in slide-in-from-bottom-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                            Top Recommendations
                            <span className="bg-sky-100 text-sky-800 text-xs px-2 py-1 rounded-full">{results.length} found</span>
                        </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {results.map((item, idx) => (
                            <a
                                key={idx}
                                href={item.listing.link_url}
                                target="_blank"
                                className="group relative bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden hover:shadow-xl transition-all hover:border-sky-400 flex flex-col"
                            >
                                {/* Score Badge */}
                                <div className="absolute top-3 right-3 z-10 bg-white/95 backdrop-blur dark:bg-black/80 px-3 py-1 rounded-full shadow-sm border border-zinc-100 dark:border-zinc-800">
                                    <span className={`font-black ${item.score >= 80 ? 'text-green-600' :
                                        item.score >= 60 ? 'text-orange-500' : 'text-red-500'
                                        }`}>
                                        {item.score}
                                    </span>
                                    <span className="text-xs text-zinc-400 ml-1">SCORE</span>
                                </div>

                                {/* Freshness Badge */}
                                {item.isFresh && (
                                    <div className="absolute top-3 left-3 z-10 bg-sky-500 text-white px-2 py-0.5 rounded text-xs font-bold shadow-sm animate-pulse">
                                        NEW
                                    </div>
                                )}

                                {/* Image */}
                                <div className="aspect-video w-full bg-zinc-100 dark:bg-zinc-800 relative overflow-hidden">
                                    <img
                                        src={item.listing.img_url}
                                        alt={item.listing.title}
                                        loading="lazy"
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                    />
                                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                                        <span className="text-white font-bold text-sm">{item.listing.make}</span>
                                    </div>
                                </div>

                                {/* Details */}
                                <div className="p-4 space-y-3 flex-1 flex flex-col">
                                    <div className="min-h-[3rem]">
                                        <h4 className="font-medium text-zinc-900 dark:text-zinc-100 line-clamp-2 leading-tight">
                                            {item.listing.title}
                                        </h4>
                                    </div>

                                    <div className="mt-auto pt-3 border-t border-zinc-100 dark:border-zinc-800">
                                        <div className="flex items-baseline justify-between mb-1">
                                            <span className="text-xl font-bold text-sky-600 dark:text-sky-400">
                                                ${(item.listing.price || 0).toLocaleString()}
                                            </span>
                                            <span className="text-sm text-zinc-500">
                                                {item.listing.mileage > 0 ? `${(item.listing.mileage / 1000).toFixed(0)}k mi` : 'N/A'}
                                            </span>
                                        </div>

                                        {/* Warnings */}
                                        {item.warning ? (
                                            <div className="bg-red-50 text-red-600 text-xs px-2 py-1 rounded border border-red-100 mb-2 font-medium">
                                                ⚠️ {item.warning}
                                            </div>
                                        ) : (
                                            <div className="flex justify-between text-xs text-zinc-400">
                                                <span>{item.listing.location}</span>
                                                <span title={item.modelDetected ? `Detected: ${item.modelDetected}` : 'Generic Score'}>
                                                    Rel: {item.reliability}/10
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </a>
                        ))}
                    </div>
                </div>
            )}

            {/* Empty State */}
            {!isLoading && results.length === 0 && (
                <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-xl p-12 text-center max-w-lg">
                    <p className="text-zinc-500">No listings found for your selection. Try selecting more brands.</p>
                </div>
            )}
        </div>
    );
}
