import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "./styles.css";
import AdminProjects from "./pages/AdminProjects.js";
import AdminProjectConfig from "./pages/AdminProjectConfig.js";
import ProjectWorkspace from "./pages/ProjectWorkspace.js";
import RecordingDetail from "./pages/RecordingDetail.js";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/admin" replace />} />
        <Route path="/admin" element={<AdminProjects />} />
        <Route path="/admin/p/:slug/config" element={<AdminProjectConfig />} />
        <Route path="/p/:slug" element={<ProjectWorkspace />} />
        <Route path="/p/:slug/r/:id" element={<RecordingDetail />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
