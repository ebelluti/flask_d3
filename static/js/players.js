/* global d3 */
(function () {
  var page = 1;
  var columns = ["short_name", "age", "nationality", "club",
    "player_positions", "overall", "potential"];
  var previous = d3.select("#players-previous");
  var next = d3.select("#players-next");
  var nameInput = document.getElementById("player-name");
  var suggestions = document.getElementById("player-suggestions");
  var result = document.getElementById("nationality-result");
  var submit = document.getElementById("nationality-submit");
  var searchTimer;
  var lookupVersion = 0;

  nameInput.addEventListener("input", function () {
    clearTimeout(searchTimer);
    lookupVersion += 1;
    submit.disabled = false;
    result.textContent = "";
    suggestions.replaceChildren();
    var query = nameInput.value.trim();
    if (query.length < 2) return;
    var version = lookupVersion;
    searchTimer = setTimeout(function () {
      fetch("/players/search?q=" + encodeURIComponent(query))
        .then(function (response) {
          if (!response.ok) throw new Error("Search failed");
          return response.json();
        })
        .then(function (data) {
          if (version !== lookupVersion) return;
          suggestions.replaceChildren();
          data.players.forEach(function (name) {
            var option = document.createElement("option");
            option.value = name;
            suggestions.appendChild(option);
          });
        })
        .catch(function () {
          if (version === lookupVersion) {
            result.textContent = "Suggestions unavailable. Enter an exact player name to look it up.";
          }
        });
    }, 200);
  });

  document.getElementById("nationality-form").addEventListener("submit", function (event) {
    event.preventDefault();
    var name = nameInput.value.trim();
    var version = ++lookupVersion;
    clearTimeout(searchTimer);
    if (!name) {
      result.textContent = "Enter a player name.";
      nameInput.focus();
      return;
    }
    submit.disabled = true;
    result.textContent = "Looking up nationality…";
    fetch("/players/get_nationality?player=" + encodeURIComponent(name))
      .then(function (response) {
        if (response.status === 404) throw new Error("Player not found. Select a suggested name and try again.");
        if (!response.ok) throw new Error("Could not look up nationality. Try again.");
        return response.json();
      })
      .then(function (data) {
        if (version === lookupVersion) result.textContent = name + " — " + data.nationality;
      })
      .catch(function (error) {
        if (version === lookupVersion) result.textContent = error.message;
      })
      .finally(function () {
        if (version === lookupVersion) submit.disabled = false;
      });
  });

  function loadPlayers(requestedPage) {
    previous.property("disabled", true);
    next.property("disabled", true);
    d3.select("#players-status").text("Loading players…");
    d3.json("/players?page=" + requestedPage, function (error, data) {
      if (error) {
        d3.select("#players-status").text("Could not load players. Try again.");
        next.text("Retry").property("disabled", false)
          .on("click", function () { loadPlayers(requestedPage); });
        return;
      }
      page = data.page;
      var rows = d3.select("#players-table tbody").selectAll("tr")
        .data(data.players, function (player) { return player.sofifa_id; });
      rows.exit().remove();
      rows = rows.enter().append("tr").merge(rows).order();
      var cells = rows.selectAll("td").data(function (player) {
        return columns.map(function (column) { return player[column]; });
      });
      cells.enter().append("td").merge(cells)
        .text(function (value) { return value == null ? "—" : value; });
      var totalPages = Math.max(1, Math.ceil(data.count / data.page_size));
      var first = data.players.length ? (page - 1) * data.page_size + 1 : 0;
      var last = data.players.length ? first + data.players.length - 1 : 0;
      d3.select("#players-status").text("Showing " + first + "–" + last +
        " of " + d3.format(",")(data.count) + " players · highest overall first");
      d3.select("#players-page").text("Page " + page + " of " + totalPages);
      previous.property("disabled", page <= 1);
      next.text("Next").property("disabled", page >= totalPages)
        .on("click", function () { loadPlayers(page + 1); });
    });
  }

  previous.on("click", function () { loadPlayers(page - 1); });
  loadPlayers(1);
}());
