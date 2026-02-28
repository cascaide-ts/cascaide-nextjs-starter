'use client';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Menu } from 'lucide-react';
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

  const { cascadeState, isComplete } = useCascade(chatId);
  const [conversationMessages, setConversationMessages] = useState<Message[]>([]);

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

