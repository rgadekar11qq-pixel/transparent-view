import type { Category } from './analyze/types';

export const CATEGORY_COLORS: Record<Category, { fill: string; ring: string; soft: string }> = {
  project: { fill: '#6366f1', ring: '#6366f155', soft: '#6366f115' },
  frontend: { fill: '#0ea5e9', ring: '#0ea5e955', soft: '#0ea5e915' },
  backend: { fill: '#10b981', ring: '#10b98155', soft: '#10b98115' },
  database: { fill: '#f59e0b', ring: '#f59e0b55', soft: '#f59e0b15' },
  apis: { fill: '#8b5cf6', ring: '#8b5cf655', soft: '#8b5cf615' },
  auth: { fill: '#f43f5e', ring: '#f43f5e55', soft: '#f43f5e15' },
  storage: { fill: '#06b6d4', ring: '#06b6d455', soft: '#06b6d415' },
  dependencies: { fill: '#64748b', ring: '#64748b55', soft: '#64748b15' },
  config: { fill: '#d946ef', ring: '#d946ef55', soft: '#d946ef15' },
  testing: { fill: '#84cc16', ring: '#84cc1655', soft: '#84cc1615' },
  deployment: { fill: '#f97316', ring: '#f9731655', soft: '#f9731615' },
  external: { fill: '#ec4899', ring: '#ec489955', soft: '#ec489915' },
};
