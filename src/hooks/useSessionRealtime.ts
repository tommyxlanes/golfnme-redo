"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type Ably from "ably";
import { getAblyClient } from "@/lib/ably";

export interface ScoreUpdate {
  userId: string;
  userName: string;
  holeNumber: number;
  strokes: number;
  putts?: number;
  totalScore: number;
  scoreToPar: number;
  timestamp: number;
}

export interface SessionEvent {
  type:
    | "player-joined"
    | "player-left"
    | "session-started"
    | "session-ended"
    | "player-ready"
    | "player-unready";
  userId: string;
  userName?: string;
  timestamp: number;
}

interface UseSessionRealtimeOptions {
  sessionId?: string;
  userId?: string;
  userName?: string;
  onScoreUpdate?: (update: ScoreUpdate) => void;
  onSessionEvent?: (event: SessionEvent) => void;
}

export function useSessionRealtime(options: UseSessionRealtimeOptions) {
  const { sessionId, userId, userName, onScoreUpdate, onSessionEvent } =
    options;

  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);

  const scoresChannelRef = useRef<Ably.RealtimeChannel | null>(null);
  const eventsChannelRef = useRef<Ably.RealtimeChannel | null>(null);
  const ablyRef = useRef<Ably.Realtime | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    const ably = getAblyClient();
    ablyRef.current = ably;

    // Connection state
    const handleConnectionStateChange = (
      stateChange: Ably.ConnectionStateChange
    ) => {
      if (stateChange.current === "connected") {
        setIsConnected(true);
      } else if (
        stateChange.current === "disconnected" ||
        stateChange.current === "failed"
      ) {
        setIsConnected(false);
      }
    };

    ably.connection.on(handleConnectionStateChange);

    if (ably.connection.state === "connected") {
      setIsConnected(true);
    }

    // Scores channel
    const scoresChannel = ably.channels.get(`session:${sessionId}:scores`);
    scoresChannelRef.current = scoresChannel;

    scoresChannel.subscribe("update", (message: Ably.Message) => {
      const update = message.data as ScoreUpdate;
      onScoreUpdate?.(update);
    });

    // Events channel (with presence)
    const eventsChannel = ably.channels.get(`session:${sessionId}:events`, {
      params: { rewind: "1" }, // Get last event on join
    });
    eventsChannelRef.current = eventsChannel;

    eventsChannel.subscribe("event", (message: Ably.Message) => {
      const event = message.data as SessionEvent;
      onSessionEvent?.(event);
    });

    // Presence for online users
    eventsChannel.presence.subscribe("enter", (member) => {
      setOnlineUsers((prev) => [...new Set([...prev, member.clientId])]);
    });

    eventsChannel.presence.subscribe("leave", (member) => {
      setOnlineUsers((prev) => prev.filter((id) => id !== member.clientId));
    });

    // Enter presence if we have a user ID
    if (userId) {
      eventsChannel.presence.enter({ name: userName });
    }

    // Get current presence members
    eventsChannel.presence.get().then((members) => {
      setOnlineUsers(members.map((m) => m.clientId));
    });

    return () => {
      ably.connection.off(handleConnectionStateChange);

      scoresChannel.unsubscribe();
      eventsChannel.unsubscribe();
      eventsChannel.presence.unsubscribe();

      if (userId) {
        eventsChannel.presence.leave();
      }

      scoresChannelRef.current = null;
      eventsChannelRef.current = null;
    };
  }, [sessionId, userId, userName, onScoreUpdate, onSessionEvent]);

  // Publish a score update
  const publishScoreUpdate = useCallback(
    (update: Omit<ScoreUpdate, "timestamp">) => {
      if (!scoresChannelRef.current) return;

      scoresChannelRef.current.publish("update", {
        ...update,
        timestamp: Date.now(),
      });
    },
    []
  );

  // Publish a session event
  const publishSessionEvent = useCallback(
    (type: SessionEvent["type"]) => {
      if (!eventsChannelRef.current || !userId) return;

      eventsChannelRef.current.publish("event", {
        type,
        userId,
        userName,
        timestamp: Date.now(),
      });
    },
    [userId, userName]
  );

  return {
    isConnected,
    onlineUsers,
    publishScoreUpdate,
    publishSessionEvent,
  };
}
