"use client";

// Last-resort boundary for errors in the root layout. It replaces the whole
// document, so it renders its own <html> and inline styles.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "system-ui, sans-serif", background: "#f7f6f3", color: "#1f1d1a" }}>
        <main style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>We&apos;ll be right back</h1>
          <p style={{ margin: "0 0 20px", color: "#5c5852" }}>
            The site couldn&apos;t load just now. Please try again in a moment.
            {error.digest ? ` Reference: ${error.digest}.` : ""}
          </p>
          <button onClick={reset} style={{ padding: "10px 18px", borderRadius: 999, border: 0, background: "#1f1d1a", color: "#fff", fontWeight: 600, cursor: "pointer" }}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
