import { v4 as uuidv4 } from 'uuid';
import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { Bot, Loader2, Database } from 'lucide-react';
import { useCascade } from '@cascaide-ts/react';
import { MessageBubble } from './message-bubble';

// ---------------------------------------------------------------------------
// TOOL REGISTRY
//
// This is the main place you extend the chat UI.
//
// Each key is a tool name your LLM can call.
// Each value is a React component that receives:
//   - args        — parsed tool call arguments (what the LLM passed)
//   - onComplete  — call this with a string result to send a tool response
//                   and continue the cascade. Omit if this is display-only.
//   - isFinished  — true if a tool response already exists (e.g. on reload)
//   - savedResult — the existing tool response string if isFinished is true
//
// DISPLAY TOOL (no user interaction):
//   my_chart_tool: ({ args }) => <ChartRenderer data={args.data} />
//
// INPUT TOOL (user acts, cascade continues):
//   my_approval_tool: ({ args, onComplete, isFinished, savedResult }) => (
//     <ApprovalCard
//       request={args.request}
//       onApprove={() => onComplete('approved')}
//       onReject={() => onComplete('rejected')}
//       isFinished={isFinished}
//       savedResult={savedResult}
//     />
//   )
// ---------------------------------------------------------------------------

import { HotelOptions } from './tool-ui/hotel-tool';
import { Spawns } from '@cascaide-ts/core';

export type ToolComponentProps = {
    args: any;
    onComplete: (result: string) => void;
    isFinished: boolean;
    savedResult: string | null;
};

export const toolRegistry: Record<string, React.ComponentType<ToolComponentProps>> = {
    // ---
    // Example input tool: user selects a hotel, cascade continues with their choice.
    // Replace or extend this with your own tools.
    // ---
    present_hotel_options: HotelOptions,
};


// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DelegationStatus = 'pending' | 'complete';

type Delegation = {
    subCascadeId: string;
    toolCallId: string;
    agentName: string;
    status: DelegationStatus;
};


// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Converts 'delegate_to_availabilityAgentNode' → 'availabilityAgentNode'
// Matches the node name convention in your graph.
// Update this if your delegation tool naming convention differs.
const getSubAgentNodeName = (toolName: string): string | null => {
    if (toolName.startsWith('delegate_to_')) {
        return toolName.replace('delegate_to_', '') + 'Node';
    }
    return null;
};



// ---------------------------------------------------------------------------
// MessageList
//
// Owns two things:
//   1. Delegation orchestration — spawning sub-cascades when the supervisor
//      delegates to a sub-agent, and returning results via handleToolResponse.
//   2. Tool rendering — looking up tool components from the registry and
//      wiring their onComplete → handleToolResponse automatically.
//
// Users should not need to modify this file to add new tools.
// Add tool UIs to toolRegistry above instead.
// ---------------------------------------------------------------------------

