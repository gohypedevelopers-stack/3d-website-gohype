"use client"

import { useState, FormEvent } from "react"
import { Bot, Paperclip, Mic, CornerDownLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  ChatBubble,
  ChatBubbleAvatar,
  ChatBubbleMessage,
} from "@/components/ui/chat-bubble"
import { ChatInput } from "@/components/ui/chat-input"
import {
  ExpandableChat,
  ExpandableChatHeader,
  ExpandableChatBody,
  ExpandableChatFooter,
} from "@/components/ui/expandable-chat"
import { ChatMessageList } from "@/components/ui/chat-message-list"

type Message = { id: number; content: string; sender: "user" | "ai"; };

export function GoHypeAIChat() {
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, content: "Hello! I'm the GoHype Bot. Ask me anything about our services!", sender: "ai" },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: Message = { id: messages.length + 1, content: input, sender: "user" };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ history: newMessages }),
        });
        if (!response.ok) throw new Error(`API error: ${response.statusText}`);
        const aiResponseText = await response.text();
        setMessages(prev => [...prev, { id: prev.length + 1, content: aiResponseText, sender: 'ai' }]);
    } catch (error) {
        setMessages(prev => [...prev, { id: prev.length + 1, content: "Sorry, I'm having trouble connecting right now.", sender: 'ai' }]);
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="h-[600px] relative font-sans">
      <ExpandableChat size="lg" position="bottom-right" icon={<Bot className="h-6 w-6" />}>
        <ExpandableChatHeader className="flex-col text-center justify-center">
          <h1 className="text-xl font-semibold text-white">Chat with GoHype Bot ✨</h1>
          <p className="text-sm text-gray-400">Ask about our services, projects, or contact info</p>
        </ExpandableChatHeader>
        <ExpandableChatBody>
          <ChatMessageList>
            {messages.map((message) => (
              <ChatBubble key={message.id} variant={message.sender === "user" ? "sent" : "received"}>
                <ChatBubbleAvatar src={message.sender === "user" ? "/user.png" : "/logo.png"} fallback={message.sender === "user" ? "U" : "AI"} />
                <ChatBubbleMessage variant={message.sender === "user" ? "sent" : "received"}>{message.content}</ChatBubbleMessage>
              </ChatBubble>
            ))}
            {isLoading && (
              <ChatBubble variant="received">
                <ChatBubbleAvatar src="/logo.png" fallback="AI" />
                <ChatBubbleMessage isLoading />
              </ChatBubble>
            )}
          </ChatMessageList>
        </ExpandableChatBody>
        <ExpandableChatFooter>
          <form onSubmit={handleSubmit} className="relative rounded-lg border border-white/20 bg-slate-800 focus-within:ring-1 focus-within:ring-yellow-400 p-1">
            <ChatInput value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type your message..." />
            <div className="flex items-center p-3 pt-0 justify-between">
              <div className="flex">
                <Button variant="ghost" size="icon" type="button"><Paperclip className="size-4" /></Button>
                <Button variant="ghost" size="icon" type="button"><Mic className="size-4" /></Button>
              </div>
              <Button type="submit" size="sm" className="ml-auto gap-1.5" disabled={isLoading}>
                Send Message <CornerDownLeft className="size-3.5" />
              </Button>
            </div>
          </form>
        </ExpandableChatFooter>
      </ExpandableChat>
    </div>
  )
}