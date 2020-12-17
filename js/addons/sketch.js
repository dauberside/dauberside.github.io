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
  //canvas.style('z-index', '-1');
  background('rgba(2%,20%,255%,0.1)');
}

function draw() {
  // put drawing code here
  if (mouseIsPressed) {
    strokeWeight(1); //black

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
      if (dist(0, 0, x, y) < 20) {
        ellipseMode(CENTER);
        ellipse(xc + x, yc + y, 1, 1);
      }
    }
  }
}

function clearBackground() {
  fill(255); //rect color
  rect(0, 0, width, height);
  stroke(0); //text color

}

function keyTyped() {
  if (key === 'v') {
    stroke(148, 0, 211, 50); //violet
  }
  if (key === 'i') {
    stroke(75, 0, 130, 50); //indigo
  }
  if (key === 'b') {
    stroke(0, 0, 255, 50); //blue
  }
  if (key === 'g') {
    stroke(0, 255, 0, 50); //green
  }
  if (key === 'y') {
    stroke(255, 255, 0, 50); //yellow
  }
  if (key === 'o') {
    stroke(255, 127, 0, 50); //orange
  }
  if (key === 'r') {
    stroke(255, 0, 0, 50); //red
  }
  if (key === 'k') {
    stroke(0, 0, 0, 70); //black
  }
  if (key === 'e') {
    stroke(255); //erase
  } else if (key === 'c') {
    clearBackground(); //press 'c' to clear screen
  }
}
