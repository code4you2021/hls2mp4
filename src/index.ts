import { createFFmpeg, fetchFile, CreateFFmpegOptions, FFmpeg } from '@ffmpeg/ffmpeg';

export enum TaskType {
    loadFFmeg = 0,
    parseM3u8 = 1,
    downloadTs = 2,
    mergeTs = 3
}

interface ProgressCallback {
    (type: TaskType, progress: number): void
}

export interface M3u8Parsed {
    url: string;
    content: string;
}

export function createFileUrlRegExp(ext: string, flags?: string) {
    return new RegExp('(https?://)?[\\w:\\.\\-\\/]+?\\.' + ext, flags)
}

function parseUrl(url: string, path: string) {
    if (path.startsWith('http')) {
        return path;
    }
    return new URL(path, url).href;
}

export async function parseM3u8File(url: string, customFetch?: (url: string) => Promise<string>): Promise<M3u8Parsed> {
    let playList = '';
    if (customFetch) {
        playList = await customFetch(url)
    }
    else {
        playList = await fetchFile(url).then(
            data => new Blob([data.buffer]).text()
        )
    }
    const matchedM3u8 = playList.match(
        createFileUrlRegExp('m3u8', 'i')
    )
    if (matchedM3u8) {
        const parsedUrl = parseUrl(url, matchedM3u8[0])
        return parseM3u8File(parsedUrl, customFetch)
    }
    return {
        url,
        content: playList
    }
}

export default class Hls2Mp4 {

    private instance: FFmpeg;
    public onProgress?: ProgressCallback;

    constructor(options: CreateFFmpegOptions, onProgress?: ProgressCallback) {
        this.instance = createFFmpeg(options);
        this.onProgress = onProgress;
    }

    private async downloadM3u8(url: string) {
        this.onProgress?.(TaskType.parseM3u8, 0)
        let { content, url: parsedUrl } = await parseM3u8File(url)
        const keyMatch = content.match(
            createFileUrlRegExp('key', 'i')
        )
        if (keyMatch) {
            const key = keyMatch[0]
            const keyUrl = parseUrl(parsedUrl, key)
            const keyName = 'key.key'
            this.instance.FS('writeFile', keyName, await fetchFile(keyUrl))
            content = content.replace(key, keyName)
        }
        this.onProgress?.(TaskType.parseM3u8, 1)
        const segs = content.match(
            createFileUrlRegExp('ts', 'gi')
        )
        for (let i = 0; i < segs.length; i++) {
            const tsUrl = parseUrl(parsedUrl, segs[i])
            const segName = `seg-${i}.ts`
            this.instance.FS('writeFile', segName, await fetchFile(tsUrl))
            this.onProgress?.(TaskType.downloadTs, (i + 1) / segs.length)
            content = content.replace(segs[i], segName)
        }
        const m3u8 = 'temp.m3u8'
        this.instance.FS('writeFile', m3u8, content)
        return m3u8
    }

    public async download(url: string) {
        this.onProgress?.(TaskType.loadFFmeg, 0)
        await this.instance.load();
        this.onProgress?.(TaskType.loadFFmeg, 1)
        const m3u8 = await this.downloadM3u8(url);
        this.onProgress?.(TaskType.mergeTs, 0);
        await this.instance.run('-i', m3u8, '-c', 'copy', 'temp.mp4', '-loglevel', 'debug');
        const data = this.instance.FS('readFile', 'temp.mp4');
        this.instance.exit();
        this.onProgress?.(TaskType.mergeTs, 1);
        return data.buffer;
    }

    public saveToFile(buffer: ArrayBufferLike, filename: string) {
        const objectUrl = URL.createObjectURL(new Blob([buffer], { type: 'video/mp4' }));
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = filename;
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 100);
    }
}
