import React from "react";
import { Clock, LogOut } from "lucide-react";
import { supabase } from "../supabase";
import FalconIcon from "./FalconIcon";

export default function PendingApprovalScreen({ session }) {
  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100dvh",
      backgroundColor: "#f8fafc",
      padding: "max(1rem, env(safe-area-inset-top)) 1rem max(1rem, env(safe-area-inset-bottom))",
      textAlign: "center",
      boxSizing: "border-box"
    }}>
      <div style={{
        background: "white",
        padding: "2rem 1.25rem",
        borderRadius: "16px",
        boxShadow: "0 4px 24px -4px rgba(0,0,0,0.08)",
        maxWidth: "460px",
        width: "100%",
        boxSizing: "border-box"
      }}>
        <div style={{
          background: "linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)",
          width: "64px",
          height: "64px",
          borderRadius: "18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 1.5rem",
          boxShadow: "0 8px 20px rgba(37, 99, 235, 0.35)",
        }}>
          <FalconIcon size={34} color="#ffffff" />
        </div>

        <div style={{
          background: "#FEF3C7",
          width: "56px",
          height: "56px",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 1.25rem",
        }}>
          <Clock size={28} color="#D97706" />
        </div>

        <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#1e293b", margin: "0 0 0.75rem" }}>
          Application Under Review
        </h2>

        <p style={{ color: "#64748b", fontSize: "0.925rem", lineHeight: 1.65, margin: "0 0 1.5rem" }}>
          Thank you for applying to become a <strong>Falcon Delivery</strong> rider!
          <br /><br />
          Your application has been submitted and is awaiting approval from the CEO.
          You will be able to access the rider dashboard once your account is activated.
        </p>

        <div style={{
          background: "#F0F9FF",
          border: "1px solid #BAE6FD",
          borderRadius: "10px",
          padding: "1rem",
          marginBottom: "1.5rem",
          fontSize: "0.85rem",
          color: "#0369A1",
          lineHeight: 1.5,
        }}>
          The CEO will review your application and approve your account.
          Come back and refresh this page to check your status.
        </div>

        <button
          onClick={handleSignOut}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            justifyContent: "center",
            width: "100%",
            padding: "0.75rem 1.5rem",
            background: "#F1F5F9",
            color: "#475569",
            border: "1px solid #E2E8F0",
            borderRadius: "10px",
            fontSize: "0.95rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <LogOut size={16} /> Sign Out
        </button>

        {session?.user?.email && (
          <p style={{ color: "#94a3b8", fontSize: "0.8rem", marginTop: "1rem" }}>
            Signed in as {session.user.email}
          </p>
        )}
      </div>
    </div>
  );
}
