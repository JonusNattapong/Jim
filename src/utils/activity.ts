export interface Activity {
  id: string;
  type: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export function createActivityTracker() {
  const activities: Activity[] = [];
  let counter = 0;
  
  return {
    start(type: string, meta?: Record<string, any>): string {
      const id = "act_" + (++counter) + "_" + Date.now();
      activities.push({ id, type, timestamp: Date.now(), metadata: meta });
      if (activities.length > 1000) activities.shift();
      return id;
    },
    end(id: string): void {
      const activity = activities.find(a => a.id === id);
      if (activity && activity.metadata) {
        activity.metadata.duration = Date.now() - activity.timestamp;
      }
    },
    getRecent(limit = 10): Activity[] {
      return activities.slice(-limit);
    }
  };
}
