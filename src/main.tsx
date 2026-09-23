import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { SettingsProvider } from "./lib/settings";
import "./styles.css";

// Keep the webview from behaving like a browser page.
document.addEventListener("contextmenu", (e) => e.preventDefault());

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <SettingsProvider>
      <App />
    </SettingsProvider>
  </React.StrictMode>,
);
