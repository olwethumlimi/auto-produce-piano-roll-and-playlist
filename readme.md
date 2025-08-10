
# PianoRoll

A customizable Piano Roll component for creating and editing musical blocks, supporting full piano key range and flexible controls.

---

## Features

- Attach the piano roll to any DOM element
- Supports full 88-key piano layout or a playlist mode
- Configurable total keys, bars, and step division
- Drag blocks along X and Y axes
- Add, delete, select, and clear highlighted blocks
- Zoom controls for X and Y axes
- Import and export blocks data

---

## Installation

Include the `PianoRoll` script in your project and instantiate it as follows:

```js
const pianoRoll = new PianoRoll({
  attachTo: ".mac",          // Attach piano roll to any DOM element (CSS selector)
  isPiano: true,             // Set true for piano mode, false for playlist mode
  totalKeys: 88,             // Number of piano keys (default 88)
  stepDivision: 16,          // Step division (default 16)
  totalBars: 2,              // Number of bars to display (default 2)
  allowMoveY: true,          // Enable vertical dragging of blocks
  blocks: [                  // Initial blocks on the piano roll
    { row: 60, column: 0, width: 4, velocity: 0.8, division: 8 },
    { row: 55, column: 8, width: 2, velocity: 1.0, division: 8 },
    { row: 52, column: 12, width: 3, velocity: 0.6, division: 8 },
  ]
});
```

---

## API Methods

### Block Selection & Deletion

- `pianoRoll.deleteSelectedBlocks()`  
  Deletes all currently highlighted blocks.

- `pianoRoll.clearAllSelectedBlocks()`  
  Clears the highlight from all blocks.

- `pianoRoll.selectAllBlocks()`  
  Highlights all blocks.

### Zoom Controls

- `pianoRoll.setZoomX(value)`  
  Sets horizontal zoom level.

- `pianoRoll.setZoomY(value)`  
  Sets vertical zoom level.

### Step Division

- `pianoRoll.setStepDivision(value)`  
  Updates the step division of the piano roll.

### Import / Export Blocks

- `pianoRoll.importBlocks(txt)`  
  Imports blocks from a serialized text/string.

- `pianoRoll.exportBlocks()`  
  Exports the current blocks as a serialized string.

---

## Example Usage

```js
// Select all blocks
pianoRoll.selectAllBlocks();

// Zoom horizontally and vertically
pianoRoll.setZoomX(100);
pianoRoll.setZoomY(30);

// Import blocks from json
pianoRoll.importBlocks(json);

// Export current blocks
const exported = pianoRoll.exportBlocks();
console.log(exported);
```

---

## License

MIT License

---
