import { Event } from './event';

export type Command<
  TType extends number = number,
  TArgs extends Array<unknown> = Array<unknown>,
> = {
  type: TType;
  args: TArgs;
};

export type GeneratedEvent<TEvent extends Event> = Pick<
  TEvent,
  'type' | 'body'
> &
  Partial<Pick<TEvent, 'meta'>>;

export type CommandHandler<
  TCommand extends Command,
  TEvent extends Event,
  TState,
> = {
  type: TCommand['type'];
  handle(
    ctx: {
      aggregate: {
        id: Buffer;
        version: number;
      },
      state: TState;
    },
    command: TCommand,
    ...args: TCommand['args']
  ):
    | GeneratedEvent<TEvent>
    | GeneratedEvent<TEvent>[]
    | Promise<GeneratedEvent<TEvent>>
    | Promise<GeneratedEvent<TEvent>[]>;
};
