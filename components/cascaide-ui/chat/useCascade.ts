// /hooks/useCascade.ts
"use client"
import { useDispatch, useSelector } from 'react-redux';
import { useMemo } from 'react';
import { AppDispatch, hydrateContext, RootState, WorkflowContext } from '@cascaide-ts/core'
import { 
  makeSelectCascadeNodes, 
  makeSelectCascadeState,
  selectAllCascadeIds 
} from '@cascaide-ts/core'

export type CascadeNode = {
  nodeId: string;
  nodeName: string;
  parentTriggerId?: string;
  initialContext?: any;
  processed?: boolean;
};

export type CascadeState = {
  task?: string;
  status?: string;
  currentNode?: string;
  history?: any[];
  lastUpdate?: number;
  [key: string]: any;
};

export const useCascade = (cascadeId: string) => {
  const selectCascadeState = useMemo(makeSelectCascadeState, []);
  const selectCascadeNodes = useMemo(makeSelectCascadeNodes, []);
  const dispatch = useDispatch<AppDispatch>();


  const cascadeState = useSelector((state: RootState) =>
    selectCascadeState(state, cascadeId)
  );

  const cascadeNodes = useSelector((state: RootState) =>
    selectCascadeNodes(state, cascadeId)
  );

  const currentNode = useMemo(() => {
    if (cascadeNodes.length === 0) return null;

    return [...cascadeNodes].sort((a, b) => {
      const tsA = parseInt(a.nodeId.split('_')[1] || '0');
      const tsB = parseInt(b.nodeId.split('_')[1] || '0');
      return tsB - tsA;
    })[0];
  }, [cascadeNodes]);

  // Build tree structure for visualization
  const cascadeTree = useMemo(() => {
    const nodeMap = new Map(
      cascadeNodes.map((n) => [n.nodeId, { ...n, children: [] as any[] }])
    );
    const roots: any[] = [];

    cascadeNodes.forEach((node) => {
      const nodeWithChildren = nodeMap.get(node.nodeId);
      if (node.parentTriggerId && nodeMap.has(node.parentTriggerId)) {
        nodeMap.get(node.parentTriggerId)!.children.push(nodeWithChildren);
      } else {
        roots.push(nodeWithChildren);
      }
    });

    return roots;
  }, [cascadeNodes]);

  const forkCascade = async (
    newCascadeId: string,
    upToFunctionId: number,
    apiEndpoint: string
  ): Promise<{ newCascadeId: string; status: string }> => {
    const result = await apiForkCascade(cascadeId, newCascadeId, upToFunctionId, apiEndpoint);
  
    const hydratedContext = await apiHydrateCascadeContext(
      newCascadeId,
      upToFunctionId,
      apiEndpoint
    );
    
    console.log('[FORK] hydrated payload:', JSON.stringify(hydratedContext, null, 2));
    console.log('[FORK] keys:', Object.keys(hydratedContext));
    await dispatch(hydrateContext(hydratedContext));
    console.log('[FORK] dispatched');
  
    // await dispatch(hydrateContext(hydratedContext));
  
    return result;
  };
  // Check if cascade is complete (no active nodes)
  const isComplete = cascadeNodes.length === 0 && cascadeState !== undefined;

  // Check if cascade exists at all
  const exists = cascadeState !== undefined || cascadeNodes.length > 0;

  return {
    cascadeState, // The state object written to context
    cascadeNodes, // All active nodes in this cascade
    currentNode, // Most recent active node
    cascadeTree, // Tree structure of nodes
    isComplete, // No active nodes but state exists
    exists, // Cascade has been created
    forkCascade,
  };
};

export const useAllCascades = () => {
  // Directly use the memoized selector instead of an inline function
  const cascadeIds = useSelector(selectAllCascadeIds);

  return cascadeIds;
};

export async function apiForkCascade(
  sourceCascadeId: string,
  newCascadeId: string,
  upToFunctionId: number,
  apiEndpoint: string
): Promise<{ newCascadeId: string; status: string }> {
  const res = await fetch(apiEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'fork',
      sourceCascadeId,
      newCascadeId,
      upToFunctionId,
    }),
  });
  if (!res.ok) throw new Error(`forkCascade failed: ${await res.text()}`);
  return res.json();
}

export async function apiHydrateCascadeContext(
  cascadeId: string,
  functionId: number,
  apiEndpoint: string
): Promise<WorkflowContext> {
  const res = await fetch(apiEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'hydrate', cascadeId, functionId }),
  });
  if (!res.ok) throw new Error(`hydrate failed: ${await res.text()}`);
  return res.json();
}