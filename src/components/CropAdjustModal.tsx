import React, { useState, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Image,
  PanResponder,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ImageProcessor } from '../services/ImageProcessor';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Point {
  x: number;
  y: number;
}

interface CropAdjustModalProps {
  visible: boolean;
  imageUri: string | null;
  onClose: () => void;
  onCropComplete: (croppedUri: string) => void;
}

export const CropAdjustModal: React.FC<CropAdjustModalProps> = ({
  visible,
  imageUri,
  onClose,
  onCropComplete,
}) => {
  const [imageLayout, setImageLayout] = useState<{
    width: number;
    height: number;
    x: number;
    y: number;
  } | null>(null);

  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number }>({
    width: 1000,
    height: 1400,
  });

  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // 四角座標（相對於 imageLayout 的局部座標）
  const [topLeft, setTopLeft] = useState<Point>({ x: 20, y: 20 });
  const [topRight, setTopRight] = useState<Point>({ x: 260, y: 20 });
  const [bottomRight, setBottomRight] = useState<Point>({ x: 260, y: 360 });
  const [bottomLeft, setBottomLeft] = useState<Point>({ x: 20, y: 360 });

  const [activeCorner, setActiveCorner] = useState<string | null>(null);

  // 當載入圖片時，取得自然尺寸
  React.useEffect(() => {
    if (imageUri) {
      Image.getSize(
        imageUri,
        (w, h) => setNaturalSize({ width: w, height: h }),
        (err) => console.log('無法取得圖片尺寸', err)
      );
    }
  }, [imageUri]);

  // 當容器大小確定時，初始化四角位置（略縮進以模擬 Office Lens 自動切邊）
  const onImageLayout = (event: any) => {
    const { width, height, x, y } = event.nativeEvent.layout;
    setImageLayout({ width, height, x, y });

    const marginX = width * 0.08;
    const marginY = height * 0.08;

    setTopLeft({ x: marginX, y: marginY });
    setTopRight({ x: width - marginX, y: marginY });
    setBottomRight({ x: width - marginX, y: height - marginY });
    setBottomLeft({ x: marginX, y: height - marginY });
  };

  // 建立四角的 PanResponder 拖曳控制
  const createCornerPanResponder = (
    corner: 'TL' | 'TR' | 'BR' | 'BL',
    getPos: () => Point,
    setPos: (pt: Point) => void
  ) => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => setActiveCorner(corner),
      onPanResponderMove: (_, gestureState) => {
        if (!imageLayout) return;
        const current = getPos();
        const nextX = Math.max(0, Math.min(imageLayout.width, current.x + gestureState.dx));
        const nextY = Math.max(0, Math.min(imageLayout.height, current.y + gestureState.dy));
        setPos({ x: nextX, y: nextY });
      },
      onPanResponderRelease: () => setActiveCorner(null),
    });
  };

  const tlPan = useRef(createCornerPanResponder('TL', () => topLeft, setTopLeft)).current;
  const trPan = useRef(createCornerPanResponder('TR', () => topRight, setTopRight)).current;
  const brPan = useRef(createCornerPanResponder('BR', () => bottomRight, setBottomRight)).current;
  const blPan = useRef(createCornerPanResponder('BL', () => bottomLeft, setBottomLeft)).current;

  // 重設為全選
  const handleSelectAll = () => {
    if (!imageLayout) return;
    setTopLeft({ x: 0, y: 0 });
    setTopRight({ x: imageLayout.width, y: 0 });
    setBottomRight({ x: imageLayout.width, y: imageLayout.height });
    setBottomLeft({ x: 0, y: imageLayout.height });
  };

  // 自動智慧抓邊（模擬 Office Lens）
  const handleAutoDetect = () => {
    if (!imageLayout) return;
    const padX = imageLayout.width * 0.07;
    const padY = imageLayout.height * 0.07;
    setTopLeft({ x: padX, y: padY });
    setTopRight({ x: imageLayout.width - padX, y: padY });
    setBottomRight({ x: imageLayout.width - padX, y: imageLayout.height - padY });
    setBottomLeft({ x: padX, y: imageLayout.height - padY });
  };

  // 執行裁切（只留下框選範圍，不相干的桌面雜物完全去除）
  const handleApplyCrop = async () => {
    if (!imageUri || !imageLayout) return;

    try {
      setIsProcessing(true);

      // 計算在螢幕預覽上的包圍邊界 (Bounding Box)
      const minX = Math.min(topLeft.x, bottomLeft.x);
      const maxX = Math.max(topRight.x, bottomRight.x);
      const minY = Math.min(topLeft.y, topRight.y);
      const maxY = Math.max(bottomLeft.y, bottomRight.y);

      // 轉換成原始圖片真實解析度比例
      const scaleX = naturalSize.width / imageLayout.width;
      const scaleY = naturalSize.height / imageLayout.height;

      const originX = Math.max(0, Math.floor(minX * scaleX));
      const originY = Math.max(0, Math.floor(minY * scaleY));
      const cropWidth = Math.min(naturalSize.width - originX, Math.floor((maxX - minX) * scaleX));
      const cropHeight = Math.min(naturalSize.height - originY, Math.floor((maxY - minY) * scaleY));

      const croppedUri = await ImageProcessor.cropImage(imageUri, {
        originX,
        originY,
        width: Math.max(10, cropWidth),
        height: Math.max(10, cropHeight),
      });

      onCropComplete(croppedUri);
      onClose();
    } catch (error) {
      console.error('執行裁切失敗:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!visible || !imageUri) return null;

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent>
      <SafeAreaView style={styles.container}>
        {/* 頂部操作欄 */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBtn} onPress={onClose}>
            <Text style={styles.cancelText}>取消</Text>
          </TouchableOpacity>
          <View style={styles.titleWrapper}>
            <Text style={styles.headerTitle}>調整邊界（微調切邊）</Text>
            <Text style={styles.headerSubtitle}>拖曳四角圓點以去除無關背景雜訊</Text>
          </View>
          <TouchableOpacity
            style={[styles.headerBtn, styles.doneBtn]}
            onPress={handleApplyCrop}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#007AFF" />
            ) : (
              <Text style={styles.doneText}>完成</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* 圖片預覽與四角互動層 */}
        <View style={styles.cropArea}>
          <View style={styles.imageWrapper}>
            <Image
              source={{ uri: imageUri }}
              style={styles.image}
              resizeMode="contain"
              onLayout={onImageLayout}
            />

            {/* 四角框選邊界線與圓點控制器（Office Lens 風格） */}
            {imageLayout && (
              <View style={[StyleSheet.absoluteFill, { pointerEvents: 'box-none' }]}>
                
                {/* 框選範圍的邊界線條 */}
                <View
                  style={[
                    styles.cropBox,
                    {
                      left: Math.min(topLeft.x, bottomLeft.x),
                      top: Math.min(topLeft.y, topRight.y),
                      width: Math.max(topRight.x, bottomRight.x) - Math.min(topLeft.x, bottomLeft.x),
                      height: Math.max(bottomLeft.y, bottomRight.y) - Math.min(topLeft.y, topRight.y),
                    },
                  ]}
                />

                {/* 4 個角位的互動手把與放大輔助 */}
                {/* 左上角 */}
                <View
                  style={[styles.cornerHandle, { left: topLeft.x - 16, top: topLeft.y - 16 }]}
                  {...tlPan.panHandlers}
                >
                  <View style={[styles.cornerDot, activeCorner === 'TL' && styles.cornerDotActive]} />
                </View>

                {/* 右上角 */}
                <View
                  style={[styles.cornerHandle, { left: topRight.x - 16, top: topRight.y - 16 }]}
                  {...trPan.panHandlers}
                >
                  <View style={[styles.cornerDot, activeCorner === 'TR' && styles.cornerDotActive]} />
                </View>

                {/* 右下角 */}
                <View
                  style={[styles.cornerHandle, { left: bottomRight.x - 16, top: bottomRight.y - 16 }]}
                  {...brPan.panHandlers}
                >
                  <View style={[styles.cornerDot, activeCorner === 'BR' && styles.cornerDotActive]} />
                </View>

                {/* 左下角 */}
                <View
                  style={[styles.cornerHandle, { left: bottomLeft.x - 16, top: bottomLeft.y - 16 }]}
                  {...blPan.panHandlers}
                >
                  <View style={[styles.cornerDot, activeCorner === 'BL' && styles.cornerDotActive]} />
                </View>
              </View>
            )}
          </View>
        </View>

        {/* 底部輔助工具列 */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.footerAction} onPress={handleAutoDetect}>
            <Ionicons name="scan-outline" size={20} color="#FFF" />
            <Text style={styles.footerActionText}>自動抓邊</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.footerAction} onPress={handleSelectAll}>
            <Ionicons name="expand-outline" size={20} color="#FFF" />
            <Text style={styles.footerActionText}>全選整張</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.15)',
  },
  headerBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  cancelText: {
    color: '#FFF',
    fontSize: 16,
  },
  doneBtn: {
    backgroundColor: '#FFF',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 14,
  },
  doneText: {
    color: '#007AFF',
    fontSize: 15,
    fontWeight: '700',
  },
  titleWrapper: {
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: '#8E8E93',
    fontSize: 11,
    marginTop: 2,
  },
  cropArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  imageWrapper: {
    width: SCREEN_WIDTH * 0.88,
    height: SCREEN_HEIGHT * 0.65,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  cropBox: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#007AFF',
    backgroundColor: 'rgba(0, 122, 255, 0.12)',
  },
  cornerHandle: {
    position: 'absolute',
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99,
  },
  cornerDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#007AFF',
    borderWidth: 3,
    borderColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },
  cornerDotActive: {
    transform: [{ scale: 1.3 }],
    backgroundColor: '#34C759',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.15)',
    backgroundColor: '#1C1C1E',
  },
  footerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
  },
  footerActionText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
});
