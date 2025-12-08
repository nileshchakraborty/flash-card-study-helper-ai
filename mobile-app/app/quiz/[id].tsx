import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, Dimensions } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    runOnJS
} from 'react-native-reanimated';
import { api } from '../../lib/axios';
import { Deck, Flashcard } from '../../types';
import { IconSymbol } from '@/components/ui/icon-symbol';

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function QuizScreen() {
    const { id } = useLocalSearchParams();
    const [deck, setDeck] = useState<Deck | null>(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    // Animation values
    const translateX = useSharedValue(0);
    const rotate = useSharedValue(0);
    const cardOpacity = useSharedValue(1);

    useEffect(() => {
        fetchDeck();
    }, [id]);

    const fetchDeck = async () => {
        try {
            const response = await api.get(`/decks/${id}`);
            setDeck(response.data);
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Failed to load deck');
            router.back();
        } finally {
            setLoading(false);
        }
    };

    const handleFlip = () => {
        setIsFlipped(!isFlipped);
    };

    const nextCard = () => {
        if (deck && currentIndex < deck.cards.length - 1) {
            setCurrentIndex(currentIndex + 1);
            setIsFlipped(false);
            translateX.value = 0;
            rotate.value = 0;
            cardOpacity.value = 1;
        } else {
            Alert.alert('Quiz Complete!', 'You reached the end of the deck.', [
                { text: 'Finish', onPress: () => router.back() }
            ]);
        }
    };

    const handleVote = (direction: 'left' | 'right') => {
        const isRight = direction === 'right';
        const translateDest = isRight ? SCREEN_WIDTH * 1.5 : -SCREEN_WIDTH * 1.5;
        const rotateDest = isRight ? 15 : -15;

        translateX.value = withTiming(translateDest, { duration: 300 });
        rotate.value = withTiming(rotateDest, { duration: 300 });
        cardOpacity.value = withTiming(0, { duration: 300 }, (finished) => {
            if (finished) {
                runOnJS(nextCard)();
            }
        });
    };

    const cardStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value },
            { rotate: `${rotate.value}deg` }
        ],
        opacity: cardOpacity.value,
    }));

    if (loading || !deck) {
        return (
            <View className="flex-1 justify-center items-center bg-gray-50">
                <ActivityIndicator size="large" color="#2563EB" />
            </View>
        );
    }

    const currentCard = deck.cards[currentIndex];

    return (
        <SafeAreaView className="flex-1 bg-gray-100">
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header */}
            <View className="flex-row justify-between items-center px-4 py-2">
                <TouchableOpacity onPress={() => router.back()} className="p-2">
                    <IconSymbol name="xmark" size={24} color="#374151" />
                </TouchableOpacity>
                <Text className="text-gray-600 font-medium">
                    {currentIndex + 1} / {deck.cards.length}
                </Text>
                <View className="w-8" />
            </View>

            <View className="flex-1 justify-center items-center px-4">
                {currentCard ? (
                    <Animated.View style={[{ width: '100%', height: '65%' }, cardStyle]}>
                        <TouchableOpacity
                            activeOpacity={0.9}
                            onPress={handleFlip}
                            className="w-full h-full bg-white rounded-3xl shadow-xl border border-gray-200 justify-center items-center p-6"
                        >
                            <Text className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">
                                {isFlipped ? 'Answer' : 'Question'}
                            </Text>
                            <Text className="text-2xl text-center text-gray-800 font-medium leading-8">
                                {isFlipped ? currentCard.back : currentCard.front}
                            </Text>
                            <Text className="absolute bottom-6 text-gray-400 text-xs">
                                Tap to flip
                            </Text>
                        </TouchableOpacity>
                    </Animated.View>
                ) : (
                    <Text>No cards available</Text>
                )}
            </View>

            {/* Controls */}
            <View className="flex-row justify-center gap-6 mb-10 px-6">
                <TouchableOpacity
                    className="w-16 h-16 bg-red-100 rounded-full justify-center items-center shadow-sm"
                    onPress={() => handleVote('left')}
                >
                    <IconSymbol name="xmark" size={32} color="#EF4444" />
                </TouchableOpacity>

                <TouchableOpacity
                    className="w-16 h-16 bg-green-100 rounded-full justify-center items-center shadow-sm"
                    onPress={() => handleVote('right')}
                >
                    <IconSymbol name="checkmark" size={32} color="#10B981" />
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}
