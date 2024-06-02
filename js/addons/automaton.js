var canvas;
var drawer;
var border = 1;

function windowResized() {
  //console.log('resized');//
  resizeCanvas(windowWidth, windowHeight);
}



function setup() {
  // put setup code here
  canvas = createCanvas(windowWidth, windowHeight);
  canvas.position(0, 0);
  canvas.style('z-index', '-1');
  /*
  canvas.style("overflow", "hidden","absolute");
  var body = new p5.Element(canvas.parent());
  body.style("overflow", "hidden","absolute");
  */
  border = width * height * 0.000001;
  initCA();

}

function draw() {

  drawer.stackDraw();

  strokeWeight(2 * border);
  noFill();
  stroke('rgba(255%,255%,255%,1)');
  rect(0, 0, width, height);
}


function initCA() {

  var res = parseInt(random(100) < 50 ? random(500, 8000) : random(8000, 100000));
  drawer = new Wolframdrawer(new Grid({
    x: border,
    y: border,
    w: width - 2 * border,
    h: height - 2 * border,
    size: res
  }));
  if (drawer.grid.size() < 8000) {
    drawer.initChildren();
  }
  drawer.initDrawingStack();

  background('rgba(2%,20%,255%,0.1)');

}

function mousePressed() {
  initCA();
}

// creates instances of Wolfram (Elementary cellular automaton) and displays
// them with the help of the given grids
// the dimensions of the Elementary cellular automaton is given by the rows and columns of the grid (columns = dimension, rows = generations)
function Wolframdrawer(grid) {
  this.grid = grid;
  this.wolf = new Wolfram(this.grid.columns, this.grid.rows);
  this.b = 200;
  this.childProp = 50;
  this.keepWhite = true;
  this.children = [];
  this.drawingStack = [];
  this.drawingSpeed = 1;

  this.initDrawingStack = function () {
    this.drawingStack = [];

    function Child(i, wolf) {
      this.i = i;
      this.wolf = wolf;
      this.perform = function () {
        /*
        console.log("child draw");
        console.log("perform");
        console.log("i: " + i);*/
        this.wolf.children[this.i].draw();
      };

      this.hello = function () {
        return "child";
      };
    }

    function Parent(wolf, drawBackground) {
      this.drawBackground = drawBackground;
      this.wolf = wolf;
      this.perform = function () {
        this.wolf.draw(this.drawBackground);
      };

      this.hello = function () {
        return "parent";
      };
    }

    if (this.children.length > 0) {

      for (var i = 0; i < this.children.length; i++) {

        var c = new Child(i, this);

        this.drawingStack.push(c);
      }

    }

    if (this.children.length > 0 && this.keepWhite || this.children.length == 0) {
      var w = new Parent(this, false);
      this.drawingStack.push(w);
    }

    this.drawingStack.reverse();

    var p = new Parent(this);

    this.drawingStack.push(p);

    // drawing speed = number of elements picked from drawingStack for each loop of draw()

    if (this.children.length > 0) {
      this.drawingSpeed = floor(this.drawingStack.length / 20.0);
      // limits by childRes:

      var childRes = this.children[0].grid.rows;
      if (childRes >= 35 && childRes < 50) {
        this.drawingSpeed = this.drawingSpeed > 10 ? 10 : this.drawingSpeed;
      } else if (childRes >= 50 && childRes < 80) {
        this.drawingSpeed = this.drawingSpeed > 5 ? 5 : this.drawingSpeed;
      } else if (childRes >= 80 && childRes < 120) {
        this.drawingSpeed = this.drawingSpeed > 3 ? 3 : this.drawingSpeed;
      } else if (childRes >= 120) {
        this.drawingSpeed = 1;
      }
    } else {
      this.drawingSpeed = 2;
    }

    if (this.drawingSpeed < 1) {
      this.drawingSpeed = 1;
    } else if (this.drawingSpeed > 100) {
      this.drawingSpeed = 100;
    }
  }

  this.stackDraw = function () {

    for (var i = 0; i < this.drawingSpeed; i++) {
      var ds = this.drawingStack.pop();
      if (ds != undefined) {
        ds.perform();
      } else {
        break;
      }
    }
  }

  this.initChildren = function () {
    this.keepWhite = Math.random() * 100 < 50;
    this.childProp = parseFloat(Math.random() * 80);
    this.children = [];

    var overlap = Math.random() * 100 < 30 ? 1 : (2 * parseInt(1 + Math.random() * 4));

    var childRes = parseInt(5 + Math.random() * ((overlap * this.grid.cellWidth()) - 5));
    if (childRes < 5) {
      childRes = 5;
    }

    for (var i = 0; i < this.grid.size(); i++) {
      var row = this.grid.getRow(i);
      var column = this.grid.getColumn(i);
      var state = this.wolf.state(column, row);
      var x = this.grid.getX(i);
      var y = this.grid.getY(i);
      var w = this.grid.cellWidth();
      var h = this.grid.cellHeight();

      if (state == 0 && Math.random() * 100 < this.childProp) {
        var child = new Wolframdrawer(new Grid({
          x: x - w / 2,
          y: y - h / 2,
          w: w * overlap,
          h: h * overlap,
          size: childRes * childRes
        }));

        this.children.push(child);
      }
    }

  }

  this.draw = function (drawBackground) {
    if (drawBackground == undefined) {
      drawBackground = true;
    }

    noStroke();

    if (drawBackground) {
      fill(0);
      rect(this.grid.x, this.grid.y, this.grid.w, this.grid.h);
    }

    for (var i = 0; i < this.grid.size(); i++) {
      var row = this.grid.getRow(i);
      var column = this.grid.getColumn(i);
      var state = this.wolf.state(column, row);
      var x = this.grid.getX(i);
      var y = this.grid.getY(i);
      var w = this.grid.cellWidth();
      var h = this.grid.cellHeight();

      if (state == 1) {
        fill(state * this.b);
        rect(x - w / 2, y - h / 2, w, h);
      }
    }
  }
}

