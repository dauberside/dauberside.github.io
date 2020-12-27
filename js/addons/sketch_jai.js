function setup() {
  createCanvas(500, 500);
  let blueChannel = new Riso("blue"); //create riso object, set to blue

  blueChannel.fill(255); // completely opaque
  blueChannel.ellipse(0, 0, 100, 100); //draw ellipse on blue layer

  blueChannel.fill(50); // fairly transparent
  blueChannel.ellipse(50, 50, 100, 100);

  blueChannel.fill(3); // almost invisible
  blueChannel.ellipse(75, 75, 100, 100);

  drawRiso();
}
