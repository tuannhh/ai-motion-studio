import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import { HEIGHT, SAFE_TOP, SAFE_X, WIDTH, screenshotSceneSchema } from "../schema/spec";
import { bestTextOn, Theme } from "../style/presets";
import { type } from "../style/fonts";
import { FONT_MONO } from "../style/fonts";
import { enterSpring, popSpring } from "../core/motion";
import { Kicker } from "../core/ui";
import { fitBox } from "../core/fit";

const asSrc = (file: string) => (file.startsWith("http") ? file : staticFile(file));

/**
 * Ảnh chụp giao diện trong KHUNG thiết bị (browser/phone) + chấm chú thích đánh
 * số chỉ vào chi tiết UI. Ảnh do pipeline sinh (nano banana) hoặc ảnh thật;
 * engine dựng khung, đánh số 1..n (pop lần lượt + nhãn), giữ ảnh sạch không phủ.
 */
export const ScreenshotScene: React.FC<{
  scene: z.infer<typeof screenshotSceneSchema>;
  theme: Theme;
}> = ({ scene, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headIn = enterSpring({ frame, fps, delay: 2 });
  const frameIn = popSpring({ frame, fps, delay: 8 });

  const isPhone = scene.frame === "phone";
  const hasHeader = !!(scene.kicker || scene.headline);

  // Khung thiết bị = thẻ bo góc sạch (ảnh UI từ nano banana thường ĐÃ có chrome
  // trình duyệt riêng nên KHÔNG vẽ thêm chrome giả → tránh nhân đôi). Phone thêm notch.
  // Phone thu nhỏ hơn browser (500 thay vì 600) + LUÔN canh giữa dọc (không đẩy xuống
  // 0.56 khi có header) — ở cỡ 600+centerY 0.56 khung điện thoại cao gần 1190px, đáy
  // khung chạm tới ~1670-1670px, ĐÈ LÊN vùng phụ đề (bottom:260 → mép trên phụ đề
  // ~1490px, còn phải chừa dưới 260px cho caption/tên kênh của TikTok/Reels/Shorts).
  // 500 + canh giữa 0.5 giữ đáy khung ~1457px, luôn dưới ngưỡng 1490px an toàn (phản
  // hồi thiết kế 2026-09-03: phụ đề dính vào ảnh điện thoại to).
  const frameW = isPhone ? 500 : WIDTH - SAFE_X * 2;
  const screenAspect = isPhone ? 600 / 1180 : 4 / 3; // w/h nội dung ảnh (tỉ lệ cố định, không đổi theo frameW)
  const pad = isPhone ? 16 : 14;
  const screenW = frameW - pad * 2;
  const screenH = screenW / screenAspect;
  const centerY = isPhone ? HEIGHT * 0.5 : hasHeader ? HEIGHT * 0.56 : HEIGHT * 0.5;

  // Ảnh chụp THẬT (scene.real, từ userimg:N) không có chrome giả — thẻ viền trắng,
  // bo góc nhẹ, object-fit:contain giữ nguyên khung hình đã crop (không cắt thêm),
  // không vẽ marker (toạ độ fraction không khớp khi ảnh letterbox bên trong contain).
  const shell = scene.real ? "#FFFFFF" : theme.isDark ? "#0E1220" : "#FFFFFF";
  const chromeBorder = scene.real ? "rgba(0,0,0,0.08)" : theme.isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.10)";

  return (
    <AbsoluteFill>
      {/* header trên vùng safe */}
      {hasHeader ? (
        <div
          style={{
            position: "absolute",
            top: SAFE_TOP,
            left: SAFE_X,
            right: SAFE_X,
            opacity: headIn,
            transform: `translateY(${(1 - headIn) * 40}px)`,
          }}
        >
          {scene.kicker ? <Kicker theme={theme}>{scene.kicker}</Kicker> : null}
          {scene.headline ? (
            <h2
              style={{
                ...type.title,
                fontSize: fitBox(scene.headline, WIDTH - SAFE_X * 2, 2, { max: 58, min: 40, fontWeight: 700 }),
                lineHeight: 1.14,
                color: theme.text,
                margin: "14px 0 0",
              }}
            >
              {scene.headline}
            </h2>
          ) : null}
        </div>
      ) : null}

      {/* khung thiết bị + ảnh */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: centerY,
          width: frameW,
          transform: `translate(-50%, -50%) scale(${0.9 + frameIn * 0.1})`,
          opacity: frameIn,
          background: shell,
          borderRadius: scene.real ? 24 : isPhone ? 52 : 22,
          border: `1.5px solid ${chromeBorder}`,
          padding: pad,
          boxShadow: theme.flat ? "0 6px 0 rgba(0,0,0,0.18)" : "0 34px 90px rgba(0,0,0,0.5)",
        }}
      >
        {/* notch điện thoại — chỉ khung giả, ảnh thật không có notch */}
        {isPhone && !scene.real ? (
          <div
            style={{
              width: 150,
              height: 26,
              borderRadius: 14,
              background: theme.isDark ? "#000" : "#1A1A1A",
              margin: "0 auto 12px",
            }}
          />
        ) : null}

        {/* màn hình */}
        <div
          style={{
            position: "relative",
            width: screenW,
            height: screenH,
            margin: "0 auto",
            borderRadius: scene.real ? 14 : isPhone ? 30 : 12,
            overflow: "hidden",
            background: scene.real ? "#14161C" : theme.isDark ? "#05070C" : "#EDEEF0",
          }}
        >
          {scene.image ? (
            <Img
              src={asSrc(scene.image)}
              style={{ width: "100%", height: "100%", objectFit: scene.real ? "contain" : "cover" }}
            />
          ) : (
            <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", color: theme.textDim, fontFamily: FONT_MONO, fontSize: 26 }}>
              (ảnh giao diện)
            </div>
          )}

          {/* chấm chú thích đánh số: badge ĐÚNG điểm (x,y), nhãn xổ sang một bên
              (bên phải nếu điểm ở nửa trái, ngược lại) để không tràn khỏi khung.
              Ảnh thật (real) không vẽ marker — toạ độ fraction lệch khi ảnh letterbox
              bên trong object-fit:contain, và AI không biết toạ độ ảnh thật. */}
          {!scene.real && scene.markers.map((m, i) => {
            const pop = popSpring({ frame, fps, delay: 24 + i * 8 });
            const pulse = 1 + Math.sin(Math.max(0, frame - (24 + i * 8)) / 10) * 0.08;
            const labelLeft = m.x > 0.55; // điểm ở nửa phải → nhãn xổ sang trái
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: `${m.x * 100}%`,
                  top: `${m.y * 100}%`,
                  transform: `translate(-50%, -50%)`,
                  opacity: pop,
                }}
              >
                {/* badge số — tâm nằm đúng điểm */}
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    background: theme.accent,
                    color: bestTextOn(theme.accent),
                    display: "grid",
                    placeItems: "center",
                    fontFamily: FONT_MONO,
                    fontWeight: 700,
                    fontSize: 26,
                    transform: `scale(${pop * pulse})`,
                    boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
                  }}
                >
                  {i + 1}
                </div>
                {/* nhãn — neo cạnh badge, xổ ra ngoài điểm */}
                <div
                  style={{
                    position: "absolute",
                    top: "50%",
                    ...(labelLeft ? { right: 54 } : { left: 54 }),
                    transform: `translateY(-50%) scale(${pop})`,
                    transformOrigin: labelLeft ? "right center" : "left center",
                    background: theme.accent,
                    color: bestTextOn(theme.accent),
                    padding: "8px 16px",
                    borderRadius: 10,
                    fontFamily: type.body.fontFamily,
                    fontWeight: 700,
                    fontSize: 26,
                    whiteSpace: "nowrap",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
                  }}
                >
                  {m.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
