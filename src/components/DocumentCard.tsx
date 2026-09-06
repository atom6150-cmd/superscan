import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScannedDocument, CATEGORY_LABELS } from '../types';

interface DocumentCardProps {
  document: ScannedDocument;
  onPress: () => void;
  onQuickShare: () => void;
}

export const DocumentCard: React.FC<DocumentCardProps> = ({
  document,
  onPress,
  onQuickShare,
}) => {
  const firstPage = document.pages[0];
  const dateStr = new Date(document.updatedAt).toLocaleDateString('zh-TW', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.thumbnailContainer}>
        {firstPage ? (
          <Image source={{ uri: firstPage.uri }} style={styles.thumbnail} />
        ) : (
          <View style={styles.placeholderThumb}>
            <Ionicons name="document-outline" size={32} color="#C7C7CC" />
          </View>
        )}
        <View style={styles.pageCountBadge}>
          <Text style={styles.pageCountText}>{document.pages.length} 頁</Text>
        </View>
        {document.watermark && (
          <View style={styles.watermarkIndicator}>
            <Ionicons name="shield-checkmark" size={12} color="#FFF" />
          </View>
        )}
      </View>

      <View style={styles.infoContainer}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {document.title}
          </Text>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>
              {CATEGORY_LABELS[document.category] || '文件'}
            </Text>
          </View>
          <Text style={styles.dateText}>{dateStr}</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.shareBtn}
        onPress={(e) => {
          e.stopPropagation();
          onQuickShare();
        }}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="share-outline" size={20} color="#007AFF" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
  },
  thumbnailContainer: {
    width: 58,
    height: 74,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F2F2F7',
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholderThumb: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageCountBadge: {
    position: 'absolute',
    bottom: 3,
    right: 3,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 6,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  pageCountText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '700',
  },
  watermarkIndicator: {
    position: 'absolute',
    top: 3,
    left: 3,
    backgroundColor: '#007AFF',
    borderRadius: 6,
    padding: 2,
  },
  infoContainer: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'center',
  },
  titleRow: {
    marginBottom: 6,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryBadge: {
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginRight: 8,
  },
  categoryText: {
    fontSize: 11,
    color: '#3A3A3C',
    fontWeight: '500',
  },
  dateText: {
    fontSize: 12,
    color: '#8E8E93',
  },
  shareBtn: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F2F8FF',
    marginLeft: 8,
  },
});
