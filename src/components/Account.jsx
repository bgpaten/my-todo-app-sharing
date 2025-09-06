// src/components/Account.jsx
import React, { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import { FaUserCircle } from "react-icons/fa";

function Account({ session }) {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState(null);

  useEffect(() => {
    if (session?.user) {
      setEmail(session.user.email);
    }
  }, [session]);

  async function handleLogout() {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="dropdown dropdown-end">
      {/* ✅ pakai button + role biar 100% bisa di klik */}
      <button
        tabIndex={0}
        role="button"
        className="btn btn-ghost btn-circle avatar"
      >
        <FaUserCircle className="text-3xl text-primary" />
      </button>

      {/* ✅ dropdown-content langsung sibling */}
      <ul
        tabIndex={0}
        className="dropdown-content z-[999] mt-3 p-4 shadow bg-base-100 rounded-box w-64"
      >
        <li className="mb-2">
          <div className="flex flex-col items-center text-center">
            <FaUserCircle className="text-5xl text-primary mb-2" />
            <p className="font-semibold">{email}</p>
            <p className="text-xs text-gray-500">Logged in</p>
          </div>
        </li>
        <li>
          <button
            type="button"
            onClick={handleLogout}
            disabled={loading}
            className={`btn btn-error w-full ${loading ? "btn-disabled" : ""}`}
          >
            {loading ? "Loading..." : "Logout"}
          </button>
        </li>
      </ul>
    </div>
  );
}

export default Account;
