import React, { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator, Alert, FlatList, Image, KeyboardAvoidingView,
  Platform, Share, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { VideoView, useVideoPlayer } from 'expo-video'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import useAuthStore from '../services/authStore.native'
import { newsService } from '../services/index'

const BLUE = '#5B5CF6'
const TEXT = '#070707'
const MUTED = '#777C86'
const BORDER = '#ECEEF2'
const PUBLIC_WEB_URL = 'https://nendplay.com'

function timeAgo(value) {
  if (!value) return 'Today'
  const diff = Date.now() - new Date(value).getTime()
  if (Number.isNaN(diff) || diff < 0) return 'Today'
  const minutes = Math.floor(diff / 60000)
  if (minutes < 60) return `${Math.max(minutes, 1)} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  return days === 1 ? 'Yesterday' : `${days} days ago`
}

function NewsVideo({ item }) {
  const player = useVideoPlayer({ uri: item.url }, (player) => {
    player.loop = false
  })
  return (
    <VideoView
      player={player}
      style={styles.video}
      allowsFullscreen
      allowsPictureInPicture
      nativeControls
      contentFit="contain"
    />
  )
}

function CommentItem({ item, onReply, onLike }) {
  const user = item.user || {}
  const name = user.profileName || user.username || 'NendPlay user'
  const replies = item.replies || []
  return (
    <View style={styles.commentBlock}>
      <View style={styles.commentRow}>
        {user.profilePic ? (
          <Image source={{ uri: user.profilePic }} style={styles.commentAvatar} />
        ) : (
          <View style={styles.commentFallback}>
            <Text style={styles.commentFallbackText}>{name.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.commentName}>{name}</Text>
          <Text style={styles.commentText}>{item.text}</Text>
          <View style={styles.commentMetaRow}>
            <Text style={styles.commentTime}>{timeAgo(item.createdAt)}</Text>
            <TouchableOpacity onPress={() => onReply(item)}>
              <Text style={styles.replyText}>Reply</Text>
            </TouchableOpacity>
          </View>
        </View>
        <TouchableOpacity onPress={() => onLike(item)}>
          <Ionicons name="heart-outline" size={24} color="#222" />
          {item.likeCount > 0 ? <Text style={styles.tinyCount}>{item.likeCount}</Text> : null}
        </TouchableOpacity>
      </View>
      {replies.length > 0 && (
        <View style={styles.replyList}>
          {replies.map((reply, index) => {
            const replyUser = reply.user || {}
            const replyName = replyUser.profileName || replyUser.username || 'NendPlay user'
            return (
              <View key={reply._id || index} style={styles.replyRow}>
                {replyUser.profilePic ? (
                  <Image source={{ uri: replyUser.profilePic }} style={styles.replyAvatar} />
                ) : (
                  <View style={styles.replyFallback}>
                    <Text style={styles.replyFallbackText}>{replyName.charAt(0).toUpperCase()}</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.replyName}>{replyName}</Text>
                  <Text style={styles.replyBody}>{reply.text}</Text>
                  <Text style={styles.commentTime}>{timeAgo(reply.createdAt)}</Text>
                </View>
              </View>
            )
          })}
        </View>
      )}
    </View>
  )
}

function NewsAudio({ item }) {
  const player = useVideoPlayer({ uri: item.url }, (player) => {
    player.loop = false
  })
  return (
    <View style={styles.audioCard}>
      <View style={styles.audioHeader}>
        <Ionicons name="musical-notes-outline" size={18} color={BLUE} />
        <Text style={styles.audioTitle}>Audio report</Text>
      </View>
      <VideoView
        player={player}
        style={styles.audio}
        nativeControls
      />
    </View>
  )
}

export default function NewsDetailScreen({ route, navigation }) {
  const insets = useSafeAreaInsets()
  const { isAuthenticated } = useAuthStore()
  const initialArticle = route.params?.article
  const newsId = route.params?.newsId || initialArticle?._id || initialArticle?.id
  const [post, setPost] = useState(initialArticle || null)
  const [loading, setLoading] = useState(Boolean(newsId))
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [replyTarget, setReplyTarget] = useState(null)

  const videos = useMemo(() => (post?.mediaFiles || []).filter((item) => item.type === 'video'), [post])
  const audios = useMemo(() => (post?.mediaFiles || []).filter((item) => item.type === 'audio'), [post])
  const images = useMemo(() => (post?.mediaFiles || []).filter((item) => item.type === 'image'), [post])
  const paragraphs = useMemo(() => String(post?.body || '').split(/\n{2,}/).filter(Boolean), [post])

  useEffect(() => {
    if (!newsId) return
    loadPost()
  }, [newsId])

  const loadPost = async () => {
    setLoading(true)
    try {
      const res = await newsService.getPost(newsId)
      setPost(res.data.data.post)
    } catch {
      Alert.alert('News unavailable', 'This news post could not be loaded.')
      navigation.goBack()
    } finally {
      setLoading(false)
    }
  }

  const sharePost = async () => {
    if (!post) return
    try {
      if (post.id || post._id) await newsService.share(post.id || post._id)
      await Share.share({
        title: post.header || post.title,
        message: `${post.header || post.title}\n${PUBLIC_WEB_URL}/news/${post.id || post._id}`,
      })
      setPost((current) => current ? { ...current, shareCount: (current.shareCount || 0) + 1 } : current)
    } catch {}
  }

  const submitComment = async () => {
    if (!isAuthenticated) {
      Alert.alert('Login Required', 'Please login to comment on news.')
      return
    }
    if (!comment.trim()) return
    setSubmitting(true)
    try {
      const res = replyTarget
        ? await newsService.reply(newsId, replyTarget._id, { text: comment.trim() })
        : await newsService.comment(newsId, { text: comment.trim() })
      setPost(res.data.data.post)
      setComment('')
      setReplyTarget(null)
    } catch {
      Alert.alert(replyTarget ? 'Reply failed' : 'Comment failed', 'Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const likePost = async () => {
    if (!isAuthenticated) {
      Alert.alert('Login Required', 'Please login to like news.')
      return
    }
    try {
      const res = await newsService.like(newsId)
      const data = res.data?.data || {}
      setPost((current) => current ? { ...current, likeCount: data.likeCount ?? current.likeCount } : current)
    } catch {
      Alert.alert('Like failed', 'Please try again.')
    }
  }

  const likeComment = async (item) => {
    if (!isAuthenticated) {
      Alert.alert('Login Required', 'Please login to like comments.')
      return
    }
    try {
      const res = await newsService.likeComment(newsId, item._id)
      setPost(res.data.data.post)
    } catch {
      Alert.alert('Like failed', 'Please try again.')
    }
  }

  if (loading || !post) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={BLUE} size="large" />
      </View>
    )
  }

  const comments = post.comments || []

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <FlatList
        data={comments}
        keyExtractor={(item, index) => `${item._id || index}`}
        ListHeaderComponent={(
          <View>
            <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
                <Ionicons name="chevron-back" size={28} color={TEXT} />
              </TouchableOpacity>
              <Text style={styles.headerBrand}>NendPlay News</Text>
              <TouchableOpacity onPress={sharePost} style={styles.headerButton}>
                <Ionicons name="share-social-outline" size={25} color={TEXT} />
              </TouchableOpacity>
            </View>

            <View style={styles.article}>
              <Text style={styles.title}>{post.header || post.title}</Text>
              {post.subHeader ? <Text style={styles.subTitle}>{post.subHeader}</Text> : null}
              <View style={styles.metaRow}>
                <Text style={styles.source}>{post.source || 'NendPlay News'}</Text>
                <Text style={styles.meta}>{timeAgo(post.publishedAt)}</Text>
              </View>

              {videos.map((item, index) => <NewsVideo key={`video-${index}`} item={item} />)}
              {audios.map((item, index) => <NewsAudio key={`audio-${index}`} item={item} />)}
              {images.map((item, index) => (
                <Image key={`image-${index}`} source={{ uri: item.url }} style={styles.image} resizeMode="cover" />
              ))}

              {paragraphs.map((text, index) => (
                <React.Fragment key={`paragraph-${index}`}>
                  <Text style={styles.paragraph}>{text}</Text>
                  {post.adsEnabled && index === 0 ? (
                    <View style={styles.adBox}>
                      <Text style={styles.adLabel}>Sponsored</Text>
                      <Text style={styles.adTitle}>NendPlay ad placement</Text>
                      <Text style={styles.adText}>Ads appear between article paragraphs when available.</Text>
                    </View>
                  ) : null}
                </React.Fragment>
              ))}

              <View style={styles.actions}>
                <TouchableOpacity style={styles.action}>
                  <Ionicons name="chatbubble-ellipses-outline" size={25} color={TEXT} />
                  <Text style={styles.actionText}>{post.commentCount || comments.length}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.action} onPress={likePost}>
                  <Ionicons name="heart-outline" size={27} color={TEXT} />
                  <Text style={styles.actionText}>{post.likeCount || 0}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.action} onPress={sharePost}>
                  <Ionicons name="share-social-outline" size={27} color={TEXT} />
                  <Text style={styles.actionText}>{post.shareCount || 0}</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.commentsTitle}>All comments</Text>
            </View>
          </View>
        )}
        renderItem={({ item }) => (
          <CommentItem
            item={item}
            onReply={(target) => setReplyTarget(target)}
            onLike={likeComment}
          />
        )}
        ListEmptyComponent={<Text style={styles.emptyComments}>No comments yet. Start the conversation.</Text>}
        contentContainerStyle={{ paddingBottom: 110 }}
      />

      <View style={[styles.commentBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        {replyTarget && (
          <View style={styles.replyBanner}>
            <Text style={styles.replyBannerText} numberOfLines={1}>
              Replying to {replyTarget.user?.profileName || replyTarget.user?.username || 'comment'}
            </Text>
            <TouchableOpacity onPress={() => setReplyTarget(null)}>
              <Ionicons name="close" size={18} color={MUTED} />
            </TouchableOpacity>
          </View>
        )}
        <TextInput
          value={comment}
          onChangeText={setComment}
          placeholder={replyTarget ? 'Write a reply' : "Let's talk about it"}
          placeholderTextColor={MUTED}
          style={styles.commentInput}
        />
        <TouchableOpacity disabled={submitting} onPress={submitComment} style={styles.sendButton}>
          <Ionicons name="send" size={21} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  headerButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  headerBrand: { color: TEXT, fontSize: 22, fontWeight: '900' },
  article: { padding: 20 },
  title: { color: TEXT, fontSize: 32, lineHeight: 40, fontWeight: '900' },
  subTitle: { color: '#3E4651', fontSize: 18, lineHeight: 26, marginTop: 12, fontWeight: '600' },
  metaRow: { flexDirection: 'row', gap: 16, marginTop: 20, marginBottom: 22 },
  source: { color: MUTED, fontSize: 15, fontWeight: '700' },
  meta: { color: MUTED, fontSize: 15 },
  video: { width: '100%', height: 230, backgroundColor: '#000', marginBottom: 18 },
  audioCard: {
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: '#F7F7FF',
    borderRadius: 18,
    padding: 14,
    marginBottom: 18,
  },
  audioHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  audioTitle: { color: MUTED, fontSize: 14, fontWeight: '800' },
  audio: { width: '100%', height: 56, backgroundColor: '#101022', borderRadius: 12 },
  image: { width: '100%', height: 260, backgroundColor: BORDER, marginBottom: 18 },
  paragraph: { color: TEXT, fontSize: 24, lineHeight: 36, marginBottom: 22 },
  adBox: {
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: '#FAFAFA',
    padding: 18,
    marginBottom: 26,
  },
  adLabel: { color: MUTED, fontSize: 12, alignSelf: 'flex-end', marginBottom: 8 },
  adTitle: { color: TEXT, fontSize: 20, fontWeight: '900' },
  adText: { color: MUTED, fontSize: 15, marginTop: 6 },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: BORDER,
    paddingVertical: 16,
    marginTop: 10,
  },
  action: { alignItems: 'center', gap: 4 },
  actionText: { color: TEXT, fontSize: 13 },
  commentsTitle: { color: TEXT, fontSize: 24, fontWeight: '900', marginTop: 30 },
  commentBlock: { paddingVertical: 4 },
  commentRow: { flexDirection: 'row', gap: 13, paddingHorizontal: 20, paddingVertical: 15 },
  commentAvatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: BORDER },
  commentFallback: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#C9F4F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentFallbackText: { color: '#08736F', fontWeight: '900', fontSize: 18 },
  commentName: { color: TEXT, fontSize: 18, fontWeight: '900' },
  commentText: { color: TEXT, fontSize: 18, lineHeight: 27, marginTop: 5 },
  commentMetaRow: { flexDirection: 'row', gap: 16, alignItems: 'center', marginTop: 8 },
  commentTime: { color: '#A0A4AA', fontSize: 14, marginTop: 8, fontWeight: '700' },
  replyText: { color: MUTED, fontSize: 14, fontWeight: '900' },
  tinyCount: { color: MUTED, fontSize: 11, textAlign: 'center', marginTop: 2 },
  replyList: { marginLeft: 78, marginRight: 20, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: BORDER },
  replyRow: { flexDirection: 'row', gap: 10, paddingVertical: 10 },
  replyAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: BORDER },
  replyFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EEF0FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  replyFallbackText: { color: BLUE, fontWeight: '900', fontSize: 13 },
  replyName: { color: TEXT, fontSize: 14, fontWeight: '900' },
  replyBody: { color: TEXT, fontSize: 15, lineHeight: 22, marginTop: 3 },
  emptyComments: { color: MUTED, textAlign: 'center', paddingTop: 20 },
  commentBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  replyBanner: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    backgroundColor: '#F7F7FF',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  replyBannerText: { color: MUTED, fontSize: 13, fontWeight: '800', flex: 1 },
  commentInput: {
    flex: 1,
    minHeight: 48,
    borderRadius: 24,
    backgroundColor: '#F0F1F3',
    paddingHorizontal: 18,
    color: TEXT,
    fontSize: 16,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: BLUE,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
