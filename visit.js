// Loaded first on every page. Two jobs, both so the demo works behind the MMI demos gateway
// (see the gateway's docs/demo-contract.md):
//
// 1. The demo can be served from a sub-folder (demos.mmintelligence.ai/<slug>/) as well as from
//    its own address. An address in the demo that starts with "/" means "from the demo's root",
//    so the folder is added in front of it for fetch, sendBeacon and anything using demoPath().
// 2. The visitor's share link (as the gateway knows it) is sent with every call to the demo's
//    own API, so each link keeps its own calls and outbound dialling can be checked.
(function () {
  // This file sits at the demo's root, so its own address gives the folder: "/" or "/<slug>/".
  var root = new URL(".", document.currentScript.src).pathname;

  /** Turn a root address ("/api/queue") into one that works from wherever the demo is served. */
  function demoPath(url) {
    if (typeof url !== "string" || url.charAt(0) !== "/" || url.charAt(1) === "/") return url;
    return root === "/" || url.indexOf(root) === 0 ? url : root + url.slice(1);
  }
  window.demoPath = demoPath;

  var send = window.fetch;
  window.fetch = function (input, init) {
    try {
      if (typeof input === "string") {
        var isApi = input.indexOf("/api/") === 0;
        input = demoPath(input);
        var visit = isApi && window.mmiDemo && window.mmiDemo.visit && window.mmiDemo.visit();
        if (visit) {
          init = Object.assign({}, init);
          init.headers = Object.assign({}, init.headers, { "x-mmi-visit": visit });
        }
      }
    } catch (e) {
      // never get in the way of the call itself
    }
    return send.call(this, input, init);
  };

  if (navigator.sendBeacon) {
    var beacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = function (url, data) {
      return beacon(demoPath(url), data);
    };
  }
})();
