import AsyncStorage from '@react-native-async-storage/async-storage';
import { ScannedDocument, ScannedPage, CategoryType } from '../types';

const STORAGE_KEY = '@superscan_documents_v1';

export class StorageService {
  /**
   * 取得所有已儲存的文件列表（按建立時間降冪排序）
   */
  static async getDocuments(): Promise<ScannedDocument[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (!data) {
        return [];
      }
      const docs: ScannedDocument[] = JSON.parse(data);
      return docs.sort((a, b) => b.updatedAt - a.updatedAt);
    } catch (error) {
      console.error('讀取文件列表失敗:', error);
      return [];
    }
  }

  /**
   * 儲存或更新文件
   */
  static async saveDocument(doc: ScannedDocument): Promise<void> {
    try {
      const docs = await this.getDocuments();
      const existingIndex = docs.findIndex((d) => d.id === doc.id);

      if (existingIndex >= 0) {
        docs[existingIndex] = { ...doc, updatedAt: Date.now() };
      } else {
        docs.unshift({ ...doc, updatedAt: Date.now() });
      }

      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
    } catch (error) {
      console.error('儲存文件失敗:', error);
      throw error;
    }
  }

  /**
   * 建立全新掃描文件
   */
  static async createDocument(
    imageUris: string[],
    title?: string,
    category: CategoryType = 'contract'
  ): Promise<ScannedDocument> {
    const timestamp = Date.now();
    const defaultTitle = title || `文件_${new Date().toLocaleDateString('zh-TW').replace(/\//g, '')}_${new Date().getHours()}${new Date().getMinutes()}`;

    const pages: ScannedPage[] = imageUris.map((uri, idx) => ({
      id: `page_${timestamp}_${idx}`,
      uri,
      originalUri: uri,
      filter: 'original',
      rotation: 0,
    }));

    const newDoc: ScannedDocument = {
      id: `doc_${timestamp}`,
      title: defaultTitle,
      category,
      pages,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await this.saveDocument(newDoc);
    return newDoc;
  }

  /**
   * 刪除指定文件
   */
  static async deleteDocument(id: string): Promise<void> {
    try {
      const docs = await this.getDocuments();
      const filtered = docs.filter((d) => d.id !== id);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error('刪除文件失敗:', error);
      throw error;
    }
  }
}
