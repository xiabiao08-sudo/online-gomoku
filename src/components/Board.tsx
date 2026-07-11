import {
  CSSProperties,
  PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { BOARD_SIZE, Point, PublicRoomState, Stone } from "../shared/game";

interface Props {
  room: PublicRoomState;
  myColor: Stone | null;
  onPlaceStone: (x: number, y: number) => Promise<boolean>;
  requireConfirmation: boolean;
  onToggleConfirmation: () => void;
  onOpenChat: () => void;
  unreadCount: number;
  onShare: () => void;
}

const ZOOM_LEVELS = [1, 1.25, 1.5, 1.75, 2];
const STAR_POINTS = new Set([
  "3:3", "9:3", "15:3",
  "3:9", "9:9", "15:9",
  "3:15", "9:15", "15:15"
]);

interface PointerPosition {
  x: number;
  y: number;
}

export function Board({
  room,
  myColor,
  onPlaceStone,
  requireConfirmation,
  onToggleConfirmation,
  onOpenChat,
  unreadCount,
  onShare
}: Props) {
  const [selectedPoint, setSelectedPoint] = useState<Point | null>(null);
  const [zoom, setZoom] = useState(1);
  const [placing, setPlacing] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const pointersRef = useRef(new Map<number, PointerPosition>());
  const lastPointerRef = useRef<PointerPosition | null>(null);
  const pinchDistanceRef = useRef<number | null>(null);
  const draggingRef = useRef(false);
  const pinchingRef = useRef(false);
  const suppressClickRef = useRef(false);

  const playersOnline = Boolean(
    room.players.black?.online &&
      room.players.white?.online &&
      !room.players.black.left &&
      !room.players.white.left
  );
  const canPlay =
    room.status === "playing" &&
    myColor === room.currentTurn &&
    playersOnline &&
    !room.undoRequest &&
    !placing;
  const winningKeys = useMemo(
    () => new Set(room.winningLine.map((point) => `${point.x}:${point.y}`)),
    [room.winningLine]
  );
  const lastMoveKey = room.lastMove ? `${room.lastMove.x}:${room.lastMove.y}` : "";
  const selectedKey = selectedPoint ? `${selectedPoint.x}:${selectedPoint.y}` : "";
  const boardStyle = {
    "--board-size": BOARD_SIZE,
    "--line-count": BOARD_SIZE - 1
  } as CSSProperties;

  useEffect(() => {
    setSelectedPoint(null);
  }, [room.moveCount, room.gameNumber, room.currentTurn, myColor]);

  function changeZoom(nextZoom: number) {
    setZoom(Math.min(2, Math.max(1, nextZoom)));
  }

  function zoomByStep(direction: -1 | 1) {
    const currentIndex = ZOOM_LEVELS.reduce((best, level, index) =>
      Math.abs(level - zoom) < Math.abs(ZOOM_LEVELS[best] - zoom) ? index : best
    , 0);
    const nextIndex = Math.min(
      ZOOM_LEVELS.length - 1,
      Math.max(0, currentIndex + direction)
    );
    changeZoom(ZOOM_LEVELS[nextIndex]);
  }

  async function selectPoint(point: Point) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (!canPlay || room.board[point.y][point.x]) {
      return;
    }
    if (!requireConfirmation) {
      setPlacing(true);
      try {
        await onPlaceStone(point.x, point.y);
      } finally {
        setPlacing(false);
      }
      return;
    }
    if (selectedPoint?.x === point.x && selectedPoint.y === point.y) {
      await confirmSelection();
      return;
    }
    setSelectedPoint(point);
  }

  async function confirmSelection() {
    if (!selectedPoint || !canPlay) {
      return;
    }
    setPlacing(true);
    try {
      const placed = await onPlaceStone(selectedPoint.x, selectedPoint.y);
      if (placed) {
        setSelectedPoint(null);
      }
    } finally {
      setPlacing(false);
    }
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    lastPointerRef.current = { x: event.clientX, y: event.clientY };
    if (pointersRef.current.size >= 2) {
      pinchingRef.current = true;
      draggingRef.current = false;
      pinchDistanceRef.current = pointerDistance([...pointersRef.current.values()].slice(0, 2));
      setSelectedPoint(null);
    }
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const viewport = viewportRef.current;
    if (!viewport || !pointersRef.current.has(event.pointerId)) {
      return;
    }
    const previous = pointersRef.current.get(event.pointerId)!;
    const current = { x: event.clientX, y: event.clientY };
    pointersRef.current.set(event.pointerId, current);

    if (pointersRef.current.size >= 2) {
      event.preventDefault();
      viewport.setPointerCapture?.(event.pointerId);
      const positions = [...pointersRef.current.values()].slice(0, 2);
      const distance = pointerDistance(positions);
      const previousDistance = pinchDistanceRef.current ?? distance;
      if (previousDistance > 0) {
        changeZoom(zoom * (distance / previousDistance));
      }
      pinchDistanceRef.current = distance;
      pinchingRef.current = true;
      suppressClickRef.current = true;
      return;
    }

    if (zoom > 1) {
      const totalDistance = lastPointerRef.current
        ? Math.hypot(current.x - lastPointerRef.current.x, current.y - lastPointerRef.current.y)
        : 0;
      if (draggingRef.current || totalDistance > 8) {
        event.preventDefault();
        viewport.setPointerCapture?.(event.pointerId);
        draggingRef.current = true;
        suppressClickRef.current = true;
        viewport.scrollLeft -= current.x - previous.x;
        viewport.scrollTop -= current.y - previous.y;
      }
    }
  }

  function handlePointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    pointersRef.current.delete(event.pointerId);
    if (pinchingRef.current || draggingRef.current) {
      suppressClickRef.current = true;
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 80);
    }
    if (pointersRef.current.size === 0) {
      draggingRef.current = false;
      pinchingRef.current = false;
      pinchDistanceRef.current = null;
      lastPointerRef.current = null;
    } else {
      lastPointerRef.current = [...pointersRef.current.values()][0] ?? null;
    }
  }

  function resetView() {
    changeZoom(1);
    const viewport = viewportRef.current;
    if (viewport) {
      viewport.scrollTo({ left: 0, top: 0, behavior: "smooth" });
    }
  }

  function scrollToLastMove() {
    if (!room.lastMove || !viewportRef.current) {
      return;
    }
    const viewport = viewportRef.current;
    const canvas = viewport.querySelector<HTMLElement>(".board-canvas");
    if (!canvas) {
      return;
    }
    const xRatio = room.lastMove.x / (BOARD_SIZE - 1);
    const yRatio = room.lastMove.y / (BOARD_SIZE - 1);
    viewport.scrollTo({
      left: Math.max(0, canvas.offsetWidth * xRatio - viewport.clientWidth / 2),
      top: Math.max(0, canvas.offsetHeight * yRatio - viewport.clientHeight / 2),
      behavior: "smooth"
    });
  }

  return (
    <section className="board-section" aria-label="棋盘区域">
      <div className="board-toolbar" aria-label="棋盘工具">
        <div>
          <strong>第 {room.gameNumber} 局</strong>
          <span> · 19×19 自由五子棋</span>
        </div>
        <div className="zoom-actions">
          <button type="button" className="compact-button" onClick={() => zoomByStep(-1)} disabled={zoom <= 1} aria-label="缩小棋盘">−</button>
          <output aria-live="polite">{Math.round(zoom * 100)}%</output>
          <button type="button" className="compact-button" onClick={() => zoomByStep(1)} disabled={zoom >= 2} aria-label="放大棋盘">＋</button>
          <button type="button" className="compact-button reset-zoom" onClick={resetView} disabled={zoom === 1}>居中</button>
          <button type="button" className="compact-button" onClick={scrollToLastMove} disabled={!room.lastMove}>最后一步</button>
        </div>
      </div>

      <div
        ref={viewportRef}
        className="board-viewport"
        data-zoomed={zoom > 1 ? "true" : "false"}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onDoubleClick={resetView}
      >
        <div className="board-canvas" style={{ width: `${zoom * 100}%` }}>
          <div className="board-wrap" aria-label={`${BOARD_SIZE} x ${BOARD_SIZE} 五子棋棋盘`}>
            <div className="board-grid" style={boardStyle}>
              {Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => {
                const x = index % BOARD_SIZE;
                const y = Math.floor(index / BOARD_SIZE);
                const stone = room.board[y][x];
                const key = `${x}:${y}`;
                const stoneLabel = stone ? `${stone === "black" ? "黑" : "白"}棋` : "空位";
                const isSelected = selectedKey === key;
                return (
                  <button
                    key={key}
                    type="button"
                    className={`point ${stone ? "occupied" : ""} ${winningKeys.has(key) ? "winning" : ""} ${isSelected ? "selected" : ""}`}
                    aria-label={`第 ${x + 1} 列，第 ${y + 1} 行，${stoneLabel}${isSelected ? "，已选择" : ""}`}
                    aria-pressed={isSelected}
                    disabled={!canPlay || Boolean(stone)}
                    onClick={() => void selectPoint({ x, y })}
                  >
                    {STAR_POINTS.has(key) ? <span className="star-point" aria-hidden="true" /> : null}
                    {stone ? (
                      <span className={`stone ${stone}`} />
                    ) : (
                      <span className={`preview-stone ${isSelected && myColor ? myColor : ""}`} />
                    )}
                    {lastMoveKey === key ? <span className="last-move" /> : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        {room.status === "starting" ? (
          <div className="board-overlay starting-overlay" role="status">
            <span className="hourglass" aria-hidden="true">⌛</span>
            <strong>正在随机分配黑白</strong>
            <span>请稍候 1 秒…</span>
          </div>
        ) : null}
        {room.status === "finished" ? (
          <div className="victory-stamp" aria-label={room.isDraw ? "和棋" : `${room.winner === "black" ? "黑" : "白"}棋获胜`}>
            {room.isDraw ? "和棋" : `${room.winner === "black" ? "黑" : "白"}胜`}
          </div>
        ) : null}
      </div>

      <div className="placement-panel">
        {selectedPoint && myColor && requireConfirmation ? (
          <>
            <Magnifier room={room} point={selectedPoint} previewColor={myColor} />
            <div className="placement-copy">
              <strong>候选位置：第 {selectedPoint.x + 1} 列，第 {selectedPoint.y + 1} 行</strong>
              <span>再次点击该交叉点，或点击“确认落子”。</span>
            </div>
            <div className="placement-actions">
              <button type="button" onClick={() => setSelectedPoint(null)} disabled={placing}>取消</button>
              <button type="button" className="primary-action" onClick={() => void confirmSelection()} disabled={!canPlay}>
                {placing ? "正在落子" : "确认落子"}
              </button>
            </div>
          </>
        ) : (
          <p className="placement-hint">
            {myColor
              ? canPlay
                ? requireConfirmation
                  ? "轻点交叉点预览；双指缩放，放大后单指拖动。"
                  : "确认已关闭，轻点空位将直接落子。"
                : "当前不可落子，仍可缩放和查看棋盘。"
              : "你正在观战，可缩放和拖动查看棋盘。"}
          </p>
        )}
      </div>

      {showMore ? (
        <div className="mobile-more-menu" role="dialog" aria-label="更多棋盘操作">
          <button type="button" onClick={() => zoomByStep(-1)} disabled={zoom <= 1}>缩小</button>
          <button type="button" onClick={() => zoomByStep(1)} disabled={zoom >= 2}>放大</button>
          <button type="button" onClick={scrollToLastMove} disabled={!room.lastMove}>最后一步</button>
          <button type="button" onClick={resetView}>棋盘居中</button>
          <button type="button" onClick={onShare}>分享房间</button>
        </div>
      ) : null}

      <nav className="mobile-bottom-bar" aria-label="移动端对局操作">
        <button type="button" onClick={() => setSelectedPoint(null)} disabled={!selectedPoint}>取消选择</button>
        <button type="button" className="primary-action" onClick={() => void confirmSelection()} disabled={!selectedPoint || !canPlay || !requireConfirmation}>确认落子</button>
        <button type="button" onClick={onOpenChat}>聊天{unreadCount > 0 ? <span className="unread-badge">{Math.min(unreadCount, 9)}</span> : null}</button>
        <button type="button" onClick={() => setShowMore((value) => !value)}>更多</button>
      </nav>

      <button type="button" className="confirmation-toggle mobile-only" onClick={onToggleConfirmation}>
        确认落子：{requireConfirmation ? "开" : "关"}
      </button>
    </section>
  );
}

function Magnifier({ room, point, previewColor }: { room: PublicRoomState; point: Point; previewColor: Stone }) {
  const radius = 2;
  const cells = [];
  for (let y = point.y - radius; y <= point.y + radius; y += 1) {
    for (let x = point.x - radius; x <= point.x + radius; x += 1) {
      const inside = x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE;
      const isCenter = x === point.x && y === point.y;
      const stone = inside ? room.board[y][x] : null;
      cells.push(
        <span key={`${x}:${y}`} className={`magnifier-cell ${inside ? "" : "outside"} ${isCenter ? "center" : ""}`} aria-hidden="true">
          {stone ? <span className={`magnifier-stone ${stone}`} /> : null}
          {isCenter && !stone ? <span className={`magnifier-stone preview ${previewColor}`} /> : null}
        </span>
      );
    }
  }

  return <div className="board-magnifier" aria-label="所选落子点的五乘五放大预览">{cells}</div>;
}

function pointerDistance(positions: PointerPosition[]): number {
  if (positions.length < 2) {
    return 0;
  }
  return Math.hypot(positions[0].x - positions[1].x, positions[0].y - positions[1].y);
}
