import React from 'react';
import { StyleSheet, Text, TouchableOpacity, ViewStyle, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme';

interface Props {
    title: string;
    onPress: () => void;
    variant?: 'primary' | 'secondary' | 'outline';
    loading?: boolean;
    style?: ViewStyle;
}

export const Button: React.FC<Props> = ({
    title,
    onPress,
    variant = 'primary',
    loading = false,
    style
}) => {
    if (variant === 'primary') {
        return (
            <TouchableOpacity onPress={onPress} disabled={loading} style={[styles.container, style]}>
                <LinearGradient
                    colors={theme.colors.primaryGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }} // Diagonal gradient like web
                    style={styles.gradient}
                >
                    {loading ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <Text style={styles.textPrimary}>{title}</Text>
                    )}
                </LinearGradient>
            </TouchableOpacity>
        );
    }

    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={loading}
            style={[styles.container, styles.outline, style]}
        >
            {loading ? (
                <ActivityIndicator color={theme.colors.primary} />
            ) : (
                <Text style={styles.textOutline}>{title}</Text>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        borderRadius: theme.borderRadius.l,
        overflow: 'hidden',
        height: 50,
    },
    gradient: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: theme.spacing.l,
    },
    outline: {
        borderWidth: 1,
        borderColor: theme.colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    textPrimary: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '700',
    },
    textOutline: {
        color: theme.colors.primary,
        fontSize: 16,
        fontWeight: '600',
    },
});
