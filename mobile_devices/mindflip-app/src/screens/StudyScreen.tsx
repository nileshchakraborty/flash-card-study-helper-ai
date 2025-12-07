import React from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity } from 'react-native';
import { GradientBackground } from '../components/GradientBackground';
import { Flashcard } from '../components/Flashcard';
import { theme } from '../theme';
import { ChevronLeft, MoreVertical, X, Check } from 'lucide-react-native';

export const StudyScreen = ({ navigation }: any) => {
    return (
        <GradientBackground>
            <SafeAreaView style={styles.safeArea}>

                {/* Top Navbar */}
                <View style={styles.navbar}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.navButton}>
                        <ChevronLeft size={24} color={theme.colors.textPrimary} />
                    </TouchableOpacity>
                    <View style={styles.progressContainer}>
                        <Text style={styles.progressText}>12 / 50</Text>
                        <View style={styles.progressBar}>
                            <View style={styles.progressFill} />
                        </View>
                    </View>
                    <TouchableOpacity style={styles.navButton}>
                        <MoreVertical size={24} color={theme.colors.textPrimary} />
                    </TouchableOpacity>
                </View>

                {/* Content Area */}
                <View style={styles.content}>
                    <Flashcard
                        front="What is the primary function of the hippocampus regarding memory?"
                        back="The hippocampus is responsible for the formation of new declarative memories and spatial navigation."
                    />
                </View>

                {/* Controls */}
                <View style={styles.controls}>
                    <TouchableOpacity style={[styles.controlButton, styles.buttonMissed]}>
                        <X size={32} color={theme.colors.error} />
                    </TouchableOpacity>

                    <View style={styles.spacer} />

                    <TouchableOpacity style={[styles.controlButton, styles.buttonGotIt]}>
                        <Check size={32} color={theme.colors.success} />
                    </TouchableOpacity>
                </View>

            </SafeAreaView>
        </GradientBackground>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
    },
    navbar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: theme.spacing.m,
        paddingVertical: theme.spacing.s,
        justifyContent: 'space-between',
    },
    navButton: {
        padding: 8,
        borderRadius: 20,
        backgroundColor: theme.colors.surface,
    },
    progressContainer: {
        flex: 1,
        alignItems: 'center',
        marginHorizontal: theme.spacing.l,
    },
    progressText: {
        ...theme.typography.caption,
        color: theme.colors.textSecondary,
        marginBottom: 4,
        fontWeight: '600',
    },
    progressBar: {
        width: '100%',
        height: 4,
        backgroundColor: 'rgba(0,0,0,0.05)',
        borderRadius: 2,
    },
    progressFill: {
        width: '24%',
        height: '100%',
        backgroundColor: theme.colors.primary,
        borderRadius: 2,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    controls: {
        flexDirection: 'row',
        paddingHorizontal: theme.spacing.xl,
        paddingBottom: theme.spacing.xl * 1.5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    controlButton: {
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
        ...theme.shadows.card,
    },
    buttonMissed: {
        borderColor: 'rgba(239, 68, 68, 0.2)',
    },
    buttonGotIt: {
        borderColor: 'rgba(16, 185, 129, 0.2)',
    },
    spacer: {
        width: 40,
    }
});
