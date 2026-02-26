import { memo, useState, useMemo, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Wrench, ChevronDown, Loader2, Database } from 'lucide-react';

import { toolRegistry } from './message-list';


// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MessageBubbleProps {
    message: any;
    userId: string | undefined;
    delegationStatus?: 'pending' | 'complete' | null;
    // Called by input tools when the user acts — continues the cascade
    onToolComplete: (toolCallId: string, result: string) => Promise<void>;
    // Map of toolCallId → saved tool result message (populated if cascade was replayed)
    toolResults: Record<string, any>;
}


// ---------------------------------------------------------------------------
// MessageBubble
//
// Renders a single message. For assistant messages, also renders any tool
// calls using the toolRegistry. Users should not need to modify this file.
// ---------------------------------------------------------------------------

export const MessageBubble = memo(({
    message,
    userId,
    delegationStatus,
    onToolComplete,
    toolResults,
}: MessageBubbleProps) => {
    const isUser = message.role === 'user';

    // Track which fallback collapsible tool calls are open
    const [openToolCalls, setOpenToolCalls] = useState<Record<number, boolean>>({});

    const toggleOpen = useCallback((index: number) => {
        setOpenToolCalls(prev => ({ ...prev, [index]: !prev[index] }));
    }, []);

    return (
        <div className={`py-4 max-w-4xl mx-auto`}>
            {isUser ? (
                <div className="flex justify-end">
                    <div className="bg-gray-100 rounded-2xl px-4 py-3 max-w-full sm:max-w-2xl">
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
                <div className="flex-1 min-w-0">
                    {message.content && (
                        <div className="text-[15px] leading-relaxed text-gray-900 mb-4">
                            <MarkdownContent content={message.content} />
                        </div>
                    )}

                    {message.tool_calls?.map((toolCall: any, idx: number) => {
                        const savedResult = toolResults[toolCall.id] ?? null;
                        const isFinished = !!savedResult;

                        return (
                            <ToolCallRenderer
                                key={toolCall.id ?? idx}
                                toolCall={toolCall}
                                delegationStatus={delegationStatus}
                                // Bind toolCallId into onComplete so tool components
                                // don't need to know about it — they just call onComplete(result)
                                onComplete={(result: string) => onToolComplete(toolCall.id, result)}
                                isFinished={isFinished}
                                savedResult={savedResult?.content ?? null}
                                isOpen={openToolCalls[idx] || false}
                                onToggle={() => toggleOpen(idx)}
                            />
                        );
                    })}
                </div>
            )}
        </div>
    );
}, (prev, next) => {
    if (prev.userId !== next.userId) return false;
    if (prev.delegationStatus !== next.delegationStatus) return false;
    if (prev.message.content !== next.message.content) return false;
    if (prev.message.tool_calls?.length !== next.message.tool_calls?.length) return false;
    // Check argument changes mid-stream
    return prev.message.tool_calls?.every((tc: any, i: number) =>
        tc.function.arguments === next.message.tool_calls[i]?.function.arguments
    ) ?? true;
});

MessageBubble.displayName = 'MessageBubble';


// ---------------------------------------------------------------------------
// ToolCallRenderer
//
// Handles three cases:
//   1. Delegation tool    — shows a status indicator (pending/complete)
//   2. Registered tool    — looks up toolRegistry and renders the component
//   3. Unregistered tool  — collapsible fallback showing raw arguments
//
// To add a new tool UI, add it to toolRegistry in message-list.tsx.
// You should not need to modify this component.
// ---------------------------------------------------------------------------

