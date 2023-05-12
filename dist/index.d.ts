import { CreateFFmpegOptions } from '@ffmpeg/ffmpeg';
export declare enum TaskType {
    loadFFmeg = 0,
    parseM3u8 = 1,
    downloadTs = 2,
    mergeTs = 3
}
interface ProgressCallback {
    (type: TaskType, progress: number): void;
}
type Hls2Mp4Options = {
    /**
     * max retry times while request data failed
     */
    maxRetry?: number;
    /**
     * the concurrency for download ts
     */
    tsDownloadConcurrency?: number;
};
export interface M3u8Parsed {
    url: string;
    content: string;
}
export declare function createFileUrlRegExp(ext: string, flags?: string): RegExp;
export declare function parseM3u8File(url: string, customFetch?: (url: string) => Promise<string>): Promise<M3u8Parsed>;
export default class Hls2Mp4 {
    private instance;
    private maxRetry;
    private loadRetryTime;
    private onProgress?;
    private tsDownloadConcurrency;
    private totalSegments;
    private savedSegments;
    static version: string;
    constructor({ maxRetry, tsDownloadConcurrency, ...options }: CreateFFmpegOptions & Hls2Mp4Options, onProgress?: ProgressCallback);
    private transformBuffer;
    private parseM3u8;
    private downloadTs;
    private downloadSegments;
    private downloadM3u8;
    private loopLoadFile;
    private loadFFmpeg;
    download(url: string): Promise<ArrayBufferLike>;
    saveToFile(buffer: ArrayBufferLike, filename: string): void;
}
export {};
