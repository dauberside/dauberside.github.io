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
//     strokeWeight(10);
//     //line(pmouseX, pmouseY, mouseX, mouseY);
//   }
//   spray();
// }

// function spray() {
//   if (mouseIsPressed) {
//     for (let i = 0; i < 400; i++) {
//       let xc = constrain(pmouseX, mouseX, windowWidth);
//       let yc = constrain(pmouseY, mouseY, windowHeight);
//       let x = random(-15, 15);
//       let y = random(-15, 15);
//       if (dist(0, 0, x, y) < 10) {
//         ellipseMode(CENTER);
//         ellipse(xc + x, yc + y, 1, 1);
//       }
//     }
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
    stroke(0, 0, 0, 100);

  }
  spray();
}

function spray() {
  if (mouseIsPressed) {
    for (let i = 0; i < 1500; i++) {
      let xc = constrain(pmouseX, mouseX, windowWidth);
      let yc = constrain(pmouseY, mouseY, windowHeight);
      let x = random(-35, 35);
      let y = random(-35, 35);
      if (dist(0, 0, x, y) < 20) {
        ellipseMode(CENTER);
        ellipse(xc + x, yc + y, 0, 0);

      }
    }
  }
}
