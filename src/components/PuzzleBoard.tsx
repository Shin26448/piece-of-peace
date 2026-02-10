import React, { useEffect, useMemo, useRef, useState } from "react";
import { PieceGenerator } from "../logic/PieceGenerator";
import { PuzzlePiece } from "./PuzzlePiece";
import { PuzzlePieceData, SideType } from "../types";

type PuzzleBoardProps = {
  rows: number;
  cols: number;
  pieceSize?: number;
  snapThreshold?: number;
  imageSrc?: string;
  title?: string;
  onBack?: () => void;
};

type Edge = { type: SideType; seed: number };

export const PuzzleBoard: React.FC<PuzzleBoardProps> = ({
  rows,
  cols,
  pieceSize = 60, // ✅ 더 작게
  snapThreshold = 28,
  imageSrc = "https://picsum.photos/800/600",
  title = "LEVEL 1",
  onBack,
}) => {
  const [pieces, setPieces] = useState<PuzzlePieceData[]>([]);
  const [draggingGroupId, setDraggingGroupId] = useState<number | null>(null);
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null);
  const [isCleared, setIsCleared] = useState(false);

  const svgRef = useRef<SVGSVGElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const boardWidth = useMemo(() => cols * pieceSize, [cols, pieceSize]); // px
  const boardHeight = useMemo(() => rows * pieceSize, [rows, pieceSize]); // px

  const MARGIN = 220; // 퍼즐 바깥 공간
  const outerW = boardWidth + MARGIN * 2;
  const outerH = boardHeight + MARGIN * 2;

  const invertSide = (t: SideType) => {
    if (t === SideType.TAB) return SideType.SLOT;
    if (t === SideType.SLOT) return SideType.TAB;
    return SideType.FLAT;
  };

  const playSnapSound = () => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    if (ctx.state === "suspended") ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  };

  const getSVGPoint = (e: React.PointerEvent) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const CTM = svgRef.current.getScreenCTM();
    if (!CTM) return { x: 0, y: 0 };
    return { x: (e.clientX - CTM.e) / CTM.a, y: (e.clientY - CTM.f) / CTM.d };
  };

  // ✅ 겹치지 않는 슬롯 생성 (테두리 여러 줄)
  const makeScatterSlots = () => {
    const slots: { x: number; y: number }[] = [];
    const GAP = 18; // ✅ 겹침 방지용 간격(조금 넓게)
    const PAD = 24;

    const xMinAll = -MARGIN + PAD;
    const xMaxAll = boardWidth + MARGIN - pieceSize - PAD;
    const yMinAll = -MARGIN + PAD;
    const yMaxAll = boardHeight + MARGIN - pieceSize - PAD;

    // 위쪽 2줄
    for (let y = -MARGIN + PAD; y <= -PAD - pieceSize; y += pieceSize + GAP) {
      for (let x = xMinAll; x <= xMaxAll; x += pieceSize + GAP) slots.push({ x, y });
    }
    // 아래쪽 2줄
    for (let y = boardHeight + PAD; y <= boardHeight + MARGIN - pieceSize - PAD; y += pieceSize + GAP) {
      for (let x = xMinAll; x <= xMaxAll; x += pieceSize + GAP) slots.push({ x, y });
    }
    // 왼쪽 2줄
    for (let x = -MARGIN + PAD; x <= -PAD - pieceSize; x += pieceSize + GAP) {
      for (let y = yMinAll; y <= yMaxAll; y += pieceSize + GAP) slots.push({ x, y });
    }
    // 오른쪽 2줄
    for (let x = boardWidth + PAD; x <= boardWidth + MARGIN - pieceSize - PAD; x += pieceSize + GAP) {
      for (let y = yMinAll; y <= yMaxAll; y += pieceSize + GAP) slots.push({ x, y });
    }

    // shuffle
    for (let i = slots.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = slots[i];
      slots[i] = slots[j];
      slots[j] = tmp;
    }

    return slots;
  };

  const buildPieces = () => {
    audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();

    // ✅ edge를 {type, seed}로 (seed 공유)
    const vEdges: Edge[][] = Array(rows)
      .fill(0)
      .map(() =>
        Array(cols + 1)
          .fill(0)
          .map(() => ({ type: SideType.FLAT, seed: 0 }))
      );

    const hEdges: Edge[][] = Array(rows + 1)
      .fill(0)
      .map(() =>
        Array(cols)
          .fill(0)
          .map(() => ({ type: SideType.FLAT, seed: 0 }))
      );

    let seedCounter = 1;

    for (let r = 0; r < rows; r++) {
      for (let c = 1; c < cols; c++) {
        vEdges[r][c] = {
          type: Math.random() > 0.5 ? SideType.TAB : SideType.SLOT,
          seed: seedCounter++,
        };
      }
    }

    for (let r = 1; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        hEdges[r][c] = {
          type: Math.random() > 0.5 ? SideType.TAB : SideType.SLOT,
          seed: seedCounter++,
        };
      }
    }

    const slots = makeScatterSlots();
    const need = rows * cols;

    // 슬롯 부족하면 fallback(거의 없지만 안전)
    while (slots.length < need) {
      const x = -MARGIN + 30 + Math.random() * (boardWidth + MARGIN * 2 - pieceSize - 60);
      const y = -MARGIN + 30 + Math.random() * (boardHeight + MARGIN * 2 - pieceSize - 60);
      slots.push({ x, y });
    }

    const newPieces: PuzzlePieceData[] = [];
    let id = 0;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const topEdge = hEdges[r][c];
        const bottomEdge = hEdges[r + 1][c];
        const leftEdge = vEdges[r][c];
        const rightEdge = vEdges[r][c + 1];

        const myTopType = r === 0 ? SideType.FLAT : invertSide(topEdge.type);
        const myBottomType = r === rows - 1 ? SideType.FLAT : bottomEdge.type;
        const myLeftType = c === 0 ? SideType.FLAT : invertSide(leftEdge.type);
        const myRightType = c === cols - 1 ? SideType.FLAT : rightEdge.type;

        const seedTop = r === 0 ? 0 : topEdge.seed;
        const seedBottom = r === rows - 1 ? 0 : bottomEdge.seed;
        const seedLeft = c === 0 ? 0 : leftEdge.seed;
        const seedRight = c === cols - 1 ? 0 : rightEdge.seed;

        const path = PieceGenerator.generatePath(
          myTopType,
          myRightType,
          myBottomType,
          myLeftType,
          seedTop,
          seedRight,
          seedBottom,
          seedLeft
        );

        const pos = slots[id];

        newPieces.push({
          id,
          groupId: id,
          row: r,
          col: c,
          top: myTopType,
          right: myRightType,
          bottom: myBottomType,
          left: myLeftType,
          path,
          position: { x: pos.x, y: pos.y }, // ✅ px 좌표
          correctPosition: { x: c * pieceSize, y: r * pieceSize },
          isSolved: false,
        });

        id++;
      }
    }

    setPieces(newPieces);
    setIsCleared(false);
    setDraggingGroupId(null);
    setDragStartPos(null);
  };

  useEffect(() => {
    buildPieces();
  }, [rows, cols, pieceSize]);

  const handleDragStart = (id: number, e: React.PointerEvent) => {
    if (isCleared) return;

    const clickedPiece = pieces.find((p) => p.id === id);
    if (!clickedPiece) return;

    const groupId = clickedPiece.groupId;
    const groupPieces = pieces.filter((p) => p.groupId === groupId);
    const otherPieces = pieces.filter((p) => p.groupId !== groupId);

    // 클릭 그룹 맨 위로
    setPieces([...otherPieces, ...groupPieces]);
    setDraggingGroupId(groupId);

    const svgPoint = getSVGPoint(e);
    setDragStartPos({ x: svgPoint.x, y: svgPoint.y });

    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handleDragMove = (e: React.PointerEvent) => {
    if (isCleared) return;
    if (draggingGroupId === null || !dragStartPos) return;

    const svgPoint = getSVGPoint(e);
    const dx = svgPoint.x - dragStartPos.x;
    const dy = svgPoint.y - dragStartPos.y;

    setPieces((prev) =>
      prev.map((p) => {
        if (p.groupId === draggingGroupId) {
          return { ...p, position: { x: p.position.x + dx, y: p.position.y + dy } };
        }
        return p;
      })
    );

    setDragStartPos({ x: svgPoint.x, y: svgPoint.y });
  };

  const checkCleared = (list: PuzzlePieceData[]) => {
    const groupIds = new Set(list.map((p) => p.groupId));
    if (groupIds.size === 1) setIsCleared(true);
  };

  const checkConnection = (activeGroupId: number) => {
    let merged = false;
    const newPieces = [...pieces];

    const activeGroup = newPieces.filter((p) => p.groupId === activeGroupId);
    const otherPieces = newPieces.filter((p) => p.groupId !== activeGroupId);

    for (const activePiece of activeGroup) {
      for (const targetPiece of otherPieces) {
        const isNeighbor =
          Math.abs(activePiece.col - targetPiece.col) + Math.abs(activePiece.row - targetPiece.row) === 1;
        if (!isNeighbor) continue;

        const idealDistX = (activePiece.col - targetPiece.col) * pieceSize;
        const idealDistY = (activePiece.row - targetPiece.row) * pieceSize;

        const currentDistX = activePiece.position.x - targetPiece.position.x;
        const currentDistY = activePiece.position.y - targetPiece.position.y;

        if (
          Math.abs(currentDistX - idealDistX) < snapThreshold &&
          Math.abs(currentDistY - idealDistY) < snapThreshold
        ) {
          const correctionX = idealDistX - currentDistX;
          const correctionY = idealDistY - currentDistY;

          activeGroup.forEach((p) => {
            p.position.x += correctionX;
            p.position.y += correctionY;
            p.groupId = targetPiece.groupId;
            p.isSolved = true;
          });

          targetPiece.isSolved = true;
          playSnapSound();
          merged = true;
          break;
        }
      }
      if (merged) break;
    }

    if (merged) {
      setPieces(newPieces);
      checkCleared(newPieces);
    }
  };

  const handleDragEnd = (e: React.PointerEvent) => {
    if (draggingGroupId === null) return;
    checkConnection(draggingGroupId);
    setDraggingGroupId(null);
    setDragStartPos(null);
    (e.target as Element).releasePointerCapture(e.pointerId);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-stone-100 p-4 touch-none">
      <div className="w-full max-w-3xl flex items-center justify-between mb-3">
        <button
          onClick={onBack}
          className="px-3 py-2 rounded-md bg-white shadow text-stone-700 disabled:opacity-50"
          type="button"
          disabled={!onBack}
        >
          ← 홈
        </button>

        <div className="text-stone-600 tracking-widest">{title}</div>

        <button onClick={buildPieces} className="px-3 py-2 rounded-md bg-white shadow text-stone-700" type="button">
          리셋
        </button>
      </div>

      <div className="relative bg-white shadow-xl rounded-lg overflow-hidden" style={{ width: outerW, height: outerH }}>
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          viewBox={`${-MARGIN} ${-MARGIN} ${boardWidth + MARGIN * 2} ${boardHeight + MARGIN * 2}`}
          className="bg-stone-50 cursor-default"
          onPointerMove={handleDragMove}
          onPointerUp={handleDragEnd}
          onPointerLeave={handleDragEnd}
        >
          {pieces.map((p) => (
            <PuzzlePiece
              key={p.id}
              data={p}
              imageSrc={imageSrc}
              pieceSize={pieceSize}
              rows={rows}
              cols={cols}
              onDragStart={handleDragStart}
            />
          ))}
        </svg>

        {isCleared && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <div className="bg-white rounded-2xl shadow-2xl p-6 w-[320px] text-center">
              <div className="text-2xl tracking-widest text-stone-700 font-light">CLEAR!</div>
              <div className="mt-2 text-stone-500">축하해 🎉 다 맞췄어!</div>
              <div className="mt-5 flex gap-2 justify-center">
                <button
                  className="px-4 py-2 rounded-xl bg-stone-800 text-white"
                  onClick={() => setIsCleared(false)}
                  type="button"
                >
                  계속 보기
                </button>
                <button className="px-4 py-2 rounded-xl bg-stone-100 text-stone-700" onClick={buildPieces} type="button">
                  다시하기
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 text-sm text-stone-500">
        {rows} x {cols} · pieceSize {pieceSize}px · snap {snapThreshold}px
      </div>
    </div>
  );
};
