import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  TextInput,
  StatusBar,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { ScannedDocument, CategoryType, CATEGORY_LABELS } from './src/types';
import { StorageService } from './src/services/StorageService';
import { PdfService } from './src/services/PdfService';
import { CameraScannerModal } from './src/components/CameraScannerModal';
import { DocumentDetailModal } from './src/components/DocumentDetailModal';
import { DocumentCard } from './src/components/DocumentCard';

const { width } = Dimensions.get('window');

const CATEGORIES: CategoryType[] = ['all', 'contract', 'invoice', 'idcard', 'note'];

export default function App() {
  const [documents, setDocuments] = useState<ScannedDocument[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // 互動狀態
  const [showScanner, setShowScanner] = useState<boolean>(false);
  const [activeDocument, setActiveDocument] = useState<ScannedDocument | null>(null);

  const loadDocuments = useCallback(async () => {
    try {
      setIsLoading(true);
      const docs = await StorageService.getDocuments();
      setDocuments(docs);
    } catch (error) {
      console.error('載入文件失敗:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  // 完成拍照掃描後的新增流程
  const handleScanComplete = async (capturedUris: string[]) => {
    setShowScanner(false);
    try {
      let docToOpen: ScannedDocument;

      // 如果當前已有開啟中的文件，則為加頁模式
      if (activeDocument) {
        const timestamp = Date.now();
        const newPages = capturedUris.map((uri, idx) => ({
          id: `page_${timestamp}_${idx}`,
          uri,
          originalUri: uri,
          filter: 'original' as const,
          rotation: 0,
        }));
        const updated = {
          ...activeDocument,
          pages: [...activeDocument.pages, ...newPages],
        };
        await StorageService.saveDocument(updated);
        docToOpen = updated;
      } else {
        // 建立新文件
        const categoryForNewDoc = selectedCategory === 'all' ? 'contract' : selectedCategory;
        const newDoc = await StorageService.createDocument(
          capturedUris,
          undefined,
          categoryForNewDoc
        );
        docToOpen = newDoc;
      }

      await loadDocuments();
      setActiveDocument(docToOpen);
    } catch (error) {
      console.error('儲存新掃描失敗:', error);
      Alert.alert('儲存錯誤', '無法儲存新掃描的影像');
    }
  };

  // 更新文件（改名、切換濾鏡、旋轉或刪除單頁）
  const handleUpdateDocument = async (updatedDoc: ScannedDocument) => {
    setActiveDocument(updatedDoc);
    await StorageService.saveDocument(updatedDoc);
    await loadDocuments();
  };

  // 刪除整份文件
  const handleDeleteDocument = async (id: string) => {
    await StorageService.deleteDocument(id);
    await loadDocuments();
  };

  // 卡片快捷分享 PDF
  const handleQuickShare = async (doc: ScannedDocument) => {
    try {
      const pdfPath = await PdfService.generatePdf(doc);
      await PdfService.sharePdf(pdfPath);
    } catch (error) {
      console.error('快速分享 PDF 失敗:', error);
      Alert.alert('導出失敗', '無法產生 PDF 檔案');
    }
  };

  // 搜尋與篩選邏輯
  const filteredDocuments = documents.filter((doc) => {
    const matchesCategory =
      selectedCategory === 'all' || doc.category === selectedCategory;
    const matchesSearch =
      searchQuery.trim().length === 0 ||
      doc.title.toLowerCase().includes(searchQuery.trim().toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <SafeAreaView style={styles.container}>
      <ExpoStatusBar style="dark" />

      {/* 頂部品牌與隱私保障橫幅 */}
      <View style={styles.header}>
        <View>
          <View style={styles.brandRow}>
            <Ionicons name="scan-circle" size={30} color="#007AFF" />
            <Text style={styles.brandTitle}>SuperScan</Text>
          </View>
          <Text style={styles.brandSubtitle}>極速純淨 • 100% 離線隱私保護</Text>
        </View>

        <View style={styles.privacyBadge}>
          <Ionicons name="shield-checkmark" size={14} color="#34C759" />
          <Text style={styles.privacyBadgeText}>無廣告 • 零浮水印</Text>
        </View>
      </View>

      {/* 搜尋欄 */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color="#8E8E93" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="搜尋掃描文件標題..."
          placeholderTextColor="#8E8E93"
          value={searchQuery}
          onChangeText={setSearchQuery}
          clearButtonMode="while-editing"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color="#8E8E93" />
          </TouchableOpacity>
        )}
      </View>

      {/* 分類標籤滑動列 */}
      <View style={styles.categoryBar}>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[
              styles.categoryChip,
              selectedCategory === cat && styles.categoryChipActive,
            ]}
            onPress={() => setSelectedCategory(cat)}
          >
            <Text
              style={[
                styles.categoryChipText,
                selectedCategory === cat && styles.categoryChipTextActive,
              ]}
            >
              {CATEGORY_LABELS[cat]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 文件清單或空狀態展示 */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : filteredDocuments.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Ionicons name="document-text-outline" size={48} color="#007AFF" />
          </View>
          <Text style={styles.emptyTitle}>尚無掃描文件</Text>
          <Text style={styles.emptyDesc}>
            擺脫 CamScanner 的煩人廣告與強制收費！{'\n'}
            點選下方按鈕，享受秒開即掃、多頁連拍與高畫質 PDF 無浮水印導出。
          </Text>
          <TouchableOpacity
            style={styles.emptyScanBtn}
            onPress={() => setShowScanner(true)}
          >
            <Ionicons name="camera" size={20} color="#FFF" style={{ marginRight: 8 }} />
            <Text style={styles.emptyScanBtnText}>立即開始掃描</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredDocuments}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <DocumentCard
              document={item}
              onPress={() => setActiveDocument(item)}
              onQuickShare={() => handleQuickShare(item)}
            />
          )}
        />
      )}

      {/* 底部懸浮掃描主按鈕 (FAB) */}
      <View style={styles.fabContainer}>
        <TouchableOpacity
          style={styles.fabButton}
          onPress={() => setShowScanner(true)}
          activeOpacity={0.85}
        >
          <Ionicons name="scan" size={26} color="#FFF" />
          <Text style={styles.fabText}>掃描文件</Text>
        </TouchableOpacity>
      </View>

      {/* 相機全螢幕掃描 Modal */}
      <CameraScannerModal
        visible={showScanner}
        onClose={() => setShowScanner(false)}
        onComplete={handleScanComplete}
      />

      {/* 文件詳細檢視、濾鏡與導出 Modal */}
      <DocumentDetailModal
        visible={activeDocument !== null}
        document={activeDocument}
        onClose={() => setActiveDocument(null)}
        onUpdate={handleUpdateDocument}
        onDelete={handleDeleteDocument}
        onAddPages={() => setShowScanner(true)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1C1C1E',
    marginLeft: 8,
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
    fontWeight: '500',
  },
  privacyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F9ED',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  privacyBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#34C759',
    marginLeft: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBEBF0',
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1C1C1E',
    padding: 0,
  },
  categoryBar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  categoryChip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: '#EFEFF4',
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: '#007AFF',
  },
  categoryChipText: {
    fontSize: 13,
    color: '#636366',
    fontWeight: '500',
  },
  categoryChipTextActive: {
    color: '#FFF',
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 36,
    marginTop: -40,
  },
  emptyIconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#EBF4FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 10,
  },
  emptyDesc: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  emptyScanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 13,
    paddingHorizontal: 24,
    borderRadius: 22,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  emptyScanBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 90,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
  },
  fabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    paddingHorizontal: 26,
    borderRadius: 28,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  fabText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
});
