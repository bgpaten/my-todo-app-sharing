// src/components/SharedTodo.jsx
import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { Notyf } from "notyf";
import "notyf/notyf.min.css";
import { FaTrash } from "react-icons/fa";

const notyf = new Notyf({
  duration: 3000,
  position: { x: "right", y: "top" },
});

const SharedTodo = ({ session }) => {
  const [todos, setTodos] = useState([]);
  const [newTodo, setNewTodo] = useState("");
  const [selectedTodo, setSelectedTodo] = useState(null);
  const [collaborators, setCollaborators] = useState([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [items, setItems] = useState([]);
  const [newItem, setNewItem] = useState("");
  const [openDate, setOpenDate] = useState(null);

  const getSharedTodos = async () => {
    const { data, error } = await supabase
      .from("shared_todos")
      .select("id, title, owner_id, created_at")
      .order("created_at", { ascending: true });
    if (!error) setTodos(data);
  };

  const fetchSharedTodoItems = async (sharedTodoId) => {
    const { data, error } = await supabase
      .from("shared_todo_items")
      .select("id, title, is_complete, shared_todo_id, created_at")
      .eq("shared_todo_id", sharedTodoId)
      .order("created_at", { ascending: false });
    if (!error) {
      setItems(data);
      if (data.length > 0) {
        const latestDate = new Date(data[0].created_at).toLocaleDateString();
        setOpenDate(latestDate); // default buka tanggal terbaru
      }
    }
  };

  const addSharedTodo = async () => {
    if (!newTodo.trim()) return;
    const { data, error } = await supabase
      .from("shared_todos")
      .insert([{ title: newTodo, owner_id: session.user.id }])
      .select();
    if (error) return notyf.error(error.message);
    if (data) {
      setTodos([...todos, ...data]);
      setNewTodo("");
      notyf.success("Shared todo added!");
    }
  };

  const fetchCollaborators = async (todoId) => {
    const { data, error } = await supabase
      .from("collaborators")
      .select(
        `id, role, user:profiles!fk_collaborators_user(id, email, full_name)`
      )
      .eq("shared_todo_id", todoId);
    if (!error) setCollaborators(data);
  };

  const selectTodo = async (todo) => {
    setSelectedTodo(todo);
    await fetchSharedTodoItems(todo.id);
    await fetchCollaborators(todo.id);
  };

  const inviteUser = async () => {
    if (!inviteEmail.trim() || !selectedTodo) return;

    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .ilike("email", inviteEmail)
      .limit(1);

    if (profileError) return notyf.error(profileError.message);

    const profile = profiles?.[0];
    if (!profile) return notyf.error("User not found!");

    const { data: existing } = await supabase
      .from("collaborators")
      .select("id")
      .eq("shared_todo_id", selectedTodo.id)
      .eq("user_id", profile.id)
      .maybeSingle();

    if (existing) return notyf.error("User already a collaborator!");

    const { error: insertError } = await supabase.from("collaborators").insert([
      {
        shared_todo_id: selectedTodo.id,
        user_id: profile.id,
        role: "member",
      },
    ]);

    if (insertError) return notyf.error(insertError.message);

    setInviteEmail("");
    await fetchCollaborators(selectedTodo.id);
    notyf.success("User invited!");
  };

  const addItem = async () => {
    if (!newItem.trim() || !selectedTodo) return;
    const { data, error } = await supabase
      .from("shared_todo_items")
      .insert([
        { title: newItem, is_complete: false, shared_todo_id: selectedTodo.id },
      ])
      .select();
    if (error) return notyf.error(error.message);
    if (data) {
      setItems([data[0], ...items]);
      setNewItem("");
      notyf.success("Item added!");
    }
  };

  const toggleItem = async (itemId, currentStatus, title) => {
    try {
      const { error } = await supabase
        .from("shared_todo_items")
        .update({ is_complete: !currentStatus })
        .eq("id", itemId);

      if (error) {
        notyf.error(error.message);
        return;
      }

      // Gunakan callback agar state selalu terbaru
      setItems((prevItems) =>
        prevItems.map((item) =>
          item.id === itemId ? { ...item, is_complete: !currentStatus } : item
        )
      );

      // Alert setelah update sukses
      if (!currentStatus) {
        notyf.success(`🎉 Selamat! Kamu sudah menyelesaikan: "${title}"`);
      } else {
        notyf.success(`Todo "${title}" dikembalikan ke belum selesai.`);
      }
    } catch (err) {
      notyf.error("Terjadi kesalahan saat mengupdate todo");
      console.error(err);
    }
  };

  const deleteItem = async (itemId) => {
    const { error } = await supabase
      .from("shared_todo_items")
      .delete()
      .eq("id", itemId);
    if (error) return notyf.error(error.message);

    setItems(items.filter((item) => item.id !== itemId));
    notyf.success("Item deleted!");
  };

  // 🔹 Group items per tanggal
  const groupedItems = items.reduce((groups, item) => {
    const date = new Date(item.created_at).toLocaleDateString();
    if (!groups[date]) groups[date] = [];
    groups[date].push(item);
    return groups;
  }, {});

  // 🔹 Urutkan tanggal terbaru ke atas
  const sortedDates = Object.keys(groupedItems).sort(
    (a, b) => new Date(b) - new Date(a)
  );

  useEffect(() => {
    getSharedTodos();
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* List Todos */}
      <div className="card bg-base-100 shadow-md">
        <div className="card-body">
          <h2 className="card-title">Shared Todos</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={newTodo}
              onChange={(e) => setNewTodo(e.target.value)}
              placeholder="New shared todo..."
              className="input input-bordered input-sm flex-1"
            />
            <button onClick={addSharedTodo} className="btn btn-primary btn-sm">
              Add
            </button>
          </div>
          <div className="mt-4 space-y-2">
            {todos.map((todo) => (
              <div
                key={todo.id}
                onClick={() => selectTodo(todo)}
                className={`p-3 rounded-lg cursor-pointer border transition
        ${
          selectedTodo?.id === todo.id
            ? "bg-primary text-white border-primary"
            : "bg-base-200 hover:bg-base-300 border-base-300"
        }`}
              >
                {todo.title}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Detail Todo */}
      {selectedTodo && (
        <div className="lg:col-span-2 card bg-base-100 shadow-md">
          <div className="card-body">
            <h2 className="card-title">
              {selectedTodo.title}{" "}
              <div className="badge badge-primary">Details</div>
            </h2>

            {/* Items Accordion */}
            <div>
              <h3 className="font-semibold">Items</h3>
              <div className="mt-3 space-y-2">
                {sortedDates.map((date) => (
                  <div
                    key={date}
                    className="collapse collapse-arrow bg-base-200"
                  >
                    <input
                      type="checkbox"
                      checked={openDate === date}
                      onChange={() =>
                        setOpenDate(openDate === date ? null : date)
                      }
                    />
                    <div className="collapse-title font-medium">{date}</div>
                    <div className="collapse-content">
                      <ul className="space-y-2">
                        {groupedItems[date].map((item) => (
                          <li
                            key={item.id}
                            className="flex justify-between items-center p-2 bg-base-100 rounded"
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={item.is_complete}
                                onChange={() =>
                                  toggleItem(
                                    item.id,
                                    item.is_complete,
                                    item.title
                                  )
                                }
                                className="checkbox checkbox-sm"
                              />
                              <span
                                className={`${
                                  item.is_complete
                                    ? "line-through opacity-60"
                                    : ""
                                }`}
                              >
                                {item.title}
                              </span>
                            </div>
                            <button
                              onClick={() => deleteItem(item.id)}
                              className="btn btn-xs btn-error"
                            >
                              <FaTrash className="w-4 h-4" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>

              {/* Tambah Item */}
              <div className="flex gap-2 mt-3">
                <input
                  type="text"
                  value={newItem}
                  onChange={(e) => setNewItem(e.target.value)}
                  placeholder="Add new item..."
                  className="input input-bordered input-sm flex-1"
                />
                <button onClick={addItem} className="btn btn-success btn-sm">
                  Add
                </button>
              </div>
            </div>

            {/* Collaborators */}
            <div className="mt-6">
              <h3 className="font-semibold">Collaborators</h3>
              <ul className="mt-2 space-y-1">
                {collaborators.map((col) => (
                  <li key={col.id} className="flex items-center gap-2">
                    <span className="badge badge-ghost">{col.user?.email}</span>
                    <span className="badge badge-outline">{col.role}</span>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2 mt-3">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="Invite by email..."
                  className="input input-bordered input-sm flex-1"
                />
                <button onClick={inviteUser} className="btn btn-info btn-sm">
                  Invite
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SharedTodo;
