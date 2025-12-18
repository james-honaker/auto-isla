
import { DBListing } from "./db";

export type ScoredListing = {
    listing: DBListing;
    score: number;
    reliability: number;
    dealScore: number;
    isFresh: boolean;
    warning?: string;
    modelDetected?: string;
};
