import React from "react";
import { createRoot } from "react-dom/client";
import { PresenterIdentityBuilder } from "./presenter-identity-builder";

function PresenterIdentityApp() {
  async function logout() {
    try {
      sessionStorage.removeItem("businessboy-gen3-presenter-identity-v1");
      sessionStorage.removeItem("businessboy-gen3-presenter-sales-v1");
    } catch { /* Storage can be unavailable. */ }
    await fetch("/api/gen3-auth", { method: "DELETE" }).catch(() => undefined);
    window.location.reload();
  }

  return (
    <main className="app-page presenter-identity-app">
      <header className="app-header">
        <a className="brand-link" href="/gen3">
          <img alt="เด็กประกอบการ" height="64" src="/businessboy-logo.jpg" width="64" />
          <div><b>AI Prompt Builder</b><span>Presenter Identity · EP6</span></div>
        </a>
        <div className="header-message"><span>สร้างคนที่จำง่าย ไม่ใช่แค่หน้าตาดี</span><small>Channel DNA → Character Sheet → AI เลือกฉากตามบท</small></div>
        <button className="logout-button" onClick={logout} type="button">ออกจากระบบ</button>
      </header>
      <PresenterIdentityBuilder />
    </main>
  );
}

const root = document.getElementById("builder-root");
if (!root) throw new Error("Missing #builder-root");
createRoot(root).render(<PresenterIdentityApp />);
