'use client';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Menu } from 'lucide-react';
import { useWorkflow, useCascade } from '@cascaide-ts/react';
import { v4 as uuidv4 } from 'uuid';
import { Sidebar } from './sidebar';
import { InputBar } from './input.tsx';
import { MessageList } from './message-list';
import { Spawns } from '@cascaide-ts/core';

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



// --- Main Component ---

export default function Chat({ nodeId }: ChatProps) {
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

  const [forkStatus, setForkStatus] = useState<'idle' | 'loading' | 'SUCCESS' | 'FAILED'>('idle');
  const [forkFunctionId, setForkFunctionId] = useState<number>(0);

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
    const spawns: Spawns = {
      ['supervisorAgentNode']: {
        cascadeId: chatId,
        history: [newUserMessage],
        userId,
      }
    };
    await addActiveNode(spawns);
  }, [isProcessing, userId, addActiveNode, chatId]);
  
  const handleToolResponse = useCallback(async (toolResponse: Message) => {
    setConversationMessages(prev => [...prev, toolResponse]);
    setInput('');
    const spawns: Spawns = {
      'supervisorAgentNode': {
        cascadeId: chatId,
        history: [toolResponse],
        userId,
      }
    };
    await addActiveNode(spawns);
  }, [addActiveNode, chatId]);


  const handleFork = useCallback(async () => {
    const newCascadeId = uuidv4(); // branches into a fresh cascade
    setForkStatus('loading');
    const result = await forkCascade(newCascadeId, forkFunctionId);
    setForkStatus(result.status);
    // Optional: switch the active chat to the fork
    setChatId(newCascadeId);
  }, [forkCascade, forkFunctionId]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(input);
    }
  }, [input, handleSendMessage]);

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
      {/* Fork Test Panel — remove before production */}
{!isEmptyChat && (
  <div className="fixed bottom-32 right-6 z-50 flex flex-col gap-2 bg-white/90 backdrop-blur border border-gray-200 rounded-xl shadow-lg p-4 w-64">
    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
      Fork Test
    </p>
    <p className="text-xs text-gray-400 break-all">
      Source: <span className="text-gray-600 font-mono">{chatId.slice(0, 8)}…</span>
    </p>
    <label className="text-xs text-gray-500">
      upToFunctionId
      <input
        type="number"
        min={0}
        value={forkFunctionId}
        onChange={e => setForkFunctionId(Number(e.target.value))}
        className="mt-1 w-full border border-gray-300 rounded-md px-2 py-1 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
    </label>
    <button
      onClick={handleFork}
      disabled={forkStatus === 'loading' || isProcessing}
      className={`mt-1 rounded-lg px-3 py-2 text-sm font-medium transition-all
        ${forkStatus === 'loading'  ? 'bg-gray-100 text-gray-400 cursor-wait' : ''}
        ${forkStatus === 'SUCCESS'  ? 'bg-green-50 text-green-700 border border-green-300' : ''}
        ${forkStatus === 'FAILED'   ? 'bg-red-50 text-red-700 border border-red-300' : ''}
        ${forkStatus === 'idle'     ? 'bg-blue-600 text-white hover:bg-blue-700' : ''}
      `}
    >
      {forkStatus === 'loading' ? 'Forking…'
        : forkStatus === 'SUCCESS' ? '✓ Fork succeeded'
        : forkStatus === 'FAILED'  ? '✗ Fork failed'
        : 'Fork cascade'}
    </button>
    {forkStatus !== 'idle' && (
      <button
        onClick={() => setForkStatus('idle')}
        className="text-xs text-gray-400 hover:text-gray-600 text-center"
      >
        Reset
      </button>
    )}
  </div>
)}

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

