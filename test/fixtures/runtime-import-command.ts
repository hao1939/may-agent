import { dirname } from "node:path";
import { importRuntimeModule } from "@may-agent/sdk/runtime";

const [modulePath, cacheDir, executable] = process.argv.slice(2);
const mod = await importRuntimeModule<{ execute(root: string, executable: string): Promise<string> }>(modulePath!, {
  forceBundle: true,
  cacheDir,
});
console.log(await mod.execute(dirname(modulePath!), executable!));
