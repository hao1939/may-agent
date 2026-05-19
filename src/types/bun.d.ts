declare module "bun" {
  export function plugin(options: {
    name: string;
    setup(build: {
      onResolve(
        options: { filter: RegExp },
        callback: (args: { path: string; importer: string }) => { path: string } | Promise<{ path: string }>,
      ): void;
    }): void;
  }): void;
}
