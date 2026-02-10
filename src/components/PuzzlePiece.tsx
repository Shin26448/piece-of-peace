import React, { useMemo } from "react";
import { PuzzlePieceData } from "../types";

interface PuzzlePieceProps {
  data: PuzzlePieceData;
  imageSrc?: string;
  pieceSize: number; // px
  rows: number;
  cols: number;
  onDragStart?: (id: number, e: React.PointerEvent) => void;
}

export const PuzzlePiece: React.FC<PuzzlePieceProps> = ({
  data,
  imageSrc,
  pieceSize,
  rows,
  cols,
  onDragStart,
}) => {
  const { path, position, row, col, isSolved, id } = data;

  const clipId = `clip-${id}`;
  const filterId = `shadow-${id}`;

  // ✅ path는 100x100 기준으로 만들어져있음 → pieceSize로 줄이려면 scale 필요
  const s = pieceSize / 100;

  // ✅ 이미지도 "100기준 좌표계"로 맞추면 정확히 들어맞음
  const imgW = cols * 100;
  const imgH = rows * 100;

  const style = useMemo(
    () => ({
      cursor: "grab",
      transition: "transform 0.05s linear",
    }),
    []
  );

  return (
    // ✅ translate는 px 단위, scale은 내부 조각만 줄이기
    <g
      transform={`translate(${position.x}, ${position.y}) scale(${s})`}
      onPointerDown={(e) => onDragStart?.(id, e)}
      style={style}
      filter={`url(#${filterId})`}
    >
      <defs>
        <clipPath id={clipId}>
          <path d={path} />
        </clipPath>

        <filter id={filterId} x="-60%" y="-60%" width="220%" height="220%">
          <feDropShadow dx="2" dy="2" stdDeviation="2" floodOpacity="0.28" result="shadow" />
          <feMerge>
            <feMergeNode in="shadow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* hit area */}
      <path d={path} fill="transparent" stroke="none" />

      {/* 이미지: 전체 이미지를 깔고, clipPath로 조각 부분만 보이게 */}
      {imageSrc && (
        <image
          href={imageSrc}
          x={-col * 100}
          y={-row * 100}
          width={imgW}
          height={imgH}
          clipPath={`url(#${clipId})`}
          preserveAspectRatio="none"
          pointerEvents="none"
        />
      )}

      {/* 테두리 */}
      <path
        d={path}
        fill="none"
        stroke="#555"
        strokeWidth="1"
        strokeOpacity={isSolved ? "0.25" : "0.55"}
        pointerEvents="none"
      />
    </g>
  );
};
