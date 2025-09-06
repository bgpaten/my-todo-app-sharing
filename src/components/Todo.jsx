import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { Notyf } from "notyf";
import "notyf/notyf.min.css";
import { FaTrash } from "react-icons/fa";

const notyf = new Notyf({
  duration: 3000,
  position: { x: "right", y: "top" },
});

function Todo({ session }) {
  const [todos, setTodos] = useState([]);
  const [newTodoTitle, setNewTodoTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [openDate, setOpenDate] = useState(""); // untuk simpan accordion terbuka

  useEffect(() => {
    getTodos();

    const subscription = supabase
      .channel("public:todos")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "todos",
          filter: `user_id=eq.${session.user.id}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setTodos((prev) =>
              prev.some((t) => t.id === payload.new.id)
                ? prev
                : [...prev, payload.new]
            );
          } else if (payload.eventType === "UPDATE") {
            setTodos((prev) =>
              prev.map((t) => (t.id === payload.old.id ? payload.new : t))
            );
          } else if (payload.eventType === "DELETE") {
            setTodos((prev) => prev.filter((t) => t.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [session]);

  async function getTodos() {
    setLoading(true);
    const { data, error } = await supabase
      .from("todos")
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: true });

    if (!error) {
      setTodos(data);

      // set accordion terbuka ke tanggal hari ini
      const today = new Date().toLocaleDateString("id-ID", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      setOpenDate(today);
    } else {
      notyf.error("Error fetching todos");
    }
    setLoading(false);
  }

  async function addTodo(e) {
    e.preventDefault();
    if (!newTodoTitle.trim()) return;
    setLoading(true);

    const { data, error } = await supabase
      .from("todos")
      .insert([{ title: newTodoTitle, user_id: session.user.id }])
      .select()
      .single();

    if (!error) {
      setTodos((prev) =>
        prev.some((t) => t.id === data.id) ? prev : [...prev, data]
      );
      setNewTodoTitle("");
      notyf.success("Todo added!");
    } else {
      notyf.error("Error adding todo");
    }
    setLoading(false);
  }

  async function toggleTodoComplete(id, isComplete, title) {
    // Optimistic update
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, is_complete: !isComplete } : t))
    );

    const { error } = await supabase
      .from("todos")
      .update({ is_complete: !isComplete })
      .eq("id", id);

    if (error) {
      notyf.error("Error updating todo");
      // rollback
      setTodos((prev) =>
        prev.map((t) => (t.id === id ? { ...t, is_complete: isComplete } : t))
      );
    } else {
      if (!isComplete) {
        notyf.success(`🎉 Selamat! Kamu sudah menyelesaikan: "${title}"`);
      } else {
        notyf.success(`Todo "${title}" dikembalikan ke belum selesai.`);
      }
    }
  }

  async function deleteTodo(id) {
    setLoading(true);
    const { error } = await supabase.from("todos").delete().eq("id", id);

    if (!error) {
      setTodos((prev) => prev.filter((t) => t.id !== id));
      notyf.success("Todo deleted!");
    } else {
      notyf.error("Error deleting todo");
    }
    setLoading(false);
  }

  // Kelompokkan todo berdasarkan tanggal created_at
  const groupedTodos = todos.reduce((groups, todo) => {
    const date = new Date(todo.created_at).toLocaleDateString("id-ID", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    if (!groups[date]) groups[date] = [];
    groups[date].push(todo);
    return groups;
  }, {});

  // Urutkan tanggal terbaru ke atas
  const sortedDates = Object.keys(groupedTodos).sort(
    (a, b) => new Date(b) - new Date(a)
  );

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Todo List</h1>

      {/* Input */}
      <form onSubmit={addTodo} className="flex gap-2 mb-6">
        <input
          type="text"
          placeholder="Tambah todo baru..."
          className="input input-bordered flex-1"
          value={newTodoTitle}
          onChange={(e) => setNewTodoTitle(e.target.value)}
          disabled={loading}
        />
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? "Loading..." : "Add"}
        </button>
      </form>

      {/* Accordion per tanggal */}
      <div className="space-y-4">
        {sortedDates.map((date) => (
          <div
            key={date}
            className="collapse collapse-arrow border border-base-300 bg-base-100 rounded-box"
          >
            <input
              type="checkbox"
              checked={openDate === date}
              onChange={() => setOpenDate(openDate === date ? "" : date)}
              readOnly
            />
            <div className="collapse-title text-lg font-semibold">{date}</div>
            <div className="collapse-content">
              <ul className="space-y-2">
                {groupedTodos[date].map((todo) => (
                  <li
                    key={todo.id}
                    className="flex justify-between items-center p-3 bg-base-200 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={todo.is_complete}
                        onChange={() =>
                          toggleTodoComplete(
                            todo.id,
                            todo.is_complete,
                            todo.title
                          )
                        }
                        className="checkbox checkbox-primary"
                      />
                      <span
                        className={
                          todo.is_complete
                            ? "line-through text-gray-500"
                            : "text-white-900"
                        }
                      >
                        {todo.title}
                      </span>
                    </div>
                    <button
                      className="btn btn-sm btn-error"
                      onClick={() => deleteTodo(todo.id)}
                      disabled={loading}
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
    </div>
  );
}

export default Todo;
