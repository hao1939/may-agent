export {
  connectSocketEndpoint,
  emitDaemonEvent,
  sendAgentMessage,
  sendDaemonEvent,
  sendDaemonInput,
  sendSocketCommand,
  waitForSocketEvent,
} from "../../packages/control/src/client.js";
export type {
  SocketEndpoint,
  SocketEvent,
  SocketResponse,
} from "../../packages/control/src/client.js";
