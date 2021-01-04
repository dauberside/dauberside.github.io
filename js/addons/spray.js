
var color c1, c2;

void setup(){
  size(640, 640);
  frameRate(360);
  background(255);
  noStroke();
  c1 = color(random(255), random(255), random(255));
  c2 = color(random(255), random(255), random(255));
}

void draw(){

  if (mousePressed) {
    for (int i = 0; i < 1000; i++) {
      float radious = (1.0 - pow(random(1), 1.0 / 2.0)) * 100;
      float angle = random(TWO_PI);
      float v = 1.0 - (frameCount % 200) / 200.0;
      color c = color(red(c1) * v + red(c2) * (1.0 - v), green(c1) * v + green(c2) * (1.0 - v), blue(c1) * v + blue(c2) * (1.0 - v));
      fill(c, 10);
      ellipse(mouseX + radious * cos(angle), mouseY + radious * sin(angle), 1, 1);
    }

    if (frameCount % 200 == 199) {
      c1 = c2;
      c2 = color(random(255), random(255), random(255));
    }
  }

}
