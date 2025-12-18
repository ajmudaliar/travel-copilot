import { useCallback, useMemo, useEffect, useRef } from "react";
import {
  useWebchat,
  Container,
  MessageList,
  Composer,
  StylesheetProvider,
} from "@botpress/webchat";
import type { BlockMessage } from "@botpress/webchat";
import { useTravelStore } from "../stores/travelStore";
import CustomRenderer from "./CustomRenderer";
import { useTripData } from "../hooks/useTripData";

interface ChatSidebarProps {
  clientId: string;
}

const BOT_CONFIG = {
  name: "Travel Copilot",
  avatar: undefined,
  description: "Your AI travel planning assistant",
};

export function ChatSidebar({ clientId }: ChatSidebarProps) {
  const webchat = useWebchat({
    clientId,
  });

  const {
    clientState,
    messages,
    client,
    isTyping,
    user,
    newConversation,
  } = webchat;

  const { fetchTrips, fetchPlaces, restoreUserState } = useTripData();
  const setUserId = useTravelStore((state) => state.setUserId);
  const hasFetchedRef = useRef(false);

  // Store userId, fetch trips, and restore user state on initial load
  useEffect(() => {
    const initializeData = async () => {
      if (user?.userId && !hasFetchedRef.current) {
        hasFetchedRef.current = true;
        setUserId(user.userId);
        await fetchTrips(user.userId);
        await restoreUserState(user.userId);
      }
    };

    initializeData();
  }, [user?.userId, fetchTrips, fetchPlaces, restoreUserState, setUserId]);

  // Create sendMessage function using client
  const sendMessage = useCallback(
    async (payload: { type: string; text?: string }) => {
      // Cast to any to avoid strict type checking on webchat internal types
      await client?.sendMessage(payload as Parameters<typeof client.sendMessage>[0]);
    },
    [client]
  );

  // Enrich messages with direction and sender info
  // Keep custom messages so CustomRenderer can process them (it returns null to hide them)
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
            renderers={{
              custom: CustomRenderer,
            }}
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
        fontFamily="Inter, system-ui, -apple-system, sans-serif"
        variant="solid"
        color="#667eea"
      />
    </div>
  );
}
