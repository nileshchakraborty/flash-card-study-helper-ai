import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../lib/axios';
import { Deck } from '../../types';
import { useAuth } from '../../context/auth';

export default function DashboardScreen() {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();
  const { logout, user } = useAuth();

  const fetchDecks = async () => {
    try {
      // Mock endpoint if backend doesn't support listing yet, or use /api/decks
      // Assuming GET /api/decks returns { decks: Deck[] } or Deck[] or { history: Deck[] }
      const response = await api.get('/decks');
      setDecks(Array.isArray(response.data) ? response.data : response.data.decks || response.data.history || []);
    } catch (error) {
      console.error(error);
      // Fallback for demo if backend isn't ready
      // Alert.alert('Error', 'Failed to load decks');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDecks();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDecks();
  };

  const renderDeckItem = ({ item }: { item: Deck }) => (
    <TouchableOpacity
      className="bg-white p-4 rounded-xl shadow-sm mb-3 border border-gray-100"
      onPress={() => router.push(`/quiz/${item.id}`)}
    >
      <View className="flex-row justify-between items-center">
        <View>
          <Text className="text-lg font-bold text-gray-800">{item.title || item.topic}</Text>
          <Text className="text-gray-500 text-sm">{item.cards?.length || 0} cards</Text>
        </View>
        <View className="bg-blue-100 px-3 py-1 rounded-full">
          <Text className="text-blue-600 font-medium text-xs">Study</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-50 p-4">
      <View className="flex-row justify-between items-center mb-6">
        <View>
          <Text className="text-2xl font-bold text-gray-900">My Library</Text>
          {user && <Text className="text-gray-500">Hello, {user.email?.split('@')[0]}</Text>}
        </View>
        <TouchableOpacity onPress={logout} className="p-2">
          <Text className="text-red-500 font-medium">Logout</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      ) : (
        <FlatList
          data={decks}
          renderItem={renderDeckItem}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View className="items-center justify-center mt-20">
              <Text className="text-gray-400 text-lg mb-2">No decks found</Text>
              <Text className="text-gray-400 text-center px-10">
                Go to the "Create" tab to generate your first flashcard deck!
              </Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
    </SafeAreaView>
  );
}
