import React, { useState, useRef } from 'react';
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
  StatusBar,
  Dimensions,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { ImageProcessor } from '../services/ImageProcessor';

const { width } = Dimensions.get('window');

interface CameraScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onComplete: (capturedUris: string[]) => void;
}

export const CameraScannerModal: React.FC<CameraScannerModalProps> = ({
  visible,
  onClose,
  onComplete,
}) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState<boolean>(false);
  const [capturedPages, setCapturedPages] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const cameraRef = useRef<any>(null);

  const handleCapture = async () => {
    if (!cameraRef.current || isProcessing) return;

    try {
      setIsProcessing(true);
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.88,
        skipProcessing: false,
      });

      if (photo && photo.uri) {
        // 優化尺寸加速處理
        const optimized = await ImageProcessor.optimizeScan(photo.uri);
        setCapturedPages((prev) => [...prev, optimized]);
      }
    } catch (error) {
      console.error('拍照失敗:', error);
      Alert.alert('拍攝失敗', '請確認相機權限後再試一次');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePickFromLibrary = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.88,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uris = result.assets.map((asset) => asset.uri);
        setCapturedPages((prev) => [...prev, ...uris]);
      }
    } catch (error) {
      console.error('選擇相簿失敗:', error);
    }
  };

  const handleRemovePage = (index: number) => {
    setCapturedPages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFinish = () => {
    if (capturedPages.length === 0) {
      Alert.alert('提示', '請至少拍攝或選取一張文件');
      return;
    }
    onComplete(capturedPages);
    setCapturedPages([]);
  };

  const handleClose = () => {
    if (capturedPages.length > 0) {
      Alert.alert('放棄掃描', '已拍攝的頁面將不會被儲存，確定退出？', [
        { text: '取消', style: 'cancel' },
        {
          text: '確定退出',
          style: 'destructive',
          onPress: () => {
            setCapturedPages([]);
            onClose();
          },
        },
      ]);
    } else {
      onClose();
    }
  };

  if (!visible) return null;

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <Modal visible={visible} animationType="slide">
        <SafeAreaView style={styles.permissionContainer}>
          <Ionicons name="camera-outline" size={72} color="#007AFF" />
          <Text style={styles.permissionTitle}>需要相機存取權限</Text>
          <Text style={styles.permissionDesc}>
            SuperScan 需要使用您的相機來拍攝與自動掃描紙本文件、合約與發票。
          </Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={requestPermission}
          >
            <Text style={styles.permissionButtonText}>允許相機權限</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>取消</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent>
      <StatusBar barStyle="light-content" />
      <View style={styles.container}>
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={torch}
        />

        {/* 掃描對齊輔助格線與框線 */}
        <SafeAreaView style={styles.overlayContainer} pointerEvents="box-none">
          {/* 頂部操作欄 */}
          <View style={styles.topBar}>
            <TouchableOpacity style={styles.iconCircle} onPress={handleClose}>
              <Ionicons name="close" size={24} color="#FFF" />
            </TouchableOpacity>

            <View style={styles.centerBadge}>
              <Text style={styles.centerBadgeText}>
                {capturedPages.length > 0
                  ? `已掃描 ${capturedPages.length} 頁`
                  : '對準文件自動邊界'}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.iconCircle, torch && styles.iconCircleActive]}
              onPress={() => setTorch(!torch)}
            >
              <Ionicons
                name={torch ? 'flash' : 'flash-off'}
                size={22}
                color={torch ? '#FFD700' : '#FFF'}
              />
            </TouchableOpacity>
          </View>

          {/* 中央取景輔助框 */}
          <View style={styles.scannerFrameGuide}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>

          {/* 底部控制區域 */}
          <View style={styles.bottomControlArea}>
            {/* 多頁拍攝佇列縮圖 */}
            {capturedPages.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.thumbnailScroll}
                contentContainerStyle={styles.thumbnailContent}
              >
                {capturedPages.map((uri, idx) => (
                  <View key={idx} style={styles.thumbWrapper}>
                    <Image source={{ uri }} style={styles.thumbImage} />
                    <TouchableOpacity
                      style={styles.thumbDeleteBadge}
                      onPress={() => handleRemovePage(idx)}
                    >
                      <Ionicons name="close" size={12} color="#FFF" />
                    </TouchableOpacity>
                    <View style={styles.thumbIndexBadge}>
                      <Text style={styles.thumbIndexText}>{idx + 1}</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}

            {/* 拍攝與完成按鈕列 */}
            <View style={styles.shutterRow}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={handlePickFromLibrary}
              >
                <Ionicons name="images-outline" size={28} color="#FFF" />
                <Text style={styles.actionBtnText}>相簿選取</Text>
              </TouchableOpacity>

              {/* 快門按鈕 */}
              <TouchableOpacity
                style={[
                  styles.shutterOuter,
                  isProcessing && styles.shutterOuterDisabled,
                ]}
                onPress={handleCapture}
                disabled={isProcessing}
                activeOpacity={0.7}
              >
                <View style={styles.shutterInner} />
              </TouchableOpacity>

              {/* 完成按鈕 */}
              <TouchableOpacity
                style={[
                  styles.finishBtn,
                  capturedPages.length === 0 && styles.finishBtnDisabled,
                ]}
                onPress={handleFinish}
                disabled={capturedPages.length === 0}
              >
                <Text style={styles.finishBtnText}>
                  完成{capturedPages.length > 0 ? ` (${capturedPages.length})` : ''}
                </Text>
                <Ionicons name="arrow-forward" size={18} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1C1C1E',
    marginTop: 20,
    marginBottom: 10,
  },
  permissionDesc: {
    fontSize: 15,
    color: '#636366',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 30,
  },
  permissionButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    paddingHorizontal: 36,
    borderRadius: 24,
    marginBottom: 16,
  },
  permissionButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    padding: 10,
  },
  cancelButtonText: {
    color: '#8E8E93',
    fontSize: 15,
  },
  overlayContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCircleActive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  centerBadge: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  centerBadgeText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '500',
  },
  scannerFrameGuide: {
    alignSelf: 'center',
    width: width * 0.85,
    height: width * 1.15,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderColor: '#007AFF',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3.5,
    borderLeftWidth: 3.5,
    borderTopLeftRadius: 8,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3.5,
    borderRightWidth: 3.5,
    borderTopRightRadius: 8,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3.5,
    borderLeftWidth: 3.5,
    borderBottomLeftRadius: 8,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3.5,
    borderRightWidth: 3.5,
    borderBottomRightRadius: 8,
  },
  bottomControlArea: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingBottom: 24,
    paddingTop: 12,
  },
  thumbnailScroll: {
    maxHeight: 80,
    marginBottom: 12,
  },
  thumbnailContent: {
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  thumbWrapper: {
    width: 54,
    height: 72,
    marginRight: 10,
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#007AFF',
    position: 'relative',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  thumbDeleteBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: 'rgba(255, 59, 48, 0.85)',
    borderRadius: 9,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbIndexBadge: {
    position: 'absolute',
    bottom: 2,
    left: 2,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  thumbIndexText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },
  shutterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
  },
  actionBtn: {
    alignItems: 'center',
    minWidth: 70,
  },
  actionBtnText: {
    color: '#FFF',
    fontSize: 12,
    marginTop: 4,
  },
  shutterOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  shutterOuterDisabled: {
    opacity: 0.5,
  },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFF',
  },
  finishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    minWidth: 70,
    justifyContent: 'center',
  },
  finishBtnDisabled: {
    backgroundColor: '#3A3A3C',
    opacity: 0.6,
  },
  finishBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 4,
  },
});
