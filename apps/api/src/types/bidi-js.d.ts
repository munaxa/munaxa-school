/**
 * Minimal ambient types for `bidi-js` (which ships no declarations). Covers only the surface the PDF
 * renderer uses: paragraph embedding levels and logical→visual string reordering per UAX #9.
 */
declare module 'bidi-js' {
  export interface Paragraph {
    start: number;
    end: number;
    level: number;
  }

  export interface EmbeddingLevels {
    levels: Uint8Array;
    paragraphs: Paragraph[];
  }

  export interface BidiApi {
    getEmbeddingLevels(text: string, explicitDirection?: 'ltr' | 'rtl'): EmbeddingLevels;
    getReorderSegments(
      text: string,
      embeddingLevels: EmbeddingLevels,
      start?: number,
      end?: number,
    ): number[][];
    getReorderedIndices(
      text: string,
      embeddingLevels: EmbeddingLevels,
      start?: number,
      end?: number,
    ): number[];
    getReorderedString(
      text: string,
      embeddingLevels: EmbeddingLevels,
      start?: number,
      end?: number,
    ): string;
    getBidiCharType(char: string): number;
    getBidiCharTypeName(char: string): string;
    getMirroredCharacter(char: string): string | null;
  }

  export default function bidiFactory(): BidiApi;
}
