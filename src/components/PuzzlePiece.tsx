import React, { useMemo } from "react";
import { PuzzlePieceData } from "../types";

interface PuzzlePieceProps {
  data: PuzzlePieceData;
  imageSrc?: string;
  onDragStart?: (id: number, e: React.PointerEvent) => void;
}

const PIECE_SIZE = 100;

export const PuzzlePiece: React.FC<PuzzlePieceProps> = ({
  data,
  imageSrc,
  onDragStart,
}) => {
  const { path, position, row, col, isSolved, id } = data;
  const clipId = `clip-${id}`;

  const style = useMemo(
    () => ({
      cursor: "grab",
      transition: "transform 0.1s ease-out", // 드래그 시 반응성 개선
      zIndex: isSolved ? 0 : 50, // 안 맞춰진 조각이 항상 위에 오도록
    }),
    [isSolved]
  );

  return (
    <g
      transform={`translate(${position.x}, ${position.y})`}
      onPointerDown={(e) => onDragStart?.(id, e)}
      style={style}
    >
      {/* [핵심 수정] 조각 확대 (Scale Up) 
        조각을 1.02배(2%) 키워서 옆 조각과 살짝 겹치게 만듭니다.
        이렇게 하면 브라우저 렌더링 오차로 인한 흰 틈(Gap)이 완벽하게 사라집니다.
        transformOrigin은 조각의 중심(50px 50px)입니다.
      */}
      <g style={{ transform: "scale(1.02)", transformOrigin: "50px 50px" }}>
        <defs>
          <clipPath id={clipId}>
            <path d={path} />
          </clipPath>
        </defs>

        {/* 1. 이미지 */}
        {imageSrc && (
          <image
            href={imageSrc}
            x={-col * PIECE_SIZE}
            y={-row * PIECE_SIZE}
            width={1000}
            height={1000}
            clipPath={`url(#${clipId})`}
            preserveAspectRatio="none"
            pointerEvents="none"
          />
        )}

        {/* 2. 테두리 및 그림자 처리 */}
        {!isSolved ? (
          <>
            {/* [안 맞춰짐] 입체감을 위한 그림자와 밝은 테두리 */}
            <path
              d={path}
              fill="none"
              stroke="black"
              strokeWidth="3"
              strokeOpacity="0.2"
              transform="translate(2, 2)"
            />
            <path
              d={path}
              fill="none"
              stroke="white"
              strokeWidth="1.5"
              strokeOpacity="0.6"
            />
            <path
              d={path}
              fill="none"
              stroke="black"
              strokeWidth="0.5"
              strokeOpacity="0.3"
            />
          </>
        ) : (
          /* [맞춰짐] 틈새를 자연스럽게 메우기 위한 아주 얇은 '연결선' (Grout)
             투명하게(none) 하면 겹친 부분이 어색할 수 있어 0.1 투명도로 남겨둡니다. */
          <path
            d={path}
            fill="none"
            stroke="black"
            strokeWidth="0.5"
            strokeOpacity="0.1"
          />
        )}

        {/* 클릭/드래그 영역 (투명) */}
        <path
          d={path}
          fill="transparent"
          stroke="none"
          pointerEvents="visible"
        />
      </g>
    </g>
  );
};
