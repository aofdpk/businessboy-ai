import React from "react";
import { createRoot } from "react-dom/client";
import { Gen3Analytics } from "./analytics";
import { PromptBuilder } from "./prompt-builder";

function BuilderApp() {
  async function logout() {
    await fetch("/api/gen3-auth", { method: "DELETE" }).catch(() => undefined);
    window.location.reload();
  }

  return (
    <main className="app-page">
      <header className="app-header">
        <a className="brand-link" href="/gen3">
          <img alt="เด็กประกอบการ" height="64" src="/businessboy-logo.jpg" width="64" />
          <div><b>AI Prompt Builder</b><span>โหมดสร้างตัวตน · รุ่น 3</span></div>
        </a>
        <div className="header-message"><span>สร้างตัวตนให้คนจำได้</span><small>Prompt → KVID → KCUT → KPOST</small></div>
        <button className="logout-button" onClick={logout} type="button">ออกจากระบบ</button>
      </header>
      <PromptBuilder />
    </main>
  );
}

const root = document.getElementById("builder-root");
if (!root) throw new Error("Missing #builder-root");
createRoot(root).render(<><BuilderApp /><Gen3Analytics /></>);
