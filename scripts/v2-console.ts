#!/usr/bin/env -S npx tsx

import { resolve } from "path";
import { runChatLoop } from "../src/v2/chat-loop.js";

const persistDir = resolve(process.cwd(), ".state");
runChatLoop(persistDir).catch(console.error);
