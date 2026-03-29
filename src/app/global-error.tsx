"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#fdf6f0", color: "#3d2b1f" }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <h1 style={{ margin: 0, fontSize: "32px" }}>Something went wrong</h1>
            <button
              type="button"
              onClick={reset}
              style={{
                marginTop: "16px",
                border: 0,
                borderRadius: "9999px",
                background: "#b8736a",
                color: "#fff",
                padding: "12px 20px",
                fontSize: "14px",
                cursor: "pointer",
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
