import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../lib/axios';

export default function CreateDeckScreen() {
  const [topic, setTopic] = useState('');
  const [amount, setAmount] = useState('10');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleGenerate = async () => {
    if (!topic) {
      Alert.alert('Error', 'Please enter a topic');
      return;
    }

    setIsLoading(true);
    try {
      // POST /api/generate
      const response = await api.post('/generate', {
        topic,
        amount: parseInt(amount) || 10,
      });

      // Assuming backend returns { deckId: string } or similar upon creation
      // If it just returns cards, we might need to "save" them or handled differently
      // For now, let's assume it creates a deck or we can redirect to dashboard

      Alert.alert('Success', 'Deck generated successfully!', [
        { text: 'OK', onPress: () => router.push('/(tabs)') }
      ]);
    } catch (error: any) {
      console.error(error);
      Alert.alert('Generation Failed', error.response?.data?.message || 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <View className="mb-8 mt-4">
            <Text className="text-3xl font-bold text-gray-900">Create New Deck</Text>
            <Text className="text-gray-500 mt-2">Generate AI flashcards from any topic</Text>
          </View>

          <View className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6">
            <View className="mb-4">
              <Text className="text-sm font-medium text-gray-700 mb-2">Topic</Text>
              <TextInput
                className="w-full h-12 px-4 border border-gray-300 rounded-lg focus:border-blue-500 bg-gray-50"
                placeholder="e.g. Photosynthesis, WebSockets, Roman History"
                value={topic}
                onChangeText={setTopic}
                multiline
              />
            </View>

            <View className="mb-6">
              <Text className="text-sm font-medium text-gray-700 mb-2">Number of Cards</Text>
              <View className="flex-row gap-3">
                {['5', '10', '15', '20'].map((val) => (
                  <TouchableOpacity
                    key={val}
                    onPress={() => setAmount(val)}
                    className={`px-4 py-2 rounded-full border ${amount === val
                        ? 'bg-blue-600 border-blue-600'
                        : 'bg-white border-gray-300'
                      }`}
                  >
                    <Text className={amount === val ? 'text-white font-medium' : 'text-gray-700'}>
                      {val}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity
              className="w-full h-14 bg-blue-600 rounded-xl items-center justify-center shadow-md shadow-blue-200"
              onPress={handleGenerate}
              disabled={isLoading}
            >
              {isLoading ? (
                <View className="flex-row items-center gap-2">
                  <ActivityIndicator color="white" />
                  <Text className="text-white font-bold text-lg">Generating...</Text>
                </View>
              ) : (
                <Text className="text-white font-bold text-lg">Generate Flashcards</Text>
              )}
            </TouchableOpacity>
          </View>

          <View className="items-center">
            <Text className="text-gray-400 text-xs text-center">
              Powered by Ollama & Serper
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
