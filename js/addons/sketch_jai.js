var canvas;
red = new Riso('red');
blue = new Riso('blue');

function windowResized() {
  //console.log('resized');//
  resizeCanvas(windowWidth, windowHeight);
}



function setup() {
  // put setup code here
  canvas = createCanvas(windowWidth, windowHeight);
  canvas.position(0, 0);
  canvas.style('z-index', '-1');
}
function draw() {
  background('rgba(2%,20%,255%,0.1)');
  clearRiso();

  blue.fill(255);
  blue.ellipse(200, height / 2, 300, 300);

  red.fill(255);
  red.ellipse(400, height / 2, 300, 300);

  let textGraphic = createGraphics(width, height);
  textGraphic.fill(0);
  textGraphic.textStyle(BOLD);
  textGraphic.textFont('Arial');
  textGraphic.textAlign(CENTER, CENTER);
  textGraphic.textSize(20);
  textGraphic.text('P5.RISO', width / 2 + 5, height / 2);

  red.cutout(textGraphic); // cut text out of red
  blue.cutout(textGraphic); // cut text out of blue
  red.cutout(blue); // cut blue out of red

  drawRiso();
}

function mouseClicked() {
  exportRiso();

}
