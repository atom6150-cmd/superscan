import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { ScannedDocument, WatermarkConfig } from '../types';

// 安全的 Base64 轉 Uint8Array 工具（相容 iOS / React Native 環境）
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export class PdfService {
  /**
   * 將多頁掃描圖檔生成乾淨、高畫質、無未授權浮水印的 PDF
   */
  static async generatePdf(
    doc: ScannedDocument,
    customWatermark?: WatermarkConfig
  ): Promise<string> {
    const pdfDoc = await PDFDocument.create();

    // 標準 A4 尺寸 (pt: 595.28 x 841.89)
    const A4_WIDTH = 595.28;
    const A4_HEIGHT = 841.89;
    const MARGIN = 20;

    const availableWidth = A4_WIDTH - MARGIN * 2;
    const availableHeight = A4_HEIGHT - MARGIN * 2;

    for (const pageItem of doc.pages) {
      try {
        const base64Data = await FileSystem.readAsStringAsync(pageItem.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const imageBytes = base64ToUint8Array(base64Data);

        // 判斷圖片格式
        let embeddedImage;
        if (pageItem.uri.toLowerCase().endsWith('.png')) {
          embeddedImage = await pdfDoc.embedPng(imageBytes);
        } else {
          embeddedImage = await pdfDoc.embedJpg(imageBytes);
        }

        const imgWidth = embeddedImage.width;
        const imgHeight = embeddedImage.height;

        // 計算最佳等比例縮放以適應 A4
        const scale = Math.min(
          availableWidth / imgWidth,
          availableHeight / imgHeight
        );
        const drawWidth = imgWidth * scale;
        const drawHeight = imgHeight * scale;

        // 居中放置
        const posX = MARGIN + (availableWidth - drawWidth) / 2;
        const posY = MARGIN + (availableHeight - drawHeight) / 2;

        const pdfPage = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);

        pdfPage.drawImage(embeddedImage, {
          x: posX,
          y: posY,
          width: drawWidth,
          height: drawHeight,
        });

        // 加入自訂防偽安全浮水印（如果使用者有設定）
        const activeWatermark = customWatermark || doc.watermark;
        if (activeWatermark && activeWatermark.text.trim().length > 0) {
          const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
          const text = activeWatermark.text;
          const fontSize = activeWatermark.fontSize || 28;
          const opacity = activeWatermark.opacity || 0.3;

          // 在頁面中心與四周繪製防偽安全文字
          const textWidth = font.widthOfTextAtSize(text, fontSize);

          pdfPage.drawText(text, {
            x: A4_WIDTH / 2 - textWidth / 2,
            y: A4_HEIGHT / 2,
            size: fontSize,
            font,
            color: rgb(0.6, 0.6, 0.6),
            opacity: opacity,
            rotate: degrees(activeWatermark.rotation || 45),
          });
        }
      } catch (err) {
        console.error('處理 PDF 單頁失敗:', err);
      }
    }

    // 儲存 PDF 檔案
    const pdfBase64 = await pdfDoc.saveAsBase64({ dataUri: false });
    const cleanTitle = doc.title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_');
    const fileName = `${cleanTitle || 'SuperScan'}_${Date.now()}.pdf`;
    const targetPath = `${FileSystem.documentDirectory}${fileName}`;

    await FileSystem.writeAsStringAsync(targetPath, pdfBase64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    return targetPath;
  }

  /**
   * 呼叫 iOS 原生分享視窗 (AirDrop / 儲存至檔案 / LINE / 郵件)
   */
  static async sharePdf(filePath: string): Promise<void> {
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      throw new Error('此裝置目前不支援原生分享面板');
    }

    await Sharing.shareAsync(filePath, {
      mimeType: 'application/pdf',
      dialogTitle: '分享導出 PDF 文件',
      UTI: 'com.adobe.pdf',
    });
  }
}