// a helper function to create two dimensional grids
function Grid(options) {
  this.x = options.x;
  this.y = options.y;
  this.w = options.w;
  this.h = options.h;
  this.columns = 1;
  this.rows = 1;

  if (options.size != undefined) {
    var wh = this.w > this.h;

    var aspectRatio = wh ? this.w / this.h : this.h / this.w;

    var numX = 0;
    var numY = 0;

    if (this.w == this.h) {
      numX = numY = parseInt(Math.sqrt(options.size * aspectRatio));
    } else if (wh) {
      numX = parseInt(Math.sqrt(options.size * aspectRatio));
      numY = parseInt(options.size / parseFloat(numX));
    } else {
      numY = parseInt(Math.sqrt(options.size * aspectRatio));
      numX = parseInt(options.size / parseFloat(numY));
    }

    if (numX < 1) {
      numX = 1;
    }

    if (numY < 1) {
      numY = 1;
    }

    this.columns = numX;
    this.rows = numY;

  } else {
    this.rows = options.rows;
    this.columns = options.columns;
  }

  this.size = function () {
    return this.rows * this.columns;
  }

  this.getX = function (index) {
    var j = index % this.columns;
    return this.x + (j + 0.5) * this.w / this.columns;
  }

  this.getY = function (index) {
    var i = (index - index % this.columns) / this.columns;
    return this.y + (i + 0.5) * this.h / this.rows;
  }

  this.cellWidth = function () {
    return this.w / this.columns;
  }

  this.cellHeight = function () {
    return this.h / this.rows;
  }

  this.getRow = function (index) {
    return (index - index % this.columns) / this.columns;
  }

  this.getColumn = function (index) {
    return index % this.columns;
  }

  this.toString = function () {
    return "x: " + this.x + ", y: " + this.y + ", w: " + this.w + ", h:" + this.h + ", columns: " + this.columns + ", rows: " + this.rows + ", cellwidth: " + this.cellWidth() + ", cellheight: " + this.cellHeight();
  }
}

// an instance of Generation represents a generation of a Elementary cellular automaton
// a generation is represented as a String where each char represents a state of a cell (chars '0' and '1')
function Generation(options) {
  this.wolfram = options.wolfram;
  this.parent = options.parent;


  this.state = function (wolfram, parent, i) {
    var next = function (i) {
      i++;
      if (i > wolfram.columns - 1) {
        i = 0;
      }

      if (parent.states.charAt(i) == '0') {
        return 0;
      } else {
        return 1;
      }
    };

    var prev = function (i) {
      i--;
      if (i < 0) {
        i = wolfram.columns - 1;
      }

      if (parent.states.charAt(i) == '0') {
        return 0;
      } else {
        return 1;
      }
    };


    var pre = prev(i);
    var cur = 0;

    if (parent.states.charAt(i) == '1') {
      cur = 1;
    }

    var nex = next(i);

    var lookup = "" + pre + "" + cur + "" + nex;
    return wolfram.getRuleset()[lookup];
  };

  this.random = function (wolfram) {
    if (Math.random() * 100 < wolfram.baseProp) {
      return 1;
    } else {
      return 0;
    }
  }
  this.states = function (wolfram, parent, randFct, stateFct) {
    var s = "";
    for (var i = 0; i < wolfram.columns; i++) {

      if (parent == undefined) {
        s += randFct(wolfram);
      } else {
        s += stateFct(wolfram, parent, i);
      }
    }

    return s;
  }(this.wolfram, this.parent, this.random, this.state);

  this.toString = function () {

    var s = "";
    for (var i = 0; i < this.states.length; i++) {
      if (this.states.charAt(i) == '1') {
        s += "1";
      } else {
        s += ".";
      }
    }
    return s;
  }
}

