'use client';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Menu, GitFork, X, Loader2 } from 'lucide-react';
import { useWorkflow, useCascade } from '@cascaide-ts/react';
import { v4 as uuidv4 } from 'uuid';
import { Sidebar } from './sidebar';
import { InputBar } from './input.tsx';
import { MessageList } from './message-list';



// --- Types ---

interface ChatProps {
  nodeId: string;
}

type ToolCall = {
  function: {
    name: string;
    arguments: string;
  };
};

type Message = {
  role: 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
};


// --- Fork FAB Component ---

interface ForkPanelProps {
  onFork: (upToFunctionId: number, apiEndpoint: string) => Promise<void>;
  isForking: boolean;
  disabled: boolean;
}

function ForkPanel({ onFork, isForking, disabled }: ForkPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [functionId, setFunctionId] = useState('');
  const [apiEndpoint, setApiEndpoint] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    const parsed = parseInt(functionId, 10);
    if (isNaN(parsed)) {
      setError('Function ID must be a number.');
      return;
    }
    if (!apiEndpoint.trim()) {
      setError('API endpoint is required.');
      return;
    }
    try {
      await onFork(parsed, apiEndpoint.trim());
      setIsOpen(false);
      setFunctionId('');
      setApiEndpoint('');
    } catch (e: any) {
      setError(e?.message ?? 'Fork failed.');
    }
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      <div className="fixed bottom-24 right-6 z-50 flex flex-col items-end gap-3">
        {/* Panel */}
        {isOpen && (
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-5 w-80 flex flex-col gap-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GitFork className="w-4 h-4 text-purple-600" />
                <span className="font-semibold text-gray-800 text-sm">Fork Cascade</span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Up To Function ID
              </label>
              <input
                type="number"
                value={functionId}
                onChange={e => setFunctionId(e.target.value)}
                placeholder="e.g. 42"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                API Endpoint
              </label>
              <input
                type="text"
                value={apiEndpoint}
                onChange={e => setApiEndpoint(e.target.value)}
                placeholder="https://api.example.com/cascade"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent"
              />
            </div>

            {error && (
              <p className="text-xs text-red-500">{error}</p>
            )}

            <div className="text-xs text-gray-400">
              New cascade ID will be auto-generated.
            </div>

            <button
              onClick={handleSubmit}
              disabled={isForking}
              className="w-full py-2 px-4 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {isForking ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Forking…
                </>
              ) : (
                <>
                  <GitFork className="w-4 h-4" />
                  Fork & Switch
                </>
              )}
            </button>
          </div>
        )}

        {/* FAB */}
        <button
          onClick={() => !disabled && setIsOpen(prev => !prev)}
          disabled={disabled}
          title={disabled ? 'Start a conversation to fork' : 'Fork this cascade'}
          className="w-12 h-12 rounded-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center"
        >
          <GitFork className="w-5 h-5" />
        </button>
      </div>
    </>
  );
}


// --- Main Component ---

