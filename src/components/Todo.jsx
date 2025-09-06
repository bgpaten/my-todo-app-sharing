// src/components/Todo.jsx
import React, { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

function Todo({ session }) {
  const [todos, setTodos] = useState([]);
  const [newTodoTitle, setNewTodoTitle] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getTodos();

    // Subscribe to real-time changes for personal todos
    const subscription = supabase
      .channel("public:todos")
      .on(
        "postgres_changes",
        {
          event: "*", // LISTEN to all events (INSERT, UPDATE, DELETE)
          schema: "public",
          table: "todos",
          filter: `user_id=eq.${session.user.id}`, // Only listen to changes for the current user
        },
        (payload) => {
          console.log("Change received!", payload);
          if (payload.eventType === "INSERT") {
            setTodos((prevTodos) => [...prevTodos, payload.new]);
          } else if (payload.eventType === "UPDATE") {
            setTodos((prevTodos) =>
              prevTodos.map((todo) =>
                todo.id === payload.old.id ? payload.new : todo
              )
            );
          } else if (payload.eventType === "DELETE") {
            setTodos((prevTodos) =>
              prevTodos.filter((todo) => todo.id !== payload.old.id)
            );
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
      .eq("user_id", session.user.id) // Explicitly filter for current user's todos
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching todos:", error.message);
    } else {
      setTodos(data);
    }
    setLoading(false);
  }

  async function addTodo(e) {
    e.preventDefault();
    if (!newTodoTitle.trim()) return;
    setLoading(true);
    const { error } = await supabase
      .from("todos")
      .insert([{ title: newTodoTitle, user_id: session.user.id }]);

    if (error) {
      console.error("Error adding todo:", error.message);
    } else {
      setNewTodoTitle("");
    }
    setLoading(false);
  }

  async function toggleTodoComplete(id, isComplete) {
    setLoading(true);
    const { error } = await supabase
      .from("todos")
      .update({ is_complete: !isComplete })
      .eq("id", id);

    if (error) {
      console.error("Error updating todo:", error.message);
    }
    setLoading(false);
  }

  async function deleteTodo(id) {
    setLoading(true);
    const { error } = await supabase.from("todos").delete().eq("id", id);

    if (error) {
      console.error("Error deleting todo:", error.message);
    }
    setLoading(false);
  }

  return (
    <div className="container mx-auto p-4">
      <h2 className="text-3xl font-bold mb-6 text-center">My Personal Todos</h2>

      <form onSubmit={addTodo} className="flex mb-6">
        <input
          type="text"
          placeholder="Add a new todo..."
          value={newTodoTitle}
          onChange={(e) => setNewTodoTitle(e.target.value)}
          className="flex-grow p-3 border border-gray-300 rounded-l-md
          focus:outline-none focus:ring-2 focus:ring-indigo-500"
          disabled={loading}
        />
        <button
          type="submit"
          className="bg-indigo-600 text-white p-3 rounded-r-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          disabled={loading}
        >
          Add Todo
        </button>
      </form>

      {loading && <p className="text-center text-gray-600">Loading todos...</p>}

      <ul className="bg-white shadow-md rounded-lg overflow-hidden">
        {todos.length === 0 && !loading ? (
          <li className="p-4 text-center text-gray-500">
            No todos yet. Add one!
          </li>
        ) : (
          todos.map((todo) => (
            <li
              key={todo.id}
              className="flex items-center justify-between p-4 border-b border-gray-200 last:border-b-0"
            >
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={todo.is_complete}
                  onChange={() => toggleTodoComplete(todo.id, todo.is_complete)}
                  className="h-5 w-5 text-indigo-600 rounded focus:ring-indigo-500"
                  disabled={loading}
                />
                <span
                  className={`ml-3 text-lg ${
                    todo.is_complete
                      ? "line-through text-gray-500"
                      : "text-gray-900"
                  }`}
                >
                  {todo.title}
                </span>
              </div>
              <button
                onClick={() => deleteTodo(todo.id)}
                className="text-red-500 hover:text-red-700 focus:outline-none"
                disabled={loading}
              >
                Delete
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

export default Todo;
