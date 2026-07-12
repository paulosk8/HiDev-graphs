declare module 'mammoth' {
  interface ResultadoMammoth {
    value: string
    messages: unknown[]
  }
  export function extractRawText(input: { buffer: Buffer }): Promise<ResultadoMammoth>
  const mammoth: { extractRawText: typeof extractRawText }
  export default mammoth
}
