export class BrowserClipboard {
  /** @param {{writeText(text: string): Promise<void>} | undefined} clipboard */
  constructor(clipboard) {
    this.clipboard = clipboard;
  }
  async write(text) {
    if (!this.clipboard?.writeText)
      throw new Error(
        "Clipboard access is unavailable. Open Fitty over HTTPS or use Export as plan.",
      );
    try {
      await this.clipboard.writeText(text);
    } catch {
      throw new Error(
        "Could not copy workout JSON. Allow clipboard access and try again, or use Export as plan.",
      );
    }
  }
}
