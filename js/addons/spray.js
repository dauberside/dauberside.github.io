// RGB color variables
let r = 0;
let g = 0;
let b = 0;

function setup() {
  createCanvas(windowWidth, windowHeight);
  background(255);
  //setTimeout color change function
  setTimeout(rChange, 450);
  setTimeout(gChange, 450);
  setTimeout(bChange, 450);
  textSize(32);
  text("Click to Spray!", 10, 30);
  fill(0, 102, 153);
}

// red color change
function rChange() {
  if (r >= 255) {
    r = 0;
  } else {
    r = r + 30;
  }
  setTimeout(rChange, 450);
}

// green color change
function gChange() {
  if (g >= 255) {
    g = 0;
  } else {
    g = g + 10;
  }
  setTimeout(gChange, 450);
}

// blue color change
function bChange() {
  if (b >= 255) {
    b = 0;
  } else {
    b = b + 15;
  }
  setTimeout(bChange, 450);
}

// spray effect
// TO DO
// change squared spray to radial circle spray
function draw() {
  if (mouseIsPressed) {
    for (let i = 0; i <= 1000; i++) {
      let angle = random(TWO_PI);
      let r = random(0, 30);
      let offsetX = r * cos(angle);
      let offsetY = r * sin(angle);
      let sizeX = random(0.2, 1, 5);
      let sizeY = random(0.2, 1, 5);
      fill(r, g, b);
      noStroke();
      rect(mouseX + offsetX, mouseY + offsetY, sizeX, sizeY);
    }
  }
}
