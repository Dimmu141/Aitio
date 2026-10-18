import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** The wordmark's initial on the accent: no masks, no curtains. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#b93a26",
          color: "#fffdf8",
          fontSize: 128,
          fontFamily: "serif",
          fontWeight: 700,
        }}
      >
        A
      </div>
    ),
    size,
  );
}
