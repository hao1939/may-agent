/** The saved input cannot succeed unchanged; its caller must submit a correction. */
export class AppTaskAdmissionError extends Error {
  readonly name: string = "AppTaskAdmissionError";
}
