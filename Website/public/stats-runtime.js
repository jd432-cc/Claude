/**
 * Runtime alternative to build.mjs — no build step required.
 *
 * The four .stat blocks already in index.html act as the fallback: if the
 * fetch fails, or JS is off, the hardcoded markup stands. On success this
 * replaces them from data/stats.json.
 *
 * Load this BEFORE your language switcher initialises, or re-apply the
 * current language afterwards — these nodes are created after page load,
 * so a switcher that caches its NodeList at startup will miss them.
 */
(function () {
  'use strict';

  var host = document.querySelector('.stats');
  if (!host || !window.fetch) return;

  function seasonYear(season, now) {
    var parts = (season.opensOn || '01-01').split('-');
    var y = now.getFullYear();
    var opens = new Date(y, Number(parts[0]) - 1, Number(parts[1]));
    return now >= opens ? y : y - 1;
  }

  fetch('/data/stats.json', { cache: 'no-cache' })
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function (data) {
      var now = new Date();
      var compute = {
        seasonsOperating: function () {
          return String(seasonYear(data.season, now) - data.season.firstYear + 1);
        },
      };

      var cells = data.stats.map(function (s) {
        var cell = document.createElement('div');
        cell.className = 'stat';

        var val = document.createElement('div');
        val.className = 'stat-value';
        val.textContent = s.compute ? compute[s.compute]() : s.value;

        if (s.suffix) {
          var sup = document.createElement('span');
          sup.className = s.suffixStyle || 'unit';
          sup.textContent = s.suffix;
          val.appendChild(sup);
        }

        var lab = document.createElement('div');
        lab.className = 'stat-label';
        lab.textContent = s.label.en;
        Object.keys(s.label).forEach(function (k) {
          if (k !== 'en') lab.setAttribute('data-' + k, s.label[k]);
        });

        cell.appendChild(val);
        cell.appendChild(lab);
        return cell;
      });

      host.replaceChildren.apply(host, cells);
      document.dispatchEvent(new CustomEvent('stats:rendered'));
    })
    .catch(function () {
      /* keep the fallback markup */
    });
})();
