// shared/dom.js — Canonical DOM element factory.
// Usage: TSIC.el('div', { class: 'foo' }, 'text', childEl)
// Usage: TSIC.svg('circle', { cx: 10, cy: 10, r: 5 })
(function () {
  var NS_SVG = 'http://www.w3.org/2000/svg';

  function el(tag, attrs) {
    var e = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        if (k === 'style' && typeof attrs[k] === 'object') {
          for (var s in attrs[k]) e.style[s] = attrs[k][s];
        } else {
          e.setAttribute(k, attrs[k]);
        }
      }
    }
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c == null) continue;
      e.append(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return e;
  }

  function svg(tag, attrs) {
    var e = document.createElementNS(NS_SVG, tag);
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c != null) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return e;
  }

  window.TSIC = window.TSIC || {};
  window.TSIC.el = el;
  window.TSIC.svg = svg;
})();
