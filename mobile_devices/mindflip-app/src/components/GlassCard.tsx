import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { theme } from '../theme';

interface Props {
    children: React.ReactNode;
    style?: ViewStyle;
}

export const GlassCard: React.FC<Props> = ({ children, style }) => {
    return (
        <View style={[styles.card, style]}>
            {children}
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: theme.colors.surface,
        borderRadius: theme.borderRadius.l, // 24px matches web .card-stack
        padding: theme.spacing.m,
        borderWidth: 1,
        borderColor: theme.colors.border,
        ...theme.shadows.card,
    },
});
