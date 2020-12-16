const { LINE_LOOP } = require("../p5");

var canvas;

function windowResized() {
  //console.log('resized');//
  resizeCanvas(windowWidth, windHeight);
}



function setup() {
  // put setup code here
  canvas = createCanvas(windowWidth, windowHeight);
  canvas.position(0, 0);
  canvas.style('z-index', '-1');
  background(175);
}

function draw() {
  // put drawing code here
  if (mouseisPressed) {
    line(pmouseX, pmouseY, mouseX, mouseY);
  }
}
