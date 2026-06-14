import React, { useCallback, useEffect, useState } from 'react'
import { View, Alert } from 'react-native'
import * as MediaLibrary from 'expo-media-library'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import useThemeStore from '../stores/themeStore'
import useDeviceMediaStore from '../features/deviceMedia/stores/deviceMediaStore'
import { DEVICE_TABS } from '../features/deviceMedia/utils/mediaUtils'
import { DeviceHeader, EmptyState, LoadingSkeleton, PermissionState } from '../features/deviceMedia/components/DeviceMediaShell'
import VideoExperience from '../features/deviceMedia/components/VideoExperience'
import MusicExperience from '../features/deviceMedia/components/MusicExperience'

const PAGE_SIZE = 80

export default function DeviceMediaScreen({ navigation, embedded = false }) {
  const { theme } = useThemeStore()
  const insets = useSafeAreaInsets()
  const c = theme.colors
  const hydrate = useDeviceMediaStore((state) => state.hydrate)

  const [activeTab, setActiveTab] = useState(DEVICE_TABS.VIDEOS)
  const [mediaPermission, setMediaPermission] = useState(null)
  const [videos, setVideos] = useState([])
  const [music, setMusic] = useState([])
  const [videoCursor, setVideoCursor] = useState(null)
  const [musicCursor, setMusicCursor] = useState(null)
  const [hasMoreVideos, setHasMoreVideos] = useState(false)
  const [hasMoreMusic, setHasMoreMusic] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const hasPermission = mediaPermission?.granted
  const hasLimitedAccess = mediaPermission?.accessPrivileges === 'limited'

  const loadAssets = useCallback(async ({ type, after = null, reset = false }) => {
    const mediaType = type === DEVICE_TABS.VIDEOS
      ? MediaLibrary.MediaType.video
      : MediaLibrary.MediaType.audio

    const result = await MediaLibrary.getAssetsAsync({
      mediaType,
      first: PAGE_SIZE,
      after,
      sortBy: [MediaLibrary.SortBy.creationTime],
      resolveWithFullInfo: false,
    })

    if (type === DEVICE_TABS.VIDEOS) {
      setVideos((current) => reset ? result.assets : [...current, ...result.assets])
      setVideoCursor(result.endCursor)
      setHasMoreVideos(result.hasNextPage)
      return
    }

    setMusic((current) => reset ? result.assets : [...current, ...result.assets])
    setMusicCursor(result.endCursor)
    setHasMoreMusic(result.hasNextPage)
  }, [])

  const loadDeviceLibrary = useCallback(async () => {
    await Promise.all([
      loadAssets({ type: DEVICE_TABS.VIDEOS, reset: true }),
      loadAssets({ type: DEVICE_TABS.MUSIC, reset: true }),
    ])
  }, [loadAssets])

  const requestDeviceMediaAccess = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      await hydrate()
      const available = await MediaLibrary.isAvailableAsync()
      if (!available) {
        setError('This device does not expose a media library to NendPlay.')
        return
      }

      let status = await MediaLibrary.getPermissionsAsync(false, ['video', 'audio'])
      if (!status.granted && status.canAskAgain) {
        status = await MediaLibrary.requestPermissionsAsync(false, ['video', 'audio'])
      }
      setMediaPermission(status)

      if (status.granted) {
        await loadDeviceLibrary()
      }
    } catch {
      setError('Unable to read videos and music from this device.')
      Alert.alert('Device media unavailable', 'Unable to read videos and music from this device.')
    } finally {
      setLoading(false)
    }
  }, [hydrate, loadDeviceLibrary])

  useEffect(() => {
    requestDeviceMediaAccess()
  }, [requestDeviceMediaAccess])

  const loadMore = () => {
    if (loading) return
    if (activeTab === DEVICE_TABS.VIDEOS && hasMoreVideos) {
      loadAssets({ type: DEVICE_TABS.VIDEOS, after: videoCursor })
    }
    if (activeTab === DEVICE_TABS.MUSIC && hasMoreMusic) {
      loadAssets({ type: DEVICE_TABS.MUSIC, after: musicCursor })
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <DeviceHeader
        theme={theme}
        insets={{ ...insets, top: embedded ? 0 : insets.top }}
        navigation={navigation}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {!hasPermission ? (
        loading ? (
          <LoadingSkeleton theme={theme} />
        ) : (
          <PermissionState theme={theme} onRequest={requestDeviceMediaAccess} />
        )
      ) : error ? (
        <EmptyState
          theme={theme}
          icon="alert-circle-outline"
          title="Device media error"
          body={error}
        />
      ) : (
        <>
          {hasLimitedAccess ? (
            <View style={{ margin: 16, padding: 12, borderRadius: 14, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}>
              <EmptyState
                theme={theme}
                icon="albums-outline"
                title="Limited device access"
                body="Android only gave NendPlay access to selected files. Allow full video/audio access in phone settings to show every file."
              />
            </View>
          ) : null}

          {activeTab === DEVICE_TABS.VIDEOS ? (
            <VideoExperience
              theme={theme}
              videos={videos}
              loading={loading}
              loadMore={loadMore}
              hasMore={hasMoreVideos}
            />
          ) : (
            <MusicExperience
              theme={theme}
              music={music}
              loading={loading}
              loadMore={loadMore}
              hasMore={hasMoreMusic}
            />
          )}
        </>
      )}
    </View>
  )
}
