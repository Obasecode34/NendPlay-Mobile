import React from 'react'
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'

const UI_SCALE = 0.9

const HOST_COMPONENTS = new Set([
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  SectionList,
  Text,
  TextInput,
  TouchableOpacity,
  View,
])

const SKIP_NUMERIC_KEYS = new Set([
  'aspectRatio',
  'elevation',
  'flex',
  'flexGrow',
  'flexShrink',
  'fontWeight',
  'opacity',
  'shadowOpacity',
  'zIndex',
])

const MIN_ONE_KEYS = new Set([
  'borderWidth',
  'borderBottomWidth',
  'borderEndWidth',
  'borderLeftWidth',
  'borderRightWidth',
  'borderStartWidth',
  'borderTopWidth',
])

const STYLE_PROP_KEYS = [
  'style',
  'contentContainerStyle',
  'columnWrapperStyle',
  'ListFooterComponentStyle',
  'ListHeaderComponentStyle',
]

function scaleNumber(key, value) {
  if (!Number.isFinite(value) || SKIP_NUMERIC_KEYS.has(key)) return value
  const scaled = value * UI_SCALE
  if (MIN_ONE_KEYS.has(key)) return value > 0 ? Math.max(1, scaled) : value
  return Math.round(scaled * 100) / 100
}

function scaleStyle(style) {
  if (!style) return style
  const flattened = StyleSheet.flatten(style)
  if (!flattened || typeof flattened !== 'object') return style

  const next = {}
  for (const [key, value] of Object.entries(flattened)) {
    if (typeof value === 'number') {
      next[key] = scaleNumber(key, value)
    } else {
      next[key] = value
    }
  }
  return next
}

if (!React.__nendplayCompactUiScaleApplied) {
  const originalCreateElement = React.createElement

  React.createElement = (type, props, ...children) => {
    if (props && HOST_COMPONENTS.has(type)) {
      const nextProps = { ...props }
      STYLE_PROP_KEYS.forEach((key) => {
        if (props[key]) nextProps[key] = scaleStyle(props[key])
      })

      if (type === Text || type === TextInput) {
        nextProps.allowFontScaling = props.allowFontScaling ?? false
        nextProps.maxFontSizeMultiplier = props.maxFontSizeMultiplier ?? 1
      }

      return originalCreateElement(type, nextProps, ...children)
    }

    return originalCreateElement(type, props, ...children)
  }

  React.__nendplayCompactUiScaleApplied = true
}

export default UI_SCALE
