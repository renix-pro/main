import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Global error handler to catch initialization errors
window.onerror = (message, source, lineno, colno, error) => {
  console.error('Global error:', { message, source, lineno, colno, error });
  const root = document.getElementById("root");
  if (root) {
    root.innerHTML = `<div style="padding: 20px; font-family: system-ui;">
      <h2>Error loading app</h2>
      <p>${message}</p>
      <p>Source: ${source}:${lineno}:${colno}</p>
    </div>`;
  }
};

// Handle unhandled promise rejections
window.onunhandledrejection = (event) => {
  console.error('Unhandled rejection:', event.reason);
};

try {
  const container = document.getElementById("root");
  if (!container) {
    throw new Error("Root element not found");
  }
  createRoot(container).render(<App />);
} catch (err) {
  console.error("Failed to mount app:", err);
  const root = document.getElementById("root");
  if (root) {
    root.innerHTML = `<div style="padding: 20px; font-family: system-ui;">
      <h2>Failed to load</h2>
      <p>${err instanceof Error ? err.message : String(err)}</p>
    </div>`;
  }
}
