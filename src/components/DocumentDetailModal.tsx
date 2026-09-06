import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Image,
  Alert,
  TextInput,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScannedDocument, FilterType, WatermarkConfig } from '../types';
import { ImageProcessor } from '../services/ImageProcessor';
import { PdfService } from '../services/PdfService';
import { WatermarkModal } from './WatermarkModal';
import { CropAdjustModal } from './CropAdjustModal';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';

const { width } = Dimensions.get('window');

interface DocumentDetailModalProps {
  visible: boolean;
  document: ScannedDocument | null;
  onClose: () => void;
  onUpdate: (updatedDoc: ScannedDocument) => void;
  onDelete: (id: string) => void;
  onAddPages: () => void;
}

export const DocumentDetailModal: React.FC<DocumentDetailModalProps> = ({
  visible,
  document,
  onClose,
  onUpdate,
  onDelete,
  onAddPages,
}) => {
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);
  const [isEditingTitle, setIsEditingTitle] = useState<boolean>(false);
  const [titleText, setTitleText] = useState<string>('');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [showWatermarkModal, setShowWatermarkModal] = useState<boolean>(false);
  const [showCropModal, setShowCropModal] = useState<boolean>(false);

  if (!visible || !document) return null;

  const pages = document.pages;
  const currentPage = pages[currentPageIndex] || pages[0];

  const handleTitleSubmit = () => {
    if (titleText.trim().length > 0) {
      onUpdate({
        ...document,
        title: titleText.trim(),
      });
    }
    setIsEditingTitle(false);
  };

  const handleRotatePage = async () => {
    if (!currentPage) return;
    try {
      const newUri = await ImageProcessor.rotateImage(currentPage.uri, 90);
      const updatedPages = [...pages];
      updatedPages[currentPageIndex] = {
        ...currentPage,
        uri: newUri,
        rotation: (currentPage.rotation + 90) % 360,
      };
      onUpdate({
        ...document,
        pages: updatedPages,
      });
    } catch (error) {
      console.error('旋轉失敗:', error);
    }
  };

  const handleDeleteCurrentPage = () => {
    if (pages.length <= 1) {
      Alert.alert('無法刪除', '文件至少需保留一頁。如需刪除整個文件請點選右下角刪除。');
      return;
    }

    Alert.alert('刪除此頁', '確定要刪除當前頁面嗎？', [
      { text: '取消', style: 'cancel' },
      {
        text: '刪除',
        style: 'destructive',
        onPress: () => {
          const updatedPages = pages.filter((_, idx) => idx !== currentPageIndex);
          const nextIndex = Math.max(0, currentPageIndex - 1);
          setCurrentPageIndex(nextIndex);
          onUpdate({
            ...document,
            pages: updatedPages,
          });
        },
      },
    ]);
  };

  const handleFilterChange = (filter: FilterType) => {
    if (!currentPage) return;
    const updatedPages = [...pages];
    updatedPages[currentPageIndex] = {
      ...currentPage,
      filter,
    };
    onUpdate({
      ...document,
      pages: updatedPages,
    });
  };

  const handleApplyWatermark = (watermark: WatermarkConfig | undefined) => {
    onUpdate({
      ...document,
      watermark,
    });
  };

  const handleCropComplete = (croppedUri: string) => {
    if (!currentPage) return;
    const updatedPages = [...pages];
    updatedPages[currentPageIndex] = {
      ...currentPage,
      uri: croppedUri,
    };
    onUpdate({
      ...document,
      pages: updatedPages,
    });
  };

  const handleExportPdf = async () => {
    try {
      setIsExporting(true);
      const pdfPath = await PdfService.generatePdf(document);
      await PdfService.sharePdf(pdfPath);
    } catch (error) {
      console.error('導出 PDF 失敗:', error);
      Alert.alert('導出失敗', '無法產生 PDF 檔案，請稍候重試');
    } finally {
      setIsExporting(false);
    }
  };

  const handleSaveToPhotos = async () => {
    if (!currentPage) return;
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('權限不足', '請至 iPhone 設定允許相簿存取權限，以儲存照片');
        return;
      }
      await MediaLibrary.saveToLibraryAsync(currentPage.uri);
      Alert.alert('儲存成功 🎉', '已將這份高清文件圖檔儲存至您的 iPhone「照片」相簿！');
    } catch (error) {
      console.error('儲存照片失敗:', error);
      Alert.alert('儲存失敗', '無法儲存圖片至相簿');
    }
  };

  const handleSharePhoto = async () => {
    if (!currentPage) return;
    try {
      await Sharing.shareAsync(currentPage.uri, {
        mimeType: 'image/jpeg',
        dialogTitle: '分享文件照片',
      });
    } catch (error) {
      console.error('分享照片失敗:', error);
    }
  };

  const handleDeleteDocument = () => {
    Alert.alert('刪除整份文件', '刪除後將無法還原，確定要刪除嗎？', [
      { text: '取消', style: 'cancel' },
      {
        text: '確定刪除',
        style: 'destructive',
        onPress: () => {
          onDelete(document.id);
          onClose();
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide">
      <SafeAreaView style={styles.container}>
        {/* 頂部標題列 */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerIconBtn} onPress={onClose}>
            <Ionicons name="chevron-back" size={26} color="#007AFF" />
          </TouchableOpacity>

          <View style={styles.titleContainer}>
            {isEditingTitle ? (
              <TextInput
                style={styles.titleInput}
                value={titleText}
                onChangeText={setTitleText}
                onBlur={handleTitleSubmit}
                onSubmitEditing={handleTitleSubmit}
                autoFocus
              />
            ) : (
              <TouchableOpacity
                style={styles.titleRow}
                onPress={() => {
                  setTitleText(document.title);
                  setIsEditingTitle(true);
                }}
              >
                <Text style={styles.title} numberOfLines={1}>
                  {document.title}
                </Text>
                <Ionicons name="pencil" size={14} color="#8E8E93" style={{ marginLeft: 6 }} />
              </TouchableOpacity>
            )}
            <Text style={styles.pageIndicator}>
              第 {currentPageIndex + 1} 頁，共 {pages.length} 頁
            </Text>
          </View>

          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={handleDeleteDocument}
          >
            <Ionicons name="trash-outline" size={22} color="#FF3B30" />
          </TouchableOpacity>
        </View>

        {/* 主頁面預覽區域 */}
        <View style={styles.previewContainer}>
          {currentPage && (
            <View style={styles.imageCard}>
              <Image
                source={{ uri: currentPage.uri }}
                style={[
                  styles.previewImage,
                  currentPage.filter === 'bw' && styles.filterBw,
                  currentPage.filter === 'grayscale' && styles.filterGrayscale,
                  currentPage.filter === 'magic' && styles.filterMagic,
                ]}
              />

              {/* 預覽自訂浮水印效果 */}
              {document.watermark && document.watermark.text.length > 0 && (
                <View style={styles.watermarkOverlay} pointerEvents="none">
                  <Text
                    style={[
                      styles.watermarkText,
                      { opacity: document.watermark.opacity || 0.35 },
                    ]}
                  >
                    {document.watermark.text}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* 單頁編輯捷徑浮動按鈕 */}
          <View style={styles.pageActionRow}>
            <TouchableOpacity
              style={styles.actionPill}
              onPress={() => setShowCropModal(true)}
            >
              <Ionicons name="crop" size={16} color="#007AFF" />
              <Text style={[styles.actionPillText, { color: '#007AFF', fontWeight: '600' }]}>
                微調切邊
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionPill}
              onPress={handleRotatePage}
            >
              <Ionicons name="reload" size={16} color="#1C1C1E" />
              <Text style={styles.actionPillText}>旋轉 90°</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionPill}
              onPress={() => setShowWatermarkModal(true)}
            >
              <Ionicons
                name="shield-checkmark-outline"
                size={16}
                color={document.watermark ? '#007AFF' : '#1C1C1E'}
              />
              <Text
                style={[
                  styles.actionPillText,
                  document.watermark && { color: '#007AFF', fontWeight: '600' },
                ]}
              >
                {document.watermark ? '已加防偽' : '防偽浮水印'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionPill}
              onPress={handleDeleteCurrentPage}
            >
              <Ionicons name="trash-outline" size={16} color="#FF3B30" />
              <Text style={[styles.actionPillText, { color: '#FF3B30' }]}>
                刪除此頁
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 濾鏡選擇區 */}
        <View style={styles.filterSection}>
          <Text style={styles.sectionHeader}>畫質增強濾鏡：</Text>
          <View style={styles.filterRow}>
            {(
              [
                { id: 'original', label: '原圖', icon: 'image-outline' },
                { id: 'magic', label: '魔術色彩', icon: 'sparkles' },
                { id: 'bw', label: '黑白文檔', icon: 'document-text-outline' },
                { id: 'grayscale', label: '灰階清晰', icon: 'contrast-outline' },
              ] as const
            ).map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.filterBtn,
                  currentPage?.filter === item.id && styles.filterBtnActive,
                ]}
                onPress={() => handleFilterChange(item.id)}
              >
                <Ionicons
                  name={item.icon as any}
                  size={18}
                  color={currentPage?.filter === item.id ? '#007AFF' : '#8E8E93'}
                />
                <Text
                  style={[
                    styles.filterBtnText,
                    currentPage?.filter === item.id && styles.filterBtnTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 多頁分頁縮圖導覽條 */}
        <View style={styles.thumbnailSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.thumbnailList}
          >
            {pages.map((p, idx) => (
              <TouchableOpacity
                key={p.id}
                style={[
                  styles.pageThumb,
                  currentPageIndex === idx && styles.pageThumbActive,
                ]}
                onPress={() => setCurrentPageIndex(idx)}
              >
                <Image source={{ uri: p.uri }} style={styles.pageThumbImg} />
                <View style={styles.pageBadge}>
                  <Text style={styles.pageBadgeText}>{idx + 1}</Text>
                </View>
              </TouchableOpacity>
            ))}

            {/* 加頁按鈕 */}
            <TouchableOpacity
              style={styles.addPageButton}
              onPress={onAddPages}
            >
              <Ionicons name="add" size={24} color="#007AFF" />
              <Text style={styles.addPageText}>加頁</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* 底部導出操作區（支援 PDF 與照片儲存） */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.exportButton, isExporting && styles.exportButtonDisabled]}
            onPress={handleExportPdf}
            disabled={isExporting}
          >
            {isExporting ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Ionicons name="document-text-outline" size={18} color="#FFF" style={{ marginRight: 6 }} />
                <Text style={styles.exportButtonText}>導出高畫質 PDF（無廣告、零浮水印）</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.photoActionRow}>
            <TouchableOpacity
              style={styles.photoActionBtn}
              onPress={handleSaveToPhotos}
            >
              <Ionicons name="images-outline" size={16} color="#007AFF" />
              <Text style={styles.photoActionText}>存入 iPhone 相簿</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.photoActionBtn}
              onPress={handleSharePhoto}
            >
              <Ionicons name="share-outline" size={16} color="#007AFF" />
              <Text style={styles.photoActionText}>分享照片 (JPEG)</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 浮水印設定 Modal */}
        <WatermarkModal
          visible={showWatermarkModal}
          currentWatermark={document.watermark}
          onClose={() => setShowWatermarkModal(false)}
          onApply={handleApplyWatermark}
        />

        {/* 四角切邊與微調 Modal (Office Lens 風格) */}
        <CropAdjustModal
          visible={showCropModal}
          imageUri={currentPage?.uri || null}
          onClose={() => setShowCropModal(false)}
          onCropComplete={handleCropComplete}
        />
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#C6C6C8',
  },
  headerIconBtn: {
    padding: 6,
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    maxWidth: width * 0.55,
  },
  titleInput: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    borderBottomWidth: 1.5,
    borderBottomColor: '#007AFF',
    textAlign: 'center',
    minWidth: 140,
    paddingVertical: 2,
  },
  pageIndicator: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  previewContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  imageCard: {
    width: width * 0.78,
    height: width * 1.05,
    backgroundColor: '#FFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  filterBw: {
    // 黑白高對比
    tintColor: undefined,
  },
  filterGrayscale: {
    opacity: 0.88,
  },
  filterMagic: {
    opacity: 0.98,
  },
  watermarkOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  watermarkText: {
    fontSize: 26,
    fontWeight: '800',
    color: '#666',
    transform: [{ rotate: '-35deg' }],
    textAlign: 'center',
  },
  pageActionRow: {
    flexDirection: 'row',
    marginTop: 12,
    justifyContent: 'center',
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  actionPillText: {
    fontSize: 12,
    color: '#1C1C1E',
    marginLeft: 4,
  },
  filterSection: {
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5EA',
  },
  sectionHeader: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
    marginBottom: 6,
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  filterBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    marginHorizontal: 3,
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  filterBtnActive: {
    backgroundColor: '#E5F0FF',
    borderColor: '#007AFF',
  },
  filterBtnText: {
    fontSize: 12,
    color: '#3A3A3C',
    marginLeft: 4,
  },
  filterBtnTextActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
  thumbnailSection: {
    backgroundColor: '#FFF',
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5EA',
  },
  thumbnailList: {
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  pageThumb: {
    width: 48,
    height: 64,
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#E5E5EA',
    marginRight: 10,
    position: 'relative',
  },
  pageThumbActive: {
    borderColor: '#007AFF',
    borderWidth: 2,
  },
  pageThumbImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  pageBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 6,
    paddingHorizontal: 3,
  },
  pageBadgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '700',
  },
  addPageButton: {
    width: 48,
    height: 64,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F8FF',
  },
  addPageText: {
    fontSize: 10,
    color: '#007AFF',
    fontWeight: '600',
    marginTop: 2,
  },
  footer: {
    padding: 16,
    backgroundColor: '#FFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#C6C6C8',
  },
  exportButton: {
    flexDirection: 'row',
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  exportButtonDisabled: {
    opacity: 0.6,
  },
  exportButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  photoActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  photoActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2F8FF',
    paddingVertical: 11,
    borderRadius: 12,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#D0E4FF',
  },
  photoActionText: {
    color: '#007AFF',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
});
