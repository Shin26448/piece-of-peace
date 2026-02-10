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
  pieceSize = 60,
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

  const boardWidth = useMemo(() => cols * pieceSize, [cols, pieceSize]);
  const boardHeight = useMemo(() => rows * pieceSize, [rows, pieceSize]);

  const MARGIN = 220;
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

  const makeScatterSlots = () => {
    const slots: { x: number; y: number }[] = [];
    const GAP = 18;
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

    // edge를 {type, seed}로 (seed는 "경계선" 단위로 공유)
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

    // 내부 세로 경계선
    for (let r = 0; r < rows; r++) {
      for (let c = 1; c < cols; c++) {
        vEdges[r][c] = {
          type: Math.random() > 0.5 ? SideType.TAB : SideType.SLOT,
          seed: seedCounter++,
        };
      }
    }

    // 내부 가로 경계선
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

        // ✅ 핵심: 같은 edge를 서로 반대 방향으로 따라가면 "reverse"로 뒤집어서 써야 한다.
        // PieceGenerator는 내부에서 'seed로 edge를 1번만 생성'하고,
        // reverse=true면 베지어를 정확히 역방향으로 뒤집는다.
        //
        // 이 프로젝트의 path는 조각을 시계방향으로 그리는데,
        // - top: 좌→우 (정방향)    => reverse: false
        // - right: 상→하 (정방향)  => reverse: false
        // - bottom: 우→좌 (역방향) => reverse: true
        // - left: 하→상 (역방향)   => reverse: true
        const path = PieceGenerator.generatePath({
          top: { type: myTopType, seed: seedTop, reverse: false },
          right: { type: myRightType, seed: seedRight, reverse: false },
          bottom: { type: myBottomType, seed: seedBottom, reverse: true },
          left: { type: myLeftType, seed: seedLeft, reverse: true },
        });

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
          position: { x: pos.x, y: pos.y },
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

    setDragStartPos(svgPoint);
  };

  const mergeGroupsIfSnapped = (a: PuzzlePieceData, b: PuzzlePieceData) => {
    const ax = a.position.x;
    const ay = a.position.y;
    const bx = b.position.x;
    const by = b.position.y;

    const dx = (a.correctPosition.x - b.correctPosition.x) + (bx - ax);
    const dy = (a.correctPosition.y - b.correctPosition.y) + (by - ay);

    if (Math.abs(dx) <= snapThreshold && Math.abs(dy) <= snapThreshold) {
      // b 그룹을 a 그룹으로 합치기
      setPieces((prev) => {
        const gidA = a.groupId;
        const gidB = b.groupId;

        // gidB에 속한 모든 조각을 gidA로
        const updated = prev.map((p) => {
          if (p.groupId === gidB) {
            return {
              ...p,
              groupId: gidA,
              position: { x: p.position.x - dx, y: p.position.y - dy },
            };
          }
          return p;
        });

        return updated;
      });

      playSnapSound();
      return true;
    }
    return false;
  };

  const handleDragEnd = () => {
    if (isCleared) return;
    if (draggingGroupId === null) return;

    const groupPieces = pieces.filter((p) => p.groupId === draggingGroupId);

    // 그룹 내 임의 대표 하나로 검사(충분)
    const rep = groupPieces[0];
    if (!rep) {
      setDraggingGroupId(null);
      setDragStartPos(null);
      return;
    }

    // 대표 조각과 인접한 조각들을 찾아 snap 시도
    const others = pieces.filter((p) => p.groupId !== draggingGroupId);

    // 모든 조각과 비교하면 느려질 수 있지만 여기선 OK
    for (let i = 0; i < others.length; i++) {
      const b = others[i];
      // 인접 후보만
      const dr = Math.abs(rep.row - b.row);
      const dc = Math.abs(rep.col - b.col);
      if (dr + dc !== 1) continue;

      const snapped = mergeGroupsIfSnapped(rep, b);
      if (snapped) break;
    }

    // 전체 클리어 체크
    setTimeout(() => {
      setPieces((prev) => {
        const allClose = prev.every((p) => {
          const dx = p.position.x - p.correctPosition.x;
          const dy = p.position.y - p.correctPosition.y;
          return Math.abs(dx) <= snapThreshold && Math.abs(dy) <= snapThreshold;
        });

        if (allClose) {
          const solved = prev.map((p) => ({ ...p, isSolved: true, position: p.correctPosition }));
          setIsCleared(true);
          return solved;
        }
        return prev;
      });
    }, 0);

    setDraggingGroupId(null);
    setDragStartPos(null);
  };

  return (
    <div className="min-h-screen bg-stone-100 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl tracking-widest text-stone-700 font-light">{title}</div>
            <div className="text-stone-500 mt-1">
              {rows} x {cols}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={buildPieces}
              className="px-4 py-2 rounded-xl bg-white border border-stone-200 shadow-sm hover:bg-stone-50 text-stone-700"
              type="button"
            >
              재시작
            </button>
            <button
              onClick={onBack}
              className="px-4 py-2 rounded-xl bg-stone-700 text-white hover:bg-stone-800"
              type="button"
            >
              뒤로
            </button>
          </div>
        </div>

        <div className="mt-6 bg-white rounded-2xl shadow-xl p-4 overflow-hidden">
          <svg
            ref={svgRef}
            width="100%"
            height="640"
            viewBox={`${-MARGIN} ${-MARGIN} ${outerW} ${outerH}`}
            onPointerMove={handleDragMove}
            onPointerUp={handleDragEnd}
            onPointerCancel={handleDragEnd}
            style={{ touchAction: "none" }}
          >
            {/* 보드 가이드 */}
            <rect x={0} y={0} width={boardWidth} height={boardHeight} fill="#fafafa" stroke="#ddd" strokeWidth="2" />

            {pieces.map((p) => (
              <PuzzlePiece
                key={p.id}
                data={p}
                pieceSize={pieceSize}
                rows={rows}
                cols={cols}
                imageSrc={imageSrc}
                onDragStart={handleDragStart}
              />
            ))}
          </svg>
        </div>

        {isCleared && (
          <div className="mt-4 text-center text-stone-700">
            🎉 완료! (모든 조각이 스냅됨)
          </div>
        )}
      </div>
    </div>
  );
};
