// src/App.jsx
import React, { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import "./index.css";
import Auth from "./components/Auth";
import Account from "./components/Account";
import Todo from "./components/Todo";
import SharedTodo from "./components/SharedTodo";

function App() {
  const [session, setSession] = useState(null);
  const [view, setView] = useState("personal");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-base-200">
      {!session ? (
        <Auth />
      ) : (
        <>
          {/* Navbar */}
          <div className="navbar bg-base-100 shadow-md px-4 sm:px-6 flex-wrap gap-2">
            <div className="flex-1">
              <a className="text-xl sm:text-2xl font-bold text-primary">
                Todo App
              </a>
            </div>
            <div className="flex flex-wrap gap-2 items-center justify-end">
              <button
                onClick={() => setView("personal")}
                className={`btn btn-sm md:btn-md ${
                  view === "personal" ? "btn-primary" : "btn-ghost"
                }`}
              >
                Personal
              </button>
              <button
                onClick={() => setView("shared")}
                className={`btn btn-sm md:btn-md ${
                  view === "shared" ? "btn-primary" : "btn-ghost"
                }`}
              >
                Shared
              </button>

              {/* ✅ Always show Account icon (dropdown) */}
              <Account session={session} />
            </div>
          </div>

          {/* Content */}
          <main className="flex-grow p-4 sm:p-6 md:p-8 w-full max-w-4xl mx-auto">
            {view === "personal" && <Todo session={session} />}
            {view === "shared" && <SharedTodo session={session} />}
          </main>
        </>
      )}
    </div>
  );
}

export default App;
