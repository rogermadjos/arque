/* eslint-disable @typescript-eslint/no-unused-vars */
import R from 'ramda';
import { Event, Snapshot } from './types';

export interface EventStoreStreamReceiver {
  stop(): Promise<void>;
}

type Transaction = {
  commit(): Promise<void>;
  abort(): Promise<void>;
};

export interface EventStoreStreamAdapter {
  sendEvents(data: { streams: string[], event: Event }[]): Promise<Transaction>;
  receiveEvents(
    stream: string,
    handler: (event: Event) => Promise<void>
  ): Promise<EventStoreStreamReceiver>;
}

export interface EventStoreStorageAdapter {
  saveEvents(params: {
    aggregate: {
      id: Buffer;
      version: number;
    };
    timestamp: Date;
    events: Pick<Event, 'id' | 'type' | 'body' | 'meta'>[];
  }): Promise<Transaction>;

  listEvents<TEvent = Event>(params: {
    aggregate: {
      id: Buffer;
      version?: number;
    };
  }): Promise<AsyncIterableIterator<TEvent>>;

  saveSnapshot<TState = unknown>(params: Snapshot<TState>): Promise<void>;

  getLatestSnapshot<TState = unknown>(params: {
    aggregate: {
      id: Buffer;
      version: number;
    };
  }): Promise<Snapshot<TState> | null>;
}

export interface EventStoreConfigurationStorageAdapter {
  listStreams(params: { event: number }): Promise<string[]>
}

export class InvalidAggregateVersionError extends Error {
  constructor(id: Buffer, version: number) {
    super(
      `invalid aggregate version: id=${id.toString('hex')} version=${version}`
    );
  }
}

export class EventStore {
  constructor(
    private readonly storageAdapter: EventStoreStorageAdapter,
    private readonly streamAdapter: EventStoreStreamAdapter,
    private readonly configurationStorageAdapter: EventStoreConfigurationStorageAdapter
  ) {}

  public async saveSnapshot<TState = unknown>(params: Snapshot<TState>): Promise<void> {
    await this.storageAdapter.saveSnapshot(params);
  }

  public async getLatestSnapshot<TState = unknown>(params: {
    aggregate: {
      id: Buffer;
      version: number;
    };
  }): Promise<Snapshot<TState> | null> {
    return this.storageAdapter.getLatestSnapshot(params);
  }

  public async listEvents<TEvent = Event>(
    params: {
      aggregate: {
        id: Buffer;
        version?: number;
      };
    }
  ): Promise<AsyncIterableIterator<TEvent>> {
    return this.storageAdapter.listEvents(params);
  }

  public async saveEvents(params: {
    aggregate: {
      id: Buffer;
      version: number;
    };
    timestamp: Date;
    events: Pick<Event, 'id' | 'type' | 'body' | 'meta'>[];
  }) {
    const events: Event[] = R.addIndex<Pick<Event, 'id' | 'type' | 'body' | 'meta'>>(R.map)(
      (item, index) => ({
        ...item,
        aggregate: {
          id: params.aggregate.id,
          version: params.aggregate.version + index,
        },
        timestamp: params.timestamp,
      }),
      params.events
    );

    const streamAdapterSendEventsData = await Promise.all(events.map(async (event) => {
      const streams = await this.configurationStorageAdapter.listStreams({ event: event.type });

      return { streams, event };
    }));

    let storageAdapterSaveEventsTransaction: Transaction;
    let streamAdapterSendEventsTransaction: Transaction;

    try {
      storageAdapterSaveEventsTransaction = await this.storageAdapter.saveEvents(params);
      streamAdapterSendEventsTransaction = await this.streamAdapter.sendEvents(streamAdapterSendEventsData);

      await storageAdapterSaveEventsTransaction.commit();
      await streamAdapterSendEventsTransaction.commit();
    } catch (err) {
      await storageAdapterSaveEventsTransaction?.abort();
      await streamAdapterSendEventsTransaction?.abort();

      throw err;
    }
  }
}