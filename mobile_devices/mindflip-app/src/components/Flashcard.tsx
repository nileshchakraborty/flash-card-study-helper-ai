import React, { useState } from 'react';
import { StyleSheet, Text, TouchableWithoutFeedback, View, Dimensions } from 'react-native';
import { theme } from '../theme';
import { GlassCard } from './GlassCard';

interface Props {
    front: string;
    back: string;
}

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.85;
const CARD_HEIGHT = CARD_WIDTH * 1.4;

export const Flashcard: React.FC<Props> = ({ front, back }) => {
    const [isFlipped, setIsFlipped] = useState(false);

    const handleFlip = () => {
        setIsFlipped(!isFlipped);
    };

    return (
        <TouchableWithoutFeedback onPress={handleFlip}>
            <View style={styles.container}>
                {!isFlipped ? (
                    <View style={styles.card}>
                        <GlassCard style={styles.cardContent}>
                            <Text style={styles.label}>QUESTION</Text>
                            <Text style={styles.text}>{front}</Text>
                            <Text style={styles.hint}>Tap to flip</Text>
                        </GlassCard>
                    </View>
                ) : (
                    <View style={styles.card}>
                        <GlassCard style={styles.cardContent}>
                            <Text style={[styles.label, { color: theme.colors.secondary }]}>ANSWER</Text>
                            <Text style={styles.text}>{back}</Text>
                            <Text style={styles.hint}>Tap to flip back</Text>
                        </GlassCard>
                    </View>
                )}
            </View>
        </TouchableWithoutFeedback>
    );
};

const styles = StyleSheet.create({
    container: {
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        alignItems: 'center',
        justifyContent: 'center',
    },
    card: {
        position: 'absolute',
        width: '100%',
        height: '100%',
    },
    cardContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: theme.spacing.xl,
        backgroundColor: '#ffffff', // Explicitly white for cards
    },
    label: {
        ...theme.typography.caption,
        fontSize: 14,
        fontWeight: '700',
        color: theme.colors.primary,
        letterSpacing: 2,
        marginBottom: theme.spacing.l,
        position: 'absolute',
        top: theme.spacing.l,
    },
    text: {
        ...theme.typography.h3,
        textAlign: 'center',
        lineHeight: 28,
        color: theme.colors.textPrimary,
    },
    hint: {
        ...theme.typography.caption,
        position: 'absolute',
        bottom: theme.spacing.l,
        opacity: 0.6,
    }
});
