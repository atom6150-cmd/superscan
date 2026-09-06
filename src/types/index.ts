export type FilterType = 'original' | 'magic' | 'bw' | 'grayscale';

export type CategoryType = 'all' | 'contract' | 'invoice' | 'idcard' | 'note' | 'other';

export interface ScannedPage {
  id: string;
  uri: string;
  originalUri: string;
  filter: FilterType;
  rotation: number; // 0, 90, 180, 270
  width?: number;
  height?: number;
}

export interface WatermarkConfig {
  text: string;
  opacity: number;
  color: string;
  fontSize: number;
  rotation: number;
}

export interface ScannedDocument {
  id: string;
  title: string;
  category: CategoryType;
  pages: ScannedPage[];
  createdAt: number;
  updatedAt: number;
  watermark?: WatermarkConfig;
}

export const CATEGORY_LABELS: Record<CategoryType, string> = {
  all: '全部',
  contract: '合約協議',
  invoice: '發票收據',
  idcard: '證件名片',
  note: '筆記手稿',
  other: '其他文檔',
};