export const MessageList = memo(({
    displayHistory,
    userId,
    addActiveNode,
    handleToolResponse,
}: {
    displayHistory: any[];
    userId: string | undefined;
    // addActiveNode comes from useWorkflow — triggers a node execution in the graph
    addActiveNode: any
    // handleToolResponse sends a tool result message and continues the cascade
    handleToolResponse: any;
}) => {
    // Tracks all delegations: their cascade ID, agent name, and completion status.
    // A single map is used so parallel delegations can be managed together.
    const [delegations, setDelegations] = useState<Map<string, Delegation>>(new Map());

    const getDelegationStatus = (toolCallId: string): DelegationStatus | null =>
        delegations.get(toolCallId)?.status ?? null;


    // ---
    // Delegation detection
    //
    // When the supervisor calls a 'delegate_to_*' tool, we:
    //   1. Spawn a new sub-cascade for the sub-agent via addActiveNode (useWorkflow)
    //   2. Track it in state so CascadeMonitor can observe it via useCascade
    //   3. When the sub-cascade completes, send its result back as a tool response
    //
    // This runs whenever displayHistory changes, checking only the last assistant message
    // to avoid reprocessing previous delegations.
    // ---
    useEffect(() => {
        const processDelegations = async () => {
            if (displayHistory.length === 0) return;

            const lastAssistantIndex = displayHistory.findLastIndex(
                msg => msg.role === 'assistant' && msg.tool_calls
            );
            if (lastAssistantIndex === -1) return;

            const lastAssistantMessage = displayHistory[lastAssistantIndex];
            const delegationTools = lastAssistantMessage.tool_calls.filter((tc: any) =>
                tc.function.name.startsWith('delegate_to_')
            );
            if (delegationTools.length === 0) return;

            for (const toolCall of delegationTools) {
                // Skip if already being tracked
                if (delegations.has(toolCall.id)) continue;

                // If a tool result already exists in history, mark complete immediately
                const hasToolResult = displayHistory.slice(lastAssistantIndex + 1).some(msg =>
                    msg.role === 'tool' && msg.tool_call_id === toolCall.id
                );
                if (hasToolResult) {
                    setDelegations(prev => {
                        const next = new Map(prev);
                        next.set(toolCall.id, {
                            subCascadeId: '',
                            toolCallId: toolCall.id,
                            agentName: '',
                            status: 'complete',
                        });
                        return next;
                    });
                    continue;
                }

                // Wait for arguments to finish streaming before parsing
                const argsString = toolCall.function.arguments;
                if (!argsString?.trim().endsWith('}')) {
                    if (lastAssistantIndex === displayHistory.length - 1) continue;
                }

                try {
                    const args = JSON.parse(argsString);
                    const subNodeName = getSubAgentNodeName(toolCall.function.name);
                    const query = args.query;
                    if (!subNodeName || !query) {
                        console.error('Invalid delegation arguments:', toolCall);
                        continue;
                    }

                    const newSubCascadeId = `sub_cascade_${uuidv4()}`;

                    setDelegations(prev => {
                        const next = new Map(prev);
                        next.set(toolCall.id, {
                            subCascadeId: newSubCascadeId,
                            toolCallId: toolCall.id,
                            agentName: subNodeName,
                            status: 'pending',
                        });
                        return next;
                    });

                    // Trigger the sub-agent node in the graph.
                    // The sub-cascade ID links this execution to CascadeMonitor below.
                    const spawns: Spawns = {
                        [subNodeName]: {
                          cascadeId: newSubCascadeId,
                          history: [{ role: 'user', content: query.trim() }],
                          originalToolCallId: toolCall.id,
                          userId,
                        }
                      };
                      await addActiveNode(spawns);
                } catch (error) {
                    console.error('Error processing delegation:', error);
                }
            }
        };

        processDelegations();
    }, [displayHistory.length, displayHistory[displayHistory.length - 1]]);


    // ---
    // Called by CascadeMonitor when a sub-cascade completes.
    // Sends the result back as a tool response to continue the parent cascade,
    // then marks the delegation complete.
    // ---
    const handleDelegationComplete = useCallback((toolCallId: string, result: string) => {
        handleToolResponse({
            role: 'tool',
            tool_call_id: toolCallId,
            content: result || 'Sub-cascade completed successfully.',
        });

        setDelegations(prev => {
            const next = new Map(prev);
            const existing = next.get(toolCallId);
            if (existing) next.set(toolCallId, { ...existing, status: 'complete' });
            return next;
        });
    }, [handleToolResponse]);


    // Clean up completed delegations once all parallel ones are done
    useEffect(() => {
        const values = Array.from(delegations.values());
        if (values.some(d => d.status === 'pending')) return;
        if (!values.some(d => d.status === 'complete')) return;

        setDelegations(prev => {
            const next = new Map(prev);
            for (const [id, d] of next) {
                if (d.status === 'complete') next.delete(id);
            }
            return next;
        });
    }, [delegations]);


    const showAILoading = useMemo(() =>
        displayHistory.length > 0 &&
        displayHistory[displayHistory.length - 1]?.role === 'user' &&
        delegations.size === 0,
        [displayHistory.length, displayHistory[displayHistory.length - 1]?.role, delegations.size]
    );

    const activeDelegations = useMemo(() =>
        Array.from(delegations.values()).filter(d => d.status === 'pending'),
        [delegations]
    );

    return (
        <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="max-w-4xl mx-auto">
                {displayHistory.map((msg, idx) => {
                    // Skip raw tool result messages — they are consumed by the tool UI
                    if (msg.role === 'tool') return null;

                    // For each registered tool call in this message, find if a tool
                    // response already exists in history (used for isFinished + savedResult)
                    const toolResults: Record<string, any> = {};
                    msg.tool_calls?.forEach((tc: any) => {
                        const result = displayHistory.slice(idx + 1).find(
                            m => m.role === 'tool' && m.tool_call_id === tc.id
                        );
                        if (result) toolResults[tc.id] = result;
                    });

                    // Find delegation tool call for status indicator in MessageBubble
                    const delegationTool = msg.tool_calls?.find((tc: any) =>
                        tc.function.name.startsWith('delegate_to_')
                    );

                    return (
                        <div key={`${idx}-${msg.role}`}>
                            <MessageBubble
                                message={msg}
                                userId={userId}
                                delegationStatus={delegationTool
                                    ? getDelegationStatus(delegationTool.id)
                                    : null
                                }
                                // Wire tool registry: MessageBubble receives handleToolResponse
                                // and toolResults so it can build onComplete and isFinished
                                // for each tool component without exposing those internals
                                // to the tool components themselves.
                                onToolComplete={async (toolCallId, result) => {
                                    await handleToolResponse({
                                        role: 'tool',
                                        tool_call_id: toolCallId,
                                        content: result,
                                    });
                                }}
                                toolResults={toolResults}
                            />
                        </div>
                    );
                })}

                {/* Shown while the LLM is generating a response */}
                {showAILoading && (
                    <div className="flex items-start gap-4 py-4">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                            <Bot className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold mb-2 text-gray-500">Assistant</div>
                            <div className="rounded-xl px-4 py-3 bg-transparent border border-blue-100">
                                <div className="flex items-center gap-2">
                                    <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                                    <span className="text-base text-gray-600">Thinking...</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* One CascadeMonitor per active sub-cascade.
                    Each one uses useCascade to observe its sub-cascade and calls
                    handleDelegationComplete when done. */}
                {activeDelegations.map(delegation => (
                    <CascadeMonitor
                        key={delegation.subCascadeId}
                        subCascadeId={delegation.subCascadeId}
                        toolCallId={delegation.toolCallId}
                        agentName={delegation.agentName}
                        onComplete={handleDelegationComplete}
                    />
                ))}
            </div>
        </div>
    );
});

MessageList.displayName = 'MessageList';


// ---------------------------------------------------------------------------
// CascadeMonitor
//
// Mounts for each active sub-cascade delegation.
// Uses useCascade to observe the sub-cascade state.
// When complete, extracts the last meaningful message and calls onComplete,
// which sends it back as a tool response to the parent cascade.
//
// This component unmounts itself by triggering handleDelegationComplete,
// which marks the delegation complete in MessageList state, removing it
// from activeDelegations and therefore unmounting this component.
// ---------------------------------------------------------------------------

const CascadeMonitor = memo(({
    subCascadeId,
    toolCallId,
    agentName,
    onComplete,
}: {
    subCascadeId: string;
    toolCallId: string;
    agentName: string;
    onComplete: (toolCallId: string, result: string) => void;
}) => {
    // useCascade observes the sub-cascade by ID.
    // isComplete flips to true when the sub-agent finishes its execution.
    const { cascadeState, isComplete } = useCascade(subCascadeId);

    useEffect(() => {
        if (!isComplete || !cascadeState) return;

        const history = cascadeState.history;
        if (!history?.length) {
            console.warn(`Sub-cascade ${subCascadeId} completed with empty history.`);
            return;
        }

        // Extract the last meaningful message as the result to return to the supervisor
        const lastMessage = [...history].reverse().find(msg =>
            msg.content?.trim().length > 0 &&
            (msg.role === 'assistant' || msg.role === 'tool')
        );

        const result = lastMessage?.content ?? 'Sub-cascade completed, but no data was returned.';
        onComplete(toolCallId, result);

        // No hasCompleted guard needed — onComplete causes this component to unmount
    }, [isComplete, cascadeState]);

    return (
        <div className="flex items-start gap-4 py-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-600 text-white">
                <Database className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold mb-2 text-gray-500">
                    {agentName || 'Agent'}
                </div>
                <div className="rounded-xl px-4 py-3 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200">
                    <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 text-purple-600 animate-spin" />
                        <span className="text-base text-gray-700">Working...</span>
                    </div>
                </div>
            </div>
        </div>
    );
});

CascadeMonitor.displayName = 'CascadeMonitor';