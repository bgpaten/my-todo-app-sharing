import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { FaBell } from "react-icons/fa";

const Notifikasi = ({ session }) => {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentSession, setCurrentSession] = useState(session);

  // Main fetch function - Simple and reliable approach
  const fetchNotifications = async () => {
    if (!currentSession?.user) {
      //   console.log("❌ No session available");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      //   console.log(
      //     "🔍 Using simple query approach for user:",
      //     currentSession.user.id
      //   );

      // Step 1: Ambil collaborators basic (hanya yang belum dibaca untuk badge)
      const { data: collaborators, error: colError } = await supabase
        .from("collaborators")
        .select("id, created_at, shared_todo_id, is_read")
        .eq("user_id", currentSession.user.id)
        .order("created_at", { ascending: false });

      //   console.log("🔍 Collaborators:", collaborators);

      if (colError) {
        // console.error("❌ Error fetching collaborators:", colError);
        setNotifications([]);
        return;
      }

      if (!collaborators || collaborators.length === 0) {
        // console.log("ℹ️ No collaborators found");
        setNotifications([]);
        return;
      }

      // Step 2: Ambil shared_todos
      const sharedTodoIds = collaborators.map((c) => c.shared_todo_id);
      const { data: sharedTodos, error: todoError } = await supabase
        .from("shared_todos")
        .select("id, title, owner_id")
        .in("id", sharedTodoIds);

      //   console.log("🔍 Shared todos:", sharedTodos);

      if (todoError) {
        // console.error("❌ Error fetching shared todos:", todoError);
        setNotifications([]);
        return;
      }

      // Step 3: Ambil owner profiles
      const ownerIds = [...new Set(sharedTodos.map((t) => t.owner_id))];
      //   console.log("🔍 Owner IDs to search:", ownerIds);

      const { data: owners, error: ownerError } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .in("id", ownerIds);

      //   console.log("🔍 Owners query result:", { owners, ownerError });
      //   console.log("🔍 Owners data:", owners);

      if (ownerError) {
        // console.error("❌ Error fetching owners:", ownerError);
      }

      // Debug: Cek apakah ada data di profiles sama sekali
      const { data: allProfiles, error: profileError } = await supabase
        .from("profiles")
        .select("id, email, full_name");

      //   console.log("🔍 All profiles in database:", allProfiles);
      //   console.log("🔍 Profile query error:", profileError);

      // Step 4: Map semua data
      const ownersMap = Object.fromEntries(
        (owners || []).map((o) => [o.id, o])
      );
      const todosMap = Object.fromEntries(sharedTodos.map((t) => [t.id, t]));

      const notifications = collaborators.map((col) => {
        const todo = todosMap[col.shared_todo_id];
        const owner = ownersMap[todo?.owner_id];
        const ownerName = owner?.full_name || owner?.email || "Tidak diketahui";

        return {
          id: col.id,
          message: `📩 Kamu diinvite ke "${
            todo?.title || "Todo"
          }" oleh ${ownerName}`,
          createdAt: col.created_at,
          sharedTodoId: col.shared_todo_id,
          // Handle jika field is_read belum ada di database
          isRead: col.is_read !== undefined ? col.is_read : false,
        };
      });

      //   console.log("✅ Final notifications:", notifications);
      setNotifications(notifications);
    } catch (err) {
      //   console.error("❌ Unexpected error:", err);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationClick = async (notification) => {
    // console.log("🔍 Notification clicked:", notification);

    try {
      // Mark sebagai read jika belum dibaca
      if (!notification.isRead) {
        const { error } = await supabase
          .from("collaborators")
          .update({ is_read: true })
          .eq("id", notification.id);

        if (error) {
          //   console.error("❌ Error marking notification as read:", error);
        } else {
          //   console.log("✅ Notification marked as read");

          // Update local state untuk mengurangi badge count
          setNotifications((prev) =>
            prev.map((notif) =>
              notif.id === notification.id ? { ...notif, isRead: true } : notif
            )
          );
        }
      }

      // TODO: Tambahkan logic untuk redirect ke shared todo
      // window.location.href = `/shared-todos/${notification.sharedTodoId}`;
    } catch (err) {
      //   console.error("❌ Error handling notification click:", err);
    }
  };

  useEffect(() => {
    // console.log("🔍 Notifikasi useEffect triggered");
    // console.log("🔍 Session prop:", session);
    // console.log("🔍 Session user:", session?.user);
    // console.log("🔍 Session user id:", session?.user?.id);

    // Jika session prop tidak ada, coba ambil langsung dari supabase
    const getSession = async () => {
      if (!session) {
        // console.log("🔍 No session prop, getting from Supabase...");
        const {
          data: { session: currentSession },
          error,
        } = await supabase.auth.getSession();
        // console.log("🔍 Session from Supabase:", currentSession);
        setCurrentSession(currentSession);
      } else {
        setCurrentSession(session);
      }
    };

    getSession();
  }, [session]);

  useEffect(() => {
    if (currentSession) {
      //   console.log("🔍 Current session available, fetching notifications...");
      fetchNotifications();
    }
  }, [currentSession]);

  if (loading) {
    return (
      <div className="relative inline-block">
        <FaBell size={24} className="text-gray-400 animate-pulse" />
      </div>
    );
  }

  // Hitung notifikasi yang belum dibaca untuk badge - dengan safe fallback
  const unreadCount = notifications
    ? notifications.filter((notif) => !notif.isRead).length
    : 0;

  return (
    <div className="relative inline-block">
      {/* Icon Bell */}
      <button
        className="relative text-gray-700 hover:text-gray-900 focus:outline-none"
        onClick={() => setOpen(!open)}
      >
        <FaBell size={24} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full px-1">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Notifikasi */}
      {open && (
        <div className="absolute right-0 mt-2 w-72 rounded-lg shadow-lg border border-base-300 bg-base-100 z-50">
          <div className="p-3 font-semibold border-b border-base-300 text-base-content">
            Notifikasi ({notifications.length})
          </div>
          <ul className="max-h-60 overflow-y-auto">
            {notifications.length > 0 ? (
              notifications.map((notif) => (
                <li
                  key={notif.id}
                  className={`px-3 py-2 text-sm cursor-pointer border-b border-gray-100 last:border-b-0 ${
                    notif.isRead
                      ? "hover:bg-gray-50 text-gray-600"
                      : "hover:bg-blue-50 bg-blue-25 font-medium text-white-800"
                  }`}
                  onClick={() => handleNotificationClick(notif)}
                >
                  <div className="mb-1 flex items-start justify-between">
                    <span className="flex-1">{notif.message}</span>
                    {!notif.isRead && (
                      <span className="ml-2 w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1"></span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(notif.createdAt).toLocaleString("id-ID")}
                  </div>
                </li>
              ))
            ) : (
              <li className="px-3 py-2 text-sm text-gray-500">
                Tidak ada notifikasi
              </li>
            )}
          </ul>

          {/* Debug info - hapus di production */}
          <div className="p-2 text-xs text-gray-400 border-t">
            Debug: {notifications.length} total, {unreadCount} unread
          </div>
        </div>
      )}
    </div>
  );
};

export default Notifikasi;
