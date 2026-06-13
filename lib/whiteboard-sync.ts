export interface DrawingPoint {
  x: number;
  y: number;
  color: string;
  size: number;
}

export class WhiteboardSyncManager {
  private queue: DrawingPoint[] = [];
  private syncCallback: (points: DrawingPoint[]) => void;
  private throttleMs: number;
  private timer: NodeJS.Timeout | null = null;

  constructor(syncCallback: (points: DrawingPoint[]) => void, throttleMs: number = 100) {
    this.syncCallback = syncCallback;
    this.throttleMs = throttleMs;
  }

  public addPoint(point: DrawingPoint) {
    this.queue.push(point);

    if (!this.timer) {
      this.timer = setTimeout(() => {
        this.flush();
      }, this.throttleMs);
    }
  }

  private flush() {
    if (this.queue.length > 0) {
      this.syncCallback([...this.queue]);
      this.queue = [];
    }
    this.timer = null;
  }
}