// creates a 2D cellular automaton (Elementary cellular automaton)
// where each row represents a generation
// each instance of Wolfram can have up to 6 rulesets (state transition functions)
// for each change of state one of the rulesets is chosen randomly but weighted (means: some rulesets are more likely to be chosen than others)
function Wolfram(columns, rows) {
  this.intervals = new IntervalSet(0, 100, parseInt(1 + Math.random() * 6));
  this.rows = rows;
  this.columns = columns;

  this.baseProp = 25 + Math.random() * 50;

  this.rulesets = function (prop, num) {

    var rand = function () {
      if (Math.random() * 100 < prop) {
        return 1;
      } else {
        return 0;
      }
    };

    var getRuleset = function () {
      return {
        '000': rand(),
        '001': rand(),
        '010': rand(),
        '100': rand(),
        '110': rand(),
        '101': rand(),
        '011': rand(),
        '111': rand(),
      };
    };

    var rs = [];

    for (var i = 0; i < num; i++) {
      rs.push(getRuleset());
    }

    return rs;
  }(25 + Math.random() * 50, this.intervals.num);

  this.getRuleset = function () {
    return this.rulesets[this.intervals.random()];
  };

  this.base = new Generation({
    wolfram: this
  });

  this.generations = function (wolfram, base, num) {
    var gens = [];
    gens.push(new Generation({
      wolfram: wolfram,
      parent: base
    }));

    for (var i = 1; i < num; i++) {
      gens.push(new Generation({
        wolfram: wolfram,
        parent: gens[i - 1]
      }));

    }
    return gens;
  }(this, this.base, this.rows);

  this.state = function (column, row) {
    if (this.generations[row].states.charAt(column) == '0') {
      return 0;
    } else {
      return 1;
    }
  }

  this.toString = function () {
    var s = "";
    for (var i = 0; i < this.rows; i++) {
      s += this.generations[i] + "\n";
    }

    return s;
  }
}

// creates a set of intervals
// the union of all (sub-)intervals is the same as the interval of given [min, max]
// the number of sub-intervals is given by the parameter 'num'
// can create a random int number, where the each int corresponds to a sub-interval
// the int numbers which correspond to a sub-interval with greater range than other sub-intervals will be returned more often by that random function
function IntervalSet(min, max, num) {
  this.min = min;
  this.max = max;
  this.num = num;
  this.ranges = [];

  this.setup = function (container, min, max, num) {
    if (num == 1) {
      container.push(new Interval(min, max));
    } else {
      var ff = randFloats(min, max, num - 1);
      container.push(new Interval(min, ff[0]));
      for (var v = 0; v < ff.length - 1; v++) {
        container.push(new Interval(ff[v], ff[v + 1]));
      }
      container.push(new Interval(ff[ff.length - 1], max));
    }
  }(this.ranges, this.min, this.max, this.num);

  this.random = function () {
    if (this.ranges.length == 1) {
      return 0;
    }

    var r = this.min + Math.random() * (this.max - this.min);

    for (var i = 0; i < this.ranges.length - 1; i++) {
      if (this.ranges[i].contains(r)) {
        return i;
      }
    }

    return this.ranges.length - 1;
  }

  this.toString = function () {
    var s = this.num + ": " + "{ ";

    for (var i = 0; i < this.ranges.length - 1; i++) {
      s += this.ranges[i] + ", ";
    }

    s += this.ranges[this.ranges.length - 1] + " }";

    return s;
  }

}

// for objects representing an interval incl. a function
// that checks if a given value is member of the interval
function Interval(min, max) {
  this.min = min;
  this.max = max;

  this.contains = function (val) {
    return val >= this.min && val < this.max;
  }

  this.toString = function () {
    return "[" + this.min + ", " + this.max + "]";
  }
}

// creates an array of random float values that are in range of [min, max)
// the returned array has the size defined by 'num'
// the returned array is sorted beginning with the smalles number
function randFloats(min, max, num) {
  var create = function (min, max, num, next) {
    var ff = [];
    for (var i = 0; i < num; i++) {
      ff.push(min + Math.random() * (max - min));
    }

    return next(ff);
  }

  var sort = function (ff) {

    var sorted = false;
    while (!sorted) {
      sorted = true;

      for (let i = 0; i < ff.length - 1; i++) {
        if (ff[i] > ff[i + 1]) {
          var tmp = ff[i + 1];
          ff[i] = ff[i + 1];
          ff[i + 1] = tmp;
          sorted = false;
        }
      }
    }
    return ff;
  }

  return create(min, max, num, sort);
}
