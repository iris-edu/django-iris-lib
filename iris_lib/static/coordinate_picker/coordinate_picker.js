(function($, google) {
  'use strict'

  var Picker = function(root, options) {
    this.$root = $(root);
    this.parseOptions(options);
    this.start();
  };

  Picker.prototype.defaults = {
    nsewInputs: [],
    openBtn: null,
    width: 600,
    height: 400,
    mapOptions: {
      zoom: 1,
      center: new google.maps.LatLng(0,0),
      mapTypeId: google.maps.MapTypeId.ROADMAP,
      streetViewControl: false
    },
    rectangleOptions: {
      draggable: false,
      editable: false,
      clickable: false
    },
    circleOptions: {
      draggable: false,
      editable: false,
      clickable: false
    }
  };

  Picker.prototype.parseOptions = function(options) {
    this.options = $.extend(true, {}, this.defaults, options );
  };

  Picker.prototype.start = function() {
    var _this = this;
    // Create picker button if not defined
    this.$openBtn = this.options.openBtn;
    if (this.options.openBtn) {
      this.$openBtn = $(this.options.openBtn);
    } else {
      this.$openBtn = $('<button type="button" class="btn btn-default">Pick Coordinates</button>');
      this.$root.append($('<div class="text-center">').append(this.$openBtn));
    }
    // Connect to inputs
    this.$inputN = $(this.options.nsewInputs[0] || $('input[name*=north]', this.$root));
    this.$inputS = $(this.options.nsewInputs[1] || $('input[name*=south]', this.$root));
    this.$inputE = $(this.options.nsewInputs[2] || $('input[name*=east]', this.$root));
    this.$inputW = $(this.options.nsewInputs[3] || $('input[name*=west]', this.$root));

    // Div that the map attaches to
    var $map = $('<div class="coordinate-picker-map" style="width:'+this.options.width+'px;height:'+this.options.height+'px;"></div>');
    // Overlay sits on top of the map so we can capture mouse events
    var $mapOverlay = $('<div class="coordinate-picker-overlay"></div>');
    // Drawing congtrols
    var $rectBtn = $('<button type="button" class="btn btn-default btn-xs"><span class="glyphicon glyphicon-pencil"></span> Draw Box</button>');
    var $circleBtn = $('<button type="button" class="btn btn-default btn-xs"><span class="glyphicon glyphicon-pencil"></span> Draw Circle</button>');
    var $panBtn = $('<button type="button" class="btn btn-default btn-xs"><span class="glyphicon glyphicon-move"></span> Pan/Zoom</button>');
    var $drawPanControls = $('<div class="coordinate-picker-top-controls">').append(
      "<small>Drawing mode:</small> ",
      $('<div class="btn-group">').append($rectBtn, $circleBtn, $panBtn));
    // Dialog controls
    var $okBtn = $('<button type="button" class="btn btn-primary btn-sm">Ok</button>');
    var $cancelBtn = $('<button type="button" class="btn btn-default btn-sm">Cancel</button>');
    var $okCancelControls = $('<div class="coordinate-picker-bottom-controls">').append($okBtn, ' ', $cancelBtn);

    var $qtipTarget = this.$root;
    var rectShape = null;
    var circleShape = null;
    var drawStartPoint = null;
    var map = null;
    // GMaps overlay for coordinate translation
    var ov = new google.maps.OverlayView();
    ov.onAdd = function () {
    };
    ov.draw = function () {
    };
    ov.onRemove = function () {
    };
    // Set to null, "rect" or "circle"
    var drawingMode = null;
    function setDrawingMode(mode) {
      drawingMode = mode;
      if (drawingMode) {
        $mapOverlay.show();
      } else {
        $mapOverlay.hide();
      }
      $rectBtn.toggleClass('active', drawingMode === 'rect');
      $circleBtn.toggleClass('active', drawingMode === 'circle');
      $panBtn.toggleClass('active', !drawingMode);
    }
    function enableRectMode() {
      setDrawingMode('rect');
    }
    function enableCircleMode() {
      setDrawingMode('circle');
    }
    function disableDrawingMode() {
      setDrawingMode(null);
    }
    $rectBtn.click(enableRectMode);
    $circleBtn.click(enableCircleMode);
    $panBtn.click(disableDrawingMode);

    /* Position is from mouse event evt.pageX, evt.pageY */
    function getPoint(pageX, pageY) {
      var offset = $map.offset();
      var posX = pageX - offset.left;
      var posY = pageY - offset.top;
      posX = Math.min(posX, $map.width());
      posY = Math.min(posY, $map.height());
      return new google.maps.Point(posX, posY);
    }
    /* Turn a point into a LatLng */
    function getLatLng(point) {
      var prj = ov.getProjection();
      return prj.fromContainerPixelToLatLng(point);
    }

    function updateRect(point) {
      var left = Math.min(point.x, drawStartPoint.x);
      var right = Math.max(point.x, drawStartPoint.x);
      var top = Math.min(point.y, drawStartPoint.y);
      var bottom = Math.max(point.y, drawStartPoint.y);
      // console.log("("+left+","+bottom+")-("+right+","+top+")");
      rectShape.setBounds(new google.maps.LatLngBounds(
        getLatLng(new google.maps.Point(left, bottom)),
        getLatLng(new google.maps.Point(right, top))
      ));
    }
    
    function updateCircle(point) {
      var latLng = getLatLng(point);
      var radius = 15*100000; // google.maps.geometry
      circleShape.setRadius(radius);
    }

    function startDrawing(e) {
      if (rectShape) {
        rectShape.setMap(null);
      }
      drawStartPoint = getPoint(e.pageX, e.pageY);
      var latLng = getLatLng(drawStartPoint);
      if (drawingMode === 'rect') {
        var rectOptions = $.extend({}, _this.options.rectangleOptions, {
          map: map,
          bounds: new google.maps.LatLngBounds(latLng, latLng)
        });
        rectShape = new google.maps.Rectangle(rectOptions);
      }
      else if (drawingMode === 'circle') {
        var circleOptions = $.extend({}, _this.options.circleOptions, {
          map: map,
          center: latLng,
          radius: 0
        });
        circleShape = new google.maps.Circle(circleOptions);
      }
    }
    function keepDrawing(e) {
      var point = getPoint(e.pageX, e.pageY);
      if (drawingMode === 'rect') {
        updateRect(point);
      }
      else if (drawingMode === 'circle') {
        updateCircle(point);
      }
    }
    function stopDrawing(e) {
      keepDrawing(e);
      drawStartPoint = null;
    }

    function initMap() {
      // Create map object
      map = new google.maps.Map($map[0], _this.options.mapOptions);
      // Add the overlay DOM after the OverlayView is added, to ensure it is on top
      ov.onAdd = function() {
        $map.append($mapOverlay);
      }
      ov.setMap(map);
      $mapOverlay.mousedown(function(e) {
        if (drawingMode) {
          startDrawing(e);
        }
      });
      $(document).mousemove(function(e) {
        if (drawingMode && drawStartPoint) {
          keepDrawing(e);
        }
      });
      $(document).mouseup(function(e) {
        if (drawingMode && drawStartPoint) {
          stopDrawing(e);
          disableDrawingMode();
        }
      });
      _this.map = map;
    }
    function initRect() {
      var locN = parseFloat(_this.$inputN.val());
      var locS = parseFloat(_this.$inputS.val());
      var locE = parseFloat(_this.$inputE.val());
      var locW = parseFloat(_this.$inputW.val());
      // Skip if no/invalid coordinates
      if (isNaN(locN) || isNaN(locS) || isNaN(locE) || isNaN(locW)) {
        return;
      }
      // Skip if these are global coordinates
      if (locN > 89 && locS < -89 && locE > 179 && locW < -179) {
        return;
      }
      var firstTime = false;
      if (rectShape) {
        rectShape.setMap(null);
      } else {
        firstTime = true;
      }
      rectShape = new google.maps.Rectangle(
        $.extend( {}, _this.options.rectangleOptions, {
          map: map,
          bounds: new google.maps.LatLngBounds(
            new google.maps.LatLng(locS,locW),
            new google.maps.LatLng(locN,locE)
          )
        })
      );
      // Zoom into current bounds on initial open
      if (firstTime) {
        google.maps.event.addListenerOnce(map, 'idle', function(r) {
          map.fitBounds(rectShape.getBounds());
          if (map.getZoom() > 5) {
            map.setZoom(5);
          }
        });
      }
    }

    $qtipTarget.qtip({
      content: {
        title: 'Draw a box on the map to define a region',
        text: 'Loading map...'
      },
      position: {
        my: 'center',
        at: 'center',
        viewport: $(document)
      },
      show: {
        target: this.$openBtn,
        event: 'click'
      },
      hide: {
        event: 'unfocus'
      },
      style: {
        classes: 'coordinate-picker qtip-bootstrap'
      },
      events: {
        render: function(event, api) {
          var tooltip = $(this);
          api.elements.content.empty().append($drawPanControls, $map, $okCancelControls);
          // Temporarily show the tooltip so we don't get rendering bugs in GMaps
          tooltip.show();
          initMap();
          // Hide the tooltip again now we're done
          tooltip.hide();
        },
        show: function(event, api) {
          // Initialize/update the current selection
          initRect();
          // If there is no selection, start in drawing mode
          if (rectShape) { disableDrawingMode(); }
          else { enableRectMode(); }
        }
      }
    });
    $cancelBtn.click(function() {
      $qtipTarget.qtip('hide');
    });
    $okBtn.click(function() {
      $qtipTarget.qtip('hide');
      if (rectShape) {
        var bounds = rectShape.getBounds();
        _this.$inputS.val(bounds.getSouthWest().lat().toFixed(3));
        _this.$inputW.val(bounds.getSouthWest().lng().toFixed(3));
        _this.$inputN.val(bounds.getNorthEast().lat().toFixed(3));
        _this.$inputE.val(bounds.getNorthEast().lng().toFixed(3));
      }
    });
  };

  $.fn.coordinate_picker = function(options) {
    var picker = new Picker(this, options);
    $(this).data('coordinate_picker', picker);
    return this;
  };

})(jQuery, google);
