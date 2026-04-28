"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          alignItems: "center",
          background: "#000",
          color: "#fff",
          display: "flex",
          fontFamily: "sans-serif",
          justifyContent: "center",
          minHeight: "100vh",
        }}
      >
        <div style={{ padding: "24px", textAlign: "center" }}>
          <h1>Application error</h1>
          <p style={{ color: "#888", margin: "16px 0" }}>
            A critical error occurred.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              background: "#7c5cff",
              border: "none",
              borderRadius: "12px",
              color: "#fff",
              cursor: "pointer",
              padding: "12px 24px",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
