import { useCallback, useEffect, useState } from "react";
import { Dropdown } from "../ui/dropdown/Dropdown";
import { DropdownItem } from "../ui/dropdown/DropdownItem";
import { useApi } from "../../lib/api";

type Notification = { id: number; title: string; message: string; link?: string | null; is_read: boolean; created_at?: string | null };

function timeAgo(value?: string | null) {
  const timestamp = value ? new Date(value).getTime() : Number.NaN;
  if (!Number.isFinite(timestamp)) return "Recently";
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
  return `${Math.floor(seconds / 86400)} day(s) ago`;
}

export default function NotificationDropdown() {
  const apiFetch = useApi();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const loadNotifications = useCallback(async () => {
    try {
      const res = await apiFetch("/api/notifications");
      const data = await res.json();
      if (res.ok) setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
    } catch (error) {
      console.warn("Unable to load notifications", error);
    }
  }, [apiFetch]);

  useEffect(() => {
    loadNotifications();
    const interval = window.setInterval(loadNotifications, 30000);
    return () => window.clearInterval(interval);
  }, [loadNotifications]);

  const markRead = async (notification: Notification) => {
    if (!notification.is_read) {
      await apiFetch(`/api/notifications/${notification.id}/read`, { method: "PATCH" });
      setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, is_read: true } : item));
    }
    setIsOpen(false);
  };

  const unreadCount = notifications.filter((notification) => !notification.is_read).length;

  return (
    <div className="relative">
      <button className="relative flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white" onClick={() => { setIsOpen((open) => !open); loadNotifications(); }} aria-label="Notifications">
        {unreadCount > 0 && <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white">{unreadCount > 9 ? "9+" : unreadCount}</span>}
        <svg className="fill-current" width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" clipRule="evenodd" d="M10.75 2.29248C10.75 1.87827 10.4143 1.54248 10 1.54248C9.58583 1.54248 9.25004 1.87827 9.25004 2.29248V2.83613C6.08266 3.20733 3.62504 5.9004 3.62504 9.16748V14.4591H3.33337C2.91916 14.4591 2.58337 14.7949 2.58337 15.2091C2.58337 15.6234 2.91916 15.9591 3.33337 15.9591H16.6667C17.0809 15.9591 17.4167 15.6234 17.4167 15.2091C17.4167 14.7949 17.0809 14.4591 16.6667 14.4591H16.375V9.16748C16.375 5.9004 13.9174 3.20733 10.75 2.83613V2.29248Z" fill="currentColor" /></svg>
      </button>
      <Dropdown isOpen={isOpen} onClose={() => setIsOpen(false)} className="absolute right-0 mt-[17px] flex max-h-[min(480px,calc(100vh-6rem))] w-[calc(100vw-1.5rem)] max-w-[361px] flex-col rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark">
        <div className="mb-3 flex items-center justify-between border-b border-gray-100 pb-3 dark:border-gray-700"><h5 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Notifications</h5><button onClick={() => setIsOpen(false)} className="text-sm text-gray-500">Close</button></div>
        <ul className="flex h-auto flex-col overflow-y-auto custom-scrollbar">
          {notifications.length === 0 ? <li className="p-4 text-center text-sm text-gray-500">No notifications yet.</li> : notifications.map((notification) => <li key={notification.id}><DropdownItem to={notification.link || "/"} onItemClick={() => markRead(notification)} className={`flex gap-3 border-b border-gray-100 p-3 hover:bg-gray-100 dark:border-gray-800 dark:hover:bg-white/5 ${notification.is_read ? "" : "bg-brand-50/70 dark:bg-brand-500/10"}`}><span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-600 dark:bg-brand-500/20">!</span><span className="block"><span className="block text-sm font-semibold text-gray-800 dark:text-white">{notification.title}</span><span className="mt-1 block text-sm text-gray-500 dark:text-gray-400">{notification.message}</span><span className="mt-1 block text-xs text-gray-400">{timeAgo(notification.created_at)}</span></span></DropdownItem></li>)}
        </ul>
      </Dropdown>
    </div>
  );
}
