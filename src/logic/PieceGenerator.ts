import { SideType } from "../types";

export class PieceGenerator {
  // ==================================================================================
  // [모양 설정] 표준 직소 퍼즐 비율
  // ==================================================================================

  private static readonly TAB_HEIGHT = 0.28;
  private static readonly NECK_WIDTH = 0.22;
  private static readonly HEAD_WIDTH = 0.35;
  private static readonly JITTER = 0.04;
  private static readonly SKEW_LIMIT = 2;

  // [수정됨] 각 변마다 고유의 Seed를 받도록 변경
  public static generatePath(
    top: SideType,
    right: SideType,
    bottom: SideType,
    left: SideType,
    seedTop: number,
    seedRight: number,
    seedBottom: number,
    seedLeft: number
  ): string {
    let path = `M 0 0`;
    path += this.generateSide(top, 0, 0, 100, 0, seedTop);
    path += this.generateSide(right, 100, 0, 100, 100, seedRight);
    path += this.generateSide(bottom, 100, 100, 0, 100, seedBottom);
    path += this.generateSide(left, 0, 100, 0, 0, seedLeft);
    path += " Z";
    return path;
  }

  private static generateSide(
    type: SideType,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    seed: number
  ): string {
    if (type === SideType.FLAT) return ` L ${x2} ${y2}`;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);
    const dir = type === SideType.TAB ? -1 : 1;

    // 공유된 Seed를 사용하므로, 맞닿은 두 변은 항상 똑같은 랜덤값을 가짐
    const random = (offset: number) => {
      const x = Math.sin(seed * 999 + offset) * 10000;
      return x - Math.floor(x);
    };
    const range = (offset: number) => random(offset) * 2 - 1;

    const tabH = len * (this.TAB_HEIGHT + range(1) * this.JITTER) * dir;
    const neckW = len * (this.NECK_WIDTH + range(2) * this.JITTER);
    const headW = len * (this.HEAD_WIDTH + range(3) * this.JITTER);
    const skew = range(4) * this.SKEW_LIMIT;

    const mid = len / 2;
    const neckL = mid - neckW / 2;
    const neckR = mid + neckW / 2;

    const shoulderY = tabH * 0.15;
    const neckY = tabH * 0.22;
    const headY = tabH;

    const c1 = [
      { x: len * 0.2, y: 0 },
      { x: neckL - 2, y: shoulderY },
      { x: neckL, y: neckY },
    ];
    const c2 = [
      { x: neckL - 2, y: headY * 0.4 },
      { x: mid + skew - headW * 0.8, y: headY },
      { x: mid + skew, y: headY },
    ];
    const c3 = [
      { x: mid + skew + headW * 0.8, y: headY },
      { x: neckR + 2, y: headY * 0.4 },
      { x: neckR, y: neckY },
    ];
    const c4 = [
      { x: neckR + 2, y: shoulderY },
      { x: len * 0.8, y: 0 },
      { x: len, y: 0 },
    ];

    const toGlobal = (lx: number, ly: number) => {
      const gx = x1 + lx * Math.cos(angle) - ly * Math.sin(angle);
      const gy = y1 + lx * Math.sin(angle) + ly * Math.cos(angle);
      return `${gx.toFixed(1)} ${gy.toFixed(1)}`;
    };

    let d = "";
    [c1, c2, c3, c4].forEach((c) => {
      d += ` C ${toGlobal(c[0].x, c[0].y)}, ${toGlobal(
        c[1].x,
        c[1].y
      )}, ${toGlobal(c[2].x, c[2].y)}`;
    });
    return d;
  }
}