export default function Chat({ nodeId }: ChatProps) {
  console.log('Chat rendering on:', typeof window === 'undefined' ? 'SERVER' : 'CLIENT');
  const [input, setInput] = useState('');
  const userId = 'guest-id';
  const userName = 'there';
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const { addActiveNode } = useWorkflow(nodeId);

  // Single ID serves as both chatId and cascadeId
  const [chatId, setChatId] = useState<string>(uuidv4());

  const { cascadeState, isComplete, forkCascade } = useCascade(chatId);
  const [conversationMessages, setConversationMessages] = useState<Message[]>([]);
  const [isForking, setIsForking] = useState(false);

  const isProcessing = useMemo(() =>
    !isComplete && !!cascadeState,
    [isComplete, cascadeState]
  );

  const currentChatHasUserMessages = useMemo(() =>
    conversationMessages.some(m => m.role === 'user'),
    [conversationMessages]
  );

  useEffect(() => {
    if (!cascadeState?.history) return;

    const cascadeHistory = cascadeState.history;

    if (cascadeHistory.length !== conversationMessages.length) {
      setConversationMessages(cascadeHistory);
      return;
    }

    const lastCascadeMsg = cascadeHistory[cascadeHistory.length - 1];
    const lastConvMsg = conversationMessages[conversationMessages.length - 1];

    if (!lastCascadeMsg || !lastConvMsg) return;

    const contentChanged = lastCascadeMsg.content !== lastConvMsg.content;
    const toolCallsChanged = JSON.stringify(lastCascadeMsg.tool_calls) !== JSON.stringify(lastConvMsg.tool_calls);

    if (contentChanged || toolCallsChanged) {
      setConversationMessages(cascadeHistory);
    }
  }, [cascadeState?.history, cascadeState?.status]);

  const toggleSidebarExpansion = useCallback(() => {
    setIsSidebarExpanded(prev => !prev);
  }, []);

  const startNewChat = useCallback(() => {
    const newId = uuidv4();
    setChatId(newId);
    setConversationMessages([]);
    setInput('');
  }, []);

  const selectChat = useCallback((id: string) => {
    if (id === chatId) return;
    // TODO: load selected chat history
  }, [chatId]);

  const handleSendMessage = useCallback(async (message: string) => {
    if (!message.trim() || isProcessing || !userId) return;

    const newUserMessage: Message = { role: 'user', content: message.trim() };
    setConversationMessages(prev => [...prev, newUserMessage]);
    setInput('');

    await addActiveNode('supervisorAgentNode', {
      cascadeId: chatId,
      history: [newUserMessage],
      userId,
    });
  }, [isProcessing, userId, addActiveNode, chatId]);

  const handleToolResponse = useCallback(async (toolResponse: Message) => {
    setConversationMessages(prev => [...prev, toolResponse]);
    setInput('');

    await addActiveNode('supervisorAgentNode', {
      cascadeId: chatId,
      history: [toolResponse],
      userId,
    });
  }, [addActiveNode, chatId]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(input);
    }
  }, [input, handleSendMessage]);

  // Fork the current cascade and switch to the new one
  const handleFork = useCallback(async (upToFunctionId: number, apiEndpoint: string) => {
    setIsForking(true);
    try {
      const newCascadeId = uuidv4();
      await forkCascade(newCascadeId, upToFunctionId, apiEndpoint);
      // Switch view to the forked cascade
      setChatId(newCascadeId);
      setConversationMessages([]);
    } finally {
      setIsForking(false);
    }
  }, [forkCascade]);

  const isEmptyChat = !currentChatHasUserMessages;

  return (
    <div className="w-screen h-screen flex bg-blur from-blue-50 via-white to-purple-50">

      {/* Sidebar */}
      <Sidebar
        history={[]}
        currentChatId={chatId}
        onNewChat={startNewChat}
        onSelectChat={selectChat}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        isExpanded={isSidebarExpanded}
        toggleExpansion={toggleSidebarExpansion}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out">
        {!isSidebarOpen && (
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="lg:hidden absolute top-5 left-6 z-50 p-2.5 bg-gray-100/90 backdrop-blur-md rounded-full shadow-md hover:shadow-lg hover:bg-gray-50 transition-all duration-200 border border-gray-300"
            title="Open Menu"
          >
            <Menu className="w-5 h-5 text-gray-800" />
          </button>
        )}

        <div className="h-full w-full flex flex-col">
          {isEmptyChat ? (
            /* Welcome Screen */
            <div className="flex-1 flex flex-col items-center justify-center px-6 pb-20">
              <div className="text-center mb-12 animate-fade-in">
                <h1 className="text-5xl font-bold text-gray-800 mb-3">
                  Hello {userName},
                </h1>
                <p className="text-2xl text-gray-600">
                  Ready to check this out?
                </p>
              </div>
              <InputBar
                input={input}
                isProcessing={isProcessing}
                userId={userId}
                onChange={setInput}
                onSend={() => handleSendMessage(input)}
                onKeyPress={handleKeyPress}
              />
            </div>
          ) : (
            /* Active Chat View */
            <>
              <MessageList
                displayHistory={conversationMessages}
                userId={userId}
                addActiveNode={addActiveNode}
                handleToolResponse={handleToolResponse}
              />
              <div className="p-6 border-t border-white/30 bg-white/10 backdrop-blur-lg">
                <div className="max-w-4xl mx-auto">
                  <InputBar
                    input={input}
                    isProcessing={isProcessing}
                    userId={userId}
                    compact
                    onChange={setInput}
                    onSend={() => handleSendMessage(input)}
                    onKeyPress={handleKeyPress}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Fork FAB — only enabled once a conversation exists */}
      <ForkPanel
        onFork={handleFork}
        isForking={isForking}
        disabled={isEmptyChat || isProcessing}
      />

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  );
}