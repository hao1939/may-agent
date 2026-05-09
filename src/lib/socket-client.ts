export {
  connectSocketEndpoint,
  emitDaemonEvent,
  findDaemonSocket,
  sendAgentMessage,
  sendDaemonEvent,
  sendDaemonInput,
  sendSocketCommand,
  waitForSocketEvent,
} from "../../packages/control-client/src/index.js";
export type {
  FindDaemonSocketOptions,
  SocketEndpoint,
  SocketEvent,
  SocketResponse,
} from "../../packages/control-client/src/index.js";
