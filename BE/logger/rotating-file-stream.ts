import { appendFile, link, mkdir, readdir, stat, unlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import { Writable } from "node:stream";

/** One writer per directory. Serializes writes and retains all numbered archives. */
export class RotatingFileStream extends Writable {
  private readonly directory: string;
  private readonly activePath: string;
  private size = 0;
  private nextArchive = 1;

  constructor(directory: string, private readonly maxBytes: number) {
    super();
    if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
      throw new Error("Log file size must be a positive integer in bytes");
    }
    this.directory = resolve(directory);
    this.activePath = join(this.directory, "log");
  }

  override _construct(callback: (error?: Error | null) => void): void {
    this.initialize().then(() => callback(), callback);
  }

  private async initialize(): Promise<void> {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    for (const name of await readdir(this.directory)) {
      const match = /^log([1-9][0-9]*)$/.exec(name);
      if (match) {
        const number = Number(match[1]);
        if (!Number.isSafeInteger(number) || number >= Number.MAX_SAFE_INTEGER) {
          throw new Error("Log archive number exceeds the supported range");
        }
        this.nextArchive = Math.max(this.nextArchive, number + 1);
      }
    }
    await appendFile(this.activePath, "", { mode: 0o600 });
    this.size = (await stat(this.activePath)).size;
    if (this.size >= this.maxBytes) await this.rotate();
  }

  override _write(chunk: Buffer, _encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
    this.writeRecord(chunk).then(() => callback(), callback);
  }

  private async writeRecord(record: Buffer): Promise<void> {
    if (record.length === 0) return;
    if (this.size > 0 && this.size + record.length > this.maxBytes) await this.rotate();
    await appendFile(this.activePath, record, { mode: 0o600 });
    this.size += record.length;
    // Preserve a single oversized record intact; rotate it rather than splitting JSON.
    if (this.size >= this.maxBytes) await this.rotate();
  }

  private async rotate(): Promise<void> {
    for (;;) {
      if (this.nextArchive >= Number.MAX_SAFE_INTEGER) throw new Error("Log archive number exhausted");
      const archivePath = join(this.directory, `log${this.nextArchive++}`);
      try {
        // Exclusive archive creation prevents overwriting an existing numbered file.
        await link(this.activePath, archivePath);
        break;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      }
    }
    await unlink(this.activePath);
    await appendFile(this.activePath, "", { mode: 0o600 });
    this.size = 0;
  }
}
