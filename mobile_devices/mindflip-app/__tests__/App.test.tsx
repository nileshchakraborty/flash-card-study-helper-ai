import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import App from '../App';

// Mock animations and icons
jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');
jest.mock('lucide-react-native', () => ({
    Brain: () => 'Brain',
    Sparkles: () => 'Sparkles',
    Clock: () => 'Clock',
    Play: () => 'Play',
    ArrowLeft: () => 'ArrowLeft',
    MoreVertical: () => 'MoreVertical',
    ThumbsUp: () => 'ThumbsUp',
    ThumbsDown: () => 'ThumbsDown',
    RotateCcw: () => 'RotateCcw',
}));

describe('<App />', () => {
    it('renders HomeScreen with welcome message', async () => {
        const { getByText } = render(<App />);

        // Wait for navigation options to settle? Usually not needed for initial render unless async.
        // Check for "Ready to Flip?"
        expect(getByText('Ready to Flip?')).toBeOnTheScreen();
        expect(getByText('Generate AI Deck')).toBeOnTheScreen();
    });
});
