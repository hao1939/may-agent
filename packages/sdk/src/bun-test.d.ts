// Shared by the standalone SDK target and the Host's packages/ inclusion.
// Minimal compatibility declarations; replacing their any types is separate work.
declare module "bun:test" {
  export const afterAll: any;
  export const afterEach: any;
  export const beforeAll: any;
  export const beforeEach: any;
  export const describe: any;
  export const expect: any;
  export const it: any;
  export const test: any;
  export const vi: any;
}
