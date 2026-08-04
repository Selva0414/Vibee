import React, { memo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, ScrollView, Dimensions, Platform, Modal, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from '../components/Icon';
import GenreCard from '../components/GenreCard';
import SongItem from '../components/SongItem';

const { width } = Dimensions.get('window');
const BACKEND_URL = 'https://vibee-hx18.onrender.com'; // Or your deployed backend URL

const SongRecommendations = memo(({ currentTrack, onTrackSelect }) => {
    const [recommendations, setRecommendations] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!currentTrack) return;

        const fetchRecommendations = async () => {
            setLoading(true);
            try {
                // Determine artist name robustly
                const artistName = currentTrack.artist || currentTrack.artists?.primary?.[0]?.name || 'Unknown Artist';
                const url = `${BACKEND_URL}/api/recommendations/lastfm?track=${encodeURIComponent(currentTrack.name)}&artist=${encodeURIComponent(artistName)}`;
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`HTTP status ${response.status}`);
                }
                const data = await response.json();
                
                if (Array.isArray(data)) {
                    // Resolve Last.fm names into real playable songs from our catalog
                    const realSongsPromises = data.slice(0, 10).map(async (item) => {
                        try {
                            const searchUrl = `https://music-api-xandra.vercel.app/api/search/songs?query=${encodeURIComponent(item.name + ' ' + item.artist)}&limit=1`;
                            const searchRes = await fetch(searchUrl);
                            const searchData = await searchRes.json();
                            const rawResult = searchData?.data?.results || searchData?.results || searchData?.data || [];
                            if (rawResult && rawResult.length > 0) {
                                return rawResult[0]; // Return the first matched real song
                            }
                        } catch (e) {
                            console.warn("Failed to resolve song:", item.name);
                        }
                        return null;
                    });
                    
                    const resolvedSongs = (await Promise.all(realSongsPromises)).filter(Boolean);
                    
                    // Format the raw API songs to match the app's structure
                    const formattedSongs = resolvedSongs.map(song => ({
                        id: song.id,
                        name: song.name || song.title,
                        artist: song.primaryArtists || song.artists?.primary?.[0]?.name || song.subtitle || 'Unknown Artist',
                        image: song.image,
                        downloadUrl: song.downloadUrl,
                        media_url: song.media_url,
                        duration: song.duration,
                    }));

                    setRecommendations(formattedSongs);
                } else {
                    console.warn("Last.fm returned non-array:", data);
                    setRecommendations([]);
                }
            } catch (error) {
                console.warn("Error fetching recommendations:", error);
                setRecommendations([]);
            } finally {
                setLoading(false);
            }
        };

        fetchRecommendations();
    }, [currentTrack]);

    if (!currentTrack || (recommendations.length === 0 && !loading)) {
        return null;
    }

    return (
        <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Because you listened to {currentTrack.name}</Text>
            </View>
            {loading ? (
                <View style={{ padding: 20, alignItems: 'center' }}>
                    <ActivityIndicator size="small" color="#9B5DE5" />
                </View>
            ) : (
                <FlatList
                    horizontal
                    data={recommendations}
                    keyExtractor={(item, index) => item.name + index}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.horizontalListContent}
                    renderItem={({ item }) => (
                        <TouchableOpacity style={{ width: 140, marginRight: 16 }} onPress={() => {
                            // Pass the fully resolved real song to the player!
                            onTrackSelect(item, [item]);
                        }}>
                            <Image 
                                source={{ uri: item.image?.[2]?.url || item.image?.[1]?.url || item.image?.[0]?.url || item.image || 'https://via.placeholder.com/150' }} 
                                style={{ width: 140, height: 140, borderRadius: 12, marginBottom: 8 }} 
                            />
                            <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '600' }} numberOfLines={1}>{item.name}</Text>
                            <Text style={{ color: '#B3B3B3', fontSize: 12 }} numberOfLines={1}>{item.artist}</Text>
                        </TouchableOpacity>
                    )}
                />
            )}
        </View>
    );
});

const VerticalSongItem = memo(({ song, isPlaying, isStartingPlayback, startingSongId, onPlay, onLike, isLiked }) => {
    return (
        <TouchableOpacity
            style={styles.verticalItemContainer}
            onPress={() => onPlay(song)}
            activeOpacity={0.7}
        >
            <View style={styles.verticalLeft}>
                <Image
                    source={{ uri: song.image?.[1]?.url || song.image?.[0]?.url }}
                    style={styles.verticalImage}
                />
                <View style={styles.verticalInfo}>
                    <Text style={styles.verticalTitle} numberOfLines={2}>{song.name}</Text>
                    <Text style={styles.verticalArtist} numberOfLines={1}>{song.artist || song.artists?.primary?.[0]?.name}</Text>
                </View>
            </View>
            <TouchableOpacity
                style={styles.likeButton}
                onPress={() => onLike(song)}
            >
                <Icon
                    name={isLiked ? "favorite" : "favorite-border"}
                    size={24}
                    color={isLiked ? "#9B5DE5" : "#B3B3B3"}
                />
            </TouchableOpacity>
        </TouchableOpacity>
    );
});

