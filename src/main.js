import { PianoRoll } from "./PianoRoll";

const pianoRoll = new PianoRoll({
  attachTo: ".mac",// you can attach to a any element
  isPiano: true,  // ,//default || if not piano , it will change to a playlist
  totalKeys: 88, //default // totals keys if  its piano itll show they keys
  stepDivision: 16,//default
  totalBars: 2,//default
  allowMoveY: true,//will allow you drag on Y axes
  blocks: [
    { row: 60, column: 0, width: 4, velocity: 0.8, division: 8 },
    { row: 55, column: 8, width: 2, velocity: 1.0, division: 8 },
    { row: 52, column: 12, width: 3, velocity: 0.6, division: 8 },
  ]
});

//getactions
//return actions perfomed
pianoRoll.onSelectedItem = (items) => {
  console.log(items)
}

