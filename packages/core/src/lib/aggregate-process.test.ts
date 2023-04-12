import { randomBytes } from 'crypto';
import { Event, EventHandler } from './event';
import { Aggregate } from './aggregate';
import { Command, CommandHandler } from './command';
import { EventStore } from './event-store';
import { arrayToAsyncIterableIterator } from './util';
import { EventId } from './event-id';

enum EventType {
  BalanceUpdated = 0,
}

enum CommandType {
  UpdateBalance = 0,
}

type BalanceUpdatedEvent = Event<
  EventType.BalanceUpdated,
  { balance: number; amount: number }
>;

type UpdateBalanceCommand = Command<
  CommandType.UpdateBalance,
  [{ amount: number }]
>;

type State = { balance: number };


describe('Aggregate#process', () => {
  const eventHandler: EventHandler<BalanceUpdatedEvent, State> = {
    type: EventType.BalanceUpdated,
    handle(_, event) {
      return {
        balance: event.body.balance,
      };
    },
  };

  const commandHandler: CommandHandler<UpdateBalanceCommand, BalanceUpdatedEvent, State> = {
    type: CommandType.UpdateBalance,
    handle(ctx, _, params) {
      const balance = ctx.state.balance + params.amount;

      if (balance < 0) {
        throw new Error('insufficient balance');
      }

      return {
        type: EventType.BalanceUpdated,
        body: { balance, amount: params.amount },
      };
    },
  };

  test.concurrent('process', async () => {
    const id = randomBytes(13);

    const EventStoreMock = {
      saveEvents: jest.fn().mockResolvedValue(undefined),
      listEvents: jest.fn().mockResolvedValue(arrayToAsyncIterableIterator([])),
      getLatestSnapshot: jest.fn().mockResolvedValue(null),
    };

    const aggregate = new Aggregate<UpdateBalanceCommand, BalanceUpdatedEvent, State>(
      EventStoreMock as never as EventStore,
      [commandHandler],
      [eventHandler],
      id,
      0,
      { balance: 0 }
    );

    await aggregate.process({
      type: CommandType.UpdateBalance,
      args: [{ amount: 10 }],
    });

    expect(EventStoreMock.saveEvents).toBeCalledWith({
      aggregate: {
        id,
        version: 1,
      },
      timestamp: expect.any(Date),
      events: [
        {
          id: expect.any(EventId),
          type: EventType.BalanceUpdated,
          body: { balance: 10, amount: 10 },
          meta: {},
        },
      ],
    });
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
    expect(aggregate.state).toEqual({ balance: 10 });
    expect(aggregate.version).toEqual(1);
  });

  test.concurrent('invalid command', async () => {
    const id = randomBytes(13);

    const EventStoreMock = {
      listEvents: jest.fn().mockResolvedValue(arrayToAsyncIterableIterator([])),
      getLatestSnapshot: jest.fn().mockResolvedValue(null),
    };

    const aggregate = new Aggregate<UpdateBalanceCommand, BalanceUpdatedEvent, State>(
      EventStoreMock as never as EventStore,
      [commandHandler],
      [eventHandler],
      id,
      0,
      { balance: 0 }
    );

    await expect(aggregate.process({
      type: CommandType.UpdateBalance,
      args: [{ amount: -10 }],
    })).rejects.toThrowError('insufficient balance');
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
    expect(aggregate.state).toEqual({ balance: 0 });
    expect(aggregate.version).toEqual(0);
  });
});