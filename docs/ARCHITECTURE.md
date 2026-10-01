# Architecture

## Browser View Architecture

The MultiView Agent requires a live, low-latency representation of multiple browser sessions simultaneously in a web-based dashboard, running on a standard Windows environment. 

### Selected Approach: CDP Screencast Streaming
We have selected **Architecture C (Browser automation backend + CDP/browser-stream architecture)**. 

Specifically, we utilize the **Chrome DevTools Protocol (CDP)** built directly into Playwright's Chromium browsers to request a native screencast. 

#### How it works:
1. **CDP Session Initiation**: When a `BrowserSession` is created, the backend establishes a raw CDP session directly to that specific page context using `await context.new_cdp_session(page)`.
2. **Screencast Request**: The backend sends the `Page.startScreencast` CDP command, asking Chromium to stream JPEG frames of the viewport as they change.
3. **Frame Handling**: As Chromium renders page changes (scrolling, video, animations), it emits `Page.screencastFrame` events.
4. **WebSocket Transport**: The Python backend captures these base64-encoded frames, immediately acknowledges them back to Chromium (`Page.screencastFrameAck`), and broadcasts the frame payload to the frontend via WebSockets.
5. **Frontend Rendering**: The React frontend receives the WebSocket JSON payload and dynamically updates a standard `<img>` tag's `src` attribute with the `data:image/jpeg;base64,...` payload.

#### Advantages of this approach:
* **Native & Reliable**: Uses Chromium's internal rendering pipeline. No external dependencies like FFmpeg, virtual framebuffers (Xvfb), or OS-level screen capture are required.
* **Highly Performant**: Frames are only emitted when the page visually changes, saving bandwidth when the page is idle.
* **Isolated**: Each browser context streams its own viewport independently, perfectly matching our Multi-browser Grid requirement.
* **Cross-Platform**: Works flawlessly on Windows, macOS, and Linux without OS-specific hacks.
