/* eslint-disable @typescript-eslint/no-unused-vars */
import { Snapshot } from './types';
import { Event } from './event';

export class EventStore {
  public async saveSnapshot(params: {
    aggregate: {
      id: Buffer;
      version: number;
    };
    state: unknown;
    timestamp: Date;
  }): Promise<void> {
    throw new Error('not implemented');
  }

  public async getLatestSnapshot<TState = unknown>(params: {
    aggregate: {
      id: Buffer;
      version: number;
    };
  }): Promise<Snapshot<TState> | null> {
    throw new Error('not implemented');
  }

  public async listEvents<TEvent = Event>(
    params: {
      aggregate: {
        id: Buffer;
        version?: number;
      };
    }
  ): Promise<AsyncIterableIterator<TEvent>> {
    throw new Error('not implemented');
  }

  public async saveEvents(params: {
    aggregate: {
      id: Buffer;
      version: number;
    };
    timestamp: Date;
    events: Pick<Event, 'id' | 'type' | 'body' | 'meta'>[];
  }) {
    throw new Error('not implemented');
  }
}