// Electron webview types for use in renderer process

declare namespace Electron {
  interface WebviewTag extends HTMLElement {
    src: string;
    preload?: string;
    nodeintegration?: boolean;
    partition?: string;
    allowpopups?: boolean;
    webpreferences?: string;
    httpreferrer?: string;
    useragent?: string;
    disablewebsecurity?: boolean;

    // Methods
    loadURL(url: string, options?: { httpReferrer?: string; userAgent?: string; extraHeaders?: string; postData?: Array<{ type: string; bytes?: Buffer; file?: string }> }): Promise<void>;
    getURL(): string;
    getTitle(): string;
    isLoading(): boolean;
    isLoadingMainFrame(): boolean;
    isWaitingForResponse(): boolean;
    stop(): void;
    reload(): void;
    reloadIgnoringCache(): void;
    canGoBack(): boolean;
    canGoForward(): boolean;
    canGoToOffset(offset: number): boolean;
    goBack(): void;
    goForward(): void;
    goToIndex(index: number): void;
    goToOffset(offset: number): void;
    isCrashed(): boolean;
    setUserAgent(userAgent: string): void;
    getUserAgent(): string;
    insertCSS(css: string): Promise<string>;
    removeInsertedCSS(key: string): Promise<void>;
    executeJavaScript(code: string, userGesture?: boolean): Promise<any>;
    openDevTools(): void;
    closeDevTools(): void;
    isDevToolsOpened(): boolean;
    isDevToolsFocused(): boolean;
    inspectElement(x: number, y: number): void;
    inspectSharedWorker(): void;
    inspectServiceWorker(): void;
    setAudioMuted(muted: boolean): void;
    isAudioMuted(): boolean;
    isCurrentlyAudible(): boolean;
    undo(): void;
    redo(): void;
    cut(): void;
    copy(): void;
    paste(): void;
    pasteAndMatchStyle(): void;
    delete(): void;
    selectAll(): void;
    unselect(): void;
    replace(text: string): void;
    replaceMisspelling(text: string): void;
    insertText(text: string): Promise<void>;
    findInPage(text: string, options?: { forward?: boolean; findNext?: boolean; matchCase?: boolean }): number;
    stopFindInPage(action: 'clearSelection' | 'keepSelection' | 'activateSelection'): void;
    print(options?: { silent?: boolean; printBackground?: boolean; deviceName?: string; color?: boolean; margins?: { marginType?: string; top?: number; bottom?: number; left?: number; right?: number }; landscape?: boolean; scaleFactor?: number; pagesPerSheet?: number; collate?: boolean; copies?: number; pageRanges?: { from: number; to: number }[]; duplexMode?: string; dpi?: { horizontal?: number; vertical?: number }; header?: string; footer?: string; pageSize?: string | { height: number; width: number } }): Promise<void>;
    printToPDF(options?: { headerFooter?: { title?: string; url?: string }; landscape?: boolean; marginsType?: number; scaleFactor?: number; pageRanges?: { from: number; to: number }[]; pageSize?: string | { height: number; width: number }; printBackground?: boolean; printSelectionOnly?: boolean }): Promise<Buffer>;
    capturePage(rect?: { x: number; y: number; width: number; height: number }): Promise<any>;
    send(channel: string, ...args: any[]): Promise<void>;
    sendInputEvent(event: any): Promise<void>;
    setZoomFactor(factor: number): void;
    setZoomLevel(level: number): void;
    getZoomFactor(): number;
    getZoomLevel(): number;
    setVisualZoomLevelLimits(minimumLevel: number, maximumLevel: number): Promise<void>;
    showDefinitionForSelection(): void;
    getWebContentsId(): number;

    // Events
    addEventListener(event: 'load-commit', listener: (event: { url: string; isMainFrame: boolean }) => void): void;
    addEventListener(event: 'did-finish-load', listener: () => void): void;
    addEventListener(event: 'did-fail-load', listener: (event: { errorCode: number; errorDescription: string; validatedURL: string; isMainFrame: boolean }) => void): void;
    addEventListener(event: 'did-frame-finish-load', listener: (event: { isMainFrame: boolean }) => void): void;
    addEventListener(event: 'did-start-loading', listener: () => void): void;
    addEventListener(event: 'did-stop-loading', listener: () => void): void;
    addEventListener(event: 'did-attach', listener: () => void): void;
    addEventListener(event: 'dom-ready', listener: () => void): void;
    addEventListener(event: 'page-title-updated', listener: (event: { title: string; explicitSet: boolean }) => void): void;
    addEventListener(event: 'page-favicon-updated', listener: (event: { favicons: string[] }) => void): void;
    addEventListener(event: 'enter-html-full-screen', listener: () => void): void;
    addEventListener(event: 'leave-html-full-screen', listener: () => void): void;
    addEventListener(event: 'console-message', listener: (event: { level: number; message: string; line: number; sourceId: string }) => void): void;
    addEventListener(event: 'found-in-page', listener: (event: { result: { requestId: number; activeMatchOrdinal: number; matches: number; selectionArea: { x: number; y: number; width: number; height: number }; finalUpdate: boolean } }) => void): void;
    addEventListener(event: 'new-window', listener: (event: { url: string; frameName: string; disposition: string; options: any }) => void): void;
    addEventListener(event: 'will-navigate', listener: (event: { url: string }) => void): void;
    addEventListener(event: 'did-start-navigation', listener: (event: { url: string; isInPlace: boolean; isMainFrame: boolean }) => void): void;
    addEventListener(event: 'did-redirect-navigation', listener: (event: { url: string; isInPlace: boolean; isMainFrame: boolean }) => void): void;
    addEventListener(event: 'did-navigate', listener: (event: { url: string }) => void): void;
    addEventListener(event: 'did-frame-navigate', listener: (event: { url: string; isMainFrame: boolean }) => void): void;
    addEventListener(event: 'did-navigate-in-page', listener: (event: { url: string; isMainFrame: boolean }) => void): void;
    addEventListener(event: 'close', listener: () => void): void;
    addEventListener(event: 'ipc-message', listener: (event: { channel: string; args: any[] }) => void): void;
    addEventListener(event: 'crashed', listener: () => void): void;
    addEventListener(event: 'plugin-crashed', listener: (event: { name: string; version: string }) => void): void;
    addEventListener(event: 'destroyed', listener: () => void): void;
    addEventListener(event: 'media-started-playing', listener: () => void): void;
    addEventListener(event: 'media-paused', listener: () => void): void;
    addEventListener(event: 'did-change-theme-color', listener: (event: { themeColor: string }) => void): void;
    addEventListener(event: 'update-target-url', listener: (event: { url: string }) => void): void;
    addEventListener(event: 'devtools-opened', listener: () => void): void;
    addEventListener(event: 'devtools-closed', listener: () => void): void;
    addEventListener(event: 'devtools-focused', listener: () => void): void;
    addEventListener(event: 'context-menu', listener: (event: { params: any }) => void): void;
    addEventListener(event: string, listener: (...args: any[]) => void): void;
    removeEventListener(event: string, listener: (...args: any[]) => void): void;
  }
}

// Extend JSX intrinsic elements to include webview
declare global {
  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<React.HTMLAttributes<Electron.WebviewTag> & {
        src?: string;
        preload?: string;
        nodeintegration?: string;
        partition?: string;
        allowpopups?: string;
        webpreferences?: string;
        httpreferrer?: string;
        useragent?: string;
        disablewebsecurity?: string;
      }, Electron.WebviewTag>;
    }
  }
}

export {};
