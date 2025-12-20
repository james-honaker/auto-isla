// Shared Configuration for Auto-Isla Sync Scripts

// General Makes to scrape (Full or Incremental)
const GENERAL_MAKES = [
    { name: 'Hyundai', id: '22' },
    { name: 'Toyota', id: '49' },
    // Add more brands here (e.g. { name: 'Honda', id: 'XX' })
];

// Targeted Models (Specific high-interest models to ensure we catch via keyword/model filters)
const TARGETED_MODELS = [
    // Targeted: Ioniq 5 (using Key=Ioniq)
    { make: 'Hyundai', makeId: '22', modelTarget: 'Ioniq 5', extraParams: '&TipoC=1&Key=Ioniq&jumpMenu=Trecientesdesc' },
    // Targeted: Ioniq 5 (using Modelo=2079) - Fix for specific missing models
    { make: 'Hyundai', makeId: '22', modelTarget: 'Ioniq 5', extraParams: '&Modelo=2079&jumpMenu=Trecientesdesc' }
];

// Keywords/Models to explicitly IGNORE in the future (e.g. 'Tacoma', 'Tundra' if user wants to exclude trucks)
const EXCLUDED_KEYWORDS = [];

module.exports = {
    GENERAL_MAKES,
    TARGETED_MODELS,
    EXCLUDED_KEYWORDS
};
