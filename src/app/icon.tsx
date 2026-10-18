import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

/** The wordmark's initial on the accent: no masks, no curtains. */
export default function Icon() {
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
          fontSize: 360,
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
