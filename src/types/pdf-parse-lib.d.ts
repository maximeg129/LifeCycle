// `@types/pdf-parse` only declares the top-level `pdf-parse` module — we
// import `pdf-parse/lib/pdf-parse.js` directly instead (see the comment in
// api/library/extract-pdf/route.ts for why), which needs its own ambient
// declaration. Same shape as @types/pdf-parse's, since it's the exact same
// function re-exported.
declare module 'pdf-parse/lib/pdf-parse.js' {
  interface PdfParseResult {
    numpages: number
    numrender: number
    info: unknown
    metadata: unknown
    version: string
    text: string
  }
  interface PdfParseOptions {
    pagerender?: ((pageData: unknown) => string | Promise<string>) | undefined
    max?: number | undefined
    version?: string | undefined
  }
  function pdfParse(dataBuffer: Buffer, options?: PdfParseOptions): Promise<PdfParseResult>
  export = pdfParse
}
