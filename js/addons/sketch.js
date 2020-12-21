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
    strokeWeight(10);
    stroke('rgba(255%,255%,255%,1)');
    //line(pmouseX, pmouseY, mouseX, mouseY);
  }
  spray();
}

function spray() {
  if (mouseIsPressed) {
    for (let i = 0; i < 400; i++) {
      let xc = constrain(pmouseX, mouseX, windowWidth);
      let yc = constrain(pmouseY, mouseY, windowHeight);
      let x = random(-15, 15);
      let y = random(-15, 15);
      if (dist(0, 0, x, y) < 10) {
        ellipseMode(CENTER);
        ellipse(xc + x, yc + y, 1, 1);
      }
    }
  }
}

// function _(selector) {
//   return document.querySelector(selector);
// }

// function windowResized() {
//   //console.log('resized');//
//   resizeCanvas(windowWidth, windowHeight);
// }
// function setup() {
//   let canvas = createCanvas(windowWidth, windowHeight);
//   canvas.position(0, 0);
//   canvas.style('z-index', '-1');
//   background('rgba(2%,20%,255%,0.1)');
// }
// function mouseDragged() {
//   let type = _("#pen-pencil").checked ? "pencil" : "brush";
//   let size = parseInt(_("#pen-size").value);
//   let color = _("#pen-color").value;
//   fill(color);
//   stroke(color);
//   if (type == "pencil") {
//     line(pmouseX, pmouseY, mouseX, mouseY);
//   } else {
//     ellipse(mouseX, mouseY, size, size);
//   }
// }
// _("#reset-canvas").addEventListener("click", function () {
//   background('rgba(2%,20%,255%,0.1)');
// });
// _("#save-canvas").addEventListener("click", function () {
//   saveCanvas(canvas, "sketch", "png");
// });
