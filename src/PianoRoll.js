import { action } from "./actions.js";
import $ from "jquery"
export class PianoRoll {
    constructor(options = {}) {


        this.targetElement = this._generateElement();
        $(options?.attachTo ?? "body").append(this.targetElement);

        var targetElementCanvas = document.getElementById("pipo-piano-roll-playlist-overlay")
        var targetElementVirtual = document.getElementById("pipo-piano-roll-playlist-virtual");
        var targetElementContainer = document.getElementById("pipo-piano-roll-playlist-container");
        if (targetElementCanvas) {
            this.canvas = targetElementCanvas;
        }


        if (targetElementVirtual) {
            this.virtual = targetElementVirtual;
        }
        if (targetElementContainer) {
            this.container = targetElementContainer;
        }

        this.ctx = this.canvas.getContext('2d');


        this.onSelectedItem = null;
        // this.container = container;
        // this.virtual = virtual;
        // this.canvas = canvas;
        // this.ctx = canvas.getContext('2d');
        this.isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

        // config
        if (typeof options.isPiano !== 'boolean' || options.isPiano === true) {
            this.type = 'piano';
        } else {
            this.type = null; // or whatever you want when isPiano === false
        }
        this.keysWidth = this.type === 'piano' ? (options.keysWidth ?? 100) : 0;
        this.timelineHeight = options.timelineHeight ?? 30;
        this.totalKeys = options.totalKeys ?? 88;
        this.beatsPerBar = options.beatsPerBar ?? 4;

        // careful with precedence: use parentheses
        this.blockHeight = (options.blockHeight !== undefined) ? options.blockHeight : (this.isTouch ? 80 : 30);
        this.blockWidth = (options.blockWidth !== undefined) ? options.blockWidth : (this.isTouch ? 120 : 120);

        // stepDivision e.g. 8 means 1/8; keep previous convention
        this.stepDivision = options.stepDivision ?? 16;

        // hit & visual handle sizes
        this.visualHandleWidth = this.isTouch ? 24 : 20;
        this.hitHandleExtra = this.isTouch ? 24 : 20;

        this.allowMoveY = options.allowMoveY ?? true;

        // initial bars/steps
        this.totalBars = options.totalBars ?? 2;
        // stepsPerBeat used consistently as (stepDivision / 4)
        this.stepsPerBeat = this.stepDivision / 4;
        this.totalSteps = Math.max(1, Math.floor(this.totalBars * this.beatsPerBar * this.stepsPerBeat));

        // virtual size will be computed by resizeVirtual
        this.numSteps = options.numSteps ?? this.totalSteps;

        // state
        this.scrollX = 0; this.scrollY = 0;
        this.blocks = options.blocks ?? [];
        this.noteNames = this.generateNoteNames(this.totalKeys);
        this.selectedBlocks = [];
        this.selectionRect = null; // {x1,y1,x2,y2}
        this.dragMode = null; // null|'select'|'move'|'resize'
        this.dragStartMouse = null;
        this.originalBlocksState = null;
        this.pushLineDown = 10;
        this.cursor = 0
        this.isDraggingCursor = false


        // Bind event handler methods to preserve `this` context
        this._onScroll = this._onScroll.bind(this);
        this._onMouseDown = this._onMouseDown.bind(this);
        this._onMouseMove = this._onMouseMove.bind(this);
        this._onMouseUp = this._onMouseUp.bind(this);
        this._onContextMenu = this._onContextMenu.bind(this);
        this._onDblClick = this._onDblClick.bind(this);
        this._onKeyDown = this._onKeyDown.bind(this);

        // Bind the resize handler so it can be removed later
        this._onResize = this._resizeCanvas.bind(this);

        // Track last tap time for touch double-tap detection
        this._lastTap = 0;

        // Create and save touch event handlers as properties so we can remove them later
        this._touchStartHandler = (ev) => this._touchToMouse(ev, 'mousedown');
        this._touchMoveHandler = (ev) => this._touchToMouse(ev, 'mousemove');
        this._touchEndHandler = (ev) => {
            const now = Date.now();
            const delta = now - this._lastTap;
            this._lastTap = now;

            // If second tap occurs within 300ms, treat as double-click, else mouseup
            if (delta > 0 && delta < 300) {
                this._touchToMouse(ev, 'dblclick');
            }
            else {
                this._touchToMouse(ev, 'mouseup');
            }
        };

        // Add event listeners with bound handlers

        // Scroll event on container element
        this.container.addEventListener('scroll', this._onScroll);

        // Window resize event, bound to _resizeCanvas method
        window.addEventListener('resize', this._onResize);

        // Mouse events on the canvas element
        this.canvas.addEventListener('mousedown', this._onMouseDown);
        window.addEventListener('mousemove', this._onMouseMove);
        window.addEventListener('mouseup', this._onMouseUp);

        // Context menu and double click on canvas
        this.canvas.addEventListener('contextmenu', this._onContextMenu);
        this.canvas.addEventListener('dblclick', this._onDblClick);

        // Keyboard events on window
        window.addEventListener('keydown', this._onKeyDown);

        // Touch events on the canvas with passive:false to allow preventDefault if needed
        this.canvas.addEventListener('touchstart', this._touchStartHandler, { passive: false });
        this.canvas.addEventListener('touchmove', this._touchMoveHandler, { passive: false });
        this.canvas.addEventListener('touchend', this._touchEndHandler, { passive: false });

        // init sizes & draw
        this.resizeVirtual();
        this._resizeCanvas();
        this.draw();
    }


