export class PushNotificationManager {
  private publicVapidKey = 'BJthRQ5myDgc7OSXzPCMftGw-n16F7zQBEN7EHM6kxgK'; // Example key

  public async requestPermission(): Promise<boolean> {
    if (!('Notification' in global)) return false;
    
    const permission = await global.Notification.requestPermission();
    return permission === 'granted';
  }

  public async subscribeToPush(): Promise<PushSubscription | null> {
    const hasPermission = await this.requestPermission();
    
    if (!hasPermission || !global.navigator || !('serviceWorker' in global.navigator)) {
      return null;
    }

    try {
      const registration = await global.navigator.serviceWorker.register('/sw.js');
      
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.publicVapidKey
      });

      return subscription;
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      return null;
    }
  }
}
