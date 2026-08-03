import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import AuthGate from "./Auth.jsx";
import SubscriptionGate from "./Billing.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthGate>
      <SubscriptionGate>
        <App />
      </SubscriptionGate>
    </AuthGate>
  </React.StrictMode>
);
