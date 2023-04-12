export type Snapshot<TState = unknown> = {
  aggregate: {
    id: Buffer;
    version: number;
  };
  state: TState;
  timestamp: Date;
};