const VerticalSection = memo(({ title, data, currentSong, isPlaying, isStartingPlayback, startingSongId, onTrackSelect, onLike, likedSongs }) => {
    if (!data || data.length === 0) return null;

    return (
        <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{title}</Text>
            </View>
            <View style={styles.verticalListContainer}>
                {data.slice(0, 10).map((item) => (
                    <VerticalSongItem
                        key={item.id}
                        song={item}
                        isPlaying={currentSong?.id === item.id && isPlaying}
                        isStartingPlayback={isStartingPlayback}
                        startingSongId={startingSongId}
                        onPlay={(song) => onTrackSelect(song, data)}
                        onLike={onLike}
                        isLiked={likedSongs.some(s => s.id === item.id)}
                    />
                ))}
            </View>
        </View>
    );
});

const HorizontalSection = memo(({ title, data, currentSong, isPlaying, isStartingPlayback, startingSongId, onTrackSelect, onShowAll }) => {
    if (!data || data.length === 0) return null;

    return (
        <View style={styles.sectionContainer}>
            <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{title}</Text>
                <TouchableOpacity onPress={() => onShowAll && onShowAll(title)}>
                    <Text style={styles.showAll}>Show all</Text>
                </TouchableOpacity>
            </View>
            <FlatList
                horizontal
                data={data}
                renderItem={({ item }) => (
                    <GenreCard
                        song={item}
                        isPlaying={currentSong?.id === item.id && isPlaying}
                        isStartingPlayback={isStartingPlayback}
                        startingSongId={startingSongId}
                        onPlay={(song) => onTrackSelect(song, data)}
                    />
                )}
                keyExtractor={item => item.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalListContent}
                initialNumToRender={5}
                maxToRenderPerBatch={5}
                windowSize={3}
                removeClippedSubviews={Platform.OS !== 'web'}
            />
        </View>
    );
});

