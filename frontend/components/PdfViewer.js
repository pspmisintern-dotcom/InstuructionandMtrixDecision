"use client";

import { useEffect, useRef, useState } from "react";
import { Box, CircularProgress, Typography } from "@mui/material";

let pdfjsLibPromise = null;

function loadPdfjs() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import("pdfjs-dist/build/pdf").then((pdfjsLib) => {
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url
      ).toString();
      return pdfjsLib;
    });
  }
  return pdfjsLibPromise;
}

/**
 * Renders a PDF blob as a series of canvases so the document can only be
 * viewed in-page — no native browser PDF toolbar (print/download/save icons)
 * is exposed, and there is no downloadable blob: URL for the user to open.
 */
export default function PdfViewer({ file, height = "75vh" }) {
  const containerRef = useRef(null);
  const [rendering, setRendering] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    let renderTask = null;

    async function render() {
      if (!file) return;
      setRendering(true);
      setError("");
      const container = containerRef.current;
      if (container) container.innerHTML = "";

      try {
        const pdfjsLib = await loadPdfjs();
        const data = new Uint8Array(await file.arrayBuffer());
        if (cancelled) return;
        const pdf = await pdfjsLib.getDocument({ data }).promise;

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          if (cancelled) return;
          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ scale: 1.5 });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.width = "100%";
          canvas.style.maxWidth = `${viewport.width}px`;
          canvas.style.display = "block";
          canvas.style.margin = "0 auto 12px";
          canvas.style.boxShadow = "0 2px 10px rgba(0,0,0,0.2)";
          canvas.style.background = "#fff";

          const ctx = canvas.getContext("2d");
          renderTask = page.render({ canvasContext: ctx, viewport });
          await renderTask.promise;
          if (cancelled) return;
          if (container) container.appendChild(canvas);
        }
      } catch (err) {
        if (!cancelled) setError("Failed to render PDF for viewing.");
      } finally {
        if (!cancelled) setRendering(false);
      }
    }

    render();
    return () => {
      cancelled = true;
      if (renderTask) renderTask.cancel();
    };
  }, [file]);

  return (
    <Box
      onContextMenu={(e) => e.preventDefault()}
      sx={{
        height,
        overflowY: "auto",
        overflowX: "hidden",
        bgcolor: "#525659",
        py: 2,
        userSelect: "none",
        WebkitTouchCallout: "none",
      }}
    >
      {rendering && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress sx={{ color: "#fff" }} />
        </Box>
      )}
      {error && (
        <Typography sx={{ color: "#fff", textAlign: "center", py: 4 }}>{error}</Typography>
      )}
      <div ref={containerRef} />
    </Box>
  );
}
