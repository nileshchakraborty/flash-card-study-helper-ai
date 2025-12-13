import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { api } from '../../lib/axios';
import { useAuth } from '../../context/auth';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function RegisterScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();
    const { register } = useAuth();

    const handleRegister = async () => {
        if (!email || !password || !confirmPassword) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        if (password !== confirmPassword) {
            Alert.alert('Error', 'Passwords do not match');
            return;
        }

        setIsLoading(true);
        try {
            // Verify backend supports registration or just use dev-login for MVP
            const response = await api.post('/auth/dev-login', {
                email,
                password,
            });

            const { token, user } = response.data;
            await register(token, user);
        } catch (error: any) {
            console.error(error);
            Alert.alert('Registration Failed', error.response?.data?.message || 'Something went wrong');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-white p-6 justify-center">
            <View className="mb-8">
                <Text className="text-3xl font-bold text-gray-900">Create Account</Text>
                <Text className="text-gray-500 mt-2">Sign up to start learning</Text>
            </View>

            <View className="space-y-4">
                <View>
                    <Text className="text-sm font-medium text-gray-700 mb-1">Email</Text>
                    <TextInput
                        className="w-full h-12 px-4 border border-gray-300 rounded-lg focus:border-blue-500 bg-white"
                        placeholder="Enter your email"
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                        keyboardType="email-address"
                    />
                </View>

                <View>
                    <Text className="text-sm font-medium text-gray-700 mb-1">Password</Text>
                    <TextInput
                        className="w-full h-12 px-4 border border-gray-300 rounded-lg focus:border-blue-500 bg-white"
                        placeholder="Create a password"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                    />
                </View>

                <View>
                    <Text className="text-sm font-medium text-gray-700 mb-1">Confirm Password</Text>
                    <TextInput
                        className="w-full h-12 px-4 border border-gray-300 rounded-lg focus:border-blue-500 bg-white"
                        placeholder="Confirm your password"
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        secureTextEntry
                    />
                </View>

                <TouchableOpacity
                    className="w-full h-12 bg-blue-600 rounded-lg items-center justify-center mt-6"
                    onPress={handleRegister}
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <Text className="text-white font-bold text-lg">Sign Up</Text>
                    )}
                </TouchableOpacity>

                <View className="flex-row justify-center mt-4">
                    <Text className="text-gray-600">Already have an account? </Text>
                    <Link href="/auth/login" asChild>
                        <TouchableOpacity>
                            <Text className="text-blue-600 font-bold">Sign In</Text>
                        </TouchableOpacity>
                    </Link>
                </View>
            </View>
        </SafeAreaView>
    );
}
