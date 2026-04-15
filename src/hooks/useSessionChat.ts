"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type Ably from "ably";
import { getAblyClient } from "@/lib/ably";

export interface ChatMessage {
  id?: string;
  userId: string;
  userName: string;
  text: string;
  timestamp?: number;
  createdAt?: string;
}

interface UseSessionChatOptions {
  sessionId?: string;
  userId?: string;
  userName?: string;
}

export function useSessionChat(options: UseSessionChatOptions) {
  const { sessionId, userId, userName } = options;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const channelRef = useRef<Ably.RealtimeChannel | null>(null);
  const ablyRef = useRef<Ably.Realtime | null>(null);

  // Load existing messages from database
  useEffect(() => {
    if (!sessionId) {
      setIsLoading(false);
      return;
    }

    async function loadMessages() {
      try {
        setIsLoading(true);
        const res = await fetch(`/api/sessions/${sessionId}/chat`);
        const data = await res.json();

        if (data.success && data.data) {
          setMessages(
            data.data.map((msg: any) => ({
              id: msg.id,
              userId: msg.userId,
              userName: msg.userName,
              text: msg.text,
              createdAt: msg.createdAt,
            }))
          );
        }
      } catch (err) {
        console.error("Failed to load messages:", err);
      } finally {
        setIsLoading(false);
      }
    }

    loadMessages();
  }, [sessionId]);

  // Initialize Ably connection for real-time updates
  useEffect(() => {
    if (!sessionId) return;

    const ably = getAblyClient();
    ablyRef.current = ably;

    const handleConnectionStateChange = (
      stateChange: Ably.ConnectionStateChange
    ) => {
      console.log("Ably connection state:", stateChange.current);

      if (stateChange.current === "connected") {
        setIsConnected(true);
        setConnectionError(null);
      } else if (
        stateChange.current === "disconnected" ||
        stateChange.current === "suspended"
      ) {
        setIsConnected(false);
      } else if (stateChange.current === "failed") {
        setIsConnected(false);
        setConnectionError(stateChange.reason?.message || "Connection failed");
        console.error("Ably connection failed:", stateChange.reason);
      }
    };

    ably.connection.on(handleConnectionStateChange);

    if (ably.connection.state === "connected") {
      setIsConnected(true);
    }

    // Subscribe to chat channel
    const channelName = `session:${sessionId}:chat`;
    const channel = ably.channels.get(channelName);
    channelRef.current = channel;

    // Listen for real-time messages from other users
    channel.subscribe("message", (message: Ably.Message) => {
      const chatMessage = message.data as ChatMessage;

      // Avoid duplicates - check by odId + text + timestamp proximity
      setMessages((prev) => {
        const isDuplicate = prev.some(
          (m) =>
            m.userId === chatMessage.userId &&
            m.text === chatMessage.text &&
            Math.abs(
              new Date(m.createdAt || m.timestamp || 0).getTime() -
                (chatMessage.timestamp || Date.now())
            ) < 5000
        );
        if (isDuplicate) return prev;
        return [...prev, chatMessage];
      });
    });

    return () => {
      ably.connection.off(handleConnectionStateChange);
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [sessionId]);

  // Send a chat message (save to DB + broadcast via Ably)
  const sendMessage = useCallback(
    async (text: string) => {
      if (!sessionId || !userId || !userName || !text.trim()) return;

      const timestamp = Date.now();
      const optimisticMessage: ChatMessage = {
        userId,
        userName,
        text: text.trim(),
        timestamp,
      };

      // Optimistically add to local state
      setMessages((prev) => [...prev, optimisticMessage]);

      // Save to database
      try {
        const res = await fetch(`/api/sessions/${sessionId}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: text.trim() }),
        });

        if (!res.ok) {
          console.error("Failed to save message");
          // Could remove optimistic message here if needed
        }
      } catch (err) {
        console.error("Failed to save message:", err);
      }

      // Broadcast via Ably for real-time delivery to others
      channelRef.current?.publish("message", optimisticMessage);
    },
    [sessionId, userId, userName]
  );

  // Clear local messages
  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    isConnected,
    isLoading,
    connectionError,
    sendMessage,
    clearMessages,
  };
}
