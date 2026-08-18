/**
 * GitHub Pages 版的進入點。畫面完全沿用主站的 CatCareApp，
 * 只把資料層換成 localStorage、把路由換成 hash。
 */
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import CatCareApp from "../app/CatCareApp";
import "../app/globals.css";
import { installLocalApi } from "./local-api";

installLocalApi();

const LOCAL_USER = { userId: "local", displayName: "本機使用者", email: "", fullName: null };

function sectionFromHash() {
  return location.hash.replace(/^#\/?/, "") || "home";
}

function StaticApp() {
  const [section, setSection] = useState(sectionFromHash);
  useEffect(() => {
    const sync = () => setSection(sectionFromHash());
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  // 換頁後捲回頂端，否則從長頁面跳過去會停在半空中。
  useEffect(() => { window.scrollTo(0, 0); }, [section]);
  return <CatCareApp section={section} user={LOCAL_USER} local />;
}

createRoot(document.getElementById("app")!).render(<StrictMode><StaticApp /></StrictMode>);