    _generateElement() {
        return $(`
  <style>
   html, body {
  height: 100%;
  margin: 0;
  padding: 0;
      overflow: hidden;
   }

    .pipo-piano-roll-playlist-wrapper {
      /* Default: fill parent container */
      position: relative;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #1f1f1f;
      z-index: 9999;
    }

    /* If appended directly to body, make it fullscreen */
    body > .pipo-piano-roll-playlist-wrapper {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
    }

    #pipo-piano-roll-playlist-container {
      margin-top: 30px !important;
      width: 100%;
      height: calc(100% - 30px);
      overflow: auto;
      border: 1px solid rgba(255, 255, 255, 0.1);
      position: relative;
      background: #1f1f1f;
    }

    .pipo-piano-roll-playlist-overlay {
      position: absolute;
      top: 0;
      z-index: 1;
      cursor: default;
      background: transparent;
      display: block;
      width: calc(100% - 40px) !important;
    }

    /* Scrollbar styling */
    #pipo-piano-roll-playlist-container::-webkit-scrollbar {
      width: 30px;
      height: 30px;
    }
    #pipo-piano-roll-playlist-container::-webkit-scrollbar-thumb {
      background-color: #888;
      border-radius: 6px;
      border: 3px solid #f0f0f0;
    }
  </style>

  
  <div class="container">
    <canvas class="pipo-piano-roll-playlist-overlay" id="pipo-piano-roll-playlist-overlay"></canvas>
  </div>
  <div id="pipo-piano-roll-playlist-container">
    <div class="pipo-piano-roll-playlist-virtual" id="pipo-piano-roll-playlist-virtual"></div>
  </div>
`);
    }

    dispose() {
        this.targetElement.remove()

        // Remove all event listeners added in constructor to prevent memory leaks

        // Remove scroll listener
        this.container.removeEventListener('scroll', this._onScroll);

        // Remove resize listener
        window.removeEventListener('resize', this._onResize);

        // Remove mouse event listeners
        this.canvas.removeEventListener('mousedown', this._onMouseDown);
        window.removeEventListener('mousemove', this._onMouseMove);
        window.removeEventListener('mouseup', this._onMouseUp);

        // Remove context menu and double click listeners
        this.canvas.removeEventListener('contextmenu', this._onContextMenu);
        this.canvas.removeEventListener('dblclick', this._onDblClick);

        // Remove keyboard listener
        window.removeEventListener('keydown', this._onKeyDown);

        // Remove touch event listeners
        this.canvas.removeEventListener('touchstart', this._touchStartHandler, { passive: false });
        this.canvas.removeEventListener('touchmove', this._touchMoveHandler, { passive: false });
        this.canvas.removeEventListener('touchend', this._touchEndHandler, { passive: false });
    }




    // converts touch event to mouse event for handlers
    _touchToMouse(ev, type) {
        ev.preventDefault();
        const t = ev.touches && ev.touches[0] || ev.changedTouches && ev.changedTouches[0];
        if (!t) return;
        const mouseEvent = new MouseEvent(type, { clientX: t.clientX, clientY: t.clientY, bubbles: true });
        this.canvas.dispatchEvent(mouseEvent);
    }

