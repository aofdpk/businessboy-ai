import React from "react";
import { createRoot } from "react-dom/client";
import { Gen3Analytics } from "./analytics";
import { SalesPromptBuilder } from "./sales-prompt-builder";

function SalesBuilderApp() {
  async function logout() {
    await fetch("/api/gen3-auth", { method: "DELETE" }).catch(() => undefined);
    window.location.reload();
  }

  return (
    <main className="app-page sales-app">
      <header className="app-header">
        <a className="brand-link" href="/gen3">
          <img alt="เด็กประกอบการ" height="64" src="/businessboy-logo.jpg" width="64" />
          <div><b>AI Prompt Builder</b><span>โหมดคลิปขายสินค้า · รุ่น 3</span></div>
        </a>
        <div className="header-message"><span>แนบรูปตัวละครและสินค้า แล้วสร้างคลิปขายในครั้งเดียว</span><small>Original References → Gemini → KVID → KCUT</small></div>
        <button className="logout-button" onClick={logout} type="button">ออกจากระบบ</button>
      </header>
      <SalesPromptBuilder />
    </main>
  );
}

const root = document.getElementById("builder-root");
if (!root) throw new Error("Missing #builder-root");
createRoot(root).render(<><SalesBuilderApp /><Gen3Analytics /></>);
