var canvas;
let map = null;
let noiseScale = 1 / 150;
let ocean = "#008dc4";
let shore = "#00a9cc";
let sand = "#eecda3";
let grass = "#7ec850";
let stone = "#676767";
let snow = "#fffafa";


function windowResized() {
  //console.log('resized');//
  resizeCanvas(windowWidth, windowHeight);
}

function setup() {
  canvas = createCanvas(windowWidth, windowHeight);
  canvas.position(0, 0);
  canvas.style('z-index', '-1');
  noStroke();

  background(0);

  noiseDetail(5, 0.5);

  makeMap();

  drawMap();
}


function makeMap() {
  map = [];
  for (let i = 0; i < width; i++) {
    map[i] = [];
    for (let j = 0; j < height; j++) {
      map[i][j] = pickColor(i, j);
    }
  }
}

function pickColor(i, j) {
  let h = noise((i) * noiseScale,
    (j) * noiseScale);
  let c = "#facade";

  if (h < 0.2) {
    c = ocean;
  }
  else if (h < 0.3) {
    if (random() > pow(h - 0.2, 2) * 100) {
      c = ocean;
    }
    else {
      c = shore;
    }
  }
  else if (h < 0.4) {
    if (random() > pow(h - 0.3, 2) * 100) {
      c = shore;
    }
    else {
      c = sand;
    }
  }
  else if (h < 0.5) {
    if (random() > pow(h - 0.4, 2) * 100) {
      c = sand;
    }
    else {
      c = grass;
    }
  }
  else if (h < 0.6) {
    if (random() > pow(h - 0.5, 2) * 100) {
      c = grass;
    }
    else {
      c = stone;
    }
  }
  else if (h < 0.7) {
    if (random() > pow(h - 0.6, 2) * 100) {
      c = stone;
    }
    else {
      c = snow;
    }
  }
  else {
    c = snow;
  }

  return color(c);
}

function drawMap() {
  for (let i = 0; i < width; i++) {
    for (let j = 0; j < height; j++) {
      set(i, j, map[i][j])
    }
  }
  updatePixels();
}
