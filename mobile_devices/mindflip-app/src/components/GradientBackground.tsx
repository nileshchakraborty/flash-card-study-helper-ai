import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme';

interface Props {
    children: React.ReactNode;
    style?: ViewStyle;
}

export const GradientBackground: React.FC<Props> = ({ children, style }) => {
    return (
        <LinearGradient
            colors={theme.colors.backgroundGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.container, style]}
        >
            {children}
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
});
