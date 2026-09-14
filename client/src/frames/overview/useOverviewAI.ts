import { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import type { OverviewFrameContract } from './overviewTypes';

type OverviewResponse = OverviewFrameContract | { empty: true; reason: string };

function isEmptyResponse(data: OverviewResponse): data is { empty: true; reason: string } {
  return 'empty' in data && data.empty === true;
}

export function useOverviewAI(projectId: string) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const query = useQuery<OverviewResponse>({
    queryKey: ['api', 'projects', projectId, 'overview'],
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const isEmpty = query.data ? isEmptyResponse(query.data) : false;
  const contract = query.data && !isEmptyResponse(query.data) ? query.data : null;
  const isCached = contract && '_cached' in contract;

  const forceRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await apiRequest('GET', `/api/projects/${projectId}/overview?refresh=true`);
      const freshData = await res.json();
      queryClient.setQueryData(['api', 'projects', projectId, 'overview'], freshData);
    } catch (err) {
      console.error('[Overview] Force refresh failed:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [projectId]);

  return {
    contract,
    isEmpty,
    isCached,
    isLoading: query.isLoading,
    isRefreshing,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    forceRefresh,
  };
}
