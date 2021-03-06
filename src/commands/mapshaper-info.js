/* @require mapshaper-common, mapshaper-dataset-utils, mapshaper-endpoints */

api.printInfo = function(dataset, opts) {
  // str += utils.format("Number of layers: %d\n", dataset.layers.length);
  // if (dataset.arcs) str += utils.format("Topological arcs: %'d\n", dataset.arcs.size());
  var str = dataset.layers.map(function(lyr, i) {
    var infoStr = MapShaper.getLayerInfo(lyr, dataset.arcs);
    if (dataset.layers.length > 1) {
      infoStr = 'Layer ' + (i + 1) + '\n' + infoStr;
    }
    return infoStr;
  }).join('\n\n');
  message(str);
};

// TODO: consider polygons with zero area or other invalid geometries
MapShaper.countNullShapes = function(shapes) {
  var count = 0;
  for (var i=0; i<shapes.length; i++) {
    if (!shapes[i] || shapes[i].length === 0) count++;
  }
  return count;
};

MapShaper.getGeometryInfo = function(lyr, id) {
  var type = lyr.geometry_type || "[none]";
  if (utils.isInteger(id) && lyr.shapes && !lyr.shapes[id]) {
    type = '[null]';
  }
  return "Geometry: " + type + "\n";
};

MapShaper.getLayerInfo = function(lyr, arcs) {
  var shapeCount = lyr.shapes ? lyr.shapes.length : 0,
      nullCount = shapeCount > 0 ? MapShaper.countNullShapes(lyr.shapes) : 0,
      str;
  str = "Layer name: " + (lyr.name || "[unnamed]") + "\n";
  str += utils.format("Records: %,d\n", MapShaper.getFeatureCount(lyr));
  str += MapShaper.getGeometryInfo(lyr);
  if (nullCount > 0) {
    str += utils.format("Null shapes: %'d\n", nullCount);
  }
  if (shapeCount > nullCount) {
    str += "Bounds: " + MapShaper.getLayerBounds(lyr, arcs).toArray().join(' ') + "\n";
  }
  str += MapShaper.getTableInfo(lyr);
  return str;
};

MapShaper.getTableInfo = function(lyr, i) {
  if (!lyr.data || lyr.data.size() === 0) {
    return "Attribute data: [none]";
  }
  return MapShaper.getAttributeInfo(lyr.data, i);
};

MapShaper.getAttributeInfo = function(data, i) {
  var featureId = i || 0;
  var featureLabel = i >= 0 ? 'Value' : 'First value';
  var fields = data.getFields().sort();
  var replacements = {
    '\n': '\\n',
    '\r': '\\r',
    '\t': '\\t'
  };
  var cleanChar = function(c) {
    // convert newlines and carriage returns
    // TODO: better handling of non-printing chars
    return c in replacements ? replacements[c] : '';
  };
  var col1Chars = fields.reduce(function(memo, name) {
    return Math.max(memo, name.length);
  }, 5) + 2;
  var vals = fields.map(function(fname) {
    return data.getRecordAt(featureId)[fname];
  });
  var digits = vals.map(function(val, i) {
    return utils.isNumber(vals[i]) ? (val + '.').indexOf('.') + 1 :  0;
  });
  var maxDigits = Math.max.apply(null, digits);
  var table = vals.map(function(val, i) {
    var str = '  ' + utils.rpad(fields[i], col1Chars, ' ');
    if (utils.isNumber(val)) {
      str += utils.lpad("", maxDigits - digits[i], ' ') + val;
    } else if (utils.isString(val)) {
      val = val.replace(/[\r\t\n]/g, cleanChar);
      str += "'" + val + "'";
    } else {
      str += String(val);
    }
    return str;
  }).join('\n');
  return "Attribute data\n  " +
      utils.rpad('Field', col1Chars, ' ') + featureLabel + "\n" + table;
};

MapShaper.getSimplificationInfo = function(arcs) {
  var nodeCount = new NodeCollection(arcs).size();
  // get count of non-node vertices
  var internalVertexCount = MapShaper.countInteriorVertices(arcs);
};

MapShaper.countInteriorVertices = function(arcs) {
  var count = 0;
  arcs.forEach2(function(i, n) {
    if (n > 2) {
      count += n - 2;
    }
  });
  return count;
};
