import { EventId } from './event-id';

export type Event<
  TType extends number = number,
  TBody extends Record<string, unknown> = Record<string, unknown>,
  TMeta extends Record<string, unknown> = Record<string, unknown>,
> = {
  id: EventId;
  type: TType;
  aggregate: {
    id: Buffer;
    version: number;
  };
  body: TBody;
  meta: TMeta;
  timestamp: Date;
};

export type EventHandler<TEvent extends Event, TState> = {
  type: TEvent['type'];
  handle(
    ctx: {
      aggregate: {
        id: Buffer;
        version: number;
      },
      state: TState;
    },
    event: TEvent
  ): TState | Promise<TState>;
};
