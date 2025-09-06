// src/components/SharedTodo.jsx
import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

const SharedTodo = ({ session }) => {
  const [todos, setTodos] = useState([]);
  const [newTodo, setNewTodo] = useState("");
  const [selectedTodo, setSelectedTodo] = useState(null);
  const [collaborators, setCollaborators] = useState([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [items, setItems] = useState([]);
  const [newItem, setNewItem] = useState("");

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
      .order("created_at", { ascending: true });
    if (!error) setItems(data);
  };

  const addSharedTodo = async () => {
    if (!newTodo.trim()) return;
    const { data } = await supabase
      .from("shared_todos")
      .insert([{ title: newTodo, owner_id: session.user.id }])
      .select();
    if (data) {
      setTodos([...todos, ...data]);
      setNewTodo("");
    }
  };

  const fetchCollaborators = async (todoId) => {
    const { data } = await supabase
      .from("collaborators")
      .select(
        `id, role, user:profiles!fk_collaborators_user(id, email, full_name)`
      )
      .eq("shared_todo_id", todoId);
    if (data) setCollaborators(data);
  };

  const selectTodo = async (todo) => {
    setSelectedTodo(todo);
    await fetchSharedTodoItems(todo.id);
    await fetchCollaborators(todo.id);
  };

  const inviteUser = async () => {
    if (!inviteEmail.trim() || !selectedTodo) return;

    // 🔍 cari user di profiles berdasarkan email
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .ilike("email", inviteEmail) // ganti eq jadi ilike
      .limit(1);

    if (profileError) {
      console.error("Error fetching profile:", profileError.message);
      return;
    }

    const profile = profiles?.[0];
    if (!profile) {
      console.error("User not found with email:", inviteEmail);
      return;
    }

    // 🚫 cek apakah user sudah jadi collaborator
    const { data: existing } = await supabase
      .from("collaborators")
      .select("id")
      .eq("shared_todo_id", selectedTodo.id)
      .eq("user_id", profile.id)
      .maybeSingle();

    if (existing) {
      console.warn("User already a collaborator");
      return;
    }

    // ✅ insert ke collaborators
    const { error: insertError } = await supabase.from("collaborators").insert([
      {
        shared_todo_id: selectedTodo.id,
        user_id: profile.id,
        role: "member",
      },
    ]);

    if (insertError) {
      console.error("Error inviting user:", insertError.message);
      return;
    }

    // 🔄 reset input & refresh
    setInviteEmail("");
    await fetchCollaborators(selectedTodo.id);
  };

  const addItem = async () => {
    if (!newItem.trim() || !selectedTodo) return;
    const { data } = await supabase
      .from("shared_todo_items")
      .insert([
        { title: newItem, is_complete: false, shared_todo_id: selectedTodo.id },
      ])
      .select();
    if (data) {
      setItems([...items, ...data]);
      setNewItem("");
    }
  };

  const toggleItem = async (itemId, currentStatus) => {
    await supabase
      .from("shared_todo_items")
      .update({ is_complete: !currentStatus })
      .eq("id", itemId);
    setItems(
      items.map((item) =>
        item.id === itemId ? { ...item, is_complete: !currentStatus } : item
      )
    );
  };

  const deleteItem = async (itemId) => {
    await supabase.from("shared_todo_items").delete().eq("id", itemId);
    setItems(items.filter((item) => item.id !== itemId));
  };

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

            {/* Items */}
            <div>
              <h3 className="font-semibold">Items</h3>
              <ul className="space-y-2 mt-2">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className="flex justify-between items-center p-2 bg-base-200 rounded"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={item.is_complete}
                        onChange={() => toggleItem(item.id, item.is_complete)}
                        className="checkbox checkbox-sm"
                      />
                      <span
                        className={`${
                          item.is_complete ? "line-through opacity-60" : ""
                        }`}
                      >
                        {item.title}
                      </span>
                    </div>
                    <button
                      onClick={() => deleteItem(item.id)}
                      className="btn btn-xs btn-error"
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
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
