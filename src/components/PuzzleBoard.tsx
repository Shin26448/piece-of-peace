import React, { useEffect, useRef, useState } from "react";
import { PieceGenerator } from "../logic/PieceGenerator";
import { PuzzlePiece } from "./PuzzlePiece";
import { PuzzlePieceData, SideType } from "../types";

const PIECE_SIZE = 100;
const COLS = 4;
const ROWS = 6;
const SNAP_THRESHOLD = 20;
const PUZZLE_IMAGE_SRC = "https://picsum.photos/id/15/800/1200";

export const PuzzleBoard: React.FC = () => {
  const [pieces, setPieces] = useState<PuzzlePieceData[]>([]);
  const [draggingGroupId, setDraggingGroupId] = useState<number | null>(null);
  const [dragStartPos, setDragStartPos] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    audioCtxRef.current = new (window.AudioContext ||
      (window as any).webkitAudioContext)();

    const vEdges: SideType[][] = Array(ROWS)
      .fill(0)
      .map(() => Array(COLS + 1).fill(SideType.FLAT));
    const hEdges: SideType[][] = Array(ROWS + 1)
      .fill(0)
      .map(() => Array(COLS).fill(SideType.FLAT));

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS - 1; c++)
        vEdges[r][c + 1] = Math.random() > 0.5 ? SideType.TAB : SideType.SLOT;
    }
    for (let r = 0; r < ROWS - 1; r++) {
      for (let c = 0; c < COLS; c++)
        hEdges[r + 1][c] = Math.random() > 0.5 ? SideType.TAB : SideType.SLOT;
    }

    const newPieces: PuzzlePieceData[] = [];
    let id = 0;

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const myTop =
          r === 0
            ? SideType.FLAT
            : hEdges[r][c] === SideType.TAB
            ? SideType.SLOT
            : SideType.TAB;
        const myBottom = r === ROWS - 1 ? SideType.FLAT : hEdges[r + 1][c];
        const myLeft =
          c === 0
            ? SideType.FLAT
            : vEdges[r][c] === SideType.TAB
            ? SideType.SLOT
            : SideType.TAB;
        const myRight = c === COLS - 1 ? SideType.FLAT : vEdges[r][c + 1];

        // [중요 수정] 맞닿은 변끼리 동일한 Seed를 공유하도록 계산
        // 수평선(가로) Seed: (행 번호 * 1000) + 열 번호
        // 수직선(세로) Seed: (행 번호 * 1000) + 열 번호 + 5000 (겹치지 않게 오프셋)

        const seedTop = r * 1000 + c; // 내 윗변 == 윗집 아랫변
        const seedBottom = (r + 1) * 1000 + c; // 내 아랫변 == 아랫집 윗변
        const seedLeft = r * 1000 + c + 5000; // 내 왼변 == 옆집 오른변
        const seedRight = r * 1000 + (c + 1) + 5000; // 내 오른변 == 옆집 왼변

        // 4개의 고유 Seed 전달
        const path = PieceGenerator.generatePath(
          myTop,
          myRight,
          myBottom,
          myLeft,
          seedTop,
          seedRight,
          seedBottom,
          seedLeft
        );

        const scatterRange = 300;
        const initialPos = {
          x:
            Math.random() * scatterRange -
            scatterRange / 2 +
            (COLS * PIECE_SIZE) / 2,
          y:
            Math.random() * scatterRange -
            scatterRange / 2 +
            (ROWS * PIECE_SIZE) / 2,
        };

        newPieces.push({
          id: id,
          groupId: id,
          row: r,
          col: c,
          top: myTop,
          right: myRight,
          bottom: myBottom,
          left: myLeft,
          path,
          position: initialPos,
          correctPosition: { x: c * PIECE_SIZE, y: r * PIECE_SIZE },
          isSolved: false,
        });
        id++;
      }
    }
    setPieces(newPieces);
  }, []);

  // ... (이하 코드는 기존과 동일)
  const playSnapSound = () => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    if (ctx.state === "suspended") ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  };

  const getSVGPoint = (e: React.PointerEvent) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const CTM = svgRef.current.getScreenCTM();
    if (!CTM) return { x: 0, y: 0 };
    return { x: (e.clientX - CTM.e) / CTM.a, y: (e.clientY - CTM.f) / CTM.d };
  };

  const handleDragStart = (id: number, e: React.PointerEvent) => {
    const clickedPiece = pieces.find((p) => p.id === id);
    if (!clickedPiece) return;
    const groupId = clickedPiece.groupId;
    const groupPieces = pieces.filter((p) => p.groupId === groupId);
    const otherPieces = pieces.filter((p) => p.groupId !== groupId);
    setPieces([...otherPieces, ...groupPieces]);
    setDraggingGroupId(groupId);
    const svgPoint = getSVGPoint(e);
    setDragStartPos({ x: svgPoint.x, y: svgPoint.y });
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handleDragMove = (e: React.PointerEvent) => {
    if (draggingGroupId === null || !dragStartPos) return;
    e.preventDefault();
    const svgPoint = getSVGPoint(e);
    const dx = svgPoint.x - dragStartPos.x;
    const dy = svgPoint.y - dragStartPos.y;
    setPieces((prev) =>
      prev.map((p) => {
        if (p.groupId === draggingGroupId) {
          return {
            ...p,
            position: { x: p.position.x + dx, y: p.position.y + dy },
          };
        }
        return p;
      })
    );
    setDragStartPos({ x: svgPoint.x, y: svgPoint.y });
  };

  const handleDragEnd = (e: React.PointerEvent) => {
    if (draggingGroupId === null) return;
    checkConnection(draggingGroupId);
    setDraggingGroupId(null);
    setDragStartPos(null);
    (e.target as Element).releasePointerCapture(e.pointerId);
  };

  const checkConnection = (activeGroupId: number) => {
    let merged = false;
    let newPieces = [...pieces];
    const activeGroup = newPieces.filter((p) => p.groupId === activeGroupId);
    const otherPieces = newPieces.filter((p) => p.groupId !== activeGroupId);

    for (const activePiece of activeGroup) {
      for (const targetPiece of otherPieces) {
        const isNeighbor =
          Math.abs(activePiece.col - targetPiece.col) +
            Math.abs(activePiece.row - targetPiece.row) ===
          1;
        if (!isNeighbor) continue;
        const idealDistX = (activePiece.col - targetPiece.col) * PIECE_SIZE;
        const idealDistY = (activePiece.row - targetPiece.row) * PIECE_SIZE;
        const currentDistX = activePiece.position.x - targetPiece.position.x;
        const currentDistY = activePiece.position.y - targetPiece.position.y;
        if (
          Math.abs(currentDistX - idealDistX) < SNAP_THRESHOLD &&
          Math.abs(currentDistY - idealDistY) < SNAP_THRESHOLD
        ) {
          const correctionX = idealDistX - currentDistX;
          const correctionY = idealDistY - currentDistY;
          activeGroup.forEach((p) => {
            p.position.x += correctionX;
            p.position.y += correctionY;
            p.groupId = targetPiece.groupId;
            p.isSolved = true;
          });
          newPieces
            .filter((p) => p.groupId === targetPiece.groupId)
            .forEach((p) => (p.isSolved = true));
          playSnapSound();
          merged = true;
          break;
        }
      }
      if (merged) break;
    }
    if (merged) setPieces(newPieces);
  };

  const VIEWBOX_SIZE = 1500;
  return (
    <div className="w-full h-screen bg-stone-200 overflow-hidden touch-none relative">
      <h1 className="absolute top-4 left-0 w-full text-center text-xl text-stone-500 font-bold pointer-events-none opacity-50 z-10">
        Free Board
      </h1>
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox={`${-VIEWBOX_SIZE / 2} ${
          -VIEWBOX_SIZE / 2
        } ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
        className="w-full h-full cursor-default"
        onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd}
        onPointerLeave={handleDragEnd}
      >
        {pieces.map((p) => (
          <PuzzlePiece
            key={p.id}
            data={p}
            imageSrc={PUZZLE_IMAGE_SRC}
            onDragStart={handleDragStart}
          />
        ))}
      </svg>
    </div>
  );
};
