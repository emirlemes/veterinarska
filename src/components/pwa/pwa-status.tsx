"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isIosDevice() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent) ||
    (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
}

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getOnlineSnapshot() {
  return navigator.onLine;
}

function subscribeIos() {
  return () => {};
}

function getIosSnapshot() {
  return isIosDevice();
}

function subscribeStandalone(callback: () => void) {
  const media = window.matchMedia("(display-mode: standalone)");
  media.addEventListener("change", callback);
  window.addEventListener("appinstalled", callback);
  return () => {
    media.removeEventListener("change", callback);
    window.removeEventListener("appinstalled", callback);
  };
}

function getStandaloneSnapshot() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && navigator.standalone === true);
}

export function PwaStatus() {
  const isOnline = useSyncExternalStore(subscribeOnline, getOnlineSnapshot, () => true);
  const isIos = useSyncExternalStore(subscribeIos, getIosSnapshot, () => false);
  const isStandalone = useSyncExternalStore(subscribeStandalone, getStandaloneSnapshot, () => false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [installError, setInstallError] = useState("");

  useEffect(() => {
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleInstallPrompt);

    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error: unknown) => {
        console.error("Registracija VetCare service worker-a nije uspjela.", error);
      });
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
    };
  }, []);

  async function installApp() {
    if (!installPrompt) return;
    setInstallError("");
    try {
      await installPrompt.prompt();
      await installPrompt.userChoice;
      setInstallPrompt(null);
    } catch (error) {
      console.error("Instalacija VetCare aplikacije nije uspjela.", error);
      setInstallError("Instalacija nije pokrenuta. Pokušajte ponovo ili otvorite meni preglednika.");
    }
  }

  if (!isOnline) {
    return (
      <div
        className="fixed inset-x-0 top-0 z-[100] bg-[#8d4a13] px-4 py-2 text-center text-xs font-semibold text-white"
        role="status"
      >
        Nema internet veze. VetCare ne čuva medicinske podatke za rad bez interneta.
      </div>
    );
  }

  if (installPrompt) {
    return (
      <div className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] right-3 z-[60] min-[640px]:bottom-4 min-[640px]:right-4 print:hidden">
        <button
          className="min-h-11 rounded-full bg-green px-4 text-sm font-bold text-white shadow-lg hover:bg-green-dark"
          onClick={() => void installApp()}
          type="button"
        >
          Instaliraj VetCare
        </button>
        {installError ? (
          <p className="mb-0 mt-2 max-w-[280px] rounded-lg bg-white px-3 py-2 text-xs text-[#a43e3c] shadow" role="alert">
            {installError}
          </p>
        ) : null}
      </div>
    );
  }

  if (showIosHelp) {
    return (
      <div className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] right-3 z-[60] max-w-[280px] rounded-xl border border-line bg-white p-4 text-sm shadow-lg min-[640px]:bottom-4 min-[640px]:right-4 print:hidden">
        <button
          aria-label="Zatvori upute za instalaciju"
          className="float-right ml-3 text-lg leading-none text-muted"
          onClick={() => setShowIosHelp(false)}
          type="button"
        >
          ×
        </button>
        <p className="m-0 font-bold">Dodaj VetCare na početni ekran</p>
        <p className="mb-0 mt-2 text-xs leading-5 text-muted">
          U Safariju dodirnite <strong>Podijeli</strong>, zatim <strong>Dodaj na početni ekran</strong>.
        </p>
      </div>
    );
  }

  if (isIos && !isStandalone) {
    return (
      <button
        className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] right-3 z-[60] min-h-11 rounded-full bg-green px-4 text-sm font-bold text-white shadow-lg hover:bg-green-dark min-[640px]:bottom-4 min-[640px]:right-4 print:hidden"
        onClick={() => setShowIosHelp(true)}
        type="button"
      >
        Dodaj na početni ekran
      </button>
    );
  }

  return null;
}
