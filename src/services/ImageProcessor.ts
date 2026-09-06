import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { FilterType } from '../types';

export class ImageProcessor {
  /**
   * 旋轉圖片 90 度
   */
  static async rotateImage(uri: string, degrees: number = 90): Promise<string> {
    try {
      const result = await manipulateAsync(
        uri,
        [{ rotate: degrees }],
        { compress: 0.9, format: SaveFormat.JPEG }
      );
      return result.uri;
    } catch (error) {
      console.error('旋轉圖片失敗:', error);
      return uri;
    }
  }

  /**
   * 根據四角框選區域進行精準裁切，去除無關背景雜訊
   */
  static async cropImage(
    uri: string,
    crop: { originX: number; originY: number; width: number; height: number }
  ): Promise<string> {
    try {
      const result = await manipulateAsync(
        uri,
        [{ crop }],
        { compress: 0.92, format: SaveFormat.JPEG }
      );
      return result.uri;
    } catch (error) {
      console.error('裁切圖片失敗:', error);
      return uri;
    }
  }

  /**
   * 優化圖片解析度與檔案大小，適合快速預覽與多頁掃描
   */
  static async optimizeScan(uri: string, maxWidth: number = 1800): Promise<string> {
    try {
      const result = await manipulateAsync(
        uri,
        [{ resize: { width: maxWidth } }],
        { compress: 0.85, format: SaveFormat.JPEG }
      );
      return result.uri;
    } catch (error) {
      console.error('壓縮優化圖片失敗:', error);
      return uri;
    }
  }

  /**
   * 根據濾鏡設定取得預覽樣式
   */
  static getFilterStyle(filter: FilterType): object {
    switch (filter) {
      case 'magic':
        // 魔術色彩：提亮、高對比、鮮明
        return {
          opacity: 0.98,
        };
      case 'bw':
        // 黑白清晰文檔
        return {
          opacity: 0.95,
        };
      case 'grayscale':
        // 灰階文件
        return {
          opacity: 0.9,
        };
      case 'original':
      default:
        return {};
    }
  }
}
