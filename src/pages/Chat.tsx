import { FormEvent, useCallback, useEffect, useState } from "react";
import PageMeta from "../components/common/PageMeta";
import { useAuth } from "../context/AuthContext";
import { useApi } from "../lib/api";

type ChatRoom = { id: string; room_type: "municipality" | "barangay"; barangay_id?: number; name: string; description: string };
type ChatReaction = { id: number; user_id: number; emoji: string; is_mine?: boolean };
type ChatMessage = { id: number; body: string; created_at: string; sender_id: number; sender?: { display_name?: string | null; email?: string | null; barangay?: { name: string } | null; assignedBarangays?: Array<{ name: string }> }; replyTo?: { id: number; body: string; sender?: { display_name?: string | null; email?: string | null } } | null; reactions?: ChatReaction[] };

const reactionOptions = ["👍", "❤️", "✅"];
const dateTime = (value: string) => new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

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

  const loadMessages = useCallback(async (room: ChatRoom, showLoading = false) => {
    if (showLoading) setLoading(true);
    const url = room.room_type === "municipality" ? "/api/chat/rooms/municipality" : `/api/chat/rooms/barangay/${room.barangay_id}`;
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
  }, [apiFetch]);

  useEffect(() => {
    apiFetch("/api/chat/rooms").then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load chat rooms.");
      const availableRooms = data.rooms || [];
      setRooms(availableRooms);
      setActiveRoom(availableRooms[0] || null);
    }).catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Unable to load chat rooms.")).finally(() => setLoading(false));
  }, [apiFetch]);

  useEffect(() => {
    if (!activeRoom) return;
    loadMessages(activeRoom, true);
    const timer = window.setInterval(() => loadMessages(activeRoom), 10000);
    return () => window.clearInterval(timer);
  }, [activeRoom, loadMessages]);

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();
    if (!activeRoom || !body.trim() || sending) return;
    setSending(true);
    try {
      const response = await apiFetch("/api/chat/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ room_type: activeRoom.room_type, barangay_id: activeRoom.barangay_id, reply_to_id: replyingTo?.id, body }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to send message.");
      setMessages((current) => [...current, data.message]);
      setBody("");
      setReplyingTo(null);
      setError(null);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Unable to send message.");
    } finally { setSending(false); }
  };

  const toggleReaction = async (message: ChatMessage, emoji: string) => {
    try {
      const response = await apiFetch(`/api/chat/messages/${message.id}/reactions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ emoji }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to react to this message.");
      if (activeRoom) await loadMessages(activeRoom);
    } catch (reactionError) { setError(reactionError instanceof Error ? reactionError.message : "Unable to react to this message."); }
  };

  return <>
    <PageMeta title="Messages | E-Procurement" description="Municipality and barangay group messaging." />
    <div className="mx-auto flex h-[calc(100vh-11rem)] max-w-6xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-white/[0.03]">
      <aside className="w-72 shrink-0 border-r border-gray-200 dark:border-gray-800"><div className="border-b border-gray-200 p-5 dark:border-gray-800"><h1 className="text-lg font-semibold text-gray-900 dark:text-white">Messages</h1><p className="mt-1 text-sm text-gray-500">Your municipality and barangay rooms.</p></div><div className="space-y-1 overflow-y-auto p-3">{rooms.map((room) => <button key={room.id} onClick={() => { setActiveRoom(room); setReplyingTo(null); }} className={`w-full rounded-xl px-3 py-3 text-left transition ${activeRoom?.id === room.id ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300" : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5"}`}><span className="block text-sm font-medium">{room.name}</span><span className="mt-1 block text-xs text-gray-500">{room.description}</span></button>)}</div></aside>
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-gray-200 p-5 dark:border-gray-800"><h2 className="font-semibold text-gray-900 dark:text-white">{activeRoom?.name || "Messages"}</h2><p className="mt-1 text-sm text-gray-500">{activeRoom?.description}</p></header>
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {loading && <p className="text-sm text-gray-500">Loading messages...</p>}
          {!loading && !messages.length && <p className="text-sm text-gray-500">No messages yet. Start the conversation.</p>}
          {messages.map((message) => {
            const own = message.sender?.email && message.sender.email === profile?.email;
            const senderName = message.sender?.display_name || message.sender?.email || "Member";
            const senderLocation = message.sender?.barangay?.name || message.sender?.assignedBarangays?.map((barangay) => barangay.name).join(", ");
            const reactions = Object.entries((message.reactions || []).reduce<Record<string, ChatReaction[]>>((groups, reaction) => ({ ...groups, [reaction.emoji]: [...(groups[reaction.emoji] || []), reaction] }), {}));
            return <div key={message.id} className={`max-w-[80%] ${own ? "ml-auto" : ""}`}>
              <div className={`rounded-2xl px-4 py-3 ${own ? "bg-brand-500 text-white" : "bg-gray-100 text-gray-800 dark:bg-white/10 dark:text-gray-100"}`}><div className="mb-1 text-xs font-semibold opacity-80">{own ? "You" : senderName}{activeRoom?.room_type === "municipality" && senderLocation ? ` · Barangay ${senderLocation}` : ""}</div>{message.replyTo && <div className={`mb-2 rounded-lg border-l-2 px-2 py-1 text-xs ${own ? "border-white/60 bg-white/10" : "border-brand-400 bg-white/50 dark:bg-white/5"}`}><span className="font-semibold">{message.replyTo.sender?.display_name || message.replyTo.sender?.email || "Member"}</span><p className="truncate">{message.replyTo.body}</p></div>}<p className="whitespace-pre-wrap break-words text-sm">{message.body}</p></div>
              <div className={`mt-1 flex flex-wrap items-center gap-1 ${own ? "justify-end" : ""}`}>{reactions.map(([emoji, items]) => <button key={emoji} onClick={() => toggleReaction(message, emoji)} className={`rounded-full border px-2 py-0.5 text-xs ${items.some((reaction) => reaction.is_mine) ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300" : "border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-300"}`}>{emoji} {items.length}</button>)}{reactionOptions.filter((emoji) => !reactions.some(([reactionEmoji]) => reactionEmoji === emoji)).map((emoji) => <button key={emoji} onClick={() => toggleReaction(message, emoji)} className="rounded-full border border-gray-200 px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-white/5">{emoji}</button>)}<button onClick={() => setReplyingTo(message)} className="px-2 py-0.5 text-xs font-medium text-brand-600 hover:underline dark:text-brand-400">Reply</button></div>
              <p className={`mt-1 text-xs text-gray-500 ${own ? "text-right" : ""}`}>{dateTime(message.created_at)}</p>
            </div>;
          })}
        </div>
        <form onSubmit={sendMessage} className="border-t border-gray-200 p-4 dark:border-gray-800">{replyingTo && <div className="mb-2 flex items-center justify-between rounded-lg border-l-2 border-brand-500 bg-brand-50 px-3 py-2 text-xs text-gray-700 dark:bg-brand-500/10 dark:text-gray-200"><span className="truncate">Replying to {replyingTo.sender?.display_name || replyingTo.sender?.email || "Member"}: {replyingTo.body}</span><button type="button" onClick={() => setReplyingTo(null)} className="ml-3 font-semibold text-brand-600">Cancel</button></div>}<div className="flex gap-3"><textarea value={body} maxLength={2000} onChange={(event) => setBody(event.target.value)} placeholder={replyingTo ? "Write a reply..." : "Write a message..."} rows={2} className="min-h-12 flex-1 resize-none rounded-xl border border-gray-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-500 dark:border-gray-700" /><button disabled={!activeRoom || !body.trim() || sending} className="rounded-xl bg-brand-500 px-5 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">{sending ? "Sending..." : "Send"}</button></div>{error && <p className="mt-2 text-sm text-error-500">{error}</p>}</form>
      </section>
    </div>
  </>;
}
