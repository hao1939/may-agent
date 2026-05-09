export {
  connectSocketEndpoint,
  emitDaemonEvent,
  findDaemonSocket,
  sendAgentMessage,
  sendDaemonEvent,
  sendDaemonInput,
  sendSocketCommand,
  waitForSocketEvent,
} from "../../packages/control/src/client.js";
export type {
  FindDaemonSocketOptions,
  SocketEndpoint,
  SocketEvent,
  SocketResponse,
} from "../../packages/control/src/client.js";
