// Shared ticket filter parsing/application used by /api/tickets/get and /api/tickets/export-list
// so list results and exports can never drift apart.

export interface TicketFilterParams {
  status?: string[];        // underscore form, e.g. ['open', 'in_progress']
  severity?: string[];      // e.g. ['SEV1', 'SEV2']
  storeId?: string[];       // stores.id uuids
  categoryId?: string[];    // problem_categories.id uuids
  requestTypeId?: string[]; // request_types.id uuids
  servicedBy?: string[];    // profile uuids; special value 'unassigned'
  search?: string;
  startDate?: string;
  endDate?: string;
}

const parseList = (value: unknown): string[] | undefined => {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const items = value.split(',').map((v) => v.trim()).filter(Boolean);
  return items.length > 0 ? items : undefined;
};

// Parse filter params from an API request query object.
export function parseTicketFilters(query: Record<string, unknown>): TicketFilterParams {
  const statusRaw = parseList(query.status);
  return {
    // Convert display format to database format (e.g. "in progress" -> "in_progress")
    status: statusRaw
      ?.filter((s) => s !== 'all')
      .map((s) => s.toLowerCase().replace(/ /g, '_')),
    severity: parseList(query.severity),
    storeId: parseList(query.storeId),
    categoryId: parseList(query.categoryId),
    requestTypeId: parseList(query.requestTypeId),
    servicedBy: parseList(query.servicedBy),
    search: typeof query.search === 'string' && query.search ? query.search : undefined,
    startDate: typeof query.startDate === 'string' && query.startDate ? query.startDate : undefined,
    endDate: typeof query.endDate === 'string' && query.endDate ? query.endDate : undefined,
  };
}

// Apply filters to a supabase query builder (works for both count and data queries).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyTicketFilters<T extends { eq: any }>(query: T, filters: TicketFilterParams): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = query;

  if (filters.status && filters.status.length > 0) {
    q = filters.status.length === 1
      ? q.eq('status', filters.status[0])
      : q.in('status', filters.status);
  }

  if (filters.severity && filters.severity.length > 0) {
    q = q.in('sev', filters.severity);
  }

  if (filters.storeId && filters.storeId.length > 0) {
    q = q.in('store_id', filters.storeId);
  }

  if (filters.categoryId && filters.categoryId.length > 0) {
    q = q.in('problem_category_id', filters.categoryId);
  }

  if (filters.requestTypeId && filters.requestTypeId.length > 0) {
    q = q.in('request_type_id', filters.requestTypeId);
  }

  if (filters.servicedBy && filters.servicedBy.length > 0) {
    const ids = filters.servicedBy.filter((v) => v !== 'unassigned');
    const includeUnassigned = filters.servicedBy.includes('unassigned');
    if (includeUnassigned && ids.length > 0) {
      q = q.or(`serviced_by.in.(${ids.join(',')}),serviced_by.is.null`);
    } else if (includeUnassigned) {
      q = q.is('serviced_by', null);
    } else {
      q = q.in('serviced_by', ids);
    }
  }

  if (filters.search) {
    q = q.or(`rcc_reference_number.ilike.%${filters.search}%,request_type.ilike.%${filters.search}%,device.ilike.%${filters.search}%`);
  }

  if (filters.startDate) {
    q = q.gte('date_reported', filters.startDate);
  }
  if (filters.endDate) {
    q = q.lte('date_reported', filters.endDate);
  }

  return q as T;
}
