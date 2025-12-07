import React from 'react';
import { StyleSheet, Text, View, ScrollView, SafeAreaView } from 'react-native';
import { GradientBackground } from '../components/GradientBackground';
import { GlassCard } from '../components/GlassCard';
import { Button } from '../components/Button';
import { theme } from '../theme';
import { Brain, Sparkles, Clock, Play } from 'lucide-react-native';

export const HomeScreen = ({ navigation }: any) => {
    console.log('[HomeScreen] Rendering HomeScreen...');
    return (
        <GradientBackground>
            <SafeAreaView style={styles.safeArea}>
                <ScrollView contentContainerStyle={styles.scrollContent}>

                    {/* Header */}
                    <View style={styles.header}>
                        <View>
                            <Text style={theme.typography.caption}>WELCOME BACK</Text>
                            <Text style={theme.typography.h1}>Ready to Flip?</Text>
                        </View>
                        <View style={styles.avatarPlaceholder} />
                    </View>

                    {/* Daily Streak Card */}
                    <GlassCard style={styles.streakCard}>
                        <View style={styles.streakInfo}>
                            <View style={styles.streakHeader}>
                                <Sparkles size={24} color={theme.colors.secondary} />
                                <Text style={styles.streakTitle}>Daily Streak</Text>
                            </View>
                            <Text style={styles.streakCount}>5 Days</Text>
                            <Text style={theme.typography.caption}>You're on fire! 🔥</Text>
                        </View>
                        {/* Progress Bar Placeholder */}
                        <View style={styles.progressBar}>
                            <View style={styles.progressFill} />
                        </View>
                    </GlassCard>

                    {/* Quick Actions */}
                    <Text style={styles.sectionTitle}>Quick Actions</Text>
                    <View style={styles.actionsGrid}>
                        <GlassCard style={styles.actionCard}>
                            <Brain size={32} color={theme.colors.primary} style={styles.actionIcon} />
                            <Text style={styles.actionTitle}>Generate AI Deck</Text>
                            <Button
                                title="Create"
                                onPress={() => { }}
                                style={styles.actionButton}
                                variant="outline"
                            />
                        </GlassCard>

                        <GlassCard style={styles.actionCard}>
                            <Play size={32} color={theme.colors.secondary} style={styles.actionIcon} />
                            <Text style={styles.actionTitle}>Resume Quiz</Text>
                            <Button
                                title="Resume"
                                onPress={() => navigation.navigate('Study')}
                                style={styles.actionButton}
                            />
                        </GlassCard>
                    </View>

                    {/* Recent Decks */}
                    <Text style={styles.sectionTitle}>Recent Decks</Text>
                    {[1, 2, 3].map((i) => (
                        <GlassCard key={i} style={styles.recentItem}>
                            <View style={styles.recentInfo}>
                                <Text style={styles.recentTitle}>Advanced Neurobiology {i}</Text>
                                <View style={styles.recentMeta}>
                                    <Clock size={12} color={theme.colors.textMuted} />
                                    <Text style={styles.recentTime}>2 hours ago</Text>
                                </View>
                            </View>
                            <Button title="Study" onPress={() => navigation.navigate('Study')} style={{ height: 36, width: 80 }} />
                        </GlassCard>
                    ))}

                </ScrollView>
            </SafeAreaView>
        </GradientBackground>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
    },
    scrollContent: {
        padding: theme.spacing.l,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: theme.spacing.xl,
        marginTop: theme.spacing.m,
    },
    avatarPlaceholder: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: theme.colors.surfaceLight,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    streakCard: {
        marginBottom: theme.spacing.xl,
    },
    streakHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: theme.spacing.s,
    },
    streakTitle: {
        ...theme.typography.h3,
        marginLeft: theme.spacing.s,
    },
    streakInfo: {
        marginBottom: theme.spacing.m,
    },
    streakCount: {
        fontSize: 42,
        fontWeight: '800',
        color: theme.colors.textPrimary,
    },
    progressBar: {
        height: 6,
        backgroundColor: 'rgba(0,0,0,0.05)',
        borderRadius: 3,
    },
    progressFill: {
        width: '70%',
        height: '100%',
        backgroundColor: theme.colors.secondary,
        borderRadius: 3,
    },
    sectionTitle: {
        ...theme.typography.h3,
        marginBottom: theme.spacing.m,
    },
    actionsGrid: {
        flexDirection: 'row',
        gap: theme.spacing.m,
        marginBottom: theme.spacing.xl,
    },
    actionCard: {
        flex: 1,
        padding: theme.spacing.m,
        alignItems: 'center',
    },
    actionIcon: {
        marginBottom: theme.spacing.m,
    },
    actionTitle: {
        ...theme.typography.body,
        fontWeight: '600',
        color: theme.colors.textPrimary,
        marginBottom: theme.spacing.m,
        textAlign: 'center',
    },
    actionButton: {
        width: '100%',
        height: 36,
    },
    recentItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: theme.spacing.m,
        paddingVertical: theme.spacing.m,
    },
    recentInfo: {
        flex: 1,
    },
    recentTitle: {
        ...theme.typography.body,
        fontWeight: '600',
        color: theme.colors.textPrimary,
        marginBottom: 4,
    },
    recentMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    recentTime: {
        ...theme.typography.caption,
    }
});
