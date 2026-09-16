import { FormEvent, KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import PageMeta from "../components/common/PageMeta";
import { useAuth } from "../context/AuthContext";
import { useApi } from "../lib/api";

type ChatRoom = {
  id: string;
  room_type: "municipality" | "barangay";
  barangay_id?: number;
  name: string;
  description: string;
  seal_url?: string | null;
};

type ChatReactionUser = {
  id: number;
  display_name?: string | null;
  email?: string | null;
};

type ChatReaction = {
  id: number;
  user_id: number;
  emoji: string;
  is_mine?: boolean;
  user?: ChatReactionUser;
};

type ChatSender = {
  id?: number;
  display_name?: string | null;
  email?: string | null;
  role?: string;
  barangay?: { name: string; seal_url?: string | null } | null;
  profile_image_url?: string | null;
  assignedBarangays?: Array<{ name: string }>;
};

type ChatMessage = {
  id: number;
  body: string;
  created_at: string;
  sender_id: number;
  sender?: ChatSender;
  reply_to_id?: number | null;
  replyTo?: {
    id: number;
    body: string;
    sender_id?: number;
    sender?: { display_name?: string | null; email?: string | null };
  } | null;
  reactions?: ChatReaction[];
};

const REACTION_PALETTE = ["👍", "❤️", "😊", "😂", "🎉", "😮", "😢", "🙏", "✅", "🔥"];

const dateTime = (value: string) => {
  try {
    return new Intl.DateTimeFormat("en-PH", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
};

const timeOnly = (value: string) => {
  try {
    return new Intl.DateTimeFormat("en-PH", {
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
};

const getInitials = (name?: string | null, email?: string | null) => {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (email?.trim()) return email.slice(0, 2).toUpperCase();
  return "MB";
};

export default function Chat() {
  const apiFetch = useApi();
  const { profile } = useAuth();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [body, setBody] = useState("");
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeReactionPickerId, setActiveReactionPickerId] = useState<number | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<number | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [roomFilter, setRoomFilter] = useState("");

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Smooth scroll to bottom
  const scrollToBottom = useCallback((smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
    }
  }, []);

  // Jump to specific message referenced in reply
  const scrollToMessage = (messageId: number) => {
    const targetElement = document.getElementById(`message-${messageId}`);
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedMessageId(messageId);
      setTimeout(() => {
        setHighlightedMessageId((current) => (current === messageId ? null : current));
      }, 2500);
    }
  };

  const loadMessages = useCallback(
    async (room: ChatRoom, showLoading = false) => {
      if (showLoading) setLoading(true);
      const url =
        room.room_type === "municipality"
          ? "/api/chat/rooms/municipality"
          : `/api/chat/rooms/barangay/${room.barangay_id}`;
      try {
        const response = await apiFetch(url);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load messages.");
        setMessages(data.messages || []);
        setError(null);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load messages.");
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [apiFetch]
  );

  // Load chat rooms
  useEffect(() => {
    apiFetch("/api/chat/rooms")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load chat rooms.");
        const availableRooms = data.rooms || [];
        setRooms(availableRooms);
        setActiveRoom(availableRooms[0] || null);
      })
      .catch((loadError) =>
        setError(loadError instanceof Error ? loadError.message : "Unable to load chat rooms.")
      )
      .finally(() => setLoading(false));
  }, [apiFetch]);

  // Load messages when active room changes and poll every 8 seconds
  useEffect(() => {
    if (!activeRoom) return;
    loadMessages(activeRoom, true).then(() => {
      scrollToBottom(false);
    });
    const timer = window.setInterval(() => loadMessages(activeRoom), 8000);
    return () => window.clearInterval(timer);
  }, [activeRoom, loadMessages, scrollToBottom]);

  // Scroll to bottom on new incoming or sent message
  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom(true);
    }
  }, [messages.length, scrollToBottom]);

  // Auto-focus input when clicking Reply
  useEffect(() => {
    if (replyingTo && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [replyingTo]);

  // Close reaction picker on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".reaction-picker-container") && !target.closest(".reaction-trigger-btn")) {
        setActiveReactionPickerId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleReplyClick = (message: ChatMessage) => {
    setReplyingTo(message);
    setActiveReactionPickerId(null);
  };

  const handleCancelReply = () => {
    setReplyingTo(null);
  };

  const sendMessage = async (event?: FormEvent) => {
    if (event) event.preventDefault();
    if (!activeRoom || !body.trim() || sending) return;
    setSending(true);
    const pendingBody = body.trim();
    const pendingReplyTo = replyingTo;

    try {
      if (editingMessageId) {
        // Edit existing message
        const response = await apiFetch(`/api/chat/messages/${editingMessageId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body: pendingBody }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Unable to save edits.');
        setMessages((current) => current.map((m) => (m.id === editingMessageId ? data.message : m)));
        setEditingMessageId(null);
        setBody('');
        setError(null);
        return;
      }

      const response = await apiFetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_type: activeRoom.room_type,
          barangay_id: activeRoom.barangay_id,
          reply_to_id: pendingReplyTo?.id || null,
          body: pendingBody,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to send message.');

      setMessages((current) => [...current, data.message]);
      setBody('');
      setReplyingTo(null);
      setError(null);
      setTimeout(() => scrollToBottom(true), 50);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Unable to send message.');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    } else if (e.key === 'Escape' && (replyingTo || editingMessageId)) {
      e.preventDefault();
      if (replyingTo) handleCancelReply();
      if (editingMessageId) { setEditingMessageId(null); setBody(''); }
    }
  };

  const toggleReaction = async (message: ChatMessage, emoji: string) => {
    setActiveReactionPickerId(null);

    // Optimistic UI update: instantly toggle reaction in local state
    const currentReactions = message.reactions || [];
    const myReactionIndex = currentReactions.findIndex((r) => r.emoji === emoji && r.is_mine);
    const hasMyReaction = myReactionIndex >= 0;

    let updatedReactions: ChatReaction[];
    if (hasMyReaction) {
      // Remove reaction
      updatedReactions = currentReactions.filter((_, idx) => idx !== myReactionIndex);
    } else {
      // Add reaction
      const newReaction: ChatReaction = {
        id: Date.now(),
        user_id: 0,
        emoji,
        is_mine: true,
        user: {
          id: 0,
          display_name: profile?.displayName || "You",
          email: profile?.email || null,
        },
      };
      updatedReactions = [...currentReactions, newReaction];
    }

    // Apply optimistic update immediately
    setMessages((current) =>
      current.map((m) => (m.id === message.id ? { ...m, reactions: updatedReactions } : m))
    );

    try {
      const response = await apiFetch(`/api/chat/messages/${message.id}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to react to this message.");

      // If server returned updated reactions array, sync it
      if (Array.isArray(data.reactions)) {
        setMessages((current) =>
          current.map((m) => (m.id === message.id ? { ...m, reactions: data.reactions } : m))
        );
      }
    } catch (reactionError) {
      // Revert optimistic update on failure
      setMessages((current) =>
        current.map((m) => (m.id === message.id ? { ...m, reactions: currentReactions } : m))
      );
      setError(reactionError instanceof Error ? reactionError.message : "Unable to react to this message.");
    }
  };

  const filteredRooms = rooms.filter((r) =>
    r.name.toLowerCase().includes(roomFilter.toLowerCase()) ||
    r.description.toLowerCase().includes(roomFilter.toLowerCase())
  );

  return (
    <>
      <PageMeta
        title="Messages | E-Procurement"
        description="Municipality and barangay real-time group messaging with replies and reactions."
      />

      <div className="mx-auto flex h-[calc(100vh-10rem)] max-w-7xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900/50">
        {/* Left Sidebar: Rooms List */}
        <aside className="flex w-80 shrink-0 flex-col border-r border-gray-200 bg-gray-50/50 dark:border-gray-800 dark:bg-gray-900/40">
          <div className="border-b border-gray-200 p-4 dark:border-gray-800">
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">Messages</h1>
              <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
                {rooms.length} {rooms.length === 1 ? "room" : "rooms"}
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Discussions & barangay communications
            </p>

            {/* Room search filter */}
            {rooms.length > 3 && (
              <div className="relative mt-3">
                <input
                  type="text"
                  value={roomFilter}
                  onChange={(e) => setRoomFilter(e.target.value)}
                  placeholder="Search channels..."
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-800 placeholder-gray-400 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                />
              </div>
            )}
          </div>

          <div className="flex-1 space-y-1 overflow-y-auto p-3">
            {filteredRooms.map((room) => {
              const isActive = activeRoom?.id === room.id;
              const isMunicipality = room.room_type === "municipality";
              return (
                <button
                  key={room.id}
                  onClick={() => {
                    setActiveRoom(room);
                    setReplyingTo(null);
                    setError(null);
                  }}
                  className={`group relative flex w-full items-start gap-3 rounded-xl p-3 text-left transition-all ${
                    isActive
                      ? "bg-brand-500 text-white shadow-xs"
                      : "text-gray-700 hover:bg-gray-200/60 dark:text-gray-300 dark:hover:bg-white/5"
                  }`}
                >
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base font-bold shadow-xs ${
                      isActive
                        ? "bg-white/20 text-white"
                        : isMunicipality
                        ? "bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400"
                        : "bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                    }`}
                  >
                    {isMunicipality ? (
                      <img src="/images/logo/cropped-LGU-Saint-Bernard-LOGO.png" alt="Municipality" className="h-6 w-6 object-contain" />
                    ) : room.seal_url ? (
                      <img src={room.seal_url} alt={room.name} className="h-6 w-6 object-contain rounded" />
                    ) : (
                      "📍"
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate text-sm font-semibold">{room.name}</span>
                    </div>
                    <p
                      className={`mt-0.5 truncate text-xs ${
                        isActive ? "text-white/80" : "text-gray-500 dark:text-gray-400"
                      }`}
                    >
                      {room.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Right Section: Active Chat Room */}
        <section className="flex min-w-0 flex-1 flex-col bg-white dark:bg-gray-900">
          {/* Room Header */}
          <header className="flex h-16 shrink-0 items-center justify-between border-b border-gray-200 px-6 dark:border-gray-800">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-lg dark:bg-brand-500/10">
                {activeRoom?.room_type === 'municipality' ? (
                  <img src="/images/logo/cropped-LGU-Saint-Bernard-LOGO.png" alt="Municipality" className="h-8 w-8 object-contain" />
                ) : activeRoom?.seal_url ? (
                  <img src={activeRoom.seal_url} alt={activeRoom.name} className="h-8 w-8 object-contain rounded" />
                ) : (
                  '📍'
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-gray-900 dark:text-white">
                    {activeRoom?.name || "Messages"}
                  </h2>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                    {activeRoom?.room_type === "municipality" ? "Municipality Room" : "Barangay Room"}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{activeRoom?.description}</p>
              </div>
            </div>

            <button
              onClick={() => activeRoom && loadMessages(activeRoom, true)}
              title="Refresh messages"
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </header>

          {/* Messages Scroll Area */}
          <div
            ref={messagesContainerRef}
            className="flex-1 space-y-4 overflow-y-auto p-6 scroll-smooth"
          >
            {loading && (
              <div className="flex h-32 items-center justify-center">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                  Loading messages...
                </div>
              </div>
            )}

            {!loading && messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-2xl dark:bg-brand-500/10">
                  💬
                </div>
                <h3 className="mt-3 text-sm font-semibold text-gray-900 dark:text-white">
                  No messages yet
                </h3>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 max-w-xs">
                  Be the first to share an update or send a message to this channel.
                </p>
              </div>
            )}

            {messages.map((message) => {
              const isOwn =
                Boolean(profile?.email) &&
                Boolean(message.sender?.email) &&
                message.sender?.email === profile?.email;
              const senderName = message.sender?.display_name || message.sender?.email || "Member";
              const senderLocation =
                message.sender?.barangay?.name ||
                message.sender?.assignedBarangays?.map((b) => b.name).join(", ");
              const initials = getInitials(message.sender?.display_name, message.sender?.email);
              const isHighlighted = highlightedMessageId === message.id;

              // Group reactions by emoji
              const reactionsGrouped = (message.reactions || []).reduce<
                Record<string, { count: number; hasMine: boolean; users: string[] }>
              >((acc, r) => {
                if (!acc[r.emoji]) {
                  acc[r.emoji] = { count: 0, hasMine: false, users: [] };
                }
                acc[r.emoji].count += 1;
                if (r.is_mine) acc[r.emoji].hasMine = true;
                const reactorName = r.user?.display_name || r.user?.email || (r.is_mine ? "You" : "User");
                if (reactorName && !acc[r.emoji].users.includes(reactorName)) {
                  acc[r.emoji].users.push(reactorName);
                }
                return acc;
              }, {});

              const isPickerOpen = activeReactionPickerId === message.id;

              return (
                <div
                  key={message.id}
                  id={`message-${message.id}`}
                  className={`group relative flex gap-3 transition-all duration-300 rounded-2xl p-1 ${
                    isOwn ? "flex-row-reverse" : "flex-row"
                  } ${isHighlighted ? "bg-amber-100/70 dark:bg-amber-900/30 ring-2 ring-amber-400" : ""}`}
                >
                  {/* Sender Avatar */}
                  {!isOwn && (
                    <div title={senderName} className="shrink-0 select-none">
                      {message.sender?.profile_image_url ? (
                        <img src={message.sender.profile_image_url} alt={senderName} className="h-9 w-9 rounded-full object-cover" />
                      ) : message.sender?.barangay?.seal_url ? (
                        <img src={message.sender.barangay.seal_url} alt={senderName} className="h-9 w-9 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-bold text-white shadow-xs">
                          {initials}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Message Bubble + Meta */}
                  <div className={`flex flex-col max-w-[75%] ${isOwn ? "items-end" : "items-start"}`}>
                    {/* Sender Header */}
                    {!isOwn && (
                      <div className="mb-1 flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                        <span className="font-semibold text-gray-900 dark:text-gray-200">
                          {senderName}
                        </span>
                        {activeRoom?.room_type === "municipality" && senderLocation && (
                          <span className="text-[11px] text-gray-400">· Brgy. {senderLocation}</span>
                        )}
                        <span className="text-[10px] text-gray-400">· {timeOnly(message.created_at)}</span>
                      </div>
                    )}

                    {/* Relative Container for Bubble & Floating Action Toolbar */}
                    <div className="relative group/bubble">
                      {/* Floating Action Toolbar (Hover on message) */}
                      <div
                        className={`absolute top-0 -translate-y-1/2 z-20 hidden group-hover/bubble:flex group-hover:flex items-center gap-1 rounded-full border border-gray-200 bg-white px-1.5 py-0.5 shadow-md dark:border-gray-700 dark:bg-gray-800 ${
                          isOwn ? "right-2" : "left-2"
                        }`}
                      >
                        {/* React Button (opens emoji palette) */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() =>
                              setActiveReactionPickerId((cur) => (cur === message.id ? null : message.id))
                            }
                            title="React with emoji"
                            className="reaction-trigger-btn flex h-7 w-7 items-center justify-center rounded-full text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700"
                          >
                            😊
                          </button>

                          {/* Quick Emoji Reaction Palette Popup */}
                          {isPickerOpen && (
                            <div
                              className={`reaction-picker-container absolute bottom-full mb-1 z-30 flex items-center gap-1 rounded-2xl border border-gray-200 bg-white p-1.5 shadow-xl dark:border-gray-700 dark:bg-gray-800 animate-in fade-in zoom-in duration-150 ${
                                isOwn ? "right-0" : "left-0"
                              }`}
                            >
                              {REACTION_PALETTE.map((emoji) => (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={() => toggleReaction(message, emoji)}
                                  className="flex h-8 w-8 items-center justify-center rounded-lg text-lg transition-transform hover:scale-125 hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Reply Button */}
                        <button
                          type="button"
                          onClick={() => handleReplyClick(message)}
                          title="Reply to message"
                          className="flex h-7 items-center gap-1 rounded-full px-2 text-xs font-medium text-gray-600 hover:bg-gray-100 hover:text-brand-600 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-brand-400"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a5 5 0 015 5v2m0 0l-4-4m4 4l4-4" />
                          </svg>
                          <span>Reply</span>
                        </button>
                        {/* Edit/Delete (owner or admins) */}
                        {(isOwn || profile?.role === 'Administrator' || profile?.role === 'MunicipalAccountant') && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingMessageId(message.id);
                                setBody(message.body);
                                setReplyingTo(null);
                                setTimeout(() => textareaRef.current?.focus(), 50);
                              }}
                              title="Edit message"
                              className="flex h-7 items-center gap-1 rounded-full px-2 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                            >
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                if (!confirm('Delete this message?')) return;
                                try {
                                  const response = await apiFetch(`/api/chat/messages/${message.id}`, { method: 'DELETE' });
                                  const data = await response.json();
                                  if (!response.ok) throw new Error(data.error || 'Unable to delete message.');
                                  setMessages((current) => current.filter((m) => m.id !== message.id));
                                } catch (err) {
                                  setError(err instanceof Error ? err.message : 'Unable to delete message.');
                                }
                              }}
                              title="Delete message"
                              className="flex h-7 items-center gap-1 rounded-full px-2 text-xs font-medium text-red-600 hover:bg-red-100"
                            >
                              <span>Delete</span>
                            </button>
                          </>
                        )}
                      </div>

                      {/* Message Bubble */}
                      <div
                        className={`rounded-2xl px-4 py-2.5 shadow-xs ${
                          isOwn
                            ? "bg-brand-500 text-white rounded-tr-xs"
                            : "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100 rounded-tl-xs"
                        }`}
                      >
                        {/* Quoted Reply Card (Clickable to jump) */}
                        {message.replyTo && (
                          <div
                            onClick={() => message.replyTo && scrollToMessage(message.replyTo.id)}
                            title="Click to view original message"
                            className={`group/quote mb-2 cursor-pointer rounded-lg border-l-3 px-2.5 py-1.5 text-xs transition-colors ${
                              isOwn
                                ? "border-white bg-white/15 text-white hover:bg-white/25"
                                : "border-brand-500 bg-black/5 text-gray-700 dark:bg-white/10 dark:text-gray-300 hover:bg-black/10 dark:hover:bg-white/15"
                            }`}
                          >
                            <div className="flex items-center gap-1 font-semibold opacity-90">
                              <svg className="h-3 w-3 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a5 5 0 015 5v2m0 0l-4-4m4 4l4-4" />
                              </svg>
                              <span>
                                {message.replyTo.sender?.display_name ||
                                  message.replyTo.sender?.email ||
                                  "Member"}
                              </span>
                            </div>
                            <p className="line-clamp-2 mt-0.5 opacity-80 break-words">
                              {message.replyTo.body}
                            </p>
                          </div>
                        )}

                        {/* Main Message Body */}
                        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.body}</p>
                      </div>
                    </div>

                    {/* Reactions Pills Display */}
                    {Object.keys(reactionsGrouped).length > 0 && (
                      <div
                        className={`mt-1.5 flex flex-wrap items-center gap-1 ${
                          isOwn ? "justify-end" : "justify-start"
                        }`}
                      >
                        {Object.entries(reactionsGrouped).map(([emoji, data]) => {
                          const tooltipText = data.users.join(", ");
                          return (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => toggleReaction(message, emoji)}
                              title={tooltipText}
                              className={`group/pill inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-all ${
                                data.hasMine
                                  ? "border-brand-400 bg-brand-50 font-semibold text-brand-700 dark:border-brand-500 dark:bg-brand-500/20 dark:text-brand-300 shadow-xs"
                                  : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                              }`}
                            >
                              <span>{emoji}</span>
                              <span className="text-[11px] font-medium">{data.count}</span>
                            </button>
                          );
                        })}

                        {/* Fast Add Reaction Button */}
                        <button
                          type="button"
                          onClick={() =>
                            setActiveReactionPickerId((cur) => (cur === message.id ? null : message.id))
                          }
                          title="Add reaction"
                          className="reaction-trigger-btn flex h-5 w-5 items-center justify-center rounded-full border border-gray-200 bg-white text-xs text-gray-400 hover:border-gray-300 hover:text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:hover:text-gray-200"
                        >
                          +
                        </button>
                      </div>
                    )}

                    {/* Own Message Timestamp */}
                    {isOwn && (
                      <span className="mt-1 text-[10px] text-gray-400" title={dateTime(message.created_at)}>
                        {timeOnly(message.created_at)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Composer Form */}
          <footer className="border-t border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            {/* Replying or Editing Banner */}
            {replyingTo && (
              <div className="mb-3 flex items-center justify-between rounded-xl border-l-4 border-brand-500 bg-brand-50/80 px-4 py-2.5 text-xs text-gray-800 dark:bg-brand-500/10 dark:text-gray-200 animate-in fade-in duration-150">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white">
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a5 5 0 015 5v2m0 0l-4-4m4 4l4-4" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-brand-700 dark:text-brand-300">
                      Replying to {replyingTo.sender?.display_name || replyingTo.sender?.email || "Member"}
                    </p>
                    <p className="truncate text-gray-600 dark:text-gray-400">{replyingTo.body}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCancelReply}
                  title="Cancel reply (Esc)"
                  className="ml-3 shrink-0 rounded-lg p-1 text-gray-500 hover:bg-gray-200/50 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-gray-200"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}

            {editingMessageId && (
              <div className="mb-3 flex items-center justify-between rounded-xl border-l-4 border-yellow-400 bg-yellow-50/80 px-4 py-2.5 text-xs text-gray-800 animate-in fade-in duration-150">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-yellow-400 text-white">✎</div>
                  <div className="min-w-0">
                    <p className="font-semibold text-yellow-800">Editing message</p>
                    <p className="truncate text-gray-600">Changes will update the original message.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setEditingMessageId(null); setBody(''); }}
                  title="Cancel edit (Esc)"
                  className="ml-3 shrink-0 rounded-lg p-1 text-gray-500 hover:bg-gray-200/50 hover:text-gray-700"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}

            {/* Input & Send Button */}
            <form onSubmit={sendMessage} className="flex items-end gap-3">
              <div className="relative flex-1">
                <textarea
                  ref={textareaRef}
                  value={body}
                  maxLength={2000}
                  onChange={(e) => setBody(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    replyingTo
                      ? `Write a reply to ${replyingTo.sender?.display_name || "message"}... (Enter to send, Shift+Enter for newline)`
                      : "Type a message... (Press Enter to send)"
                  }
                  rows={2}
                  className="w-full resize-none rounded-xl border border-gray-300 bg-gray-50/50 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500 dark:focus:border-brand-400"
                />
              </div>

              <button
                type="submit"
                disabled={!activeRoom || !body.trim() || sending}
                className="flex h-11 items-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Sending</span>
                  </>
                ) : (
                  <>
                    <span>Send</span>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </>
                )}
              </button>
            </form>

            {error && (
              <div className="mt-2 flex items-center justify-between rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-600 dark:bg-red-900/20 dark:text-red-400">
                <span>{error}</span>
                <button type="button" onClick={() => setError(null)} className="font-bold">
                  ✕
                </button>
              </div>
            )}
          </footer>
        </section>
      </div>
    </>
  );
}
