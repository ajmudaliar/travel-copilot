import { useEffect, useCallback, useMemo } from "react";
import {
  useWebchat,
  Container,
  MessageList,
  Composer,
  StylesheetProvider,
} from "@botpress/webchat";
import type { BlockMessage } from "@botpress/webchat";
import { useTravelStore } from "../stores/travelStore";

interface ChatSidebarProps {
  clientId: string;
}

const BOT_CONFIG = {
  name: "Travel Copilot",
  avatar: undefined,
  description: "Your AI travel planning assistant",
};

export function ChatSidebar({ clientId }: ChatSidebarProps) {
  const syncFromBot = useTravelStore((state) => state.syncFromBot);

  const webchat = useWebchat({
    clientId,
  });

  const {
    clientState,
    on,
    messages,
    client,
    isTyping,
    user,
    newConversation,
  } = webchat;

  // Create sendMessage function using client
  const sendMessage = useCallback(
    async (payload: { type: string; text?: string }) => {
      try {
        await client?.sendMessage(payload);
      } catch (error) {
        console.error("[ChatSidebar] Failed to send message:", error);
      }
    },
    [client]
  );

  // Enrich messages with direction and sender info
  const enrichedMessages = useMemo(() => {
    return messages.map((message: BlockMessage) => {
      const direction: "outgoing" | "incoming" =
        message.authorId === user?.userId ? "outgoing" : "incoming";
      return {
        ...message,
        direction,
        sender:
          direction === "outgoing"
            ? { name: "You", avatar: undefined }
            : { name: BOT_CONFIG.name, avatar: BOT_CONFIG.avatar },
      };
    });
  }, [messages, user?.userId]);

  // Listen for custom events from the bot (state sync)
  useEffect(() => {
    if (!on) return;

    const unsubscribe = on("customEvent", (event) => {
      console.log("[ChatSidebar] Received custom event:", event);

      // Handle travel state updates from bot
      if (event && typeof event === "object" && "type" in event) {
        const typedEvent = event as { type: string; payload?: unknown };
        if (typedEvent.type === "travel_state_update" && typedEvent.payload) {
          console.log("[ChatSidebar] Syncing travel state:", typedEvent.payload);
          syncFromBot(typedEvent.payload as Parameters<typeof syncFromBot>[0]);
        }
      }
    });

    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, [on, syncFromBot]);

  // Connection status indicator
  const getStatusColor = useCallback(() => {
    switch (clientState) {
      case "connected":
        return "#22c55e"; // green
      case "connecting":
        return "#eab308"; // yellow
      case "error":
      case "disconnected":
        return "#ef4444"; // red
      default:
        return "#6b7280"; // gray
    }
  }, [clientState]);

  const getStatusText = useCallback(() => {
    switch (clientState) {
      case "connected":
        return "Connected";
      case "connecting":
        return "Connecting...";
      case "error":
        return "Error";
      case "disconnected":
        return "Disconnected";
      default:
        return "Unknown";
    }
  }, [clientState]);

  const isConnected = clientState !== "disconnected";

  return (
    <div className="chat-sidebar">
      {/* Connection Status */}
      <div className="connection-status">
        <span
          className="status-dot"
          style={{ backgroundColor: getStatusColor() }}
        />
        <span className="status-text">{getStatusText()}</span>
      </div>

      {/* Chat Header */}
      <div className="chat-header">
        <div className="chat-header-content">
          <h3>{BOT_CONFIG.name}</h3>
          <p>{BOT_CONFIG.description}</p>
        </div>
        <button
          className="new-conversation-btn"
          onClick={() => newConversation()}
          title="Start new conversation"
        >
          New Chat
        </button>
      </div>

      {/* Chat Container */}
      <div className="chat-container">
        <Container connected={isConnected}>
          <MessageList
            botName={BOT_CONFIG.name}
            botDescription={BOT_CONFIG.description}
            isTyping={isTyping}
            showMessageStatus={true}
            showMarquee={true}
            messages={enrichedMessages}
            sendMessage={sendMessage}
          />
          <Composer
            disableComposer={false}
            isReadOnly={false}
            allowFileUpload={false}
            connected={isConnected}
            sendMessage={sendMessage}
            composerPlaceholder="Plan your next adventure..."
          />
        </Container>
      </div>
      <StylesheetProvider
        radius={1}
        fontFamily="system-ui, -apple-system, sans-serif"
        variant="solid"
        color="#667eea"
      />
    </div>
  );
}
