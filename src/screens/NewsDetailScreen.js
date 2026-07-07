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
import AdBanner from '../components/ads/AdBanner'
import NativeAdvancedAd from '../components/ads/NativeAdvancedAd'
import NendPlayAdCard from '../components/ads/NendPlayAdCard'

const BLUE = '#5B5CF6'
const TEXT = '#070707'
const MUTED = '#777C86'
const BORDER = '#ECEEF2'
const PUBLIC_WEB_URL = 'https://nendplay.com'

function formatDate(value) {
  if (!value) return 'Today'
  try {
    return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value))
  } catch {
    return 'Today'
  }
}

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

function estimateReadTime(text) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean).length
  return `${Math.max(1, Math.ceil(words / 220))} min read`
}

function getCategory(post) {
  const value = post?.categories?.[0] || post?.category || post?.section || 'News'
  return String(value).replace(/[-_]/g, ' ')
}

function isQuoteParagraph(text) {
  const trimmed = String(text || '').trim()
  return trimmed.startsWith('"') || trimmed.startsWith('“') || trimmed.startsWith("'") || trimmed.startsWith('‘')
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
  const category = getCategory(post)
  const heroVideo = videos[0]
  const heroImage = images[0]
  const remainingVideos = videos.slice(1)
  const remainingImages = images.slice(heroImage ? 1 : 0)
  const readTime = estimateReadTime(post.body)

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <FlatList
        data={comments}
        keyExtractor={(item, index) => `${item._id || index}`}
        ListHeaderComponent={(
          <View>
            <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
                <Ionicons name="chevron-back" size={27} color="#090D1C" />
              </TouchableOpacity>
              <Text style={styles.headerBrand}><Text style={styles.headerBrandAccent}>NendPlay</Text> News</Text>
              <View style={styles.headerActions}>
                <TouchableOpacity onPress={() => Alert.alert('Search', 'News search is available from the news feed.')} style={styles.headerButton}>
                  <Ionicons name="search-outline" size={24} color="#090D1C" />
                </TouchableOpacity>
                <TouchableOpacity onPress={sharePost} style={styles.headerButton}>
                  <Ionicons name="ellipsis-vertical" size={22} color="#090D1C" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.article}>
              <Text style={styles.categoryPill}>{category.toUpperCase()}</Text>
              <Text style={styles.title}>{post.header || post.title}</Text>
              {post.subHeader ? <Text style={styles.subTitle}>{post.subHeader}</Text> : null}

              <View style={styles.sourcePanel}>
                <View style={styles.newsLogo}><Text style={styles.newsLogoText}>N</Text></View>
                <View style={styles.sourceTextWrap}>
                  <View style={styles.sourceNameRow}>
                    <Text style={styles.source}>{post.source || 'NendPlay News'}</Text>
                    <Ionicons name="checkmark-circle" size={17} color={BLUE} />
                  </View>
                  <View style={styles.metaRow}>
                    <Ionicons name="calendar-outline" size={15} color={MUTED} />
                    <Text style={styles.meta}>{formatDate(post.publishedAt || post.createdAt)}</Text>
                    <Text style={styles.metaDot}>•</Text>
                    <Ionicons name="time-outline" size={15} color={MUTED} />
                    <Text style={styles.meta}>{timeAgo(post.publishedAt || post.createdAt)}</Text>
                    <Text style={styles.metaDot}>•</Text>
                    <Ionicons name="book-outline" size={15} color={MUTED} />
                    <Text style={styles.meta}>{readTime}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.heroMedia}>
                <Text style={styles.heroPill}>{category.toUpperCase()}</Text>
                {heroVideo ? (
                  <NewsVideo item={heroVideo} />
                ) : heroImage ? (
                  <Image source={{ uri: heroImage.url }} style={styles.heroImage} resizeMode="cover" />
                ) : (
                  <View style={styles.heroFallback}>
                    <Ionicons name="newspaper-outline" size={44} color={BLUE} />
                  </View>
                )}
                {heroVideo ? (
                  <View pointerEvents="none" style={styles.heroPlay}>
                    <Ionicons name="play" size={28} color={BLUE} />
                  </View>
                ) : null}
              </View>

              {remainingVideos.map((item, index) => <NewsVideo key={`video-${index}`} item={item} />)}
              {audios.map((item, index) => <NewsAudio key={`audio-${index}`} item={item} />)}
              {remainingImages.map((item, index) => (
                <Image key={`image-${index}`} source={{ uri: item.url }} style={styles.image} resizeMode="cover" />
              ))}

              {paragraphs.map((text, index) => (
                <React.Fragment key={`paragraph-${index}`}>
                  {isQuoteParagraph(text) ? (
                    <View style={styles.quoteBlock}>
                      <Text style={styles.quoteText}>{text}</Text>
                    </View>
                  ) : (
                    <Text style={styles.paragraph}>{text}</Text>
                  )}
                  {post.adsEnabled && index === 0 ? (
                    <View style={styles.inlineAdStack}>
                      <AdBanner style={styles.inlineAd} horizontalPadding={48} />
                      <NendPlayAdCard placement="news" style={styles.inlineAd} />
                      <NativeAdvancedAd style={styles.inlineAd} />
                    </View>
                  ) : null}
                </React.Fragment>
              ))}

              <TouchableOpacity
                style={styles.listenButton}
                onPress={() => Alert.alert('Listen', 'Audio narration for news will be available soon.')}
              >
                <Ionicons name="headset-outline" size={25} color="#fff" />
                <Text style={styles.listenText}>Listen</Text>
              </TouchableOpacity>

              <View style={styles.actions}>
                <TouchableOpacity style={styles.action}>
                  <Ionicons name="chatbubble-ellipses-outline" size={25} color={BLUE} />
                  <View>
                    <Text style={styles.actionCount}>{post.commentCount || comments.length}</Text>
                    <Text style={styles.actionLabel}>Comments</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={styles.action} onPress={likePost}>
                  <Ionicons name="heart-outline" size={28} color={BLUE} />
                  <View>
                    <Text style={styles.actionCount}>{post.likeCount || 0}</Text>
                    <Text style={styles.actionLabel}>Likes</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={styles.action} onPress={() => Alert.alert('Saved', 'This news has been saved for later.')}>
                  <Ionicons name="bookmark-outline" size={26} color="#111827" />
                  <Text style={styles.actionLabelOnly}>Save</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.action} onPress={sharePost}>
                  <Ionicons name="share-social-outline" size={27} color={BLUE} />
                  <Text style={styles.actionLabelOnly}>Share</Text>
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
  container: { flex: 1, backgroundColor: '#F6F7FB' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F6F7FB' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 12,
    paddingHorizontal: 10,
    paddingBottom: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
  },
  headerButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  headerBrand: { color: '#090D1C', fontSize: 22, fontWeight: '900' },
  headerBrandAccent: { color: BLUE },
  article: {
    marginHorizontal: 12,
    backgroundColor: '#fff',
    padding: 18,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
  },
  categoryPill: {
    alignSelf: 'flex-start',
    overflow: 'hidden',
    color: '#fff',
    backgroundColor: BLUE,
    borderRadius: 9,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 14,
  },
  title: { color: '#090D1C', fontSize: 32, lineHeight: 38, fontWeight: '900' },
  subTitle: { color: '#5B6472', fontSize: 18, lineHeight: 25, marginTop: 10, fontWeight: '600' },
  sourcePanel: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 24, marginBottom: 20 },
  newsLogo: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: BLUE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newsLogoText: { color: '#fff', fontSize: 28, fontWeight: '900' },
  sourceTextWrap: { flex: 1, minWidth: 0 },
  sourceNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 6 },
  metaDot: { color: MUTED, fontSize: 13, fontWeight: '900' },
  source: { color: '#090D1C', fontSize: 17, fontWeight: '900' },
  meta: { color: MUTED, fontSize: 13, fontWeight: '700' },
  heroMedia: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 18,
    backgroundColor: '#E9ECF3',
    marginBottom: 22,
  },
  heroPill: {
    position: 'absolute',
    zIndex: 4,
    left: 14,
    top: 14,
    overflow: 'hidden',
    color: '#fff',
    backgroundColor: BLUE,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    fontSize: 12,
    fontWeight: '900',
  },
  heroImage: { width: '100%', height: 290, backgroundColor: BORDER },
  heroFallback: { width: '100%', height: 260, alignItems: 'center', justifyContent: 'center' },
  heroPlay: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 70,
    height: 70,
    marginLeft: -35,
    marginTop: -35,
    borderRadius: 35,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 8,
  },
  video: { width: '100%', height: 290, backgroundColor: '#000' },
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
  image: { width: '100%', height: 240, backgroundColor: BORDER, marginBottom: 18, borderRadius: 16 },
  paragraph: { color: '#111827', fontSize: 17, lineHeight: 27, marginBottom: 20 },
  quoteBlock: { borderLeftWidth: 3, borderLeftColor: BLUE, paddingLeft: 14, marginBottom: 20 },
  quoteText: { color: '#111827', fontSize: 17, lineHeight: 28, fontStyle: 'italic' },
  inlineAdStack: { marginBottom: 26 },
  inlineAd: { marginHorizontal: 0 },
  listenButton: {
    alignSelf: 'flex-end',
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: BLUE,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -4,
    marginBottom: 18,
    shadowColor: BLUE,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  listenText: { color: '#fff', fontSize: 13, fontWeight: '900', marginTop: 3 },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#F0F1F5',
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 13,
    marginTop: 4,
    shadowColor: '#111827',
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 2,
  },
  action: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionCount: { color: '#111827', fontSize: 15, fontWeight: '900' },
  actionLabel: { color: MUTED, fontSize: 10, fontWeight: '700' },
  actionLabelOnly: { color: '#111827', fontSize: 13, fontWeight: '800' },
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
