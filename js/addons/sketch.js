// var canvas;

// function windowResized() {
//   //console.log('resized');//
//   resizeCanvas(windowWidth, windowHeight);
// }



// function setup() {
//   // put setup code here
//   canvas = createCanvas(windowWidth, windowHeight);
//   canvas.position(0, 0);
//   canvas.style('z-index', '-1');
//   background('rgba(2%,20%,255%,0.1)');
// }

// function draw() {
//   // put drawing code here
//   if (mouseIsPressed) {
//     strokeWeight(15);
//     line(pmouseX, pmouseY, mouseX, mouseY);
//   }
// }

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
    line(0, 0, 0, 50); //black

  }
  spray();
}

function spray() {
  if (mouseIsPressed) {
    for (let i = 0; i < 200; i++) {
      let xc = constrain(pmouseX, mouseX, windowWidth);
      let yc = constrain(pmouseY, mouseY, windowHeight);
      let x = random(-20, 20);
      let y = random(-20, 20);
      if (dist(0, 0, x, y) < 1000) {
        ellipseMode(CENTER);
        ellipse(xc + x, yc + y, 1, 1);
      }
    }
  }
}
