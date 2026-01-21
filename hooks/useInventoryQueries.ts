import { useQuery } from '@tanstack/react-query';

interface InventoryParams {
  page: number;
  pageSize: number;
  searchTerm: string;
  selectedCategory: string;
  selectedStore: string;
  selectedBrand: string;
  showAll: boolean;
}

interface InventoryResponse {
  items: any[];
  stats: {
    totalItems: number;
    uniqueCategories: number;
    uniqueStores: number;
  };
  pagination: {
    currentPage: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
  filterOptions: {
    categories: string[];
    stores: string[];
    brands: string[];
  };
  hasEditAccess: boolean;
  isEditOnly: boolean;
}

export function useInventory({
  page,
  pageSize,
  searchTerm,
  selectedCategory,
  selectedStore,
  selectedBrand,
  showAll,
}: InventoryParams) {
  return useQuery<InventoryResponse>({
    queryKey: [
      'inventory',
      page,
      pageSize,
      searchTerm,
      selectedCategory,
      selectedStore,
      selectedBrand,
      showAll,
    ],
    queryFn: async () => {
      const effectiveLimit = showAll ? 5000 : pageSize;
      const params = new URLSearchParams({
        page: showAll ? '1' : page.toString(),
        limit: effectiveLimit.toString(),
        search: searchTerm,
        category: selectedCategory || '',
        store: selectedStore || '',
        brand: selectedBrand || '',
      });

      const response = await fetch(`/api/inventory/get?${params.toString()}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch inventory');
      }
      return response.json();
    },
    staleTime: 30 * 1000, // 30 seconds
  });
}

interface StatsResponse {
  stats: {
    totalItems: number;
    uniqueCategories: number;
    uniqueStores: number;
  };
}

export function useInventoryStats() {
  return useQuery<StatsResponse>({
    queryKey: ['inventory-stats'],
    queryFn: async () => {
      const response = await fetch('/api/inventory/get?page=1&limit=1');
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch stats');
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - stats don't change often
  });
}

interface FilterOption {
  categories: string[];
  stores: string[];
  brands: string[];
}

interface FilterOptionsResponse {
  filterOptions: FilterOption;
}

export function useFilterOptions() {
  return useQuery<FilterOption>({
    queryKey: ['inventory-filter-options'],
    queryFn: async () => {
      // Fetch from API - it returns filterOptions calculated from all items
      const response = await fetch('/api/inventory/get?page=1&limit=1');
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch filter options');
      }
      const data: FilterOptionsResponse = await response.json();
      return data.filterOptions;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - filter options don't change often
  });
}