const ToolCallRenderer = memo(({
    toolCall,
    delegationStatus,
    onComplete,
    isFinished,
    savedResult,
    isOpen,
    onToggle,
}: {
    toolCall: any;
    delegationStatus?: 'pending' | 'complete' | null;
    onComplete: (result: string) => void;
    isFinished: boolean;
    savedResult: string | null;
    isOpen: boolean;
    onToggle: () => void;
}) => {
    const args = useMemo(() => {
        try {
            return JSON.parse(toolCall.function.arguments);
        } catch {
            // Arguments may still be streaming — return null until complete
            return null;
        }
    }, [toolCall.function.arguments]);

    const toolName = toolCall.function.name;


    // ---
    // Case 1: Delegation tool
    // Rendered as a status indicator, not a full UI.
    // The actual sub-cascade is managed by CascadeMonitor in MessageList.
    // ---
    if (toolName.startsWith('delegate_to_')) {
        if (delegationStatus === 'complete') return null;

        return (
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-3 py-2">
                {delegationStatus === 'pending' ? (
                    <>
                        <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                        <span>Retrieving...</span>
                    </>
                ) : (
                    <>
                        <Database className="w-4 h-4 text-gray-500" />
                        <span>Data request</span>
                    </>
                )}
            </div>
        );
    }


    // ---
    // Case 2: Registered tool
    // Look up the tool component from the registry and render it.
    // MessageList has already computed onComplete, isFinished, and savedResult —
    // the tool component just uses them without knowing where they came from.
    // ---
    const RegisteredTool = toolRegistry[toolName];
    if (RegisteredTool) {
        // Don't render until arguments have finished streaming
        if (!args) {
            return (
                <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Loading...</span>
                </div>
            );
        }

        return (
            <div className="my-4">
                <RegisteredTool
                    args={args}
                    onComplete={onComplete}
                    isFinished={isFinished}
                    savedResult={savedResult}
                />
            </div>
        );
    }


    // ---
    // Case 3: Unregistered tool — collapsible fallback
    // Shows the raw tool name and arguments so you can see what the LLM called.
    // Add the tool to toolRegistry in message-list.tsx to give it a proper UI.
    // ---
    return (
        <div className="my-3 border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
            <button
                onClick={onToggle}
                className="w-full flex items-center gap-2 p-2.5 text-left hover:bg-gray-100 transition-colors"
            >
                <Wrench className="w-3.5 h-3.5 text-gray-500" />
                <span className="text-xs font-medium text-gray-600 flex-1">{toolName}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className="px-2.5 pb-2.5 pt-0 border-t border-gray-200 bg-white">
                    <pre className="text-[10px] text-gray-700 font-mono bg-gray-50 p-2 rounded mt-2 overflow-x-auto whitespace-pre-wrap">
                        {args ? JSON.stringify(args, null, 2) : toolCall.function.arguments}
                    </pre>
                </div>
            )}
        </div>
    );
});

ToolCallRenderer.displayName = 'ToolCallRenderer';


// ---------------------------------------------------------------------------
// MarkdownContent
// ---------------------------------------------------------------------------

export const MarkdownContent = memo(({ content }: { content: string }) => (
    <div className="markdown-content text-gray-900">
        <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeHighlight, rehypeKatex]}
            components={{
                h1: ({ children }) => <h1 className="text-2xl font-bold mt-5 mb-3 border-b border-gray-300 pb-2">{children}</h1>,
                h2: ({ children }) => <h2 className="text-xl font-semibold mt-4 mb-2">{children}</h2>,
                h3: ({ children }) => <h3 className="text-lg font-semibold mt-3 mb-2">{children}</h3>,
                p: ({ children }) => <p className="mb-3 leading-relaxed">{children}</p>,
                ul: ({ children }) => <ul className="list-disc list-inside space-y-1.5 ml-4 my-3">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal list-inside space-y-1.5 ml-4 my-3">{children}</ol>,
                li: ({ children }) => <li className="pl-1">{children}</li>,
                a: ({ children, href }) => (
                    <a href={href} className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
                        {children}
                    </a>
                ),
                img: ({ src, alt }) => (
                    <span className="block my-4">
                        <img
                            src={src}
                            alt={alt || 'image'}
                            className="max-w-full h-auto rounded-lg border border-gray-200 shadow-sm"
                            loading="lazy"
                        />
                        {alt && <span className="text-xs text-gray-500 mt-1 block text-center">{alt}</span>}
                    </span>
                ),
                code: ({ className, children }: any) => {
                    if (!className) {
                        return <code className="bg-gray-200 text-gray-800 px-1.5 py-0.5 rounded text-sm font-mono">{children}</code>;
                    }
                    return children;
                },
                table: ({ children }) => (
                    <div className="overflow-x-auto my-4 border border-gray-300 rounded-lg shadow-sm">
                        <table className="min-w-full divide-y divide-gray-300">{children}</table>
                    </div>
                ),
                th: ({ children }) => <th className="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">{children}</th>,
                td: ({ children }) => <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 border-t border-gray-200">{children}</td>,
            }}
        >
            {content}
        </ReactMarkdown>
    </div>
));

MarkdownContent.displayName = 'MarkdownContent';