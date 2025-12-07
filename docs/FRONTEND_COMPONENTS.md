# Frontend Component Documentation

## Overview

This document provides specifications for frontend components to be built for MindFlip AI. Use this as a reference when implementing the mobile and web frontends.

## Design System

### Colors

```css
/* Primary Brand Colors */
--primary: #667eea;           /* Indigo */
--primary-dark: #5568d3;
--primary-light: #7c91f7;

/* Accent Colors */
--accent: #f093fb;            /* Pink gradient */
--accent-secondary: #f5576c;

/* Semantic Colors */
--success: #10b981;
--warning: #f59e0b;
--error: #ef4444;
--info: #3b82f6;

/* Neutrals */
--text-primary: #1f2937;
--text-secondary: #6b7280;
--bg-primary: #ffffff;
--bg-secondary: #f9fafb;
--border: #e5e7eb;
```

### Typography

```css
/* Font Family */
--font-primary: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
--font-mono: 'Fira Code', 'Courier New', monospace;

/* Font Sizes */
--text-xs: 0.75rem;   /* 12px */
--text-sm: 0.875rem;  /* 14px */
--text-base: 1rem;    /* 16px */
--text-lg: 1.125rem;  /* 18px */
--text-xl: 1.25rem;   /* 20px */
--text-2xl: 1.5rem;   /* 24px */
--text-3xl: 1.875rem; /* 30px */
--text-4xl: 2.25rem;  /* 36px */
```

### Spacing

```css
/* Spacing Scale (4px base) */
--space-1: 0.25rem;  /* 4px */
--space-2: 0.5rem;   /* 8px */
--space-3: 0.75rem;  /* 12px */
--space-4: 1rem;     /* 16px */
--space-6: 1.5rem;   /* 24px */
--space-8: 2rem;     /* 32px */
--space-12: 3rem;    /* 48px */
--space-16: 4rem;    /* 64px */
```

## Core Components

### 1. FlashcardCard

**Purpose**: Display a single flashcard with flip animation

**API**:
```typescript
interface FlashcardCardProps {
  flashcard: {
    id: string;
    front: string;
    back: string;
    topic: string;
  };
  onFlip?: (side: 'front' | 'back') => void;
  flipped?: boolean;
}
```

**Features**:
- Tap/click to flip
- Smooth 3D rotation animation
- Gradient background
- Dark mode support

**Example**:
```jsx
<FlashcardCard
  flashcard={{
    id: '1',
    front: 'What is React?',
    back: 'A JavaScript library for building user interfaces',
    topic: 'React'
  }}
  onFlip={(side) => console.log('Flipped to:', side)}
/>
```

**Visual**:
```
┌─────────────────────────┐
│  [Topic Badge]          │
│                         │
│    What is React?       │
│                         │
│                         │
│   [Tap to reveal →]     │
└─────────────────────────┘
```

---

### 2. GenerateForm

**Purpose**: Input form for flashcard generation

**API**:
```typescript
interface GenerateFormProps {
  onSubmit: (data: {
    topic: string;
    count: number;
    mode: 'standard' | 'deep-dive';
  }) => Promise<void>;
  isLoading?: boolean;
}
```

**Features**:
- Topic input with validation
- Count selector (1-20)
- Mode toggle (Standard/Deep Dive)
- Loading state
- Error handling

**Example**:
```jsx
<GenerateForm
  onSubmit={async (data) => {
    const response = await api.generateFlashcards(data);
  }}
  isLoading={isGenerating}
/>
```

**Visual**:
```
┌─────────────────────────┐
│  Generate Flashcards    │
├─────────────────────────┤
│ Topic:                  │
│ [___________________]   │
│                         │
│ Count: [5] ◄─►          │
│                         │
│ Mode:                   │
│ ⚪ Standard             │
│ ⚫ Deep Dive            │
│                         │
│    [Generate ✨]        │
└─────────────────────────┘
```

---

### 3. DeckList

**Purpose**: List of saved flashcard decks

**API**:
```typescript
interface DeckListProps {
  decks: Array<{
    id: string;
    name: string;
    topic: string;
    cardCount: number;
    createdAt: string;
  }>;
  onSelectDeck: (deckId: string) => void;
  onDeleteDeck?: (deckId: string) => void;
}
```

**Features**:
- Scrollable list
- Search/filter
- Swipe-to-delete (mobile)
- Loading skeleton

**Visual**:
```
┌─────────────────────────┐
│  My Decks      [Search] │
├─────────────────────────┤
│ ┌─────────────────────┐ │
│ │ React Basics        │ │
│ │ 12 cards • 2d ago   │ │
│ └─────────────────────┘ │
│ ┌─────────────────────┐ │
│ │ TypeScript          │ │
│ │ 8 cards • 1w ago    │ │
│ └─────────────────────┘ │
└─────────────────────────┘
```

---

### 4. StudyMode

**Purpose**: Study interface with card navigation

**API**:
```typescript
interface StudyModeProps {
  cards: Flashcard[];
  onComplete: (stats: {
    studied: number;
    correct: number;
    timeSpent: number;
  }) => void;
  onExit: () => void;
}
```

**Features**:
- Progress indicator
- Previous/Next navigation
- "Know it" / "Study more" actions
- Session statistics

**Visual**:
```
┌─────────────────────────┐
│ Progress: ▓▓▓▓░░░ 4/10  │
├─────────────────────────┤
│                         │
│   [Flashcard Content]   │
│                         │
├─────────────────────────┤
│  ← Prev  |  Next →      │
│                         │
│ [✓ Know it] [? Study]   │
└─────────────────────────┘
```

