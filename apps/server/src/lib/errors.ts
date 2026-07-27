// A real Error subclass, not a `{ statusCode, message }` object literal --
// gets a stack trace for free, and TypeScript checks the shape at every
// throw site instead of trusting an inline literal. Drop-in compatible with
// the global error handler in index.ts, which only ever read `.statusCode`
// and `.message` off the thrown value to begin with.
export class HttpError extends Error {
  statusCode: number
  code?: string

  constructor(statusCode: number, message: string, code?: string) {
    super(message)
    this.name = 'HttpError'
    this.statusCode = statusCode
    this.code = code
  }
}
