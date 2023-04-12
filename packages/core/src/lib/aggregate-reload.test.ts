import { randomBytes } from 'crypto';
import R from 'ramda';
import { Event } from './event';
import { EventId } from './event-id';
import { Aggregate } from './aggregate';
import { Command } from './command';
import { EventStore } from './event-store';
import { arrayToAsyncIterableIterator } from './util';

enum EventType {
  BalanceUpdated = 0,
}

type BalanceUpdatedEvent = Event<
  EventType.BalanceUpdated,
  { amount: number }
>;

describe('Aggregate#reload', () => {
  const handler = {
    type: EventType.BalanceUpdated,
    handle(ctx, event: BalanceUpdatedEvent) {  
      return {
        balance: ctx.state.balance + event.body.amount,
      };
    },
  };

  test.concurrent('reload', async () => {
    const id = randomBytes(13);
    const amount = 10;
    const timestamp = new Date();
    const events = R.times((index) => ({
      id: new EventId(),
      type: EventType.BalanceUpdated,
      aggregate: {
        id,
        version: index + 1,
      },
      body: { amount },
      meta: {},
      timestamp,
    }), 10);

    const EventStoreMock = {
      listEvents: jest.fn().mockResolvedValue(arrayToAsyncIterableIterator(events)),
      getLatestSnapshot: jest.fn().mockResolvedValue(null),
    };

    const aggregate = new Aggregate<Command<number, number[]>, BalanceUpdatedEvent, { balance: number }>(
      EventStoreMock as never as EventStore,
      [],
      [handler],
      id,
      0,
      { balance: 0 }
    );

    await aggregate.reload();

    expect(EventStoreMock.listEvents).toBeCalledWith({
      aggregate: {
        id,
        version: 0,
      },
    });
    expect(EventStoreMock.getLatestSnapshot).toBeCalledWith({
      aggregate: {
        id,
        version: 0,
      },
    });
    expect(aggregate.state).toEqual({ balance: events.length * amount });
    expect(aggregate.version).toEqual(events.length);
  });

  test.concurrent('reload multiple times, concurrently', async () => {
    const id = randomBytes(13);
    const amount = 10;

    const generateEvents = (offset: number) => {
      const timestamp = new Date();

      return R.times(
        (index) => ({
          id: new EventId(),
          type: EventType.BalanceUpdated,
          aggregate: {
            id: id.buffer,
            version: offset + index + 1,
          },
          body: { amount },
          meta: {},
          timestamp,
        }),
        10
      );
    };

    const EventStoreMock = {
      listEvents: jest
        .fn()
        .mockImplementationOnce(async () => generateEvents(0))
        .mockImplementationOnce(async () => generateEvents(10))
        .mockImplementationOnce(async () => generateEvents(20)),
      getLatestSnapshot: jest.fn().mockResolvedValue(null),
    };

    const aggregate = new Aggregate<Command<number, number[]>, BalanceUpdatedEvent, { balance: number }>(
      EventStoreMock as never as EventStore,
      [],
      [handler],
      id,
      0,
      { balance: 0 }
    );

    await Promise.all(R.times(() => aggregate.reload(), 3));

    expect(EventStoreMock.listEvents).toBeCalledTimes(3);
    expect(EventStoreMock.getLatestSnapshot).toBeCalledTimes(3);
    expect(aggregate.state).toEqual({ balance: 30 * amount });
    expect(aggregate.version).toEqual(30);
  });

  test.concurrent('reload with snapshot', async () => {
    const timestamp = new Date();
    const id = randomBytes(13);
    const amount = 10;
    const events = R.times((index) => ({
      id: new EventId(),
      type: EventType.BalanceUpdated,
      aggregate: {
        id,
        version: 10 + index + 1,
      },
      body: { amount },
      meta: {},
      timestamp,
    }), 10);

    const EventStoreMock = {
      listEvents: jest.fn().mockResolvedValue(arrayToAsyncIterableIterator(events)),
      getLatestSnapshot: jest.fn().mockResolvedValue({
        aggregate: {
          id,
          version: 10,
        },
        state: { balance: 1000 },
        timestamp,
      }),
    };

    const aggregate = new Aggregate<Command<number, number[]>, BalanceUpdatedEvent, { balance: number }>(
      EventStoreMock as never as EventStore,
      [],
      [handler],
      id,
      0,
      { balance: 0 }
    );

    await aggregate.reload();

    expect(EventStoreMock.listEvents).toBeCalledWith({
      aggregate: {
        id,
        version: 10,
      },
    });
    expect(EventStoreMock.getLatestSnapshot).toBeCalledWith({
      aggregate: {
        id,
        version: 0,
      },
    });
    expect(aggregate.state).toEqual({ balance: events.length * amount + 1000 });
    expect(aggregate.version).toEqual(events.length + 10);
  });
});