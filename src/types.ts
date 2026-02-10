// src/types.ts
export enum SideType {
  FLAT = 0,
  TAB = 1,
  SLOT = 2,
}

export interface PuzzlePieceData {
  id: number;
  groupId: number; // 그룹 이동을 위한 ID
  row: number;
  col: number;
  top: SideType;
  right: SideType;
  bottom: SideType;
  left: SideType;
  path: string;
  position: { x: number; y: number };
  correctPosition: { x: number; y: number };
  isSolved: boolean;
}
