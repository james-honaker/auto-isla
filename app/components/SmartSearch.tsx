'use client';

import { useState, useMemo } from 'react';
import Fuse from 'fuse.js';
import makesData from '../../data/makes.json';
import modelsData from '../../data/models.json';
import { findBestDeals, ScoredListing } from '../actions/search';

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
    "26", // Jeep
    "32", // Mazda
];

export default function SmartSearch() {
    const [selectedMake, setSelectedMake] = useState<string>('');
    const [selectedModel, setSelectedModel] = useState<string>('');
    const [modelQuery, setModelQuery] = useState<string>('');

    // Results State
    const [results, setResults] = useState<ScoredListing[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Cast imported JSON to typed data
    const makes = makesData as Make[];
    const models = modelsData as ModelsData;

    // Filter makes to just the buyer's list
    const filteredMakes = useMemo(() => {
        return makes.filter(make => BUYERS_LIST.includes(make.id))
            // Sort by the order in BUYERS_LIST for priority
            .sort((a, b) => BUYERS_LIST.indexOf(a.id) - BUYERS_LIST.indexOf(b.id));
    }, [makes]);

    // Derive models based on selected make
    const availableModels = useMemo(() => {
        if (!selectedMake) return [];
        return models[selectedMake]?.models || [];
    }, [selectedMake]);

    // Fuzzy filter models
    const filteredModels = useMemo(() => {
        if (!modelQuery) return availableModels;

        const fuse = new Fuse(availableModels, {
            keys: ['name'],
            threshold: 0.4,
        });

        return fuse.search(modelQuery).map(result => result.item);
    }, [availableModels, modelQuery]);

    const handleSearch = () => {
        if (!selectedMake) return;
        const modelParam = selectedModel || '0';
        const url = `https://www.clasificadosonline.com/UDTransListingADV.asp?Marca=${selectedMake}&Modelo=${modelParam}&TipoC=1&Submit2=Buscar+-+Go`;
        window.open(url, '_blank');
    };

    const handleMakeClick = async (makeId: string) => {
        if (selectedMake === makeId) {
            setSelectedMake('');
            setResults([]); // Clear results
        } else {
            setSelectedMake(makeId);
            setResults([]); // Clear previous results while loading
            setIsLoading(true);

            // Trigger Smart Search
            const makeName = makes.find(m => m.id === makeId)?.name || '';
            try {
                const deals = await findBestDeals(makeId, makeName);
                setResults(deals);
            } catch (e) {
                console.error("Search failed", e);
            } finally {
                setIsLoading(false);
            }
        }
        setSelectedModel('');
        setModelQuery('');
    };

    return (
        <div className="w-full max-w-4xl px-4 py-8 space-y-8 flex flex-col items-center">

            {/* Header */}
            <div className="text-center space-y-2 max-w-2xl">
                <h2 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                    AutoIsla Intelligence
                </h2>
                <p className="text-zinc-500 dark:text-zinc-400">
                    Select a brand. We'll find the best deals for you.
                </p>
            </div>

            {/* Brand Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 w-full">
                {filteredMakes.map((make) => (
                    <button
                        key={make.id}
                        onClick={() => handleMakeClick(make.id)}
                        className={`
                flex flex-col items-center justify-center p-4 rounded-xl border transition-all duration-200
                ${selectedMake === make.id
                                ? 'border-sky-500 bg-sky-50 dark:bg-sky-900/20 shadow-md ring-2 ring-sky-500/20'
                                : 'border-zinc-200 dark:border-zinc-800 hover:border-sky-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                            }
            `}
                    >
                        <span className={`text-base font-semibold ${selectedMake === make.id ? 'text-sky-700 dark:text-sky-400' : 'text-zinc-700 dark:text-zinc-300'}`}>
                            {make.name}
                        </span>
                    </button>
                ))}
            </div>

            {/* Loading Indicator */}
            {isLoading && (
                <div className="flex flex-col items-center p-12 space-y-4 animate-in fade-in">
                    <div className="w-8 h-8 border-4 border-sky-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-zinc-500 font-medium">Scaning market for best deals...</p>
                </div>
            )}

            {/* Results Grid */}
            {results.length > 0 && (
                <div className="w-full space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                            Top Picks
                            <span className="bg-sky-100 text-sky-800 text-xs px-2 py-1 rounded-full">{results.length} found</span>
                        </h3>
                        {/* Fallback Search Button */}
                        <button
                            onClick={handleSearch}
                            className="text-sm text-sky-600 hover:text-sky-700 font-medium"
                        >
                            View All on ClasificadosOnline &rarr;
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {results.map((item, idx) => (
                            <a
                                key={idx}
                                href={item.listing.link_url}
                                target="_blank"
                                className="group relative bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden hover:shadow-xl transition-all hover:border-sky-400"
                            >
                                {/* Score Badge */}
                                <div className="absolute top-3 right-3 z-10 bg-white/90 backdrop-blur dark:bg-black/80 px-3 py-1 rounded-full shadow-sm border border-zinc-100 dark:border-zinc-800">
                                    <span className={`font-black ${item.score >= 80 ? 'text-green-600' :
                                        item.score >= 60 ? 'text-yellow-600' : 'text-red-500'
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
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                    />
                                </div>

                                {/* Details */}
                                <div className="p-4 space-y-3">
                                    <div className="min-h-[3rem]">
                                        <h4 className="font-medium text-zinc-900 dark:text-zinc-100 line-clamp-2 leading-tight">
                                            {item.listing.title}
                                        </h4>
                                    </div>

                                    <div className="flex items-baseline justify-between">
                                        <span className="text-xl font-bold text-sky-600 dark:text-sky-400">
                                            ${(item.listing.price || 0).toLocaleString()}
                                        </span>
                                        <span className="text-sm text-zinc-500">
                                            {item.listing.mileage > 0 ? `${(item.listing.mileage / 1000).toFixed(0)}k mi` : 'N/A'}
                                        </span>
                                    </div>

                                    <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex justify-between text-xs text-zinc-400">
                                        <span>{item.listing.location}</span>
                                        <span>Reliability: {item.reliability}/10</span>
                                    </div>
                                </div>
                            </a>
                        ))}
                    </div>
                </div>
            )}

            {/* Show Model Selection Only if No Results or as Filter */}
            {selectedMake && results.length === 0 && !isLoading && (
                <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 shadow-xl border border-zinc-200 dark:border-zinc-800 animate-in fade-in slide-in-from-bottom-4 w-full text-center">
                    <p className="text-zinc-500 mb-4">No top recommendations found. Try searching all models.</p>
                    <button
                        onClick={handleSearch}
                        className="h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg px-8 rounded-xl transition-transform active:scale-[0.98] shadow-blue-500/25 shadow-lg"
                    >
                        Search All {makes.find(m => m.id === selectedMake)?.name} Models
                    </button>
                </div>
            )}
        </div>
    );
}
