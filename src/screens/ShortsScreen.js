// src/screens/ShortsScreen.js
import React, { useEffect, useRef, useState, useCallback } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Dimensions, ActivityIndicator,
} from 'react-native'
import { Video, ResizeMode } from 'expo-av'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import useThemeStore from '../stores/themeStore'
import { mediaService } from '../services/index'

const { width, height } = Dimensions.get('window')
const ITEM_HEIGHT = height - 100

function ShortItem({ item, isActive, theme }) {
  const videoRef = useRef(null)
  const c = theme.colors
  const [liked, setLiked] = useState(false)
  const [muted, setMuted] = useState(false)
  const [status, setStatus] = useState({})

  useEffect(() => {
    if (videoRef.current) {
      if (isActive) {
        videoRef.current.playAsync()
      } else {
        videoRef.current.pauseAsync()
      }
    }
  }, [isActive])

  const handleLike = async () => {
    try {
      await mediaService.like(item._id)
      setLiked(true)
    } catch {}
  }

  return (
    <View style={{ width, height: ITEM_HEIGHT, backgroundColor: '#000' }}>
      <Video
        ref={videoRef}
        source={{ uri: mediaService.getStreamUrl(item._id) }}
        style={{ width, height: ITEM_HEIGHT }}
        resizeMode={ResizeMode.COVER}
        isLooping
        isMuted={muted}
        onPlaybackStatusUpdate={setStatus}
      />

      {/* Overlay gradient */}
      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: 200, justifyContent: 'flex-end', padding: 16,
        backgroundColor: 'rgba(0,0,0,0)',
      }}>
        {/* Info */}
        <View style={{ flex: 1, justifyContent: 'flex-end', marginRight: 60 }}>
          <Text style={{ color: 'white', fontSize: 16, fontWeight: '800', marginBottom: 4 }}>
            {item.title}
          </Text>
          {item.uploadedBy?.username && (
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
              @{item.uploadedBy.username}
            </Text>
          )}
        </View>

        {/* Side actions */}
        <View style={{
          position: 'absolute', right: 16, bottom: 16,
          alignItems: 'center', gap: 20,
        }}>
          <TouchableOpacity onPress={handleLike} style={{ alignItems: 'center' }}>
            <Ionicons
              name={liked ? 'heart' : 'heart-outline'}
              size={30} color={liked ? '#EF4444' : 'white'} />
            <Text style={{ color: 'white', fontSize: 12, marginTop: 4 }}>
              {(item.likeCount || 0) + (liked ? 1 : 0)}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setMuted(!muted)} style={{ alignItems: 'center' }}>
            <Ionicons
              name={muted ? 'volume-mute' : 'volume-high'}
              size={26} color="white" />
          </TouchableOpacity>

          <TouchableOpacity style={{ alignItems: 'center' }}>
            <Ionicons name="share-outline" size={26} color="white" />
            <Text style={{ color: 'white', fontSize: 12, marginTop: 4 }}>Share</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Duration badge */}
      {item.duration > 0 && (
        <View style={{
          position: 'absolute', top: 50, right: 16,
          backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 6,
          paddingHorizontal: 8, paddingVertical: 3,
        }}>
          <Text style={{ color: 'white', fontSize: 11, fontFamily: 'monospace' }}>
            {Math.floor(item.duration / 60)}:{String(Math.floor(item.duration % 60)).padStart(2, '0')}
          </Text>
        </View>
      )}
    </View>
  )
}

export default function ShortsScreen() {
  const { theme } = useThemeStore()
  const insets = useSafeAreaInsets()
  const c = theme.colors

  const [shorts, setShorts] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeIndex, setActiveIndex] = useState(0)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)

  useEffect(() => { fetchShorts() }, [page])

  const fetchShorts = async () => {
    try {
      const res = await mediaService.getShorts({ page, limit: 10 })
      const { media, pagination } = res.data.data
      setShorts(prev => page === 1 ? media : [...prev, ...media])
      setHasMore(page < pagination.pages)
    } catch {} finally { setLoading(false) }
  }

  const onViewableItemsChanged = useCallback(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setActiveIndex(viewableItems[0].index)
    }
  }, [])

  const viewabilityConfig = { itemVisiblePercentThreshold: 70 }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={c.primary} size="large" />
      </View>
    )
  }

  if (shorts.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <Text style={{ fontSize: 40 }}>⚡</Text>
        <Text style={{ color: c.text, fontSize: 18, fontWeight: '700' }}>No Shorts yet</Text>
        <Text style={{ color: c.textMuted, fontSize: 14 }}>
          Upload videos under 3 minutes
        </Text>
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {/* Header overlay */}
      <View style={{
        position: 'absolute', top: insets.top + 8, left: 0, right: 0,
        zIndex: 10, paddingHorizontal: 16,
      }}>
        <Text style={{ color: 'white', fontSize: 20, fontWeight: '800' }}>Shorts</Text>
      </View>

      <FlatList
        data={shorts}
        keyExtractor={(item) => item._id}
        renderItem={({ item, index }) => (
          <ShortItem item={item} isActive={index === activeIndex} theme={theme} />
        )}
        pagingEnabled
        snapToInterval={ITEM_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(_, index) => ({
          length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index,
        })}
        onEndReached={() => { if (hasMore) setPage(p => p + 1) }}
        onEndReachedThreshold={0.5}
      />
    </View>
  )
}
