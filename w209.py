"""Flask app for the D3 example."""

import os
import sqlite3

import pandas as pd
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)


APP_FOLDER = os.path.dirname(os.path.realpath(__file__))
PLAYERS_DB = os.path.join(APP_FOLDER, "data", "players_20.db")

@app.route("/api")
def api():
    return jsonify(x=2)

@app.route("/players/count")
def players_count():
    with sqlite3.connect(f"file:{PLAYERS_DB}?mode=ro", uri=True) as connection:
        count = connection.execute("SELECT COUNT(*) FROM players").fetchone()[0]
    return jsonify(count=count)

@app.route("/players/search")
def search_players():
    query = request.args.get("q", "").strip()
    if len(query) < 2:
        return jsonify(players=[])
    with sqlite3.connect(f"file:{PLAYERS_DB}?mode=ro", uri=True) as connection:
        rows = connection.execute(
            "SELECT short_name FROM players "
            "WHERE instr(lower(short_name), lower(?)) > 0 "
            "GROUP BY short_name ORDER BY MAX(overall) DESC, short_name LIMIT 20",
            (query,),
        ).fetchall()
    return jsonify(players=[row[0] for row in rows])

@app.route("/players/get_nationality")
def get_nationality():
    player = request.args.get("player", "").strip()
    if not player:
        return jsonify(error="player query parameter is required"), 400
    with sqlite3.connect(f"file:{PLAYERS_DB}?mode=ro", uri=True) as connection:
        row = connection.execute(
            "SELECT nationality FROM players WHERE short_name = ?",
            (player,),
        ).fetchone()
    if row is None:
        return jsonify(error="Player not found"), 404
    return jsonify(nationality=row[0])

@app.route("/players")
def players_list():
    page = request.args.get("page", default=1, type=int)
    if page is None or page < 1:
        return jsonify(error="page must be a positive integer"), 400
    page_size = 50
    with sqlite3.connect(f"file:{PLAYERS_DB}?mode=ro", uri=True) as connection:
        connection.row_factory = sqlite3.Row
        count = connection.execute("SELECT COUNT(*) FROM players").fetchone()[0]
        rows = connection.execute(
            "SELECT sofifa_id, short_name, age, nationality, club, "
            "player_positions, overall, potential FROM players "
            "ORDER BY overall DESC, sofifa_id ASC LIMIT ? OFFSET ?",
            (page_size, (page - 1) * page_size),
        ).fetchall()
    return jsonify(players=[dict(row) for row in rows], count=count,
                   page=page, page_size=page_size)

@app.route("/")
def hello():
    return render_template("index.html")

@app.route("/getData/<int:year>")
def getData(year):
    # Load the CSV file from the static folder, inside the current path
    revenue = pd.read_csv(os.path.join(APP_FOLDER,"static/data/1_Revenues.csv"))

    if year < 1942 or year > 2008:
        return "Error in the year range"

    filteredRevenue = revenue[revenue['Year4']==year][["Name","Year4", "Total Revenue","Population (000)"]]

    # show the post with the given id, the id is an integer
    return filteredRevenue.to_json(orient='records')
