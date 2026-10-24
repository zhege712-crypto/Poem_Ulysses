// Web fonts enhance the page after local fallback fonts have rendered it.
(function () {
  document.querySelectorAll('link[data-optional-fonts]').forEach(function (link) {
    var applied = false;
    function apply() {
      if (applied) return;
      applied = true;
      link.media = 'all';
    }
    link.addEventListener('load', apply, {once: true});
    if (link.sheet) apply();
  });
})();
