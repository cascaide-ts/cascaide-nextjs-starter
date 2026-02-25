// AnalysisAgent.tsx (Complete Updated File)

'use client';
import { PROMPT_TEMPLATES } from './templates';
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Send, Menu, Plus} from 'lucide-react';
import { useWorkflow, useCascade} from '@cascaide-ts/react'; 
import { v4 as uuidv4 } from 'uuid';

import 'katex/dist/katex.min.css';
import 'highlight.js/styles/github-dark.css';

import { MessageList, Sidebar } from './chat-helpers';
import { ReportArtifact } from './chat-helpers';

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";





// --- Types ---

interface ChatProps {
  nodeId: string;
}

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
// type ChatHistory = {
//     id: string;
//     title: string;
//     messages: Message[]; 
//     lastUpdated: number;
// };



// --- New Type for Agent Selector ---
type AgentType = 'Meta Ads' | 'Google Ads' | 'Shopify' |'Analytics'
type AgentNodeName = 'metaAgentNode' | 'googleAdsAgentNode' | 'shopifyAgentNode' | 'analyticsAgentNode'



export default function Chat({ nodeId }: ChatProps) {
  const [input, setInput] = useState('');
  
  const userId = "guest-id"
  const userName = 'there';
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<AgentType>('Analytics');
  const { addActiveNode } = useWorkflow(nodeId);
  const [currentChatId, setCurrentChatId] = useState<string>(uuidv4());
  const [currentCascadeId, setCurrentCascadeId] = useState<string | null>(null);
    const isStreamingRef = useRef(false);
  
  const { cascadeState, isComplete, currentNode } = useCascade(currentCascadeId || '');
  const [isDownloading, setIsDownloading] = useState(false);



  const [showTemplates, setShowTemplates] = useState(false);
  const templateMenuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (templateMenuRef.current && !templateMenuRef.current.contains(event.target as Node)) {
        setShowTemplates(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleTemplateClick = (text: string) => {
    setInput(text); // REPLACES the text
    setShowTemplates(false);
    // Optional: Focus the textarea after clicking
    // document.querySelector('textarea')?.focus(); 
  };


  

  // --- INTERACTION: Context Injection ---




  const handleDownloadPdf = async () => {
    try {
      setIsDownloading(true);
      const response = await fetch('/api/report/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          html: reportArtifact.htmlContent,
          title: reportArtifact.title 
        }),
      });

      if (!response.ok) throw new Error('Download failed');

      // Convert response to Blob and trigger download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${reportArtifact.title || 'report'}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (error) {
      console.error(error);
      alert('Failed to download report.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSendEmail = async (recipientEmail: string) => {
      //dummy

      return;
    };

  // ✅ FIX: Memoize initial message to prevent recreation
  const initialAssistantMessage: Message = useMemo(() => ({ 
    role: 'assistant' as const, 
    content: `Hello! I'm the Data Analysis Agent for Intergrow Brands. I can help you analyze your data, answer questions, and provide insights. What would you like to explore today?` 
  }), [selectedAgent]);
  
  const [conversationMessages, setConversationMessages] = useState<Message[]>([
    initialAssistantMessage
  ]);
  
  // ✅ FIX: Memoize computed values
  const displayHistory = useMemo(() => 
    cascadeState?.history || conversationMessages,
    [cascadeState?.history, conversationMessages]
  );
  
  const isProcessing = useMemo(() => 
    !isComplete && !!cascadeState,
    [isComplete, cascadeState]
  );
  
  const currentChatHasUserMessages = useMemo(() => 
    conversationMessages.some(m => m.role === 'user'),
    [conversationMessages]
  );

  const [reportArtifact, setReportArtifact] = useState<{
    isOpen: boolean;
    htmlContent: string;
    title: string;
  }>({ isOpen: false, htmlContent: '', title: '' });

  // ✅ FIX: Memoize handlers
  const openReport = useCallback((htmlContent: string, title: string) => {
    setReportArtifact({ isOpen: true, htmlContent, title });
  }, []);

  const closeReport = useCallback(() => {
    setReportArtifact(prev => ({ ...prev, isOpen: false }));
  }, []);
  
 // ✅ Removed initialAssistantMessage dependency

  // Update initial assistant message when selectedAgent changes
  useEffect(() => {
    // Only update if it's a fresh chat with no user messages
    if (!currentChatHasUserMessages && conversationMessages.length === 1) {
      setConversationMessages([initialAssistantMessage]);
    }
  }, [selectedAgent, currentChatHasUserMessages, initialAssistantMessage]); // ✅ Proper dependencies

  // ✅ FIX: Optimize cascade sync with proper change detection
  useEffect(() => {
    if (!cascadeState?.history) return;

    // Use ref to track streaming state
    const isStreaming = cascadeState.status === 'streaming';
    isStreamingRef.current = isStreaming;

    const cascadeHistory = cascadeState.history;
    
    // Only update if there's an actual difference
    if (cascadeHistory.length !== conversationMessages.length) {
      setConversationMessages(cascadeHistory);
      return;
    }

    // Check if last message content changed
    const lastCascadeMsg = cascadeHistory[cascadeHistory.length - 1];
    const lastConvMsg = conversationMessages[conversationMessages.length - 1];
    
    if (!lastCascadeMsg || !lastConvMsg) return;

    // ✅ CRITICAL: Only update if content or tool_calls actually changed
    const contentChanged = lastCascadeMsg.content !== lastConvMsg.content;
    const toolCallsChanged = JSON.stringify(lastCascadeMsg.tool_calls) !== JSON.stringify(lastConvMsg.tool_calls);
    
    if (contentChanged || toolCallsChanged) {
      setConversationMessages(cascadeHistory);
    }
  }, [cascadeState?.history, cascadeState?.status]); // ✅ Removed conversationMessages dependency to prevent loop

  const toggleSidebarExpansion = useCallback(() => {
    setIsSidebarExpanded(prev => !prev);
  }, []);
  

  const startNewChat = useCallback(() => {

    const newId = uuidv4();
    setCurrentChatId(newId);
    setConversationMessages([initialAssistantMessage]);
    setCurrentCascadeId(null);
    setInput('');
  }, [initialAssistantMessage]);

  const selectChat = useCallback((id: string) => {
    if (id === currentChatId) return;

  }, [currentChatId]);

  const handleSendMessage = useCallback((message: string) => {
    if (!message.trim() || isProcessing || !userId) return;

    const newCascadeId = `cascade_${uuidv4()}`;
    const newUserMessage: Message = { role: 'user', content: message.trim() };

    const updatedHistory = [...conversationMessages, newUserMessage];
    
    setConversationMessages(updatedHistory);
    setInput('');
    setCurrentCascadeId(newCascadeId);
    
    console.log("making call with", JSON.stringify(updatedHistory));
    addActiveNode('searchAgentNode', {
      cascadeId: newCascadeId,
      history: [newUserMessage],
      userId
    });
  }, [isProcessing, userId, conversationMessages, addActiveNode, currentChatId]);

  const handleToolResponse = useCallback((toolresponse: Message) => {
    const newCascadeId = `cascade_${uuidv4()}`;
    const updatedHistory = [...conversationMessages, toolresponse];
    
    setConversationMessages(updatedHistory);
    setInput('');
    setCurrentCascadeId(newCascadeId);
    
    addActiveNode('analyticsAgentNode', {
      cascadeId: newCascadeId,
      history: updatedHistory,
      chatId: currentChatId,
      userId
    });
  }, [conversationMessages, addActiveNode, currentChatId]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(input);
    }
  }, [input, handleSendMessage]);
  
    const isEmptyChat = !currentChatHasUserMessages;

  return (
    <div className="w-screen h-screen flex bg-blur from-blue-50 via-white to-purple-50">
      
      {/* 1. Sidebar */}
      <Sidebar
        history={[]}
        currentChatId={currentChatId}
        onNewChat={startNewChat}
        onSelectChat={selectChat}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        isExpanded={isSidebarExpanded}
        toggleExpansion={toggleSidebarExpansion}
      />

      {/* 2. Main Content Area with Resizable Panels */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out`}>
        {!isSidebarOpen && (
            <button 
                onClick={() => setIsSidebarOpen(true)}
                className="lg:hidden absolute top-5 left-6 z-50 p-2.5 bg-gray-100/90 backdrop-blur-md rounded-full shadow-md hover:shadow-lg hover:bg-gray-50 transition-all duration-200 border border-gray-300"
                title="Open Menu"
            >
                <Menu className="w-5 h-5 text-gray-800" />
            </button>
        )}
   
        
        <ResizablePanelGroup orientation="horizontal" className="flex-1" key={reportArtifact.isOpen ? "report-open" : "report-closed"}>
          {/* Chat Panel */}
          <ResizablePanel defaultSize={reportArtifact.isOpen ? "50" : "100"} minSize={"30"} >
            <div className="h-full w-full flex flex-col">
              {isEmptyChat ? (
                /* Centered Welcome Screen for Empty Chats */
                <div className="flex-1 flex flex-col items-center justify-center px-6 pb-20">
                  <div className="text-center mb-12 animate-fade-in">
                    <h1 className="text-5xl font-bold text-gray-800 mb-3">
                      Hello {userName},
                    </h1>
                    <p className="text-2xl text-gray-600">
                      Ready to check this out?
                    </p>
                  </div>

                  

                  {/* Centered Input Area */}
                  <div className="w-full max-w-3xl">
                    <div className="flex gap-3 items-end">
                      
                      <div className="flex-1 relative">
                        
                        {/* Dropdown Menu */}
                        {showTemplates && (
                          <div 
                            ref={templateMenuRef}
                            className="absolute top-full mt-3 left-0  w-80 max-h-[min(400px,30vh)] overflow-y-auto bg-white border border-gray-200 rounded-2xl shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-200"
                          >
                            {/* Added p-3 and space-y-2 for clear separation */}
                            <div className="p-3 space-y-2">
                              {PROMPT_TEMPLATES.map((template) => (
                                <button
                                  key={template.id}
                                  onClick={() => handleTemplateClick(template.text)}
                                  className="w-full text-left p-3 hover:bg-blue-50 bg-gray-50 border border-gray-100 hover:border-blue-200 rounded-xl transition-all duration-200 group"
                                >
                                  <p className="text-sm text-gray-700 leading-relaxed group-hover:text-blue-800">
                                    {template.text}
                                  </p>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Plus Icon - Aligned Center Relative to Text input */}
                        <button
                          onClick={() => setShowTemplates(!showTemplates)}
                          className="absolute left-4 bottom-[18px] text-gray-400 hover:text-blue-600 transition-colors z-10 p-1.5 rounded-full hover:bg-gray-100"
                          title="Choose a prompt template"
                        >
                          <Plus className="w-5 h-5" />
                        </button>

                        {/* Text Area */}
                        <textarea
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          onKeyPress={handleKeyPress}
                          placeholder="Ask about your marketing data..."
                          disabled={isProcessing || !userId} 
                          rows={1}
                          // padding-left 60px to clear the icon
                          // py-4 (16px) matches bottom-[18px] of icon + icon padding for visual centering
                          className="w-full py-4 pr-6 pl-[60px] border border-gray-300 bg-white rounded-3xl 
                            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                            disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed
                            resize-none text-gray-800 placeholder-gray-400
                            transition-all duration-200 shadow-lg hover:shadow-xl leading-relaxed"
                          style={{ 
                            minHeight: '60px', 
                            maxHeight: '200px',
                            height: 'auto'
                          }}
                          onInput={(e) => {
                            const target = e.target as HTMLTextAreaElement;
                            target.style.height = 'auto';
                            target.style.height = Math.min(target.scrollHeight, 200) + 'px';
                          }}
                        />
                      </div>
                      <button
                        onClick={() => handleSendMessage(input)}
                        disabled={!input.trim() || isProcessing || !userId}
                        className="px-6 py-4 bg-blue-600 text-white rounded-3xl hover:bg-blue-700 
                          disabled:bg-gray-300 disabled:cursor-not-allowed 
                          transition-all duration-200 flex items-center gap-2 font-medium
                          shadow-lg hover:shadow-xl disabled:shadow-none"
                        title="Send Message"
                      >
                        <Send className="w-5 h-5" />
                        <span>Send</span>
                      </button>
                    </div>
                    <p className="text-sm text-gray-500 mt-3 text-center">
                      Press <kbd className="px-2 py-1 bg-gray-100 rounded border border-gray-300 font-mono text-xs">Enter</kbd> to send, <kbd className="px-2 py-1 bg-gray-100 rounded border border-gray-300 font-mono text-xs">Shift + Enter</kbd> for new line
                    </p>
                  </div>
                </div>
                
              ) : (
                /* Normal Chat View with Messages */
                <>
                  <MessageList 
                    displayHistory={displayHistory} 
                    userId={userId} 
                    addActiveNode={addActiveNode} 
                    handleToolResponse={handleToolResponse}
                    onOpenReport={openReport}
                  />
                  {/* Input Area */}
                  <div className="p-6 border-t border-white/30 bg-white/10 backdrop-blur-lg">
                    <div className="max-w-4xl mx-auto">
                      <div className="flex gap-3 items-end">
                        
                        <div className="flex-1 relative">
                          
                          {/* Dropdown Menu */}
                          {showTemplates && (
                            <div 
                              ref={templateMenuRef}
                              className="absolute bottom-full left-0 mb-3 w-80 max-h-[min(400px,40vh)] overflow-y-auto bg-white/90 backdrop-blur-xl border border-white/40 rounded-2xl shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-200"
                            >
                              <div className="p-3 space-y-2">
                                {PROMPT_TEMPLATES.map((template) => (
                                  <button
                                    key={template.id}
                                    onClick={() => handleTemplateClick(template.text)}
                                    className="w-full text-left p-3 hover:bg-blue-50/80 bg-white/50 border border-gray-200/50 hover:border-blue-200 rounded-xl transition-all duration-200 group shadow-sm"
                                  >
                                    <p className="text-sm text-gray-700 leading-relaxed group-hover:text-blue-800">
                                      {template.text}
                                    </p>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Plus Icon */}
                          <button
                            onClick={() => setShowTemplates(!showTemplates)}
                            className="absolute left-3 bottom-[14px] text-gray-500 hover:text-blue-600 transition-colors z-10 p-1.5 rounded-full hover:bg-white/40"
                            title="Choose a prompt template"
                          >
                            <Plus className="w-5 h-5" />
                          </button>

                          {/* Text Area */}
                          <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder="Ask about your marketing data..."
                            disabled={isProcessing || !userId} 
                            rows={1}
                            // py-3 (12px) + line-height aligns with bottom-[14px] icon
                            className="w-full py-3 pr-4 pl-[52px] border border-white/30 bg-white/20 backdrop-blur-sm rounded-2xl 
                              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                              disabled:bg-gray-100/50 disabled:text-gray-500 disabled:cursor-not-allowed
                              resize-none text-gray-800 placeholder-gray-500
                              transition-all duration-200 leading-relaxed"
                            style={{ 
                              minHeight: '50px', 
                              maxHeight: '150px',
                              height: 'auto'
                            }}
                            onInput={(e) => {
                              const target = e.target as HTMLTextAreaElement;
                              target.style.height = 'auto';
                              target.style.height = Math.min(target.scrollHeight, 150) + 'px';
                            }}
                          />
                        </div>
                        <button
                          onClick={() => handleSendMessage(input)}
                          disabled={!input.trim() || isProcessing || !userId}
                          className="px-6 py-3 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 
                            disabled:bg-gray-300 disabled:cursor-not-allowed 
                            transition-all duration-200 flex items-center gap-2 font-medium
                            shadow-lg hover:shadow-xl disabled:shadow-none"
                          title="Send Message"
                        >
                          <Send className="w-5 h-5" />
                          <span>Send</span>
                        </button>
                      </div>
                      <p className="text-xs text-gray-600 mt-2 text-center">
                        Press <kbd className="px-1.5 py-0.5 bg-white/30 rounded border border-white/40 font-mono">Enter</kbd> to send, <kbd className="px-1.5 py-0.5 bg-white/30 rounded border border-white/40 font-mono">Shift + Enter</kbd> for new line
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </ResizablePanel>

          {/* Resizable Report Panel */}
          {reportArtifact.isOpen && (
            <>
              <ResizableHandle withHandle className="bg-gray-300 hover:bg-blue-500 transition-colors" />
              <ResizablePanel defaultSize={"50"} minSize={"25"} maxSize={"100"} className='z-50'>
                <ReportArtifact 
                  htmlContent={reportArtifact.htmlContent}
                  title={reportArtifact.title}
                  defaultEmail={'default@something.com'} // Pass user email
                  onDownload={handleDownloadPdf}
                  onSendEmail={handleSendEmail} // Pass the handler
                  onClose={closeReport}
                  isDownloading={isDownloading}
                />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>

       
      </div>
      
      {/* Mobile Sidebar Overlay (outside the main content) */}
      {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)}></div>}
    </div>
  );
}