    // new: setBars updates totalBars & totalSteps then resizes virtual region
    setBars(bars) {
        bars = Math.max(1, Math.floor(Number(bars) || 0));
        this.totalBars = bars;
        // recompute steps-per-bar using stepDivision convention used elsewhere
        this.stepsPerBeat = this.stepDivision / 4;
        this.totalSteps = Math.max(1, Math.floor(this.totalBars * this.beatsPerBar * this.stepsPerBeat));
        this.numSteps = this.totalSteps;
        this.resizeVirtual();
        this._resizeCanvas();
        this.draw();
    }

    // update virtual container width/height (scroll area)
    resizeVirtual() {
        const stepWidth = this.getStepWidth(this.stepDivision);
        const virtualWidth = this.keysWidth + (this.numSteps * stepWidth);
        const virtualHeight = this.timelineHeight + (this.totalKeys * this.blockHeight);
        this.virtual.style.width = virtualWidth + 'px';
        this.virtual.style.height = virtualHeight + 'px';
    }

    _resizeCanvas() {
        const rect = this.container.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        const dpr = window.devicePixelRatio || 1;
        this.canvas.style.width = width + 'px';
        this.canvas.style.height = height + 'px';
        this.canvas.width = Math.round(width * dpr);
        this.canvas.height = Math.round(height * dpr);
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.draw();
    }

    setZoomY(y) {
        if (y) this.blockHeight = y;
        // step width changes with blockWidth; recompute sizes
        this.resizeVirtual();
        this._resizeCanvas();
        this.draw();
    }
    setZoomX(x) {
        if (x) this.blockWidth = x;
        // step width changes with blockWidth; recompute sizes
        this.resizeVirtual();
        this._resizeCanvas();
        this.draw();
    }

    setStepDivision(newDivision) {
        this.stepDivision = newDivision;
        this.stepsPerBeat = this.stepDivision / 4;
        // totalSteps depends on stepDivision; recompute from current bars
        this.totalSteps = Math.max(1, Math.floor(this.totalBars * this.beatsPerBar * this.stepsPerBeat));
        this.numSteps = this.totalSteps;
        this.resizeVirtual();
        this.draw();
    }

    getStepWidth(blockDivision) {
        const division = blockDivision || this.stepDivision;
        return this.blockWidth * (4 / division);
    }

    generateNoteNames(total) {
        const notes = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#'];
        const res = [];
        res.push("oop");
        for (let i = 0; i < total; i++) {
            const octave = Math.floor((i + 9) / 12);
            const note = notes[(i + 9) % 12];
            res.push(note + octave);
        }


        res.reverse()
        return res;
    }

    // --- drawing functions (use totalSteps / totalBars to limit grid lines) ---
    drawTimeline() {
        const ctx = this.ctx;
        ctx.save();
        ctx.fillStyle = '#ddd';
        ctx.fillRect(this.keysWidth, 0, this.canvas.width, this.timelineHeight);
        ctx.fillStyle = 'black';
        ctx.font = '17px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const beatsPerBar = this.beatsPerBar;
        const stepsPerBeat = this.stepDivision / 4;
        const stepsPerBar = beatsPerBar * stepsPerBeat;
        const stepWidth = this.getStepWidth(this.stepDivision);

        // Draw bar labels and thicker bar lines at bar boundaries.
        for (let bar = 0; bar <= this.totalBars; bar++) {
            const stepIndex = bar * stepsPerBar;
            const x = this.keysWidth + stepIndex * stepWidth - this.scrollX;
            if (x < -100 || x > this.canvas.width + 100) continue;
            // draw label (bars numbered from 1)
            if (bar < this.totalBars) {
                // ctx.fillText(String(bar + 1), x + (stepsPerBar * stepWidth) / 2, this.timelineHeight / 2);
                ctx.fillText(String(bar + 1), x + (stepsPerBar * stepWidth), this.timelineHeight / 2);
            }
        }

        ctx.restore();
    }



    drawTimelineBackground() {
        const ctx = this.ctx;
        ctx.save();

        ctx.fillStyle = '#252525';
        ctx.fillRect(this.keysWidth, 0, this.canvas.width, this.timelineHeight);

        ctx.restore();
    }

