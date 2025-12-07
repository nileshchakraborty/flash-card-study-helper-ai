# Mobile Integration Guide

MindFlip AI is designed to be mobile-responsive. While it is a web application, it mimics native app behaviors on mobile devices.

## Touch Interactions

### Flashcard Swiping
The `StudyView` implements custom touch event handlers to support Tinder-like swiping for flashcards.

- **Events**: `touchstart`, `touchmove`, `touchend`.
- **Logic**:
  - Detects horizontal swipe distance (`touchEnd - touchStart`).
  - Threshold: 50px.
  - **Left Swipe**: Marks card for "Review" (Red feedback).
  - **Right Swipe**: Marks card as "Mastered" (Green feedback).

### Implementation Details
The swipe logic is encapsulated in `StudyView.setupSwipeHandlers(cardEl)`. It does not rely on external libraries, keeping the bundle size small.

```typescript
// Simplified logic
handleSwipe(startX, endX) {
  const diff = endX - startX;
  if (Math.abs(diff) > 50) {
    if (diff > 0) deckModel.recordSwipe('right');
    else deckModel.recordSwipe('left');
  }
}
```

## Responsive Design
- **TailwindCSS**: The UI uses Tailwind's responsive prefixes (`md:`, `lg:`) to adapt layouts.
- **Hidden Elements**: Certain desktop-only controls (like "Pro Tips" sidebars) are hidden on mobile to save screen real estate.
- **Touch Targets**: Buttons and interactive elements are sized larger on mobile for better touch accessibility.

## Future Plans
- **PWA Support**: Adding a service worker for offline capability.
- **Native Wrapper**: Potential wrapper using Capacitor for App Store deployment.
