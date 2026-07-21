import { resolveMediaUrl } from "@/utils/media";

const chatThreadsKey = "flix_chat_threads";

export const createChatThreadFromUser = (user) => ({
  id: `user-${user.id_user}`,
  userId: user.id_user,
  name: user.username || user.email || "User FLIX",
  lastMessage: user.lastMessage || "Mulai obrolan tentang film",
  time: user.time || "Sekarang",
  unreadCount: Number(user.unreadCount || 0),
  isOnline: Boolean(user.isOnline),
  isPremium: Boolean(user.is_premium || user.isPremium),
  avatarUrl: resolveMediaUrl(user.profile_image_url) || user.avatarUrl || "",
});

export const readChatThreads = () => {
  try {
    const storedThreads = JSON.parse(localStorage.getItem(chatThreadsKey));
    return Array.isArray(storedThreads) ? storedThreads : [];
  } catch {
    return [];
  }
};

export const upsertChatThread = (thread) => {
  const currentThreads = readChatThreads();
  const nextThreads = [
    thread,
    ...currentThreads.filter((item) => String(item.id) !== String(thread.id)),
  ].slice(0, 20);

  localStorage.setItem(chatThreadsKey, JSON.stringify(nextThreads));
  return nextThreads;
};

export const openChatThread = (thread) => {
  const threads = upsertChatThread(thread);

  window.dispatchEvent(
    new CustomEvent("flix:open-chat", {
      detail: {
        thread,
        threads,
      },
    }),
  );
};