    drawBarLabels() {
        const ctx = this.ctx;
        ctx.save();

        ctx.fillStyle = '#c0c0c0';
        ctx.font = '17px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const beatsPerBar = this.beatsPerBar;
        const stepsPerBeat = this.stepDivision / 4;
        const stepsPerBar = beatsPerBar * stepsPerBeat;
        const stepWidth = this.getStepWidth(this.stepDivision);

        for (let bar = 0; bar <= this.totalBars; bar++) {
            const stepIndex = bar * stepsPerBar;
            const x = this.keysWidth + stepIndex * stepWidth - this.scrollX;

            if (x < -this.blockWidth || x > this.canvas.width + this.blockWidth) continue;

            if (bar < this.totalBars) {
                ctx.fillText(String(bar + 1), x + (stepsPerBar * stepWidth), this.timelineHeight / 2);
            }
        }

        ctx.restore();
    }



    drawHorizontalLines() {
        const ctx = this.ctx;
        ctx.save();

        ctx.strokeStyle = '#2e2e2e';
        ctx.lineWidth = 1;

        const visibleRows = Math.ceil(this.canvas.height / this.blockHeight);

        for (let i = 0; i <= visibleRows; i++) {
            const y = this.timelineHeight + i * this.blockHeight - (this.scrollY % this.blockHeight);
            ctx.beginPath();
            ctx.moveTo(this.keysWidth, y);
            ctx.lineTo(this.canvas.width, y);
            ctx.stroke();
        }

        ctx.restore();
    }

    drawBarLines(short = true) {
        const ctx = this.ctx;
        ctx.save();

        const stepWidth = this.getStepWidth(this.stepDivision);
        const beatsPerBar = this.beatsPerBar;
        const stepsPerBeat = this.stepDivision / 4;
        const stepsPerBar = beatsPerBar * stepsPerBeat;

        for (let step = 0; step <= this.totalSteps; step++) {
            if (step % stepsPerBar !== 0) continue;

            const x = this.keysWidth + step * stepWidth - this.scrollX;
            if (x < -50 || x > this.canvas.width + 50) continue;

            ctx.strokeStyle = '#8a8a8a';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ;

            if (short) {
                ctx.moveTo(x, this.timelineHeight / 2 + this.pushLineDown)
                ctx.lineTo(x, this.timelineHeight);
            } else {
                ctx.moveTo(x, this.timelineHeight);
                ctx.lineTo(x, this.canvas.height);
            }

            ctx.stroke();
        }

        ctx.restore();
    }

    drawCursorAtGridX(gridX) {
        const ctx = this.ctx;
        ctx.save();

        const stepWidth = this.getStepWidth(this.stepDivision);
        const x = this.keysWidth + gridX * stepWidth - this.scrollX;

        // // Optionally skip drawing if cursor is off-canvas (with some margin)
        // if (x < -50 || x > this.canvas.width + 50) {
        //     ctx.restore();
        //     return;
        // }

        ctx.strokeStyle = '#ff0000';  // Red cursor line for visibility
        ctx.lineWidth = 5;
        ctx.beginPath();
        // Draw full height cursor line (from timelineHeight down to bottom)
        ctx.moveTo(x, 0);
        ctx.lineTo(x, this.canvas.height);
        ctx.stroke();

        ctx.restore();
    }


    drawBeatLines(short = true) {
        const ctx = this.ctx;
        ctx.save();

        const stepWidth = this.getStepWidth(this.stepDivision);
        const beatsPerBar = this.beatsPerBar;
        const stepsPerBeat = this.stepDivision / 4;
        const stepsPerBar = beatsPerBar * stepsPerBeat;

        for (let step = 0; step <= this.totalSteps; step++) {
            if (step % stepsPerBeat !== 0 || step % stepsPerBar === 0) continue;

            const x = this.keysWidth + step * stepWidth - this.scrollX;
            if (x < -50 || x > this.canvas.width + 50) continue;

            ctx.strokeStyle = '#656565';
            ctx.lineWidth = 1;
            ctx.beginPath();
            if (short) {
                ctx.moveTo(x, this.timelineHeight / 2);
                ctx.lineTo(x, this.timelineHeight);
            } else {
                ctx.moveTo(x, 0);
                ctx.lineTo(x, this.canvas.height);
            }
            ctx.stroke();
        }

        ctx.restore();
    }

