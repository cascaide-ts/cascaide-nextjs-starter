import { v4 as uuidv4 } from 'uuid';

import React, { useState, useEffect, useRef, useMemo, ReactNode, useCallback } from 'react';

import { 
    Rocket, Bot,
    ChevronLeft, ChevronRight, Loader2,  Database,  X as CloseIcon, 
    Plus as PlusIcon,
  } from 'lucide-react';





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
    
    const sortedHistory = useMemo(() => {
        const activeChat = history.find((c: any) => c.id === currentChatId);
        const hasUserMessage = activeChat?.messages.some((m: any) => m.role === 'user');
        
        const filterableHistory = history.filter((chat: any) => 
            chat.id !== currentChatId || hasUserMessage
        );
        
        return [...filterableHistory].sort((a, b) => b.lastUpdated - a.lastUpdated);
    }, [history, currentChatId]);

    const handleConnections = () => console.log('Connections clicked');
    const handleAnalyst = () => console.log('Analyst clicked');
    const handleReports = () => console.log('Reports clicked');

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

              
            </div>
        </>
    );
};

