import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import Admin from "./Admin";
import "./index.css";

const isAdmin = window.location.pathname === "/admin";

ReactDOM.createRoot(document.getElementById("root")).render(
  isAdmin ? <Admin /> : <App />
);
