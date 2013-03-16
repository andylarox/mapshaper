/** @requires core.geo, browser, hybrid-touch */



function HybridMouse() {
  this._ignoredElements = [];
  this.dragging = false;
  this._overMap = false;
  this._boundsOnPage = new BoundingBox();

  //trace(">> HybridMouse() touch?", Browser.touchEnabled);

  if (!Browser.touchEnabled) {
  
      // Changed from window.onmousemove; ie8- doesn't support mousemove on window
      //Browser.addEventListener(document, 'mousemove', this.handleMouseMove, this);
      Browser.addEventListener(document, 'mousemove', this.throttledMouseMove, this);

      //Browser.addEventListener(document, 'mouseout', function() { trace("out"); });
      //Browser.addEventListener(window, 'resize', this.updateDivBounds, this);
      // using body instead of window; window is triggered by interaction with browser scrollbars.
      Browser.addEventListener(document.body, 'mousedown', this.handleMouseDown, this);

      Browser.addEventListener(document, 'mouseup', this.handleMouseUp, this);
  }
}


Opts.inherit(HybridMouse, Waiter);

HybridMouse.prototype.ignoreElement = function(el) {
  if (!el || Utils.contains(this._ignoredElements, el)) {
    return;
  }
  this._ignoredElements.push(el);
};


HybridMouse.prototype.setMapContainer = function(surface) {
  if (!surface) {
    trace("!!! [HybridMouse.setMapContainer()] surfac is empty");
    return;
  }
  if (this._mapContainer) {
    return;
  }
  this._mapContainer = surface;
  var self = this;

  if (Browser.iPhone || Browser.touchEnabled) {
    var touch = new TouchHandler(surface, this._boundsOnPage);
    touch.addEventListener('touchstart', this.handleTouchStart, this);
    touch.addEventListener('touchend', this.handleTouchEnd, this);
    this.touch = touch;
  }


  Browser.addEventListener(surface, 'mouseover', handleMouseOver, this);
  //  Moved adding mouseout handler to handleMouseOver()
  //  Browser.addEventListener(surface, 'mouseout', handleMouseOut, this);
  Browser.addEventListener(surface, 'dblclick', handleDoubleClick, this);

  function handleMouseOver(e) {
    //trace("[HybridMouse.handleMouseOver()]");
    self.triggerMouseOver();
  }


  function handleDoubleClick(e) {
    if (self.overMap()) {
      // DOESNT WORK (Chrome) // e.preventDefault(); // Prevent map element from being selected in the browser.
      var obj = self.getStandardMouseData(e);
      self.dispatchEvent('dblclick', obj);
    }
  }

  this.isReady() == false && this.startWaiting();
};


HybridMouse.prototype.overMap = function() {
  return this._overMap;
};

HybridMouse.prototype.mouseDown = function() {
  return !!this._mouseDown;
};

HybridMouse.prototype.handleTouchStart = function(evt) {
  this.triggerMouseOver();
  this.handleMouseMove(evt);
};

HybridMouse.prototype.handleTouchEnd = function(evt) {
  this.triggerMouseOut();
  //this.handleMouseMove(evt); // KLUDGE: this should go away
};

/** 
 * Now fired on body -> mouseover
 */
HybridMouse.prototype.handleMouseOut = function(e) {

  // Don't fire mouseout if we are rolling around inside the map container.
  // ... or have rolled over a popup, etc...
  //
  var target = (e.target) ? e.target : e.srcElement;
  var surface = this._mapContainer;

  while (target && target.nodeName != 'BODY' && target != window) {
    if (target == surface || Utils.contains(this._ignoredElements, target)) {
      this._deferringMouseOut = true;
      return;
    }
    target = target.parentNode;
  }

  this.triggerMouseOut();
}


HybridMouse.prototype.triggerMouseOut = function() {
  if (this._overMap) {
    this._overMap = false;

    if (true) {
      Browser.removeEventListener(this._mapContainer, 'mouseout', this.handleMouseOut, this);
      //Browser.removeEventListener(window, 'mouseout', this.handleMouseOut, this);
    } else {
      Browser.removeEventListener(document.body, 'mouseover', this.handleMouseOut, this);
      Browser.removeEventListener(window, 'mouseout', this.handleMouseOut, this);
    }

    this.dispatchEvent('mouseout');
  }
};

HybridMouse.prototype.triggerMouseOver = function() {

  this._deferringMouseOut = false; // cancel deferred mouse out, e.g. mousing over a popup

  //Utils.log("[HybridMouse.triggerMouseOver()] _overMap: " + this._overMap);
  if (!this._overMap) {
    this._overMap = true;

    if (true) {
      //Browser.addEventListener(window, 'mouseout', this.handleMouseOut, this);
      Browser.addEventListener(this._mapContainer, 'mouseout', this.handleMouseOut, this);
    } else {
      this._mapContainer != document.body && Browser.addEventListener(document.body, 'mouseover', this.handleMouseOut, this);
      Browser.addEventListener(window, 'mouseout', this.handleMouseOut, this);
    }
    this.dispatchEvent('mouseover');
  }
};