    drawStepLines(short = true) {
        const ctx = this.ctx;
        ctx.save();

        const stepWidth = this.getStepWidth(this.stepDivision);
        const beatsPerBar = this.beatsPerBar;
        const stepsPerBeat = this.stepDivision / 4;
        const stepsPerBar = beatsPerBar * stepsPerBeat;

        for (let step = 0; step <= this.totalSteps; step++) {
            if (step % stepsPerBeat === 0) continue;  // skip bars and beats

            const x = this.keysWidth + step * stepWidth - this.scrollX;
            if (x < -50 || x > this.canvas.width + 50) continue;

            ctx.strokeStyle = '#3a3a3a ';
            ctx.lineWidth = 1;
            ctx.beginPath();
            if (short) {
                ctx.moveTo(x, 0);
                ctx.lineTo(x, this.timelineHeight);
            } else {
                ctx.moveTo(x, 0);
                ctx.lineTo(x, this.canvas.height);
            }
            ctx.stroke();
        }

        ctx.restore();
    }


    drawGrid() {
        const ctx = this.ctx;
        ctx.save();
        ctx.strokeStyle = '#ddd';
        ctx.lineWidth = 1;

        const visibleRows = Math.ceil(this.canvas.height / this.blockHeight);
        const startRow = Math.floor(this.scrollY / this.blockHeight);

        const stepWidth = this.getStepWidth(this.stepDivision);
        const startCol = Math.floor(this.scrollX / stepWidth);

        const beatsPerBar = this.beatsPerBar;
        const stepsPerBeat = this.stepDivision / 4;
        const stepsPerBar = beatsPerBar * stepsPerBeat;

        // horizontal lines (rows)
        for (let i = 0; i <= visibleRows; i++) {
            const y = this.timelineHeight + i * this.blockHeight - (this.scrollY % this.blockHeight);
            ctx.beginPath();
            ctx.moveTo(this.keysWidth, y);
            ctx.lineTo(this.canvas.width, y);
            ctx.stroke();
        }

        // vertical lines — only up to totalSteps
        for (let step = 0; step <= this.totalSteps; step++) {
            const x = this.keysWidth + step * stepWidth - this.scrollX;
            if (x < -50 || x > this.canvas.width + 50) continue;

            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, this.canvas.height);

            if (step % stepsPerBar === 0) {
                ctx.strokeStyle = 'black';
                ctx.lineWidth = 2;
            } else if (step % stepsPerBeat === 0) {
                ctx.strokeStyle = 'gray';
                ctx.lineWidth = 1;
            } else {
                ctx.strokeStyle = '#eee';
                ctx.lineWidth = 1;
            }
            ctx.stroke();
        }

