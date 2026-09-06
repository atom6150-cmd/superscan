import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WatermarkConfig } from '../types';

interface WatermarkModalProps {
  visible: boolean;
  currentWatermark?: WatermarkConfig;
  onClose: () => void;
  onApply: (config: WatermarkConfig | undefined) => void;
}

const QUICK_TEMPLATES = [
  '僅供申辦使用，他用無效',
  '僅供身分驗證，翻印無效',
  '內部機密文件，嚴禁外流',
  '僅供銀行開戶核印使用',
  '僅供簽約查驗專用',
];

export const WatermarkModal: React.FC<WatermarkModalProps> = ({
  visible,
  currentWatermark,
  onClose,
  onApply,
}) => {
  const [text, setText] = useState<string>(currentWatermark?.text || '');
  const [opacity, setOpacity] = useState<number>(currentWatermark?.opacity || 0.35);

  const handleApply = () => {
    if (!text.trim()) {
      onApply(undefined); // 清除浮水印
    } else {
      onApply({
        text: text.trim(),
        opacity: opacity,
        color: '#666666',
        fontSize: 26,
        rotation: 45,
      });
    }
    onClose();
  };

  const handleClear = () => {
    setText('');
    onApply(undefined);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.sheetContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>防偽安全浮水印</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#8E8E93" />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>
            添加浮水印可防止文件、身分證件或合約遭到他人未授權挪用或冒領。
          </Text>

          {/* 輸入框 */}
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="輸入自訂浮水印文字（例如：僅供XX使用）"
              placeholderTextColor="#8E8E93"
              value={text}
              onChangeText={setText}
              maxLength={40}
            />
            {text.length > 0 && (
              <TouchableOpacity onPress={() => setText('')}>
                <Ionicons name="close-circle" size={18} color="#8E8E93" />
              </TouchableOpacity>
            )}
          </View>

          {/* 常用快捷範本 */}
          <Text style={styles.sectionLabel}>常用防偽快捷範本：</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.templateScroll}
          >
            {QUICK_TEMPLATES.map((tmpl, idx) => (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.templateChip,
                  text === tmpl && styles.templateChipActive,
                ]}
                onPress={() => setText(tmpl)}
              >
                <Text
                  style={[
                    styles.templateChipText,
                    text === tmpl && styles.templateChipTextActive,
                  ]}
                >
                  {tmpl}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* 透明度切換 */}
          <Text style={styles.sectionLabel}>浮水印顯眼程度：</Text>
          <View style={styles.opacityRow}>
            {[
              { label: '淡雅 (20%)', val: 0.2 },
              { label: '標準 (35%)', val: 0.35 },
              { label: '醒目 (50%)', val: 0.5 },
            ].map((item) => (
              <TouchableOpacity
                key={item.label}
                style={[
                  styles.opacityBtn,
                  opacity === item.val && styles.opacityBtnActive,
                ]}
                onPress={() => setOpacity(item.val)}
              >
                <Text
                  style={[
                    styles.opacityBtnText,
                    opacity === item.val && styles.opacityBtnTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* 按鈕組 */}
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.clearBtn} onPress={handleClear}>
              <Text style={styles.clearBtnText}>清除浮水印</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.applyBtn} onPress={handleApply}>
              <Text style={styles.applyBtnText}>確認套用</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  subtitle: {
    fontSize: 13,
    color: '#8E8E93',
    lineHeight: 18,
    marginBottom: 16,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#1C1C1E',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3A3A3C',
    marginBottom: 8,
  },
  templateScroll: {
    marginBottom: 16,
  },
  templateChip: {
    backgroundColor: '#F2F2F7',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  templateChipActive: {
    backgroundColor: '#E5F0FF',
    borderColor: '#007AFF',
  },
  templateChipText: {
    fontSize: 13,
    color: '#3A3A3C',
  },
  templateChipTextActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
  opacityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  opacityBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#F2F2F7',
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  opacityBtnActive: {
    backgroundColor: '#E5F0FF',
    borderColor: '#007AFF',
  },
  opacityBtnText: {
    fontSize: 13,
    color: '#3A3A3C',
  },
  opacityBtnTextActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  clearBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    marginRight: 10,
  },
  clearBtnText: {
    color: '#FF3B30',
    fontSize: 15,
    fontWeight: '600',
  },
  applyBtn: {
    flex: 1.5,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#007AFF',
  },
  applyBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