HybridMouse.prototype.updateDragging = function(obj) {
  var overMap = this.overMap();
  var mouseDown = this.mouseDown();

  if (!this.dragging) {
    if (mouseDown && overMap) {
      this._dragStartData = obj;
      this.dragging = true;
      this._prevX = obj.pageX;
      this._prevY = obj.pageY;
      this.dispatchEvent('dragstart', obj);
    }
  }
  else if (!mouseDown) {
    this.dragging = false;
    this.dispatchEvent('dragend', obj);
  }
  else {
    obj.shiftX = obj.pageX - this._dragStartData.pageX;
    obj.shiftY = obj.pageY - this._dragStartData.pageY;
    obj.deltaX = obj.pageX - this._prevX;
    obj.deltaY = obj.pageY - this._prevY;
    this.dispatchEvent('drag', obj);
    this._prevX = obj.pageX;
    this._prevY = obj.pageY;
  }
};

HybridMouse.prototype.handleMouseDown = function(e) {
  this._mouseDown = true;

  if (this.overMap()) {
    // e.preventDefault && e.preventDefault(); // try to prevent selection
    var data = this.getStandardMouseData(e);
    data.downTime = (new Date()).getTime();
    this._downData = data;
    this.updateDragging(data);
  }
};

HybridMouse.prototype.handleMouseUp = function(e) {
  //trace("[HybridMouse.handleMouseUp(); over map?", this.overMap());
  this._mouseDown = false;
  var upData = this.getStandardMouseData(e);
  this.updateDragging(upData);

  var downData = this._downData;
  if (downData && this.overMap()) {
    if (Math.abs(downData.pageX - upData.pageX) + Math.abs(downData.pageY - upData.pageY) < 6) {
      var elapsed = (new Date()).getTime() - downData.downTime;
      if (elapsed < 500) {
        this.dispatchEvent('click', upData);
      }
    }
  }
};


HybridMouse.prototype.updateContainerBounds = function(l, t, r, b) {
  this._boundsOnPage.setBounds(l, t, r, b);
};

HybridMouse.prototype.getStandardMouseData = function(e) {
  // Get x, y pixel location of mouse relative to t, l corner of the page.
  e = this.standardizeMouseEvent(e);
  var pageX = e.pageX;
  var pageY = e.pageY;
  
  var bounds = this._boundsOnPage;
  var mapX = pageX - bounds.left;
  var mapY = pageY - bounds.bottom; // bottom is actually the upper bound

  return { pageX:pageX, pageY:pageY, mapX:mapX, mapY:mapY, centerX:bounds.centerX(), centerY:bounds.centerY(), deltaX:0, deltaY:0, deltaScale:1 };
};

HybridMouse.prototype.getCurrentMouseData = function() {
  var obj = {};
  if (this._moveData) {
    Opts.copyAllParams(obj, this._moveData);
  }
  return obj;
};

HybridMouse.prototype.pageX = function() {
  return this._moveData.pageX;
};

HybridMouse.prototype.pageY = function() {
  return this._moveData.pageY;
};


var moveCount = 0;
var moveSecond = 0;

HybridMouse.prototype.standardizeMouseEvent = function(e) {
  if (e && e.pageX !== void 0) {
    return e;
  }
  e = e || window.event;
  var o = {
    pageX : e.pageX || e.clientX + document.body.scrollLeft +
      document.documentElement.scrollLeft,
    pageY : e.pageY || e.clientY + document.body.scrollTop +
      document.documentElement.scrollTop
  };
  return o;
};


/*
HybridMouse.prototype.throttledMouseMove = function(e) {
  e = this.standardizeMouseEvent(e); // handle ie's nonstandard events
  this._latestMoveEvent = e;
  if (this._throttleCount) {
    this._throttleCount++;
    return;
  }
  var minInterval = 40;
  var now = (new Date).getTime();
  var elapsed = now - (this._prevMoveTime || 0);
  if (elapsed < minInterval) {
    var self = this;
    var ms = minInterval - elapsed;
    this._throttleCount = 1;
    setTimeout(function() { self._throttleCount = 0; self.throttledMouseMove(self._latestMoveEvent) }, ms);
    return;
  }
  this._prevMoveTime = now;
  this.handleMouseMove(e);
};
*/

HybridMouse.prototype.throttledMouseMove = function(e) {
  var minInterval = 40;
  var now = (new Date).getTime();
  var elapsed = now - (this._prevMoveTime || 0);
  if (elapsed > minInterval) {
    this._prevMoveTime = now;
    this.handleMouseMove(e);
  }
};

HybridMouse.prototype.handleMouseMove = function(e) {
  /*
  var now = (new Date).getTime();
  var sec = Math.floor(now / 1000);
  moveCount ++;
  if (sec != moveSecond) {
    moveSecond = sec;
    trace(moveCount + "/sec");
    moveCount = 0;
  }
  */

  this._moveData = this.getStandardMouseData(e);
  this.triggerMouseMove();
};

HybridMouse.prototype.triggerMouseMove = function() {
  var obj = this._moveData;
  if (!obj) {
    return;
  }
  //var isOver = this._boundsOnPage.containsPoint(obj.pageX, obj.pageY) && this._overMap;

  var isOver = this._boundsOnPage.containsPoint(obj.pageX, obj.pageY); //  && this._overMap;


  //trace("[HybridMouse.triggerMouseMove()] over?", isOver);
  // Fallback over / out events if map container hasn't been registered
  //
  if (!this._mapContainer) {
    var wasOver = this._overMap;
    if (isOver && !wasOver) {
      this.triggerMouseOver();
    }
    else if (!isOver && wasOver) {
      this.triggerMouseOut();
    }
  } else if (this._deferringMouseOut) {
    this._deferringMouseOut = false;
    this.triggerMouseOut();
  }


  //if (isOver) {
  if (this._overMap) {
    this.dispatchEvent('mousemove', obj);
  }

  this.updateDragging(obj);
};

