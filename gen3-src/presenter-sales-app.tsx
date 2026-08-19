import React from "react";
import { createRoot } from "react-dom/client";
import { PresenterSalesPromptBuilder } from "./presenter-sales-prompt-builder";

function PresenterSalesBuilderApp() {
  async function logout() {
    try {
      sessionStorage.removeItem("businessboy-gen3-presenter-identity-v1");
      sessionStorage.removeItem("businessboy-gen3-presenter-sales-v1");
    } catch { /* Storage can be unavailable. */ }
    await fetch("/api/gen3-auth", { method: "DELETE" }).catch(() => undefined);
    window.location.reload();
  }

  return (
    <main className="app-page sales-app presenter-sales-app">
      <header className="app-header">
        <a className="brand-link" href="/gen3">
          <img alt="เด็กประกอบการ" height="64" src="/businessboy-logo.jpg" width="64" />
          <div><b>AI Prompt Builder</b><span>ขายสินค้าสาวสวย/หนุ่มหล่อ · EP6</span></div>
        </a>
        <div className="header-message"><span>Presenter Lock + Product Evidence ใน Prompt เดียว</span><small>Character Reference + Original Product Reference → Gemini → KVID → KCUT</small></div>
        <button className="logout-button" onClick={logout} type="button">ออกจากระบบ</button>
      </header>
      <PresenterSalesPromptBuilder />
    </main>
  );
}

const root = document.getElementById("builder-root");
if (!root) throw new Error("Missing #builder-root");
createRoot(root).render(<PresenterSalesBuilderApp />);
