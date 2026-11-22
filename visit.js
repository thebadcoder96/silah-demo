// Sends the visitor's share link (as the MMI demos gateway knows it) with every call to
// this demo's own API, so each link keeps its own calls and outbound dialling can be checked.
// Loaded on every page right after the gateway's script. See the gateway's docs/demo-contract.md.
(function () {
  var send = window.fetch;
  window.fetch = function (input, init) {
    try {
      var url = typeof input === "string" ? input : (input && input.url) || "";
      var visit = window.mmiDemo && window.mmiDemo.visit && window.mmiDemo.visit();
      if (visit && url.indexOf("/api/") === 0) {
        init = Object.assign({}, init);
        init.headers = Object.assign({}, init.headers, { "x-mmi-visit": visit });
      }
    } catch (e) {
      // never get in the way of the call itself
    }
    return send.call(this, input, init);
  };
})();
