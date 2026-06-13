export interface SyncAction {
  type: string;
  payload: any;
}

export class OfflineSyncManager {
  private queue: SyncAction[] = [];
  private onlineHandler?: (action: SyncAction) => Promise<boolean>;

  constructor() {
    // Basic setup, in a real scenario we might load queue from localForage/IndexedDB here
  }

  public setOnlineHandler(handler: (action: SyncAction) => Promise<boolean>) {
    this.onlineHandler = handler;
  }

  public async queueAction(action: SyncAction): Promise<void> {
    if (global.navigator && global.navigator.onLine) {
      // Execute immediately if online
      if (this.onlineHandler) {
        await this.onlineHandler(action);
      }
    } else {
      // Queue it up if offline
      this.queue.push(action);
    }
  }

  public getQueue(): SyncAction[] {
    return this.queue;
  }

  public async syncQueue(): Promise<void> {
    if (!this.onlineHandler || this.queue.length === 0) return;

    const actionsToSync = [...this.queue];
    this.queue = [];

    for (const action of actionsToSync) {
      try {
        await this.onlineHandler(action);
      } catch (e) {
        // Re-queue if it failed
        this.queue.push(action);
      }
    }
  }
}
