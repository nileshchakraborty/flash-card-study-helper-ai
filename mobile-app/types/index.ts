export interface Flashcard {
    id: string;
    front: string;
    back: string;
    topic?: string;
}

export interface Deck {
    id: string;
    title: string;
    topic: string;
    cards: Flashcard[];
    created_at: string;
}
