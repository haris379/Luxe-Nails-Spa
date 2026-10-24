import { useEffect, useState } from "react";

export default function ApiLoadingBar() {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handleLoading = (event) => {
      setLoading(event.detail.loading);
    };

    window.addEventListener("api-loading", handleLoading);

    return () => {
      window.removeEventListener("api-loading", handleLoading);
    };
  }, []);

  if (!loading) return null;

  return (
    <div
      className="fixed inset-x-0 top-0 z-[100] h-1.5 overflow-hidden bg-pink-100"
      role="progressbar"
      aria-label="Loading request"
    >
      <div className="h-full w-1/3 animate-[loading-slide_1.2s_ease-in-out_infinite] rounded-full bg-pink-500 shadow-[0_0_12px_rgba(236,72,153,0.8)]" />
      <style>{`
        @keyframes loading-slide {
          0% { transform: translateX(-110%); }
          100% { transform: translateX(310%); }
        }
      `}</style>
    </div>
  );
}
