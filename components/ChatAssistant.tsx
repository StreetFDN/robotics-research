'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useGlobeStore } from '@/store/globeStore';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function ChatAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { privateCompanies, setSelectedPrivateCompany } = useGlobeStore();

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Handle company highlighting from AI response
  const handleHighlight = useCallback((companyName: string) => {
    const company = privateCompanies.find(
      c => c.name.toLowerCase().includes(companyName.toLowerCase()) ||
           companyName.toLowerCase().includes(c.name.toLowerCase())
    );
    if (company) {
      setSelectedPrivateCompany(company);
    }
  }, [privateCompanies, setSelectedPrivateCompany]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const result = await response.json();

      if (result.ok && result.data) {
        const assistantMessage: Message = {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: result.data.content,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, assistantMessage]);

        // Handle company highlight if present
        if (result.data.highlight) {
          handleHighlight(result.data.highlight);
        }
      } else {
        throw new Error(result.error || 'Failed to get response');
      }
    } catch (error: any) {
      console.error('[Chat] Error:', error);
      setMessages(prev => [...prev, {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error.message}`,
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Quick action buttons
  const quickActions = [
    { label: 'Market Overview', prompt: 'Give me a quick overview of the current robotics market sentiment and the Narrative Index score.' },
    { label: 'Top Funded', prompt: 'Which robotics companies have raised the most funding recently?' },
    { label: 'Humanoid Leaders', prompt: 'Who are the leading humanoid robotics companies and what are their latest developments?' },
  ];

  return (
    <>
      {/* Floating Chat Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 ${
          isOpen
            ? 'bg-white/10 border border-white/20 rotate-0'
            : 'bg-[#00FFE0] hover:bg-[#00FFE0]/90 hover:scale-105'
        }`}
        title={isOpen ? 'Close chat' : 'Ask about robotics'}
      >
        {isOpen ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-black">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" fill="currentColor" />
          </svg>
        )}
      </button>

      {/* Chat Panel */}
      <div
        className={`fixed bottom-24 right-6 z-40 w-96 max-h-[600px] bg-[#0A0B0F] border border-white/10 rounded-lg shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${
          isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-white/10 bg-white/[0.02] flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#00FFE0]/20 flex items-center justify-center">
            <span className="text-[#00FFE0] text-sm">AI</span>
          </div>
          <div>
            <h3 className="text-sm font-medium text-white">Robotics Assistant</h3>
            <p className="text-[10px] text-white/40">Powered by GPT-4</p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[300px] max-h-[400px]">
          {messages.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-white/40 text-sm mb-4">
                Ask me anything about the robotics industry, funding, or companies on the dashboard.
              </div>
              <div className="space-y-2">
                {quickActions.map((action, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setInput(action.prompt);
                      setTimeout(() => sendMessage(), 100);
                    }}
                    className="block w-full text-left px-3 py-2 text-xs text-white/60 bg-white/[0.04] hover:bg-white/[0.08] rounded border border-white/[0.06] transition-colors"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    message.role === 'user'
                      ? 'bg-[#00FFE0]/20 text-white'
                      : 'bg-white/[0.06] text-white/90'
                  }`}
                >
                  <div className="whitespace-pre-wrap break-words">{message.content}</div>
                  <div className="text-[9px] text-white/30 mt-1">
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))
          )}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white/[0.06] rounded-lg px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-[#00FFE0] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-[#00FFE0] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-[#00FFE0] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-3 border-t border-white/10 bg-white/[0.02]">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about robotics..."
              disabled={isLoading}
              className="flex-1 bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#00FFE0]/50 disabled:opacity-50"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              className="px-4 py-2 bg-[#00FFE0] text-black rounded-lg text-sm font-medium hover:bg-[#00FFE0]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
