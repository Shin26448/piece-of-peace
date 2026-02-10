// App.tsx
import React, { useState } from "react";
import { PuzzleBoard } from "./components/PuzzleBoard";

type Level = {
  id: number;
  title: string;
  rows: number;
  cols: number;
  snapThreshold: number;
  imageSrc: string;
};

const LEVELS: Level[] = [
  { id: 1, title: "LEVEL 1", rows: 6, cols: 4, snapThreshold: 25, imageSrc: "https://picsum.photos/id/15/800/600" },
  { id: 2, title: "LEVEL 2", rows: 8, cols: 6, snapThreshold: 25, imageSrc: "https://picsum.photos/id/20/800/600" },
  { id: 3, title: "LEVEL 3", rows: 10, cols: 8, snapThreshold: 30, imageSrc: "https://picsum.photos/id/30/800/600" },
];

export default function App() {
  const [selectedLevel, setSelectedLevel] = useState<Level | null>(null);

  if (selectedLevel) {
    return (
      <PuzzleBoard
        rows={selectedLevel.rows}
        cols={selectedLevel.cols}
        snapThreshold={selectedLevel.snapThreshold}
        imageSrc={selectedLevel.imageSrc}
        title={selectedLevel.title}
        onBack={() => setSelectedLevel(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-stone-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6">
        <div className="text-center">
          <div className="text-3xl tracking-widest text-stone-700 font-light">PIECE OF PEACE</div>
          <div className="mt-2 text-stone-500">레벨을 선택하세요!</div>
        </div>

        <div className="mt-6 grid gap-3">
          {LEVELS.map((lv) => (
            <button
              key={lv.id}
              onClick={() => setSelectedLevel(lv)}
              className="w-full py-4 rounded-xl bg-stone-50 hover:bg-stone-100 border border-stone-200 text-stone-700 text-left px-4"
              type="button"
            >
              <div className="flex items-center justify-between">
                <div className="font-medium">{lv.title}</div>
                <div className="text-sm text-stone-500">
                  {lv.rows} x {lv.cols}
                </div>
              </div>
              <div className="text-sm text-stone-500 mt-1">난이도: {lv.id}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