---

### 5. QuizMode

**Purpose**: Quiz interface with scoring

**API**:
```typescript
interface QuizModeProps {
  questions: Array<{
    id: string;
    question: string;
    options: string[];
    correctAnswer: number;
  }>;
  onComplete: (score: number) => void;
}
```

**Features**:
- Multiple choice
- Timer (optional)
- Instant feedback
- Final score

**Visual**:
```
┌─────────────────────────┐
│ Question 3/10 Timer:30s │
├─────────────────────────┤
│ What is TypeScript?     │
│                         │
│ ⚪ A. A framework       │
│ ⚪ B. A superset of JS  │
│ ⚪ C. A database         │
│ ⚪ D. A CSS library      │
│                         │
│      [Submit Answer]    │
└─────────────────────────┘
```

---

### 6. StatusBadge

**Purpose**: Show generation/job status

**API**:
```typescript
interface StatusBadgeProps {
  status: 'queued' | 'processing' | 'completed' | 'failed';
  message?: string;
}
```

**Visual Spec**:
```css
/* Status Colors */
.status-queued { background: #f59e0b; } /* Orange */
.status-processing { background: #3b82f6; } /* Blue + spinner */
.status-completed { background: #10b981; } /* Green */
.status-failed { background: #ef4444; } /* Red */
```

---

### 7. AuthButton

**Purpose**: Google OAuth login

**API**:
```typescript
interface AuthButtonProps {
  onSuccess: (user: {
    id: string;
    email: string;
    name: string;
  }) => void;
  onError: (error: Error) => void;
}
```

**Visual**:
```
┌──────────────────────────┐
│  🔐 Sign in with Google  │
└──────────────────────────┘
```

---

## Layout Components

### 1. AppShell

**Purpose**: Main application layout

**Structure**:
```
┌─────────────────────────────┐
│        Header/Nav           │
├─────────────────────────────┤
│                             │
│        Main Content         │
│                             │
│                             │
├─────────────────────────────┤
│      Footer (Optional)      │
└─────────────────────────────┘
```

### 2. EmptyState

**Purpose**: No content placeholder

**Visual**:
```
┌─────────────────────────┐
│         📚              │
│  No decks yet           │
│  Create your first!     │
│                         │
│  [+ Create Deck]        │
└─────────────────────────┘
```

---

## API Integration Examples

### Generate Flashcards

```typescript
import { api } from './services/api';

async function generateCards(topic: string) {
  try {
    const response = await api.post('/api/generate', {
      topic,
      count: 10,
      mode: 'standard'
    }, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    const { jobId, statusUrl } = response.data;
    
    // Poll for completion
    const result = await pollJobStatus(jobId);
    return result.cards;
  } catch (error) {
    console.error('Generation failed:', error);
    throw error;
  }
}
```

### Save Deck

```typescript
async function saveDeck(name: string, cards: Flashcard[]) {
  const response = await api.post('/api/decks', {
    name,
    topic: cards[0].topic,
    cards
  }, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });
  
  return response.data.id;
}
```

---

## Mobile-Specific Components

### 1. BottomSheet

**Purpose**: Modal sheet for mobile actions

**Usage**:
```jsx
<BottomSheet
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
>
  {/* Actions */}
</BottomSheet>
```

### 2. TabNavigator

**Purpose**: Bottom tab navigation

**Tabs**:
- Home (🏠)
- Study (📚)
- Decks (🗂️)
- Profile (👤)

---

## Accessibility

### Required Attributes

```jsx
// Buttons
<button aria-label="Flip flashcard">Flip</button>

// Forms
<input
  type="text"
  id="topic"
  aria-describedby="topic-help"
  aria-required="true"
/>

// Status
<div role="status" aria-live="polite">
  Generating flashcards...
</div>
```

### Focus Management

- Trap focus in modals
- Visible focus indicators
- Keyboard navigation support

---

## Animation Guidelines

### Transitions

```css
/* Flashcard flip */
.flashcard {
  transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  transform-style: preserve-3d;
}

/* Button hover */
.button {
  transition: all 0.2s ease-in-out;
}

/* Loading states */
.skeleton {
  animation: pulse 1.5s ease-in-out infinite;
}
```

### Performance

- Use `transform` and `opacity` for animations
- Avoid animating `width`, `height`, `margin`
- Implement virtual scrolling for long lists

---

## State Management

### Recommended Structure

```typescript
interface AppState {
  auth: {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
  };
  flashcards: {
    decks: Deck[];
    currentDeck: Deck | null;
    isLoading: boolean;
  };
  generation: {
    status: JobStatus;
    progress: number;
    error: Error | null;
  };
}
```

---

## Error Handling

### Error States

```typescript
interface ErrorState {
  type: 'network' | 'auth' | 'validation' | 'server';
  message: string;
  retryable: boolean;
}
```

### Error UI

```
┌─────────────────────────┐
│         ⚠️              │
│  Something went wrong   │
│                         │
│  [Retry] [Contact Support]
└─────────────────────────┘
```

---

## Testing

### Component Tests

```typescript
// Example with React Testing Library
test('FlashcardCard flips on click', () => {
  render(<FlashcardCard flashcard={mockCard} />);
  const card = screen.getByRole('button');
  
  fireEvent.click(card);
  
  expect(screen.getByText(mockCard.back)).toBeInTheDocument();
});
```

---

## Next Steps

1. Implement core components
2. Create component library/storybook
3. Build mobile app with these specs
4. Add E2E tests
5. Performance optimization
