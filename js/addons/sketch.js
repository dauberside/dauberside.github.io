var canvas;

function windowResized() {
  //console.log('resized');//
  resizeCanvas(windowWidth, windowHeight);
}



function setup() {
  // put setup code here
  canvas = createCanvas(windowWidth, windowHeight);
  canvas.position(0, 0);
  canvas.style('z-index', '-1');
  background('rgba(2%,20%,255%,0.1)');
}

function draw() {
  // put drawing code here
  if (mouseIsPressed) {
    strokeWeight(15);
    line(pmouseX, pmouseY, mouseX, mouseY);
  }
}
