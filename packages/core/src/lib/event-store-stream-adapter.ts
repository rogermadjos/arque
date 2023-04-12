export interface EventStoreStreamReceiver {
  stop(): Promise<void>;
}

export interface EventStoreStreamAdapter {
  sendEvent(topic: string | string[], event: Event): Promise<void>;
  receiveEvents(
    topic: string,
    handler: (event: Event) => Promise<void>
  ): Promise<EventStoreStreamReceiver>;
}