export default memo(function HomeScreen({
    onTrackSelect,
    currentSong,
    isPlaying,
    isStartingPlayback,
    startingSongId,
    onLike,
    likedSongs,
    recentSongs,
    sections,
    loading,
    errorText,
    currentLanguage,
    onLanguagePress,
    languages,
    onLanguageSelect,
    artists,
    onArtistSelect,
    onShowAll,
    onLogout
}) {
    const [menuVisible, setMenuVisible] = useState(false);
    const [profileVisible, setProfileVisible] = useState(false);
    const [userInfo, setUserInfo] = useState(null);

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const info = await AsyncStorage.getItem('@user_info');
                if (info) setUserInfo(JSON.parse(info));
            } catch (e) { console.log('Error fetching user info', e); }
        };
        fetchUser();
    }, []);

    const renderLoading = () => (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.logoRow}>
                    <Text style={styles.headerTitle}>Vibee</Text>
                </View>
            </View>
            <View style={[styles.center, { flex: 1 }]}>
                <Icon name="library-music" size={48} color="#9B5DE5" />
                <Text style={{ color: '#9B5DE5', marginTop: 12, fontWeight: '600' }}>Loading your music...</Text>
            </View>
        </View>
    );

    if (loading && (!sections.trending || sections.trending.length === 0)) {
        return renderLoading();
    }

    if (!loading && (!sections.trending || sections.trending.length === 0) && errorText) {
        return (
            <View style={styles.container}>
                <View style={[styles.center, { flex: 1, paddingHorizontal: 24 }]}>
                    <Text style={{ color: '#FFF', fontWeight: '700', marginBottom: 8, textAlign: 'center' }}>
                        Couldn’t load songs
                    </Text>
                    <Text style={{ color: '#9CA3AF', fontWeight: '600', textAlign: 'center' }}>
                        {errorText}
                    </Text>
                </View>
            </View>
        );
    }

    // Empty State (No Error, but No Data)
    if (!loading && (!sections.trending || sections.trending.length === 0) && !errorText) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <View style={styles.logoRow}>
                        <Text style={styles.headerTitle}>Vibee</Text>
                    </View>
                </View>
                <View style={[styles.center, { flex: 1, paddingHorizontal: 24 }]}>
                    <Icon name="music-off" size={48} color="#333" />
                    <Text style={{ color: '#FFF', fontWeight: '700', marginTop: 16, marginBottom: 8, textAlign: 'center' }}>
                        No songs found
                    </Text>
                    <Text style={{ color: '#9CA3AF', textAlign: 'center' }}>
                        We couldn't find any songs for {languages.find(l => l.id === currentLanguage)?.name || 'this language'}.
                        Try switching languages.
                    </Text>

                    {/* Horizontal Language Pill Menu for quick switch */}
                    <View style={{ marginTop: 24, height: 50 }}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            {languages?.map((lang) => (
                                <TouchableOpacity
                                    key={lang.id}
                                    style={[styles.langChip, currentLanguage === lang.id && styles.activeLangChip, { marginHorizontal: 4 }]}
                                    onPress={() => onLanguageSelect(lang.id)}
                                >
                                    <Text style={[styles.langChipText, currentLanguage === lang.id && styles.activeLangChipText]}>{lang.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Professional Header */}
            <View style={[styles.header, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                <View style={styles.logoRow}>
                    <Text style={styles.headerTitle}>Vibee</Text>
                </View>
                <TouchableOpacity onPress={() => setMenuVisible(true)} style={{ padding: 8 }}>
                    <Icon name="menu" size={28} color="#FFF" />
                </TouchableOpacity>
            </View>

            <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
                <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setMenuVisible(false)}>
                    <View style={{ position: 'absolute', top: 60, right: 20, backgroundColor: '#1E1E1E', borderRadius: 8, padding: 8, elevation: 5, width: 150, zIndex: 100 }}>
                        <TouchableOpacity 
                            style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: '#333' }}
                            onPress={() => { setMenuVisible(false); setProfileVisible(true); }}
                        >
                            <Text style={{ color: '#FFF', fontSize: 16 }}>Profile</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={{ padding: 12 }} onPress={() => { setMenuVisible(false); if(onLogout) onLogout(); }}>
                            <Text style={{ color: '#FF3B30', fontSize: 16 }}>Log out</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Profile Modal */}
            <Modal visible={profileVisible} animationType="fade" transparent onRequestClose={() => setProfileVisible(false)}>
                <TouchableOpacity 
                    style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' }} 
                    activeOpacity={1} 
                    onPress={() => setProfileVisible(false)}
                >
                    <TouchableOpacity 
                        activeOpacity={1} 
                        style={{ width: '85%', backgroundColor: '#1E1E1E', borderRadius: 20, padding: 24, alignItems: 'center', elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5 }}
                    >
                        <TouchableOpacity onPress={() => setProfileVisible(false)} style={{ position: 'absolute', top: 16, right: 16, padding: 4 }}>
                            <Icon name="close" size={24} color="#9CA3AF" />
                        </TouchableOpacity>

                        <Image 
                            source={{ uri: userInfo?.profilePhoto || 'https://ui-avatars.com/api/?name=' + (userInfo?.name || 'User') + '&background=9B5DE5&color=fff&size=128' }} 
                            style={{ width: 100, height: 100, borderRadius: 50, marginBottom: 24, borderWidth: 2, borderColor: '#9B5DE5' }} 
                        />
                        
                        <View style={{ width: '100%', paddingHorizontal: 10 }}>
                            <Text style={{ color: '#9B5DE5', fontSize: 12, textTransform: 'uppercase', fontWeight: 'bold', marginBottom: 4, letterSpacing: 1 }}>Name</Text>
                            <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '600', marginBottom: 16 }}>
                                {userInfo?.name || 'User'}
                            </Text>

                            <Text style={{ color: '#9B5DE5', fontSize: 12, textTransform: 'uppercase', fontWeight: 'bold', marginBottom: 4, letterSpacing: 1 }}>Email</Text>
                            <Text style={{ color: '#FFF', fontSize: 18, fontWeight: '600' }}>
                                {userInfo?.email || 'No email provided'}
                            </Text>
                        </View>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>

            <ScrollView
                style={styles.mainContent}
                showsVerticalScrollIndicator={false}
                removeClippedSubviews={Platform.OS !== 'web'}
                scrollEventThrottle={16}
                contentContainerStyle={{ paddingTop: 16, paddingBottom: 80 }}
            >
                {/* 1. Trending Songs - Latest movie hits */}
                <HorizontalSection
                    title="Trending Songs"
                    data={sections.trending}
                    currentSong={currentSong}
                    isPlaying={isPlaying}
                    isStartingPlayback={isStartingPlayback}
                    startingSongId={startingSongId}
                    onTrackSelect={onTrackSelect}
                    onShowAll={onShowAll}
                />

                {/* 2. Sad Songs */}
                <HorizontalSection
                    title="Sad Songs"
                    data={sections.chill}
                    currentSong={currentSong}
                    isPlaying={isPlaying}
                    isStartingPlayback={isStartingPlayback}
                    startingSongId={startingSongId}
                    onTrackSelect={onTrackSelect}
                    onShowAll={onShowAll}
                />

                {/* 3. Love Songs */}
                <HorizontalSection
                    title="Love Songs"
                    data={sections.item}
                    currentSong={currentSong}
                    isPlaying={isPlaying}
                    isStartingPlayback={isStartingPlayback}
                    startingSongId={startingSongId}
                    onTrackSelect={onTrackSelect}
                    onShowAll={onShowAll}
                />

                {/* 4. Melody Songs */}
                <HorizontalSection
                    title="Melody Songs"
                    data={sections.melody}
                    currentSong={currentSong}
                    isPlaying={isPlaying}
                    isStartingPlayback={isStartingPlayback}
                    startingSongId={startingSongId}
                    onTrackSelect={onTrackSelect}
                    onShowAll={onShowAll}
                />

                {/* 5. Songs for You - Personalized Mix */}
                <VerticalSection
                    title="Songs for You"
                    data={sections.songsForYou}
                    currentSong={currentSong}
                    isPlaying={isPlaying}
                    isStartingPlayback={isStartingPlayback}
                    startingSongId={startingSongId}
                    onTrackSelect={onTrackSelect}
                    onLike={onLike}
                    likedSongs={likedSongs}
                />

                {/* 6. Last.fm Recommendations based on current song */}
                <SongRecommendations 
                    currentTrack={currentSong} 
                    onTrackSelect={onTrackSelect} 
                />

                {/* 7. Recently Played */}
                <HorizontalSection
                    title="Recently Played"
                    data={recentSongs}
                    currentSong={currentSong}
                    isPlaying={isPlaying}
                    isStartingPlayback={isStartingPlayback}
                    startingSongId={startingSongId}
                    onTrackSelect={onTrackSelect}
                />

                {/* Horizontal Artist Selection Menu */}
                <View style={{ marginTop: 24, marginBottom: 40 }}>
                    <Text style={{
                        color: '#FFF',
                        fontSize: 22,
                        fontWeight: 'bold',
                        paddingHorizontal: 20,
                        marginBottom: 16
                    }}>Explore Artists</Text>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ paddingHorizontal: 16 }}
                    >
                        {artists?.map((artist, idx) => (
                            <TouchableOpacity
                                key={idx}
                                activeOpacity={0.7}
                                style={{
                                    backgroundColor: 'rgba(255,255,255,0.06)',
                                    paddingHorizontal: 20,
                                    paddingVertical: 10,
                                    borderRadius: 30,
                                    marginHorizontal: 6,
                                    borderWidth: 1,
                                    borderColor: 'rgba(255,255,255,0.1)'
                                }}
                                onPress={() => onArtistSelect(artist)}
                            >
                                <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '600' }}>{artist}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            </ScrollView>
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    center: {
        justifyContent: 'center',
        alignItems: 'center'
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 15,
        paddingBottom: 10,
    },
    logoRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    logoContainer: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: '#9B5DE5',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
        // Add a subtle shadow for a "professional" feel
        elevation: 4,
        shadowColor: '#9B5DE5',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },
    headerTitle: {
        color: '#FFF',
        fontSize: 32,
        fontWeight: '900',
        letterSpacing: -1.5,
        textTransform: 'lowercase',
    },
    langButton: {
        padding: 8,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    sectionContainer: {
        marginBottom: 32,
    },
    verticalListContainer: {
        paddingHorizontal: 16,
        gap: 12,
    },
    verticalItemContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#121212',
        padding: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
    },
    verticalLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    verticalImage: {
        width: 50,
        height: 50,
        borderRadius: 8,
        marginRight: 16,
    },
    verticalInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    verticalTitle: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 4,
    },
    verticalArtist: {
        color: '#B3B3B3',
        fontSize: 13,
        fontWeight: '500',
    },
    likeButton: {
        padding: 8,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        marginBottom: 16,
    },
    sectionTitle: {
        color: '#FFF',
        fontSize: 20,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    showAll: {
        color: '#B3B3B3',
        fontSize: 12,
        fontWeight: '600',
    },
    horizontalListContent: {
        paddingHorizontal: 16,
    },
    // Language Chips Styles
    languageMenuContainer: {
        paddingVertical: 12,
        marginBottom: 8,
    },
    languageChipsContent: {
        paddingHorizontal: 16,
        gap: 8,
    },
    langChip: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    activeLangChip: {
        backgroundColor: '#FFF',
    },
    langChipText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '600',
    },
    activeLangChipText: {
        color: '#000',
    },
    errorContainer: {
        padding: 20,
        alignItems: 'center',
        marginTop: 20
    },
    errorText: {
        color: '#ff4444',
        textAlign: 'center',
        fontSize: 14
    },
    retryText: {
        color: '#9B5DE5',
        marginTop: 10,
        fontWeight: 'bold'
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 200
    },
    loadingText: {
        color: '#B3B3B3',
        marginTop: 10,
        fontSize: 12
    }
});
