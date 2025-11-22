export interface Flashcard {
    id: string;
    front: string;
    back: string;
    topic?: string;
}
export declare class DeckModel {
    cards: any[];
    currentIndex: number;
    leftSwipes: number;
    rightSwipes: number;
    demoCard: any;
    currentTopic: string;
    constructor();
    setCards(cards: Flashcard[]): void;
    getCurrentCard(): any;
    nextCard(): boolean;
    recordSwipe(direction: any): Promise<void>;
    getStats(): {
        total: number;
        remaining: number;
        left: number;
        right: number;
        progress: number;
    };
    loadInitialDeck(): Promise<void>;
}
export declare const deckModel: DeckModel;
//# sourceMappingURL=deck.model.d.ts.map