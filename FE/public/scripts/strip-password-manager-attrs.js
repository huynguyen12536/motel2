(function () {
  try {
    var attrs = ["bis_skin_checked", "bis_register"];
    var processedPrefix = "__processed_";

    function clean(node) {
      if (!node || node.nodeType !== 1 || !node.removeAttribute) return;
      for (var i = 0; i < attrs.length; i++) {
        if (node.hasAttribute(attrs[i])) node.removeAttribute(attrs[i]);
      }
      if (node.getAttributeNames) {
        var names = node.getAttributeNames();
        for (var j = 0; j < names.length; j++) {
          if (names[j].indexOf(processedPrefix) === 0) {
            node.removeAttribute(names[j]);
          }
        }
      }
    }

    function sweep(root) {
      clean(root);
      if (!root || !root.querySelectorAll) return;
      for (var i = 0; i < attrs.length; i++) {
        var list = root.querySelectorAll("[" + attrs[i] + "]");
        for (var j = 0; j < list.length; j++) clean(list[j]);
      }
    }

    sweep(document.documentElement);
    new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var mutation = mutations[i];
        if (mutation.type === "attributes") clean(mutation.target);
        else if (mutation.type === "childList") {
          for (var j = 0; j < mutation.addedNodes.length; j++) {
            sweep(mutation.addedNodes[j]);
          }
        }
      }
    }).observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: attrs,
    });
  } catch {
    /* ignore */
  }
})();
