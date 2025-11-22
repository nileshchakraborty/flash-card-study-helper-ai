export interface Flashcard {
  id: string;
  front: string;  // Changed from 'question' to match frontend
  back: string;   // Changed from 'answer' to match frontend
  topic: string;
  source?: {
    filename?: string;
    page?: number;
    type?: string;
    url?: string;
  };
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation?: string;
}

export interface QuizResult {
  id: string;
  timestamp: number;
  score: number;
  total: number;
  topic: string;
  results: {
    cardId: string;
    question: string;
    userAnswer: string;
    correctAnswer: string;
    correct: boolean;
  }[];
}

export interface Deck {
  id: string;
  topic: string;
  timestamp: number;
  cards: Flashcard[];
}
