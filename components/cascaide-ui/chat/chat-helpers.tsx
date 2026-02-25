import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

import { v4 as uuidv4 } from 'uuid';
import { useRouter } from 'next/navigation';
import React, { useState, useEffect, useRef, useMemo, ReactNode, useCallback } from 'react';
import { useCascade } from '@cascaide-ts/react';

import { 
  Wrench, User, ChevronDown, FileText, ExternalLink, CheckCircle2, MessageSquare, Rocket, Bot,
  ChevronLeft, ChevronRight, Loader2,  Database} from 'lucide-react';
import { BrainCircuit } from 'lucide-react'

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import {
  LineChart, BarChart, AreaChart, PieChart,
  Line, Bar, Area, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts"
import { LayoutDashboard } from "lucide-react";
import {  Download, Mail, X, Send } from 'lucide-react';
import { toast } from 'sonner';


const CopyIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="13" height="13" x="9" y="9" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
);
const CheckIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
);


export const MarkdownContent = ({ content }: { content: string }) => {
  // Text color is dark, standing on a light background
  return (
    <div className="markdown-content text-gray-900">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeHighlight, rehypeKatex]}
        components={{
          // --- Headings: Light border ---
          h1: ({ children }) => <h1 className="text-2xl font-bold mt-5 mb-3 border-b border-gray-300 pb-2">{children}</h1>,
          h2: ({ children }) => <h2 className="text-xl font-semibold mt-4 mb-2">{children}</h2>,
          h3: ({ children }) => <h3 className="text-lg font-semibold mt-3 mb-2">{children}</h3>,
          p: ({ children }) => <p className="mb-3 leading-relaxed">{children}</p>,
          
          // --- Lists ---
          ul: ({ children }) => <ul className="list-disc list-inside space-y-1.5 ml-4 my-3">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-inside space-y-1.5 ml-4 my-3">{children}</ol>,
          li: ({ children }) => <li className="pl-1">{children}</li>,

          // --- Links ---
          a: ({ children, href }) => (
            <a href={href} className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          
          // --- Code: Inline Code (Light theme) ---
          code: ({ className, children, ...props }: any) => {
            const inline = !className;
            if (inline) {
              // Inline code: Light gray background, dark text
              return <code className="bg-gray-200 text-gray-800 px-1.5 py-0.5 rounded text-sm font-mono">{children}</code>;
            }
            // Block code: Children handled by the custom component
            return children;
          },
        //   pre: ({ children }) => <CodeBlock className={(children as any)?.props?.className}>{children}</CodeBlock>,

          // --- Tables: Light theme style ---
          table: ({ children }) => (
            <div className="overflow-x-auto my-4 border border-gray-300 rounded-lg shadow-sm">
              <table className="min-w-full divide-y divide-gray-300">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">{children}</th>,
          td: ({ children }) => <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 border-t border-gray-200">{children}</td>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};



export const transformChartData = (originalData: any, chartType: string) => {
  const { labels, datasets } = originalData;
  if (!labels || !datasets || datasets.length === 0) {
    return null;
  }

  // --- ✅ FIX: ADDED SPECIAL HANDLING FOR PIE CHARTS ---
  if (chartType.toLowerCase() === 'pie') {
    const dataset = datasets[0]; // Pie charts typically use only the first dataset
    if (!dataset || !dataset.data) return null;

    return {
      // Create a simple { name, value } structure which is ideal for Recharts Pie
      data: labels.map((label: string, index: number) => ({
        name: label,
        value: dataset.data[index],
      })),
      xAxisKey: 'name',    // The key for the slice's label
      dataKeys: ['value'], // The key for the slice's numerical value
      colors: dataset.backgroundColor || [], // Use the full array of colors
    };
  }

  // --- Existing logic for other chart types (Line, Bar, Area) remains the same ---
  const transformedData = labels.map((label: string, index: number) => {
    const dataPoint: Record<string, any> = {
      xAxisLabel: label,
    };
    datasets.forEach((dataset: any) => {
      dataPoint[dataset.label] = dataset.data[index];
    });
    return dataPoint;
  });
  
  const dataKeys = datasets.map((dataset: any) => dataset.label);
  
  return {
    data: transformedData,
    xAxisKey: 'xAxisLabel',
    dataKeys: dataKeys,
    // This logic is okay for single-series charts but might need adjustment for multi-series
    colors: datasets.map((d: any) => d.backgroundColor ? d.backgroundColor[0] : '#8884d8'),
  };
};




// Helper component for Nav Items



type ToolCall = {
    function: {
        name: string;
        arguments: string;
    }
}

type Message = {
  role: 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[]; // Adjusted type
  tool_call_id?: string;
  name?: string;
};

// Type for chat history item (compatible with server action types)
type ChatHistory = {
    id: string;
    title: string;
    messages: Message[]; 
    lastUpdated: number;
};

// The main Sidebar component
import { 
    Menu as MenuIcon, 
    X as CloseIcon, 
    Plus as PlusIcon,
 
    Settings as SettingsIcon,
    // Using simple icons for the new nav items from Lucide
    Link as ConnectIcon, 
    BarChart3 as AnalystIcon, 
    FileText as ReportIcon, 
    MessageCircle as ChatIcon // Using a generic icon for history/chat items
} from 'lucide-react';
// Assuming ChatHistory is defined elsewhere
// type ChatHistory = { id: string, title: string, lastUpdated: number, messages: { role: string, content: string }[] }; 


// --- Reusable Nav Item Component ---
// This component handles the rendering logic for both expanded and collapsed states
const NavItem = ({
    icon,
    label,
    onClick,
    isExpanded,
    isActive,
}: {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    isExpanded: boolean;
    isActive: boolean;
}) => (
    <button
        onClick={onClick}
        className={`
            flex items-center w-full p-3 rounded-full transition-all duration-200
            ${isActive
                ? 'bg-gray-700 text-white font-medium'
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }
            ${isExpanded ? 'justify-start space-x-3' : 'justify-center'}
        `}
        title={label}
    >
        <span className="flex-shrink-0">
            {icon}
        </span>
        <span className={`transition-opacity duration-200 text-sm ${isExpanded ? 'opacity-100' : 'opacity-0 absolute left-full hidden'}`}>
            {label}
        </span>
    </button>
);
// ------------------------------------




// NavItem component


export const Sidebar = ({
    history,
    currentChatId,
    onNewChat,
    onSelectChat,
    isOpen,
    onClose,
    isExpanded,
    toggleExpansion,
}: {
    history: any[];
    currentChatId: string;
    onNewChat: () => void;
    onSelectChat: (id: string) => void;
    isOpen: boolean;
    onClose: () => void;
    isExpanded: boolean;
    toggleExpansion: () => void;
}) => {
    const router = useRouter();
    
    const sortedHistory = useMemo(() => {
        const activeChat = history.find((c: any) => c.id === currentChatId);
        const hasUserMessage = activeChat?.messages.some((m: any) => m.role === 'user');
        
        const filterableHistory = history.filter((chat: any) => 
            chat.id !== currentChatId || hasUserMessage
        );
        
        return [...filterableHistory].sort((a, b) => b.lastUpdated - a.lastUpdated);
    }, [history, currentChatId]);

   // const handleConnections = () => console.log('Connections clicked');
    const handleAnalyst = () => console.log('Analyst clicked');
    const handleReports = () => router.push('/reports');

    const navItems = [
        //{ label: 'Connections', icon: <ConnectIcon size={20} />, handler: handleConnections, key: 'connections' },
        { label: 'Analyst', icon: <AnalystIcon size={20} />, handler: handleAnalyst, key: 'analyst' },
        { label: 'Reports', icon: <ReportIcon size={20} />, handler: handleReports, key: 'reports' },
    ];

    return (
        <>
            {/* Mobile Overlay */}
            {isOpen && (
                <div 
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={onClose}
                />
            )}
            
            {/* Sidebar */}
            <div 
                className={`
                    fixed lg:sticky top-0 h-screen
                    bg-gray-950 text-white flex flex-col
                    transition-all duration-300 ease-in-out
                    border-r border-gray-800/50
                    
                    ${isOpen ? 'translate-x-0' : '-translate-x-full'}
                    ${isExpanded ? 'lg:w-64' : 'lg:w-16'}
                    
                    w-64
                    
                    z-50 lg:z-auto
                    
                    ${isExpanded ? 'p-4' : 'p-2'}
                `}
            >
                
                {/* Header */}


            <div className={`flex items-center mb-6 ${isExpanded ? 'justify-between' : 'justify-center'}`}>
                {isExpanded && (
                    // Added a new flex container to group the icon and text
                    <div className="flex items-center gap-2"> 
                        <Rocket size={24} className="text-indigo-400" /> {/* Added Rocket icon */}
                        <h2 className="text-xl font-bold">Cascaide</h2>
                    </div>
                )}

                {/* Desktop: Toggle expansion */}
                <button 
                    onClick={toggleExpansion} 
                    className="hidden lg:block p-1.5 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
                    title={isExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
                >
                    {isExpanded ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
                </button>
                
                {/* Mobile: Close button */}
                <button 
                    onClick={onClose} 
                    className="lg:hidden p-1.5 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
                    title="Close sidebar"
                >
                    <CloseIcon size={20} />
                </button>
            </div>

                {/* New Chat Button */}
                <button
                    onClick={onNewChat}
                    className={`
                        flex items-center p-3 mb-4
                        bg-blue-600 hover:bg-blue-700 rounded-lg 
                        transition-colors font-medium text-sm
                        ${isExpanded ? 'justify-start space-x-3' : 'justify-center'}
                    `}
                    title="New Chat"
                >
                    <PlusIcon size={20} />
                    {isExpanded && <span>New Chat</span>}
                </button>

                {/* Navigation Items */}
                <div className="flex flex-col space-y-1 mb-6">
                    {navItems.map(item => (
                        <NavItem
                            key={item.key}
                            icon={item.icon}
                            label={item.label}
                            onClick={item.handler}
                            isExpanded={isExpanded}
                            isActive={item.key === 'analyst'} 
                        />
                    ))}
                </div>

                {/* History - Only when expanded */}
                {isExpanded && (
                    <div className="flex flex-col flex-1 min-h-0">
                        <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2 px-1">
                            Recent
                        </h3>

                        <div 
                            className="flex-1 overflow-y-auto space-y-1 custom-scrollbar"
                            style={{
                                scrollbarWidth: 'thin',
                                scrollbarColor: '#4b5563 transparent',
                            } as React.CSSProperties}
                        >
                            <style jsx global>{`
                                .custom-scrollbar::-webkit-scrollbar {
                                    width: 6px;
                                }
                                .custom-scrollbar::-webkit-scrollbar-track {
                                    background: transparent;
                                }
                                .custom-scrollbar::-webkit-scrollbar-thumb {
                                    background: #4b5563;
                                    border-radius: 10px;
                                }
                                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                                    background: #6b7280;
                                }
                            `}</style>

                            {sortedHistory.length === 0 ? (
                                <p className="text-xs text-gray-400 p-2">No history yet.</p>
                            ) : (
                                sortedHistory.map((chat: any) => (
                                    <button
                                        key={chat.id}
                                        onClick={() => onSelectChat(chat.id)}
                                        className={`
                                            w-full p-3 rounded-lg text-sm text-left
                                            transition-colors truncate
                                            ${chat.id === currentChatId
                                                ? 'bg-blue-600 text-white font-semibold'
                                                : 'text-gray-300 hover:bg-gray-800' 
                                            }
                                        `}
                                        title={chat.title}
                                    >
                                        {chat.title}
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {/* Settings Footer */}
                <div className={`${isExpanded ? 'mt-4 pt-4 border-t border-gray-800' : 'mt-4'}`}>
                    <NavItem
                        icon={<SettingsIcon size={20} />}
                        label="Settings & Help"
                        onClick={() => console.log('Settings clicked')}
                        isExpanded={isExpanded}
                        isActive={false}
                    />
                </div>
            </div>
        </>
    );
};

// Helper to map tool name to workflow node name
const getSubAgentNodeName = (toolName: string) => {
    if (toolName.startsWith('delegate_to_')) {
        // Converts 'delegate_to_shopifyAgent' to 'shopifyAgentNode'
        return toolName.replace('delegate_to_', '') + 'Node'; 
    }
    return null;
};



import { memo } from 'react';


export const MessageList = memo(({ 
    displayHistory,
    userId, 
    addActiveNode,
    handleToolResponse,
    onOpenReport
}: {
    displayHistory: any[];
    userId: string | undefined;
    addActiveNode: any;
    handleToolResponse: any;
    onOpenReport?: (htmlContent: string, title: string) => void;
}) => {
    // ✅ FIX #1: Remove redundant local history state - use prop directly
    // This was causing double renders on every update
    
    // Track delegation status for each tool call ID
    const [delegationStatuses, setDelegationStatuses] = useState<Record<string, 'pending' | 'complete'>>({});
    
    // Track multiple active sub-cascades
    const [activeDelegations, setActiveDelegations] = useState<Map<string, {
        subCascadeId: string;
        toolCallId: string;
        agentName: string;
    }>>(new Map());
    
    // Track completed delegations to process
    const [pendingCompletions, setPendingCompletions] = useState<Set<string>>(new Set());
    
    // ✅ FIX #2: Memoize helper function
    const getDelegationStatusForMessage = useCallback((message: any): 'pending' | 'complete' | null => {
        if (message.role !== 'assistant' || !message.tool_calls) return null;
        
        const delegationTool = message.tool_calls.find((tc: any) => 
            tc.function.name.startsWith('delegate_to_')
        );
        
        if (!delegationTool) return null;
        
        return delegationStatuses[delegationTool.id] || null;
    }, [delegationStatuses]);

    // ✅ FIX #3: Optimize delegation detection with proper dependencies
    useEffect(() => {
        if (displayHistory.length === 0) return;

        // Only process the last assistant message
        const lastAssistantIndex = displayHistory.findLastIndex(
            msg => msg.role === 'assistant' && msg.tool_calls
        );
        
        if (lastAssistantIndex === -1) return;

        const currentMessage = displayHistory[lastAssistantIndex];
        const delegationTools = currentMessage.tool_calls.filter((tc: any) => 
            tc.function.name.startsWith('delegate_to_')
        );

        if (delegationTools.length === 0) return;

        // Process each delegation tool
        for (const toolCall of delegationTools) {
            // Skip if already being tracked
            if (activeDelegations.has(toolCall.id)) continue;

            // Check for completion
            const hasToolResult = displayHistory.slice(lastAssistantIndex + 1).some(msg =>
                msg.role === 'tool' && msg.tool_call_id === toolCall.id
            );

            if (hasToolResult) {
                if (delegationStatuses[toolCall.id] !== 'complete') {
                    setDelegationStatuses(prev => ({
                        ...prev,
                        [toolCall.id]: 'complete'
                    }));
                }
                continue;
            }

            // Streaming safety check
            const argsString = toolCall.function.arguments;
            if (!argsString || !argsString.trim().endsWith('}')) {
                if (lastAssistantIndex === displayHistory.length - 1) {
                    console.log(`Delegation ${toolCall.id} arguments still streaming. Waiting...`);
                    continue;
                }
            }

            console.log(`New delegation detected (ID: ${toolCall.id}). Initiating sub-cascade...`);
            
            setDelegationStatuses(prev => ({
                ...prev,
                [toolCall.id]: 'pending'
            }));
            
            try {
                const args = JSON.parse(argsString);
                const subNodeName = getSubAgentNodeName(toolCall.function.name);
                const query = args.analysis_task_for_data_retrieval;
                
                if (!subNodeName || !query) {
                    console.error("Invalid delegation tool call arguments.");
                    continue;
                }

                const newSubCascadeId = `sub_cascade_${uuidv4()}`;
                
                setActiveDelegations(prev => {
                    const newMap = new Map(prev);
                    newMap.set(toolCall.id, {
                        subCascadeId: newSubCascadeId,
                        toolCallId: toolCall.id,
                        agentName: subNodeName
                    });
                    return newMap;
                });

                const subAgentUserMessage = { 
                    role: 'user', 
                    content: query.trim() 
                };
                console.log(`Starting sub-cascade ${newSubCascadeId} for tool call ${toolCall.id}`);
                
                addActiveNode(subNodeName, {
                    cascadeId: newSubCascadeId, 
                    history: [subAgentUserMessage],
                    originalToolCallId: toolCall.id, 
                });

            } catch (error) {
                console.error("Error processing delegation tool call:", error);
                continue;
            }
        }
    }, [displayHistory.length, displayHistory[displayHistory.length - 1]]); // ✅ Minimal dependencies

    // Process completed delegations
    useEffect(() => {
        if (pendingCompletions.size === 0) return;

        const completedToolCallIds = Array.from(pendingCompletions);
        
        for (const toolCallId of completedToolCallIds) {
            const delegation = activeDelegations.get(toolCallId);
            if (!delegation) continue;

            console.log(`Processing completion for tool call ${toolCallId}`);
            
            setDelegationStatuses(prev => ({
                ...prev,
                [toolCallId]: 'complete'
            }));

            setActiveDelegations(prev => {
                const newMap = new Map(prev);
                newMap.delete(toolCallId);
                return newMap;
            });
        }

        setPendingCompletions(new Set());
    }, [pendingCompletions, activeDelegations]);

    // ✅ FIX #4: Memoize computed values
    const showAILoading = useMemo(() => 
        displayHistory.length > 0 && 
        displayHistory[displayHistory.length - 1]?.role === 'user' &&
        activeDelegations.size === 0,
        [displayHistory.length, displayHistory[displayHistory.length - 1]?.role, activeDelegations.size]
    );

    // ✅ FIX #5: Memoize the completion handler
    const handleDelegationComplete = useCallback((toolCallId: string, result: string) => {
        const toolResultMessage = {
            role: 'tool',
            tool_call_id: toolCallId,
            content: result || 'Sub-cascade completed successfully.',
        };

        handleToolResponse(toolResultMessage);
        setPendingCompletions(prev => new Set(prev).add(toolCallId));
    }, [handleToolResponse]);

    // ✅ FIX #6: Convert active delegations to array once
    const activeDelegationsList = useMemo(() => 
        Array.from(activeDelegations.values()),
        [activeDelegations]
    );

    return (
        <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="max-w-4xl mx-auto">
                {displayHistory.map((msg, idx) => {
                    const isLastMessage = idx === displayHistory.length - 1;
                    
                    return (
                        <div key={`${idx}-${msg.role}`}>
                            
                            {/* ✅ RENDER THOUGHTS OUTSIDE THE BUBBLE */}
                            {msg.role === 'assistant' && msg.thoughts && (
                                <ThinkingProcess 
                                    thoughts={msg.thoughts}
                                    // It is "complete" if it's NOT the last message, 
                                    // OR if the message has tool calls/content (meaning thoughts are likely done)
                                    isComplete={!isLastMessage || !!msg.content || (msg.tool_calls && msg.tool_calls.length > 0)}
                                />
                            )}

                            {/* Standard Message Bubble (Content Only) */}
                            <MessageBubble 
                                message={{ ...msg, _index: idx }} 
                                userId={userId} 
                                onOpenReport={onOpenReport}
                                delegationStatus={getDelegationStatusForMessage(msg)}
                            /> 
                        </div>
                    );
                })}
                
                {/* Standard Loading Indicator (Waiting for server) */}
                {showAILoading && (
                    <div className="flex items-start gap-4 py-4 max-w-4xl mx-auto">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                            <Bot className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="rounded-xl px-4 py-3 shadow-sm bg-transparent text-gray-900 border border-blue-100">
                                <div className="flex items-center gap-2">
                                    <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                                    <span className="text-base text-gray-600">Connecting to agent...</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                
                {/* Sub-Cascade Loading Indicators */}
                {activeDelegationsList.map(delegation => (
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

// ✅ FIX #7: Memoize CascadeMonitor
const CascadeMonitor = memo(({ 
    subCascadeId, 
    toolCallId, 
    agentName,
    onComplete 
}: {
    subCascadeId: string;
    toolCallId: string;
    agentName: string;
    onComplete: (toolCallId: string, result: string) => void;
}) => {
    const { cascadeState, isComplete } = useCascade(subCascadeId);
    const [hasCompleted, setHasCompleted] = useState(false);

    useEffect(() => {
        if (isComplete && cascadeState && !hasCompleted) {
            console.log(`Sub-cascade ${subCascadeId} completed for tool call ${toolCallId}`);
            
            const history = cascadeState.history;

            if (history && history.length > 0) {
                const lastMeaningfulMessage = [...history].reverse().find(msg => 
                    msg.content && 
                    msg.content.trim().length > 0 && 
                    // Optional: Ignore system messages if you have them, usually we want tool or assistant
                    (msg.role === 'assistant' || msg.role === 'tool') 
                );

                const result = lastMeaningfulMessage 
                    ? lastMeaningfulMessage.content 
                    : 'Sub-cascade completed, but no data was returned.';

                console.log("✅ Sub-cascade passing result to parent:", result);
                
                onComplete(toolCallId, result);
                setHasCompleted(true);
            } else {
                console.warn("Sub-cascade completed, but history is empty or missing.");
            }
        }
    }, [isComplete, cascadeState, hasCompleted, subCascadeId, toolCallId, onComplete]);

    return (
        <div className="flex items-start gap-4 py-4 max-w-4xl mx-auto">
            <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-600 text-white">
                <Database className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold mb-2 text-gray-500">
                    {agentName || 'Data Agent'}
                </div>
                <div className="rounded-xl px-4 py-3 shadow-sm bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200">
                    <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 text-purple-600 animate-spin" />
                        <span className="text-base text-gray-700">Processing data request...</span>
                    </div>
                </div>
            </div>
        </div>
    );
});

CascadeMonitor.displayName = 'CascadeMonitor';








export const ThinkingProcess = ({ 
  thoughts, 
  isComplete 
}: { 
  thoughts: string; 
  isComplete?: boolean 
}) => {
  const [isOpen, setIsOpen] = useState(false); // Default to open while thinking
  const displayedThoughts = thoughts; // 5ms per char for snappy but smooth feel

  return (
    <div className="mb-4 max-w-4xl mx-auto pl-0 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="border border-blue-100 bg-blue-50/30 rounded-xl overflow-hidden shadow-sm">
        
        {/* Header / Toggle */}
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50/50 transition-colors text-left"
        >
          <div className={`flex items-center justify-center w-6 h-6 rounded-full ${isComplete ? 'bg-blue-100 text-blue-600' : 'bg-blue-600 text-white'}`}>
             {isComplete ? (
                <BrainCircuit className="w-3.5 h-3.5" />
             ) : (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
             )}
          </div>
          
          <div className="flex-1">
             <span className="text-sm font-semibold text-gray-700 block">
                {isComplete ? 'Thought Process' : 'Reasoning...'}
             </span>
          </div>

          <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} />
        </button>

        {/* Content Area (Accordion) */}
        {isOpen && (
          <div className="px-4 pb-4 pt-0">
            <div className="pl-[34px] text-xs font-mono text-gray-600 leading-relaxed whitespace-pre-wrap border-l-2 border-blue-100 ml-3">
              {displayedThoughts}
              {!isComplete && <span className="inline-block w-1.5 h-3 bg-blue-400 ml-1 animate-pulse"/>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};




interface MessageBubbleProps {
  message: any;
  userId: string | undefined;
  onOpenReport?: (htmlContent: string, title: string) => void;
  delegationStatus?: 'pending' | 'complete' | null;
}

// Helper function to get data source name from delegation tool
const getDataSourceName = (toolName: string): string => {
  if (toolName.includes('distributor')) return 'distributor';
  if (toolName.includes('google')) return 'Google Ads';
  if (toolName.includes('shopify')) return 'Shopify';
  return 'External Data';
};

// ✅ FIX #1: Memoize ToolCallRenderer
const ToolCallRenderer = memo(({ 
  toolCall, 
  idx, 
  userId,
  onOpenReport,
  delegationStatus,
  isOpen,
  onToggle
}: {
  toolCall: any;
  idx: number;
  userId: string | undefined;
  onOpenReport?: (htmlContent: string, title: string) => void;
  delegationStatus?: 'pending' | 'complete' | null;
  isOpen: boolean;
  onToggle: () => void;
}) => {
  // ✅ Memoize parsed arguments
  const args = useMemo(() => {
    try {
      return JSON.parse(toolCall.function.arguments);
    } catch {
      return { raw_arguments: toolCall.function.arguments };
    }
  }, [toolCall.function.arguments]);

  const isDisplayChartTool = toolCall.function.name === 'display_chart';
  const isCreateReportTool = toolCall.function.name === 'create_report';
  const isDelegationTool = toolCall.function.name.startsWith('delegate_to_');

  // ✅ Memoize chart props
  const chartProps = useMemo(() => {
    if (isDisplayChartTool && args.data && args.type) {
      return transformChartData(args.data, args.type);
    }
    return null;
  }, [isDisplayChartTool, args.data, args.type]);

  const isValidChartData = isDisplayChartTool && 
                            Array.isArray(args.categories) && 
                            Array.isArray(args.series) && 
                            args.categories.length > 0;

  // Delegation tool rendering
  if (isDelegationTool) {
    const dataSource = getDataSourceName(toolCall.function.name);
    const isPending = delegationStatus === 'pending';
    const isComplete = delegationStatus === 'complete';

    return (
      <div className="flex items-center gap-2 text-sm text-gray-600 mb-3 py-2">
        {isPending ? (
          <>
            <Loader2 className="w-4 h-4 text-blue-600 animate-spin flex-shrink-0" />
            <span>Retrieving {dataSource} data...</span>
          </>
        ) : isComplete ? (
          <>
            <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
            <span className="text-green-700">Retrieved {dataSource} data</span>
          </>
        ) : (
          <>
            <Database className="w-4 h-4 text-gray-500 flex-shrink-0" />
            <span>{dataSource} data request</span>
          </>
        )}
      </div>
    );
  }

// ✅ SKIP: We don't render anything for the *request* of the report.
  // We wait for the tool *response* (handled in MessageBubble above).
  if (isCreateReportTool) {
    return (
      // We give this a unique ID based on the tool_call_id
      <div 
        id={`loading-${toolCall.id}`} 
        className="my-3 border border-blue-100 bg-blue-50/50 rounded-lg p-3 flex items-center gap-3"
      >
        <Loader2 className="w-4 h-4 text-blue-600 animate-spin flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-900">Generating Analysis Report</div>
          <div className="text-xs text-gray-500">Processing request...</div>
        </div>
      </div>
    );
  }

// ✅ UPDATED CHART RENDERING
  if (isDisplayChartTool) {
    return (
      <div key={idx} className="my-4">
        {isValidChartData ? (
          <ChartRenderer 
            chartProps={{ 
              // We no longer need uuidv4() or userId here unless you added them to the interface
              // strictly passing what the new AgentChartProps expects:
              type: args.type, 
              title: args.title || "Generated Chart", 
              categories: args.categories,
              series: args.series
            }} 
          />
        ) : (
          <div className="flex flex-col items-center justify-center p-8 bg-gray-50 border border-gray-100 rounded-md">
            <div className="w-10 h-10 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
            <span className="mt-4 text-lg font-medium text-gray-500">Loading Chart...</span>
          </div>
        )}
      </div>
    );
  }

  // Other tools - collapsible
  return (
    <div className="my-3 border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 p-2.5 text-left hover:bg-gray-100 transition-colors"
      >
        <Wrench className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
        <span className="text-xs font-medium text-gray-600 flex-1">
          {toolCall.function.name}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="px-2.5 pb-2.5 pt-0 border-t border-gray-200 bg-white">
          <div className="text-xs text-gray-700 font-mono bg-gray-50 p-2 rounded mt-2 overflow-x-auto">
            <pre className="whitespace-pre-wrap break-all">{JSON.stringify(args, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
});

ToolCallRenderer.displayName = 'ToolCallRenderer';


const ReportWidget = ({ toolCallId, title, html, onOpen }: any) => {
  
  // ✅ THE MAGIC ERASER
  // This effect runs once when the Widget mounts.
  // It finds the specific loading spinner for THIS tool call and hides it.
  React.useEffect(() => {
    if (toolCallId) {
      const loaderElement = document.getElementById(`loading-${toolCallId}`);
      if (loaderElement) {
        loaderElement.style.display = 'none';
      }
    }
  }, [toolCallId]);

  return (
    <div className="py-2 max-w-4xl mx-auto pl-0 animate-in fade-in slide-in-from-bottom-2 duration-500">
        <div className="my-2 border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-all">
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-3 border-b border-gray-200 flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-600" />
                <div className="font-medium text-gray-900 text-sm">
                    {title || 'Analysis Report Ready'}
                </div>
            </div>
            <div className="p-4">
                <button 
                    onClick={() => onOpen?.(html, title)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
                >
                    <span>View Full Report</span>
                    <ExternalLink className="w-4 h-4" />
                </button>
            </div>
        </div>
    </div>
  );
};

// ✅ FIX #2: Memoize entire MessageBubble
export const MessageBubble = memo(({ 
  message, 
  userId, 
  onOpenReport, 
  delegationStatus 
}: MessageBubbleProps) => {
  const isAssistant = message.role === 'assistant';
  const [isThoughtOpen, setIsThoughtOpen] = useState(false); // State for accordion
  
  // ✅ FIX #3: Initialize open state based on display_chart tools
  const [openToolCalls, setOpenToolCalls] = useState<Record<number, boolean>>(() => {
    if (!isAssistant || !message.tool_calls) return {};
    
    return message.tool_calls.reduce((acc: Record<number, boolean>, toolCall: any, index: number) => {
      if (toolCall.function.name === 'display_chart') {
        acc[index] = true;
      }
      return acc;
    }, {});
  });
  

if (message.role === 'tool') {
    
    // ✅ OPTIMIZATION: "Peep" before you parse.
    // If the raw string doesn't even contain the key "report_html", 
    // it's definitely not our report. Skip the expensive JSON.parse completely.
    if (!message.content || !message.content.includes('report_html')) {
        return null;
    }

    let content;
    try {
      content = JSON.parse(message.content);
    } catch {
      return null;
    }

    // Double check the parsed object just to be safe
    if (content.report_html) {
      return (
        <ReportWidget 
            toolCallId={message.tool_call_id} 
            title={content.report_title}
            html={content.report_html}
            onOpen={onOpenReport}
        />
      );
    }
    return null;
  }
  if (message.role !== 'user' && message.role !== 'assistant') {
    return null;
  }
  
  const isUser = message.role === 'user';

  const toggleToolCallVisibility = (index: number) => {
    setOpenToolCalls(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const isThinking = isAssistant && message.thoughts && !message.content && !message.tool_calls?.length;
  const displayedContent = message.content;

  return (
    <div className={`py-4 max-w-4xl mx-auto ${isUser ? '' : 'pl-0'}`}> 
      
      {isUser ? (
        // User message
        <div className="flex items-start gap-3 justify-end">
          <div className="bg-gray-100 rounded-2xl px-4 py-3 max-w-full sm:max-w-2xl overflow-hidden"> 
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-800 text-white flex items-center justify-center text-xs font-medium mt-0.5">
                U
              </div>
              <div className="text-[15px] leading-relaxed text-gray-900 pt-0.5 break-all"> 
                <MarkdownContent content={message.content} />
              </div>
            </div>
          </div>
        </div>
      ) : (
        // Assistant message
        <div className="flex-1 min-w-0">
          {message.content && (
            <div className="text-[15px] leading-relaxed text-gray-900 mb-4 group">
              <MarkdownContent content={displayedContent} />
             
            </div>
          )}
          <div className="animate-in fade-in slide-in-from-top-2 duration-500">
          {/* Tool Call Cards */}
          {message.tool_calls?.map((toolCall: any, idx: number) => (
            
            <ToolCallRenderer
              key={`${toolCall.id || idx}`}
              toolCall={toolCall}
              idx={idx}
              userId={userId}
              onOpenReport={onOpenReport}
              delegationStatus={delegationStatus}
              isOpen={openToolCalls[idx] || false}
              onToggle={() => toggleToolCallVisibility(idx)}
            />
            
          ))}
          </div>
        </div>
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // ✅ FIX #4: Custom comparison function for better memoization
  // Only re-render if these specific properties change
  if (prevProps.userId !== nextProps.userId) return false;
  if (prevProps.delegationStatus !== nextProps.delegationStatus) return false;
  
  // Deep comparison for message
  const prevMsg = prevProps.message;
  const nextMsg = nextProps.message;
  
  if (prevMsg.role !== nextMsg.role) return false;
  if (prevMsg.content !== nextMsg.content) return false;
  
  // Compare tool_calls
  const prevToolCalls = prevMsg.tool_calls || [];
  const nextToolCalls = nextMsg.tool_calls || [];
  
  if (prevToolCalls.length !== nextToolCalls.length) return false;
  
  // For streaming, only check the last tool call in detail
  if (prevToolCalls.length > 0) {
    const lastPrevTool = prevToolCalls[prevToolCalls.length - 1];
    const lastNextTool = nextToolCalls[nextToolCalls.length - 1];
    
    if (lastPrevTool?.function?.arguments !== lastNextTool?.function?.arguments) return false;
  }
  
  return true; // Props are equal, don't re-render
});

MessageBubble.displayName = 'MessageBubble';


// --- TYPES FOR THE NEW SIMPLIFIED SCHEMA ---
export interface AgentChartProps {
  type: 'bar' | 'line' | 'pie' | 'area';
  title: string;
  categories: string[]; // X-Axis Labels
  series: {
    label: string;      // Series Name
    data: number[];     // The numbers
  }[];
}

// --- 1. UTILITY: COLUMN-TO-ROW TRANSFORMATION ---
const transformAgentDataToRecharts = (categories: string[], series: AgentChartProps['series']) => {
  if (!categories || !series || categories.length === 0) return { data: [], keys: [] };

  // 1. Extract keys for Recharts lines/bars
  const keys = series.map(s => s.label);

  // 2. Build Row-Oriented Data
  const data = categories.map((category, index) => {
    const row: any = { name: category }; // 'name' will be our hardcoded xAxisKey
    series.forEach(s => {
      // Safety check: ensure data exists for this index
      row[s.label] = s.data[index] ?? 0;
    });
    return row;
  });

  return { data, keys };
};

const CHART_COLORS = ["#4e79a7", "#f28e2b", "#e15759", "#76b7b2", "#59a14f", "#edc949", "#af7aa1", "#ff9da7", "#9c755f", "#bab0ab"];

// --- 2. Custom Label for Pie Charts ---
const CustomizedPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  
  if (percent < 0.05) return null;

  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight="bold">
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

// --- 3. MAIN COMPONENT ---
export const ChartRenderer = ({ chartProps }: { chartProps: AgentChartProps }) => {
  const [pinState, setPinState] = useState<'idle' | 'loading' | 'saved'>('idle');

  const { type, title, categories, series } = chartProps;

  // --- MEMO: Transform Data ---
  // Fix 1: Destructure 'data' as 'processedData' and 'keys' as 'dataKeys' to match return of transform function
  const { processedData, dataKeys } = useMemo(() => {
    const result = transformAgentDataToRecharts(categories, series);
    return { processedData: result.data, dataKeys: result.keys };
  }, [categories, series]);

  const isDataValid = processedData.length > 0 && dataKeys.length > 0;



  if (!isDataValid) {
    return (
      <Card className="w-full shadow-sm border-dashed border-2 border-gray-200 min-h-[300px] flex items-center justify-center">
        <div className="flex flex-col items-center text-gray-400">
          <LayoutDashboard className="w-8 h-8 mb-2 opacity-50" />
          <p>No valid data to display</p>
        </div>
      </Card>
    );
  }

  const renderChart = () => {
    const commonProps = {
      data: processedData,
      margin: { top: 10, right: 30, left: 20, bottom: 10 }
    };

    // PIE CHART SPECIFIC LOGIC
    if (type.toLowerCase() === 'pie') {
       const valueKey = dataKeys[0]; 
       return (
        <ResponsiveContainer width="100%" height={400}>
          <PieChart>
            <Pie
              data={processedData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={<CustomizedPieLabel />}
              outerRadius={130}
              fill="#8884d8"
              dataKey={valueKey}
              nameKey="name"
            >
              {/* Fix 2: Added types for map parameters */}
              {processedData.map((entry: any, index: number) => (
                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend verticalAlign="bottom" height={36}/>
          </PieChart>
        </ResponsiveContainer>
       );
    }

    // CARTESIAN CHARTS (Bar, Line, Area)
    const ChartComponent = 
      type.toLowerCase() === 'line' ? LineChart : 
      type.toLowerCase() === 'bar' ? BarChart : AreaChart;
      
    // Note: While 'any' is used here to silence the dynamic component type error, 
    // it is safe because we verify the type string before rendering.
    const SeriesComponent = (
      type.toLowerCase() === 'line' ? Line : 
      type.toLowerCase() === 'bar' ? Bar : Area
    ) as any; 

    return (
      <ResponsiveContainer width="100%" height={400}>
        <ChartComponent {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
          
          <XAxis 
            dataKey="name" 
            angle={processedData.length > 8 ? -45 : 0} 
            textAnchor={processedData.length > 8 ? "end" : "middle"} 
            height={processedData.length > 8 ? 80 : 30} 
            minTickGap={20}
            tick={{ fontSize: 12, fill: "#6b7280" }}
            interval="preserveStartEnd"
          />
          
          <YAxis 
            tick={{ fontSize: 12, fill: "#6b7280" }}
            tickFormatter={(value) => 
               value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value
            }
          />
          
          <Tooltip 
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            cursor={{ fill: '#f3f4f6' }}
            formatter={(value: number) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value)}
          />
          
          <Legend verticalAlign="top" height={36} iconType="circle" />

          {/* Fix 2: Added types for map parameters */}
          {dataKeys.map((key: string, index: number) => {
            
            // Fix 3: Handle Props Logic Conditionally
            // We separate props to ensure strict types don't clash (e.g. radius on Line)
            const baseProps = {
                
                type: "monotone",
                dataKey: key,
                name: key,
                fill: CHART_COLORS[index % CHART_COLORS.length],
                stroke: CHART_COLORS[index % CHART_COLORS.length],
                fillOpacity: type.toLowerCase() === 'area' ? 0.2 : 1,
                strokeWidth: 2,
            };

            const extraProps = type.toLowerCase() === 'bar' 
                ? { radius: [4, 4, 0, 0] as [number, number, number, number] }
                : type.toLowerCase() === 'line' 
                    ? { activeDot: { r: 6 }, dot: { r: 2 } }
                    : {};

            return (
                <SeriesComponent
                  key={key} 
                  {...baseProps}
                  {...extraProps}
                />
            );
          })}
        </ChartComponent>
      </ResponsiveContainer>
    );
  }

  return (
    <Card className="w-full shadow-lg border border-gray-100 bg-white overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 border-b border-gray-50">
        <CardTitle className="text-base font-semibold text-gray-800">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
          {renderChart()}
      </CardContent>
    </Card>
  );
}



interface ReportArtifactProps {
  htmlContent: string;
  title: string;
  defaultEmail?: string; // New prop for pre-filling
  onDownload: () => void;
  onSendEmail: (email: string) => Promise<void>; // Updated signature
  onClose: () => void;
  isDownloading: boolean;
}

export const ReportArtifact: React.FC<ReportArtifactProps> = ({ 
  htmlContent, 
  title, 
  defaultEmail = '',
  onDownload, 
  onSendEmail, 
  onClose,
  isDownloading 
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(600);
  
  // --- Modal Logic Moved Here ---
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailTo, setEmailTo] = useState(defaultEmail);
  const [isSending, setIsSending] = useState(false);

  // Update email if default changes (e.g. user loads late)
  useEffect(() => {
    if (defaultEmail) setEmailTo(defaultEmail);
  }, [defaultEmail]);

  const handleSendClick = async () => {
    if (!emailTo) return;
    try {
      setIsSending(true);
      await onSendEmail(emailTo); // Call parent action
      setIsEmailModalOpen(false); // Close on success
      toast.success('Report sent successfully');
    } catch (error) {
      console.error(error);
      toast.error('Failed to send email');
    } finally {
      setIsSending(false);
    }
  };

  // --- Iframe Logic ---
  const srcDoc = React.useMemo(() => {
    if (!htmlContent) return '';
    let fullHtml = htmlContent;
    if (!fullHtml.includes('chart.js')) {
      fullHtml = `<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>\n${fullHtml}`;
    }
    const resizerScript = `
      <script>
        window.addEventListener('load', function() {
           if(window.Chart) window.Chart.defaults.animation = false;
           const sendHeight = () => {
             const height = document.body.scrollHeight;
             window.parent.postMessage({ type: 'REPORT_HEIGHT', height: height + 50 }, '*');
           };
           sendHeight();
           window.addEventListener('resize', sendHeight);
           new ResizeObserver(sendHeight).observe(document.body);
        });
      </script>
      <style>
        body { font-family: -apple-system, system-ui, sans-serif; overflow-y: hidden; margin: 0; padding: 1rem; }
        canvas { max-width: 100% !important; height: auto !important; }
      </style>
    `;
    return fullHtml + resizerScript;
  }, [htmlContent]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data && event.data.type === 'REPORT_HEIGHT') {
        setHeight(event.data.height);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  if (!htmlContent) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500 bg-white rounded-lg border border-gray-200 m-4">
        <FileText className="w-12 h-12 mb-3 text-gray-300" />
        <p>No report content available</p>
        <button onClick={onClose} className="mt-4 text-blue-600 hover:underline">Close Viewer</button>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-white border-l border-gray-200 relative">
      
      {/* Header */}
      <div className="flex-none flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
        <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
          <Bot className="w-5 h-5 text-blue-600" />
          {title || 'Report'}
        </h2>
        
        <div className="flex items-center gap-2">
          <button
            onClick={onDownload}
            disabled={isDownloading}
            className="p-2 rounded-lg hover:bg-white/60 text-gray-600 hover:text-blue-600 transition-colors"
            title="Download PDF"
          >
            {isDownloading ? <Loader2 className="w-5 h-5 animate-spin"/> : <Download className="w-5 h-5" />}
          </button>

          <button
            onClick={() => setIsEmailModalOpen(true)}
            className="p-2 rounded-lg hover:bg-white/60 text-gray-600 hover:text-blue-600 transition-colors"
            title="Email Report"
          >
            <Mail className="w-5 h-5" />
          </button>

          <div className="w-px h-6 bg-gray-300 mx-1"></div>

          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/60 text-gray-600 hover:text-red-600">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-white p-6">
        <div className="max-w-full bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
          <iframe ref={iframeRef} srcDoc={srcDoc} title="Report Viewer" width="100%" height={height} className="w-full border-none block" sandbox="allow-scripts allow-same-origin" />
        </div>
      </div>

      {/* --- EMAIL MODAL OVERLAY (Inside Component) --- */}
      {isEmailModalOpen && (
        <div className="absolute inset-0 z-[60] bg-black/20 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in fade-in zoom-in-95 duration-200 border border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800">Email Report</h3>
              <button onClick={() => setIsEmailModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To:</label>
                <input 
                  type="email" 
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="client@example.com"
                  autoFocus
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button 
                  onClick={() => setIsEmailModalOpen(false)}
                  className="flex-1 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSendClick}
                  disabled={isSending || !emailTo}
                  className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 text-sm font-medium flex justify-center items-center gap-2"
                >
                  {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};