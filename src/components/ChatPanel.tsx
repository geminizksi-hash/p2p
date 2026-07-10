import React, { useState, useRef, useEffect } from "react";
import { ChatMessage } from "../types";
import { Send, MessageSquare, ShieldCheck, User } from "lucide-react";

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  disabled: boolean;
}

export function ChatPanel({ messages, onSendMessage, disabled }: ChatPanelProps) {
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || disabled) return;

    onSendMessage(inputText.trim());
    setInputText("");
  };

  const formatMessageTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col h-[400px]">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
        <h2 className="text-sm font-display font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-indigo-600" /> Secure Ephemeral Chat
        </h2>
        <span className="text-[10px] text-slate-500 font-mono font-bold">End-to-End Encrypted</span>
      </div>

      {/* Messages viewport */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1 min-h-0">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4 gap-2">
            <MessageSquare className="w-8 h-8 text-slate-300" />
            <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
              No messages exchanged yet. Send a secure message or drop files to communicate with your peer.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender === "me";
            return (
              <div
                key={msg.id}
                className={`flex flex-col max-w-[85%] ${isMe ? "ml-auto items-end" : "mr-auto items-start"}`}
              >
                <div
                  className={`px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed break-words ${
                    isMe
                      ? "bg-indigo-600 text-white rounded-tr-sm shadow-sm"
                      : "bg-slate-50 border border-slate-200 text-slate-800 rounded-tl-sm"
                  }`}
                >
                  {msg.text}
                </div>

                <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-400 font-mono font-semibold">
                  <span>{isMe ? "Me" : "Peer"}</span>
                  <span>•</span>
                  <span>{formatMessageTime(msg.timestamp)}</span>
                  {!isMe && (
                    <>
                      <span className="text-slate-300">•</span>
                      <span className="text-indigo-600 flex items-center gap-0.5 font-bold" title="Decrypted inside local memory.">
                        <ShieldCheck className="w-3 h-3 shrink-0" /> Decrypted
                      </span>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSend} className="mt-auto pt-3 border-t border-slate-100 shrink-0 flex gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={disabled ? "Connect to a peer to chat" : "Type encrypted message..."}
          disabled={disabled}
          className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={disabled || !inputText.trim()}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-100 disabled:text-slate-400 border border-transparent text-white font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center shrink-0"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
}
