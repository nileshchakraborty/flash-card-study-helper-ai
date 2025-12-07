export const theme = {
    colors: {
        // Backgrounds
        background: '#f5f7fa', // Light gray-blue
        surface: 'rgba(255, 255, 255, 0.7)', // White glass
        surfaceLight: 'rgba(255, 255, 255, 0.9)',

        // Brand Gradients (Start/End colors for LinearGradient)
        primaryGradient: ['#667eea', '#764ba2'], // Blue to Purple
        secondaryGradient: ['#f093fb', '#f5576c'], // Pink to Red
        successGradient: ['#4facfe', '#00f2fe'], // Blue to Cyan
        backgroundGradient: ['#f5f7fa', '#c3cfe2'], // Light background

        // Brand Colors (Solids)
        primary: '#667eea',
        primaryDark: '#4c63d2',
        secondary: '#f093fb',
        success: '#10B981',
        error: '#ef4444',

        // Text
        textPrimary: '#1f2937', // Gray 800
        textSecondary: '#4b5563', // Gray 600
        textMuted: '#9ca3af', // Gray 400
        textLight: '#ffffff', // For buttons/dark backgrounds

        // UI Elements
        border: 'rgba(102, 126, 234, 0.2)', // Light blue tint
    },
    typography: {
        h1: { fontSize: 32, fontWeight: '700', color: '#1f2937' },
        h2: { fontSize: 24, fontWeight: '600', color: '#1f2937' },
        h3: { fontSize: 20, fontWeight: '600', color: '#1f2937' },
        body: { fontSize: 16, color: '#4b5563' },
        caption: { fontSize: 12, color: '#6b7280' },
    },
    spacing: {
        s: 8,
        m: 16,
        l: 24,
        xl: 32,
    },
    borderRadius: {
        s: 8,
        m: 16,
        l: 24,
        xl: 32,
    },
    shadows: {
        card: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.1,
            shadowRadius: 15,
            elevation: 5,
        },
        cardHover: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 20 },
            shadowOpacity: 0.15,
            shadowRadius: 25,
            elevation: 10,
        }
    }
};