        ctx.restore();
    }

    drawKeys() {
        if (this.type !== 'piano') return;
        const ctx = this.ctx;
        ctx.save();

        const startRow = Math.floor(this.scrollY / this.blockHeight);
        const visibleRows = Math.ceil(this.canvas.height / this.blockHeight);

        for (let i = startRow; i < Math.min(this.totalKeys, startRow + visibleRows + 1); i++) {
            const y = this.timelineHeight + i * this.blockHeight - this.scrollY;
            const noteName = this.noteNames[i] || '';
            const isBlack = noteName.includes('#');

            if (isBlack) {
                // Draw black key
                ctx.fillStyle = '#000';
                ctx.strokeStyle = '#222';
                ctx.fillRect(0, y, this.keysWidth, this.blockHeight);
                ctx.strokeRect(0, y, this.keysWidth, this.blockHeight);

                // Draw note name in white text centered vertically & horizontally-ish
                ctx.fillStyle = '#fff';
                ctx.font = '12px sans-serif';
                ctx.textBaseline = 'middle';
                ctx.textAlign = 'left';
                ctx.fillText(noteName, this.keysWidth / 2 - 10, y + this.blockHeight / 2);
            } else {
                // Draw white key
                ctx.fillStyle = '#fff';
                ctx.strokeStyle = '#000';
                ctx.fillRect(0, y, this.keysWidth, this.blockHeight);
                ctx.strokeRect(0, y, this.keysWidth, this.blockHeight);

                // Draw note name in black text
                ctx.fillStyle = '#000';
                ctx.font = '12px sans-serif';
                ctx.textBaseline = 'middle';
                ctx.textAlign = 'left';
                ctx.fillText(noteName, this.keysWidth / 2 - 10, y + this.blockHeight / 2);
            }
        }

        ctx.restore();
    }


    drawBlocks() {
        const ctx = this.ctx;
        ctx.save();
        this.blocks.forEach(block => {
            const division = block.division || this.stepDivision;
            const stepWidth = this.getStepWidth(division);
            const widthPx = (block.width || 1) * stepWidth;
            const x = this.keysWidth + (block.column || 0) * stepWidth - this.scrollX;
            const y = this.timelineHeight + block.row * this.blockHeight - this.scrollY;

            // Skip if offscreen
            if (x + widthPx < 0 || x > this.canvas.width) return;
            if (y + this.blockHeight < 0 || y > this.canvas.height) return;

            ctx.fillStyle = this.selectedBlocks.includes(block) ? 'rgba(255,165,0,0.95)' : `rgba(0,128,255,${block.velocity ?? 1})`;
            ctx.fillRect(x, y, widthPx, this.blockHeight);

            ctx.strokeStyle = 'black';
            ctx.lineWidth = 1;
            ctx.strokeRect(x, y, widthPx, this.blockHeight);

            // visual handle
            ctx.fillStyle = 'rgba(0,0,0,0.35)';
            ctx.fillRect(x + widthPx - this.visualHandleWidth, y, this.visualHandleWidth, this.blockHeight);
        });
        ctx.restore();
    }

    drawSelectionRect() {
        if (!this.selectionRect) return;
        const ctx = this.ctx;
        const r = this.selectionRect;
        const x = Math.min(r.x1, r.x2);
        const y = Math.min(r.y1, r.y2);
        const w = Math.abs(r.x2 - r.x1);
        const h = Math.abs(r.y2 - r.y1);
        ctx.save();
        ctx.fillStyle = 'rgba(0,150,255,0.12)';
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(x, y, w, h);
        ctx.restore();
    }

    draw() {
        const keysWidth = this.keysWidth;
        const timelineHeight = this.timelineHeight;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);





        this.drawHorizontalLines();
        this.drawBarLines(false);
        this.drawBeatLines(false);
        this.drawStepLines(false);
        this.drawBlocks();
        this.drawSelectionRect();
        this.drawTimelineBackground();
        this.drawBarLines(true);
        this.drawBarLabels();


        this.drawBeatLines(true);
        this.drawStepLines(true);
        this.drawCursorAtGridX(this.cursor)
        this.drawKeys();

        // Top-left corner box
        if (this.type === "piano") {
            this.ctx.fillStyle = '#252525';
            this.ctx.fillRect(0, 0, keysWidth + 1, timelineHeight);
        }


    }

    // --- interaction helpers & handlers ---
    _onScroll() {
        this.scrollX = this.container.scrollLeft;
        this.scrollY = this.container.scrollTop;
        this.draw();
    }
    _isClickOnTimeline(x, y) {
        const stepWidth = this.getStepWidth(this.stepDivision);


        // If clicked inside keys area horizontally, it's NOT timeline
        if (x < this.keysWidth) return { status: false, x: null, grid: null };

        // Check vertical position for timeline
        if (y >= 0 && y < this.timelineHeight) {
            // Calculate timeline column (step) clicked, considering scroll and keys width
            const timelineX = x + this.scrollX - this.keysWidth;
            if (timelineX < 0) return { status: false, x: null, grid: null };

            const timelineColumn = Math.floor(timelineX / stepWidth);
            if (timelineColumn < 0 || timelineColumn >= this.totalSteps) return { status: false, x: null, grid: null };

            // Return timeline click info (no grid block here)
            return { status: true, x: timelineColumn, grid: null };
        }
        return { status: false, x: null, grid: null };
    }


    _findBlockAt(x, y) {
        if (y < this.timelineHeight) return null;
        for (let i = this.blocks.length - 1; i >= 0; i--) {
            const block = this.blocks[i];
            const division = block.division || this.stepDivision;
            const stepWidth = this.getStepWidth(division);
            const blockX = this.keysWidth + (block.column || 0) * stepWidth - this.scrollX;
            const blockWidthPx = (block.width || 1) * stepWidth;
            const blockY = this.timelineHeight + block.row * this.blockHeight - this.scrollY;
            if (x >= blockX && x <= blockX + blockWidthPx && y >= blockY && y <= blockY + this.blockHeight) {
                return { block, index: i, blockX, blockY, blockWidthPx };
            }
        }
        return null;
    }
    _findKeyAt(x, y) {
        if (y < this.timelineHeight) return { status: false, row: null, noteName: null };
        if (x > this.keysWidth) return { status: false, row: null, noteName: null };

        const row = Math.floor((y - this.timelineHeight + this.scrollY) / this.blockHeight);

        if (row < 0 || row >= this.totalKeys) return { status: false, row: null, noteName: null };

        const noteName = this.noteNames[row] || '';

        return { status: true, row, noteName };
    }

    _onMouseDown(e) {

        if (e.button !== 0) return; // only left mouse button

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const found = this._findBlockAt(x, y);
        var keyClicked = this._findKeyAt(x, y);
        this.dragStartMouse = { x, y };

        if (keyClicked.status) {
            try {
                this.onSelectedItem({ info: keyClicked, action: action.note_click })
            } catch (error) {

            }

        }

        const timelineClick = this._isClickOnTimeline(x, y);
        if (timelineClick.status) {
            try {
                this.isDraggingCursor = true
                this.cursor = timelineClick.x
                this.onSelectedItem({ info: timelineClick, action: action.timeline_cursor_click })
            } catch (error) {

            }
        }

        const shiftPressed = e.shiftKey || e.metaKey; // metaKey for mac

        if (found) {
            const { block, index, blockX, blockY, blockWidthPx } = found;
            const resizeZone = this.visualHandleWidth || 15; // use your handle width here

            // selection handling
            if (shiftPressed) {
                const idx = this.selectedBlocks.indexOf(block);
                if (idx === -1) this.selectedBlocks.push(block);
                else this.selectedBlocks.splice(idx, 1);
            } else {
                if (!this.selectedBlocks.includes(block)) {
                    this.selectedBlocks = [block];
                }
            }

            // determine drag mode (resize vs move)
            // Check if pointer is within the resize handle area inside the block's right edge
            const extraPadding = 20; // increase this if needed
            const handleLeft = blockX + blockWidthPx - resizeZone - extraPadding;
            const handleRight = blockX + blockWidthPx;
            const withinVerticalBounds = y >= blockY && y <= blockY + this.blockHeight;

            if (withinVerticalBounds && x >= handleLeft && x <= handleRight) {
                this.dragMode = 'resize';
            } else {
                this.dragMode = 'move';
            }

            // snapshot original state of all selected blocks for dragging/resizing
            this.originalBlocksState = this.selectedBlocks.map(b => ({
                block: b,
                row: b.row,
                column: b.column,
                width: b.width
            }));

            try {
                this.onSelectedItem({ info: this.originalBlocksState, action: action.block_click })
            } catch (error) {

            }


        } else {
            // clicked on empty space, start selection rectangle
            if (!shiftPressed) {
                this.selectedBlocks = [];
            }
            this.dragMode = 'select';
            this.selectionRect = { x1: x, y1: y, x2: x, y2: y };
        }

        this.draw();
    }

    _onMouseMove(e) {

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const timelineClick = this._isClickOnTimeline(x, y);
        if (timelineClick.status) {
            try {
                this.cursor = timelineClick.x
                this.onSelectedItem({ info: timelineClick, action: action.timeline_cursor_click })
            } catch (error) {

            }
        }
        if (!this.dragMode) return;



        const dx = x - this.dragStartMouse.x;
        const dy = y - this.dragStartMouse.y;

        if (this.dragMode === 'select' && this.selectionRect) {
            this.selectionRect.x2 = x;
            this.selectionRect.y2 = y;
            this._updateSelectionFromRect();

        } else if (this.dragMode === 'move' && this.originalBlocksState) {
            // Find smallest stepWidth among all blocks for finest snapping resolution
            const stepWidths = this.originalBlocksState.map(s => this.getStepWidth(s.block.division));
            const minStepWidth = Math.min(...stepWidths);

            // Calculate deltaCols in smallest stepWidth units
            const deltaColsBase = Math.round(dx / minStepWidth);
            const deltaRows = Math.round(dy / this.blockHeight);

            this.originalBlocksState.forEach(s => {
                const blockStepWidth = this.getStepWidth(s.block.division);
                // Convert deltaColsBase back to this block's grid units, rounding to snap
                const blockDeltaCols = Math.round(deltaColsBase * (minStepWidth / blockStepWidth));
                s.block.column = Math.max(0, s.column + blockDeltaCols);

                if (this.allowMoveY) {
                    s.block.row = Math.min(Math.max(0, s.row + deltaRows), this.totalKeys - 1);
                }
            });

            try {
                this.onSelectedItem({ info: this.originalBlocksState, action: action.block_move })
            } catch (error) {

            }

        } else if (this.dragMode === 'resize' && this.originalBlocksState) {
            this.originalBlocksState.forEach(s => {
                const stepWidth = this.getStepWidth(s.block.division);
                const deltaCols = Math.round(dx / stepWidth);
                s.block.width = Math.max(1, s.width + deltaCols);

                try {
                    this.onSelectedItem({ info: this.originalBlocksState, action: action.block_resize })
                } catch (error) {

                }
            });
        }

        this.draw();
    }

    _onMouseUp(e) {
        this.isDraggingCursor = false
        this.dragMode = null;
        this.dragStartMouse = null;
        this.originalBlocksState = null;
        this.selectionRect = null;
        this.draw();
        try {
            this.onSelectedItem({ info: this.originalBlocksState, action: action.stop })
        } catch (error) {

        }
    }

    _updateSelectionFromRect() {
        if (!this.selectionRect) return;
        const r = this.selectionRect;
        const xMin = Math.min(r.x1, r.x2);
        const yMin = Math.min(r.y1, r.y2);
        const xMax = Math.max(r.x1, r.x2);
        const yMax = Math.max(r.y1, r.y2);
        const newSelection = [];
        this.blocks.forEach(block => {
            const division = block.division || this.stepDivision;
            const stepWidth = this.getStepWidth(division);
            const blockX = this.keysWidth + (block.column || 0) * stepWidth - this.scrollX;
            const blockWidthPx = (block.width || 1) * stepWidth;
            const blockY = this.timelineHeight + block.row * this.blockHeight - this.scrollY;
            const blockX2 = blockX + blockWidthPx;
            const blockY2 = blockY + this.blockHeight;
            const intersects = !(blockX2 < xMin || blockX > xMax || blockY2 < yMin || blockY > yMax);
            if (intersects) newSelection.push(block);
        });
        this.selectedBlocks = newSelection;
    }

    _onContextMenu(e) {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const found = this._findBlockAt(x, y);
        if (found) {
            this.blocks.splice(found.index, 1);
            this.selectedBlocks = this.selectedBlocks.filter(b => b !== found.block);
            this.draw();
        }
    }

    _onDblClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        if (y < this.timelineHeight) return;

        const stepWidth = this.getStepWidth(this.stepDivision);
        const column = Math.floor((x - this.keysWidth + this.scrollX) / stepWidth);
        const row = Math.floor((y - this.timelineHeight + this.scrollY) / this.blockHeight);

        // Prevent clicks on the last row (bottom grid)
        if (row >= this.totalKeys) return;

        const clampedCol = Math.min(Math.max(0, column), Math.max(0, this.totalSteps - 1));
        this.blocks.push({ row: row, column: clampedCol, width: 1, velocity: 1, division: this.stepDivision });
        this.draw();
        try {
            this.onSelectedItem({ info: { column, row, }, action: action.block_add })
        } catch (error) {

        }
    }

    deleteSelectedBlocks() {
        if (this.selectedBlocks.length) {
            this.blocks = this.blocks.filter(b => !this.selectedBlocks.includes(b));
            this.selectedBlocks = [];
            this.draw();
        }
    }
    clearAllSelectedBlocks() {
        this.selectedBlocks = [];
        this.draw();
    }
    selectAllBlocks() {
        this.selectedBlocks = [...this.blocks];
        this.draw();
    }

    _onKeyDown(e) {
        if (e.key === 'Delete' || e.key === 'Backspace') {
            deleteSelectedBlocks()
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
            e.preventDefault();
            selectAllBlocks()
        }
        if (e.key === 'Escape') {
            clearAllSelectedBlocks()
        }
    }

    exportBlocks() { return JSON.stringify(this.blocks, null, 2); }

    importBlocks(json) {
        try {
            const data = json;
            if (!Array.isArray(data)) throw new Error('expected array');
            this.blocks = data;
            this.selectedBlocks = [];
            this.resizeVirtual();
            this.draw();
        } catch (err) {
            alert('Import failed: ' + err.message);
        }
    }
} // end class
